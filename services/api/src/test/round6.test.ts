process.env.NODE_ENV = 'test';
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { TrendDiscoveryService } from '../services/trend-discovery.service.js';
import { EntitlementService, isEntitlementProActive } from '../services/entitlement.service.js';
import { SyncService, FREE_MONTHLY_EXTRACTIONS } from '../services/sync.service.js';
import { CardcomAdapter } from '../services/billing/cardcom.adapter.js';
import { computeWebhookSignature, getPaymentProvider } from '../services/billing/payment-provider.js';
import { GUEST_COOKIE_NAME } from '../services/guest-cookie.util.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';

function extractCookiePair(setCookieHeader: string | string[] | undefined, name: string): string {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  for (const raw of list) {
    const firstPart = raw.split(';')[0]?.trim() || '';
    if (firstPart.startsWith(`${name}=`)) {
      return firstPart;
    }
  }
  return '';
}

describe('Round 6 Verification Suite (P1-P4)', () => {
  let app: FastifyInstance;
  let origEnv: Record<string, string | undefined>;

  before(async () => {
    console.log(`[TEST START]: Initializing Round 6 Verification Suite | Timestamp: ${new Date().toISOString()}`);
    origEnv = {
      BILLING_TEST_MODE: process.env.BILLING_TEST_MODE,
      BILLING_PROVIDER: process.env.BILLING_PROVIDER,
      CARDCOM_TERMINAL_NUMBER: process.env.CARDCOM_TERMINAL_NUMBER,
      CARDCOM_API_NAME: process.env.CARDCOM_API_NAME,
      CARDCOM_WEBHOOK_SECRET: process.env.CARDCOM_WEBHOOK_SECRET,
      BILLING_WEBHOOK_SECRET: process.env.BILLING_WEBHOOK_SECRET,
      PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      PROMO_CODES: process.env.PROMO_CODES,
    };

    process.env.BILLING_TEST_MODE = '1';
    process.env.BILLING_PROVIDER = 'cardcom';
    process.env.PROMO_CODES = 'FAMILY2026,CHEFVIP,MYRECIPESVIP';

    app = buildApp();
    await app.ready();
    console.log('[SETUP / FIXTURE]: Fastify instance initialized in test mode with BILLING_TEST_MODE=1');
  });

  beforeEach(() => {
    EntitlementService.resetMemoryForTests();
    SyncService.inMemoryProUsers.clear();
    SyncService.inMemoryUsageCounts.clear();
    RecipeStorageService.getInstance().clear();
    process.env.BILLING_TEST_MODE = '1';
    process.env.BILLING_PROVIDER = 'cardcom';
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN]: Restoring environment variables and closing Fastify server');
    EntitlementService.resetMemoryForTests();
    SyncService.inMemoryProUsers.clear();
    SyncService.inMemoryUsageCounts.clear();
    RecipeStorageService.getInstance().clear();

    for (const [key, val] of Object.entries(origEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }

    await app.close();
    console.log('[TEST END]: Round 6 Verification Suite closed cleanly.');
  });

  test('P1: Discovery category filters match emoji pills, hashtags, aliases, and return empty for unknown category', async () => {
    console.log(`[TEST START]: P1 Discovery Category Filters | Timestamp: ${new Date().toISOString()}`);
    const trendService = TrendDiscoveryService.getInstance();

    const allRes = await trendService.getTrends('הכל');
    assert.ok(allRes.trends.length >= 6, `Expected >= 6 curated trends under הכל, got ${allRes.trends.length}`);

    const categoriesToVerify = ['🔥 ויראלי', '🍫 קינוחים', '🥩 בשר', '🍝 איטלקי', '⚡ מהיר', '🥗 בריא'];
    for (const cat of categoriesToVerify) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/recipes/trends?category=${encodeURIComponent(cat)}`,
      });
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data.trends) && data.trends.length >= 1, `Expected >= 1 recipe for category "${cat}", got ${data.trends?.length ?? 0}`);
      console.log(`[ASSERT]: Category "${cat}" returned ${data.trends.length} matching recipes`);
    }

    const hashtagItalian = await trendService.getTrends('#איטלקי');
    assert.ok(hashtagItalian.trends.length >= 1, 'Hashtag-prefixed #איטלקי filter must match איטלקי recipes');

    const aliasItalian = await trendService.getTrends('איטלקית');
    assert.ok(aliasItalian.trends.length >= 1, 'Gender/inflection alias איטלקית must match איטלקי recipes');

    const emptyRes = await trendService.getTrends('קטגוריה-לא-קיימת-999');
    assert.strictEqual(emptyRes.trends.length, 0, 'Unmatched category should still return 0 results');
    console.log('[TEST END]: P1 Discovery Category Filters passed.');
  });

  test('P2: /admin renders inline error UI + timeout guard and wrong passwords return fast 401', async () => {
    console.log(`[TEST START]: P2 Admin Login Hang Fix & Fast 401 | Timestamp: ${new Date().toISOString()}`);

    const htmlRes = await app.inject({ method: 'GET', url: '/admin' });
    assert.strictEqual(htmlRes.statusCode, 200);
    const html = htmlRes.body;
    assert.ok(html.includes('id="login-error"'), 'Admin page must include inline #login-error alert element');
    assert.ok(html.includes('AbortController'), 'Admin page fetch must guard requests with AbortController timeout');
    assert.ok(html.includes('יותר מדי ניסיונות, נסה שוב בעוד דקה'), 'Admin page must handle HTTP 429 cleanly');
    assert.ok(!/\balert\s*\(/.test(html), 'Admin page must not use blocking alert() dialogs');
    console.log('[ASSERT]: Verified /admin HTML inline error, AbortController timeout, 429 message, and zero alert()');

    const startMs = Date.now();
    for (let i = 1; i <= 3; i++) {
      const badRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/login',
        payload: { password: `WrongPassword_${i}` },
      });
      assert.strictEqual(badRes.statusCode, 401, `Wrong admin attempt #${i} must return 401`);
      const body = JSON.parse(badRes.body);
      assert.strictEqual(body.error, 'סיסמת ניהול שגויה');
    }
    const elapsedMs = Date.now() - startMs;
    assert.ok(elapsedMs < 2000, `Three consecutive wrong attempts should complete fast, took ${elapsedMs}ms`);
    console.log(`[ASSERT]: Three consecutive wrong admin logins failed fast with 401 in ${elapsedMs}ms`);

    const validPassword = process.env.ADMIN_PASSWORD || 'ChefAdmin2026!';
    const okRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/login',
      payload: { password: validPassword },
    });
    assert.strictEqual(okRes.statusCode, 200);
    const okBody = JSON.parse(okRes.body);
    assert.strictEqual(okBody.success, true);
    assert.ok(typeof okBody.token === 'string' && okBody.token.length > 20);
    console.log('[TEST END]: P2 Admin Login verification passed.');
  });

  test('P3: Web app HTML enforces reactive entitlement/banner sync, modal auto-close, and clean promo redemption copy', async () => {
    console.log(`[TEST START]: P3 Promo Modal & Reactive Quota Banner | Timestamp: ${new Date().toISOString()}`);

    const appRes = await app.inject({ method: 'GET', url: '/app' });
    assert.strictEqual(appRes.statusCode, 200);
    const html = appRes.body;

    assert.ok(html.includes('v1.7.0 (Build 26)'), 'Web app badge must reflect bumped version v1.7.0 (Build 26)');
    assert.ok(html.includes('applyEntitlementAndQuotaState'), 'Web app must centralize reactive entitlement state updates');
    assert.ok(html.includes('handleQuotaExceededResponse'), 'Web app must handle HTTP 402 quota errors reactively');
    assert.ok(html.includes('closePromoModal()') && html.includes('closePaywallModal()'), 'Redeeming VIP promo must close both promo and paywall modals');
    assert.ok(html.includes('שודרגת ל-Chef Pro! 👨‍🍳'), 'Web app must render updated upgrade confirmation message');
    assert.ok(html.includes('החיוב מחודש אוטומטית וניתן לבטלו בכל עת במסך הפרופיל.'), 'Paywall modal must display recurring auto-renewal disclosure');
    assert.ok(!html.includes('simulateWebSubscribe'), 'Legacy dead simulateWebSubscribe toast stub must be removed');
    console.log('[ASSERT]: Verified /app SSR HTML structure, version badge, modal close wiring, and billing UI');

    // Verify backend promo redemption response message & non-cancelable VIP entitlement
    const guestRes = await app.inject({ method: 'POST', url: '/api/v1/auth/guest', payload: {} });
    assert.strictEqual(guestRes.statusCode, 200);
    const { token } = JSON.parse(guestRes.body);

    const badPromoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/redeem-code',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: 'INVALID_CODE_XYZ' },
    });
    assert.strictEqual(badPromoRes.statusCode, 400);

    const goodPromoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/redeem-code',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: 'CHEFVIP' },
    });
    assert.strictEqual(goodPromoRes.statusCode, 200);
    const goodBody = JSON.parse(goodPromoRes.body);
    assert.strictEqual(goodBody.message, 'שודרגת ל-Chef Pro! 👨‍🍳');
    assert.strictEqual(goodBody.entitlement.plan, 'pro_vip');
    assert.strictEqual(goodBody.entitlement.source, 'vip');

    const cancelVipRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/cancel',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    assert.strictEqual(cancelVipRes.statusCode, 400);
    assert.strictEqual(JSON.parse(cancelVipRes.body).error, 'VIP_NOT_CANCELABLE');
    console.log('[ASSERT]: Verified VIP promo message, entitlement source="vip", and non-cancelable billing guard');
    console.log('[TEST END]: P3 Verification passed.');
  });

  test('P4: Persistent guest cookie survives localStorage reset, 6th extraction returns 402, and test billing lifecycle upgrades/cancels/expires', async () => {
    console.log(`[TEST START]: P4 Quota Cookie & Billing Lifecycle | Timestamp: ${new Date().toISOString()}`);

    // 1. Issue guest session and verify signed HttpOnly cookie persistence across fresh guest calls
    const guestInitRes = await app.inject({ method: 'POST', url: '/api/v1/auth/guest', payload: {} });
    assert.strictEqual(guestInitRes.statusCode, 200);
    const guestInitBody = JSON.parse(guestInitRes.body);
    const guestId = guestInitBody.user.userId;

    const rawSetCookie = guestInitRes.headers['set-cookie'];
    const setCookieStr = Array.isArray(rawSetCookie) ? rawSetCookie.join('; ') : String(rawSetCookie || '');
    assert.ok(setCookieStr.includes(`${GUEST_COOKIE_NAME}=`), 'Guest login must issue persistent myrecipes_guest_id cookie');
    assert.ok(setCookieStr.includes('HttpOnly'), 'Guest cookie must be HttpOnly');

    const guestCookiePair = extractCookiePair(rawSetCookie, GUEST_COOKIE_NAME);
    assert.ok(guestCookiePair.length > GUEST_COOKIE_NAME.length + 5);

    const guestRestoreRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      headers: { cookie: guestCookiePair },
      payload: {},
    });
    assert.strictEqual(guestRestoreRes.statusCode, 200);
    assert.strictEqual(JSON.parse(guestRestoreRes.body).user.userId, guestId, 'Cookie must restore the same guest userId');
    console.log(`[ASSERT]: Signed HttpOnly guest cookie preserved guestId=${guestId}`);

    // 2. Exhaust free monthly quota (5 extractions) using only the HttpOnly cookie
    for (let i = 1; i <= FREE_MONTHLY_EXTRACTIONS; i++) {
      const extRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recipes/extract',
        headers: { cookie: guestCookiePair },
        payload: { sourceUrl: `https://www.youtube.com/shorts/carbonara?attempt=${i}` },
      });
      assert.strictEqual(extRes.statusCode, 200, `Extraction #${i} should succeed within free quota`);
    }

    // Simulate wiping localStorage: obtain a "fresh" guest session using only the browser cookie, then try 6th extraction
    const afterWipeGuestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      headers: { cookie: guestCookiePair },
      payload: {},
    });
    const afterWipeUsage = JSON.parse(afterWipeGuestRes.body).usage;
    assert.strictEqual(afterWipeUsage.used, FREE_MONTHLY_EXTRACTIONS);
    assert.strictEqual(afterWipeUsage.allowed, false);

    const sixthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { cookie: guestCookiePair },
      payload: { sourceUrl: 'https://www.youtube.com/shorts/carbonara?attempt=6' },
    });
    assert.strictEqual(sixthRes.statusCode, 402, '6th free extraction must fail with HTTP 402 Payment Required');
    const sixthBody = JSON.parse(sixthRes.body);
    assert.strictEqual(sixthBody.error, 'QUOTA_EXCEEDED');
    console.log('[ASSERT]: Verified 6th extraction returns HTTP 402 QUOTA_EXCEEDED even after simulated localStorage wipe');

    // 3. Test-mode checkout + simulated checkout UI + webhook signature verification + idempotency
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { cookie: guestCookiePair },
      payload: { plan: 'pro_yearly' },
    });
    assert.strictEqual(checkoutRes.statusCode, 200);
    const checkoutBody = JSON.parse(checkoutRes.body);
    assert.strictEqual(checkoutBody.testMode, true);
    assert.strictEqual(checkoutBody.provider, 'test');
    assert.ok(checkoutBody.checkoutUrl.includes('/billing/test-checkout?session='));

    const checkoutUrlObj = new URL(checkoutBody.checkoutUrl);
    const sessionToken = checkoutUrlObj.searchParams.get('session') || '';
    assert.ok(sessionToken.length > 20);

    const testCheckoutPage = await app.inject({
      method: 'GET',
      url: `${checkoutUrlObj.pathname}${checkoutUrlObj.search}`,
    });
    assert.strictEqual(testCheckoutPage.statusCode, 200);
    assert.ok(testCheckoutPage.body.includes('מצב בדיקה - לא חויבת באמת'), 'Test checkout page must clearly show non-live banner');
    assert.ok(testCheckoutPage.body.includes('149.90'), 'Test checkout page must show selected yearly amount');

    const returnPage = await app.inject({
      method: 'GET',
      url: '/billing/return?status=success&plan=pro_yearly',
    });
    assert.strictEqual(returnPage.statusCode, 200);
    assert.ok(returnPage.body.includes('/app?billing=success&amp;plan=pro_yearly'));
    assert.ok(returnPage.body.includes('מצב בדיקה - לא חויבת באמת'));

    // Forged unsigned webhook must return 401
    const forgedWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      payload: { userId: guestId, plan: 'pro_yearly', status: 'succeeded', eventId: 'evt_forged_1' },
    });
    assert.strictEqual(forgedWebhookRes.statusCode, 401);
    assert.strictEqual(JSON.parse(forgedWebhookRes.body).error, 'INVALID_WEBHOOK_SIGNATURE');

    // Valid sessionToken webhook succeeds and grants Pro entitlement
    const validWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      payload: { sessionToken, status: 'succeeded' },
    });
    assert.strictEqual(validWebhookRes.statusCode, 200);
    const webhookBody = JSON.parse(validWebhookRes.body);
    assert.strictEqual(webhookBody.duplicate, false);
    assert.strictEqual(webhookBody.entitlement.plan, 'pro_yearly');
    assert.strictEqual(webhookBody.entitlement.status, 'active');
    assert.strictEqual(webhookBody.entitlement.source, 'billing');
    assert.ok(Boolean(webhookBody.entitlement.renewsAt));

    // Replaying identical webhook is idempotent
    const dupWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      payload: { sessionToken, status: 'succeeded' },
    });
    assert.strictEqual(dupWebhookRes.statusCode, 200);
    assert.strictEqual(JSON.parse(dupWebhookRes.body).duplicate, true);

    // HMAC-signed raw webhook tuple is also accepted once and deduplicated on replay
    const hmacEventId = 'evt_hmac_monthly_1';
    const hmacSig = computeWebhookSignature(`${hmacEventId}:${guestId}:pro_yearly:succeeded`);
    const hmacWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: { 'x-billing-signature': hmacSig },
      payload: { eventId: hmacEventId, userId: guestId, plan: 'pro_yearly', status: 'succeeded' },
    });
    assert.strictEqual(hmacWebhookRes.statusCode, 200);
    assert.strictEqual(JSON.parse(hmacWebhookRes.body).duplicate, false);

    // Entitlement & previously blocked 6th extraction now pass cleanly
    const entitlementRes = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/entitlement',
      headers: { cookie: guestCookiePair },
    });
    assert.strictEqual(entitlementRes.statusCode, 200);
    const entBody = JSON.parse(entitlementRes.body);
    assert.strictEqual(entBody.usage.isPro, true);
    assert.strictEqual(entBody.entitlement.plan, 'pro_yearly');

    const proExtRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      headers: { cookie: guestCookiePair },
      payload: { sourceUrl: 'https://www.youtube.com/shorts/carbonara?attempt=7' },
    });
    assert.strictEqual(proExtRes.statusCode, 200, 'Active paid subscriber must bypass free monthly limit');

    // Cancel recurring subscription -> preserves access until renewsAt
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/cancel',
      headers: { cookie: guestCookiePair },
      payload: {},
    });
    assert.strictEqual(cancelRes.statusCode, 200);
    const cancelBody = JSON.parse(cancelRes.body);
    assert.strictEqual(cancelBody.entitlement.status, 'canceled');
    assert.strictEqual(isEntitlementProActive(cancelBody.entitlement), true, 'Canceled subscription remains active until period end');

    // Simulate period expiration -> Pro access terminates cleanly
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    await EntitlementService.activatePaidEntitlement(guestId, 'pro_monthly', 'test', 'rec_expired_test', pastIso);
    const expiredEnt = await EntitlementService.markEntitlementCanceled(guestId);
    assert.strictEqual(isEntitlementProActive(expiredEnt), false, 'Expired renewsAt must deactivate Pro entitlement');
    const postExpiryUsage = await SyncService.checkUsageLimit(guestId);
    assert.strictEqual(postExpiryUsage.isPro, false);
    console.log('[ASSERT]: Verified test checkout, signature security, webhook idempotency, Pro bypass, cancel grace period, and expiration');
  });

  test('P4: CardcomAdapter blocks execution in BILLING_TEST_MODE and fails explicitly without credentials in live mode', async () => {
    console.log(`[TEST START]: P4 Cardcom Adapter Safety Guard | Timestamp: ${new Date().toISOString()}`);

    process.env.BILLING_TEST_MODE = '1';
    const cardcom = new CardcomAdapter();
    await assert.rejects(
      () =>
        cardcom.createCheckoutSession({
          userId: 'usr_guard_1',
          plan: 'pro_monthly',
          originUrl: 'http://localhost:3001',
          successUrl: 'http://localhost:3001/billing/return?status=success',
          failedUrl: 'http://localhost:3001/billing/return?status=failed',
          webhookUrl: 'http://localhost:3001/api/v1/billing/webhook',
        }),
      /must not run while BILLING_TEST_MODE is enabled/,
    );

    process.env.BILLING_TEST_MODE = '0';
    process.env.BILLING_PROVIDER = 'cardcom';
    delete process.env.CARDCOM_TERMINAL_NUMBER;
    delete process.env.CARDCOM_API_NAME;

    const liveAdapter = getPaymentProvider();
    assert.strictEqual(liveAdapter.providerName, 'cardcom');
    await assert.rejects(
      () =>
        liveAdapter.createCheckoutSession({
          userId: 'usr_guard_2',
          plan: 'pro_monthly',
          originUrl: 'http://localhost:3001',
          successUrl: 'http://localhost:3001/billing/return?status=success',
          failedUrl: 'http://localhost:3001/billing/return?status=failed',
          webhookUrl: 'http://localhost:3001/api/v1/billing/webhook',
        }),
      /Cardcom configuration incomplete/,
    );

    process.env.BILLING_TEST_MODE = '1';
    console.log('[ASSERT]: Verified CardcomAdapter refuses test-mode execution and rejects missing live credentials cleanly');
    console.log('[TEST END]: P4 Cardcom Guard passed.');
  });

  test('P4 Security: Ignores poisoned X-Forwarded-Host headers and serves /paywall route cleanly', async () => {
    console.log(`[TEST START]: P4 Host Header Poisoning & /paywall Route | Timestamp: ${new Date().toISOString()}`);

    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: {
        host: 'localhost:3001',
        'x-forwarded-host': 'evil-attacker.com',
        'x-forwarded-proto': 'https',
      },
      payload: { plan: 'pro_monthly' },
    });
    assert.strictEqual(checkoutRes.statusCode, 200);
    const body = JSON.parse(checkoutRes.body);
    assert.ok(!body.checkoutUrl.includes('evil-attacker.com'), 'Poisoned x-forwarded-host must never leak into checkoutUrl');
    assert.ok(body.checkoutUrl.startsWith('http://localhost:3001/billing/test-checkout'));

    const paywallRes = await app.inject({ method: 'GET', url: '/paywall' });
    assert.strictEqual(paywallRes.statusCode, 302);
    assert.strictEqual(paywallRes.headers.location, '/app?paywall=1');
    console.log('[ASSERT]: Verified host header injection blocked and GET /paywall redirects cleanly');
  });

  test('P4 Security: Google Sign-In preserves & migrates guest Pro/VIP entitlement via signed HttpOnly cookie', async () => {
    console.log(`[TEST START]: P4 Guest-to-Google Entitlement Merge | Timestamp: ${new Date().toISOString()}`);

    const guestRes = await app.inject({ method: 'POST', url: '/api/v1/auth/guest', payload: {} });
    assert.strictEqual(guestRes.statusCode, 200);
    const guestId = JSON.parse(guestRes.body).user.userId;
    const guestCookie = extractCookiePair(guestRes.headers['set-cookie'], GUEST_COOKIE_NAME);
    assert.ok(guestCookie.startsWith(`${GUEST_COOKIE_NAME}=`));

    // Grant paid entitlement on the guest session
    await EntitlementService.activatePaidEntitlement(guestId, 'pro_yearly', 'test', 'rec_guest_merge_1');

    // Now authenticate with Google while carrying ONLY the guest cookie
    const googleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      headers: { cookie: guestCookie },
      payload: {
        mockUser: {
          sub: 'google_merge_sub_999',
          email: 'merged.user@gmail.com',
          name: 'Merged User',
        },
      },
    });
    assert.strictEqual(googleRes.statusCode, 200);
    const gBody = JSON.parse(googleRes.body);
    assert.strictEqual(gBody.user.userId, 'usr_google_merge_sub_999');
    assert.strictEqual(gBody.user.isPro, true, 'Google account session must inherit guest active Pro status');
    assert.strictEqual(gBody.entitlement.plan, 'pro_yearly');
    assert.strictEqual(gBody.entitlement.providerRecurringId, 'rec_guest_merge_1');
    assert.strictEqual(gBody.usage.isPro, true);

    const postGuestEnt = await EntitlementService.getEntitlement(guestId);
    assert.strictEqual(postGuestEnt.plan, 'free', 'Migrated guest row should be revoked so providerRecurringId stays unique');
    console.log('[ASSERT]: Verified Google Sign-In migrated active paid Pro entitlement from guest cookie cleanly');
  });

  test('P4 Security: Cardcom requires CARDCOM_WEBHOOK_SECRET in live mode and resolves recurring renewals by RecurringId', async () => {
    console.log(`[TEST START]: P4 Cardcom Live Webhook Secret & Recurring Lookup | Timestamp: ${new Date().toISOString()}`);

    process.env.BILLING_TEST_MODE = '0';
    process.env.CARDCOM_TERMINAL_NUMBER = '1000';
    process.env.CARDCOM_API_NAME = 'test_api_name';
    delete process.env.CARDCOM_WEBHOOK_SECRET;
    delete process.env.BILLING_WEBHOOK_SECRET;

    const cardcom = new CardcomAdapter();
    await assert.rejects(
      () =>
        cardcom.createCheckoutSession({
          userId: 'usr_cardcom_secret_check',
          plan: 'pro_monthly',
          originUrl: 'https://my-recipes-app-mu.vercel.app',
          successUrl: 'https://my-recipes-app-mu.vercel.app/billing/return?status=success',
          failedUrl: 'https://my-recipes-app-mu.vercel.app/billing/return?status=failed',
          webhookUrl: 'https://my-recipes-app-mu.vercel.app/api/v1/billing/webhook',
        }),
      /set CARDCOM_WEBHOOK_SECRET/,
    );

    const liveSecret = 'cardcom-live-webhook-secret-xyz-2026';
    process.env.CARDCOM_WEBHOOK_SECRET = liveSecret;

    await EntitlementService.activatePaidEntitlement('usr_cardcom_recurring_user', 'pro_monthly', 'cardcom', 'rec_cardcom_999');

    const recurringPayload: Record<string, unknown> = {
      InternalDealNumber: 'deal_renewal_777',
      RecurringId: 'rec_cardcom_999',
      ResponseCode: 0,
    };
    const sig = computeWebhookSignature(JSON.stringify(recurringPayload), liveSecret);

    const parsedEvent = await cardcom.verifyAndParseWebhook({
      headers: { 'x-cardcom-signature': sig },
      body: recurringPayload,
      query: {},
    });

    assert.strictEqual(parsedEvent.userId, 'usr_cardcom_recurring_user');
    assert.strictEqual(parsedEvent.plan, 'pro_monthly');
    assert.strictEqual(parsedEvent.status, 'succeeded');
    assert.strictEqual(parsedEvent.providerRecurringId, 'rec_cardcom_999');

    process.env.BILLING_TEST_MODE = '1';
    delete process.env.CARDCOM_TERMINAL_NUMBER;
    delete process.env.CARDCOM_API_NAME;
    delete process.env.CARDCOM_WEBHOOK_SECRET;
    console.log('[ASSERT]: Verified live Cardcom webhook secret enforcement & RecurringId lookup after ReturnValue expiry');
  });
});

