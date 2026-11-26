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

describe('v2.2.0 (Build 48) Organic Non-Blocking Welcome Guide & Syntax Gate Suite', () => {
  let app: FastifyInstance;
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const guideJs = fs.readFileSync(GUIDE_JS_PATH, 'utf8');
  const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');
  const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Booting Fastify instance for v2.2.0 Welcome Guide tests');
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance');
    await app.close();
  });

  test('1. /welcome-guide.js serves cleanly, is lazy-loaded, tiny, and legacy cook-quest.js is removed', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Welcome Guide Bundle, Serving & Cook Quest Removal | ${new Date().toISOString()}`);

    assert.equal(fs.existsSync(OLD_QUEST_PATH), false, 'Legacy public/cook-quest.js must be removed');
    const oldRes = await app.inject({ method: 'GET', url: '/cook-quest.js' });
    assert.notEqual(oldRes.statusCode, 200, 'GET /cook-quest.js must no longer be served');

    const res = await app.inject({ method: 'GET', url: '/welcome-guide.js' });
    assert.equal(res.statusCode, 200, 'GET /welcome-guide.js must return 200');
    assert.ok(String(res.headers['content-type']).includes('javascript'));

    const gzipKb = zlib.gzipSync(Buffer.from(guideJs, 'utf8')).byteLength / 1024;
    console.log(`[ASSERT]: public/welcome-guide.js gzip size = ${gzipKb.toFixed(2)} KB`);
    assert.ok(gzipKb <= 15, `Welcome Guide lazy bundle must be lightweight (<= 15KB gzip), got ${gzipKb.toFixed(2)}KB`);

    assert.ok(appHtml.includes("import('/welcome-guide.js')"), 'app.html must dynamically import /welcome-guide.js');
    assert.ok(!guideJs.includes('fetch('), 'welcome-guide.js must make ZERO network calls');
    assert.ok(swJs.includes("url.pathname === '/welcome-guide.js'"), 'sw.js must serve /welcome-guide.js network-first');

    console.log(`[TEST END]: Bundle & Serving PASSED (${Date.now() - t0}ms)`);
  });

  test('2. Zero missions/XP/badges, organic non-blocking UI, 4 steps, Profile replay & live collection refresh', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Product Direction, Organic UI & Live Collection Refresh | ${new Date().toISOString()}`);

    // Zero mention of missions/XP/badges anywhere in the guide or user-facing app/admin
    for (const forbidden of ['משימה', 'משימת השף', 'XP', 'שף מתחיל', 'Chef Initiate', 'cook-quest.js', 'cq-blocker', 'confetti']) {
      assert.ok(!guideJs.includes(forbidden), `welcome-guide.js must NOT contain "${forbidden}"`);
    }
    assert.ok(!appHtml.includes('profile-chef-badge-chip'), 'Chef badge chip must be removed from Profile');
    assert.ok(!appHtml.includes('cook-quest.js'), 'app.html must not reference cook-quest.js');
    assert.ok(!adminHtml.includes('Cook Quest'), 'admin.html must not reference Cook Quest');

    // Non-blocking overlay & circular hint pointer-events: none
    assert.ok(guideJs.includes('.wg-root {') && guideJs.includes('pointer-events: none;'), 'Guide root must never block underlying app');
    assert.ok(guideJs.includes('.wg-hint-layer {') && guideJs.includes('.wg-hint-ring {'), 'Finish circular spotlight hint must exist');
    assert.ok(guideJs.includes('prefers-reduced-motion'), 'Must respect prefers-reduced-motion');

    // Organic shapes & 4 Hebrew RTL steps
    assert.ok(guideJs.includes('wg-blob-bg') && guideJs.includes('border-radius: 50%') && guideJs.includes('border-radius: 999px'), 'Guide must use organic blobs, circles, and pills');
    assert.ok(guideJs.includes('דלג') && guideJs.includes('הבא ←') && guideJs.includes('שמור לספר') && guideJs.includes('בוא נתחיל'), 'Must include all required Hebrew RTL controls');

    // Profile replay button & Admin reset
    assert.ok(appHtml.includes('הצג את המדריך שוב') && appHtml.includes('reopenWelcomeGuide()'), 'Profile must include "הצג את המדריך שוב" button');
    assert.ok(adminHtml.includes('admin-reset-guide-btn') && adminHtml.includes('resetWelcomeGuideForMe'), 'Admin must include Welcome Guide reset button');

    // Live update fix: saving a recipe immediately refreshes open group detail ("ללא קבוצה") & collections view
    assert.ok(
      appHtml.includes("if (typeof renderCollectionsView === 'function' && activeLibraryViewMode === 'collections')") &&
      appHtml.includes("if (typeof renderCollectionDetail === 'function' && activeOpenCollection)"),
      'saveRecipeToStorage must immediately refresh collections view and open group detail'
    );

    // Freeze-prevention SW controllerchange guard remains intact
    assert.ok(appHtml.includes('const hadController = Boolean(navigator.serviceWorker.controller);'));
    assert.ok(appHtml.includes('if (!hadController) return;'));
    assert.ok(appHtml.includes('sw_reloaded_for_'));

    // Version v2.2.0 (Build 48) across all web surfaces
    assert.ok(appHtml.includes('v2.2.0 (Build 48)'), 'public/app.html must display v2.2.0 (Build 48)');
    assert.ok(swJs.includes('v2.2.0 (Build 48)'), 'public/sw.js must use v2.2.0 (Build 48)');
    assert.ok(adminHtml.includes('v2.2.0 (Build 48)'), 'public/admin.html must display v2.2.0 (Build 48)');

    console.log(`[TEST END]: Product Direction & Live Refresh PASSED (${Date.now() - t0}ms)`);
  });

  test('3. One-time legacy migration marks existing users done and cleans up old storage keys', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Legacy Key Migration Verification | ${new Date().toISOString()}`);

    const modUrl = new URL('../../../../public/welcome-guide.js', import.meta.url).href;
    const { migrateLegacyGuideState, WELCOME_GUIDE_KEY, GUIDE_STEPS } = await import(modUrl);
    assert.equal(GUIDE_STEPS.length, 4, 'Welcome Guide must have 4 short steps');

    // Mock localStorage in Node to verify migration directly
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k)
    };

    // Case A: fresh user -> 'new'
    assert.equal(migrateLegacyGuideState(false), 'new');

    // Case B: existing user with legacy recipes_quest_v2 -> migrated to 'done' and legacy key removed
    store.set('recipes_quest_v2', JSON.stringify({ status: 'done', mission: 5, badge: true }));
    assert.equal(migrateLegacyGuideState(false), 'done');
    assert.equal(store.get(WELCOME_GUIDE_KEY), 'done');
    assert.equal(store.has('recipes_quest_v2'), false, 'Legacy recipes_quest_v2 must be cleaned up');

    // Case C: existing user with saved recipes -> migrated to 'done'
    store.clear();
    assert.equal(migrateLegacyGuideState(true), 'done');
    assert.equal(store.get(WELCOME_GUIDE_KEY), 'done');

    delete (globalThis as any).localStorage;
    console.log(`[TEST END]: Legacy Migration PASSED (${Date.now() - t0}ms)`);
  });

  test('4. Build-Time Syntax Gate passes on all built web JS and rejects broken snippets', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Build-Time Syntax Gate Verification | ${new Date().toISOString()}`);

    const gateScript = path.join(REPO_ROOT, 'scripts', 'check-web-syntax.js');
    const passOut = execFileSync(process.execPath, [gateScript], { encoding: 'utf8' });
    console.log(`[ASSERT]: SyntaxGate output:\n${passOut.trim()}`);
    assert.ok(passOut.includes('PASS: public') && passOut.includes('welcome-guide.js'), 'Syntax gate must pass welcome-guide.js');

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
