export interface BasketIngredientInput {
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  group?: string | null;
  category?: string | null;
  qtyMode?: string | null;
  qtySource?: string | null;
}

export interface BasketQuantityPart {
  amount: number | null;
  unit: string;
  toTaste: boolean;
  displayText: string;
}

export interface NormalizedBasketItem {
  id: string;
  searchQuery: string;
  displayName: string;
  category: string;
  quantityParts: BasketQuantityPart[];
  displayQuantity: string;
  originalLines: string[];
  hasAtHome: boolean;
}

const UNITS_TO_STRIP = new Set([
  'גרם', 'גר', 'ג', 'ג׳', "ג'",
  'ק"ג', 'ק״ג', 'קג', 'קילו', 'קילוגרם',
  'מ"ל', 'מ״ל', 'מל', 'ליטר', 'ל', 'ליטרים',
  'כוס', 'כוסות',
  'כף', 'כפות',
  'כפית', 'כפיות',
  'יחידה', 'יחידות', 'יח', "יח'", 'יח׳',
  'קורט', 'קמצוץ',
  'חבילה', 'חבילות', 'שקית', 'שקיות', 'קופסה', 'קופסאות', 'גביע', 'גביעים', 'פחית', 'פחיות', 'צנצנת',
  'שן', 'שיניים', 'שיני', 'ענף', 'ענפים', 'צרור', 'צרורות', 'פרוסה', 'פרוסות', 'עלה', 'עלים',
  'g', 'gr', 'gram', 'grams', 'kg', 'ml', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'pcs', 'piece', 'pieces',
]);

const MODIFIERS_TO_STRIP = new Set([
  'גדול', 'גדולה', 'גדולים', 'גדולות',
  'קטן', 'קטנה', 'קטנים', 'קטנות',
  'בינוני', 'בינונית', 'בינוניים', 'בינוניות',
  'טרי', 'טרייה', 'טריים', 'טריות',
  'קצוץ', 'קצוצה', 'קצוצים', 'קצוצות', 'קצוץ דק',
  'מגורד', 'מגורדת', 'מגורדים', 'מגורדות', 'מגורר', 'מגוררת', 'מגוררים',
  'כתוש', 'כתושה', 'כתושים', 'כתושות',
  'פרוס', 'פרוסה', 'פרוסים', 'פרוסות',
  'טחון', 'טחונה', 'טחונים', 'טחונות',
  'חתוך', 'חתוכה', 'חתוכים', 'חתוכות', 'לקוביות',
  'קלוף', 'קלופה', 'קלופים', 'מקולף', 'מקולפת', 'מקולפים',
  'שטוף', 'שטופה', 'שטופים',
  'מומס', 'מומסת', 'רך', 'רכה', 'קפוא', 'קפואה', 'קפואים',
  'מבושל', 'מבושלת', 'אפוי', 'קלוי', 'קלויה', 'קלויים',
  'מאוד', 'דק', 'גס',
  'אופציונלי', 'להגשה', 'לקישוט', 'לטיגון', 'לאפייה',
  'fresh', 'chopped', 'minced', 'diced', 'sliced', 'grated', 'large', 'medium', 'small', 'optional',
]);

export function normalizeUnitKey(rawUnit?: string | null): string {
  const clean = String(rawUnit || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean === 'גר' || clean === 'ג׳' || clean === "ג'" || clean === 'g' || clean === 'gr' || clean === 'gram' || clean === 'grams') return 'גרם';
  if (clean === 'ק״ג' || clean === 'ק"ג' || clean === 'קג' || clean === 'קילו' || clean === 'קילוגרם' || clean === 'kg') return 'ק"ג';
  if (clean === 'מ״ל' || clean === 'מ"ל' || clean === 'מל' || clean === 'ml') return 'מ"ל';
  if (clean === 'ליטרים' || clean === 'l' || clean === 'liter' || clean === 'liters') return 'ליטר';
  if (clean === 'כוסות' || clean === 'cup' || clean === 'cups') return 'כוסות';
  if (clean === 'כוס') return 'כוס';
  if (clean === 'כפות' || clean === 'tbsp') return 'כפות';
  if (clean === 'כף') return 'כף';
  if (clean === 'כפיות' || clean === 'tsp') return 'כפיות';
  if (clean === 'כפית') return 'כפית';
  if (clean === 'יחידה' || clean === 'יחידות' || clean === "יח'" || clean === 'יח׳') return 'יחידות';
  return clean;
}

