import { getDb } from '../../db/index.js';
import { chainProducts, ingredientMappingSuggestions, ingredientMappings } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { normalizeHebrewText } from './price-xml-parser.js';
import { SUPPORTED_CHAINS } from './chain-fetchers.js';
import {
  canonicalIngredientKey,
  extractDietaryConstraints,
  MIN_MATCH_CONFIDENCE,
  normalizeUnitKey,
} from '../../shared/index.js';

export type PricingBasis = 'per_unit_pack' | 'per_kg' | 'per_100g';

export interface BasketCompareItemInput {
  id?: string;
  query: string;
  amount?: number | null;
  unit?: string | null;
  dietaryConstraints?: string[];
}

export interface MatchCandidate {
  itemCode: string;
  chain: string;
  name: string;
  price: string;
  unitQty?: string | null;
  confidence: number;
  method: 'exact' | 'similarity' | 'gemini';
}

export interface BasketProductMatch {
  itemCode: string;
  productName: string;
  price: number;
  unitPrice: number;
  unitQty?: string | null;
  pricingBasis: PricingBasis;
  pricingBasisLabel: string;
  packSizeLabel?: string | null;
  packSizeUnknown?: boolean;
  packsNeeded: number;
  purchasableCost: number;
  consumptionCost: number;
  confidence: number;
  searchQuery: string;
  source: 'mapping' | 'catalog' | 'estimate';
}

export interface BasketComparisonResult {
  exclusionsNote?: string;
  minMatchConfidence?: number;
  chainTotals: Record<
    string,
    {
      chainKey: string;
      estimatedTotal: number;
      purchasableTotal: number;
      consumptionTotal: number;
      matchedCount: number;
      totalCount: number;
      missingCount: number;
      missingItems: string[];
      isCompleteBasket: boolean;
      hasUnknownPackSize?: boolean;
      exclusionsNote: string;
      isCheapest: boolean;
    }
  >;
  items: Array<{
    itemId?: string;
    query: string;
    normalizedQuery: string;
    amount?: number | null;
    unit?: string | null;
    dietaryConstraints?: string[];
    matches: Record<string, BasketProductMatch | null>;
  }>;
}

const PASTA_QUERY_TOKENS = new Set([
  'פסטה',
  'ספגטי',
  'פנה',
  'פוזילי',
  'פרפלה',
  'ריגטוני',
  'לינגוויני',
  'טליאטלה',
  'פטוציני',
  "פטוצ'יני",
  'מקרוני',
  'ניוקי',
  'רביולי',
  'לזניה',
  'אטריות',
]);

const DISTINCTIVE_ANCHOR_TOKENS = new Set([
  'פקורינו',
  'פרמזן',
  'פרמזנו',
  "גואנצ'אלה",
  'גואנצאלה',
  "פנצ'טה",
  'פנצטה',
  'מסקרפונה',
  'ריקוטה',
  'מוצרלה',
  'ספגטי',
  'פוזילי',
  'ריגטוני',
  'בסמטי',
]);

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
      return `https://shop.hazi-hinam.co.il/quickbuy/editor`;
    case 'shufersal':
    default:
      return `https://www.shufersal.co.il/online/he/search?text=${encoded}`;
  }
}

function containsTokenOrPrefix(normalizedText: string, word: string): boolean {
  const tokens = normalizedText.split(/\s+/);
  return tokens.some((t) => t === word || t === `ב${word}` || t === `ל${word}` || t === `מ${word}` || t === `ו${word}` || t === `ה${word}`);
}

/**
 * Relevance, Negation, Category Disqualifier, and Dietary Guard scorer.
 * Returns 0 if the candidate product is disqualified.
 */
