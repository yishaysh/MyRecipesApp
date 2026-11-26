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

    // Version v2.1.3 (Build 43) across all web surfaces
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    assert.ok(appHtml.includes('v2.1.3 (Build 43)'), 'public/app.html must display v2.1.3 (Build 43)');
    assert.ok(swJs.includes('v2.1.3 (Build 43)'), 'public/sw.js must use v2.1.3 (Build 43)');
    assert.ok(adminHtml.includes('v2.1.3 (Build 43)'), 'public/admin.html must display v2.1.3 (Build 43)');

    console.log(`[TEST END]: All Cook Quest checks PASSED (${Date.now() - t0}ms)`);
  });

  test('3. v2.1.3 Fixes 1-5: Mission 1 target + capture click, RTL mobile/desktop clamping, finale 0-collections hide, and close/backdrop/Esc', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: v2.1.3 Cook Quest 5 QA Fixes Verification | ${new Date().toISOString()}`);

    const modUrl = new URL('../../../../public/cook-quest.js', import.meta.url).href;
    const { computeCoachCardPosition, formatFinaleMeta, QUEST_STRINGS } = await import(modUrl);

    // Fix 1: Mission 1 strictly targets .collection-card (never #view-btn-collections), capture-phase click + double-fire guard
    assert.ok(questJs.includes("if (missionId === 'open_collection') return ['.collection-card'];"), 'Mission 1 must strictly target .collection-card');
    assert.ok(!questJs.includes("'.collection-card, #view-btn-collections'"), 'Mission 1 must NOT include #view-btn-collections in selector');
    assert.ok(questJs.includes("addEventListener('click', onMission1TargetClick, true)"), 'Mission 1 must attach capture-phase click listener on target card');
    assert.ok(questJs.includes('if (this.missionCompleting) return;'), 'completeCurrentMission must guard against double-fire');
    assert.ok(questJs.includes('scrollIntoView'), 'Spotlight must scroll target card into view');

    // Fix 2 & 3: RTL anchor fix (.cq-coach-wrap top:0 left:0) + viewport clamping across 320..1920px
    assert.ok(questJs.includes('.cq-coach-wrap { position: fixed; top: 0; left: 0; right: auto; bottom: auto;'), '.cq-coach-wrap must anchor left:0 top:0 so RTL does not push it off-screen');
    assert.ok(questJs.includes('orientationchange'), 'Coach card must re-clamp on orientationchange');

    const testCases = [
      { label: 'Mobile 320px', vw: 320, vh: 568, target: { x: 10, y: 120, w: 300, h: 110 } },
      { label: 'Mobile 360px', vw: 360, vh: 740, target: { x: 16, y: 150, w: 328, h: 120 } },
      { label: 'Mobile 390px (edge right target)', vw: 390, vh: 844, target: { x: 240, y: 180, w: 140, h: 120 } },
      { label: 'Mobile 414px (edge left target)', vw: 414, vh: 896, target: { x: 8, y: 180, w: 150, h: 120 } },
      { label: 'Desktop 1280x720', vw: 1280, vh: 720, target: { x: 880, y: 180, w: 300, h: 160 } },
      { label: 'Desktop 1920x1080', vw: 1920, vh: 1080, target: { x: 1400, y: 220, w: 320, h: 160 } },
      { label: 'Desktop 1280x720 missing target fallback', vw: 1280, vh: 720, target: null }
    ];
    for (const tc of testCases) {
      const cardW = Math.min(340, tc.vw - 24);
      const pos = computeCoachCardPosition(tc.target, { width: tc.vw, height: tc.vh }, { width: cardW, height: 180 });
      console.log(`[ASSERT]: ${tc.label} -> left=${pos.left}, top=${pos.top}, width=${pos.width}, rightEdge=${pos.left + pos.width}/${tc.vw} (${pos.placement})`);
      assert.ok(pos.left >= 12, `${tc.label}: left (${pos.left}) must be >= 12`);
      assert.ok(pos.left + pos.width <= tc.vw - 12, `${tc.label}: right edge (${pos.left + pos.width}) must be <= ${tc.vw - 12}`);
      assert.ok(pos.top >= 60, `${tc.label}: top (${pos.top}) must be >= 60`);
      assert.ok(pos.top + 180 <= tc.vh - 12, `${tc.label}: bottom (${pos.top + 180}) must be <= ${tc.vh - 12}`);
    }

    // Fix 4: Finish dialog hides collections count when 0 (no "0 קבוצות זמינות", no stray bullet)
    const meta0 = formatFinaleMeta('26.11.2026', 0, QUEST_STRINGS.he);
    const meta1 = formatFinaleMeta('26.11.2026', 1, QUEST_STRINGS.he);
    const meta11 = formatFinaleMeta('26.11.2026', 11, QUEST_STRINGS.he);
    console.log(`[ASSERT]: Finale meta -> 0: "${meta0}" | 1: "${meta1}" | 11: "${meta11}"`);
    assert.equal(meta0, '📅 26.11.2026', 'When colsCount === 0, must show date only with no separator or 0 collections');
    assert.ok(!meta0.includes('•') && !meta0.includes('קבוצות'), 'Zero collections must not leave bullet or placeholder');
    assert.equal(meta1, '📅 26.11.2026 • 🗂️ קבוצה אחת זמינה');
    assert.equal(meta11, '📅 26.11.2026 • 🗂️ 11 קבוצות זמינות');

    // Fix 5: Finale close button, backdrop tap, Escape key, focus restore, and confetti cleanup
    assert.ok(questJs.includes("closeBtn.addEventListener('click'"), 'Finale close button must bind click listener');
    assert.ok(questJs.includes('if (e.target === finale) closeFinale()'), 'Finale must close on backdrop tap');
    assert.ok(questJs.includes("if (e.key === 'Escape') closeFinale()"), 'Finale must close on Escape');
    assert.ok(questJs.includes('this.previouslyFocusedEl.focus()'), 'destroyDom must restore focus');
    assert.ok(questJs.includes('this.cleanupFns.push(() => canvas.remove())'), 'Confetti canvas must be cleaned up on early close');

    console.log(`[TEST END]: v2.1.3 Cook Quest 5 QA Fixes PASSED (${Date.now() - t0}ms)`);
  });
});
