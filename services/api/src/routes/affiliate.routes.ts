import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  buildMerchantBulkHandoffUrl,
  buildMerchantSearchUrl,
  BULK_HANDOFF_QUERY_LABEL,
  DEFAULT_REFERRAL_DISCLOSURE_TEXT,
  GrowthStoreError,
  GrowthStoreService,
  isBotOrPreviewUserAgent,
  isDomainAllowedForMerchant,
  isReferralsEnabled,
  MerchantRecord,
  QUANTITY_TRANSFER_NOTE_HE,
} from '../services/growth-store.service.js';
import { canonicalIngredientKey, MIN_MATCH_CONFIDENCE, normalizeIngredientForSearch } from '../shared/index.js';
import { AutoMapperService } from '../services/catalog/auto-mapper.service.js';

export interface StructuredBasketInputItem {
  id?: string;
  query: string;
  amount?: number | null;
  unit?: string | null;
  dietaryConstraints?: string[];
}

const DEFAULT_BASKET_EXCLUSIONS_NOTE_HE =
  'המחיר המשוער מבוסס על מארז מדף סטנדרטי לכל מצרך ואינו כולל דמי משלוח, מינימום הזמנה, הפרשי שקילה או מבצעי מועדון.';

function buildMerchantBasketSummary(
  merchant: MerchantRecord,
  comparison: any | null,
  fallbackTotalCount: number
) {
  const chainTotal = comparison?.chainTotals?.[merchant.id] as any;
  const matchedCount = typeof chainTotal?.matchedCount === 'number' ? chainTotal.matchedCount : 0;
  const totalCount =
    typeof chainTotal?.totalCount === 'number'
      ? chainTotal.totalCount
      : comparison
      ? fallbackTotalCount
      : 0;

  const computedMissingItems: string[] = Array.isArray(comparison?.items)
    ? comparison.items
        .filter((it: any) => !it?.matches?.[merchant.id])
        .map((it: any) => String(it?.query || it?.normalizedQuery || '').trim())
        .filter(Boolean)
    : [];

  const missingItems: string[] = Array.isArray(chainTotal?.missingItems)
    ? chainTotal.missingItems
    : computedMissingItems;

  const missingCount =
    typeof chainTotal?.missingCount === 'number'
      ? chainTotal.missingCount
      : comparison
      ? Math.max(0, totalCount - matchedCount, missingItems.length)
      : 0;

  const isCompleteBasket =
    typeof chainTotal?.isCompleteBasket === 'boolean'
      ? chainTotal.isCompleteBasket
      : Boolean(comparison && totalCount > 0 && matchedCount === totalCount && missingCount === 0);

  const exclusionsNote =
    typeof chainTotal?.exclusionsNote === 'string' && chainTotal.exclusionsNote.trim()
      ? chainTotal.exclusionsNote
      : typeof comparison?.exclusionsNote === 'string' && comparison.exclusionsNote.trim()
      ? comparison.exclusionsNote
      : missingCount > 0
      ? `המחיר המשוער אינו כולל ${missingCount} מצרכים שלא נמצאו במחירון הרשת, דמי משלוח, מינימום הזמנה או מבצעי מועדון.`
      : DEFAULT_BASKET_EXCLUSIONS_NOTE_HE;

  return {
    id: merchant.id,
    displayName: merchant.displayName,
    status: merchant.status,
    selectable: isMerchantSelectable(merchant),
    displayOrder: merchant.displayOrder,
    disclosureMode: merchant.status === 'affiliate_active' ? 'affiliate_active' : 'referral_only',
    disclosureText: getDisclosureTextForMerchant(merchant),
    entryUrl: merchant.entryUrl,
    handoffMode: merchant.handoffMode,
    menuPathHe: merchant.menuPathHe,
    instructionsStepsHe: merchant.instructionsStepsHe,
    separatorsSupported: merchant.separatorsSupported,
    quantityTransferNoteHe: merchant.quantityTransferNoteHe,
    verifiedAt: merchant.verifiedAt,
    estimatedTotal: comparison ? (chainTotal ? chainTotal.estimatedTotal : 0) : null,
    matchedCount,
    totalCount,
    missingCount,
    missingItems,
    isCompleteBasket,
    hasUnknownPackSize: Boolean(chainTotal?.hasUnknownPackSize),
    exclusionsNote,
    isCheapest: chainTotal ? Boolean(chainTotal.isCheapest) : false,
  };
}

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

      const rawIngredientList = ingredients
        ? ingredients
            .split(',')
            .map((s) => normalizeIngredientForSearch(s))
            .filter(Boolean)
        : [];

      const filterSet = rawIngredientList.length > 0
        ? new Set(rawIngredientList.map((s) => s.toLowerCase()))
        : null;

      const filteredMappings = filterSet
        ? allMappings.filter((m) => filterSet.has(m.normalizedName.toLowerCase()))
        : allMappings;

      const comparison =
        rawIngredientList.length > 0
          ? await AutoMapperService.compareBasketAcrossChains(rawIngredientList, allMappings)
          : null;

      return reply.send({
        referralsEnabled,
        defaultDisclosureText: DEFAULT_REFERRAL_DISCLOSURE_TEXT,
        quantityTransferNoteHe: QUANTITY_TRANSFER_NOTE_HE,
        exclusionsNote: (comparison as any)?.exclusionsNote || DEFAULT_BASKET_EXCLUSIONS_NOTE_HE,
        merchants: allMerchants.map((m) =>
          buildMerchantBasketSummary(m, comparison, rawIngredientList.length)
        ),
        mappings: filteredMappings.map((mp) => ({
          id: mp.id,
          normalizedName: mp.normalizedName,
          merchantId: mp.merchantId,
          sku: mp.sku,
          productName: mp.productName,
          verifiedAt: mp.verifiedAt,
        })),
        basketItems: comparison ? comparison.items : [],
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // POST /api/public/basket-compare - Compare a full list of ingredients across all supported supermarket chains
  fastify.post('/api/public/basket-compare', async (request, reply) => {
    const body = (request.body || {}) as {
      items?: Array<
        | string
        | {
            id?: string;
            query?: string;
            name?: string;
            amount?: number | null;
            unit?: string | null;
            dietaryConstraints?: string[];
          }
      >;
      queries?: string[];
      ingredients?: string[];
    };
    try {
      const referralsEnabled = isReferralsEnabled();
      const allMerchants = await GrowthStoreService.listMerchants();

      const hasStructuredItems = Array.isArray(body.items) && body.items.length > 0;
      const structuredItems: StructuredBasketInputItem[] = hasStructuredItems
        ? body.items!
            .slice(0, 40)
            .map((entry) => {
              if (typeof entry === 'string') {
                const q = normalizeIngredientForSearch(entry) || entry.trim();
                return { id: canonicalIngredientKey(q), query: q, amount: null, unit: null, dietaryConstraints: [] };
              }
              const rawQ = String(entry?.query ?? entry?.name ?? '').trim();
              const q = normalizeIngredientForSearch(rawQ) || rawQ;
              const itemId = entry?.id ? String(entry.id).trim() : canonicalIngredientKey(q);
              return {
                id: itemId,
                query: q,
                amount: typeof entry?.amount === 'number' && Number.isFinite(entry.amount) ? entry.amount : null,
                unit: typeof entry?.unit === 'string' && entry.unit.trim() ? entry.unit.trim() : null,
                dietaryConstraints: Array.isArray(entry?.dietaryConstraints)
                  ? entry.dietaryConstraints.map((c) => String(c || '').trim()).filter(Boolean)
                  : [],
              };
            })
            .filter((it) => Boolean(it.query))
        : [];

      const rawList = (
        hasStructuredItems
          ? structuredItems.map((it) => it.query)
          : Array.isArray(body.queries)
          ? body.queries
          : Array.isArray(body.ingredients)
          ? body.ingredients
          : []
      ).slice(0, 40);

      const cleanQueries = rawList
        .map((q) => normalizeIngredientForSearch(String(q || '')) || String(q || '').trim())
        .filter(Boolean);

      const allMappings = await GrowthStoreService.listIngredientMappings(true);
      const comparison = await AutoMapperService.compareBasketAcrossChains(
        hasStructuredItems ? structuredItems : cleanQueries,
        allMappings
      );

      // Enrich returned items with structured metadata and canonical itemId
      const enrichedItems = Array.isArray(comparison?.items)
        ? comparison.items.map((item: any, idx: number) => {
            const matchingStructured =
              (item.itemId ? structuredItems.find((s) => s.id === item.itemId) : null) ||
              structuredItems.find((s) => s.query === item.query) ||
              structuredItems[idx];
            if (!matchingStructured) return item;
            return {
              ...item,
              itemId: item.itemId || matchingStructured.id || canonicalIngredientKey(item.query),
              amount: item.amount !== undefined ? item.amount : matchingStructured.amount ?? null,
              unit: item.unit !== undefined ? item.unit : matchingStructured.unit ?? null,
              dietaryConstraints:
                item.dietaryConstraints !== undefined
                  ? item.dietaryConstraints
                  : matchingStructured.dietaryConstraints ?? [],
            };
          })
        : [];

      const enrichedComparison = {
        ...comparison,
        items: enrichedItems,
      };

      return reply.send({
        referralsEnabled,
        minMatchConfidence: MIN_MATCH_CONFIDENCE,
        defaultDisclosureText: DEFAULT_REFERRAL_DISCLOSURE_TEXT,
        quantityTransferNoteHe: QUANTITY_TRANSFER_NOTE_HE,
        exclusionsNote: (comparison as any)?.exclusionsNote || DEFAULT_BASKET_EXCLUSIONS_NOTE_HE,
        merchants: allMerchants.map((m) => {
          const summary = buildMerchantBasketSummary(m, enrichedComparison, cleanQueries.length);
          return {
            ...summary,
            estimatedTotal: summary.estimatedTotal ?? 0,
          };
        }),
        items: enrichedItems,
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // POST /api/affiliate-links - Server-side allowlisted store link builder returning opaque redirect token
  fastify.post('/api/affiliate-links', async (request, reply) => {
    const body = (request.body || {}) as {
      merchantId?: string;
      mode?: 'bulk_handoff' | 'item_search';
      query?: string;
      productName?: string;
      sku?: string;
      itemCount?: number;
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

      const mode: 'bulk_handoff' | 'item_search' =
        body.mode === 'bulk_handoff' ? 'bulk_handoff' : 'item_search';

      if (!body.merchantId || (mode === 'item_search' && !body.query)) {
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

      let normalizedQuery: string;
      let destinationUrl: string;

      if (mode === 'bulk_handoff') {
        // Privacy requirement: never store or transmit the full ingredient list in URLs or analytics payloads
        normalizedQuery = BULK_HANDOFF_QUERY_LABEL;
        destinationUrl = buildMerchantBulkHandoffUrl(merchant);
      } else {
        normalizedQuery = normalizeIngredientForSearch(body.query || '');
        const effectiveSearchTerm =
          body.productName && String(body.productName).trim()
            ? String(body.productName).trim()
            : normalizedQuery;
        destinationUrl = buildMerchantSearchUrl(merchant, effectiveSearchTerm);
      }

      const clickRecord = await GrowthStoreService.createClickToken({
        merchantId: merchant.id,
        normalizedQuery,
        destinationUrl,
        shareId: body.shareId ?? null,
        recipeId: body.recipeId ?? null,
        disclosureMode: merchant.status,
      });

      if (mode === 'bulk_handoff') {
        const isBot = isBotOrPreviewUserAgent(request.headers['user-agent']);
        const safeItemCount =
          typeof body.itemCount === 'number' && Number.isFinite(body.itemCount) && body.itemCount >= 0
            ? Math.min(500, Math.round(body.itemCount))
            : 0;
        if (!isBot) {
          try {
            await GrowthStoreService.recordAnalyticsEvent({
              eventName: 'merchant_bulk_handoff_created',
              merchantId: merchant.id,
              shareId: body.shareId ?? null,
              isBot: false,
              metadata: {
                mode: 'bulk_handoff',
                handoffMode: merchant.handoffMode,
                itemCount: safeItemCount,
                disclosureMode: merchant.status,
              },
            });
          } catch (analyticsErr: any) {
            console.warn(
              '[BULK_HANDOFF_ANALYTICS] analytics write failed:',
              analyticsErr?.message || analyticsErr
            );
          }
        }
      }

      return reply.status(201).send({
        clickToken: clickRecord.token,
        redirectUrl: `/api/go/${encodeURIComponent(clickRecord.token)}`,
        merchantId: merchant.id,
        mode,
        handoffMode: merchant.handoffMode,
        entryUrl: merchant.entryUrl,
        menuPathHe: merchant.menuPathHe,
        instructionsStepsHe: merchant.instructionsStepsHe,
        quantityTransferNoteHe: merchant.quantityTransferNoteHe,
        verifiedAt: merchant.verifiedAt,
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
      const safeDestinationUrl =
        merchant &&
        merchant.id === 'hazi_hinam' &&
        tokenRecord.destinationUrl.includes('/search?q=')
          ? buildMerchantBulkHandoffUrl(merchant)
          : tokenRecord.destinationUrl;

      if (!merchant || !isMerchantSelectable(merchant) || !isDomainAllowedForMerchant(merchant, safeDestinationUrl)) {
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
              mode:
                tokenRecord.normalizedQuery === BULK_HANDOFF_QUERY_LABEL
                  ? 'bulk_handoff'
                  : 'item_search',
              redirectServed: true,
              cartAdditionClaimed: false,
              conversionClaimed: false,
              disclosureMode: tokenRecord.disclosureMode,
              unmeasured: false,
            },
          });
        } catch (analyticsErr: any) {
          // Analytics logging failure MUST never block user navigation to the store.
          console.warn('[AFFILIATE_REDIRECT] unmeasured: true - analytics write failed:', analyticsErr?.message || analyticsErr);
        }
      }

      let finalRedirectUrl = safeDestinationUrl;
      try {
        const parsedDest = new URL(safeDestinationUrl);
        parsedDest.searchParams.set('click_id', clickId);
        finalRedirectUrl = parsedDest.toString();
      } catch {
        // Fallback to raw safeDestinationUrl
      }

      return reply
        .header('Referrer-Policy', 'no-referrer')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate')
        .redirect(finalRedirectUrl, 302);
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