export function scoreProductCandidate(
  rawQuery: string,
  candidateName: string,
  explicitDietaryConstraints: string[] = []
): number {
  const queryNorm = normalizeHebrewText(rawQuery);
  const prodNorm = normalizeHebrewText(candidateName);
  if (!queryNorm || !prodNorm) return 0;

  const queryConstraints = Array.from(
    new Set([...extractDietaryConstraints(rawQuery), ...explicitDietaryConstraints])
  );

  const queryTokens = queryNorm.split(/\s+/).filter(Boolean);
  const prodTokens = prodNorm.split(/\s+/).filter(Boolean);

  // 1. Negation Guard:
  // If candidate contains "ללא <token>", "בלי <token>", "נטול <token>", "ללא תוספת <token>", "דל <token>"
  // where <token> is in the query and NOT negated in the query itself -> REJECT (0).
  for (const qt of queryTokens) {
    if (qt === 'ללא' || qt === 'בלי' || qt === 'נטול' || qt.length < 2) continue;
    const negatedInQuery =
      queryNorm.includes(`ללא ${qt}`) ||
      queryNorm.includes(`בלי ${qt}`) ||
      queryNorm.includes(`נטול ${qt}`);
    if (!negatedInQuery) {
      const negPatterns = [
        `ללא ${qt}`,
        `בלי ${qt}`,
        `נטול ${qt}`,
        `ללא תוספת ${qt}`,
        `דל ${qt}`,
      ];
      if (negPatterns.some((pat) => prodNorm.includes(pat))) {
        return 0;
      }
      if (qt === 'מלח' && (prodNorm.includes('דל נתרן') || prodNorm.includes('מופחת נתרן'))) {
        return 0;
      }
    }
  }

  // 2. Category / Disqualifier Guards:
  const isPastaQuery = queryTokens.some((t) => PASTA_QUERY_TOKENS.has(t));
  if (isPastaQuery) {
    const pastaDisqualifiers = [
      'דלעת', 'קישוא', 'זוקיני',
      'מנה חמה', 'מרק', 'תיבול', 'אבקת', 'רוטב',
      'קונגאק', "קונג'אק", 'קוניאק', 'שיגאטקי', 'שירטאקי', 'שיראטקי',
      'מסננת', 'כף', 'סיר',
    ];
    for (const disq of pastaDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Salt query guard
  const isSaltQuery =
    containsTokenOrPrefix(queryNorm, 'מלח') &&
    !queryNorm.includes('לימון') &&
    !queryNorm.includes('מדיח');
  if (isSaltQuery) {
    if (!containsTokenOrPrefix(prodNorm, 'מלח')) return 0;
    const saltDisqualifiers = [
      'גרעין', 'גרעיני', 'גרעינים', 'בוטנים', 'שקדים', 'קשיו', 'פיסטוק', 'אגוז', 'אגוזים', 'פיצוחים',
      'חמוצים', 'מלפפון', 'מלפפונים', 'זיתים',
      'דג', 'דגים', 'סלמון', 'טונה', 'הרינג', 'מטיאס', 'אנשובי', 'סרדינים',
      'חמאה', 'לורפק', 'ממרח', 'מרגרינה', 'מזולה', 'שמנת', 'גבינה', 'גבינת',
      'בייגלה', 'קרקר', 'קרקרים', 'פריכיות', 'חטיף', "צ'יפס", 'ציפס', 'פופקורן',
      'סלט', 'בשר', 'עוף', 'נקניק', 'מלוח', 'מומלח', 'צעצוע',
      'מדיח', 'פיניש', 'לימון', 'סבון', 'שמפו', 'אמבט', 'כלים', 'ניקוי',
    ];
    for (const disq of saltDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Mayonnaise query guard (blocks herring salad with mayonnaise, potato salad, snacks, etc.)
  const isMayoQuery = containsTokenOrPrefix(queryNorm, 'מיונז');
  if (isMayoQuery) {
    if (!containsTokenOrPrefix(prodNorm, 'מיונז')) return 0;
    const mayoDisqualifiers = [
      'סלט', 'הרינג', 'מטיאס', 'דג', 'דגים', 'טונה', 'ביצים', 'תפוחי אדמה', 'כרוב', 'גזר',
      'חומוס', 'טחינה', 'כריך', 'סנדוויץ', 'חטיף', 'קרקר', 'קרקרים', 'בייגלה', 'ממרח', 'צעצוע',
    ];
    for (const disq of mayoDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Garlic query guard (blocks sesame crackers, pretzels, snacks, bread, spreads, sauces)
  const isGarlicQuery = containsTokenOrPrefix(queryNorm, 'שום') && !queryNorm.includes('רוטב');
  if (isGarlicQuery) {
    if (!containsTokenOrPrefix(prodNorm, 'שום')) return 0;
    const garlicDisqualifiers = [
      'קרקר', 'קרקרים', 'בייגלה', 'שומשום', 'חטיף', 'פריכיות', 'ביסלי', "צ'יפס", 'ציפס',
      'פיתה', 'לחם', 'בגט', 'לחמניה', 'קרוטונים', 'טוסט', 'סלט', 'ממרח', 'חמאה',
      'גבינה', 'גבינת', 'רוטב', 'אבקת מרק', 'שמן', 'צעצוע', 'פסטה', 'נקניק',
    ];
    for (const disq of garlicDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Sugar & Flour staple guards (blocks spreads, salads, snacks, crackers, baked goods, toys)
  const isSugarQuery = containsTokenOrPrefix(queryNorm, 'סוכר') && !queryNorm.includes('וניל');
  if (isSugarQuery) {
    if (!containsTokenOrPrefix(prodNorm, 'סוכר')) return 0;
    const sugarDisqualifiers = [
      'ממרח', 'סלט', 'חטיף', 'קרקר', 'קרקרים', 'בייגלה', 'צעצוע',
      'עוגה', 'עוגיות', 'וופל', 'שוקולד', 'משקה', 'מיץ', 'גלידה', 'יוגורט', 'מעדן',
    ];
    for (const disq of sugarDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  const isFlourQuery = containsTokenOrPrefix(queryNorm, 'קמח');
  if (isFlourQuery) {
    if (!containsTokenOrPrefix(prodNorm, 'קמח')) return 0;
    const flourDisqualifiers = [
      'ממרח', 'סלט', 'חטיף', 'קרקר', 'קרקרים', 'בייגלה', 'צעצוע',
      'לחם', 'פיתה', 'בגט', 'עוגה', 'עוגיות', 'פסטה', 'טורטיה', 'מלאווח', 'גחנון',
    ];
    for (const disq of flourDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Pepper query guard
  const isPepperQuery = containsTokenOrPrefix(queryNorm, 'פלפל');
  if (isPepperQuery) {
    if (!containsTokenOrPrefix(prodNorm, 'פלפל')) return 0;
    const pepperDisqualifiers = [
      'גרעין', 'גרעיני', 'גרעינים', 'שעועית', 'עדשים', 'זיתים',
      'תה', 'קפה', 'שוקולד',
      'גבינה', 'גבינת', 'חמאה', 'סלמי', 'פסטרמה', 'נקניק',
      'חטיף', 'ביסלי', "צ'יפס", 'ציפס', 'קרקר', 'בייגלה',
      'ממרח', 'סלט', 'רוטב',
    ];
    for (const disq of pepperDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
    if (queryNorm.includes('שחור') || queryNorm.includes('גרוס')) {
      const bellPepperDisqualifiers = ['אדום', 'צהוב', 'ירוק', 'כתום', 'חריף', 'שיפקה', 'קלוי', 'ממולא', 'גמבה'];
      for (const disq of bellPepperDisqualifiers) {
        if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
          return 0;
        }
      }
    }
  }

  // Olive oil guard
  const isOliveOilQuery = queryNorm.includes('שמן') && queryNorm.includes('זית');
  if (isOliveOilQuery) {
    if (!prodNorm.includes('שמן') || !prodNorm.includes('זית')) return 0;
    if (!queryNorm.includes('תרסיס') && !queryNorm.includes('ספריי')) {
      if (prodNorm.includes('תרסיס') || prodNorm.includes('ספריי')) return 0;
    }
    const oliveOilDisqualifiers = [
      'טונה', 'סרדינים', 'אנשובי', 'דג', 'ממרח', 'חומוס', 'לאבנה', 'לבנה',
      'גבינה', 'גבינת', 'קרקר', 'בייגלה', 'חטיף', 'סבון', 'שמפו', 'קרם', 'שיער', 'גוף', 'פנים', 'זיתים',
      'כוסיות', 'נרות', 'נר', 'מאור', 'פתיליות', 'פתילות', 'חנוכה',
    ];
    for (const disq of oliveOilDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Eggs guard
  const isEggQuery = containsTokenOrPrefix(queryNorm, 'ביצים') || containsTokenOrPrefix(queryNorm, 'ביצה');
  if (isEggQuery && !queryNorm.includes('אטריות')) {
    if (!prodNorm.includes('ביצים') && !prodNorm.includes('ביצה')) return 0;
    const eggDisqualifiers = [
      'שוקולד', 'קינדר', 'סוכריות', 'גומי', 'אטריות', 'נודלס', 'פסטה', 'פתיתי', 'פתיתים',
      'מיונז', 'סלט', 'ליקר', 'צבע', 'קישוט', 'הפתעה', 'צעצוע', 'בורקס', 'גחנון', "ג'חנון", 'מלאווח',
    ];
    for (const disq of eggDisqualifiers) {
      if (!queryNorm.includes(disq) && prodNorm.includes(disq)) {
        return 0;
      }
    }
  }

  // Cheese / Deli specificity guard
  if (queryNorm.includes('פקורינו')) {
    if (!prodNorm.includes('פקורינו')) return 0;
    if (['רוטב', 'פסטה', 'חטיף', 'בייגלה', 'קרקר', 'מרק'].some((d) => prodNorm.includes(d))) return 0;
  }
  if (queryNorm.includes('פרמזן') || queryNorm.includes('פרמזנו')) {
    if (!prodNorm.includes('פרמזן') && !prodNorm.includes('פרמזנו')) return 0;
    if (['רוטב', 'פסטה', 'חטיף', 'בייגלה', 'קרקר', 'מרק'].some((d) => prodNorm.includes(d))) return 0;
  }
  if (queryNorm.includes("גואנצ'אלה") || queryNorm.includes('גואנצאלה')) {
    if (!prodNorm.includes("גואנצ'אלה") && !prodNorm.includes('גואנצאלה')) return 0;
  }
  if (queryNorm.includes("פנצ'טה") || queryNorm.includes('פנצטה')) {
    if (!prodNorm.includes("פנצ'טה") && !prodNorm.includes('פנצטה')) return 0;
  }

  // 3. Dietary / Specialty Guard:
  const wantsGlutenFree = queryConstraints.includes('ללא גלוטן') || /ללא\s+גלוטן|נטול\s+גלוטן/.test(queryNorm);
  const prodIsGlutenFree = /ללא\s+גלוטן|נטול\s+גלוטן/.test(prodNorm);
  if (wantsGlutenFree && !prodIsGlutenFree) {
    return 0;
  }
  if (!wantsGlutenFree && prodIsGlutenFree) {
    return 0;
  }

  if (isPastaQuery || containsTokenOrPrefix(queryNorm, 'קמח')) {
    const specialtyGrains = ['עדשים', 'חומוס', 'אורז', 'כוסמין', 'קמח מלא', 'מחיטה מלאה', 'תירס', 'אפונה', 'שעועית', 'קינואה', 'טריקולור'];
    for (const sg of specialtyGrains) {
      const requestedSg =
        queryNorm.includes(sg) ||
        (sg === 'קמח מלא' && (queryConstraints.includes('קמח מלא') || queryNorm.includes('מלא'))) ||
        (sg === 'מחיטה מלאה' && (queryConstraints.includes('קמח מלא') || queryNorm.includes('מלא'))) ||
        (sg === 'כוסמין' && queryConstraints.includes('כוסמין'));
      if (!requestedSg && prodNorm.includes(sg)) {
        return 0;
      }
    }
  }

  for (const constraint of queryConstraints) {
    if (constraint === 'ללא גלוטן') continue; // already checked above
    if (constraint === 'כוסמין' && !prodNorm.includes('כוסמין')) return 0;
    if (constraint === 'קמח מלא' && !prodNorm.includes('מלא') && !prodNorm.includes('מלאה')) return 0;
    if (constraint === 'ללא לקטוז' && !/ללא\s+לקטוז|נטול\s+לקטוז/.test(prodNorm)) return 0;
    if (constraint === 'ללא סוכר' && !/ללא\s+(?:תוספת\s+)?סוכר/.test(prodNorm)) return 0;
    if (constraint === 'כשר לפסח' && !/כשר\s+לפסח|כשל"פ/.test(prodNorm)) return 0;
    if (constraint === 'טבעוני' && !/טבעוני/.test(prodNorm)) return 0;
    if (constraint === 'אורגני' && !/אורגני/.test(prodNorm)) return 0;
  }

  // 4. Exact match check
  if (prodNorm === queryNorm) {
    return 98;
  }

  // 5. Token coverage & similarity score
  const coreTokens = queryTokens.filter(
    (t) => (t.length >= 2 || /^\d+$/.test(t)) && !['ללא', 'גלוטן', 'נטול', 'גבינת', 'רומנו'].includes(t)
  );
  const evalTokens = coreTokens.length > 0 ? coreTokens : queryTokens;

  const tokenMatchesProduct = (t: string): boolean => {
    if (prodNorm.includes(t)) return true;
    // Allow pasta/spaghetti synonym matching when no disqualifier is present
    if ((t === 'ספגטי' || t === 'פסטה') && (prodNorm.includes('ספגטי') || prodNorm.includes('פסטה'))) {
      return true;
    }
    if ((t === 'ביצים' || t === 'ביצה') && (prodNorm.includes('ביצים') || prodNorm.includes('ביצה'))) {
      return true;
    }
    return false;
  };

  const matchedEvalCount = evalTokens.filter(tokenMatchesProduct).length;
  const matchedAllCount = queryTokens.filter(tokenMatchesProduct).length;

  const hasDistinctiveAnchor = queryTokens.some(
    (t) => DISTINCTIVE_ANCHOR_TOKENS.has(t) && tokenMatchesProduct(t)
  );

  const minRequired = hasDistinctiveAnchor ? 1 : evalTokens.length >= 2 ? Math.min(2, evalTokens.length) : 1;
  if (matchedEvalCount < minRequired) {
    return 0;
  }

  const tokenRatio = hasDistinctiveAnchor
    ? Math.max(matchedAllCount / Math.max(1, queryTokens.length), 0.9)
    : matchedEvalCount / Math.max(1, evalTokens.length);

  const lengthRatio = Math.min(1, queryNorm.length / Math.max(1, prodNorm.length));
  const startsWithBonus = prodTokens[0] && queryTokens[0] && prodTokens[0] === queryTokens[0] ? 5 : 0;
  const anchorBonus = hasDistinctiveAnchor ? 10 : 0;

  // Full query-token match that passed all semantic & dietary disqualifiers meets MIN_MATCH_CONFIDENCE (80+)
  // even when the supermarket product title is longer due to brand/pack-size text.
  // Partial token matches without a distinctive anchor remain below MIN_MATCH_CONFIDENCE.
  const rawScore =
    tokenRatio >= 1
      ? Math.round(78 + (startsWithBonus > 0 ? 4 : 2) + lengthRatio * 14 + anchorBonus)
      : Math.round(tokenRatio * 65 + lengthRatio * 20 + startsWithBonus + anchorBonus);
  return Math.max(0, Math.min(96, rawScore));
}

export interface ParsedPackAndBasis {
  pricingBasis: PricingBasis;
  packSizeGrams: number | null;
  packSizeMl: number | null;
  packCount: number | null;
  packSizeLabel: string | null;
}

export function parseProductPackAndBasis(
  productName: string,
  unitQty?: string | null
): ParsedPackAndBasis {
  const name = String(productName || '')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .trim();
  const uq = String(unitQty || '')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .trim();

  const isExplicitlyWeightedInName = /במשקל|לפי\s+משקל/.test(name) || /במשקל|לפי\s+משקל/.test(uq);

  let packSizeGrams: number | null = null;
  let packSizeMl: number | null = null;
  let packCount: number | null = null;
  let packSizeLabel: string | null = null;

  const parseFromText = (text: string, allowSingleKgUnit: boolean) => {
    // Check grams e.g. "500 גרם", "500ג", "80 גר'", "500גר"
    const gMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:גרם|גר'|גר|ג')(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i) ||
      text.match(/(\d+(?:[.,]\d+)?)\s*(?:ג|g|gr)(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i);
    if (gMatch && packSizeGrams === null) {
      const val = parseFloat(gMatch[1].replace(',', '.'));
      if (val > 0 && !(val === 100 && isExplicitlyWeightedInName)) {
        packSizeGrams = val;
        packSizeLabel = `${gMatch[1]} גרם`;
      }
    }

    // Check kg e.g. "1 ק"ג", "1.5 קילו", "1 קג"
    const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ק"ג|קג|קילו|קילוגרם|kg)(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i);
    if (kgMatch && packSizeGrams === null && !isExplicitlyWeightedInName && allowSingleKgUnit) {
      const val = parseFloat(kgMatch[1].replace(',', '.'));
      if (val > 0) {
        packSizeGrams = Math.round(val * 1000);
        packSizeLabel = `${kgMatch[1]} ק״ג`;
      }
    }

    // Check ml e.g. "750 מ"ל", "250 מל"
    const mlMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:מ"ל|מל|ml)(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i);
    if (mlMatch && packSizeMl === null) {
      const val = parseFloat(mlMatch[1].replace(',', '.'));
      if (val > 0) {
        packSizeMl = val;
        packSizeLabel = `${mlMatch[1]} מ״ל`;
      }
    }

    // Check liters e.g. "1 ליטר"
    const lMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ליטר|ליטרים|ל'|l)(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i);
    if (lMatch && packSizeMl === null) {
      const val = parseFloat(lMatch[1].replace(',', '.'));
      if (val > 0) {
        packSizeMl = Math.round(val * 1000);
        packSizeLabel = `${lMatch[1]} ליטר`;
      }
    }

    // Check unit count e.g. "12 יח'", "מארז 12"
    const countMatch =
      text.match(/(?:מארז\s*)?(\d+)\s*(?:יח'|יחידות|יח)(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i) ||
      text.match(/מארז\s+(\d+)(?=\s|$|[^\u0590-\u05FFa-zA-Z0-9])/i);
    if (countMatch && packCount === null) {
      const val = parseInt(countMatch[1], 10);
      if (val > 0) {
        packCount = val;
        packSizeLabel = `${val} יח׳`;
      }
    }
  };

  parseFromText(name, true);

  // Detect weighted per_kg or per_100g products
  const uqIsKg = /^(?:1\s*)?(?:קילוגרם|ק"ג|קג|קילו)$/i.test(uq) || /ל-?1?\s*ק"?ג|לקילוגרם/.test(uq);
  const uqIs100g = /^100\s*(?:גרם|גר'|ג'|ג)$/i.test(uq) || /ל-?100\s*גרם/.test(uq);

  const isDeliOrProduceWithoutFixedPack =
    packSizeGrams === null &&
    packSizeMl === null &&
    packCount === null &&
    (uqIsKg || isExplicitlyWeightedInName);

  if (isExplicitlyWeightedInName || isDeliOrProduceWithoutFixedPack) {
    if (uqIs100g && !uqIsKg) {
      return {
        pricingBasis: 'per_100g',
        packSizeGrams: null,
        packSizeMl: null,
        packCount: null,
        packSizeLabel: 'במשקל (ל-100 גרם)',
      };
    }
    return {
      pricingBasis: 'per_kg',
      packSizeGrams: null,
      packSizeMl: null,
      packCount: null,
      packSizeLabel: 'במשקל (לק״ג)',
    };
  }

  if (uqIs100g && packSizeGrams === null && packSizeMl === null && packCount === null) {
    return {
      pricingBasis: 'per_100g',
      packSizeGrams: null,
      packSizeMl: null,
      packCount: null,
      packSizeLabel: 'במשקל (ל-100 גרם)',
    };
  }

  if (packSizeGrams === null && packSizeMl === null && packCount === null) {
    // Try multi-pack Hebrew/English tokens in product name (e.g. "6 pack", "שישייה", "תריסר")
    const engPackMatch = name.match(/(\d+)\s*(?:pack|pcs|units)(?=\s|$|[^a-zA-Z0-9])/i);
    if (engPackMatch) {
      const val = parseInt(engPackMatch[1], 10);
      if (val > 0) {
        packCount = val;
        packSizeLabel = `${val} יח׳`;
      }
    } else if (/תריסר/.test(name)) {
      packCount = 12;
      packSizeLabel = '12 יח׳';
    } else if (/שישי(?:י)?ה/.test(name)) {
      packCount = 6;
      packSizeLabel = '6 יח׳';
    } else if (/רביעי(?:י)?ה/.test(name)) {
      packCount = 4;
      packSizeLabel = '4 יח׳';
    } else if (/(?:^|\s)זוג(?:\s|$)/.test(name)) {
      packCount = 2;
      packSizeLabel = '2 יח׳';
    }
  }

  if (packSizeGrams === null && packSizeMl === null && packCount === null && uq) {
    parseFromText(uq, true);
    if (packSizeMl === null && /מיליליטר|מ"ל|מל/.test(uq)) {
      const trailingNum = name.match(/(\d{2,4})\s*$/);
      if (trailingNum) {
        const val = parseInt(trailingNum[1], 10);
        if (val >= 50 && val <= 5000) {
          packSizeMl = val;
          packSizeLabel = `${val} מ״ל`;
        }
      }
    }
    if (packSizeGrams === null && /^גרם$/i.test(uq)) {
      const trailingNum = name.match(/(\d{2,4})\s*$/);
      if (trailingNum) {
        const val = parseInt(trailingNum[1], 10);
        if (val >= 20 && val <= 5000) {
          packSizeGrams = val;
          packSizeLabel = `${val} גרם`;
        }
      }
    }
  }

  // Fallback for trailing standard weight numbers when unitQty is missing or generic (e.g. "PUMINO #5 500" or "ספגטי 500")
  // Carefully ignore pasta shape numbers like "#5", "מס 5", "מס' 5", "N.5"
  if (packSizeGrams === null && packSizeMl === null && packCount === null) {
    const cleanedShapeNums = name.replace(/(?:מס'?|#|no\.?|n\.?)\s*\d+/gi, ' ');
    const trailingWeight = cleanedShapeNums.match(/(?:^|\s)(100|150|200|250|300|350|400|450|500|600|700|750|800|900|1000)\s*$/);
    if (trailingWeight) {
      const val = parseInt(trailingWeight[1], 10);
      if (/שמן|חלב|מיץ|רוטב|חומץ|מים|שמנת/.test(name)) {
        packSizeMl = val;
        packSizeLabel = `${val} מ״ל`;
      } else {
        packSizeGrams = val;
        packSizeLabel = `${val} גרם`;
      }
    }
  }

  return {
    pricingBasis: 'per_unit_pack',
    packSizeGrams,
    packSizeMl,
    packCount,
    packSizeLabel: packSizeLabel || (uq ? uq : 'יחידה'),
  };
}

export function computeQuantityAwarePricing(
  unitPriceNis: number,
  productName: string,
  unitQty?: string | null,
  reqAmount?: number | null,
  reqUnit?: string | null
): {
  pricingBasis: PricingBasis;
  pricingBasisLabel: string;
  packSizeLabel: string | null;
  packSizeUnknown: boolean;
  packsNeeded: number;
  purchasableCost: number;
  consumptionCost: number;
  packSizeGrams: number | null;
  packSizeMl: number | null;
  packCount: number | null;
} {
  const parsed = parseProductPackAndBasis(productName, unitQty);
  const normUnit = normalizeUnitKey(reqUnit);
  const amount = typeof reqAmount === 'number' && Number.isFinite(reqAmount) && reqAmount > 0 ? reqAmount : null;

  let requiredGrams: number | null = null;
  let requiredMl: number | null = null;
  let requiredUnits: number | null = null;

  if (amount !== null) {
    if (normUnit === 'גרם') requiredGrams = amount;
    else if (normUnit === 'ק"ג') requiredGrams = amount * 1000;
    else if (normUnit === 'מ"ל') requiredMl = amount;
    else if (normUnit === 'ליטר') requiredMl = amount * 1000;
    else if (normUnit === 'יחידות' || normUnit === '') requiredUnits = amount;
    else if (normUnit === 'כף' || normUnit === 'כפות') {
      requiredGrams = amount * 15;
      requiredMl = amount * 15;
    } else if (normUnit === 'כפית' || normUnit === 'כפיות') {
      requiredGrams = amount * 5;
      requiredMl = amount * 5;
    } else if (normUnit === 'כוס' || normUnit === 'כוסות') {
      requiredGrams = amount * 200;
      requiredMl = amount * 240;
    }
  }

  const formatNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

  if (parsed.pricingBasis === 'per_kg') {
    const effectiveRecipeGrams = requiredGrams ?? (requiredUnits !== null ? requiredUnits * 150 : 100);
    const consumptionCost = Math.round(((effectiveRecipeGrams / 1000) * unitPriceNis) * 100) / 100;
    const purchasableGrams = Math.max(100, effectiveRecipeGrams);
    const purchasableCost = Math.round(((purchasableGrams / 1000) * unitPriceNis) * 100) / 100;
    const pricingBasisLabel = `₪${unitPriceNis.toFixed(2)} לק״ג (במשקל) • עלות למתכון (${formatNum(effectiveRecipeGrams)} גרם): ₪${consumptionCost.toFixed(2)}`;

    return {
      pricingBasis: 'per_kg',
      pricingBasisLabel,
      packSizeLabel: parsed.packSizeLabel,
      packSizeUnknown: false,
      packsNeeded: 1,
      purchasableCost,
      consumptionCost,
      packSizeGrams: null,
      packSizeMl: null,
      packCount: null,
    };
  }

  if (parsed.pricingBasis === 'per_100g') {
    const effectiveRecipeGrams = requiredGrams ?? 100;
    const consumptionCost = Math.round(((effectiveRecipeGrams / 100) * unitPriceNis) * 100) / 100;
    const purchasableGrams = Math.max(100, effectiveRecipeGrams);
    const purchasableCost = Math.round(((purchasableGrams / 100) * unitPriceNis) * 100) / 100;
    const pricingBasisLabel = `₪${unitPriceNis.toFixed(2)} ל-100 גרם (במשקל) • עלות למתכון (${formatNum(effectiveRecipeGrams)} גרם): ₪${consumptionCost.toFixed(2)}`;

    return {
      pricingBasis: 'per_100g',
      pricingBasisLabel,
      packSizeLabel: parsed.packSizeLabel,
      packSizeUnknown: false,
      packsNeeded: 1,
      purchasableCost,
      consumptionCost,
      packSizeGrams: null,
      packSizeMl: null,
      packCount: null,
    };
  }

  // Packaged item ('per_unit_pack')
  if (parsed.packSizeGrams && requiredGrams !== null) {
    const packsNeeded = Math.max(1, Math.ceil(requiredGrams / parsed.packSizeGrams));
    const consumptionCost = Math.round(((requiredGrams / parsed.packSizeGrams) * unitPriceNis) * 100) / 100;
    const purchasableCost = Math.round(packsNeeded * unitPriceNis * 100) / 100;
    const pricingBasisLabel = `₪${unitPriceNis.toFixed(2)} למארז (${parsed.packSizeLabel || `${parsed.packSizeGrams} גרם`})${packsNeeded > 1 ? ` × ${packsNeeded} מארזים` : ''} • עלות למתכון (${formatNum(requiredGrams)} גרם): ₪${consumptionCost.toFixed(2)}`;

    return {
      pricingBasis: 'per_unit_pack',
      pricingBasisLabel,
      packSizeLabel: parsed.packSizeLabel,
      packSizeUnknown: false,
      packsNeeded,
      purchasableCost,
      consumptionCost,
      packSizeGrams: parsed.packSizeGrams,
      packSizeMl: parsed.packSizeMl,
      packCount: parsed.packCount,
    };
  }

  if (parsed.packSizeMl && requiredMl !== null) {
    const packsNeeded = Math.max(1, Math.ceil(requiredMl / parsed.packSizeMl));
    const consumptionCost = Math.round(((requiredMl / parsed.packSizeMl) * unitPriceNis) * 100) / 100;
    const purchasableCost = Math.round(packsNeeded * unitPriceNis * 100) / 100;
    const pricingBasisLabel = `₪${unitPriceNis.toFixed(2)} למארז (${parsed.packSizeLabel || `${parsed.packSizeMl} מ״ל`})${packsNeeded > 1 ? ` × ${packsNeeded} מארזים` : ''} • עלות למתכון (${formatNum(requiredMl)} מ״ל): ₪${consumptionCost.toFixed(2)}`;

    return {
      pricingBasis: 'per_unit_pack',
      pricingBasisLabel,
      packSizeLabel: parsed.packSizeLabel,
      packSizeUnknown: false,
      packsNeeded,
      purchasableCost,
      consumptionCost,
      packSizeGrams: parsed.packSizeGrams,
      packSizeMl: parsed.packSizeMl,
      packCount: parsed.packCount,
    };
  }

  if (parsed.packCount && requiredUnits !== null) {
    const packsNeeded = Math.max(1, Math.ceil(requiredUnits / parsed.packCount));
    const consumptionCost = Math.round(((requiredUnits / parsed.packCount) * unitPriceNis) * 100) / 100;
    const purchasableCost = Math.round(packsNeeded * unitPriceNis * 100) / 100;
    const pricingBasisLabel = `₪${unitPriceNis.toFixed(2)} למארז (${parsed.packSizeLabel || `${parsed.packCount} יח׳`})${packsNeeded > 1 ? ` × ${packsNeeded} מארזים` : ''} • עלות למתכון (${formatNum(requiredUnits)} יח׳): ₪${consumptionCost.toFixed(2)}`;

    return {
      pricingBasis: 'per_unit_pack',
      pricingBasisLabel,
      packSizeLabel: parsed.packSizeLabel,
      packSizeUnknown: false,
      packsNeeded,
      purchasableCost,
      consumptionCost,
      packSizeGrams: parsed.packSizeGrams,
      packSizeMl: parsed.packSizeMl,
      packCount: parsed.packCount,
    };
  }

  // Check if recipe requested a measurable weight/volume/multi-unit quantity but pack size is unknown (P0-3)
  const hasMeasurableNeed =
    (requiredGrams !== null && parsed.packSizeGrams === null) ||
    (requiredMl !== null && parsed.packSizeMl === null) ||
    (requiredUnits !== null && requiredUnits > 1 && parsed.packCount === null);

  const packsNeeded = 1;
  const purchasableCost = Math.round(unitPriceNis * 100) / 100;
  const consumptionCost =
    amount === null && (parsed.packSizeGrams || parsed.packSizeMl)
      ? Math.round(unitPriceNis * 0.05 * 100) / 100
      : purchasableCost;
  const pricingBasisLabel = hasMeasurableNeed
    ? `⚠️ גודל מארז לא ידוע — אומדן כמות לא ודאי (מחיר יחידה: ₪${unitPriceNis.toFixed(2)})`
    : parsed.packSizeLabel
    ? `₪${unitPriceNis.toFixed(2)} למארז (${parsed.packSizeLabel})`
    : `₪${unitPriceNis.toFixed(2)} ליחידה`;

  return {
    pricingBasis: 'per_unit_pack',
    pricingBasisLabel,
    packSizeLabel: hasMeasurableNeed ? 'גודל מארז לא ידוע' : parsed.packSizeLabel,
    packSizeUnknown: hasMeasurableNeed,
    packsNeeded,
    purchasableCost,
    consumptionCost,
    packSizeGrams: parsed.packSizeGrams,
    packSizeMl: parsed.packSizeMl,
    packCount: parsed.packCount,
  };
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
    chainKey: string = 'shufersal',
    dietaryConstraints?: string[]
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
          const validExact = exactMatches.filter(
            (m) => scoreProductCandidate(ingredientName, m.name, dietaryConstraints) > 0
          );
          if (validExact.length > 0) {
            return validExact.map((m) => ({
              itemCode: m.itemCode,
              chain: m.chain,
              name: m.name,
              price: m.price,
              unitQty: (m as any).unitQty || null,
              confidence: 98,
              method: 'exact',
            }));
          }
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
                const candidateScore = scoreProductCandidate(ingredientName, m.name, dietaryConstraints);
                if (candidateScore < MIN_MATCH_CONFIDENCE) {
                  if (process.env.NODE_ENV !== 'test') {
                    console.info('[CatalogMatchRejected]', {
                      chain: chainKey,
                      query: ingredientName,
                      product: m.name,
                      score: candidateScore,
                      threshold: MIN_MATCH_CONFIDENCE,
                    });
                  }
                  return null;
                }
                const matchedTokens = tokens.filter((t) => m.normalizedName.includes(t)).length;
                return {
                  itemCode: m.itemCode,
                  chain: m.chain,
                  name: m.name,
                  price: m.price,
                  unitQty: (m as any).unitQty || null,
                  confidence: candidateScore,
                  method: 'similarity' as const,
                  matchedTokens,
                };
              })
              .filter((c): c is NonNullable<typeof c> => c !== null && c.matchedTokens >= minRequiredTokens)
              .sort((a, b) => b.confidence - a.confidence || b.matchedTokens - a.matchedTokens);

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
      const fbScore = scoreProductCandidate(ingredientName, fallback.name, dietaryConstraints);
      if (fbScore >= MIN_MATCH_CONFIDENCE) {
        return [
          {
            itemCode: fallback.itemCode,
            chain: chainKey,
            name: fallback.name,
            price: fallback.price.toFixed(2),
            unitQty: null,
            confidence: fbScore,
            method: 'similarity',
          },
        ];
      }
    }

    return [];
  }

  /**
   * Compare a basket of ingredient queries across all active supported supermarket chains
   */
  static async compareBasketAcrossChains(
    rawQueries: Array<string | BasketCompareItemInput>,
    preloadedMappings?: Array<{
      normalizedName: string;
      merchantId: string;
      sku: string;
      productName: string;
    }>
  ): Promise<BasketComparisonResult> {
    const chainKeys = Object.keys(SUPPORTED_CHAINS);
    const parsedInputs: BasketCompareItemInput[] = [];
    for (const item of (rawQueries || []).slice(0, 40)) {
      if (typeof item === 'string') {
        const trimmed = String(item || '').trim();
        if (trimmed) parsedInputs.push({ id: canonicalIngredientKey(trimmed), query: trimmed });
      } else if (item && typeof item === 'object' && item.query) {
        const trimmed = String(item.query || '').trim();
        if (trimmed) {
          parsedInputs.push({
            id: item.id ? String(item.id).trim() : canonicalIngredientKey(trimmed),
            query: trimmed,
            amount: typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : null,
            unit: item.unit ? String(item.unit).trim() : null,
            dietaryConstraints: Array.isArray(item.dietaryConstraints) ? item.dietaryConstraints : undefined,
          });
        }
      }
    }

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
        purchasableTotal: 0,
        consumptionTotal: 0,
        matchedCount: 0,
        totalCount: parsedInputs.length,
        missingCount: parsedInputs.length,
        missingItems: [],
        isCompleteBasket: false,
        hasUnknownPackSize: false,
        exclusionsNote: '',
        isCheapest: false,
      };
    }

    const items: BasketComparisonResult['items'] = [];

    for (const input of parsedInputs) {
      const query = input.query;
      const itemId = input.id || canonicalIngredientKey(query);
      const normalizedQuery = normalizeHebrewText(query) || query.toLowerCase();
      const constraints = input.dietaryConstraints || extractDietaryConstraints(query);
      const matches: Record<string, BasketProductMatch | null> = {};

      await Promise.all(
        chainKeys.map(async (ck) => {
          const mapped = activeMappings.find(
            (m) => m.merchantId === ck && normalizeHebrewText(m.normalizedName) === normalizedQuery
          );

          const candidates = await this.findMatchesForIngredient(query, ck, constraints);
          const best = candidates[0] && candidates[0].confidence >= MIN_MATCH_CONFIDENCE ? candidates[0] : undefined;

          if (mapped && scoreProductCandidate(query, mapped.productName, constraints) >= MIN_MATCH_CONFIDENCE) {
            const parsedPrice = best ? parseFloat(best.price) : NaN;
            const fallback = findFallbackStaple(normalizedQuery, ck);
            const unitPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : (fallback?.price || 12.9);
            const pricing = computeQuantityAwarePricing(unitPrice, mapped.productName, best?.unitQty, input.amount, input.unit);
            matches[ck] = {
              itemCode: mapped.sku,
              productName: mapped.productName,
              price: pricing.purchasableCost,
              unitPrice,
              unitQty: best?.unitQty || null,
              pricingBasis: pricing.pricingBasis,
              pricingBasisLabel: pricing.pricingBasisLabel,
              packSizeLabel: pricing.packSizeLabel,
              packSizeUnknown: pricing.packSizeUnknown,
              packsNeeded: pricing.packsNeeded,
              purchasableCost: pricing.purchasableCost,
              consumptionCost: pricing.consumptionCost,
              confidence: 95,
              searchQuery: mapped.productName,
              source: 'mapping',
            };
          } else if (best) {
            const parsedPrice = parseFloat(best.price);
            if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
              const pricing = computeQuantityAwarePricing(parsedPrice, best.name, best.unitQty, input.amount, input.unit);
              matches[ck] = {
                itemCode: best.itemCode,
                productName: best.name,
                price: pricing.purchasableCost,
                unitPrice: parsedPrice,
                unitQty: best.unitQty || null,
                pricingBasis: pricing.pricingBasis,
                pricingBasisLabel: pricing.pricingBasisLabel,
                packSizeLabel: pricing.packSizeLabel,
                packSizeUnknown: pricing.packSizeUnknown,
                packsNeeded: pricing.packsNeeded,
                purchasableCost: pricing.purchasableCost,
                consumptionCost: pricing.consumptionCost,
                confidence: best.confidence,
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
            chainTotals[ck].purchasableTotal = Math.round((chainTotals[ck].purchasableTotal + matches[ck]!.purchasableCost) * 100) / 100;
            chainTotals[ck].consumptionTotal = Math.round((chainTotals[ck].consumptionTotal + matches[ck]!.consumptionCost) * 100) / 100;
            chainTotals[ck].estimatedTotal = chainTotals[ck].purchasableTotal;
            chainTotals[ck].matchedCount += 1;
            if (matches[ck]!.packSizeUnknown) {
              chainTotals[ck].hasUnknownPackSize = true;
            }
          } else {
            chainTotals[ck].missingItems.push(query);
          }
        })
      );

      items.push({
        itemId,
        query,
        normalizedQuery,
        amount: input.amount,
        unit: input.unit,
        dietaryConstraints: constraints,
        matches,
      });
    }

    const totalCount = parsedInputs.length;
    for (const ck of chainKeys) {
      const c = chainTotals[ck];
      c.missingCount = totalCount - c.matchedCount;
      c.isCompleteBasket = totalCount > 0 && c.matchedCount === totalCount;
      if (c.missingCount > 0) {
        c.exclusionsNote = `הערכה חלקית (${c.matchedCount}/${totalCount} מצרכים) — ${c.missingCount} מצרכים חסרים לא נכללים בסכום`;
      }
    }

    // Strict comparability gate:
    // Only flag cheapest when:
    // 1. Basket is complete (matchedCount === totalCount) OR all active chains matched the exact same count
    // 2. At least two active chains have valid totals to compare
    const activeChainsWithMatches = Object.values(chainTotals).filter((c) => c.matchedCount > 0 && c.purchasableTotal > 0);
    const completeChains = Object.values(chainTotals).filter((c) => c.isCompleteBasket && c.purchasableTotal > 0);

    if (completeChains.length >= 2) {
      completeChains.sort((a, b) => a.purchasableTotal - b.purchasableTotal);
      completeChains[0].isCheapest = true;
    } else if (completeChains.length === 1 && activeChainsWithMatches.length === 1) {
      // only one chain has products at all - no competitor to compare against, leave false
    } else if (totalCount > 0 && activeChainsWithMatches.length >= 2) {
      const maxMatched = Math.max(...activeChainsWithMatches.map((c) => c.matchedCount));
      const tiedChains = activeChainsWithMatches.filter((c) => c.matchedCount === maxMatched && maxMatched === totalCount);
      if (tiedChains.length >= 2) {
        tiedChains.sort((a, b) => a.purchasableTotal - b.purchasableTotal);
        tiedChains[0].isCheapest = true;
      }
    }

    return { minMatchConfidence: MIN_MATCH_CONFIDENCE, chainTotals, items };
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
