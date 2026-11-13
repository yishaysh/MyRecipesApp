import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, UserSession } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';
import {
  EntitlementService,
  isBillingTestMode,
  isEntitlementProActive,
} from '../services/entitlement.service.js';
import {
  BILLING_PLAN_CONFIG,
  getPaymentProvider,
  normalizePaidPlan,
  verifyBillingToken,
} from '../services/billing/payment-provider.js';
import {
  TestCheckoutSessionPayload,
  WebhookSignatureError,
} from '../services/billing/test-billing.adapter.js';
import {
  buildGuestSetCookieHeader,
  extractVerifiedGuestIdFromRequest,
} from '../services/guest-cookie.util.js';

export interface ResolvedBillingUser {
  userId: string;
  email?: string;
  name?: string;
  isAuthenticated: boolean;
  session: UserSession | null;
}

export function resolveUserFromHeaders(headers: Record<string, string | string[] | undefined>): ResolvedBillingUser {
  const authHeaderRaw = headers.authorization || headers.Authorization;
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = AuthService.verifySessionToken(token);
    if (session?.userId) {
      return {
        userId: session.userId,
        email: session.email,
        name: session.name,
        isAuthenticated: true,
        session,
      };
    }
  }

  const cookieGuestId = extractVerifiedGuestIdFromRequest(headers);
  if (cookieGuestId) {
    return {
      userId: cookieGuestId,
      email: `${cookieGuestId}@guest.myrecipes.app`,
      name: 'אורח',
      isAuthenticated: true,
      session: null,
    };
  }

  const deviceIdRaw = headers['x-device-id'];
  const deviceId = Array.isArray(deviceIdRaw) ? deviceIdRaw[0] : deviceIdRaw;
  if (deviceId && deviceId.trim()) {
    return {
      userId: `usr_device_${deviceId.trim()}`,
      isAuthenticated: true,
      session: null,
    };
  }

  return {
    userId: 'guest',
    isAuthenticated: false,
    session: null,
  };
}

