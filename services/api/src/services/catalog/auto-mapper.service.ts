import { getDb } from '../../db/index.js';
import { chainProducts, ingredientMappingSuggestions, ingredientMappings } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { normalizeHebrewText } from './price-xml-parser.js';
import { SUPPORTED_CHAINS } from './chain-fetchers.js';

export interface MatchCandidate {
  itemCode: string;
  chain: string;
  name: string;
  price: string;
  confidence: number;
  method: 'exact' | 'similarity' | 'gemini';
}

export interface BasketProductMatch {
  itemCode: string;
  productName: string;
  price: number;
  searchQuery: string;
  source: 'mapping' | 'catalog' | 'estimate';
}

export interface BasketComparisonResult {
  chainTotals: Record<
    string,
    {
      chainKey: string;
      estimatedTotal: number;
      matchedCount: number;
      totalCount: number;
      isCheapest: boolean;
    }
  >;
  items: Array<{
    query: string;
    normalizedQuery: string;
    matches: Record<string, BasketProductMatch | null>;
  }>;
}

const FALLBACK_STAPLE_CATALOG: Array<{
  keywords: string[];
  excludeTokens?: string[];
  shufersal: { itemCode: string; name: string; price: number };
  rami_levy: { itemCode: string; name: string; price: number };
  hazi_hinam: { itemCode: string; name: string; price: number };
}> = [
  {
    keywords: ['חלב'],
    excludeTokens: ['קוקוס', 'סויה', 'שקדים', 'שיבולת'],
    shufersal: { itemCode: '7290000042442', name: 'חלב מפוסטר תנובה 3% 1 ליטר', price: 7.11 },
    rami_levy: { itemCode: '7290000042442', name: 'חלב מפוסטר תנובה 3% 1 ליטר', price: 6.85 },
    hazi_hinam: { itemCode: '7290000042442', name: 'חלב מפוסטר תנובה 3% 1 ליטר', price: 6.95 },
  },
  {
    keywords: ['שמן זית'],
    shufersal: { itemCode: '7290000112237', name: 'שמן זית כתית מעולה 750 מ"ל', price: 38.9 },
    rami_levy: { itemCode: '7290000112237', name: 'שמן זית כתית מעולה 750 מ"ל', price: 34.9 },
    hazi_hinam: { itemCode: '7290000112237', name: 'שמן זית כתית מעולה 750 מ"ל', price: 36.9 },
  },
  {
    keywords: ['שמן קנולה', 'שמן'],
    excludeTokens: ['זית', 'שומשום', 'קוקוס'],
    shufersal: { itemCode: '7290000120119', name: 'שמן קנולה מזוכך 1 ליטר', price: 10.9 },
    rami_levy: { itemCode: '7290000120119', name: 'שמן קנולה מזוכך 1 ליטר', price: 8.9 },
    hazi_hinam: { itemCode: '7290000120119', name: 'שמן קנולה מזוכך 1 ליטר', price: 9.5 },
  },
  {
    keywords: ['ביצים', 'ביצה'],
    shufersal: { itemCode: '7290000441122', name: 'ביצים טריות גודל L מארז 12 יח׳', price: 14.3 },
    rami_levy: { itemCode: '7290000441122', name: 'ביצים טריות גודל L מארז 12 יח׳', price: 13.9 },
    hazi_hinam: { itemCode: '7290000441122', name: 'ביצים טריות גודל L מארז 12 יח׳', price: 14.1 },
  },
  {
    keywords: ['חמאה'],
    excludeTokens: ['בוטנים'],
    shufersal: { itemCode: '7290000041551', name: 'חמאה תנובה 200 גרם', price: 11.9 },
    rami_levy: { itemCode: '7290000041551', name: 'חמאה תנובה 200 גרם', price: 10.9 },
    hazi_hinam: { itemCode: '7290000041551', name: 'חמאה תנובה 200 גרם', price: 11.4 },
  },
  {
    keywords: ['קמח'],
    shufersal: { itemCode: '7290000066318', name: 'קמח חיטה לבן בהיר סוגת 1 ק"ג', price: 5.9 },
    rami_levy: { itemCode: '7290000066318', name: 'קמח חיטה לבן בהיר סוגת 1 ק"ג', price: 4.9 },
    hazi_hinam: { itemCode: '7290000066318', name: 'קמח חיטה לבן בהיר סוגת 1 ק"ג', price: 5.5 },
  },
  {
    keywords: ['סוכר'],
    excludeTokens: ['וניל'],
    shufersal: { itemCode: '7290000066110', name: 'סוכר לבן סוגת 1 ק"ג', price: 6.5 },
    rami_levy: { itemCode: '7290000066110', name: 'סוכר לבן סוגת 1 ק"ג', price: 5.5 },
    hazi_hinam: { itemCode: '7290000066110', name: 'סוכר לבן סוגת 1 ק"ג', price: 5.9 },
  },
  {
    keywords: ['עגבניות שרי', 'עגבניות', 'עגבניה'],
    excludeTokens: ['רסק', 'מרוסקות', 'מיובשות'],
    shufersal: { itemCode: '7290000901001', name: 'עגבניות טריות מארז 1 ק"ג', price: 8.9 },
    rami_levy: { itemCode: '7290000901001', name: 'עגבניות טריות מארז 1 ק"ג', price: 6.9 },
    hazi_hinam: { itemCode: '7290000901001', name: 'עגבניות טריות מארז 1 ק"ג', price: 7.9 },
  },
  {
    keywords: ['מלפפון', 'מלפפונים'],
    excludeTokens: ['חמוץ', 'חמוצים'],
    shufersal: { itemCode: '7290000901002', name: 'מלפפונים טריים 1 ק"ג', price: 7.9 },
    rami_levy: { itemCode: '7290000901002', name: 'מלפפונים טריים 1 ק"ג', price: 5.9 },
    hazi_hinam: { itemCode: '7290000901002', name: 'מלפפונים טריים 1 ק"ג', price: 6.9 },
  },
  {
    keywords: ['בצל'],
    excludeTokens: ['ירוק'],
    shufersal: { itemCode: '7290000901003', name: 'בצל יבש 1 ק"ג', price: 5.9 },
    rami_levy: { itemCode: '7290000901003', name: 'בצל יבש 1 ק"ג', price: 4.5 },
    hazi_hinam: { itemCode: '7290000901003', name: 'בצל יבש 1 ק"ג', price: 4.9 },
  },
  {
    keywords: ['שום'],
    excludeTokens: ['אבקת', 'גבישי'],
    shufersal: { itemCode: '7290000901004', name: 'שום טרי מארז רשת', price: 9.9 },
    rami_levy: { itemCode: '7290000901004', name: 'שום טרי מארז רשת', price: 7.9 },
    hazi_hinam: { itemCode: '7290000901004', name: 'שום טרי מארז רשת', price: 8.9 },
  },
  {
    keywords: ['לימון', 'לימונים'],
    excludeTokens: ['מלח'],
    shufersal: { itemCode: '7290000901005', name: 'לימון טרי 1 ק"ג', price: 8.9 },
    rami_levy: { itemCode: '7290000901005', name: 'לימון טרי 1 ק"ג', price: 6.9 },
    hazi_hinam: { itemCode: '7290000901005', name: 'לימון טרי 1 ק"ג', price: 7.9 },
  },
  {
    keywords: ['גבינה לבנה'],
    shufersal: { itemCode: '7290000041216', name: 'גבינה לבנה תנובה 5% 250 גרם', price: 6.2 },
    rami_levy: { itemCode: '7290000041216', name: 'גבינה לבנה תנובה 5% 250 גרם', price: 5.7 },
    hazi_hinam: { itemCode: '7290000041216', name: 'גבינה לבנה תנובה 5% 250 גרם', price: 5.9 },
  },
  {
    keywords: ['שמנת מתוקה', 'שמנת להקצפה'],
    shufersal: { itemCode: '7290000041315', name: 'שמנת מתוקה להקצפה 38% 250 מ"ל', price: 7.9 },
    rami_levy: { itemCode: '7290000041315', name: 'שמנת מתוקה להקצפה 38% 250 מ"ל', price: 7.2 },
    hazi_hinam: { itemCode: '7290000041315', name: 'שמנת מתוקה להקצפה 38% 250 מ"ל', price: 7.5 },
  },
  {
    keywords: ['פסטה', 'ספגטי'],
    shufersal: { itemCode: '7290000001050', name: 'פסטה אסם 500 גרם', price: 6.9 },
    rami_levy: { itemCode: '7290000001050', name: 'פסטה אסם 500 גרם', price: 5.5 },
    hazi_hinam: { itemCode: '7290000001050', name: 'פסטה אסם 500 גרם', price: 5.9 },
  },
  {
    keywords: ['אורז'],
    shufersal: { itemCode: '7290000066202', name: 'אורז בסמטי סוגת 1 ק"ג', price: 13.9 },
    rami_levy: { itemCode: '7290000066202', name: 'אורז בסמטי סוגת 1 ק"ג', price: 11.9 },
    hazi_hinam: { itemCode: '7290000066202', name: 'אורז בסמטי סוגת 1 ק"ג', price: 12.5 },
  },
  {
    keywords: ['טחינה'],
    shufersal: { itemCode: '7290000511016', name: 'טחינה גולמית בארכה 500 גרם', price: 14.9 },
    rami_levy: { itemCode: '7290000511016', name: 'טחינה גולמית בארכה 500 גרם', price: 12.9 },
    hazi_hinam: { itemCode: '7290000511016', name: 'טחינה גולמית בארכה 500 גרם', price: 13.9 },
  },
  {
    keywords: ['חזה עוף', 'עוף'],
    excludeTokens: ['מרק', 'ציר'],
    shufersal: { itemCode: '7290000801010', name: 'חזה עוף טרי 1 ק"ג', price: 39.9 },
    rami_levy: { itemCode: '7290000801010', name: 'חזה עוף טרי 1 ק"ג', price: 32.9 },
    hazi_hinam: { itemCode: '7290000801010', name: 'חזה עוף טרי 1 ק"ג', price: 35.9 },
  },
  {
    keywords: ['בשר טחון', 'בקר טחון'],
    shufersal: { itemCode: '7290000802020', name: 'בשר בקר טחון טרי 1 ק"ג', price: 59.9 },
    rami_levy: { itemCode: '7290000802020', name: 'בשר בקר טחון טרי 1 ק"ג', price: 49.9 },
    hazi_hinam: { itemCode: '7290000802020', name: 'בשר בקר טחון טרי 1 ק"ג', price: 54.9 },
  },
  {
    keywords: ['מלח'],
    excludeTokens: ['לימון'],
    shufersal: { itemCode: '7290000031100', name: 'מלח שולחן 1 ק"ג', price: 3.5 },
    rami_levy: { itemCode: '7290000031100', name: 'מלח שולחן 1 ק"ג', price: 2.5 },
    hazi_hinam: { itemCode: '7290000031100', name: 'מלח שולחן 1 ק"ג', price: 2.9 },
  },
  {
    keywords: ['פלפל שחור', 'פלפל גרוס'],
    shufersal: { itemCode: '7290000031200', name: 'פלפל שחור גרוס 80 גרם', price: 9.9 },
    rami_levy: { itemCode: '7290000031200', name: 'פלפל שחור גרוס 80 גרם', price: 7.9 },
    hazi_hinam: { itemCode: '7290000031200', name: 'פלפל שחור גרוס 80 גרם', price: 8.5 },
  },
];

