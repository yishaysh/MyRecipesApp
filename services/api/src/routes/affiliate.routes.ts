import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  buildMerchantSearchUrl,
  DEFAULT_REFERRAL_DISCLOSURE_TEXT,
  GrowthStoreError,
  GrowthStoreService,
  isBotOrPreviewUserAgent,
  isDomainAllowedForMerchant,
  isReferralsEnabled,
  MerchantRecord,
} from '../services/growth-store.service.js';
import { normalizeIngredientForSearch } from '../shared/index.js';

function isMerchantSelectable(merchant: MerchantRecord): boolean {
  if (!isReferralsEnabled()) return false;
  if (merchant.killSwitch) return false;
  return merchant.status === 'referral_only' || merchant.status === 'affiliate_active';
}

function getDisclosureTextForMerchant(merchant: MerchantRecord): string {
  if (merchant.status === 'affiliate_active' && merchant.commercialAgreement?.disclosureText) {
    return merchant.commercialAgreement.disclosureText;
  }
  return DEFAULT_REFERRAL_DISCLOSURE_TEXT;
}

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof GrowthStoreError) {
    return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  }
  console.error('[AffiliateRouteError]', err);
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'אירעה שגיאה בשרת בעת ביצוע הפעולה. נסו שוב בעוד רגע.',
  });
}

