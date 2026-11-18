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

export interface PreparedShoppingItem {
  id: string;
  shoppingName: string;
  searchQuery: string;
  displayName: string;
  originalRecipeRequirement: string;
  originalLines: string[];
  displayQuantity: string;
  quantityParts: BasketQuantityPart[];
  amount: number | null;
  unit: string;
  category: string;
  requiresUserReview: boolean;
  conversionNote: string | null;
  alternatives: string[];
  selectedAlternative: string | null;
  dietaryConstraints: string[];
  sourceRecipeIds: string[];
  sourceRecipeTitles: string[];
  hasAtHome: boolean;
  haveAtHome?: boolean;
  excluded?: boolean;
  removed?: boolean;
}

export const DIETARY_CONSTRAINTS = [
  'ללא גלוטן',
  'טבעוני',
  'ללא לקטוז',
  'כשר לפסח',
  'ללא סוכר',
  'קמח מלא',
  'כוסמין',
  'אורגני',
] as const;

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

const PURCHASABLE_EXTRA_MODIFIERS = new Set([
  'גרוס', 'גרוסה', 'גרוסים', 'גרוסות',
  'שלם', 'שלמה', 'שלמים', 'שלמות',
  'חם', 'חמים', 'חמה', 'קר', 'קרים', 'קרה',
  'בטמפרטורת', 'החדר',
]);

const KNOWN_SPLIT_SECOND_ITEMS = [
  'פלפל שחור',
  'פלפל לבן',
  'פלפל אנגלי',
  'פלפל',
  'מלח',
  'מיונז',
  'קטשופ',
  'חרדל',
  'סריראצ\'ה',
  'סריראצה',
  'טחינה',
  'כוסברה',
  'פטרוזיליה',
  'שמיר',
  'נענע',
  'בזיליקום',
  'שום',
  'בצל',
  'לימון',
  'חומץ',
  'סוכר',
  'קינמון',
  'כמון',
  'פפריקה',
];

export function extractDietaryConstraints(rawText: string): string[] {
  const text = String(rawText || '')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'");
  if (!text.trim()) return [];

  const found: string[] = [];
  const add = (c: string) => {
    if (!found.includes(c)) found.push(c);
  };

  if (/ללא\s+גלוטן|נטול\s+גלוטן/.test(text)) add('ללא גלוטן');
  if (/טבעוני(?:ת|ים|ות)?/.test(text)) add('טבעוני');
  if (/ללא\s+לקטוז|נטול\s+לקטוז/.test(text)) add('ללא לקטוז');
  if (/כשר\s+לפסח|כשל"פ/.test(text)) add('כשר לפסח');
  if (/ללא\s+(?:תוספת\s+)?סוכר/.test(text)) add('ללא סוכר');
  if (/קמח\s+מלא|מחיטה\s+מלאה/.test(text)) add('קמח מלא');
  if (/כוסמין/.test(text)) add('כוסמין');
  if (/אורגני(?:ת|ים|ות)?/.test(text)) add('אורגני');

  return found;
}

export function isSectionHeaderIngredient(ing: BasketIngredientInput | string): boolean {
  const rawName = (typeof ing === 'string' ? ing : String(ing?.name || '')).trim();
  if (!rawName) return true;

  const hasNumericAmount =
    typeof ing === 'object' && ing !== null && parseNumericAmount(ing.amount) !== null;
  const hasUnit =
    typeof ing === 'object' && ing !== null && Boolean(String(ing.unit || '').trim());

  if (!hasNumericAmount && !hasUnit) {
    if (rawName.endsWith(':')) return true;
    if (
      /^(?:לרוטב|לבצק|למילוי|לציפוי|לקרם|לסירופ|לסלט|לתיבול|להגשה|לקישוט|למרינדה|לתערובת|לשכבה|לפסטה|למרק|למוקפץ)\s*:?$/.test(
        rawName
      )
    ) {
      return true;
    }
  }
  return false;
}

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
  const constraintsInParens = extractDietaryConstraints(
    (rawName.match(/\([^)]*\)/g) || []).join(' ')
  );

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

  let result = kept.join(' ').replace(/\s+/g, ' ').trim();
  for (const c of constraintsInParens) {
    if (result && !result.includes(c)) {
      result = `${result} ${c}`.trim();
    }
  }
  return result || rawName.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePurchasableTokenString(raw: string, dietaryConstraints: string[] = []): string {
  const base = normalizeIngredientForSearch(raw);
  const tokens = base
    .split(/\s+/)
    .map((t) => t.replace(/^[,.:;!?]+|[,.:;!?]+$/g, ''))
    .filter((t) => Boolean(t) && !PURCHASABLE_EXTRA_MODIFIERS.has(t.toLowerCase()));

  let name = tokens.join(' ').replace(/\s+/g, ' ').trim();

  // Canonicalize standalone egg singular to plural purchasable form
  if (name === 'ביצה') {
    name = 'ביצים';
  }
  // Strip optional "גבינת " prefix on Pecorino / Parmesan when normalizing purchasable cheese names
  if (/^גבינת\s+(פקורינו|פרמזן|גראנה\s+פדאנו|מסקרפונה|ריקוטה|מוצרלה)\b/.test(name)) {
    name = name.replace(/^גבינת\s+/, '');
  }
  // Canonicalize "מלח ים" -> "מלח" unless special salt
  if (name === 'מלח ים' || name === 'מלח שולחן' || name === 'מלח דק' || name === 'מלח גס') {
    name = 'מלח';
  }

  for (const constraint of dietaryConstraints) {
    if (name && !name.includes(constraint)) {
      if (constraint === 'קמח מלא' && name.includes('קמח')) {
        if (!name.includes('מלא')) name = `${name} מלא`;
      } else {
        name = `${name} ${constraint}`.trim();
      }
    }
  }

  return name;
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

function extractLeadingAmountAndUnitFromName(rawName: string): {
  amount: number | null;
  unit: string;
  restName: string;
} {
  const trimmed = String(rawName || '').trim();
  const match = trimmed.match(
    /^(\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾⅓⅔])\s*(גרם|גר|ג׳|ג'|ק"ג|ק״ג|קג|קילו|קילוגרם|מ"ל|מ״ל|מל|ליטר|כוסות|כוס|כפות|כף|כפיות|כפית|יחידות|יחידה|יח'|יח׳|שן|שיני|שיניים)?\s+(.+)$/
  );
  if (!match) {
    return { amount: null, unit: '', restName: trimmed };
  }
  return {
    amount: parseNumericAmount(match[1]),
    unit: match[2] || '',
    restName: match[3].trim(),
  };
}

function formatScaledAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatOriginalIngredientLine(ing: BasketIngredientInput, multiplier: number): string {
  const cleanName = String(ing.name || '')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .trim();

  const isToTaste =
    ing.qtyMode === 'to_taste' ||
    String(ing.amount || '').trim() === 'לפי הטעם' ||
    /לפי הטעם/.test(cleanName);

  if (isToTaste) {
    const baseName = cleanName.replace(/\s*\(?לפי הטעם\)?\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return `${baseName} (לפי הטעם)`;
  }

  let num = parseNumericAmount(ing.amount);
  let unit = String(ing.unit || '').trim();
  let displayIngName = cleanName;

  if (num === null) {
    const parsedFromName = extractLeadingAmountAndUnitFromName(cleanName);
    if (parsedFromName.amount !== null) {
      num = parsedFromName.amount;
      if (!unit && parsedFromName.unit) unit = parsedFromName.unit;
      displayIngName = parsedFromName.restName;
    }
  }

  if (num !== null) {
    const scaled = formatScaledAmount(num * multiplier);
    return [scaled, unit, displayIngName].filter(Boolean).join(' ');
  }
  return [unit, displayIngName].filter(Boolean).join(' ').trim();
}

interface SplitPreparedCandidate {
  shoppingName: string;
  alternatives: string[];
  requiresUserReview: boolean;
  conversionNote: string | null;
  dietaryConstraints: string[];
  wasSplitFromCombined: boolean;
}

function analyzeAndTransformIngredientName(rawName: string): SplitPreparedCandidate[] {
  const stdName = String(rawName || '')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .trim();
  const dietaryConstraints = extractDietaryConstraints(stdName);

  // Strip "לפי הטעם" and trailing punctuation for structural inspection
  const withoutToTaste = stdName
    .replace(/\(\s*לפי הטעם\s*\)/g, ' ')
    .replace(/לפי הטעם|לפי הצורך/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Check Combined Salt & Pepper first (e.g. "מלח ופלפל שחור", "מלח ופלפל", "מלח גס ופלפל שחור גרוס")
  const withoutParens = withoutToTaste.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\bמלח\b/.test(withoutParens) && /\bו-?פלפל\b|,\s*פלפל\b/.test(withoutParens)) {
    const pepperVariant = /\bפלפל\s+לבן\b/.test(withoutParens)
      ? 'פלפל לבן'
      : /\bפלפל\s+אנגלי\b/.test(withoutParens)
      ? 'פלפל אנגלי'
      : 'פלפל שחור';
    return [
      {
        shoppingName: 'מלח',
        alternatives: [],
        requiresUserReview: false,
        conversionNote: null,
        dietaryConstraints,
        wasSplitFromCombined: true,
      },
      {
        shoppingName: pepperVariant,
        alternatives: [],
        requiresUserReview: false,
        conversionNote: null,
        dietaryConstraints,
        wasSplitFromCombined: true,
      },
    ];
  }

  // 2. Check general combined ingredients "<item1> ו<item2>" (e.g. "סריראצ'ה ומיונז")
  for (const secondItem of KNOWN_SPLIT_SECOND_ITEMS) {
    const escapedSecond = secondItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^(.+?)\\s+ו-?(${escapedSecond})(?:\\s+.*)?$`, 'i');
    const match = withoutParens.match(regex);
    if (match) {
      const leftClean = normalizePurchasableTokenString(match[1], dietaryConstraints);
      let rightClean = normalizePurchasableTokenString(match[2], dietaryConstraints);
      if (leftClean === 'מלח' && rightClean === 'פלפל') {
        rightClean = 'פלפל שחור';
      }
      if (leftClean && rightClean && leftClean !== rightClean) {
        return [
          {
            shoppingName: leftClean,
            alternatives: [],
            requiresUserReview: false,
            conversionNote: null,
            dietaryConstraints,
            wasSplitFromCombined: true,
          },
          {
            shoppingName: rightClean,
            alternatives: [],
            requiresUserReview: false,
            conversionNote: null,
            dietaryConstraints,
            wasSplitFromCombined: true,
          },
        ];
      }
    }
  }

  // 3. Check Cooking Form -> Purchasable Form conversions
  // 3a. Egg yolks / egg whites -> "ביצים"
  if (/(?:חלמונים|חלמון(?:\s+ביצה)?|חלמוני\s+ביצה|חלבונים|חלבון(?:\s+ביצה)?|חלבוני\s+ביצה)/.test(withoutParens)) {
    const eggName = normalizePurchasableTokenString('ביצים', dietaryConstraints);
    return [
      {
        shoppingName: eggName,
        alternatives: [],
        requiresUserReview: true,
        conversionNote: 'המתכון דורש חלמונים/חלבונים — הומר לביצים לקנייה (מומלץ לבדוק כמות מארז)',
        dietaryConstraints,
        wasSplitFromCombined: false,
      },
    ];
  }

  // 3b. Lemon zest / fresh lemon juice -> "לימון"
  if (/(?:גרידת\s+לימון|קליפת\s+לימון|מיץ\s+לימון(?:\s+טרי)?|מיץ\s+מלימון|גרידה\s+מלימון)/.test(withoutParens)) {
    const lemonName = normalizePurchasableTokenString('לימון', dietaryConstraints);
    return [
      {
        shoppingName: lemonName,
        alternatives: [],
        requiresUserReview: true,
        conversionNote: 'הומר ממיץ/גרידת לימון ללימון שלם',
        dietaryConstraints,
        wasSplitFromCombined: false,
      },
    ];
  }

  // 4. Check Alternatives
  // 4a. Parenthetical alternative e.g. "פקורינו רומנו (או פרמזן)"
  const parenAltMatch = withoutToTaste.match(/^(.*?)\(\s*או\s+([^)]+)\)(.*)$/);
  if (parenAltMatch) {
    const mainRaw = `${parenAltMatch[1]} ${parenAltMatch[3]}`.trim();
    const altRaw = parenAltMatch[2].trim();
    const mainClean = normalizePurchasableTokenString(mainRaw, dietaryConstraints);
    const altParts = altRaw
      .split(/\s+או\s+/)
      .map((p) => normalizePurchasableTokenString(p, dietaryConstraints))
      .filter((p) => Boolean(p) && !MODIFIERS_TO_STRIP.has(p));

    const alternatives = Array.from(new Set([mainClean, ...altParts].filter(Boolean)));
    if (alternatives.length >= 2) {
      return [
        {
          shoppingName: alternatives[0],
          alternatives,
          requiresUserReview: true,
          conversionNote: null,
          dietaryConstraints,
          wasSplitFromCombined: false,
        },
      ];
    }
  }

  // 4b. Inline " או " e.g. "גואנצ׳אלה או פנצ׳טה", "שמנת מתוקה או קרם קוקוס", "פסטה פוזילי או פנה"
  if (/\s+או\s+/.test(withoutParens)) {
    const rawParts = withoutParens.split(/\s+או\s+/);
    const alternatives = Array.from(
      new Set(
        rawParts
          .map((part) => normalizePurchasableTokenString(part, dietaryConstraints))
          .filter(Boolean)
      )
    );
    if (alternatives.length >= 2) {
      return [
        {
          shoppingName: alternatives[0],
          alternatives,
          requiresUserReview: true,
          conversionNote: null,
          dietaryConstraints,
          wasSplitFromCombined: false,
        },
      ];
    }
  }

  // 5. Standard single ingredient
  const shoppingName = normalizePurchasableTokenString(withoutToTaste, dietaryConstraints);
  return [
    {
      shoppingName,
      alternatives: [],
      requiresUserReview: false,
      conversionNote: null,
      dietaryConstraints,
      wasSplitFromCombined: false,
    },
  ];
}

export function prepareShoppingIngredients(
  input:
    | Array<{
        id?: string;
        title?: string;
        servings?: number;
        ingredients?: Array<BasketIngredientInput | string>;
      }>
    | Array<BasketIngredientInput | string>,
  multiplier = 1
): PreparedShoppingItem[] {
  const safeMult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;

  let recipes: Array<{
    id?: string;
    title?: string;
    servings?: number;
    ingredients?: Array<BasketIngredientInput | string>;
  }>;

  if (
    Array.isArray(input) &&
    input.length > 0 &&
    (typeof input[0] === 'string' || (input[0] && typeof input[0] === 'object' && 'name' in input[0] && !('ingredients' in input[0])))
  ) {
    recipes = [{ ingredients: input as Array<BasketIngredientInput | string> }];
  } else {
    recipes = (input as any) || [];
  }

  const groups = new Map<
    string,
    {
      shoppingName: string;
      category: string;
      partsByUnit: Map<string, { amount: number | null; unit: string; toTaste: boolean }>;
      originalLines: string[];
      requiresUserReview: boolean;
      conversionNotes: string[];
      alternatives: string[];
      dietaryConstraints: string[];
      sourceRecipeIds: string[];
      sourceRecipeTitles: string[];
      wasConvertedFromEggPart: boolean;
    }
  >();

  for (const recipe of recipes || []) {
    const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
    for (const rawIng of list) {
      const ing: BasketIngredientInput =
        typeof rawIng === 'string' ? { name: rawIng } : rawIng;
      if (!ing || !String(ing.name || '').trim()) continue;
      if (isSectionHeaderIngredient(ing)) continue;

      const originalLine = formatOriginalIngredientLine(ing, safeMult);
      const candidates = analyzeAndTransformIngredientName(ing.name);

      let numericAmount = parseNumericAmount(ing.amount);
      let rawUnit = String(ing.unit || '').trim();
      if (numericAmount === null) {
        const extracted = extractLeadingAmountAndUnitFromName(ing.name);
        if (extracted.amount !== null) {
          numericAmount = extracted.amount;
          if (!rawUnit && extracted.unit) rawUnit = extracted.unit;
        }
      }

      const isToTaste =
        ing.qtyMode === 'to_taste' ||
        String(ing.amount || '').trim() === 'לפי הטעם' ||
        /לפי הטעם/.test(String(ing.name || ''));

      for (const cand of candidates) {
        if (!cand.shoppingName) continue;
        const groupKey = cand.shoppingName.toLowerCase();
        let entry = groups.get(groupKey);
        if (!entry) {
          entry = {
            shoppingName: cand.shoppingName,
            category: String(ing.category || 'אחר'),
            partsByUnit: new Map(),
            originalLines: [],
            requiresUserReview: false,
            conversionNotes: [],
            alternatives: [],
            dietaryConstraints: [],
            sourceRecipeIds: [],
            sourceRecipeTitles: [],
            wasConvertedFromEggPart: false,
          };
          groups.set(groupKey, entry);
        }

        if (originalLine && !entry.originalLines.includes(originalLine)) {
          entry.originalLines.push(originalLine);
        }
        if (cand.requiresUserReview) {
          entry.requiresUserReview = true;
        }
        if (cand.conversionNote && !entry.conversionNotes.includes(cand.conversionNote)) {
          entry.conversionNotes.push(cand.conversionNote);
        }
        if (cand.conversionNote && cand.shoppingName.startsWith('ביצים')) {
          entry.wasConvertedFromEggPart = true;
        }
        for (const alt of cand.alternatives) {
          if (!entry.alternatives.includes(alt)) {
            entry.alternatives.push(alt);
          }
        }
        for (const dc of cand.dietaryConstraints) {
          if (!entry.dietaryConstraints.includes(dc)) {
            entry.dietaryConstraints.push(dc);
          }
        }
        if (recipe.id && !entry.sourceRecipeIds.includes(recipe.id)) {
          entry.sourceRecipeIds.push(recipe.id);
        }
        if (recipe.title && !entry.sourceRecipeTitles.includes(recipe.title)) {
          entry.sourceRecipeTitles.push(recipe.title);
        }

        if (isToTaste || cand.wasSplitFromCombined && numericAmount === null) {
          if (!entry.partsByUnit.has('__to_taste__')) {
            entry.partsByUnit.set('__to_taste__', { amount: null, unit: '', toTaste: true });
          }
          continue;
        }

        const normUnit = normalizeUnitKey(rawUnit);
        if (numericAmount === null) {
          const key = `__unmeasured__:${normUnit}`;
          if (!entry.partsByUnit.has(key)) {
            entry.partsByUnit.set(key, { amount: null, unit: rawUnit, toTaste: false });
          }
          continue;
        }

        const scaledAmount = numericAmount * safeMult;
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
  }

  const prepared: PreparedShoppingItem[] = [];
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
    const measuredPart = quantityParts.find((p) => p.amount !== null);

    prepared.push({
      id: key,
      shoppingName: entry.shoppingName,
      searchQuery: entry.shoppingName,
      displayName: entry.shoppingName,
      originalRecipeRequirement: entry.originalLines.join(', '),
      originalLines: entry.originalLines,
      displayQuantity,
      quantityParts,
      amount: measuredPart ? measuredPart.amount : null,
      unit: measuredPart ? normalizeUnitKey(measuredPart.unit) || measuredPart.unit : '',
      category: entry.category,
      requiresUserReview: entry.requiresUserReview,
      conversionNote: entry.conversionNotes.length > 0 ? entry.conversionNotes.join(' | ') : null,
      alternatives: entry.alternatives,
      selectedAlternative: entry.alternatives.length > 0 ? entry.shoppingName : null,
      dietaryConstraints: entry.dietaryConstraints,
      sourceRecipeIds: entry.sourceRecipeIds,
      sourceRecipeTitles: entry.sourceRecipeTitles,
      hasAtHome: false,
      haveAtHome: false,
      excluded: false,
      removed: false,
    });
  }

  return prepared;
}

export function buildCleanStorePasteList(
  items: Array<{
    shoppingName?: string;
    displayName?: string;
    searchQuery?: string;
    name?: string;
    excluded?: boolean;
    haveAtHome?: boolean;
    hasAtHome?: boolean;
    removed?: boolean;
  }>
): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const item of items || []) {
    if (!item || item.excluded || item.haveAtHome || item.hasAtHome || item.removed) {
      continue;
    }
    const raw = String(
      item.shoppingName || item.displayName || item.searchQuery || item.name || ''
    ).trim();
    if (!raw) continue;

    const dietary = extractDietaryConstraints(raw);
    // Strip bullets, checkboxes, numbering, parenthetical notes, and dash commentary
    const stripped = raw
      .replace(/^[\s•\-*✓✔☑☐[\]xX\d.)(]+/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\s+[—–-]\s+.*$/, ' ')
      .trim();

    const cleanName = normalizePurchasableTokenString(stripped, dietary);
    if (!cleanName) continue;

    const dedupeKey = cleanName.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      lines.push(cleanName);
    }
  }

  return lines.join('\n');
}

export function buildPersonalReferenceList(
  items: Array<{
    shoppingName?: string;
    displayName?: string;
    displayQuantity?: string;
    originalRecipeRequirement?: string;
    conversionNote?: string | null;
    excluded?: boolean;
    haveAtHome?: boolean;
    hasAtHome?: boolean;
    removed?: boolean;
  }>
): string {
  const lines: string[] = [];

  for (const item of items || []) {
    if (!item || item.excluded || item.haveAtHome || item.hasAtHome || item.removed) {
      continue;
    }
    const name = String(item.shoppingName || item.displayName || '').trim();
    if (!name) continue;

    const qty = String(item.displayQuantity || '').trim();
    const orig = String(item.originalRecipeRequirement || '').trim();
    const note = String(item.conversionNote || '').trim();

    let line = `• ${name}`;
    if (qty) {
      line += ` — ${qty}`;
    }
    if (orig && orig !== name && orig !== `${qty} ${name}`.trim()) {
      line += ` (מתכון: ${orig})`;
    }
    if (note) {
      line += ` [${note}]`;
    }
    lines.push(line);
  }

  return lines.join('\n');
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
      if (isSectionHeaderIngredient(ing)) continue;
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