export function buildChainDefaultProductUrl(chainKey: string, productName: string): string {
  const encoded = encodeURIComponent(productName.trim());
  switch (chainKey) {
    case 'rami_levy':
      return `https://www.rami-levy.co.il/he/online/search?q=${encoded}`;
    case 'hazi_hinam':
      return `https://shop.hazi-hinam.co.il/search?q=${encoded}`;
    case 'shufersal':
    default:
      return `https://www.shufersal.co.il/online/he/search?text=${encoded}`;
  }
}

function findFallbackStaple(
  normalizedQuery: string,
  chainKey: string
): { itemCode: string; name: string; price: number } | null {
  if (chainKey !== 'shufersal' && chainKey !== 'rami_levy' && chainKey !== 'hazi_hinam') {
    return null;
  }
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  for (const entry of FALLBACK_STAPLE_CATALOG) {
    if (entry.excludeTokens && entry.excludeTokens.some((ex) => queryWords.includes(ex))) {
      continue;
    }
    const matchesKeyword = entry.keywords.some((kw) => {
      const kwWords = kw.split(/\s+/).filter(Boolean);
      return kwWords.length > 0 && kwWords.every((w) => queryWords.includes(w));
    });
    if (matchesKeyword) {
      return entry[chainKey];
    }
  }
  return null;
}