function extractSafeHost(rawHost: unknown): string {
  const cleaned = String(rawHost || '')
    .split(',')[0]
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  if (!cleaned || cleaned.length > 253 || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function isAllowedOriginHost(hostWithPort: string): boolean {
  const hostOnly = hostWithPort.split(':')[0].toLowerCase();
  if (hostOnly === 'localhost' || hostOnly === '127.0.0.1') {
    return true;
  }
  if (hostOnly.endsWith('.vercel.app')) {
    return true;
  }
  const envHosts = [
    process.env.PUBLIC_BASE_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.ALLOWED_ORIGIN_HOSTS || '').split(','),
  ]
    .map((v) => extractSafeHost(v).split(':')[0].toLowerCase())
    .filter(Boolean);

  return envHosts.includes(hostOnly);
}

function getRequestOrigin(request: FastifyRequest): string {
  const publicBase = (process.env.PUBLIC_BASE_URL || '').trim();
  if (publicBase) {
    try {
      const normalized = /^https?:\/\//i.test(publicBase) ? publicBase : `https://${publicBase}`;
      return new URL(normalized).origin;
    } catch {
      // Ignore invalid PUBLIC_BASE_URL and fall back to host allowlist
    }
  }

  const forwardedProtoRaw = request.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoRaw) ? forwardedProtoRaw[0] : forwardedProtoRaw;
  const hostHeader = extractSafeHost(request.headers.host);
  const forwardedHostRaw = request.headers['x-forwarded-host'];
  const forwardedHost = process.env.VERCEL
    ? extractSafeHost(Array.isArray(forwardedHostRaw) ? forwardedHostRaw[0] : forwardedHostRaw)
    : '';

  const candidateHost = (hostHeader && isAllowedOriginHost(hostHeader))
    ? hostHeader
    : (forwardedHost && isAllowedOriginHost(forwardedHost))
      ? forwardedHost
      : 'my-recipes-app-mu.vercel.app';

  const isLocal = candidateHost.startsWith('localhost') || candidateHost.startsWith('127.0.0.1');
  const proto = isLocal
    ? 'http'
    : (forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'https');

  return `${proto}://${candidateHost}`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtmlShell(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #fffbeb 100%);
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .badge-test {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 0.85rem;
      font-weight: 800;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.4rem;
      font-weight: 900;
      color: #0f172a;
    }
    p {
      margin: 0 0 18px;
      color: #475569;
      font-size: 0.96rem;
      line-height: 1.5;
    }
    .summary {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 20px;
      text-align: right;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 0.95rem;
    }
    .btn {
      display: block;
      width: 100%;
      border: none;
      border-radius: 14px;
      padding: 14px 18px;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 10px;
      font-family: inherit;
    }
    .btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .btn-success {
      background: #10b981;
      color: #ffffff;
    }
    .btn-fail {
      background: #ef4444;
      color: #ffffff;
    }
    .btn-primary {
      background: #f59e0b;
      color: #ffffff;
    }
    .btn-ghost {
      background: #f1f5f9;
      color: #334155;
      margin-bottom: 0;
    }
    .error-msg {
      display: none;
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 0.88rem;
      font-weight: 700;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    ${bodyContent}
  </div>
</body>
</html>`;
}

export async function billingApiRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/billing/entitlement
   * Single source of truth for current user subscription entitlement & usage quota.
   */
  fastify.get('/entitlement', async (request: FastifyRequest, reply: FastifyReply) => {
    const resolved = resolveUserFromHeaders(request.headers as Record<string, string | string[] | undefined>);
    const entitlement = await EntitlementService.getEntitlement(resolved.userId);
    const usage = await SyncService.checkUsageLimit(resolved.userId);

    return reply.status(200).send({
      success: true,
      userId: resolved.userId,
      entitlement,
      usage,
      testMode: isBillingTestMode(),
      provider: isBillingTestMode() ? 'test' : (process.env.BILLING_PROVIDER || 'cardcom'),
    });
  });

  /**
   * POST /api/v1/billing/checkout
   * Creates a provider checkout session URL (test checkout in BILLING_TEST_MODE, Cardcom in live mode).
   */
  fastify.post('/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as { plan?: string };
    const normalizedPlan = normalizePaidPlan(body.plan);
    if (!normalizedPlan) {
      return reply.status(400).send({
        error: 'INVALID_PLAN',
        message: 'יש לבחור תוכנית חודשית או שנתית תקינה.',
      });
    }

    let resolved = resolveUserFromHeaders(request.headers as Record<string, string | string[] | undefined>);
    if (!resolved.isAuthenticated || resolved.userId === 'guest') {
      const guest = await AuthService.createGuestSession();
      reply.header('Set-Cookie', buildGuestSetCookieHeader(guest.user.userId, request.headers as Record<string, string | string[] | undefined>));
      resolved = {
        userId: guest.user.userId,
        email: guest.user.email,
        name: guest.user.name,
        isAuthenticated: true,
        session: guest.user,
      };
    }

    await EntitlementService.ensureUserExists(resolved.userId, resolved.email, resolved.name);

    const originUrl = getRequestOrigin(request);
    try {
      const adapter = getPaymentProvider();
      const checkout = await adapter.createCheckoutSession({
        userId: resolved.userId,
        userEmail: resolved.email,
        userName: resolved.name,
        plan: normalizedPlan,
        originUrl,
        successUrl: `${originUrl}/billing/return?status=success&plan=${normalizedPlan}`,
        failedUrl: `${originUrl}/billing/return?status=failed&plan=${normalizedPlan}`,
        webhookUrl: `${originUrl}/api/v1/billing/webhook`,
      });

      return reply.status(200).send({
        success: true,
        ...checkout,
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'שגיאה ביצירת עמוד תשלום';
      return reply.status(503).send({
        error: 'CHECKOUT_UNAVAILABLE',
        message,
      });
    }
  });

  /**
   * POST /api/v1/billing/webhook
   * Verifies provider/test webhook signature, enforces idempotency via billing_events, and updates user_entitlements.
   */
  fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const adapter = getPaymentProvider();
      const event = await adapter.verifyAndParseWebhook({
        headers: request.headers as Record<string, string | string[] | undefined>,
        body: ((request.body || {}) as Record<string, unknown>),
        query: (request.query || {}) as Record<string, string | string[] | undefined>,
      });

      const recorded = await EntitlementService.recordBillingEventOnce({
        eventId: event.eventId,
        provider: event.provider,
        eventType: event.eventType,
        userId: event.userId,
        plan: event.plan,
        providerRecurringId: event.providerRecurringId || null,
        status: event.status,
        rawPayload: event.rawPayload,
      });

      if (recorded.duplicate) {
        const existingEntitlement = await EntitlementService.getEntitlement(event.userId);
        return reply.status(200).send({
          received: true,
          duplicate: true,
          eventId: event.eventId,
          entitlement: existingEntitlement,
        });
      }

      let entitlement = await EntitlementService.getEntitlement(event.userId);
      if (event.status === 'succeeded') {
        entitlement = await EntitlementService.activatePaidEntitlement(
          event.userId,
          event.plan,
          event.provider,
          event.providerRecurringId || null,
        );
      } else if (event.status === 'canceled') {
        entitlement = await EntitlementService.markEntitlementCanceled(event.userId);
      }

      return reply.status(200).send({
        received: true,
        duplicate: false,
        eventId: event.eventId,
        status: event.status,
        entitlement,
      });
    } catch (err: any) {
      if (err instanceof WebhookSignatureError || err?.statusCode === 401) {
        return reply.status(401).send({
          error: 'INVALID_WEBHOOK_SIGNATURE',
          message: err.message || 'חתימת Webhook אינה תקינה',
        });
      }
      return reply.status(400).send({
        error: 'INVALID_WEBHOOK_PAYLOAD',
        message: err?.message || 'שגיאה בעיבוד נתוני תשלום',
      });
    }
  });

  /**
   * POST /api/v1/billing/cancel
   * Cancels recurring billing at provider while preserving Pro entitlement until period end.
   * Rejects VIP grants cleanly (VIP is lifetime non-recurring).
   */
  fastify.post('/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const resolved = resolveUserFromHeaders(request.headers as Record<string, string | string[] | undefined>);
    if (!resolved.isAuthenticated || resolved.userId === 'guest') {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'יש להתחבר לפני ביטול מנוי.',
      });
    }

    const current = await EntitlementService.getEntitlement(resolved.userId);
    if (current.source === 'vip' || current.plan === 'pro_vip') {
      return reply.status(400).send({
        error: 'VIP_NOT_CANCELABLE',
        message: 'מנוי VIP הוא הטבה ללא חיוב מתחדש ואינו דורש ביטול.',
      });
    }

    if (!isEntitlementProActive(current)) {
      return reply.status(400).send({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'לא נמצא מנוי פעיל לביטול.',
      });
    }

    if (current.status === 'canceled') {
      const usage = await SyncService.checkUsageLimit(resolved.userId);
      return reply.status(200).send({
        success: true,
        entitlement: current,
        usage,
        message: 'המנוי כבר סומן לביטול ויישאר פעיל עד סוף התקופה ששולמה.',
      });
    }

    try {
      const adapter = getPaymentProvider();
      await adapter.cancelRecurring(current.providerRecurringId || '');
    } catch (err: any) {
      return reply.status(502).send({
        error: 'PROVIDER_CANCEL_FAILED',
        message: err?.message || 'ביטול החיוב המחזורי מול ספק הסליקה נכשל',
      });
    }

    const updatedEntitlement = await EntitlementService.markEntitlementCanceled(resolved.userId);
    await EntitlementService.recordBillingEventOnce({
      eventId: `cancel_${resolved.userId}_${Date.now()}`,
      provider: updatedEntitlement.provider || 'billing',
      eventType: 'subscription_canceled',
      userId: resolved.userId,
      plan: updatedEntitlement.plan,
      providerRecurringId: updatedEntitlement.providerRecurringId || null,
      status: 'canceled',
      rawPayload: { canceledByUser: true },
    });

    const usage = await SyncService.checkUsageLimit(resolved.userId);
    return reply.status(200).send({
      success: true,
      entitlement: updatedEntitlement,
      usage,
      message: 'המנוי בוטל. הגישה ל-Chef Pro תישאר פעילה עד סוף התקופה הנוכחית.',
    });
  });
}

export async function billingPageRoutes(fastify: FastifyInstance) {
  /**
   * GET /billing/test-checkout
   * Clearly labeled test checkout simulator when BILLING_TEST_MODE is enabled.
   */
  fastify.get('/billing/test-checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isBillingTestMode()) {
      return reply
        .status(404)
        .type('text/html; charset=utf-8')
        .send(renderHtmlShell(
          'מצב בדיקה כבוי',
          `<h1>עמוד הבדיקה אינו זמין</h1>
           <p>מצב בדיקת חיובים אינו פעיל בסביבה זו.</p>
           <a href="/app" class="btn btn-primary">חזרה לאפליקציה</a>`
        ));
    }

    const query = (request.query || {}) as { session?: string };
    const sessionToken = typeof query.session === 'string' ? query.session.trim() : '';
    const parsed = sessionToken ? verifyBillingToken<TestCheckoutSessionPayload>(sessionToken) : null;

    if (!parsed || !parsed.userId || !parsed.plan || !BILLING_PLAN_CONFIG[parsed.plan]) {
      return reply
        .status(400)
        .type('text/html; charset=utf-8')
        .send(renderHtmlShell(
          'פג תוקף קישור התשלום',
          `<div class="badge-test">מצב בדיקה - לא חויבת באמת</div>
           <h1>קישור התשלום אינו תקין או שפג תוקפו</h1>
           <p>נא לחזור לאפליקציה ולבחור מחדש בתוכנית הרצויה.</p>
           <a href="/app" class="btn btn-primary">חזרה לאפליקציה</a>`
        ));
    }

    const cfg = BILLING_PLAN_CONFIG[parsed.plan];
    const safeTokenJson = JSON.stringify(sessionToken).replace(/</g, '\\u003c');
    const safePlanJson = JSON.stringify(parsed.plan).replace(/</g, '\\u003c');

    return reply
      .status(200)
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(renderHtmlShell(
        'תשלום מאובטח (מצב בדיקה) - ספר המתכונים שלי',
        `<div class="badge-test">מצב בדיקה - לא חויבת באמת</div>
         <h1>סימולציית תשלום מאובטח 👑</h1>
         <p>עמוד זה מדמה שער תשלום לצורכי בדיקה ואינו מחייב כרטיס אשראי.</p>
         <div class="summary">
           <div class="summary-row"><span>תוכנית שנבחרה:</span><strong>${escapeHtml(cfg.labelHe)}</strong></div>
           <div class="summary-row"><span>סכום לתשלום:</span><strong>${cfg.amountIls.toFixed(2)} ₪</strong></div>
           <div class="summary-row"><span>תדירות חיוב:</span><strong>${cfg.interval === 'year' ? 'שנתי' : 'חודשי'}</strong></div>
         </div>
         <div id="sim-error" class="error-msg" role="alert"></div>
         <button type="button" id="btn-sim-success" class="btn btn-success" onclick="simulateOutcome('succeeded')">סימולציית תשלום מוצלח ✅</button>
         <button type="button" id="btn-sim-fail" class="btn btn-fail" onclick="simulateOutcome('failed')">סימולציית תשלום שנכשל ❌</button>
         <a href="/app" class="btn btn-ghost">חזרה לאפליקציה ללא חיוב</a>
         <script>
           const SESSION_TOKEN = ${safeTokenJson};
           const PLAN_ID = ${safePlanJson};
           async function simulateOutcome(status) {
             const btnOk = document.getElementById('btn-sim-success');
             const btnFail = document.getElementById('btn-sim-fail');
             const errEl = document.getElementById('sim-error');
             if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
             if (btnOk) btnOk.disabled = true;
             if (btnFail) btnFail.disabled = true;
             try {
               const res = await fetch('/api/v1/billing/webhook', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ sessionToken: SESSION_TOKEN, status: status })
               });
               if (!res.ok) {
                 const errData = await res.json().catch(() => ({}));
                 throw new Error(errData.message || 'שגיאה בעיבוד הסימולציה');
               }
               const returnStatus = status === 'succeeded' ? 'success' : 'failed';
               window.location.href = '/billing/return?status=' + returnStatus + '&plan=' + encodeURIComponent(PLAN_ID) + '&test=1';
             } catch (e) {
               if (errEl) {
                 errEl.textContent = e && e.message ? e.message : 'שגיאת תקשורת מול השרת';
                 errEl.style.display = 'block';
               }
               if (btnOk) btnOk.disabled = false;
               if (btnFail) btnFail.disabled = false;
             }
           }
         </script>`
      ));
  });

  /**
   * GET /billing/return
   * Post-checkout landing page (both Cardcom and Test Mode) directing back into /app.
   */
  fastify.get('/billing/return', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query || {}) as {
      status?: string;
      plan?: string;
      test?: string;
      ResponseCode?: string;
    };

    const responseCodeRaw = query.ResponseCode;
    const isSuccess = query.status === 'success' || (responseCodeRaw !== undefined && String(responseCodeRaw) === '0');
    const plan = normalizePaidPlan(query.plan) || 'pro_yearly';
    const isTest = query.test === '1' || isBillingTestMode();
    const returnHref = `/app?billing=${isSuccess ? 'success' : 'failed'}&plan=${encodeURIComponent(plan)}`;

    return reply
      .status(200)
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(renderHtmlShell(
        isSuccess ? 'השדרוג הושלם בהצלחה!' : 'התשלום לא הושלם',
        `${isTest ? '<div class="badge-test">מצב בדיקה - לא חויבת באמת</div>' : ''}
         <h1>${isSuccess ? 'שודרגת ל-Chef Pro! 👑' : 'התשלום לא הושלם ❌'}</h1>
         <p>${isSuccess
          ? 'המנוי שלך הופעל בהצלחה. אפשר לחזור מיד לספר המתכונים וליהנות מחילוצים ללא הגבלה.'
          : 'החיוב לא אושר ולא בוצע חיוב בחשבונך. באפשרותך לנסות שוב מתוך האפליקציה.'}</p>
         <a id="billing-return-btn" href="${escapeHtml(returnHref)}" class="btn btn-primary">חזרה לספר המתכונים 🍳</a>`
      ));
  });
}
