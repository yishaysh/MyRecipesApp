process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../services/auth.service.js';
import { ExtractionJobService } from '../services/extraction-job.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { SyncService } from '../services/sync.service.js';
import {
  buildCroppedProxyUrl,
  cropImageBuffer,
  parseCropParam,
  validateNormalizedCropBox
} from '../services/image-crop.util.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');

function extractFunctionSource(html: string, funcDecl: string): string {
  const start = html.indexOf(funcDecl);
  assert.ok(start !== -1, `Expected to find "${funcDecl}" in public/app.html`);
  const lineStart = html.lastIndexOf('\n', start) + 1;
  const indentMatch = html.slice(lineStart, start).match(/^[ \t]*/);
  const indent = indentMatch ? indentMatch[0] : '';
  const closeMarker = `\n${indent}}`;
  const endIdx = html.indexOf(closeMarker, start);
  assert.ok(endIdx !== -1, `Expected closing "${closeMarker.trim()}" for "${funcDecl}"`);
  return html.slice(start, endIdx + closeMarker.length);
}

describe('v1.9.10 (Build 39) Background Extraction, Per-Dish Cropping & Legacy Routes Suite', () => {
  let app: FastifyInstance;
  const storage = RecipeStorageService.getInstance();
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Booting Fastify instance for v1.9.10 acceptance suite');
    storage.clear();
    SyncService.inMemoryUserRecipes.clear();
    ExtractionJobService.clearForTests();
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance');
    storage.clear();
    SyncService.inMemoryUserRecipes.clear();
    ExtractionJobService.clearForTests();
    await app.close();
  });

  // =========================================================================
  // FIX 3: Legacy manifest & assetlinks routes (never 500) + PWA manifest intact
  // =========================================================================
  test('FIX 3: /.well-known/assetlinks.json returns 404, /manifest.json returns 301, /manifest.webmanifest & /app/manifest.webmanifest return valid PWA manifest, unknown paths return 404', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 3 Legacy Routes & PWA Manifest | ${new Date().toISOString()}`);

    const assetlinksRes = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });
    assert.equal(assetlinksRes.statusCode, 404, 'GET /.well-known/assetlinks.json must return 404');

    const legacyManifestRes = await app.inject({ method: 'GET', url: '/manifest.json' });
    assert.equal(legacyManifestRes.statusCode, 301, 'GET /manifest.json must return 301 redirect');
    assert.equal(legacyManifestRes.headers.location, '/manifest.webmanifest');

    for (const pwaPath of ['/manifest.webmanifest', '/app/manifest.webmanifest']) {
      const pwaRes = await app.inject({ method: 'GET', url: pwaPath });
      assert.equal(pwaRes.statusCode, 200, `GET ${pwaPath} must return 200`);
      const body = JSON.parse(pwaRes.payload);
      assert.equal(body.display, 'standalone');
      assert.equal(body.share_target?.action, '/app/share-target');
      assert.equal(body.share_target?.method, 'GET');
      assert.ok(Array.isArray(body.icons) && body.icons.length >= 2);
    }

    const unknownRes = await app.inject({ method: 'GET', url: '/nonexistent-static-file-v1910.json' });
    assert.equal(unknownRes.statusCode, 404, 'Unknown static path must return clean 404, never 500');

    // Verify vercel.json & services/api/vercel.json both route unmatched paths to /api/index (never Vercel default 500)
    for (const vjPath of [path.join(REPO_ROOT, 'vercel.json'), path.join(REPO_ROOT, 'services', 'api', 'vercel.json')]) {
      const vj = JSON.parse(fs.readFileSync(vjPath, 'utf8'));
      const hasCatchAll = Array.isArray(vj.rewrites) && vj.rewrites.some((r: any) => r.source === '/(.*)' && r.destination === '/api/index');
      assert.equal(hasCatchAll, true, `${vjPath} must include catch-all rewrite to /api/index`);
    }

    console.log(`[ASSERT]: FIX 3 passed (${Date.now() - t0}ms)`);
  });

  // =========================================================================
  // FIX 2: Per-dish bounding-box validation, pure-JS cropping & safe fallback
  // =========================================================================
  test('FIX 2: Multi-dish slide uses validated cropped image per dish, rejects malformed/full-frame boxes with safe fallback, preserves single-dish slide', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 2 Per-Dish Carousel Image Cropping & Fallback | ${new Date().toISOString()}`);

    // 1. Box validation & clamping
    const valid = validateNormalizedCropBox({ x: 0.05, y: 0.08, w: 0.44, h: 0.42 });
    assert.deepEqual(valid, { x: 0.05, y: 0.08, w: 0.44, h: 0.42 });

    // Reject malformed, tiny, out-of-bounds, and full-frame boxes
    assert.equal(validateNormalizedCropBox({ x: 0, y: 0, w: 1, h: 1 }), null, 'Must reject full-frame box on multi-dish slide');
    assert.equal(validateNormalizedCropBox({ x: 0.1, y: 0.1, w: 0.05, h: 0.05 }), null, 'Must reject tiny box');
    assert.equal(validateNormalizedCropBox({ x: 100, y: 200, w: 300, h: 300 }), null, 'Must reject pixel coords');
    assert.equal(validateNormalizedCropBox({ x: NaN, y: 0, w: 0.5, h: 0.5 }), null, 'Must reject NaN');
    assert.equal(parseCropParam('invalid'), null);
    assert.deepEqual(parseCropParam('0.05,0.1,0.45,0.4'), { x: 0.05, y: 0.1, w: 0.45, h: 0.4 });

    // 2. Pure-JS JPEG crop test (100x80 -> 45x40)
    const jpeg = require('jpeg-js');
    const rawRgba = Buffer.alloc(100 * 80 * 4, 180);
    const encoded = jpeg.encode({ data: rawRgba, width: 100, height: 80 }, 85);
    const cropped = cropImageBuffer(Buffer.from(encoded.data), 'image/jpeg', { x: 0.05, y: 0.1, w: 0.45, h: 0.5 });
    assert.ok(cropped && cropped.buffer.byteLength > 0, 'JPEG crop must succeed');
    const decodedCropped = jpeg.decode(cropped!.buffer, { useTArray: true });
    assert.equal(decodedCropped.width, 45);
    assert.equal(decodedCropped.height, 40);

    // 3. Multi-dish slide image resolution vs single-dish slide
    const parser = new LlmParserService();
    const sharedSlideUrl = 'https://scontent.cdninstagram.com/v/slide2.jpg';
    const dishA = parser.resolveCarouselDishImageUrl({
      title: 'אסאדו ביין אדום',
      summary: 'אסאדו בתנור',
      imageUrl: sharedSlideUrl,
      cropBox: { x: 0.02, y: 0.05, w: 0.46, h: 0.45 },
      sharedSlideCount: 2
    });
    const dishB = parser.resolveCarouselDishImageUrl({
      title: 'אסאדו מפורק בלחמנייה',
      summary: 'אסאדו מפורק',
      imageUrl: sharedSlideUrl,
      cropBox: { x: 0.52, y: 0.05, w: 0.46, h: 0.45 },
      sharedSlideCount: 2
    });
    const dishBadBox = parser.resolveCarouselDishImageUrl({
      title: 'אסאדו בסילאן',
      summary: 'אסאדו מתקתק',
      imageUrl: sharedSlideUrl,
      cropBox: null,
      sharedSlideCount: 2
    });
    const singleSlideDish = parser.resolveCarouselDishImageUrl({
      title: 'שקשוקה',
      summary: 'שקשוקה ביתית',
      imageUrl: sharedSlideUrl,
      cropBox: null,
      sharedSlideCount: 1
    });

    assert.ok(dishA.startsWith('/api/v1/recipes/image-proxy?') && dishA.includes('crop=0.02%2C0.05%2C0.46%2C0.45'), 'Dish A must receive its own crop URL');
    assert.ok(dishB.startsWith('/api/v1/recipes/image-proxy?') && dishB.includes('crop=0.52%2C0.05%2C0.46%2C0.45'), 'Dish B must receive its own distinct crop URL');
    assert.notEqual(dishA, dishB);
    assert.notEqual(dishBadBox, sharedSlideUrl, 'Missing/invalid crop on multi-dish slide must NEVER reuse full shared slide');
    assert.ok(dishBadBox.startsWith('https://images.unsplash.com/'), 'Fallback must be a safe neutral/thematic food image');
    assert.equal(singleSlideDish, sharedSlideUrl, 'Single-dish slide must preserve full slide image unchanged');

    // Verify client resolveSafeRecipeImage preserves /api/v1/recipes/image-proxy?...&crop=...
    const proxyUrl = buildCroppedProxyUrl(sharedSlideUrl, { x: 0.02, y: 0.05, w: 0.46, h: 0.45 }, 'אסאדו');
    assert.ok(appHtml.includes("rawUrl.trim().startsWith('/api/v1/recipes/image-proxy')"), 'Client resolveSafeRecipeImage must allow cropped image-proxy URLs');
    assert.ok(proxyUrl.includes('crop='));

    console.log(`[ASSERT]: FIX 2 passed (${Date.now() - t0}ms)`);
  });

  // =========================================================================
  // FIX 1 (A, B, D): Authenticated server-side persistence, carousel batch resilience,
  // idempotency, 1 quota per post, and guest isolation
  // =========================================================================
  test('FIX 1 (A, B, D): Authenticated carousel batch persists incrementally to cloud, survives disconnect/recovery, enforces 1 quota, and isolates guests', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 1 Server Persistence, Job Recovery & Guest Isolation | ${new Date().toISOString()}`);

    // 1. Authenticated Google user
    const { token: authToken, user: authUser } = await AuthService.authenticateWithGoogle({
      sub: `google_v1910_${Date.now()}`,
      email: 'chef.v1910@example.com',
      name: 'Chef Test'
    });

    const carouselUrl = 'https://www.instagram.com/p/DgHsPriCFhg/';
    const discoverRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: { url: carouselUrl, jobId: `xjob_disc_${Date.now()}` }
    });
    assert.equal(discoverRes.statusCode, 200);
    const discoverBody = JSON.parse(discoverRes.payload);
    assert.equal(discoverBody.multiDish, true);
    const batchId = discoverBody.batchId;
    const picked = discoverBody.dishes.slice(0, 2);
    const allDishIds = picked.map((d: any) => d.dishId);

    // Extract dish 1 of 2 (simulating user switching apps right after dish 1 finishes)
    const d1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-dish',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        batchId,
        sourceUrl: discoverBody.sourceUrl,
        platform: 'instagram',
        groupLabel: discoverBody.groupLabel,
        totalDishes: discoverBody.dishes.length,
        totalSelected: 2,
        allDishIds,
        dish: picked[0]
      }
    });
    assert.equal(d1Res.statusCode, 200);
    const d1Body = JSON.parse(d1Res.payload);
    assert.equal(d1Body.persistedToCloud, true, 'Authenticated dish 1 must be persisted to cloud immediately');
    assert.equal(d1Body.quotaCharged, true, 'First dish charges 1 quota unit');

    // Verify partial batch job lookup shows 1 completed, 1 pending
    const midJobRes = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/extraction-jobs/${batchId}`,
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(midJobRes.statusCode, 200);
    const midJob = JSON.parse(midJobRes.payload);
    assert.equal(midJob.status, 'pending');
    assert.deepEqual(midJob.completedDishIds, [picked[0].dishId]);
    assert.deepEqual(midJob.pendingDishIds, [picked[1].dishId]);
    assert.equal(midJob.recipes.length, 1);

    // Retry dish 1 (idempotency check): must NOT charge extra quota or duplicate
    const d1RetryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-dish',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        batchId,
        sourceUrl: discoverBody.sourceUrl,
        platform: 'instagram',
        groupLabel: discoverBody.groupLabel,
        totalDishes: discoverBody.dishes.length,
        totalSelected: 2,
        allDishIds,
        dish: picked[0]
      }
    });
    assert.equal(d1RetryRes.statusCode, 200);
    const d1RetryBody = JSON.parse(d1RetryRes.payload);
    assert.equal(d1RetryBody.idempotentReplay, true);
    assert.equal(d1RetryBody.quotaCharged, false);

    // Resume and extract dish 2 of 2
    const d2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-dish',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        batchId,
        sourceUrl: discoverBody.sourceUrl,
        platform: 'instagram',
        groupLabel: discoverBody.groupLabel,
        totalDishes: discoverBody.dishes.length,
        totalSelected: 2,
        allDishIds,
        dish: picked[1]
      }
    });
    assert.equal(d2Res.statusCode, 200);
    const d2Body = JSON.parse(d2Res.payload);
    assert.equal(d2Body.persistedToCloud, true);
    assert.equal(d2Body.quotaCharged, false, 'Second dish must NOT charge extra quota');

    // Final job lookup shows completed with both recipes
    const finalJobRes = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/extraction-jobs/${batchId}`,
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(finalJobRes.statusCode, 200);
    const finalJob = JSON.parse(finalJobRes.payload);
    assert.equal(finalJob.status, 'completed');
    assert.equal(finalJob.recipes.length, 2);
    assert.equal(finalJob.pendingDishIds.length, 0);

    // Hard refresh / cloud pull check: both recipes exist in user's cloud book!
    const cloudPull = await SyncService.pullRecipes(authUser.userId);
    assert.equal(cloudPull.length, 2, 'Both carousel recipes must exist in cloud after hard refresh');
    const usage = await SyncService.checkUsageLimit(authUser.userId);
    assert.equal(usage.used, 1, 'Entire carousel batch + retry must cost EXACTLY 1 extraction');

    // 2. Guest isolation & recovery check
    const { token: guest1Token } = await AuthService.createGuestSession(`usr_guest_a_${Date.now()}`);
    const { token: guest2Token } = await AuthService.createGuestSession(`usr_guest_b_${Date.now()}`);
    const guestJobId = `xjob_guest_${Date.now()}`;
    const guestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-content',
      headers: { Authorization: `Bearer ${guest1Token}` },
      payload: { text: 'שקשוקה מהירה: 4 ביצים, 4 עגבניות, שום, שמן זית. מבשלים 15 דקות.', jobId: guestJobId }
    });
    assert.equal(guestRes.statusCode, 200);
    const guestBody = JSON.parse(guestRes.payload);
    assert.equal(guestBody.persistedToCloud, false, 'Guest extraction must NOT claim cloud persistence');
    assert.ok(guestBody.jobToken, 'Guest extraction must return signed jobToken');

    // Guest 2 MUST NOT access Guest 1's job
    const hijackRes = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/extraction-jobs/${guestJobId}`,
      headers: { Authorization: `Bearer ${guest2Token}` }
    });
    assert.equal(hijackRes.statusCode, 403, 'Another guest must be forbidden from reading Guest 1 job');

    // Guest 1 recovers cleanly with signed jobToken
    const recoverRes = await app.inject({
      method: 'GET',
      url: `/api/v1/recipes/extraction-jobs/${guestJobId}?token=${encodeURIComponent(guestBody.jobToken)}`
    });
    assert.equal(recoverRes.statusCode, 200);
    const recoverBody = JSON.parse(recoverRes.payload);
    assert.equal(recoverBody.status, 'completed');
    assert.equal(recoverBody.recipes.length, 1);

    // Unknown job returns 404 with status=not_found
    const missingJobRes = await app.inject({
      method: 'GET',
      url: '/api/v1/recipes/extraction-jobs/xjob_does_not_exist'
    });
    assert.equal(missingJobRes.statusCode, 404);
    assert.equal(JSON.parse(missingJobRes.payload).status, 'not_found');

    console.log(`[ASSERT]: FIX 1 (A, B, D) passed (${Date.now() - t0}ms)`);
  });

  // =========================================================================
  // FIX 1 (C) & Version v1.9.10 (Build 39): Background UI, recovery & version
  // =========================================================================
  test('FIX 1 (C) & Version: Background hint, persistent banner, completion banner, expired-job cleanup, no Notification.requestPermission, and v1.9.10 (Build 39)', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 1 (C) Client Background UI & Version Bump | ${new Date().toISOString()}`);

    assert.ok(appHtml.includes('אפשר לעבור דף או לצאת מהאפליקציה — החילוץ ממשיך ברקע'), 'Must show clear Hebrew background hint');
    assert.ok(appHtml.includes('id="bg-extract-banner"'), 'Must include persistent background extraction banner');
    assert.ok(appHtml.includes('id="bg-extract-ready-banner"'), 'Must include actionable completion banner');
    assert.ok(appHtml.includes('מחלץ מתכון ברקע'), 'Must display background indicator text');
    assert.ok(appHtml.includes('חילוץ כבר מתבצע ברקע'), 'Must block overlapping extractions with clear message');
    assert.ok(!appHtml.includes('Notification.requestPermission'), 'Must NEVER request notification permission');

    // Test expired job safe cleanup in VM
    const fns = [
      'const PENDING_EXTRACT_JOB_KEY = "my_recipes_pending_extract_job";',
      'let recoveryPollTimer = null;',
      extractFunctionSource(appHtml, 'function savePendingExtractJob('),
      extractFunctionSource(appHtml, 'function loadPendingExtractJob('),
      extractFunctionSource(appHtml, 'function clearPendingExtractJob(')
    ].join('\n\n');

    const map = new Map<string, string>();
    const ctx: any = {
      localStorage: {
        getItem: (k: string) => map.get(k) || null,
        setItem: (k: string, v: string) => map.set(k, v),
        removeItem: (k: string) => map.delete(k)
      },
      clearTimeout: () => {},
      Date,
      JSON
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    // Expired job clears cleanly without crashing
    map.set('my_recipes_pending_extract_job', JSON.stringify({ jobId: 'xjob_old', expiresAt: Date.now() - 1000 }));
    assert.equal(ctx.loadPendingExtractJob(), null, 'Expired job must return null');
    assert.equal(map.has('my_recipes_pending_extract_job'), false, 'Expired job must be cleared from localStorage');

    // Corrupt JSON clears cleanly without crashing
    map.set('my_recipes_pending_extract_job', '{bad json');
    assert.equal(ctx.loadPendingExtractJob(), null, 'Corrupt pending job must return null without crashing');
    assert.equal(map.has('my_recipes_pending_extract_job'), false);

    // Version v1.9.10 (Build 39) consistency
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    assert.ok(appHtml.includes('v1.9.10 (Build 39)'), 'public/app.html must display v1.9.10 (Build 39)');
    assert.ok(swJs.includes('v1.9.10 (Build 39)'), 'public/sw.js must use v1.9.10 (Build 39)');

    console.log(`[ASSERT]: FIX 1 (C) & v1.9.10 (Build 39) passed (${Date.now() - t0}ms)`);
  });
});