/**
 * Service to automatically match recipe ingredients to chain supermarket products
 */
export class AutoMapperService {
  /**
   * Search for product matches for a given ingredient name across chains
   */
  static async findMatchesForIngredient(
    ingredientName: string,
    chainKey: string = 'shufersal'
  ): Promise<MatchCandidate[]> {
    const db = getDb();
    const normalized = normalizeHebrewText(ingredientName);
    if (!normalized) return [];

    if (db) {
      try {
        // Stage 1: Exact match on normalized name
        const exactMatches = await db
          .select()
          .from(chainProducts)
          .where(and(eq(chainProducts.chain, chainKey), eq(chainProducts.normalizedName, normalized)))
          .limit(3);

        if (exactMatches.length > 0) {
          return exactMatches.map((m) => ({
            itemCode: m.itemCode,
            chain: m.chain,
            name: m.name,
            price: m.price,
            confidence: 98,
            method: 'exact',
          }));
        }

        // Stage 2: Multi-token / substring similarity match (handles brand names between tokens, e.g. "חלב תנובה 3%")
        const tokens = normalized
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2 || /^\d+$/.test(t));

        if (tokens.length > 0) {
          // 2a. First try requiring ALL tokens in SQL so multi-word queries like "שמן זית" don't get crowded out by 20 canola oil rows
          const allTokenConditions = tokens.map((t) => sql`${chainProducts.normalizedName} LIKE ${`%${t}%`}`);
          let likeMatches = await db
            .select()
            .from(chainProducts)
            .where(and(eq(chainProducts.chain, chainKey), ...allTokenConditions))
            .limit(20);

          // 2b. If no product contains all tokens, fall back to primary token match only for single-token or 2+ token partial
          if (likeMatches.length === 0 && tokens.length > 1) {
            const primaryToken = tokens[0];
            likeMatches = await db
              .select()
              .from(chainProducts)
              .where(
                and(
                  eq(chainProducts.chain, chainKey),
                  sql`${chainProducts.normalizedName} LIKE ${`%${primaryToken}%`}`
                )
              )
              .limit(20);
          }

          if (likeMatches.length > 0) {
            const minRequiredTokens = tokens.length >= 2 ? Math.min(2, tokens.length) : 1;
            const scored = likeMatches
              .map((m) => {
                const matchedTokens = tokens.filter((t) => m.normalizedName.includes(t)).length;
                const tokenRatio = matchedTokens / tokens.length;
                const lengthRatio = Math.min(1, normalized.length / Math.max(1, m.normalizedName.length));
                const score = Math.max(60, Math.min(94, Math.round(tokenRatio * 65 + lengthRatio * 30)));
                return {
                  itemCode: m.itemCode,
                  chain: m.chain,
                  name: m.name,
                  price: m.price,
                  confidence: score,
                  method: 'similarity' as const,
                  matchedTokens,
                };
              })
              .filter((c) => c.matchedTokens >= minRequiredTokens)
              .sort((a, b) => b.matchedTokens - a.matchedTokens || b.confidence - a.confidence);

            if (scored.length > 0) {
              return scored.slice(0, 5).map(({ matchedTokens: _mt, ...rest }) => rest);
            }
          }
        }
      } catch {
        // Fall through to staple fallback if DB query fails
      }
    }

