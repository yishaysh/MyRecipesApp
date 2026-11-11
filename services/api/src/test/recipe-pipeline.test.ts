process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { ExtractorService } from '../services/extractor.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { JobQueueService } from '../services/job-queue.service.js';
import { ParseRecipeRequestSchema } from '../shared/schemas/recipe.schema.js';

describe('Social Recipe Extractor Pipeline & API Tests', () => {
  let app: FastifyInstance;
  const storage = RecipeStorageService.getInstance();
  const jobQueue = JobQueueService.getInstance();

  before(async () => {
    console.log('[SETUP / FIXTURE] Initializing Fastify test server instance and clearing in-memory storage');
    storage.clear();
    jobQueue.clear();
    app = buildApp();
    await app.ready();
    console.log('[SETUP / FIXTURE] Test environment ready.');
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Tearing down Fastify test server and cleaning stores');
    storage.clear();
    jobQueue.clear();
    await app.close();
    console.log('[CLEANUP / TEARDOWN] Teardown complete.');
  });

  test('Test 1: ExtractorService identifies platforms accurately and handles audio fallback', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Platform Detection and Audio Fallback Verification | Timestamp: ${new Date().toISOString()}`);

    // ARRANGE
    console.log('[ARRANGE]: Preparing social media sample URLs for Instagram, TikTok, YouTube, and Facebook');
    const igUrl = 'https://www.instagram.com/reel/C123456789/';
    const tiktokUrl = 'https://www.tiktok.com/@chef/video/987654321';
    const ytUrl = 'https://youtube.com/shorts/abcdef123';
    const extractor = new ExtractorService();

    // ACT
    console.log('[ACT]: Executing ExtractorService.detectPlatform and extractRawContent');
    const igPlatform = ExtractorService.detectPlatform(igUrl);
    const tiktokPlatform = ExtractorService.detectPlatform(tiktokUrl);
    const ytPlatform = ExtractorService.detectPlatform(ytUrl);
    const rawContent = await extractor.extractRawContent('https://www.instagram.com/reel/empty-caption-video');

    // ASSERT
    console.log('[ASSERT]: Verifying detected platforms match expected values');
    assert.equal(igPlatform, 'instagram');
    console.log('  -> Verified: Instagram URL mapped to "instagram"');
    assert.equal(tiktokPlatform, 'tiktok');
    console.log('  -> Verified: TikTok URL mapped to "tiktok"');
    assert.equal(ytPlatform, 'youtube');
    console.log('  -> Verified: YouTube URL mapped to "youtube"');

    console.log('[ASSERT]: Verifying audio transcription fallback triggers when caption is incomplete');
    assert.ok(rawContent.audioTranscript !== undefined, 'Expected audio transcript fallback');
    console.log(`  -> Verified: Fallback audio transcript extracted: "${rawContent.audioTranscript}"`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 2: LlmParserService generates canonical StructuredRecipe and enforces null for missing amounts', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: LLM Structured Parsing & Hallucination Prevention Test | Timestamp: ${new Date().toISOString()}`);

    // ARRANGE
    console.log('[ARRANGE]: Preparing raw media payload for Spaghetti Carbonara with unmeasured pepper');
    const extractor = new ExtractorService();
    const parser = new LlmParserService();
    const raw = await extractor.extractRawContent('https://www.instagram.com/reel/spaghetti-carbonara-authentic');

    // ACT
    console.log('[ACT]: Executing LlmParserService.parseToRecipe');
    const recipe = await parser.parseToRecipe(raw);

    // ASSERT
    console.log('[ASSERT]: Verifying canonical recipe fields and structure');
    assert.ok(recipe.id.startsWith('rec_'), 'Recipe ID must follow standard prefix');
    assert.equal(recipe.platform, 'instagram');
    assert.ok(recipe.ingredients.length >= 4, 'Must have at least 4 ingredients');
    console.log(`  -> Verified: Recipe Title: "${recipe.title}", Platform: "${recipe.platform}", Ingredients Count: ${recipe.ingredients.length}`);

    console.log('[ASSERT]: Verifying Hallucination Prevention rule: unstated quantity/duration is null');
    const pepperIngredient = recipe.ingredients.find((i: any) => i.name.includes('פלפל') || i.name.toLowerCase().includes('pepper'));
    assert.ok(pepperIngredient, 'Pepper ingredient should exist');
    assert.equal(pepperIngredient.amount, null, 'Unmeasured pepper amount must be null');
    assert.equal(pepperIngredient.unit, null, 'Unmeasured pepper unit must be null');
    console.log(`  -> Verified: Unmeasured ingredient amount correctly set to null: ${JSON.stringify(pepperIngredient)}`);

    console.log('[ASSERT]: Verifying shopping list categorizes ingredients');
    assert.ok(recipe.shoppingList.length > 0, 'Shopping list should not be empty');
    const meatCategory = recipe.shoppingList.find((c: any) => c.category === 'meat');
    assert.ok(meatCategory, 'Meat category should exist in shopping list');
    console.log(`  -> Verified: Shopping list contains category "${meatCategory.category}" with items: ${JSON.stringify(meatCategory.items)}`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 3: Fastify API Ingestion Endpoint (POST /api/v1/recipes/parse) & Job Polling', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: End-to-End API Parse & Async Job Polling Test | Timestamp: ${new Date().toISOString()}`);

    // ARRANGE
    console.log('[ARRANGE]: Creating POST payload for Shakshuka reel');
    const payload = {
      sourceUrl: 'https://www.tiktok.com/@chef/video/shakshuka-breakfast',
      userId: 'usr_test_777'
    };
    console.log(`[ARRANGE]: Payload preview: ${JSON.stringify(payload)}`);

    // ACT
    console.log('[ACT]: Submitting POST /api/v1/recipes/parse request to Fastify server');
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/parse',
      payload
    });

    // ASSERT
    console.log('[ASSERT]: Verifying HTTP 202 Accepted and initial Job status');
    assert.equal(postRes.statusCode, 202);
    const jobData = JSON.parse(postRes.payload);
    assert.ok(jobData.jobId);
    assert.equal(jobData.status, 'processing');
    console.log(`  -> Verified: Job created with ID: ${jobData.jobId}, Status: ${jobData.status}`);

    // Wait 50ms for the asynchronous worker to finish processing
    await new Promise(r => setTimeout(r, 50));

    // ACT
    console.log(`[ACT]: Polling GET /api/v1/recipes/jobs/${jobData.jobId}`);
    const pollRes = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/jobs/${jobData.jobId}`
    });

    // ASSERT
    console.log('[ASSERT]: Verifying job status is completed and recipe is populated');
    assert.equal(pollRes.statusCode, 200);
    const polledJob = JSON.parse(pollRes.payload);
    assert.equal(polledJob.status, 'completed');
    assert.ok(polledJob.recipe);
    assert.equal(polledJob.recipe.platform, 'tiktok');
    console.log(`  -> Verified: Job completed! Recipe title: "${polledJob.recipe.title}", Steps: ${polledJob.recipe.instructions.length}`);

    // Verify stored recipes list endpoint
    console.log('[ACT]: Querying GET /api/v1/recipes to verify database persistence');
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes'
    });
    assert.equal(listRes.statusCode, 200);
    const listData = JSON.parse(listRes.payload);
    assert.ok(listData.total >= 1);
    console.log(`  -> Verified: Recipe list returned total: ${listData.total} recipes in database`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 4: TrendDiscoveryService returns live viral culinary trends and supports filters', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Live Culinary Trends API Endpoint Verification | Timestamp: ${new Date().toISOString()}`);

    // ACT 1: Fetch all trends
    console.log('[ACT]: Querying GET /api/v1/recipes/trends');
    const trendsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/trends'
    });

    // ASSERT 1
    assert.equal(trendsRes.statusCode, 200);
    const data = JSON.parse(trendsRes.payload);
    assert.ok(Array.isArray(data.trends));
    assert.ok(data.trends.length >= 5);
    assert.ok(data.categories.length > 0);
    console.log(`  -> Verified: Retrieved ${data.trends.length} viral trends. Top trend: "${data.trends[0].title}" (${data.trends[0].viewsCount})`);

    // ACT 2: Filter by platform (tiktok)
    console.log('[ACT]: Querying GET /api/v1/recipes/trends?platform=tiktok');
    const tiktokRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/trends?platform=tiktok'
    });
    assert.equal(tiktokRes.statusCode, 200);
    const tiktokData = JSON.parse(tiktokRes.payload);
    assert.ok(tiktokData.trends.every((t: any) => t.platform === 'tiktok'));
    console.log(`  -> Verified: Filtered to ${tiktokData.trends.length} TikTok trends.`);

    // ACT 3: Filter by category (קינוחים)
    console.log('[ACT]: Querying GET /api/v1/recipes/trends?category=קינוחים');
    const dessertRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/trends?category=קינוחים'
    });
    assert.equal(dessertRes.statusCode, 200);
    const dessertData = JSON.parse(dessertRes.payload);
    assert.ok(dessertData.trends.every((t: any) => t.category === 'קינוחים' || t.tags.includes('קינוחים')));
    console.log(`  -> Verified: Filtered to ${dessertData.trends.length} dessert trends.`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 5: API Ingestion and Schema accept text with leading title/description and extract clean URL', async () => {
    const startTime = Date.now();
    console.log(`[TEST START]: Shared Text URL Preprocessing Verification | Timestamp: ${new Date().toISOString()}`);

    // ARRANGE: Raw text copied from Google Share / WhatsApp
    const sharedText = 'מקלובה מושלמת | חן במטבח https://share.google/CzUNiEAsB93CyDEym';
    console.log(`[ARRANGE]: Input text with Hebrew title: "${sharedText}"`);

    // ACT: Validate via ParseRecipeRequestSchema
    const parsed = ParseRecipeRequestSchema.safeParse({ sourceUrl: sharedText });
    assert.ok(parsed.success, 'Schema should successfully preprocess and extract URL');
    assert.equal(parsed.data.sourceUrl, 'https://share.google/CzUNiEAsB93CyDEym');
    console.log(`[ASSERT]: Verified sourceUrl extracted cleanly: "${parsed.data.sourceUrl}"`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 6: Image Proxy rejects disallowed/SSRF URLs silently via 302 thematic category fallback', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Image Proxy Security & Category Fallback Verification | Timestamp: ${new Date().toISOString()}`);

    // ACT 1: Missing URL falls back silently with 302
    const emptyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/image-proxy'
    });
    assert.equal(emptyRes.statusCode, 302);
    assert.ok(String(emptyRes.headers.location || '').startsWith('https://images.unsplash.com/'));
    console.log(`  -> Verified: Missing URL redirected (302) cleanly to ${emptyRes.headers.location}`);

    // ACT 2: Disallowed host with dessert category redirects silently to category-specific Unsplash photo
    const disallowedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/image-proxy?url=' + encodeURIComponent('https://evil.example.com/tracker.png') + '&category=' + encodeURIComponent('קינוחים')
    });
    assert.equal(disallowedRes.statusCode, 302);
    assert.equal(disallowedRes.headers.location, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop');
    console.log(`  -> Verified: Non-whitelisted URL redirected to dessert fallback: ${disallowedRes.headers.location}`);

    // ACT 3: Internal localhost SSRF attempt redirects silently
    const ssrfRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/image-proxy?url=' + encodeURIComponent('https://127.0.0.1:8080/internal')
    });
    assert.equal(ssrfRes.statusCode, 302);
    console.log(`  -> Verified: SSRF attempt blocked cleanly via 302 fallback`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });
});
