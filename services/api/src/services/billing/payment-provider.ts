import crypto from 'node:crypto';
import { EntitlementPlan, isBillingTestMode } from '../entitlement.service.js';
import { getJwtSecret } from '../guest-cookie.util.js';
import { TestBillingAdapter } from './test-billing.adapter.js';
import { CardcomAdapter } from './cardcom.adapter.js';

export type PaidBillingPlan = 'pro_monthly' | 'pro_yearly';

export interface BillingPlanConfig {
  plan: PaidBillingPlan;
  labelHe: string;
  amountIls: number;
  interval: 'month' | 'year';
}

export const BILLING_PLAN_CONFIG: Record<PaidBillingPlan, BillingPlanConfig> = {
  pro_monthly: {
    plan: 'pro_monthly',
    labelHe: 'מנוי חודשי גמיש',
    amountIls: 19.9,
    interval: 'month',
  },
  pro_yearly: {
    plan: 'pro_yearly',
    labelHe: 'מנוי שנתי - Chef Pro',
    amountIls: 149.9,
    interval: 'year',
  },
};

export function normalizePaidPlan(rawPlan: unknown): PaidBillingPlan | null {
  const val = String(rawPlan || '').trim().toLowerCase();
  if (val === 'pro_monthly' || val === 'monthly') return 'pro_monthly';
  if (val === 'pro_yearly' || val === 'pro_annual' || val === 'yearly' || val === 'annual') return 'pro_yearly';
  return null;
}

export interface CheckoutSessionParams {
  userId: string;
  userEmail?: string;
  userName?: string;
  plan: PaidBillingPlan;
  originUrl: string;
  successUrl: string;
  failedUrl: string;
  webhookUrl: string;
}

export interface CheckoutSessionResult {
  provider: string;
  testMode: boolean;
  checkoutUrl: string;
  sessionId: string;
  plan: EntitlementPlan;
}

export interface WebhookVerifyInput {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  query: Record<string, string | string[] | undefined>;
}

export interface VerifiedWebhookEvent {
  eventId: string;
  provider: string;
  eventType: 'payment_succeeded' | 'payment_failed' | 'subscription_canceled' | 'subscription_renewed';
  status: 'succeeded' | 'failed' | 'canceled';
  userId: string;
  plan: PaidBillingPlan;
  providerRecurringId?: string | null;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  readonly providerName: string;
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyAndParseWebhook(input: WebhookVerifyInput): Promise<VerifiedWebhookEvent>;
  cancelRecurring(providerRecurringId: string): Promise<{ canceled: boolean }>;
}

export function getWebhookSigningSecret(): string {
  return process.env.BILLING_WEBHOOK_SECRET?.trim()
    || process.env.CARDCOM_WEBHOOK_SECRET?.trim()
    || getJwtSecret();
}

export function signBillingToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getWebhookSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyBillingToken<T extends Record<string, unknown>>(token: string): T | null {
  try {
    const [encoded, providedSig] = String(token || '').split('.');
    if (!encoded || !providedSig) return null;

    const expectedSig = crypto
      .createHmac('sha256', getWebhookSigningSecret())
      .update(encoded)
      .digest('base64url');

    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function computeWebhookSignature(rawMessage: string, secretOverride?: string): string {
  return crypto
    .createHmac('sha256', secretOverride || getWebhookSigningSecret())
    .update(rawMessage)
    .digest('hex');
}

export function verifyWebhookSignatureHex(rawMessage: string, providedHex: string | undefined, secretOverride?: string): boolean {
  if (!providedHex || typeof providedHex !== 'string') return false;
  const expected = computeWebhookSignature(rawMessage, secretOverride);
  const a = Buffer.from(providedHex.trim().toLowerCase(), 'utf8');
  const b = Buffer.from(expected.toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getPaymentProvider(): PaymentProviderAdapter {
  if (isBillingTestMode()) {
    return new TestBillingAdapter();
  }

  const provider = (process.env.BILLING_PROVIDER || 'cardcom').trim().toLowerCase();
  if (provider === 'cardcom') {
    return new CardcomAdapter();
  }

  throw new Error(`Unsupported BILLING_PROVIDER "${provider}". Configure "cardcom" or add an adapter implementing PaymentProviderAdapter.`);
}
