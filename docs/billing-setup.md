# Billing & Subscription Setup Guide (Payment Scaffolding)

This document explains how the payment, quota, and subscription entitlement layer in **My Recipe Book (ספר המתכונים שלי)** is structured and how to connect a live Israeli payment provider (default: **Cardcom REST v11**) when moving from test mode to production.

---

## 1. Architecture Overview

- **Persistent Entitlement Store (`services/api/src/services/entitlement.service.ts`)**
  - Stores each user's subscription state in Postgres (`user_entitlements`) with an in-memory fallback when `DATABASE_URL` is unset.
  - Plans: `free`, `pro_monthly` (₪19.90 / month), `pro_yearly` (₪149.90 / year), `pro_vip` (lifetime VIP via code or whitelist).
  - Statuses: `active`, `canceled` (access stays active until `renewsAt`), `expired`.
  - Sources: `billing` (paid provider subscription) or `vip` (promo code / VIP email whitelist / admin grant).
  - Deduplicates webhooks idempotently using `billing_events.event_id` (`onConflictDoNothing` in Postgres + Map fallback).

- **Provider Abstraction (`services/api/src/services/billing/payment-provider.ts`)**
  - `PaymentProviderAdapter` defines three operations:
    1. `createCheckoutSession(params)`
    2. `verifyAndParseWebhook(input)`
    3. `cancelRecurring(providerRecurringId)`
  - When `BILLING_TEST_MODE` is enabled (default unless set to `'0'` or `'false'`), `getPaymentProvider()` returns **`TestBillingAdapter`**.
  - When `BILLING_TEST_MODE=0` (or `'false'`), `getPaymentProvider()` selects the adapter specified by `BILLING_PROVIDER` (currently `'cardcom'` -> **`CardcomAdapter`**).

- **Guest Quota Persistence (`services/api/src/services/guest-cookie.util.ts`)**
  - Issues an HMAC-SHA256 signed `HttpOnly` cookie (`myrecipes_guest_id`) on guest login, recipe extraction, and checkout.
  - Prevents bypassing the 5-recipe monthly free quota simply by clearing `localStorage`.
  - Quota exhaustion returns HTTP **`402 Payment Required`** (`error: 'QUOTA_EXCEEDED'`).

---

## 2. Billing Endpoints & Pages

| Endpoint / Route | Method | Purpose |
|---|---|---|
| `/api/v1/billing/entitlement` | `GET` | Authoritative entitlement + monthly quota state for the current user |
| `/api/v1/billing/checkout` | `POST` | Starts a checkout session (`plan`: `pro_monthly` \| `pro_yearly`) |
| `/api/v1/billing/webhook` | `POST` | Verifies provider/test webhook signature, enforces idempotency, updates `user_entitlements` |
| `/api/v1/billing/cancel` | `POST` | Cancels recurring billing while preserving Pro access until `renewsAt` (rejects `vip` users with `400 VIP_NOT_CANCELABLE`) |
| `/billing/test-checkout` | `GET` | Simulated checkout UI when `BILLING_TEST_MODE=1` (explicitly displays `"מצב בדיקה - לא חויבת באמת"`) |
| `/billing/return` | `GET` | Post-payment landing page that redirects back to `/app?billing=success\|failed&plan=...` |

---

## 3. Environment Variables

Copy `.env.example` to `.env` (local) or configure the variables below in Vercel Project Settings:

```env
BILLING_TEST_MODE=1
BILLING_PROVIDER=cardcom
BILLING_WEBHOOK_SECRET=<strong-random-secret>

# Required only when BILLING_TEST_MODE=0
CARDCOM_TERMINAL_NUMBER=<your-cardcom-terminal-number>
CARDCOM_API_NAME=<your-cardcom-api-name>
CARDCOM_API_PASSWORD=<optional-cardcom-api-password>
CARDCOM_WEBHOOK_SECRET=<your-cardcom-webhook-secret>
CARDCOM_BASE_URL=https://secure.cardcom.solutions/api/v11
PUBLIC_BASE_URL=https://your-domain.vercel.app
```

> **Safety Default:** If `BILLING_TEST_MODE` is omitted, empty, or `'1'`, `isBillingTestMode()` returns `true` and `CardcomAdapter` refuses to execute live charges.

---

## 4. Going Live with Cardcom (REST v11)

1. **Create / verify Cardcom merchant credentials**: obtain `TerminalNumber` and `ApiName` (and `ApiPassword` if enabled) with recurring payments (`RecurringPayments` + `ChargeAndCreateToken`) activated on your Cardcom account.
2. **Apply database schema**: run `npm run db:push --workspace=@myrecipes/api` (or allow runtime `EntitlementService.ensureTables()` to initialize `user_entitlements` and `billing_events` on first request).
3. **Verify return & webhook URLs**:
   - Success redirect: `https://<domain>/billing/return?status=success&plan=<plan>`
   - Failure redirect: `https://<domain>/billing/return?status=failed&plan=<plan>`
   - Webhook URL: `https://<domain>/api/v1/billing/webhook` (Cardcom receives HMAC-signed `ReturnValue` metadata created by `CardcomAdapter.createCheckoutSession`).
4. **Set strong secrets**: configure non-default values for `JWT_SECRET`, `BILLING_WEBHOOK_SECRET`, and `CARDCOM_WEBHOOK_SECRET`.
5. **Switch out of test mode**: set `BILLING_TEST_MODE=0` in production environment variables and redeploy.

---

## 5. Switching to Another Provider (e.g., PayPlus)

1. Create `services/api/src/services/billing/payplus.adapter.ts` implementing `PaymentProviderAdapter`.
2. Verify webhook signatures in `verifyAndParseWebhook` and throw `WebhookSignatureError` (`401`) on invalid signatures.
3. Map provider event IDs deterministically so `EntitlementService.recordBillingEventOnce` deduplicates retries.
4. Register the new provider inside `getPaymentProvider()` in `services/api/src/services/billing/payment-provider.ts` when `BILLING_PROVIDER=payplus`.

---

## 6. Verification Checklist Before Switching `BILLING_TEST_MODE=0`

- [ ] `POST /api/v1/billing/checkout` returns a valid hosted payment URL in staging.
- [ ] `POST /api/v1/billing/webhook` rejects unsigned/tampered requests with `401`.
- [ ] Re-sending the same webhook `eventId` returns `200 { received: true, duplicate: true }` without extending `renewsAt` twice.
- [ ] Successful webhook updates `GET /api/v1/billing/entitlement` and grants unlimited recipe extractions.
- [ ] `POST /api/v1/billing/cancel` cancels recurring billing, sets `status: 'canceled'`, and preserves access until `renewsAt`.
- [ ] Redeemed VIP users (`source: 'vip'`) do **not** see a recurring billing cancel button in Profile and cannot hit live cancellation.

