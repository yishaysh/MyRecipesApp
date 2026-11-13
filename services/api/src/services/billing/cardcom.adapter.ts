import { EntitlementService, isBillingTestMode } from '../entitlement.service.js';
import {
  BILLING_PLAN_CONFIG,
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
import { WebhookSignatureError } from './test-billing.adapter.js';

interface CardcomReturnPayload extends Record<string, unknown> {
  userId: string;
  plan: 'pro_monthly' | 'pro_yearly';
  exp: number;
}

export class CardcomAdapter implements PaymentProviderAdapter {
  public readonly providerName = 'cardcom';

  private getConfig() {
    if (isBillingTestMode()) {
      throw new Error('CardcomAdapter must not run while BILLING_TEST_MODE is enabled');
    }

    const terminalNumber = (process.env.CARDCOM_TERMINAL_NUMBER || '').trim();
    const apiName = (process.env.CARDCOM_API_NAME || '').trim();
    const apiPassword = (process.env.CARDCOM_API_PASSWORD || '').trim();
    const webhookSecret = (process.env.CARDCOM_WEBHOOK_SECRET || process.env.BILLING_WEBHOOK_SECRET || '').trim();
    const baseUrl = (process.env.CARDCOM_BASE_URL || 'https://secure.cardcom.solutions/api/v11').replace(/\/+$/, '');

    if (!terminalNumber || !apiName) {
      throw new Error('Cardcom configuration incomplete: set CARDCOM_TERMINAL_NUMBER and CARDCOM_API_NAME');
    }

    if (!webhookSecret) {
      throw new Error('Cardcom configuration incomplete: set CARDCOM_WEBHOOK_SECRET (or BILLING_WEBHOOK_SECRET)');
    }

    return { terminalNumber, apiName, apiPassword, webhookSecret, baseUrl };
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { terminalNumber, apiName, apiPassword, baseUrl } = this.getConfig();
    const planCfg = BILLING_PLAN_CONFIG[params.plan];

    const returnToken = signBillingToken({
      userId: params.userId,
      plan: params.plan,
      exp: Date.now() + 2 * 60 * 60 * 1000,
    });

    const payload = {
      TerminalNumber: Number(terminalNumber) || terminalNumber,
      ApiName: apiName,
      ...(apiPassword ? { ApiPassword: apiPassword } : {}),
      Operation: 'ChargeAndCreateToken',
      Amount: planCfg.amountIls,
      ISOCoinId: 1, // ILS
      Language: 'he',
      ProductName: `My Recipe Book - ${planCfg.labelHe}`,
      SuccessRedirectUrl: params.successUrl,
      FailedRedirectUrl: params.failedUrl,
      WebHookUrl: params.webhookUrl,
      ReturnValue: returnToken,
      UIValues: {
        CardOwnerEmailValue: params.userEmail || '',
        CardOwnerNameValue: params.userName || '',
      },
      RecurringPayments: {
        IsRecurring: true,
        FrequencyMonths: params.plan === 'pro_yearly' ? 12 : 1,
        Sum: planCfg.amountIls,
      },
    };

    const res = await fetch(`${baseUrl}/LowProfile/Create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || Number(data.ResponseCode ?? -1) !== 0 || typeof data.Url !== 'string') {
      const desc = typeof data.Description === 'string' ? data.Description : `HTTP ${res.status}`;
      throw new Error(`Cardcom LowProfile/Create failed: ${desc}`);
    }

    return {
      provider: this.providerName,
      testMode: false,
      checkoutUrl: data.Url,
      sessionId: String(data.LowProfileId || ''),
      plan: params.plan,
    };
  }

  async verifyAndParseWebhook(input: WebhookVerifyInput): Promise<VerifiedWebhookEvent> {
    const { webhookSecret } = this.getConfig();
    const body = input.body || {};
    const headerSigRaw = input.headers['x-cardcom-signature'] || input.headers['x-billing-signature'];
    const headerSig = Array.isArray(headerSigRaw) ? headerSigRaw[0] : headerSigRaw;
    const returnToken = typeof body.ReturnValue === 'string' ? body.ReturnValue : '';
    const parsedReturn = returnToken ? verifyBillingToken<CardcomReturnPayload>(returnToken) : null;

    const sigMatchesHeader = headerSig
      ? verifyWebhookSignatureHex(JSON.stringify(body), headerSig, webhookSecret)
      : false;

    if (!parsedReturn && !sigMatchesHeader) {
      throw new WebhookSignatureError('Invalid Cardcom webhook signature');
    }

    const responseCode = Number(body.ResponseCode ?? body.responseCode ?? 0);
    const dealNumber = String(body.InternalDealNumber || body.LowProfileId || body.eventId || '');
    const recurringId = typeof body.RecurringId === 'string'
      ? body.RecurringId
      : (typeof body.AccountId === 'string' ? body.AccountId : null);

    let userId = parsedReturn?.userId || (typeof body.userId === 'string' ? body.userId : '');
    let plan = parsedReturn?.plan || normalizePaidPlan(body.plan);

    // Recurring renewal webhooks fired months later no longer carry a valid 2h ReturnValue token;
    // look up the active user/plan via stored providerRecurringId.
    if ((!userId || !plan) && recurringId) {
      const existingByRecurring = await EntitlementService.findEntitlementByRecurringId(recurringId);
      if (existingByRecurring) {
        if (!userId) userId = existingByRecurring.userId;
        if (!plan) plan = normalizePaidPlan(existingByRecurring.plan);
      }
    }

    if (!userId || !plan || !dealNumber) {
      throw new Error('Cardcom webhook missing required metadata (userId, plan, dealNumber)');
    }

    const succeeded = responseCode === 0 && body.status !== 'failed';
    const canceled = body.status === 'canceled' || body.Operation === 'RecurringCanceled';

    return {
      eventId: `cardcom_${dealNumber}_${canceled ? 'canceled' : succeeded ? 'succeeded' : 'failed'}`,
      provider: this.providerName,
      eventType: canceled
        ? 'subscription_canceled'
        : succeeded
          ? 'payment_succeeded'
          : 'payment_failed',
      status: canceled ? 'canceled' : succeeded ? 'succeeded' : 'failed',
      userId,
      plan,
      providerRecurringId: recurringId,
      rawPayload: body,
    };
  }

  async cancelRecurring(providerRecurringId: string): Promise<{ canceled: boolean }> {
    const { terminalNumber, apiName, apiPassword, baseUrl } = this.getConfig();
    if (!providerRecurringId) {
      return { canceled: true };
    }

    const res = await fetch(`${baseUrl}/RecurringOrders/Update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TerminalNumber: Number(terminalNumber) || terminalNumber,
        ApiName: apiName,
        ...(apiPassword ? { ApiPassword: apiPassword } : {}),
        RecurringId: providerRecurringId,
        IsActive: false,
      }),
    });

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || (data.ResponseCode !== undefined && Number(data.ResponseCode) !== 0)) {
      const desc = typeof data.Description === 'string' ? data.Description : `HTTP ${res.status}`;
      throw new Error(`Cardcom RecurringOrders cancel failed: ${desc}`);
    }

    return { canceled: true };
  }
}
