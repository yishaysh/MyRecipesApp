process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../services/auth.service.js';
import { CuratedCollectionsService, SEEDED_CURATED_COLLECTIONS } from '../services/curated-collections.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');
const ADMIN_HTML_PATH = path.join(REPO_ROOT, 'public', 'admin.html');

function createAdminJwt(): string {
  const secret = process.env.JWT_SECRET || 'my-recipes-admin-secret-2026';
  return jwt.sign({ role: 'superadmin' }, secret, { expiresIn: '1h' });
}

describe('v2.1.0 (Build 40) Curated Recipes, Collections, Smart Suggestion & Interactive Tour Suite', () => {
  let app: FastifyInstance;
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const adminToken = createAdminJwt();

  before(async () => {
    console.log('[SETUP / FIXTURE] Booting Fastify instance for v2.1.0 suite');
    CuratedCollectionsService.resetForTests();
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance');
    CuratedCollectionsService.resetForTests();
    await app.close();
  });

  test('PART 1 & 2: Seeded 11 curated collections exist unpublished by default, admin can publish/edit/reorder/promote/bulk-import, and public SEO pages render OG meta with subtitles', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: PART 1 & 2 Curated Recipes & Collections Admin + Public SEO | ${new Date().toISOString()}`);

    // 1. Public showcase starts empty-state-safe (0 published curated collections & recipes)
    const initialPubRes = await app.inject({ method: 'GET', url: '/api/v1/showcase' });
    assert.equal(initialPubRes.statusCode, 200);
    const initialPub = JSON.parse(initialPubRes.payload);
    assert.equal(initialPub.curatedRecipes.length, 0);
    assert.equal(initialPub.collections.length, 0);

    // 2. Admin sees all 11 seeded curated collections with exact Hebrew names & subtitles, unpublished
    const adminColsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/curated/collections',
      headers: { 'x-admin-token': adminToken }
    });
    assert.equal(adminColsRes.statusCode, 200);
    const adminCols = JSON.parse(adminColsRes.payload).collections;
    assert.equal(adminCols.length, 11, 'Must seed all 11 curated collections');
    assert.ok(adminCols.every((c: any) => c.published === false), 'All seeded collections must start unpublished');
    const wifeCol = adminCols.find((c: any) => c.name === 'אשתי היקרה');
    assert.ok(wifeCol && wifeCol.subtitle === 'בריאות במקסימום', 'Seeded collection must carry exact subtitle');
    const shabbatCol = adminCols.find((c: any) => c.name === 'כמה טוב שהגיע שבת');
    assert.ok(shabbatCol && shabbatCol.subtitle === 'שולחן שבת שאי אפשר לפספס');

    // 3. Unauthorized write must be rejected
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/curated/collections/publish-all'
    });
    assert.equal(unauthRes.statusCode, 401);

    // 4. One-click "Publish all" publishes all 11 collections
    const pubAllRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/curated/collections/publish-all',
      headers: { 'x-admin-token': adminToken }
    });
    assert.equal(pubAllRes.statusCode, 200);
    assert.equal(JSON.parse(pubAllRes.payload).publishedCount, 11);

    // 5. Promote a recipe to curated + assign to wifeCol
    const sampleRecipe = {
      title: 'סלט קינואה וירקות קלויים',
      description: 'סלט בריא וצבעוני',
      platform: 'web',
      sourceUrl: '',
      totalTimeMinutes: 20,
      servings: 4,
      ingredients: [{ name: 'קינואה', amount: 200, unit: 'גרם', originalText: '200 גרם קינואה' }],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים את הקינואה 15 דקות.' }],
      tags: ['בריא', 'סלט']
    };
    const promoteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/curated/recipes/promote',
      headers: { 'x-admin-token': adminToken },
      payload: { recipe: sampleRecipe, collectionIds: [wifeCol.id], published: true }
    });
    assert.equal(promoteRes.statusCode, 201);
    const promoted = JSON.parse(promoteRes.payload).recipe;
    assert.equal(promoted.published, true);
    assert.deepEqual(promoted.collectionIds, [wifeCol.id]);

    // 6. Bulk JSON import with dryRun preview & error reporting
    const bulkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/curated/recipes/bulk-import',
      headers: { 'x-admin-token': adminToken },
      payload: {
        dryRun: true,
        items: [
          sampleRecipe,
          { title: '', ingredients: [], instructions: [] }
        ]
      }
    });
    assert.equal(bulkRes.statusCode, 200);
    const bulkBody = JSON.parse(bulkRes.payload);
    assert.equal(bulkBody.validCount, 1);
    assert.equal(bulkBody.errorCount, 1);

    // 7. Public showcase now immediately reflects published collections & curated recipe without redeploy
    const livePubRes = await app.inject({ method: 'GET', url: '/api/v1/showcase' });
    const livePub = JSON.parse(livePubRes.payload);
    assert.equal(livePub.curatedRecipes.length, 1);
    assert.equal(livePub.collections.length, 11);

    // 8. Public SEO pages /r/:slug and /c/:slug render OG meta including collection subtitle (logged out)
    const rPageRes = await app.inject({ method: 'GET', url: `/r/${encodeURIComponent(promoted.slug)}` });
    assert.equal(rPageRes.statusCode, 200);
    assert.ok(rPageRes.payload.includes('og:title') && rPageRes.payload.includes('סלט קינואה וירקות קלויים'));

    const cPageRes = await app.inject({ method: 'GET', url: `/c/${encodeURIComponent(wifeCol.slug)}` });
    assert.equal(cPageRes.statusCode, 200);
    assert.ok(cPageRes.payload.includes('og:description') && cPageRes.payload.includes('בריאות במקסימום'));

    // 9. Deleting a collection NEVER deletes curated recipes
    const delColRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/curated/collections/${wifeCol.id}`,
      headers: { 'x-admin-token': adminToken }
    });
    assert.equal(delColRes.statusCode, 200);
    const afterDelRecipes = await CuratedCollectionsService.listCuratedRecipes({ publishedOnly: true });
    assert.equal(afterDelRecipes.length, 1, 'Deleting a collection must NEVER delete recipes');

    console.log(`[ASSERT]: PART 1 & 2 passed (${Date.now() - t0}ms)`);
  });

  test('PART 2 & 3: Personal user collections, cloud preferences, and smart collection suggestions', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: PART 2 & 3 Personal Collections & Smart Suggestions | ${new Date().toISOString()}`);

    const { token } = await AuthService.authenticateWithGoogle({
      sub: `google_v210_${Date.now()}`,
      email: 'v210.user@example.com',
      name: 'V210 User'
    });

    // Create personal collection with subtitle
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/user/collections',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'ארוחות שישי', subtitle: 'חגיגי למשפחה', icon: '🕯️', recipeIds: ['rec_1'] }
    });
    assert.equal(createRes.statusCode, 201);
    const col = JSON.parse(createRes.payload).collection;
    assert.equal(col.scope, 'user');
    assert.equal(col.subtitle, 'חגיגי למשפחה');

    // Update user preferences (viewMode + onboardingCompleted)
    const prefRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/user/preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { viewMode: 'collections', onboardingCompleted: true, onboardingStep: 8 }
    });
    assert.equal(prefRes.statusCode, 200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/user/collections',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.equal(listBody.collections.length, 1);
    assert.equal(listBody.preferences.viewMode, 'collections');
    assert.equal(listBody.preferences.onboardingCompleted, true);

    // Smart collection suggestion picks ONLY from existing collection names
    const parser = new LlmParserService();
    const suggested = parser.suggestCollectionsFromRecipe(
      { title: 'אסאדו על האש בגריל', description: 'בשר מעושן', tags: ['על האש', 'בשר'], totalTimeMinutes: 180, category: 'בשרים' },
      SEEDED_CURATED_COLLECTIONS
    );
    assert.ok(suggested.includes('האש בוערת'), 'Smart suggestion should match "האש בוערת"');
    assert.ok(suggested.every((name) => SEEDED_CURATED_COLLECTIONS.some((c) => c.name === name)), 'Must never invent new collection names');

    console.log(`[ASSERT]: PART 2 & 3 passed (${Date.now() - t0}ms)`);
  });

  test('PART 4 & Version v2.1.0 (Build 40): Onboarding tour UI, replay button, analytics events, and version sync', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: PART 4 Onboarding Tour & Version v2.1.0 (Build 40) | ${new Date().toISOString()}`);

    assert.ok(appHtml.includes('id="library-view-toggle"'), 'Must include List/Collections view toggle');
    assert.ok(appHtml.includes('id="owner-showcase-section"'), 'Must include curated showcase section');
    assert.ok(appHtml.includes('id="collections-view-container"'), 'Must include collections view container');
    assert.ok(appHtml.includes('לאיזו קבוצה המתכון שייך?'), 'Must include Part 3 post-extraction collection prompt');
    assert.ok(appHtml.includes('id="onboarding-tour-overlay"'), 'Must include spotlight onboarding tour overlay');
    assert.ok(appHtml.includes('id="replay-onboarding-tour-btn"') && appHtml.includes('מדריך אינטראקטיבי'), 'Must include tour replay entry in settings');
    assert.ok(appHtml.includes('נסה עם קישור לדוגמה'), 'Must include sample link button in tour');
    assert.ok(appHtml.includes('isSharedOrAdminEntry'), 'Must avoid auto-starting tour on shared links or admin');

    // Version v2.1.0 (Build 40) across app.html, sw.js, and admin.html
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');
    assert.ok(appHtml.includes('v2.1.0 (Build 40)'), 'public/app.html must display v2.1.0 (Build 40)');
    assert.ok(swJs.includes('v2.1.0 (Build 40)'), 'public/sw.js must use v2.1.0 (Build 40)');
    assert.ok(adminHtml.includes('v2.1.0 (Build 40)'), 'public/admin.html must display v2.1.0 (Build 40)');

    console.log(`[ASSERT]: PART 4 & v2.1.0 (Build 40) passed (${Date.now() - t0}ms)`);
  });
});
