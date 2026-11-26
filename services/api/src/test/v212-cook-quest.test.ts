process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const QUEST_JS_PATH = path.join(REPO_ROOT, 'public', 'cook-quest.js');
const ADMIN_HTML_PATH = path.join(REPO_ROOT, 'public', 'admin.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');

describe('v2.1.2 (Build 42) Cinematic Cook Quest Verification Suite', () => {
  let app: FastifyInstance;
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const questJs = fs.readFileSync(QUEST_JS_PATH, 'utf8');
  const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Booting Fastify instance for v2.1.2 Cook Quest tests');
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance');
    await app.close();
  });

  test('1. /cook-quest.js serves cleanly, is lazy-loaded (<= 40KB gzip), and contains zero network calls in Demo Extraction', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Cook Quest Bundle Size, Serving & Lazy Loader | ${new Date().toISOString()}`);

    const res = await app.inject({ method: 'GET', url: '/cook-quest.js' });
    assert.equal(res.statusCode, 200, 'GET /cook-quest.js must return 200');
    assert.ok(String(res.headers['content-type']).includes('javascript'));

    const gzipped = zlib.gzipSync(Buffer.from(questJs, 'utf8'));
    const gzipKb = gzipped.byteLength / 1024;
    console.log(`[ASSERT]: public/cook-quest.js gzip size = ${gzipKb.toFixed(2)} KB (budget <= 40 KB)`);
    assert.ok(gzipKb <= 40, `Cook Quest lazy bundle must be <= 40KB gzip, got ${gzipKb.toFixed(2)}KB`);

    // Must be dynamically imported only when needed; zero fetch() inside cook-quest.js (demo is 100% client-side)
    assert.ok(appHtml.includes("import('/cook-quest.js')"), 'app.html must dynamically import /cook-quest.js');
    assert.ok(!questJs.includes('fetch('), 'cook-quest.js must make ZERO network fetch calls (Demo Extraction is pure client-side)');

    console.log(`[TEST END]: Bundle & Lazy Loader PASSED (${Date.now() - t0}ms)`);
  });

  test('2. All 3 Acts, 5 Missions, centralized he/en strings, reduced-motion, lite mode, error boundary, badge & admin reset exist', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Cook Quest 3 Acts, 5 Missions, Accessibility & Persistence | ${new Date().toISOString()}`);

    // Centralized strings (he + en)
    assert.ok(questJs.includes('export const QUEST_STRINGS = {') && questJs.includes('he: {') && questJs.includes('en: {'));
    assert.ok(questJs.includes('סרטון בטיקטוק.') && questJs.includes('מתכון מלא.') && questJs.includes('בלי לעצור, בלי לרשום.'));
    assert.ok(questJs.includes('בוא נתחיל') && questJs.includes('דלג'));

    // 5 missions
    for (const m of ['פתח קבוצה', 'פתח מתכון', 'מצב מטבח', 'חלץ מתכון מסרטון', 'קנה את המצרכים']) {
      assert.ok(questJs.includes(m), `Must include mission "${m}"`);
    }

    // Demo extraction + Finale badge + reduced-motion + lite mode + error boundary
    assert.ok(questJs.includes('הדגמה'), 'Demo extraction must be clearly labeled הדגמה');
    assert.ok(questJs.includes('שף מתחיל') && questJs.includes('Chef Initiate'), 'Finale must display Chef Initiate badge');
    assert.ok(questJs.includes('prefers-reduced-motion'), 'Must respect prefers-reduced-motion');
    assert.ok(questJs.includes('hardwareConcurrency') && questJs.includes('deviceMemory'), 'Must detect low-end devices for lite mode');
    assert.ok(questJs.includes('safeRun('), 'Must wrap guide in failure-safe error boundary');
    assert.ok(questJs.includes('recipes_quest_v2'), 'Must persist state under recipes_quest_v2');
    assert.ok(questJs.includes('quest_started') && questJs.includes('mission_completed') && questJs.includes('quest_skipped') && questJs.includes('quest_finished'));

    // Profile badge chip, 5-tap logo easter egg, and Admin reset button
    assert.ok(appHtml.includes('id="profile-chef-badge-chip"'), 'Profile must display earned badge chip');
    assert.ok(appHtml.includes('handleLogoTapEasterEgg'), 'Logo must support 5-tap cinematic intro replay easter egg');
    assert.ok(adminHtml.includes('admin-reset-quest-btn') && adminHtml.includes('resetCookQuestForMe'), 'Admin must include local Reset quest button');

    // Version v2.1.2 (Build 42) across all web surfaces
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    assert.ok(appHtml.includes('v2.1.2 (Build 42)'), 'public/app.html must display v2.1.2 (Build 42)');
    assert.ok(swJs.includes('v2.1.2 (Build 42)'), 'public/sw.js must use v2.1.2 (Build 42)');
    assert.ok(adminHtml.includes('v2.1.2 (Build 42)'), 'public/admin.html must display v2.1.2 (Build 42)');

    console.log(`[TEST END]: All Cook Quest checks PASSED (${Date.now() - t0}ms)`);
  });
});
