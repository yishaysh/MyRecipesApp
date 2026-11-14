process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { ExtractorService } from '../services/extractor.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { JobQueueService } from '../services/job-queue.service.js';
import { UndoStore } from '../services/undo-store.js';
import { ParseRecipeRequestSchema } from '../shared/schemas/recipe.schema.js';
import { getKitchenStepTimerInfo, KitchenStepInput } from '../shared/index.js';

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
    assert.equal(pepperIngredient.unit, 'לפי הטעם', 'Unmeasured pepper seasoning must normalize to לפי הטעם');
    assert.equal(pepperIngredient.qtyMode, 'to_taste', 'Unmeasured pepper seasoning must have qtyMode=to_taste');
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

  test('Test 7: Hebrew ingredient word order, difficulty calibration & quality validation', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Hebrew Normalization, Difficulty Calibration & Quality Validation | Timestamp: ${new Date().toISOString()}`);

    const parser = new LlmParserService();
    assert.equal(parser.normalizeHebrewIngredientOrder('גדולים חלמונים'), 'חלמונים גדולים');
    assert.equal(parser.normalizeHebrewIngredientOrder('טרייה שמנת'), 'שמנת טרייה');

    const normYolks = parser.normalizeIngredientFields('חלמונים', 4, 'גדולים', 4);
    assert.equal(normYolks.name, 'חלמונים גדולים');
    assert.equal(normYolks.amount, 4);
    assert.equal(normYolks.unit, null);

    const normPasta = parser.normalizeIngredientFields('ספגטי', null, null, 4);
    assert.equal(normPasta.amount, 400);
    assert.equal(normPasta.unit, 'גרם');
    assert.equal(normPasta.amountEstimated, true);

    const normSalt = parser.normalizeIngredientFields('מלח ופלפל שחור', null, null, 4);
    assert.equal(normSalt.amount, null);
    assert.equal(normSalt.unit, 'לפי הטעם');
    console.log('  -> Verified: Hebrew adjective-noun order, adjective-in-unit fix, pasta portion & salt to-taste');

    const simplePastaDifficulty = parser.calibrateDifficulty(
      [
        { stepNumber: 1, instruction: 'מבשלים פסטה במים רותחים 10 דקות', durationMinutes: 10, tip: null },
        { stepNumber: 2, instruction: 'מערבבים חלמונים עם פרמזן', durationMinutes: null, tip: null },
        { stepNumber: 3, instruction: 'מאחדים עם הפסטה ומגישים חם', durationMinutes: null, tip: null }
      ],
      20,
      'בינוני'
    );
    assert.equal(simplePastaDifficulty, 'קל');
    console.log('  -> Verified: Simple 3-step 20m pasta calibrated to "קל"');

    const issues = parser.validateRecipeQuality({
      id: 'q1',
      title: 'פסטה בדיקה',
      description: null,
      sourceUrl: 'https://example.com',
      platform: 'WEB',
      imageUrl: null,
      servings: 2,
      prepTimeMinutes: 5,
      cookTimeMinutes: 10,
      totalTimeMinutes: 15,
      difficulty: 'קל',
      timeEstimated: false,
      category: 'פסטה',
      tags: ['פסטה'],
      ingredients: [{ name: 'גדולים חלמונים', amount: 2, unit: 'יחידות', category: null }],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים', durationMinutes: 10, tip: null }],
      nutrition: null,
      createdAt: new Date().toISOString(),
    }, {
      url: 'https://example.com',
      platform: 'WEB',
      text: 'פסטה בדיקה',
      authorName: null,
      imageUrl: null
    });
    assert.ok(issues.length > 0, 'Expected quality validator to catch reversed Hebrew adjective');
    console.log(`  -> Verified: Quality validator flagged ${issues.length} issue(s)`);

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 8: Honest Discovery Feed & extract-content route validation', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Discovery Feed Truthfulness & extract-content Validation | Timestamp: ${new Date().toISOString()}`);

    const trendsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/trends'
    });
    assert.equal(trendsRes.statusCode, 200);
    const trends = JSON.parse(trendsRes.payload);
    assert.ok(Array.isArray(trends.trends) && trends.trends.length > 0, 'Expected discovery trends items');
    for (const item of trends.trends) {
      assert.ok(!String(item.authorHandle || '').includes('קהילת_השפים'), 'Fake community handle must not appear');
      assert.ok(!String(item.viewsCount || '').includes('חילוצים בקהילה'), 'Fake extraction count must not appear');
    }
    console.log(`  -> Verified: ${trends.trends.length} discovery items use truthful source attribution`);

    const badContentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-content',
      payload: { text: '' }
    });
    assert.equal(badContentRes.statusCode, 400);
    console.log('  -> Verified: /api/v1/recipes/extract-content rejects empty input with 400');

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 9: B1 default/to-taste/missing qty, B2 gendered-copy lint & B3 PWA/SW/share-target routes', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: B1 Qty Modes, B2 Gender-Neutral Copy Lint & B3 PWA Routes | Timestamp: ${new Date().toISOString()}`);

    const parser = new LlmParserService();
    const normRice = parser.normalizeIngredientFields('אורז בסמטי', null, null, 4);
    assert.equal(normRice.amount, 300);
    assert.equal(normRice.unit, 'גרם');
    assert.equal(normRice.qtySource, 'default');
    assert.equal(normRice.amountEstimated, true);

    const normSalt = parser.normalizeIngredientFields('מלח', null, null, 4);
    assert.equal(normSalt.qtyMode, 'to_taste');

    const normUnknown = parser.normalizeIngredientFields('טופו משי', null, null, 4);
    assert.equal(normUnknown.quantityMissing, true);
    assert.equal(normUnknown.qtySource, 'missing');
    assert.equal(normUnknown.qtyMode, 'missing');
    console.log('  -> Verified: B1 default, to_taste, and missing quantity modes');

    const swRes = await app.inject({ method: 'GET', url: '/sw.js' });
    assert.equal(swRes.statusCode, 200);
    assert.ok(String(swRes.headers['content-type'] || '').includes('javascript'));
    assert.ok(swRes.payload.includes('SKIP_WAITING'));

    const manifestRes = await app.inject({ method: 'GET', url: '/manifest.webmanifest' });
    assert.equal(manifestRes.statusCode, 200);
    const manifestJson = JSON.parse(manifestRes.payload);
    assert.equal(manifestJson.dir, 'rtl');
    assert.equal(manifestJson.lang, 'he');
    assert.equal(manifestJson.share_target?.action, '/app/share-target');

    const shareRes = await app.inject({ method: 'GET', url: '/app/share-target?text=https://youtube.com/shorts/abc123' });
    assert.equal(shareRes.statusCode, 200);
    assert.ok(String(shareRes.headers['content-type'] || '').includes('text/html'));
    console.log('  -> Verified: /sw.js (200 JS), /manifest.webmanifest (200), /app/share-target (200 HTML)');

    const fs = await import('node:fs');
    const path = await import('node:path');
    const appHtmlPath = [
      path.resolve(process.cwd(), 'public/app.html'),
      path.resolve(process.cwd(), '../../public/app.html')
    ].find(p => fs.existsSync(p));
    assert.ok(appHtmlPath, 'Expected public/app.html to exist');
    const html = fs.readFileSync(appHtmlPath!, 'utf8');
    const forbiddenGendered = ['הפעילי אותו', 'את בטוחה', 'הזן את קוד', 'צפה במסלולי', 'הזן קוד הטבה'];
    for (const phrase of forbiddenGendered) {
      assert.ok(!html.includes(phrase), `Found gendered phrase in public/app.html: "${phrase}"`);
    }
    console.log('  -> Verified: B2 gender-neutral UI copy lint passed');

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 10: Round 5 P1 quantity defaults/to-taste/missing & P3 YouTube thumbnail sanitizer', () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Round 5 P1 Normalization & P3 Thumbnail Sanitization | Timestamp: ${new Date().toISOString()}`);

    const parser = new LlmParserService();
    const rawCachedCarbonara: any = {
      id: 'rec_cached_carbonara',
      title: 'ספגטי קרבונרה',
      description: 'קרבונרה איטלקית',
      sourceUrl: 'https://www.youtube.com/shorts/WIsFcCTVXcM',
      platform: 'youtube',
      imageUrl: 'https://i.ytimg.com/vi/WIsFcCTVXcM/hq2.jpg',
      candidateImages: [
        'https://i.ytimg.com/vi/WIsFcCTVXcM/hq2.jpg',
        'https://i.ytimg.com/vi/WIsFcCTVXcM/maxresdefault.jpg'
      ],
      difficulty: 'קל',
      timeEstimated: true,
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      ingredients: [
        { id: '1', name: 'ספגטי', amount: null, unit: null, category: 'pantry', originalText: 'spaghetti' },
        { id: '2', name: 'מלח ופלפל שחור', amount: 0, unit: 'לפי הטעם', category: 'spices', originalText: 'salt and black pepper' },
        { id: '3', name: 'שמן זית', amount: 'N/A', unit: '', category: 'pantry', originalText: 'olive oil' },
        { id: '4', name: 'קמח', amount: '', unit: null, category: 'pantry', originalText: 'flour' },
        { id: '5', name: 'חלמונים', amount: null, unit: null, category: 'dairy', originalText: 'egg yolks' },
        { id: '6', name: 'גבינת פקורינו', amount: null, unit: null, category: 'dairy', originalText: 'pecorino' }
      ],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים פסטה.' }],
      shoppingList: [],
      tags: ['איטלקי'],
      createdAt: new Date().toISOString()
    };

    console.log('[ACT]: Running LlmParserService.postProcessRecipe() on stale cached carbonara payload...');
    const processed = parser.postProcessRecipe(rawCachedCarbonara);

    const spaghetti = processed.ingredients.find((i) => i.name.includes('ספגטי'))!;
    assert.equal(spaghetti.amount, 400);
    assert.equal(spaghetti.unit, 'גרם');
    assert.equal(spaghetti.qtySource, 'default');
    assert.equal(spaghetti.amountEstimated, true);

    const saltPepper = processed.ingredients.find((i) => i.name.includes('מלח'))!;
    assert.equal(saltPepper.amount, null);
    assert.equal(saltPepper.unit, 'לפי הטעם');
    assert.equal(saltPepper.qtyMode, 'to_taste');
    assert.equal(saltPepper.quantityMissing, undefined);

    const oliveOil = processed.ingredients.find((i) => i.name.includes('שמן זית'))!;
    assert.equal(oliveOil.amount, 1);
    assert.equal(oliveOil.unit, 'כף');
    assert.equal(oliveOil.qtySource, 'default');

    const flour = processed.ingredients.find((i) => i.name.includes('קמח'))!;
    assert.equal(flour.amount, 160);
    assert.equal(flour.unit, 'גרם');

    const yolks = processed.ingredients.find((i) => i.name.includes('חלמונים'))!;
    assert.equal(yolks.amount, null);
    assert.equal(yolks.unit, null);
    assert.equal(yolks.quantityMissing, true);
    assert.equal(yolks.missingQty, true);
    assert.equal(yolks.qtyMode, 'missing');

    const pecorino = processed.ingredients.find((i) => i.name.includes('פקורינו'))!;
    assert.equal(pecorino.amount, 80);
    assert.equal(pecorino.unit, 'גרם');
    assert.equal(pecorino.qtySource, 'default');

    assert.equal(ExtractorService.isYouTubeAutoFrameUrl('https://i.ytimg.com/vi/WIsFcCTVXcM/hq2.jpg'), true);
    assert.equal(ExtractorService.isYouTubeAutoFrameUrl('https://i.ytimg.com/vi/WIsFcCTVXcM/hqdefault.jpg'), false);
    assert.equal(ExtractorService.isYouTubeAutoFrameUrl(processed.imageUrl), false);
    assert.ok(processed.imageUrl?.includes('hqdefault.jpg'), `Expected sanitized imageUrl, got ${processed.imageUrl}`);
    assert.ok(!(processed.candidateImages || []).some((u) => ExtractorService.isYouTubeAutoFrameUrl(u)));

    // Idempotency: re-running postProcessRecipe must preserve estimated/default flags and strip pure auto-frame candidate arrays
    const reProcessed = parser.postProcessRecipe(processed);
    const reSpaghetti = reProcessed.ingredients.find((i) => i.name.includes('ספגטי'))!;
    assert.equal(reSpaghetti.qtySource, 'default');
    assert.equal(reSpaghetti.amountEstimated, true);
    const allAutoFrameRecipe = parser.postProcessRecipe({
      ...rawCachedCarbonara,
      candidateImages: ['https://i.ytimg.com/vi/WIsFcCTVXcM/hq1.jpg', 'https://i.ytimg.com/vi/WIsFcCTVXcM/hq2.jpg']
    });
    assert.equal(allAutoFrameRecipe.candidateImages, undefined);
    console.log('[ASSERT]: Verified P1 normalized quantities, idempotency & P3 YouTube thumbnail sanitization.');

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 11: Round 5 P2 UndoStore lifecycle + P4/P5 web client contract checks', async () => {
    const startTime = Date.now();
    console.log(`\n[TEST START]: Round 5 P2 UndoStore & P4/P5 Client Contract Checks | Timestamp: ${new Date().toISOString()}`);

    const store = new UndoStore(6000);
    const items = [
      { id: 'a', title: 'ראשון' },
      { id: 'b', title: 'שני' },
      { id: 'c', title: 'שלישי' }
    ];
    const deleted = items.splice(1, 1)[0];
    const baseTime = 1_700_000_000_000;
    const pushed = store.push({ kind: 'recipe', payload: deleted, index: 1, now: baseTime });

    const entryInWindow = store.undo<typeof deleted>(pushed.id, baseTime + 5999);
    assert.ok(entryInWindow, 'Expected undo entry to remain valid within 6s');
    assert.deepEqual(entryInWindow!.payload, deleted);
    const restoredList = UndoStore.restoreAtIndex(items, entryInWindow!.payload, entryInWindow!.index);
    assert.deepEqual(restoredList.map((x) => x.id), ['a', 'b', 'c']);

    const expiredPush = store.push({ kind: 'shopping', payload: { name: 'בצל' }, index: 0, now: baseTime });
    const afterExpiry = store.undo(expiredPush.id, baseTime + 6001);
    assert.equal(afterExpiry, null, 'Expired undo entry (>6s) must return null and not restore');
    console.log('[ASSERT]: Verified UndoStore multi-item restoration at exact index and 6s expiry.');

    const fs = await import('node:fs');
    const path = await import('node:path');
    const appHtmlPath = [
      path.resolve(process.cwd(), 'public/app.html'),
      path.resolve(process.cwd(), '../../public/app.html')
    ].find((p) => fs.existsSync(p));
    assert.ok(appHtmlPath, 'Expected public/app.html to exist');
    const html = fs.readFileSync(appHtmlPath!, 'utf8');

    assert.ok(/\.toast-msg\s*\{[^}]*pointer-events:\s*auto;/s.test(html), 'Toast buttons must receive pointer events');
    assert.ok(!html.includes('checkQuotaBeforeExtraction'), 'Share target must call checkQuotaBeforeExtract');
    assert.ok(!html.includes("getElementById('text-input')"), 'Share target must target #raw-recipe-text-input');
    assert.ok(html.includes('history.replaceState'), 'Share target must clean query params cleanly');
    assert.ok(html.includes('friendlyExtractError'), 'Must map extraction errors via friendlyExtractError');
    assert.ok(html.includes('נמצא מתכון אחד בקובץ'), 'Singular import label must use נמצא מתכון אחד');
    assert.ok(!/(?:^|[^\u0590-\u05FF])התחבר לשמירה/.test(html), 'Found remaining masculine imperative התחבר לשמירה');
    assert.ok(!html.includes('לחצו "שמור שינויים"'), 'Found outdated לחצו phrasing');
    assert.ok(!html.includes('הזינו קוד VIP'), 'Found outdated הזינו phrasing');
    assert.ok(html.includes('מזווה ויבשים'), 'Pantry shopping section must exist');
    console.log('[ASSERT]: Verified P2 toast pointer-events, P4 share-target fixes, and P5 Hebrew copy/error checks.');

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });

  test('Test 12: Kitchen Mode timer eligibility (baking, proofing, cooling only), optional start UI & Web/Mobile parity', async () => {
    const startTime = Date.now();
    console.log(`[TEST START]: Test 12 - Kitchen Mode selective timer eligibility & UI wiring (${new Date().toISOString()})`);

    // Locate repository root reliably from compiled dist/test or src/test
    let probeDir = path.dirname(fileURLToPath(import.meta.url));
    let repoRoot = '';
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(path.join(probeDir, 'public', 'app.html'))) {
        repoRoot = probeDir;
        break;
      }
      probeDir = path.dirname(probeDir);
    }
    assert.ok(repoRoot, 'Could not locate repository root containing public/app.html');
    const appHtmlPath = path.join(repoRoot, 'public', 'app.html');
    const mobileAppPath = path.join(repoRoot, 'apps', 'mobile', 'App.tsx');
    console.log(`[SETUP / FIXTURE]: Loaded web client from ${appHtmlPath} and mobile app from ${mobileAppPath}`);

    const appHtml = fs.readFileSync(appHtmlPath, 'utf8');
    const mobileAppTsx = fs.readFileSync(mobileAppPath, 'utf8');

    const helperStartIdx = appHtml.indexOf('const KITCHEN_TIMER_CATEGORY_LABELS_HE =');
    const helperEndIdx = appHtml.indexOf('function activateKitchenModalTimer()');
    assert.ok(helperStartIdx !== -1 && helperEndIdx > helperStartIdx, 'Web client must embed KITCHEN_TIMER_CATEGORY_LABELS_HE helper block');

    const helperSnippet = appHtml.slice(helperStartIdx, helperEndIdx);
    const webSandbox: Record<string, unknown> = {};
    vm.runInNewContext(`${helperSnippet}\nthis.__getKitchenStepTimerInfo = getKitchenStepTimerInfo;`, webSandbox);
    const webGetKitchenStepTimerInfo = webSandbox.__getKitchenStepTimerInfo as (step?: KitchenStepInput | null) => unknown;
    assert.equal(typeof webGetKitchenStepTimerInfo, 'function');

    interface TimerCase {
      name: string;
      step: KitchenStepInput;
      expected: { eligible: true; category: string; durationMinutes: number; labelHe: string } | null;
    }

    const cases: TimerCase[] = [
      // Baking (Hebrew + English)
      {
        name: 'Hebrew oven baking with explicit minutes',
        step: { instruction: 'אופים בתנור שחומם מראש למשך 35 דקות עד להזהבה', durationMinutes: 35 },
        expected: { eligible: true, category: 'baking', durationMinutes: 35, labelHe: 'טיימר אפייה' }
      },
      {
        name: 'Hebrew preheat + bake combined step',
        step: { instruction: 'מחממים תנור ל-180 מעלות ואופים 25 דקות', durationMinutes: null },
        expected: { eligible: true, category: 'baking', durationMinutes: 25, labelHe: 'טיימר אפייה' }
      },
      {
        name: 'Hebrew roast/place into oven extracted duration',
        step: { instruction: 'מכניסים לתנור החם ל-20-25 דקות' },
        expected: { eligible: true, category: 'baking', durationMinutes: 20, labelHe: 'טיימר אפייה' }
      },
      {
        name: 'English baking step',
        step: { instruction: 'Bake in the oven for 30 minutes until golden brown', durationMinutes: 30 },
        expected: { eligible: true, category: 'baking', durationMinutes: 30, labelHe: 'טיימר אפייה' }
      },
      // Proofing / rising (Hebrew + English)
      {
        name: 'Hebrew proofing with hour text',
        step: { instruction: 'מכסים במגבת ומתפיחים כשעה במקום חמים' },
        expected: { eligible: true, category: 'proofing', durationMinutes: 60, labelHe: 'טיימר התפחה' }
      },
      {
        name: 'Hebrew rising hour and a half text',
        step: { instruction: 'התפחה ראשונה של שעה וחצי עד הכפלת הנפח' },
        expected: { eligible: true, category: 'proofing', durationMinutes: 90, labelHe: 'טיימר התפחה' }
      },
      {
        name: 'English dough rising step',
        step: { instruction: 'Cover and let proof for 45 min until doubled in size', durationMinutes: 45 },
        expected: { eligible: true, category: 'proofing', durationMinutes: 45, labelHe: 'טיימר התפחה' }
      },
      // Cooling / chilling (Hebrew + English)
      {
        name: 'Hebrew fridge chilling half hour text',
        step: { instruction: 'מכניסים לקירור במקרר לחצי שעה לפני ההגשה' },
        expected: { eligible: true, category: 'cooling', durationMinutes: 30, labelHe: 'טיימר קירור' }
      },
      {
        name: 'Hebrew freezing two hours text',
        step: { instruction: 'מקפיאים במקפיא לשעתיים להתייצבות' },
        expected: { eligible: true, category: 'cooling', durationMinutes: 120, labelHe: 'טיימר קירור' }
      },
      {
        name: 'English chill in fridge',
        step: { instruction: 'Chill in the refrigerator for 2 hours before slicing' },
        expected: { eligible: true, category: 'cooling', durationMinutes: 120, labelHe: 'טיימר קירור' }
      },
      // Ineligible steps & false positives (must all return null even with durationMinutes set)
      {
        name: 'Preheat oven only (even with durationMinutes)',
        step: { instruction: 'מחממים מראש את התנור ל-180 מעלות', durationMinutes: 10 },
        expected: null
      },
      {
        name: 'English preheat only',
        step: { instruction: 'Preheat the oven to 200C', durationMinutes: 10 },
        expected: null
      },
      {
        name: 'Parchment paper / baking tray false positive',
        step: { instruction: 'מרפדים תבנית אפייה בנייר אפייה ומפזרים מעל', durationMinutes: 5 },
        expected: null
      },
      {
        name: 'Baking powder + self-rising flour false positive',
        step: { instruction: 'מערבבים בקערה קמח תופח ואבקת אפייה', durationMinutes: 3 },
        expected: null
      },
      {
        name: 'Passive chilled ingredient & removing from fridge',
        step: { instruction: 'מוציאים את הקדאיף המצונן מהמקרר כ-10 דקות לפני העבודה', durationMinutes: 10 },
        expected: null
      },
      {
        name: 'Stovetop pan frying step (not oven baking)',
        step: { instruction: 'מטגנים במחבת עם שמן זית במשך 6 דקות עד הזהבה', durationMinutes: 6 },
        expected: null
      },
      {
        name: 'Boiling / simmering pasta step',
        step: { instruction: 'מבשלים את הפסטה במים רותחים במשך 9 דקות', durationMinutes: 9 },
        expected: null
      },
      {
        name: 'Eligible baking step without any duration',
        step: { instruction: 'אופים בתנור עד שהקצוות מזהיבים', durationMinutes: null },
        expected: null
      }
    ];

    console.log(`[ARRANGE]: Testing ${cases.length} step classifications for shared & web helper parity`);

    for (const tc of cases) {
      const sharedResult = getKitchenStepTimerInfo(tc.step);
      const rawWebResult = webGetKitchenStepTimerInfo(tc.step);
      // Normalize VM realm Object.prototype before strict deep comparison
      const webResult = rawWebResult === null ? null : JSON.parse(JSON.stringify(rawWebResult));
      assert.deepStrictEqual(sharedResult, tc.expected, `Shared timer classification mismatch for case "${tc.name}"`);
      assert.deepStrictEqual(webResult, tc.expected, `Web inline timer classification mismatch for case "${tc.name}"`);
      assert.deepStrictEqual(webResult, sharedResult, `Web/Shared parity mismatch for case "${tc.name}"`);
    }
    console.log(`[ASSERT]: All ${cases.length} positive & false-positive kitchen timer classifications passed with 100% Web/Shared parity.`);

    // Web UI structural assertions (optional start button only, hidden active card, no auto-start)
    assert.ok(appHtml.includes('id="kitchen-step-timer-trigger-wrap"'), 'Web Kitchen Mode must include optional trigger wrapper');
    assert.ok(appHtml.includes('id="kitchen-step-timer-trigger-btn" onclick="activateKitchenModalTimer()"'), 'Web Kitchen Mode must include optional Start timer button');
    assert.match(appHtml, /id="kitchen-step-timer-active-card"[^>]*display:\s*none/, 'Web active countdown card must be hidden by default');
    const displayFnStart = appHtml.indexOf('function updateKitchenStepDisplay()');
    const displayFnEnd = appHtml.indexOf('function nextKitchenStep()');
    assert.ok(displayFnStart !== -1 && displayFnEnd > displayFnStart, 'Could not locate updateKitchenStepDisplay');
    const displayFnBody = appHtml.slice(displayFnStart, displayFnEnd);
    assert.ok(displayFnBody.includes('stopKitchenModalTimer(true)'), 'Step render must stop any running timer on step transition');
    assert.ok(displayFnBody.includes('getKitchenStepTimerInfo(step)'), 'Step render must check getKitchenStepTimerInfo(step)');
    assert.ok(!displayFnBody.includes('toggleKitchenModalTimer()'), 'Step render must never auto-start the kitchen timer');
    assert.ok(!displayFnBody.includes('activateKitchenModalTimer()'), 'Step render must never auto-expand the kitchen timer');
    console.log('[ASSERT]: Verified Web Kitchen Mode renders optional start button only on eligible steps and never auto-starts.');

    // Mobile TSX structural assertions
    assert.ok(mobileAppTsx.includes('getKitchenStepTimerInfo(step)'), 'Mobile KitchenStepTimer must classify steps via getKitchenStepTimerInfo');
    assert.ok(mobileAppTsx.includes('React.useState(false)') && mobileAppTsx.includes('setIsExpanded(false)'), 'Mobile KitchenStepTimer must default to collapsed state');
    assert.ok(mobileAppTsx.includes('if (!timerInfo || !durationMinutes) return null;'), 'Mobile KitchenStepTimer must render nothing on ineligible steps');
    assert.ok(mobileAppTsx.includes('<KitchenStepTimer\r\n                  step={currentStep}') || mobileAppTsx.includes('<KitchenStepTimer\n                  step={currentStep}'), 'Mobile modal must pass currentStep to KitchenStepTimer');
    console.log('[ASSERT]: Verified Mobile KitchenStepTimer wiring, collapsed default, and null render for ineligible steps.');

    const runtime = Date.now() - startTime;
    console.log(`[TEST END]: Completed status: SUCCESS | Runtime: ${runtime}ms`);
  });
});
