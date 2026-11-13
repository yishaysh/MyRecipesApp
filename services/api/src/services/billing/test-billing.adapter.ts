import crypto from 'node:crypto';
import {
  CheckoutSessionParams,
  CheckoutSessionResult,
  normalizePaidPlan,
  PaymentProviderAdapter,
  signBillingToken,
  VerifiedWebhookEvent,
  verifyBillingToken,
  verifyWebhookSignatureHex,
  WebhookVerifyInput,
} from './payment-provider.js';

export class WebhookSignatureError extends Error {
  public readonly statusCode = 401;
  constructor(message: string = 'Invalid webhook signature') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export interface TestCheckoutSessionPayload extends Record<string, unknown> {
  sessionId: string;
  userId: string;
  userEmail?: string;
  plan: 'pro_monthly' | 'pro_yearly';
  exp: number;
}

export class TestBillingAdapter implements PaymentProviderAdapter {
  public readonly providerName = 'test';

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const sessionId = `chk_test_${crypto.randomBytes(8).toString('hex')}`;
    const tokenPayload: TestCheckoutSessionPayload = {
      sessionId,
      userId: params.userId,
      userEmail: params.userEmail,
      plan: params.plan,
      exp: Date.now() + 60 * 60 * 1000,
    };
    const token = signBillingToken(tokenPayload);
    const origin = params.originUrl.replace(/\/+$/, '');
    const checkoutUrl = `${origin}/billing/test-checkout?session=${encodeURIComponent(token)}`;

    return {
      provider: this.providerName,
      testMode: true,
      checkoutUrl,
      sessionId,
      plan: params.plan,
    };
  }

  async verifyAndParseWebhook(input: WebhookVerifyInput): Promise<VerifiedWebhookEvent> {
    const body = input.body || {};
    const headerSigRaw = input.headers['x-billing-signature'];
    const headerSig = Array.isArray(headerSigRaw) ? headerSigRaw[0] : headerSigRaw;
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';

    let verifiedUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    let verifiedPlan = normalizePaidPlan(body.plan);
    let sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    let signatureValid = false;

    if (sessionToken) {
      const parsedToken = verifyBillingToken<TestCheckoutSessionPayload>(sessionToken);
      if (parsedToken && parsedToken.userId && parsedToken.plan) {
        signatureValid = true;
        verifiedUserId = parsedToken.userId;
        verifiedPlan = normalizePaidPlan(parsedToken.plan);
        sessionId = parsedToken.sessionId;
      }
    }

    const rawStatus = String(body.status || body.eventType || 'succeeded').trim().toLowerCase();
    const status: 'succeeded' | 'failed' | 'canceled' =
      rawStatus === 'failed' || rawStatus === 'payment_failed'
        ? 'failed'
        : rawStatus === 'canceled' || rawStatus === 'subscription_canceled'
          ? 'canceled'
          : 'succeeded';

    const eventId = typeof body.eventId === 'string' && body.eventId.trim()
      ? body.eventId.trim()
      : (sessionId ? `evt_test_${sessionId}_${status}` : '');

    if (!signatureValid && headerSig && verifiedUserId && verifiedPlan && eventId) {
      const canonicalTuple = `${eventId}:${verifiedUserId}:${verifiedPlan}:${status}`;
      const jsonMessage = JSON.stringify(body);
      signatureValid = verifyWebhookSignatureHex(canonicalTuple, headerSig)
        || verifyWebhookSignatureHex(jsonMessage, headerSig);
    }

    if (!signatureValid) {
      throw new WebhookSignatureError('Missing or invalid test billing webhook signature');
    }

    if (!verifiedUserId || !verifiedPlan || !eventId) {
      throw new Error('Missing required webhook fields (eventId, userId, plan)');
    }

    const eventType =
      status === 'failed'
        ? 'payment_failed'
        : status === 'canceled'
          ? 'subscription_canceled'
          : 'payment_succeeded';

    const recurringId = typeof body.providerRecurringId === 'string' && body.providerRecurringId.trim()
      ? body.providerRecurringId.trim()
      : `rec_test_${sessionId || crypto.createHash('sha1').update(verifiedUserId).digest('hex').slice(0, 12)}`;

    return {
      eventId,
      provider: this.providerName,
      eventType,
      status,
      userId: verifiedUserId,
      plan: verifiedPlan,
      providerRecurringId: recurringId,
      rawPayload: body,
    };
  }

  async cancelRecurring(_providerRecurringId: string): Promise<{ canceled: boolean }> {
    return { canceled: true };
  }
}
