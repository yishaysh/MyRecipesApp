process.env.NODE_ENV = 'test';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import {
  DEFAULT_REFERRAL_DISCLOSURE_TEXT,
  GrowthStoreService,
  hashShareToken,
} from '../services/growth-store.service.js';
import { getJerusalemYearMonth, SyncService } from '../services/sync.service.js';
import { getJwtSecret } from '../services/guest-cookie.util.js';
import { EntitlementService } from '../services/entitlement.service.js';
import { buildIngredientBasket, normalizeIngredientForSearch } from '../shared/index.js';

function issueUserToken(userId: string, email: string, name: string): string {
  return jwt.sign(
    {
      userId,
      email,
      name,
      isPro: false,
      proTier: 'free',
    },
    getJwtSecret(),
    { expiresIn: '1d' }
  );
}

function logLifecycle(phase: string, detail: string): void {
  console.log(`[${phase}]: ${detail}`);
}

describe('Round 7 Growth Engine Verification Suite (Phase A & Phase B)', () => {
  let app: FastifyInstance;
  let origEnv: Record<string, string | undefined>;

  before(async () => {
    logLifecycle('TEST START', `Round 7 Growth Engine Suite | ${new Date().toISOString()}`);
    origEnv = {
      SHARING_ENABLED: process.env.SHARING_ENABLED,
      REFERRALS_ENABLED: process.env.REFERRALS_ENABLED,
      SHARE_MAX_BOOK_RECIPES: process.env.SHARE_MAX_BOOK_RECIPES,
      AFFILIATE_POSTBACK_SECRET: process.env.AFFILIATE_POSTBACK_SECRET,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      BILLING_TEST_MODE: process.env.BILLING_TEST_MODE,
    };

    process.env.SHARING_ENABLED = '1';
    process.env.REFERRALS_ENABLED = '1';
    process.env.SHARE_MAX_BOOK_RECIPES = '100';
    process.env.AFFILIATE_POSTBACK_SECRET = 'round7-test-hmac-secret-2026';
    process.env.ADMIN_PASSWORD = 'round7-test-admin-pass';
    process.env.BILLING_TEST_MODE = '1';

    app = buildApp();
    await app.ready();
    logLifecycle('SETUP / FIXTURE', 'Fastify app initialized with SHARING_ENABLED=1 and REFERRALS_ENABLED=1');
  });

  beforeEach(() => {
    GrowthStoreService.resetForTests();
    SyncService.inMemoryUserRecipes.clear();
    SyncService.inMemoryUsageCounts.clear();
    SyncService.inMemoryProUsers.clear();
    EntitlementService.resetMemoryForTests();
    process.env.SHARING_ENABLED = '1';
    process.env.REFERRALS_ENABLED = '1';
  });

  after(async () => {
    logLifecycle('CLEANUP / TEARDOWN', 'Restoring env vars and closing Fastify app');
    GrowthStoreService.resetForTests();
    SyncService.inMemoryUserRecipes.clear();
    SyncService.inMemoryUsageCounts.clear();
    SyncService.inMemoryProUsers.clear();
    EntitlementService.resetMemoryForTests();

    for (const [key, val] of Object.entries(origEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }

    await app.close();
    logLifecycle('TEST END', 'Round 7 Growth Engine Suite completed cleanly');
  });

  test('Phase A1-A3: Single & book snapshot shares, 192-bit token hashing, strict field whitelisting, opt-in OG tags, and 100-recipe cap', async () => {
    logLifecycle('TEST START', 'Phase A1-A3 Share creation, sanitization, OG consent, and snapshot immutability');
    const ownerToken = issueUserToken('usr_owner_1', 'owner@example.com', 'השף דני');
    const dirtyRecipe: any = {
      id: 'rec_dirty_1',
      title: 'עוגת גבינה קלאסית',
      description: 'עוגה נימוחה ואוורירית',
      category: 'קינוחים',
      difficulty: 'בינוני',
      prepTimeMinutes: 20,
      cookTimeMinutes: 45,
      servings: 8,
      sourceUrl: 'https://www.instagram.com/reel/PRIVATE_USER_REEL/',
      imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187',
      notes: 'הערה פרטית של הבעלים — אסור לדלוף!',
      cookCount: 9,
      lastCookedAt: '2026-10-01T12:00:00Z',
      savedFromShare: { shareId: 'old', snapshotVersion: 1 },
      internalUserId: 'secret_internal_uid',
      ingredients: [{ amount: 500, unit: 'גרם', name: 'גבינה לבנה טרייה' }],
      instructions: [{ stepNumber: 1, instruction: 'מערבבים הכל ואופים בחום בינוני' }],
      tags: ['#קינוח', '#חלבי'],
    };

    logLifecycle('ARRANGE', 'Creating single-recipe share with ogConsent=false and private owner fields');
    logLifecycle('ACT', 'POST /api/v1/shares');
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'recipe',
        recipes: [dirtyRecipe],
        rightsConfirmed: true,
        ogConsent: false,
        sharerDisplayName: 'דני השף',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const created = createRes.json();
    assert.ok(created.token && created.token.length >= 32, 'Token must encode at least 192 bits of entropy');

    const storedRecord = await GrowthStoreService.getShareById(created.shareId);
    assert.ok(storedRecord, 'Share record should exist');
    assert.equal(storedRecord.tokenHash, hashShareToken(created.token), 'Only SHA-256 tokenHash stored in store');
    assert.equal((storedRecord as any).token, undefined, 'Raw token must not be persisted on record');

    const pubRes = await app.inject({ method: 'GET', url: `/api/public/shares/${created.token}` });
    assert.equal(pubRes.statusCode, 200);
    assert.equal(pubRes.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(pubRes.headers['referrer-policy'], 'no-referrer');
    const pubJson = pubRes.json();
    const r0 = pubJson.recipes[0];
    assert.equal(r0.notes, undefined, 'Private owner notes must be stripped from snapshot');
    assert.equal(r0.cookCount, undefined, 'cookCount must be stripped from snapshot');
    assert.equal(r0.lastCookedAt, undefined, 'lastCookedAt must be stripped from snapshot');
    assert.equal(r0.savedFromShare, undefined, 'Nested share attribution must be stripped');
    assert.equal(r0.internalUserId, undefined, 'Arbitrary internal user fields must be stripped');
    assert.ok(String(r0.imageUrl).startsWith('/api/public/shares/'), 'Image URL must route through controlled token endpoint');

    logLifecycle('ACT', 'Checking GET /s/:token OG tags when ogConsent=false vs ogConsent=true');
    const htmlNoOg = await app.inject({ method: 'GET', url: `/s/${created.token}` });
    assert.equal(htmlNoOg.statusCode, 200);
    assert.match(htmlNoOg.body, /noindex,\s*nofollow/i);
    assert.match(htmlNoOg.body, /<meta property="og:title" content="מתכון משותף ב-ספר המתכונים שלי" \/>/);
    assert.match(htmlNoOg.body, /<meta property="og:image" content="[^"]*\/icon-512\.png" \/>/);
    assert.equal(htmlNoOg.body.includes(`<meta property="og:image" content="/api/public/shares/${created.token}/image`), false);

    const ogShareRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'recipe',
        recipes: [dirtyRecipe],
        rightsConfirmed: true,
        ogConsent: true,
      },
    });
    assert.equal(ogShareRes.statusCode, 201);
    const ogToken = ogShareRes.json().token;
    const htmlWithOg = await app.inject({ method: 'GET', url: `/s/${ogToken}` });
    assert.equal(htmlWithOg.statusCode, 200);
    assert.match(htmlWithOg.body, /<meta property="og:title" content="עוגת גבינה קלאסית" \/>/);
    assert.equal(htmlWithOg.body.includes(`/api/public/shares/${ogToken}/image`), true, 'og:image must use controlled recipe image URL when ogConsent=true');

    logLifecycle('ACT', 'Mutating original recipe object in memory & verifying frozen snapshot stability + version increment on update');
    dirtyRecipe.title = 'כותרת חדשה אחרי השיתוף';
    const frozenCheck = await app.inject({ method: 'GET', url: `/api/public/shares/${created.token}` });
    assert.equal(frozenCheck.json().recipes[0].title, 'עוגת גבינה קלאסית', 'Snapshot must stay frozen');

    const updateBookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'book',
        recipes: [{ id: 'b1', title: 'מתכון 1', ingredients: [], instructions: [] }],
        rightsConfirmed: true,
        bookTitle: 'ספר משפחתי',
      },
    });
    assert.equal(updateBookRes.statusCode, 201);
    const bookShareId = updateBookRes.json().shareId;

    const updateV2 = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'book',
        shareIdToUpdate: bookShareId,
        recipes: [
          { id: 'b1', title: 'מתכון 1', ingredients: [], instructions: [] },
          { id: 'b2', title: 'מתכון 2', ingredients: [], instructions: [] },
        ],
        rightsConfirmed: true,
      },
    });
    assert.equal(updateV2.statusCode, 200);
    assert.equal(updateV2.json().snapshotVersion, 2);
    assert.equal(updateV2.json().recipeCount, 2);

    const tooManyRecipes = Array.from({ length: 101 }, (_, idx) => ({
      id: `cap_${idx}`,
      title: `מתכון ${idx}`,
      ingredients: [],
      instructions: [],
    }));
    const limitRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'book',
        recipes: tooManyRecipes,
        rightsConfirmed: true,
      },
    });
    assert.equal(limitRes.statusCode, 400);
    assert.equal(limitRes.json().error, 'BOOK_LIMIT_EXCEEDED');

    logLifecycle('ASSERT', 'Phase A1-A3 assertions passed');
    logLifecycle('TEST END', 'Phase A1-A3 completed');
  });

  test('Phase A4: Immediate revocation (410 Gone) & recipe deletion auto-revokes single shares but preserves book shares', async () => {
    logLifecycle('TEST START', 'Phase A4 Revocation and Deletion Cascade Policy');
    const ownerId = 'usr_owner_del';
    const ownerToken = issueUserToken(ownerId, 'del@example.com', 'בעלים');

    const singleShareRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'recipe',
        recipes: [{ id: 'rec_del_1', title: 'פסטה למחיקה', ingredients: [], instructions: [] }],
        rightsConfirmed: true,
      },
    });
    const singleToken = singleShareRes.json().token;

    const bookShareRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'book',
        recipes: [
          { id: 'rec_del_1', title: 'פסטה למחיקה', ingredients: [], instructions: [] },
          { id: 'rec_keep_2', title: 'סלט ירקות', ingredients: [], instructions: [] },
        ],
        rightsConfirmed: true,
      },
    });
    const bookToken = bookShareRes.json().token;

    await SyncService.pushRecipes(ownerId, [{ id: 'rec_del_1', title: 'פסטה למחיקה', ingredients: [], instructions: [] }]);

    logLifecycle('ACT', 'Deleting recipe rec_del_1 via DELETE /api/v1/sync/recipes/rec_del_1');
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/sync/recipes/rec_del_1',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.statusCode, 200);
    assert.equal(delRes.json().deleted, true);
    assert.equal(delRes.json().revokedShares, 1);

    const revokedPublic = await app.inject({ method: 'GET', url: `/api/public/shares/${singleToken}` });
    assert.equal(revokedPublic.statusCode, 410, 'Single-recipe share must return 410 after owner deletes recipe');
    const revokedHtml = await app.inject({ method: 'GET', url: `/s/${singleToken}` });
    assert.equal(revokedHtml.statusCode, 410);
    const revokedImage = await app.inject({ method: 'GET', url: `/api/public/shares/${singleToken}/image` });
    assert.equal(revokedImage.statusCode, 410);

    const activeBook = await app.inject({ method: 'GET', url: `/api/public/shares/${bookToken}` });
    assert.equal(activeBook.statusCode, 200, 'Book snapshot share must stay active when one recipe is deleted');

    const explicitRevoke = await app.inject({
      method: 'POST',
      url: `/api/v1/shares/${bookShareRes.json().shareId}/revoke`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(explicitRevoke.statusCode, 200);
    assert.equal(explicitRevoke.json().status, 'revoked');
    const afterExplicit = await app.inject({ method: 'GET', url: `/s/${bookToken}` });
    assert.equal(afterExplicit.statusCode, 410);

    logLifecycle('ASSERT', 'Revocation and deletion policies verified');
    logLifecycle('TEST END', 'Phase A4 completed');
  });

  test('Phase A5: Save-to-my-book funnel, zero quota impact, idempotency, dedupe vs forceDuplicate, partial retry, and revoked mid-flow', async () => {
    logLifecycle('TEST START', 'Phase A5 Save Funnel, Quota Exemption, and Partial Retry');
    const ownerToken = issueUserToken('usr_sharer_5', 'sharer@example.com', 'שלי המשתפת');
    const saverId = 'usr_saver_5';
    const saverToken = issueUserToken(saverId, 'saver@example.com', 'רועי השומר');

    const shareRes = await app.inject({
      method: 'POST',
      url: '/api/v1/shares',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        type: 'book',
        recipes: [
          { id: 's1', title: 'מרק עדשים', ingredients: [{ amount: 250, unit: 'גרם', name: 'עדשים כתומות' }], instructions: ['מבשלים 30 דקות'] },
          { id: 's2', title: 'חלה לשבת', ingredients: [{ amount: 1, unit: 'ק"ג', name: 'קמח' }], instructions: ['לשים ואופים'] },
        ],
        rightsConfirmed: true,
        sharerDisplayName: 'שלי',
      },
    });
    const { shareId, token: shareToken } = shareRes.json();

    const usageBefore = await SyncService.checkUsageLimit(saverId);
    assert.equal(usageBefore.remaining, 5);

    logLifecycle('ACT', 'Saving 2-recipe book with simulated failure on s2');
    const partialRes = await app.inject({
      method: 'POST',
      url: `/api/v1/shares/${shareToken}/save`,
      headers: { Authorization: `Bearer ${saverToken}`, 'Idempotency-Key': 'save-key-1' },
      payload: { simulateFailIds: ['s2'] },
    });
    assert.equal(partialRes.statusCode, 200);
    const partialJson = partialRes.json();
    assert.equal(partialJson.savedCount, 1);
    assert.equal(partialJson.failedCount, 1);

    const savedRecipesAfter1 = await SyncService.pullRecipes(saverId);
    assert.equal(savedRecipesAfter1.length, 1);
    assert.equal(savedRecipesAfter1[0].savedFromShare?.shareId, shareId);
    assert.equal(savedRecipesAfter1[0].savedFromShare?.sharerDisplayName, 'שלי');

    logLifecycle('ACT', 'Retrying only failed recipe s2');
    const retryRes = await app.inject({
      method: 'POST',
      url: `/api/v1/shares/${shareToken}/save`,
      headers: { Authorization: `Bearer ${saverToken}`, 'Idempotency-Key': 'save-key-2' },
      payload: { recipeIds: ['s2'] },
    });
    assert.equal(retryRes.statusCode, 200);
    assert.equal(retryRes.json().savedCount, 1);
    assert.equal(retryRes.json().failedCount, 0);

    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/shares/${shareToken}/save`,
      headers: { Authorization: `Bearer ${saverToken}`, 'Idempotency-Key': 'save-key-3' },
      payload: { recipeIds: ['s1'] },
    });
    assert.equal(dupRes.statusCode, 200);
    assert.equal(dupRes.json().alreadySaved, true);
    assert.equal(dupRes.json().savedCount, 0);

    const forceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/shares/${shareToken}/save`,
      headers: { Authorization: `Bearer ${saverToken}`, 'Idempotency-Key': 'save-key-4' },
      payload: { recipeIds: ['s1'], forceDuplicate: true },
    });
    assert.equal(forceRes.statusCode, 200);
    assert.equal(forceRes.json().savedCount, 1);

    const savedTotal = await SyncService.pullRecipes(saverId);
    assert.equal(savedTotal.length, 3, 'forceDuplicate should append independent copy even with matching source');

    const usageAfter = await SyncService.checkUsageLimit(saverId);
    assert.equal(usageAfter.remaining, 5, 'Saving shared recipes MUST NOT consume extraction quota');
    assert.equal(usageAfter.used, 0);

    await GrowthStoreService.revokeShare(shareId);
    const revokedSaveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/shares/${shareToken}/save`,
      headers: { Authorization: `Bearer ${saverToken}` },
      payload: { recipeIds: ['s2'], forceDuplicate: true },
    });
    assert.equal(revokedSaveRes.statusCode, 410, 'Revoked share mid-signup must reject save with 410');

    logLifecycle('ASSERT', 'Save funnel, zero quota impact, partial retry, and mid-flow revocation verified');
    logLifecycle('TEST END', 'Phase A5 completed');
  });

  test('Phase A6-A7: Bot UA analytics filtering, takedown admin resolution, and Asia/Jerusalem quota month boundary', async () => {
    logLifecycle('TEST START', 'Phase A6-A7 Bot filtering, takedown reporting, and Jerusalem timezone quota key');
    const ownerToken = issueUserToken('usr_owner_6', 'o6@example.com', 'בעלים 6');
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/shares',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          type: 'recipe',
          recipes: [{ id: 'r6', title: 'שקשוקה', ingredients: [], instructions: [] }],
          rightsConfirmed: true,
        },
      })
    ).json();

    await app.inject({
      method: 'GET',
      url: `/s/${created.token}`,
      headers: { 'user-agent': 'WhatsApp/2.23.20 A' },
    });
    await app.inject({
      method: 'GET',
      url: `/api/public/shares/${created.token}`,
      headers: { 'user-agent': 'facebookexternalhit/1.1' },
    });

    const eventsAfterBots = await GrowthStoreService.listAnalyticsEvents();
    const botViews = eventsAfterBots.filter((e) => e.eventName === 'share_view');
    assert.equal(botViews.length, 0, 'Preview bots must NOT inflate share_view analytics');

    await app.inject({
      method: 'GET',
      url: `/s/${created.token}`,
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1' },
    });
    const eventsAfterHuman = await GrowthStoreService.listAnalyticsEvents();
    assert.equal(eventsAfterHuman.filter((e) => e.eventName === 'share_view').length, 1);

    const reportRes = await app.inject({
      method: 'POST',
      url: `/api/public/shares/${created.token}/report`,
      payload: { reason: 'copyright', details: 'תלונת זכויות יוצרים לבדיקה' },
    });
    assert.equal(reportRes.statusCode, 201);
    const reportId = reportRes.json().reportId;

    const adminLogin = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/admin/login',
        payload: { password: process.env.ADMIN_PASSWORD },
      })
    ).json();
    assert.ok(adminLogin.token);

    const overviewBefore = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/admin/growth-overview',
        headers: { Authorization: `Bearer ${adminLogin.token}` },
      })
    ).json();
    assert.equal(overviewBefore.funnel.purchases, 'לא זמין');
    assert.equal(overviewBefore.funnel.revenue, 'לא זמין');
    assert.equal(overviewBefore.reports.length, 1);

    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/share-reports/${reportId}/resolve`,
      headers: { Authorization: `Bearer ${adminLogin.token}` },
      payload: { action: 'revoke' },
    });
    assert.equal(resolveRes.statusCode, 200);
    const afterTakedown = await app.inject({ method: 'GET', url: `/s/${created.token}` });
    assert.equal(afterTakedown.statusCode, 410, 'Admin takedown revoke must immediately disable share link');

    // Asia/Jerusalem is UTC+3 during IDT (March 31 2026 after 21:00 UTC is already April 1 00:30 in Jerusalem)
    const beforeMidnightIdt = new Date('2026-03-31T20:30:00Z');
    const afterMidnightIdt = new Date('2026-03-31T21:30:00Z');
    assert.equal(getJerusalemYearMonth(beforeMidnightIdt), '2026-03');
    assert.equal(getJerusalemYearMonth(afterMidnightIdt), '2026-04');

    logLifecycle('ASSERT', 'Bot filter, takedown resolution, KPI labels, and Asia/Jerusalem month rollover passed');
    logLifecycle('TEST END', 'Phase A6-A7 completed');
  });

  test('Phase B1: Ingredient search normalization and unit-matched safe basket aggregation', async () => {
    logLifecycle('TEST START', 'Phase B1 Normalization and Safe Basket Unit Aggregation');
    assert.equal(normalizeIngredientForSearch('עגבניות שרי טריות קצוצות דק (או רגילות)'), 'עגבניות שרי');
    assert.equal(normalizeIngredientForSearch('גבינת פרמזן מגורדת לפי הטעם'), 'גבינת פרמזן');

    const basket = buildIngredientBasket(
      [
        {
          ingredients: [
            { amount: 200, unit: 'גרם', name: 'קמח לבן' },
            { amount: 300, unit: 'ג׳', name: 'קמח לבן' },
            { amount: 100, unit: 'גרם', name: 'חמאה' },
            { amount: 2, unit: 'כפות', name: 'חמאה מומסת' },
            { qtyMode: 'to_taste', name: 'מלח ים גס לפי הטעם' },
          ],
        },
      ],
      2
    );

    const flourItems = basket.filter((i) => i.searchQuery === 'קמח לבן');
    assert.equal(flourItems.length, 1, 'Matching weight units (גרם / ג׳) MUST merge cleanly');
    assert.equal(flourItems[0].quantityParts.length, 1);
    assert.equal(flourItems[0].quantityParts[0].amount, 1000, 'Merged 200+300 grams scaled by 2 = 1000 grams');

    const butterItems = basket.filter((i) => i.searchQuery === 'חמאה');
    assert.equal(butterItems.length, 1);
    assert.equal(butterItems[0].quantityParts.length, 2, 'Incompatible units (גרם vs כפות) MUST stay separate and NEVER guess density');

    logLifecycle('ASSERT', 'Ingredient basket normalization and safe unit matching verified');
    logLifecycle('TEST END', 'Phase B1 completed');
  });

  test('Phase B2-B5: Merchant gates (disabled default, 3-Hebrew SampleCheck, commercial gate), allowlisted redirects, Referrer-Policy, kill switch, analytics resilience, and HMAC postback 501 stub', async () => {
    logLifecycle('TEST START', 'Phase B2-B5 Merchant Registry, Gates, Redirect Safety, Kill Switch, and Postback Stub');
    const adminToken = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/admin/login',
        payload: { password: process.env.ADMIN_PASSWORD },
      })
    ).json().token;

    const initialMerchants = (await app.inject({ method: 'GET', url: '/api/public/merchants' })).json();
    assert.equal(initialMerchants.defaultDisclosureText, DEFAULT_REFERRAL_DISCLOSURE_TEXT);
    assert.equal(initialMerchants.merchants.length, 4);
    assert.ok(initialMerchants.merchants.every((m: any) => m.status === 'disabled' && !m.selectable));

    const prematureEnable = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/merchants/shufersal',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { status: 'referral_only' },
    });
    assert.equal(prematureEnable.statusCode, 400, 'Cannot enable referral_only without 3-ingredient SampleLinkCheck');

    const twoIngredientsCheck = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/merchants/shufersal/sample-check',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { testedQueries: ['עגבניות', 'שמן זית'] },
    });
    assert.equal(twoIngredientsCheck.statusCode, 400, 'SampleLinkCheck requires >= 3 Hebrew ingredients');

    const threeIngredientsCheck = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/merchants/shufersal/sample-check',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { testedQueries: ['עגבניות', 'שמן זית', 'קמח'] },
    });
    assert.equal(threeIngredientsCheck.statusCode, 200);

    const enableRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/merchants/shufersal',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { status: 'referral_only' },
    });
    assert.equal(enableRes.statusCode, 200);
    assert.equal(enableRes.json().merchant.status, 'referral_only');

    const blockedAffiliate = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/merchants/shufersal',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { status: 'affiliate_active', commercialAgreement: { partnerName: 'Shufersal' } },
    });
    assert.equal(blockedAffiliate.statusCode, 400, 'affiliate_active requires complete commercial agreement');

    const skuMappingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/ingredient-mappings',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        normalizedName: 'שמן זית',
        merchantId: 'shufersal',
        sku: 'SKU-OLIVE-729',
        productName: 'שמן זית כתית מעולה 750 מ"ל',
        productUrl: 'https://www.shufersal.co.il/online/he/A/SKU-OLIVE-729',
      },
    });
    assert.equal(skuMappingRes.statusCode, 200);

    const linkDenied = await app.inject({
      method: 'POST',
      url: '/api/affiliate-links',
      payload: { merchantId: 'rami_levy', query: 'עגבניות' },
    });
    assert.equal(linkDenied.statusCode, 403, 'Disabled merchant link generation must be rejected');

    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/affiliate-links',
      payload: { merchantId: 'shufersal', query: 'עגבניות שרי טריות קצוצות' },
    });
    assert.equal(linkRes.statusCode, 201);
    const linkJson = linkRes.json();
    assert.equal(linkJson.normalizedQuery, 'עגבניות שרי');
    assert.equal(linkJson.disclosureMode, 'referral_only');
    assert.equal(linkJson.disclosureText, DEFAULT_REFERRAL_DISCLOSURE_TEXT);

    logLifecycle('ACT', 'Following /api/go/:clickToken and verifying 302 + Referrer-Policy: no-referrer');
    const goRes = await app.inject({
      method: 'GET',
      url: linkJson.redirectUrl,
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/126.0' },
    });
    assert.equal(goRes.statusCode, 302);
    assert.equal(goRes.headers['referrer-policy'], 'no-referrer');
    assert.ok(String(goRes.headers.location).startsWith('https://www.shufersal.co.il/online/he/search?'));

    // Analytics DB outage resilience test
    GrowthStoreService.setForceAnalyticsFailureForTests(true);
    const goDuringAnalyticsOutage = await app.inject({
      method: 'GET',
      url: linkJson.redirectUrl,
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/126.0' },
    });
    assert.equal(goDuringAnalyticsOutage.statusCode, 302, 'Analytics failure MUST never block user navigation to store');
    GrowthStoreService.setForceAnalyticsFailureForTests(false);

    // Global kill switch check
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/referrals/kill-switch',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { disabled: true },
    });
    const blockedAfterKill = await app.inject({ method: 'GET', url: linkJson.redirectUrl });
    assert.equal(blockedAfterKill.statusCode, 403, 'Kill switch must block redirects immediately');

    // Restore kill switch
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/referrals/kill-switch',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { disabled: false },
    });

    // HMAC postback stub check
    const postbackPayload = { partner: 'shufersal', order_id: 'ORD-1001', status: 'completed' };
    const badSigRes = await app.inject({
      method: 'POST',
      url: '/api/affiliate/postback',
      headers: { 'x-affiliate-signature': 'deadbeef' },
      payload: postbackPayload,
    });
    assert.equal(badSigRes.statusCode, 401);

    const validSig = crypto
      .createHmac('sha256', String(process.env.AFFILIATE_POSTBACK_SECRET))
      .update(JSON.stringify(postbackPayload))
      .digest('hex');
    const stubRes = await app.inject({
      method: 'POST',
      url: '/api/affiliate/postback',
      headers: { 'x-affiliate-signature': validSig },
      payload: postbackPayload,
    });
    assert.equal(stubRes.statusCode, 501);
    assert.equal(stubRes.json().status, 'not_configured');

    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/affiliate/postback',
      headers: { 'x-affiliate-signature': validSig },
      payload: postbackPayload,
    });
    assert.equal(replayRes.statusCode, 409);
    assert.equal(replayRes.json().error, 'DUPLICATE_POSTBACK');

    logLifecycle('ASSERT', 'All Phase B merchant, redirect, kill-switch, and postback assertions passed');
    logLifecycle('TEST END', 'Phase B2-B5 completed');
  });
});