function constantTimeHmacVerify(payload: string, signatureHeader: string, secret: string): boolean {
  try {
    const cleanSig = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex').toLowerCase();
    const a = Buffer.from(cleanSig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const affiliateRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/public/merchants - Public merchant list, status, disclosure, and dated SKU mappings
  fastify.get('/api/public/merchants', async (request, reply) => {
    const { ingredients } = (request.query || {}) as { ingredients?: string };
    try {
      const referralsEnabled = isReferralsEnabled();
      const allMerchants = await GrowthStoreService.listMerchants();
      const allMappings = await GrowthStoreService.listIngredientMappings(true);

      const filterSet = ingredients
        ? new Set(
            ingredients
              .split(',')
              .map((s) => normalizeIngredientForSearch(s).toLowerCase())
              .filter(Boolean)
          )
        : null;

      const filteredMappings = filterSet
        ? allMappings.filter((m) => filterSet.has(m.normalizedName.toLowerCase()))
        : allMappings;

      return reply.send({
        referralsEnabled,
        defaultDisclosureText: DEFAULT_REFERRAL_DISCLOSURE_TEXT,
        merchants: allMerchants.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          status: m.status,
          selectable: isMerchantSelectable(m),
          displayOrder: m.displayOrder,
          disclosureMode: m.status === 'affiliate_active' ? 'affiliate_active' : 'referral_only',
          disclosureText: getDisclosureTextForMerchant(m),
        })),
        mappings: filteredMappings.map((mp) => ({
          id: mp.id,
          normalizedName: mp.normalizedName,
          merchantId: mp.merchantId,
          sku: mp.sku,
          productName: mp.productName,
          verifiedAt: mp.verifiedAt,
        })),
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // POST /api/affiliate-links - Server-side allowlisted store link builder returning opaque redirect token
  fastify.post('/api/affiliate-links', async (request, reply) => {
    const body = (request.body || {}) as {
      merchantId?: string;
      query?: string;
      shareId?: string;
      recipeId?: string;
    };

    try {
      if (!isReferralsEnabled()) {
        return reply.status(403).send({
          error: 'REFERRALS_DISABLED',
          message: 'הקישורים לחנויות מושבתים זמנית',
        });
      }

      if (!body.merchantId || !body.query) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'חסרים פרטי חנות או מצרך לחיפוש',
        });
      }

      const merchant = await GrowthStoreService.getMerchantById(body.merchantId);
      if (!merchant) {
        return reply.status(404).send({ error: 'MERCHANT_NOT_FOUND', message: 'החנות לא נמצאה' });
      }
      if (!isMerchantSelectable(merchant)) {
        return reply.status(403).send({
          error: 'MERCHANT_DISABLED',
          message: 'החנות אינה פעילה כרגע',
        });
      }

      const normalizedQuery = normalizeIngredientForSearch(body.query);
      const destinationUrl = buildMerchantSearchUrl(merchant, normalizedQuery);
      const clickRecord = await GrowthStoreService.createClickToken({
        merchantId: merchant.id,
        normalizedQuery,
        destinationUrl,
        shareId: body.shareId ?? null,
        recipeId: body.recipeId ?? null,
        disclosureMode: merchant.status,
      });

      return reply.status(201).send({
        clickToken: clickRecord.token,
        redirectUrl: `/api/go/${encodeURIComponent(clickRecord.token)}`,
        merchantId: merchant.id,
        normalizedQuery,
        disclosureMode: merchant.status,
        disclosureText: getDisclosureTextForMerchant(merchant),
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Safe redirect handler shared by /api/go/:clickToken and /go/:clickToken
  const handleSafeRedirect = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clickToken } = request.params as { clickToken: string };
    try {
      const tokenRecord = await GrowthStoreService.getClickToken(clickToken);
      if (!tokenRecord) {
        await GrowthStoreService.recordAnalyticsEvent({
          eventName: 'affiliate_redirect_failed',
          metadata: { reason: 'unknown_token' },
        }).catch(() => {});
        return reply.status(404).send({ error: 'LINK_NOT_FOUND', message: 'הקישור לחנות לא נמצא' });
      }

      const merchant = await GrowthStoreService.getMerchantById(tokenRecord.merchantId);
      if (!merchant || !isMerchantSelectable(merchant) || !isDomainAllowedForMerchant(merchant, tokenRecord.destinationUrl)) {
        await GrowthStoreService.recordAnalyticsEvent({
          eventName: 'affiliate_redirect_failed',
          merchantId: tokenRecord.merchantId,
          metadata: { reason: 'merchant_disabled_or_disallowed_domain' },
        }).catch(() => {});
        return reply.status(403).send({
          error: 'REDIRECT_BLOCKED',
          message: 'הקישור לחנות אינו זמין כרגע',
        });
      }

      const isBot = isBotOrPreviewUserAgent(request.headers['user-agent']);
      const clickId = crypto.randomUUID();
      if (!isBot) {
        try {
          await GrowthStoreService.recordAnalyticsEvent({
            eventName: 'affiliate_redirect',
            merchantId: merchant.id,
            shareId: tokenRecord.shareId,
            clickId,
            isBot: false,
            metadata: {
              normalizedQuery: tokenRecord.normalizedQuery,
              disclosureMode: tokenRecord.disclosureMode,
              unmeasured: false,
            },
          });
        } catch (analyticsErr: any) {
          // Analytics logging failure MUST never block user navigation to the store.
          console.warn('[AFFILIATE_REDIRECT] unmeasured: true - analytics write failed:', analyticsErr?.message || analyticsErr);
        }
      }

      return reply
        .header('Referrer-Policy', 'no-referrer')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate')
        .redirect(tokenRecord.destinationUrl, 302);
    } catch (err) {
      return handleError(reply, err);
    }
  };

  fastify.get('/api/go/:clickToken', handleSafeRedirect);
  fastify.get('/go/:clickToken', handleSafeRedirect);

  // POST /api/affiliate/postback - HMAC + replay-protected conversion stub (501 until live agreement exists)
  fastify.post('/api/affiliate/postback', async (request, reply) => {
    const secret = process.env.AFFILIATE_POSTBACK_SECRET;
    if (!secret || secret.trim().length < 8) {
      return reply.status(501).send({
        configured: false,
        status: 'not_configured',
        message: 'Affiliate conversion postback is not configured (missing secret and no active commercial agreement).',
      });
    }

    const sigHeader = String(request.headers['x-affiliate-signature'] || '');
    const rawBody = JSON.stringify(request.body || {});
    if (!sigHeader || !constantTimeHmacVerify(rawBody, sigHeader, secret)) {
      return reply.status(401).send({
        error: 'INVALID_SIGNATURE',
        message: 'Invalid HMAC signature on affiliate postback',
      });
    }

    const body = (request.body || {}) as { partner?: string; order_id?: string; status?: string };
    const partner = String(body.partner || 'unknown');
    const orderId = String(body.order_id || '');
    const status = String(body.status || 'unknown');
    if (!orderId) {
      return reply.status(400).send({ error: 'MISSING_ORDER_ID', message: 'order_id is required' });
    }

    const isReplay = await GrowthStoreService.isConversionReplay(partner, orderId, status);
    if (isReplay) {
      return reply.status(409).send({
        error: 'DUPLICATE_POSTBACK',
        message: 'Postback already processed (replay protection)',
      });
    }

    return reply.status(501).send({
      configured: false,
      status: 'not_configured',
      message: 'Affiliate conversion postback is not configured (no active commercial agreement).',
    });
  });
};
