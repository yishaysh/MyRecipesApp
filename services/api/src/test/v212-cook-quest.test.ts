process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const GUIDE_JS_PATH = path.join(REPO_ROOT, 'public', 'welcome-guide.js');
const OLD_QUEST_PATH = path.join(REPO_ROOT, 'public', 'cook-quest.js');
const ADMIN_HTML_PATH = path.join(REPO_ROOT, 'public', 'admin.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');

describe('v2.3.0 (Build 49) Frameless Frosted Circular-Spotlight Live Tour & Syntax Gate Suite', () => {
  let app: FastifyInstance;
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const guideJs = fs.readFileSync(GUIDE_JS_PATH, 'utf8');
  const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');
  const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Booting Fastify instance for v2.3.0 Live Tour tests');
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance');
    await app.close();
  });

  test('1. /welcome-guide.js serves cleanly, is lazy-loaded, tiny, and legacy cook-quest.js is removed', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Live Tour Bundle, Serving & Cook Quest Removal | ${new Date().toISOString()}`);

    assert.equal(fs.existsSync(OLD_QUEST_PATH), false, 'Legacy public/cook-quest.js must be removed');
    const oldRes = await app.inject({ method: 'GET', url: '/cook-quest.js' });
    assert.notEqual(oldRes.statusCode, 200, 'GET /cook-quest.js must no longer be served');

    const res = await app.inject({ method: 'GET', url: '/welcome-guide.js' });
    assert.equal(res.statusCode, 200, 'GET /welcome-guide.js must return 200');
    assert.ok(String(res.headers['content-type']).includes('javascript'));

    const gzipKb = zlib.gzipSync(Buffer.from(guideJs, 'utf8')).byteLength / 1024;
    console.log(`[ASSERT]: public/welcome-guide.js gzip size = ${gzipKb.toFixed(2)} KB`);
    assert.ok(gzipKb <= 15, `Live Tour lazy bundle must be lightweight (<= 15KB gzip), got ${gzipKb.toFixed(2)}KB`);

    assert.ok(appHtml.includes("import('/welcome-guide.js')"), 'app.html must dynamically import /welcome-guide.js');
    assert.ok(!guideJs.includes('fetch('), 'welcome-guide.js must make ZERO network calls');
    assert.ok(swJs.includes("url.pathname === '/welcome-guide.js'"), 'sw.js must serve /welcome-guide.js network-first');

    console.log(`[TEST END]: Bundle & Serving PASSED (${Date.now() - t0}ms)`);
  });

  test('2. Frameless frosted circular spotlight, zero box cards, 5 real UI stops, non-blocking, zero Cook Quest remnants', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Frameless Frosted Live Tour & Accessibility Checks | ${new Date().toISOString()}`);

    // Zero mention of missions/XP/badges/box cards anywhere
    for (const forbidden of ['משימה', 'משימת השף', 'XP', 'שף מתחיל', 'Chef Initiate', 'cook-quest.js', 'cq-blocker', 'confetti', 'wg-card']) {
      assert.ok(!guideJs.includes(forbidden), `welcome-guide.js must NOT contain "${forbidden}"`);
    }
    assert.ok(!appHtml.includes('profile-chef-badge-chip'), 'Chef badge chip must be removed from Profile');
    assert.ok(!appHtml.includes('cook-quest.js'), 'app.html must not reference cook-quest.js');
    assert.ok(!adminHtml.includes('Cook Quest'), 'admin.html must not reference Cook Quest');

    // Frosted backdrop (light 18% tint, 3px blur) + feathered circular radial-gradient spotlight + pointer-events: none
    assert.ok(guideJs.includes('backdrop-filter: blur(3px);') && guideJs.includes('rgba(6, 16, 14, 0.18)'), 'Must use light translucent frosted backdrop');
    assert.ok(guideJs.includes('radial-gradient(circle at'), 'Must use feathered circular spotlight mask');
    assert.ok(guideJs.includes('.wt-backdrop {') && guideJs.includes('pointer-events: none;'), 'Backdrop & spotlight must never block taps');
    assert.ok(guideJs.includes('applyExtractDemoStage') && guideJs.includes('restoreExtractSnapshot'), 'Tour must walk through real Extract tab using harmless local demo state and restore state on exit');
    assert.ok(guideJs.includes('ResizeObserver') && guideJs.includes('orientationchange'), 'Tour must re-measure on resize/rotation/scroll');
    assert.ok(guideJs.includes('prefers-reduced-motion'), 'Must respect prefers-reduced-motion');
    assert.ok(guideJs.includes('ברוך הבא') && guideJs.includes('בוא נתחיל') && guideJs.includes('דלג'), 'Must include opening screen & always-available Skip');

    // Part B regression guards (B1-B11)
    assert.ok(appHtml.includes("'[EXTRACT_ERROR] status='"), 'B1: EXTRACT_ERROR must log readable status/message/stack, not Object');
    assert.ok(appHtml.includes("showToast('נא להדביק טקסט של מתכון'"), 'B3: empty text mode must show text-specific message');
    assert.ok(appHtml.includes("if (bgHint) bgHint.style.display = 'none';"), 'B4: must hide bg hint on extraction error');
    assert.ok(appHtml.includes('formatRecipeCountHe(') && appHtml.includes("'1 מתכון'"), 'B6: Hebrew grammar 1 מתכון vs N מתכונים');
    assert.ok(appHtml.includes('let bookmarkSyncTimer = null;'), 'B7: debounced/serialized bookmark toggle');
    assert.ok(appHtml.includes('[style*="growthSpin"] { animation: none !important; }'), 'B8: growthSpin respects prefers-reduced-motion');
    assert.ok(appHtml.includes('🛒 הוסף מצרכים לרשימת הקניות'), 'B9: one-tap shopping list toast action after save');
    assert.ok(appHtml.includes('renameUserCollection(') && appHtml.includes('↩️ בטל מחיקה'), 'B10: group rename and undo delete toast');
    assert.ok(appHtml.includes('<bdi dir="ltr">'), 'B11: discovery handle isolated with dir="ltr"');

    // All 5 real UI target IDs exist in app.html
    for (const id of ['tab-btn-extract', 'tab-btn-library', 'tab-btn-discover', 'tab-btn-shopping', 'tab-btn-profile']) {
      assert.ok(appHtml.includes(`id="${id}"`), `public/app.html must define #${id} for live tour spotlight`);
    }

    // Profile replay button, Admin reset, live collection refresh, and SW freeze guard
    assert.ok(appHtml.includes('הצג את המדריך שוב') && appHtml.includes('reopenWelcomeGuide()'));
    assert.ok(adminHtml.includes('admin-reset-guide-btn') && adminHtml.includes('resetWelcomeGuideForMe'));
    assert.ok(appHtml.includes("if (typeof renderCollectionDetail === 'function' && activeOpenCollection)"));
    assert.ok(appHtml.includes('const hadController = Boolean(navigator.serviceWorker.controller);'));

    // v2.3.2 Parts A, B, C regression guards:
    assert.ok(appHtml.includes('DEFAULT_STARTER_GROUPS') && appHtml.includes('אשתי היקרה') && appHtml.includes('בריאות במקסימום'), 'Part A: starter groups must include owner example');
    assert.ok(appHtml.includes('STARTER_GROUPS_TOMBSTONE_KEY') && appHtml.includes('seedDefaultStarterGroupsIfNeeded'), 'Part A: idempotent seeding + delete tombstone must exist');
    assert.ok(appHtml.includes('initLibraryViewModeSynchronously();') && appHtml.includes("(userCollections || []).length > 2 ? 'collections' : 'grid'"), 'Part B: synchronous initial view mode (>2 groups -> collections) before first paint');
    assert.ok(appHtml.includes('id="rename-ucol-name"') && appHtml.includes('id="rename-ucol-sub"') && !appHtml.includes("window.prompt('שם חדש לקבוצה:'"), 'Part C: inline rename modal replaces native window.prompt');

    // v2.3.4 Vertical 2-column RTL groups grid + fanned recipe thumbnail collage regression guards:
    assert.ok(appHtml.includes('.collections-grid {') && appHtml.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'v2.3.4: groups view must use 2-column vertical RTL grid');
    assert.ok(appHtml.includes('const cards = [uncategorizedCard, ...curatedCols, ...personalCols];'), 'v2.3.4: "ללא קבוצה" must be first card in grid');
    assert.ok(appHtml.includes('collectionCollageCache') && appHtml.includes('buildCollectionCollageHtml(') && appHtml.includes('loading="lazy"'), 'v2.3.4: memoized lazy-loaded fanned recipe thumbnail collage must exist');
    assert.ok(appHtml.includes('.collection-card-scrim'), 'v2.3.4: dark gradient scrim must protect text readability over collage');

    // v2.3.5 (Build 54) Fixes 1-3 regression guards:
    assert.ok(appHtml.includes('collectionsDataHydrated') && appHtml.includes('collection-card-count-loading') && appHtml.includes('is-hydrating'), 'v2.3.5 Fix 1: explicit hydration gate & placeholder pill must prevent false 0-count flash');
    assert.ok(appHtml.includes('parseBuildNumber(') && appHtml.includes('isNewerBuildAvailable(') && appHtml.includes('evaluateCandidateWorkerUpdate(') && swJs.includes("event.data.type === 'GET_VERSION'"), 'v2.3.5 Fix 2: numeric build comparison and SW GET_VERSION check must prevent false update banner');
    assert.ok(appHtml.includes('aspect-ratio: 4 / 3;') && appHtml.includes('max-width: 700px;') && appHtml.includes('id="rename-ucol-name"') && appHtml.includes('border:1px solid var(--border); padding:10px 12px;'), 'v2.3.5 Fix 3: 4:3 group cards, desktop 2-row fit, and bordered rename inputs');

    // Version v2.3.5 (Build 54) across all web surfaces
    assert.ok(appHtml.includes('v2.3.5 (Build 54)'), 'public/app.html must display v2.3.5 (Build 54)');
    assert.ok(swJs.includes('v2.3.5 (Build 54)'), 'public/sw.js must use v2.3.5 (Build 54)');
    assert.ok(adminHtml.includes('v2.3.5 (Build 54)'), 'public/admin.html must display v2.3.5 (Build 54)');

    console.log(`[TEST END]: Frameless Live Tour Checks PASSED (${Date.now() - t0}ms)`);
  });

  test('3. 5 stops, caption viewport clamping at 390px & 1280px, and legacy migration', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Tour Stops, Clamping & Legacy Migration | ${new Date().toISOString()}`);

    const modUrl = new URL('../../../../public/welcome-guide.js', import.meta.url).href;
    const { TOUR_STOPS, computeTourCaptionPos, migrateLegacyGuideState, WELCOME_GUIDE_KEY } = await import(modUrl);
    assert.equal(TOUR_STOPS.length, 7, 'Live tour must have 7 stops (4 extract walkthrough stages + discover, shopping, profile)');

    // Verify caption clamping keeps text inside viewport & above target on 390px mobile and 1280px desktop
    const mPos = computeTourCaptionPos({ cx: 360, cy: 810, r: 44 }, { width: 390, height: 844 }, { width: 312, height: 140 });
    assert.ok(mPos.left >= 16 && mPos.left + 312 <= 390 - 16, `390px caption overflow: left=${mPos.left}`);
    assert.ok(mPos.top >= 20 && mPos.top + 140 < 810 - 44, `390px caption covers target: top=${mPos.top}`);

    const dPos = computeTourCaptionPos({ cx: 640, cy: 690, r: 46 }, { width: 1280, height: 720 }, { width: 312, height: 140 });
    assert.ok(dPos.left >= 16 && dPos.left + 312 <= 1280 - 16, `1280px caption overflow: left=${dPos.left}`);
    assert.ok(dPos.top >= 20 && dPos.top + 140 < 690 - 46, `1280px caption covers target: top=${dPos.top}`);

    // Legacy migration
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k)
    };
    assert.equal(migrateLegacyGuideState(false), 'new');
    store.set('recipes_quest_v2', '{"status":"done"}');
    assert.equal(migrateLegacyGuideState(false), 'done');
    assert.equal(store.get(WELCOME_GUIDE_KEY), 'done');
    assert.equal(store.has('recipes_quest_v2'), false);
    delete (globalThis as any).localStorage;

    console.log(`[TEST END]: Stops, Clamping & Migration PASSED (${Date.now() - t0}ms)`);
  });

  test('4. Build-Time Syntax Gate passes on all built web JS and rejects broken snippets', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Build-Time Syntax Gate Verification | ${new Date().toISOString()}`);

    const gateScript = path.join(REPO_ROOT, 'scripts', 'check-web-syntax.js');
    const passOut = execFileSync(process.execPath, [gateScript], { encoding: 'utf8' });
    console.log(`[ASSERT]: SyntaxGate output:\n${passOut.trim()}`);
    assert.ok(passOut.includes('PASS: public') && passOut.includes('welcome-guide.js'));

    const brokenHtmlPath = path.join(os.tmpdir(), `broken-inline-script-${Date.now()}.html`);
    fs.writeFileSync(brokenHtmlPath, '<!doctype html><html><body><script>function broken() { if (true) { } }); </script></body></html>', 'utf8');
    let failedAsExpected = false;
    try {
      execFileSync(process.execPath, [gateScript, brokenHtmlPath], { stdio: 'pipe' });
    } catch (err: any) {
      failedAsExpected = true;
      const errText = (err?.stderr ? err.stderr.toString('utf8') : '') + String(err?.message || '');
      assert.ok(errText.includes('SyntaxError') || errText.includes('Syntax check FAILED'));
    } finally {
      if (fs.existsSync(brokenHtmlPath)) fs.unlinkSync(brokenHtmlPath);
    }
    assert.ok(failedAsExpected, 'Syntax gate MUST fail on broken inline JS');

    console.log(`[TEST END]: Syntax Gate PASSED (${Date.now() - t0}ms)`);
  });
});
