process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { SyncService } from '../services/sync.service.js';

describe('Commercial SaaS & Auth Routes Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;

  before(async () => {
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('Test 1: POST /api/v1/auth/google creates session and returns Freemium usage status', async () => {
    const mockUser = {
      sub: 'google_user_998877',
      email: 'chef@example.com',
      name: 'ישראל שף',
      picture: 'https://example.com/avatar.png',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      payload: { mockUser },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.token, 'Should return JWT token');
    assert.strictEqual(body.user.email, 'chef@example.com');
    assert.strictEqual(body.user.isPro, false);
    assert.strictEqual(body.usage.remaining, 5);
    assert.strictEqual(body.usage.totalLimit, 5);

    authToken = body.token;
    testUserId = body.user.userId;
  });

  test('Test 2: GET /api/v1/auth/me returns authenticated user session with Bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.user.userId, testUserId);
    assert.strictEqual(body.user.email, 'chef@example.com');
    assert.ok(body.usage);
  });

  test('Test 3: POST /api/v1/sync/push and /pull handle batch recipe cloud synchronization', async () => {
    const sampleRecipes = [
      {
        id: 'rcp_test_sync_1',
        title: 'פוקאצ׳ה איטלקית ביתית',
        platform: 'instagram',
        category: 'איטלקי',
        ingredients: [{ id: 'ing_1', name: 'קמח שמרים', amount: 500, unit: 'גרם', category: 'bakery' }],
        instructions: [{ stepNumber: 1, instruction: 'ללוש היטב 10 דקות' }],
        tags: ['איטלקי', 'מאפים'],
        isBookmarked: true,
      },
    ];

    const pushRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/push',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: { recipes: sampleRecipes },
    });

    assert.strictEqual(pushRes.statusCode, 200);
    const pushBody = JSON.parse(pushRes.body);
    assert.strictEqual(pushBody.success, true);

    const pullRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/pull',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    assert.strictEqual(pullRes.statusCode, 200);
    const pullBody = JSON.parse(pullRes.body);
    assert.ok(Array.isArray(pullBody.recipes));
    assert.ok(pullBody.usage);
  });

  test('Test 4: GET /api/v1/sync/usage returns Freemium quota status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sync/usage',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.allowed, true);
    assert.strictEqual(body.totalLimit, 5);
  });

  test('Test 5: SyncService.normalizeSocialUrl cleans tracking parameters and normalizes URLs', () => {
    const dirtyUrl = 'https://www.instagram.com/reel/C8xyz123/?igsh=MWQ1Z3&utm_source=ig_web_copy_link&si=abc12345/';
    const clean = SyncService.normalizeSocialUrl(dirtyUrl);
    assert.strictEqual(clean, 'https://www.instagram.com/reel/C8xyz123');

    const tiktokDirty = 'https://www.tiktok.com/@chef/video/7123456789?_t=8abcd&utm_campaign=client_share&share_id=987/';
    const tiktokClean = SyncService.normalizeSocialUrl(tiktokDirty);
    assert.strictEqual(tiktokClean, 'https://www.tiktok.com/@chef/video/7123456789?_t=8abcd');
  });

  test('Test 6: POST /api/v1/recipes/fast-parse serves directly from Global Cache when available', async () => {
    const testUrl = 'https://www.tiktok.com/@chef/video/cached-pasta-viral';
    const cachedRecipe = {
      id: 'rcp_cached_123',
      title: 'פסטה קאצ׳ו א פפה ויראלית',
      platform: 'tiktok',
      sourceUrl: testUrl,
      ingredients: [{ id: 'ing_1', name: 'פקרורינו רומאנו', amount: 100, unit: 'גרם' }],
      instructions: [{ step: 1, text: 'לבשל את הפסטה במים רותחים' }],
      tags: ['פסטה', 'איטלקי'],
    };

    // Seed global cache
    await SyncService.saveToGlobalCache(testUrl, cachedRecipe);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/fast-parse',
      payload: { sourceUrl: testUrl },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.title, 'פסטה קאצ׳ו א פפה ויראלית');
  });

  test('Test 7: VIP email whitelist automatically receives lifetime Pro status', async () => {
    const originalVip = process.env.VIP_EMAILS;
    try {
      process.env.VIP_EMAILS = 'vip_chef@family.com,sister@recipes.com';

      const vipUser = {
        sub: 'google_vip_112233',
        email: 'vip_chef@family.com',
        name: 'אחותי היקרה',
        picture: 'https://example.com/sister.png',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { mockUser: vipUser },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.user.isPro, true);
      assert.strictEqual(body.user.proTier, 'family_vip');
      assert.strictEqual(body.usage.remaining, 9999);
      assert.strictEqual(body.usage.isPro, true);
    } finally {
      process.env.VIP_EMAILS = originalVip;
    }
  });

  test('Test 8: POST /api/v1/auth/redeem-code with valid promo code upgrades free user to Chef Pro', async () => {
    // Attempt with valid promo code
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/redeem-code',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: { code: 'FAMILY2026' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.isPro, true);
    assert.strictEqual(body.user.proTier, 'promo_vip');
    assert.strictEqual(body.usage.remaining, 9999);
    assert.strictEqual(body.usage.isPro, true);
  });

  test('Test 9: POST /api/v1/auth/redeem-code with invalid promo code returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/redeem-code',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: { code: 'FAKE_EXPIRED_CODE' },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('שגוי'));
  });

  test('Test 10: POST /api/v1/auth/guest issues valid guest session and allows immediate promo code redemption', async () => {
    const guestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
    });

    assert.strictEqual(guestRes.statusCode, 200);
    const guestBody = JSON.parse(guestRes.body);
    assert.ok(guestBody.token);
    assert.strictEqual(guestBody.user.isPro, false);

    // Redeem promo code with guest token
    const redeemRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/redeem-code',
      headers: {
        authorization: `Bearer ${guestBody.token}`,
      },
      payload: { code: 'CHEFVIP' },
    });

    assert.strictEqual(redeemRes.statusCode, 200);
    const redeemBody = JSON.parse(redeemRes.body);
    assert.strictEqual(redeemBody.user.isPro, true);
    assert.strictEqual(redeemBody.user.proTier, 'promo_vip');
  });

  test('Test 11: POST /api/v1/recipes/extract alias supports { url } payload for web client extraction', async () => {
    const testUrl = 'https://www.tiktok.com/@chef/video/cached-pasta-extract-isolated';
    await SyncService.saveToGlobalCache(testUrl, {
      id: 'rcp_cached_extract_iso',
      title: 'פסטה קאצ׳ו א פפה ויראלית מבודדת',
      platform: 'tiktok',
      sourceUrl: testUrl,
      ingredients: [{ id: 'ing_1', name: 'פקרורינו רומאנו', amount: 100, unit: 'גרם' }],
      instructions: [{ step: 1, text: 'לבשל את הפסטה במים רותחים' }],
      tags: ['פסטה', 'איטלקי'],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      payload: { url: testUrl },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.title, 'פסטה קאצ׳ו א פפה ויראלית מבודדת');
  });
});