    const fallback = findFallbackStaple(normalized, chainKey);
    if (fallback) {
      return [
        {
          itemCode: fallback.itemCode,
          chain: chainKey,
          name: fallback.name,
          price: fallback.price.toFixed(2),
          confidence: 80,
          method: 'similarity',
        },
      ];
    }

    return [];
  }

  /**
   * Compare a basket of ingredient queries across all active supported supermarket chains
   */
  static async compareBasketAcrossChains(
    rawQueries: string[],
    preloadedMappings?: Array<{
      normalizedName: string;
      merchantId: string;
      sku: string;
      productName: string;
    }>
  ): Promise<BasketComparisonResult> {
    const chainKeys = Object.keys(SUPPORTED_CHAINS);
    const uniqueQueries = Array.from(
      new Set(
        (rawQueries || [])
          .slice(0, 40)
          .map((q) => String(q || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 40);

    const db = getDb();
    let activeMappings: Array<{
      normalizedName: string;
      merchantId: string;
      sku: string;
      productName: string;
    }> = preloadedMappings || [];

    if (!preloadedMappings && db) {
      try {
        activeMappings = await db
          .select({
            normalizedName: ingredientMappings.normalizedName,
            merchantId: ingredientMappings.merchantId,
            sku: ingredientMappings.sku,
            productName: ingredientMappings.productName,
          })
          .from(ingredientMappings)
          .where(eq(ingredientMappings.active, true));
      } catch {
        activeMappings = [];
      }
    }

    const chainTotals: BasketComparisonResult['chainTotals'] = {};
    for (const ck of chainKeys) {
      chainTotals[ck] = {
        chainKey: ck,
        estimatedTotal: 0,
        matchedCount: 0,
        totalCount: uniqueQueries.length,
        isCheapest: false,
      };
    }

    const items: BasketComparisonResult['items'] = [];

    for (const query of uniqueQueries) {
      const normalizedQuery = normalizeHebrewText(query) || query.toLowerCase();
      const matches: Record<string, BasketProductMatch | null> = {};

      await Promise.all(
        chainKeys.map(async (ck) => {
          const mapped = activeMappings.find(
            (m) => m.merchantId === ck && normalizeHebrewText(m.normalizedName) === normalizedQuery
          );

          const candidates = await this.findMatchesForIngredient(query, ck);
          const best = candidates[0];

          if (mapped) {
            const parsedPrice = best ? parseFloat(best.price) : NaN;
            const fallback = findFallbackStaple(normalizedQuery, ck);
            const price = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : (fallback?.price || 12.9);
            matches[ck] = {
              itemCode: mapped.sku,
              productName: mapped.productName,
              price: Math.round(price * 100) / 100,
              searchQuery: mapped.productName,
              source: 'mapping',
            };
          } else if (best) {
            const parsedPrice = parseFloat(best.price);
            if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
              matches[ck] = {
                itemCode: best.itemCode,
                productName: best.name,
                price: Math.round(parsedPrice * 100) / 100,
                searchQuery: best.name,
                source: best.confidence >= 85 ? 'catalog' : 'estimate',
              };
            } else {
              matches[ck] = null;
            }
          } else {
            matches[ck] = null;
          }

          if (matches[ck]) {
            chainTotals[ck].estimatedTotal = Math.round((chainTotals[ck].estimatedTotal + matches[ck]!.price) * 100) / 100;
            chainTotals[ck].matchedCount += 1;
          }
        })
      );

      items.push({
        query,
        normalizedQuery,
        matches,
      });
    }

    const maxMatched = Math.max(0, ...Object.values(chainTotals).map((c) => c.matchedCount));
    if (maxMatched > 0) {
      const eligible = Object.values(chainTotals).filter((c) => c.matchedCount === maxMatched && c.estimatedTotal > 0);
      if (eligible.length > 0) {
        eligible.sort((a, b) => a.estimatedTotal - b.estimatedTotal);
        eligible[0].isCheapest = true;
      }
    }

    return { chainTotals, items };
  }

  /**
   * Run auto-mapping on a list of ingredients and generate suggestions in DB
   */
  static async generateSuggestions(
    ingredients: { id?: string; name: string }[],
    chainKey: string = 'shufersal'
  ): Promise<{ generated: number; autoApproved: number }> {
    const db = getDb();
    if (!db) return { generated: 0, autoApproved: 0 };

    let generated = 0;
    let autoApproved = 0;

    for (const ing of ingredients) {
      const candidates = await this.findMatchesForIngredient(ing.name, chainKey);
      if (candidates.length === 0) continue;

      const best = candidates[0];
      const suggestionId = `sug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const isHighConfidence = best.confidence >= 95;
      const initialStatus = isHighConfidence ? 'approved' : 'pending';

      await db
        .insert(ingredientMappingSuggestions)
        .values({
          id: suggestionId,
          ingredientId: ing.id,
          ingredientName: ing.name,
          chain: chainKey,
          itemCode: best.itemCode,
          productName: best.name,
          price: best.price,
          confidence: best.confidence,
          method: best.method,
          status: initialStatus,
        })
        .onConflictDoNothing();

      generated++;

      // If confidence >= 95%, auto-approve directly into ingredient_mappings if not locked
      if (isHighConfidence) {
        await this.approveSuggestionInternal(db, {
          ingredientName: ing.name,
          merchantId: chainKey,
          sku: best.itemCode,
          productName: best.name,
          productUrl: buildChainDefaultProductUrl(chainKey, best.name),
          source: 'auto',
        });
        autoApproved++;
      }
    }

    return { generated, autoApproved };
  }

  /**
   * Internal helper to upsert mapping into ingredient_mappings
   */
  private static async approveSuggestionInternal(
    db: any,
    mapping: {
      ingredientName: string;
      merchantId: string;
      sku: string;
      productName: string;
      productUrl: string;
      source: 'auto' | 'manual';
    }
  ): Promise<void> {
    const normalizedName = normalizeHebrewText(mapping.ingredientName);
    const existing = await db
      .select()
      .from(ingredientMappings)
      .where(and(eq(ingredientMappings.normalizedName, normalizedName), eq(ingredientMappings.merchantId, mapping.merchantId)))
      .limit(1);

    if (existing.length > 0) {
      // Don't overwrite if locked
      if (existing[0].isLocked && mapping.source === 'auto') {
        return;
      }

      await db
        .update(ingredientMappings)
        .set({
          sku: mapping.sku,
          productName: mapping.productName,
          productUrl: mapping.productUrl,
          source: mapping.source,
          updatedAt: new Date(),
        })
        .where(eq(ingredientMappings.id, existing[0].id));
    } else {
      const id = `map_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await db.insert(ingredientMappings).values({
        id,
        normalizedName,
        merchantId: mapping.merchantId,
        sku: mapping.sku,
        productName: mapping.productName,
        productUrl: mapping.productUrl,
        source: mapping.source,
        isLocked: false,
        active: true,
      });
    }
  }

  /**
   * Approve a pending suggestion by ID
   */
  static async approveSuggestion(suggestionId: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;

    const suggestions = await db
      .select()
      .from(ingredientMappingSuggestions)
      .where(eq(ingredientMappingSuggestions.id, suggestionId))
      .limit(1);

    if (suggestions.length === 0) return false;
    const sug = suggestions[0];

    if (!SUPPORTED_CHAINS[sug.chain]) {
      return false;
    }

    await this.approveSuggestionInternal(db, {
      ingredientName: sug.ingredientName,
      merchantId: sug.chain,
      sku: sug.itemCode,
      productName: sug.productName,
      productUrl: sug.productUrl || buildChainDefaultProductUrl(sug.chain, sug.productName),
      source: 'auto',
    });

    await db
      .update(ingredientMappingSuggestions)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(ingredientMappingSuggestions.id, suggestionId));

    return true;
  }

  /**
   * Reject a suggestion
   */
  static async rejectSuggestion(suggestionId: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;

    await db
      .update(ingredientMappingSuggestions)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(ingredientMappingSuggestions.id, suggestionId));

    return true;
  }
}
