import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

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
});