export function normalizeIngredientForSearch(item: string | BasketIngredientInput): string {
  const rawName = typeof item === 'string' ? item : String(item?.name || '');
  // Remove parenthetical prep comments e.g. "(לטיגון)" or "(לא חובה)"
  let cleaned = rawName
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/לפי הטעם|לפי הצורך|לא חובה|להגשה|לקישוט/g, ' ')
    // Strip leading numeric quantities / fractions / ranges
    .replace(/^[\d.,/½¼¾⅓⅔\-\s]+/, ' ')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'");

  // Tokenize carefully: strip unit tokens and prep modifiers while keeping meaningful food words
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/^[,.:;!?]+|[,.:;!?]+$/g, ''))
    .filter(Boolean);

  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    // Skip pure numbers / fractions / symbols
    if (/^[\d.,/½¼¾⅓⅔\-]+$/.test(token)) continue;
    // Strip unit words at the beginning (or attached single-word unit tokens)
    if (UNITS_TO_STRIP.has(lower)) continue;
    if (MODIFIERS_TO_STRIP.has(lower)) continue;
    kept.push(token);
  }

  const result = kept.join(' ').replace(/\s+/g, ' ').trim();
  return result || rawName.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseNumericAmount(rawAmount: unknown): number | null {
  if (typeof rawAmount === 'number') {
    return Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null;
  }
  if (typeof rawAmount === 'string') {
    const trimmed = rawAmount.trim();
    if (!trimmed) return null;
    if (trimmed === '½') return 0.5;
    if (trimmed === '¼') return 0.25;
    if (trimmed === '¾') return 0.75;
    if (trimmed === '⅓') return 0.33;
    if (trimmed === '⅔') return 0.67;
    if (/^\d+\/\d+$/.test(trimmed)) {
      const [num, den] = trimmed.split('/').map(Number);
      return den > 0 ? num / den : null;
    }
    const n = Number.parseFloat(trimmed.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function formatScaledAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatOriginalIngredientLine(ing: BasketIngredientInput, multiplier: number): string {
  if (ing.qtyMode === 'to_taste' || String(ing.amount || '').trim() === 'לפי הטעם') {
    return `${ing.name} (לפי הטעם)`;
  }
  const num = parseNumericAmount(ing.amount);
  const unit = String(ing.unit || '').trim();
  if (num !== null) {
    const scaled = formatScaledAmount(num * multiplier);
    return [scaled, unit, ing.name].filter(Boolean).join(' ');
  }
  return [unit, ing.name].filter(Boolean).join(' ').trim();
}

export function buildIngredientBasket(
  recipes: Array<{ ingredients?: BasketIngredientInput[] }>,
  multiplier = 1
): NormalizedBasketItem[] {
  const safeMult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const groups = new Map<
    string,
    {
      searchQuery: string;
      displayName: string;
      category: string;
      partsByUnit: Map<string, { amount: number | null; unit: string; toTaste: boolean }>;
      originalLines: string[];
    }
  >();

  for (const recipe of recipes || []) {
    const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
    for (const ing of list) {
      if (!ing || !String(ing.name || '').trim()) continue;
      const searchQuery = normalizeIngredientForSearch(ing);
      if (!searchQuery) continue;

      const groupKey = searchQuery.toLowerCase();
      let entry = groups.get(groupKey);
      if (!entry) {
        entry = {
          searchQuery,
          displayName: searchQuery,
          category: String(ing.category || 'אחר'),
          partsByUnit: new Map(),
          originalLines: [],
        };
        groups.set(groupKey, entry);
      }

      const originalLine = formatOriginalIngredientLine(ing, safeMult);
      if (originalLine && !entry.originalLines.includes(originalLine)) {
        entry.originalLines.push(originalLine);
      }

      const isToTaste = ing.qtyMode === 'to_taste' || String(ing.amount || '').trim() === 'לפי הטעם';
      if (isToTaste) {
        if (!entry.partsByUnit.has('__to_taste__')) {
          entry.partsByUnit.set('__to_taste__', { amount: null, unit: '', toTaste: true });
        }
        continue;
      }

      const num = parseNumericAmount(ing.amount);
      const rawUnit = String(ing.unit || '').trim();
      const normUnit = normalizeUnitKey(rawUnit);

      if (num === null) {
        const key = `__unmeasured__:${normUnit}`;
        if (!entry.partsByUnit.has(key)) {
          entry.partsByUnit.set(key, { amount: null, unit: rawUnit, toTaste: false });
        }
        continue;
      }

      const scaledAmount = num * safeMult;
      // Combine amounts ONLY when normalized unit is identical; never convert incompatible units (e.g. cups vs grams).
      const unitBucketKey = `unit:${normUnit}`;
      const existingPart = entry.partsByUnit.get(unitBucketKey);
      if (existingPart && existingPart.amount !== null) {
        existingPart.amount += scaledAmount;
      } else {
        entry.partsByUnit.set(unitBucketKey, {
          amount: scaledAmount,
          unit: rawUnit || normUnit,
          toTaste: false,
        });
      }
    }
  }

  const basket: NormalizedBasketItem[] = [];
  for (const [key, entry] of groups.entries()) {
    const quantityParts: BasketQuantityPart[] = [];
    for (const part of entry.partsByUnit.values()) {
      if (part.toTaste) {
        quantityParts.push({ amount: null, unit: '', toTaste: true, displayText: 'לפי הטעם' });
      } else if (part.amount !== null) {
        const formatted = formatScaledAmount(part.amount);
        quantityParts.push({
          amount: Math.round(part.amount * 100) / 100,
          unit: part.unit,
          toTaste: false,
          displayText: part.unit ? `${formatted} ${part.unit}` : formatted,
        });
      } else if (part.unit) {
        quantityParts.push({ amount: null, unit: part.unit, toTaste: false, displayText: part.unit });
      }
    }

    const displayQuantity = quantityParts.map((p) => p.displayText).filter(Boolean).join(' + ');

    basket.push({
      id: key,
      searchQuery: entry.searchQuery,
      displayName: entry.displayName,
      category: entry.category,
      quantityParts,
      displayQuantity,
      originalLines: entry.originalLines,
      hasAtHome: false,
    });
  }

  return basket;
}
