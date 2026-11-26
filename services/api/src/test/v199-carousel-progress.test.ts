process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../services/auth.service.js';
import { ExtractorService } from '../services/extractor.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { SyncService } from '../services/sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');
const MANIFEST_PATH = path.join(REPO_ROOT, 'public', 'manifest.webmanifest');
const ROOT_PKG_PATH = path.join(REPO_ROOT, 'package.json');
const AUTH_SERVICE_PATH = path.join(REPO_ROOT, 'services', 'api', 'src', 'services', 'auth.service.ts');

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

describe('v1.9.9 (Build 38) Carousel Multi-Recipe, Progress Bar & APK Cleanup Suite', () => {
  let app: FastifyInstance;
  const storage = RecipeStorageService.getInstance();
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Starting Fastify test server for v1.9.9 suite');
    storage.clear();
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify test server');
    storage.clear();
    await app.close();
  });

  test('FIX 0: APK leftovers removed, web OAuth preserved, PWA share-target intact, and version v1.9.9 (Build 38) synced', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 0 APK Cleanup & PWA Share-Target Verification | ${new Date().toISOString()}`);

    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'apps', 'mobile', 'eas.json')), false, 'eas.json must be removed');
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'apps', 'mobile', 'android')), false, 'apps/mobile/android must be removed');
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'apps', 'mobile', 'release.jks')), false, 'release.jks must be removed');
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'apps', 'mobile', 'credentials.json')), false, 'credentials.json must be removed');

    const rootPkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8'));
    assert.ok(!rootPkg.scripts.build.includes('--workspace=@myrecipes/mobile'), 'Root build script must be web-only');

    const authSrc = fs.readFileSync(AUTH_SERVICE_PATH, 'utf8');
    assert.ok(!authSrc.includes('GOOGLE_ANDROID_CLIENT_ID'), 'Android OAuth client ID must be removed from auth.service.ts');
    assert.ok(authSrc.includes('1096327742778-q792b51k802ocfbs4f9pcn28bigb63ol.apps.googleusercontent.com'), 'Web OAuth client ID must remain intact');

    // PWA manifest share_target, sw.js, and profile card intact
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    assert.equal(manifest.share_target?.action, '/app/share-target', 'PWA share_target must remain intact');
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    assert.ok(swJs.includes("url.pathname === '/app/share-target'"), 'sw.js must preserve share-target network handling');
    assert.ok(appHtml.includes('התקנה ושיתוף מהיר'), 'Profile PWA install & share card must remain intact');

    // Version consistency across app.json, app.html, and sw.js
    const appJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps', 'mobile', 'app.json'), 'utf8'));
    const expectedLabel = `v${appJson.expo.version} (Build ${appJson.expo.android.versionCode})`;
    assert.ok(appHtml.includes(expectedLabel), `public/app.html must display ${expectedLabel}`);
    assert.ok(swJs.includes(expectedLabel), `public/sw.js must use ${expectedLabel}`);

    console.log(`[ASSERT]: FIX 0 passed (${Date.now() - t0}ms)`);
  });

  test('FIX 1: Carousel shortcode matching and Hebrew/English list-post detection', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 1 Carousel & List-Post Detection | ${new Date().toISOString()}`);

    const extractor = new ExtractorService();
    const heHint = ExtractorService.detectListPostHint('מאסאדו עסיסי בתנור ועד אסאדו מפורק בלחמנייה - 12 דרכים טעימות ומגוונות להכין אסאדו');
    assert.equal(heHint.isListPost, true);
    assert.equal(heHint.dishCountHint, 12);

    const enHint = ExtractorService.detectListPostHint('12 ways to make asado at home');
    assert.equal(enHint.isListPost, true);
    assert.equal(enHint.dishCountHint, 12);

    const singleHint = ExtractorService.detectListPostHint('מתכון קצר לפסטה עגבניות מהירה ב-15 דקות');
    assert.equal(singleHint.isListPost, false);

    // Shortcode scoping: must select slides for TargetSC and ignore unrelated OtherSC
    const fakeHtml = `
      <script type="application/json">${JSON.stringify({
        otherPost: { shortcode: 'OtherSC', carousel_media: [{ display_url: 'https://cdn.example.com/wrong1.jpg' }] },
        targetPost: {
          shortcode: 'TargetSC',
          edge_sidecar_to_children: {
            edges: [
              { node: { display_url: 'https://cdn.example.com/s1.jpg', is_video: false } },
              { node: { display_url: 'https://cdn.example.com/s2.jpg', video_url: 'https://cdn.example.com/s2.mp4', is_video: true } }
            ]
          }
        }
      })}</script>
    `;
    const slides = extractor.extractInstagramCarouselSlides(fakeHtml, 'TargetSC');
    assert.equal(slides.length, 2);
    assert.equal(slides[0].imageUrl, 'https://cdn.example.com/s1.jpg');
    assert.equal(slides[1].isVideo, true);
    assert.equal(slides[1].videoUrl, 'https://cdn.example.com/s2.mp4');

    console.log(`[ASSERT]: FIX 1 passed (${Date.now() - t0}ms)`);
  });

  test('FIX 2, 3 & 5: Extracting 12-slide carousel returns 12-dish picker, saves 12 separate grouped recipes, and charges ONLY 1 quota unit', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 2/3/5 End-to-End 12-Slide Carousel Extraction & Quota | ${new Date().toISOString()}`);

    const { token, user } = await AuthService.createGuestSession(`usr_guest_v199_${Date.now()}`);
    const beforeUsage = await SyncService.checkUsageLimit(user.userId);
    assert.equal(beforeUsage.used, 0);

    // Step 1: Discovery via POST /api/v1/recipes/extract
    const carouselUrl = 'https://www.instagram.com/p/DgHsPriCFhg/';
    const discoverRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { Authorization: `Bearer ${token}` },
      payload: { url: carouselUrl }
    });
    assert.equal(discoverRes.statusCode, 200, `Expected 200, got ${discoverRes.statusCode}: ${discoverRes.payload}`);
    const discoverBody = JSON.parse(discoverRes.payload);
    assert.equal(discoverBody.success, true);
    assert.equal(discoverBody.multiDish, true, 'Must enter multiDish picker mode');
    assert.equal(discoverBody.quotaCost, 1);
    assert.ok(discoverBody.batchId, 'Must return a batchId for 1-quota enforcement');
    assert.equal(discoverBody.dishes.length, 12, 'Must discover all 12 dishes');

    // Quota must NOT be charged yet until user extracts from picker
    const afterDiscoverUsage = await SyncService.checkUsageLimit(user.userId);
    assert.equal(afterDiscoverUsage.used, 0, 'Discovery alone must not charge quota');

    // Step 2: Extract all 12 dishes via POST /api/v1/recipes/extract-dish
    const extractedRecipes: any[] = [];
    for (let i = 0; i < discoverBody.dishes.length; i++) {
      const dish = discoverBody.dishes[i];
      const dishRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract-dish',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          batchId: discoverBody.batchId,
          sourceUrl: discoverBody.sourceUrl,
          platform: discoverBody.platform,
          groupLabel: discoverBody.groupLabel,
          captionText: discoverBody.captionText,
          totalDishes: discoverBody.dishes.length,
          dish
        }
      });
      assert.equal(dishRes.statusCode, 200, `Dish ${i + 1} extraction failed: ${dishRes.payload}`);
      const dishBody = JSON.parse(dishRes.payload);
      assert.equal(dishBody.success, true);
      assert.equal(dishBody.quotaCharged, i === 0, `Only the first dish in batch may charge quota (idx=${i})`);
      extractedRecipes.push(dishBody.recipe);
    }

    assert.equal(extractedRecipes.length, 12);
    const uniqueIds = new Set(extractedRecipes.map((r) => r.id));
    const uniqueTitles = new Set(extractedRecipes.map((r) => r.title));
    assert.equal(uniqueIds.size, 12, 'All 12 recipes must have distinct IDs');
    assert.equal(uniqueTitles.size, 12, 'All 12 recipes must have distinct dish titles');
    for (let i = 0; i < 12; i++) {
      assert.equal(extractedRecipes[i].slideIndex, i + 1);
      assert.equal(extractedRecipes[i].carouselTotal, 12);
      assert.ok(extractedRecipes[i].carouselGroupLabel, 'Must preserve carousel group label');
      assert.equal(extractedRecipes[i].sourceUrl, discoverBody.sourceUrl, 'All recipes share sourceUrl');
    }

    const finalUsage = await SyncService.checkUsageLimit(user.userId);
    assert.equal(finalUsage.used, 1, 'All 12 dishes from one carousel must count as EXACTLY ONE quota extraction');

    console.log(`[ASSERT]: FIX 2/3/5 passed: 12 separate grouped recipes, quota used=${finalUsage.used} (${Date.now() - t0}ms)`);
  });

  test('FIX 4 & 5: Progress bar fills to 100% only on completion, stops on error, and web dedup keeps all 12 carousel slides separate', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: FIX 4 Progress Bar & FIX 5 Frontend Grouping/Dedup | ${new Date().toISOString()}`);

    const fns = [
      'let extractionProgressTimer = null;',
      'let extractionProgressPct = 0;',
      extractFunctionSource(appHtml, 'function updateExtractionProgress('),
      extractFunctionSource(appHtml, 'function clearExtractionProgressTimer('),
      extractFunctionSource(appHtml, 'function startExtractionProgress('),
      extractFunctionSource(appHtml, 'async function completeExtractionProgress('),
      extractFunctionSource(appHtml, 'function stopExtractionProgressOnError('),
      extractFunctionSource(appHtml, 'function normalizeUrlForCompare('),
      extractFunctionSource(appHtml, 'function normalizeTitleForCompare('),
      extractFunctionSource(appHtml, 'function areRecipesDuplicateWeb(')
    ].join('\n\n');

    const fillEl = { style: { width: '0%' }, classes: new Set<string>(), classList: { add(c: string) { fillEl.classes.add(c); }, remove(c: string) { fillEl.classes.delete(c); } } };
    const trackEl = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { trackEl.attrs[k] = v; } };
    const pctEl = { textContent: '0%' };
    const titleEl = { textContent: '' };
    const detailEl = { textContent: '' };
    let intervalFn: (() => void) | null = null;
    let intervalCleared = false;

    const ctx: any = {
      document: {
        getElementById: (id: string) => {
          if (id === 'extract-progress-fill') return fillEl;
          if (id === 'extract-progress-track') return trackEl;
          if (id === 'progress-pct') return pctEl;
          if (id === 'progress-title') return titleEl;
          if (id === 'progress-detail') return detailEl;
          return null;
        }
      },
      setStep: () => {},
      setInterval: (fn: () => void) => { intervalFn = fn; intervalCleared = false; return 123; },
      clearInterval: () => { intervalCleared = true; intervalFn = null; },
      setTimeout: (fn: () => void) => { fn(); return 1; },
      Promise,
      Math,
      Number,
      String,
      URL
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    // 1. Progress bar starts and ticks up, capping at 90% until completion
    ctx.startExtractionProgress('url');
    assert.equal(pctEl.textContent, '8%');
    for (let i = 0; i < 40; i++) {
      if (intervalFn) intervalFn();
    }
    assert.equal(fillEl.style.width, '90%', 'In-flight progress bar must cap at 90% and never fake-complete');
    assert.equal(pctEl.textContent, '90%');

    // 2. On error, bar stops and adds is-error class (never 100%)
    ctx.stopExtractionProgressOnError();
    assert.equal(intervalCleared, true);
    assert.equal(fillEl.classes.has('is-error'), true, 'Error must mark progress bar with is-error');
    assert.notEqual(pctEl.textContent, '100%', 'Error must never show 100%');

    // 3. On completion, bar reaches exactly 100% and clears error class
    await ctx.completeExtractionProgress('✨ המתכון מוכן!', 'הושלם בהצלחה');
    assert.equal(fillEl.style.width, '100%');
    assert.equal(pctEl.textContent, '100%');
    assert.equal(trackEl.attrs['aria-valuenow'], '100');
    assert.equal(fillEl.classes.has('is-error'), false);

    // 4. Carousel dedup guard keeps distinct slides from same URL separate
    const slide1 = { id: 'rec_1', title: 'אסאדו בתנור', sourceUrl: 'https://www.instagram.com/p/DgHsPriCFhg/', slideIndex: 1 };
    const slide2 = { id: 'rec_2', title: 'אסאדו בתנור ביין', sourceUrl: 'https://www.instagram.com/p/DgHsPriCFhg/', slideIndex: 2 };
    assert.equal(ctx.areRecipesDuplicateWeb(slide1, slide2), false, 'Distinct slideIndex recipes from same carousel must never be treated as duplicates');

    // 5. Picker UI copy checks in app.html
    assert.ok(appHtml.includes('חילוץ אחד מהמכסה'), 'Picker must state single quota cost');
    assert.ok(appHtml.includes('חלץ את כולם'), 'Picker must include extract-all button');
    assert.ok(appHtml.includes('חלץ נבחרים'), 'Picker must include extract-selected button');
    assert.ok(appHtml.includes('מחלץ מתכון '), 'Carousel extraction must show per-recipe progress');

    console.log(`[ASSERT]: FIX 4 & FIX 5 passed (${Date.now() - t0}ms)`);
  });
});
