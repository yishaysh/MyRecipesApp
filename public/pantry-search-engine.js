/**
 * Pantry Search Engine ("What can I cook?")
 * Standalone, zero-dependency, zero-DOM, zero-network ES module
 * providing Hebrew/Latin ingredient normalization, conservative matching,
 * recipe-derived autocomplete indexing, and pantry-based recipe ranking.
 */

export const DEFAULT_STAPLES = [
  'מלח',
  'פלפל',
  'פלפל שחור',
  'פלפל לבן',
  'שמן',
  'שמן זית',
  'שמן קנולה',
  'שמן צמחי',
  'מים',
];

const NIQQUD_REGEX = /[\u0591-\u05C7]/g;
const PARENTHETICAL_REGEX = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g;
const TO_TASTE_REGEX = /(?:לפי\s+ה?טעם|\bto\s+taste\b)/i;
const TO_TASTE_GLOBAL_REGEX = /(?:לפי\s+ה?טעם|\bto\s+taste\b)/gi;
const QUANTITY_REGEX =
  /(?:\d+(?:[.,/]\d+)?(?:\s*[-–—]\s*\d+(?:[.,/]\d+)?)?|[½¼¾⅓⅔⅛⅜⅝⅞])/g;
const QUOTES_REGEX = /["'״׳`]/g;
const PUNCTUATION_REGEX = /[,.;:!?/\\\-–—_*+~|•·()[\]{}]/g;
const HEBREW_LETTER_REGEX = /^[\u05D0-\u05EA]+$/;

const MEASUREMENT_UNITS = new Set([
  // Hebrew units and quantity words
  'כוס',
  'כוסות',
  'כף',
  'כפות',
  'כפית',
  'כפיות',
  'גרם',
  'גר',
  'קג',
  'קילו',
  'קילוגרם',
  'מל',
  'ליטר',
  'ליטרים',
  'יחידות',
  'יחידה',
  'יח',
  'חבילה',
  'חבילות',
  'חב',
  'קורט',
  'חופן',
  'חופנים',
  'שיני',
  'שן',
  'פרוסות',
  'פרוסה',
  'קופסה',
  'קופסא',
  'קופסאות',
  'פחית',
  'פחיות',
  'שקית',
  'שקיות',
  'צרור',
  'צרורות',
  'ענף',
  'ענפים',
  'גבעול',
  'גבעולים',
  'ראש',
  'ראשי',
  'קמצוץ',
  'חצי',
  'רבע',
  'שליש',
  'שני',
  'שתי',
  'של',
  'מעט',
  'קצת',
  // English units
  'cup',
  'cups',
  'tbsp',
  'tbs',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'g',
  'gr',
  'gram',
  'grams',
  'kg',
  'kilogram',
  'ml',
  'l',
  'liter',
  'liters',
  'litre',
  'litres',
  'oz',
  'lb',
  'lbs',
  'pinch',
  'clove',
  'cloves',
  'slice',
  'slices',
  'piece',
  'pieces',
  'can',
  'cans',
  'pack',
  'pkg',
  'bunch',
  'sprig',
  'sprigs',
  'of',
]);

const PREP_ADJECTIVES = new Set([
  // Hebrew prep, size, state, and temperature adjectives
  'קצוץ',
  'קצוצה',
  'קצוצים',
  'קצוצות',
  'פרוס',
  'פרוסה',
  'פרוסים',
  'פרוסות',
  'מגורד',
  'מגורדת',
  'מגורדים',
  'מגורדות',
  'מגורר',
  'מגוררת',
  'טרי',
  'טרייה',
  'טריה',
  'טריים',
  'טריות',
  'גדול',
  'גדולה',
  'גדולים',
  'גדולות',
  'קטן',
  'קטנה',
  'קטנים',
  'קטנות',
  'בינוני',
  'בינונית',
  'בינוניים',
  'בינוניות',
  'חתוך',
  'חתוכה',
  'חתוכים',
  'חתוכות',
  'טחון',
  'טחונה',
  'טחונים',
  'טחונות',
  'מבושל',
  'מבושלת',
  'מבושלים',
  'מבושלות',
  'מקולף',
  'מקולפת',
  'מקולפים',
  'מקולפות',
  'קלוף',
  'קלופה',
  'קלופים',
  'קלופות',
  'כתוש',
  'כתושה',
  'כתושים',
  'כתושות',
  'גרוס',
  'גרוסה',
  'גרוסים',
  'דק',
  'דקה',
  'דקים',
  'דקות',
  'גס',
  'גסה',
  'בשל',
  'בשלה',
  'בשלים',
  'בשלות',
  'איכותי',
  'איכותית',
  'איכותיים',
  'איכותיות',
  'יציב',
  'יציבה',
  'יציבים',
  'יציבות',
  'עסיסי',
  'עסיסית',
  'עסיסיים',
  'עסיסיות',
  'מובחר',
  'מובחרת',
  'מובחרים',
  'מובחרות',
  'טוב',
  'טובה',
  'טובים',
  'טובות',
  'שטוף',
  'שטופה',
  'שטופים',
  'שטופות',
  'שלם',
  'שלמה',
  'שלמים',
  'שלמות',
  'סחוט',
  'סחוטה',
  'חם',
  'חמה',
  'חמים',
  'חמות',
  'רותח',
  'רותחת',
  'רותחים',
  'רותחות',
  'קר',
  'קרה',
  'קרים',
  'קרות',
  'פושר',
  'פושרת',
  'פושרים',
  'פושרות',
  // English prep adjectives
  'chopped',
  'diced',
  'sliced',
  'minced',
  'grated',
  'fresh',
  'large',
  'medium',
  'small',
  'ground',
  'cooked',
  'peeled',
  'crushed',
  'fine',
  'finely',
  'coarse',
  'coarsely',
  'whole',
  'raw',
  'warm',
  'hot',
  'cold',
  'boiling',
]);

// Words starting with Hebrew 'ה' that must not have their first letter stripped.
const PROTECTED_HE_WORDS = new Set([
  'הל',
  'הודו',
  'היביסקוס',
  'המבורגר',
  'הימלאיה',
  'הולנדי',
  'הולנדית',
  'הלפניו',
]);

// Words starting with Hebrew 'ו' that must not have their first letter stripped.
const PROTECTED_VAV_WORDS = new Set([
  'וניל',
  'וודקה',
  'וואסבי',
  'וסאבי',
  'וופל',
  'ורד',
  'ורדים',
  'ויניגרט',
  'ויסקי',
  'וורצסטר',
  'וונטון',
]);

// Words starting with 'בה' or 'לה' that are root words, not preposition + article.
const PROTECTED_PREPOSITION_WORDS = new Set(['בהרט']);

// Compound phrases preserved intact to avoid destructive singularization.
const PROTECTED_PHRASES = new Set([
  'עגבניות שרי',
  'חזה עוף',
  'חמאת בוטנים',
  'שמן זית',
  'שמן קנולה',
  'שמן צמחי',
  'שמן שומשום',
  'שמן קוקוס',
  'חלב קוקוס',
  'חלב שקדים',
  'חלב סויה',
  'גבינת שמנת',
  'רוטב סויה',
  'רוטב עגבניות',
  'רסק עגבניות',
  'אבקת שום',
  'בצל ירוק',
  'בצל סגול',
  'פלפל שחור',
  'פלפל לבן',
  'פלפל אדום',
  'פלפל צהוב',
  'פלפל ירוק',
  'פלפל חריף',
  'קמח שקדים',
  'קמח תירס',
  'מיץ לימון',
  'מלח ים',
]);

// Conservative multi-word and single-word synonym map.
const SYNONYM_MAP = new Map([
  ['שיני שום', 'שום'],
  ['שן שום', 'שום'],
  ['שום כתוש', 'שום'],
  ['פפריקה מתוקה', 'פפריקה'],
  ['עגבנייה', 'עגבניה'],
  ['עגבניה', 'עגבניה'],
  ['עגבניות', 'עגבניה'],
  ['בצל לבן', 'בצל'],
  ['בצל צהוב', 'בצל'],
  ['בצל יבש', 'בצל'],
  ['קמח לבן', 'קמח'],
  ['קמח רגיל', 'קמח'],
  ['סוכר לבן', 'סוכר'],
  ['שמן זית כתית', 'שמן זית'],
  ['שמן זית כתית מעולה', 'שמן זית'],
  ['תפוחי אדמה', 'תפוח אדמה'],
  ['עשבי תיבול', 'עשב תיבול'],
  ['מי ברז', 'מים'],
]);

// Explicit Hebrew irregular and common cooking plural-to-singular mappings.
const WORD_CANONICAL_MAP = new Map([
  ['עגבניות', 'עגבניה'],
  ['עגבנייה', 'עגבניה'],
  ['בצלים', 'בצל'],
  ['ביצים', 'ביצה'],
  ['גזרים', 'גזר'],
  ['מלפפונים', 'מלפפון'],
  ['לימונים', 'לימון'],
  ['תפוחים', 'תפוח'],
  ['בננות', 'בננה'],
  ['פטריות', 'פטריה'],
  ['פטרייה', 'פטריה'],
  ['קישואים', 'קישוא'],
  ['חצילים', 'חציל'],
  ['פלפלים', 'פלפל'],
  ['שקדים', 'שקד'],
  ['אגוזים', 'אגוז'],
  ['תבלינים', 'תבלין'],
  ['תפוזים', 'תפוז'],
  ['אגסים', 'אגס'],
  ['אפרסקים', 'אפרסק'],
  ['שזיפים', 'שזיף'],
  ['תותים', 'תות'],
  ['ענבים', 'ענב'],
  ['זיתים', 'זית'],
  ['צנוניות', 'צנונית'],
  ['בטטות', 'בטטה'],
  ['גבינות', 'גבינה'],
]);

// Words ending in 'ים' or 'ות' that must not be stripped by generic suffix rules.
const PROTECTED_PLURAL_WORDS = new Set([
  'מים',
  'שמרים',
  'תות',
  'עדשים',
  'פתיתים',
  'אטריות',
  'פירות',
  'ירקות',
  'חמוצים',
  'גרגירים',
  'שבבים',
  'קרוטונים',
  'פצפוצים',
]);

// Safe salt variants treated as staples whenever 'מלח' is in the staples list.
const SALT_STAPLE_VARIANTS = new Set([
  'מלח ים',
  'מלח שולחן',
  'מלח הימלאיה',
  'מלח אטלנטי',
]);

// Hebrew final-letter (sofit) conversion when stripping masculine plural suffix 'ים'.
const TO_SOFIT = {
  כ: 'ך',
  מ: 'ם',
  נ: 'ן',
  פ: 'ף',
  צ: 'ץ',
};

// Explicit guard table of compound-noun trap pairs that must never cross-match.
const COMPOUND_TRAP_PAIRS = new Set([
  'חמאה|חמאת בוטנים',
  'חלב|חלב קוקוס',
  'חלב|חלב שקדים',
  'חלב|חלב סויה',
  'גבינת שמנת|שמנת',
  'סויה|רוטב סויה',
  'עגבניה|רוטב עגבניות',
  'עגבניה|רסק עגבניות',
  'אבקת שום|שום',
  'בצל|בצל ירוק',
  'פלפל|פלפל אדום',
  'קוקוס|שמן קוקוס',
  'קמח|קמח שקדים',
  'קמח תירס|תירס',
  'לימון|מיץ לימון',
]);

/**
 * Extracts raw text from either a string or an ingredient object.
 */
function extractRawName(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const candidate = raw.name ?? raw.item ?? raw.title ?? '';
    return candidate == null ? '' : String(candidate);
  }
  return String(raw);
}

/**
 * Strips safe Hebrew prefixes from a single token without corrupting root words.
 */
function stripSafeHebrewPrefix(word) {
  if (!word || word.length < 4 || !HEBREW_LETTER_REGEX.test(word)) {
    return word;
  }

  let current = word;

  // Strip conjunction 'ו' when length >= 4 and not a protected root (e.g. וניל, וודקה).
  if (
    current.length >= 4 &&
    current[0] === 'ו' &&
    !PROTECTED_VAV_WORDS.has(current)
  ) {
    current = current.slice(1);
  }

  // Strip prepositions 'ב' / 'ל' ONLY when followed by definite article 'ה' (e.g. בה..., לה...).
  if (
    current.length >= 5 &&
    (current[0] === 'ב' || current[0] === 'ל') &&
    current[1] === 'ה' &&
    !PROTECTED_PREPOSITION_WORDS.has(current)
  ) {
    current = current.slice(2);
    return current;
  }

  // Strip definite article 'ה' when length >= 4 and not a protected root (e.g. הל, הודו).
  if (
    current.length >= 4 &&
    current[0] === 'ה' &&
    !PROTECTED_HE_WORDS.has(current)
  ) {
    current = current.slice(1);
  }

  return current;
}

/**
 * Canonicalizes a single Hebrew word from plural to singular conservatively.
 */
function canonicalizeHebrewWord(word) {
  if (!word) return word;
  if (WORD_CANONICAL_MAP.has(word)) {
    return WORD_CANONICAL_MAP.get(word);
  }
  if (PROTECTED_PLURAL_WORDS.has(word) || !HEBREW_LETTER_REGEX.test(word)) {
    return word;
  }

  // Masculine plural '-ים' -> strip suffix when stem length >= 3, restoring sofit letter.
  if (word.endsWith('ים') && word.length >= 5) {
    const stem = word.slice(0, -2);
    const lastChar = stem[stem.length - 1];
    const sofit = TO_SOFIT[lastChar];
    return sofit ? stem.slice(0, -1) + sofit : stem;
  }

  // Feminine plural '-ות' -> replace with '-ה' when stem length >= 3.
  if (word.endsWith('ות') && word.length >= 5) {
    const stem = word.slice(0, -2);
    if (stem.endsWith('י')) {
      return stem.slice(0, -1) + 'יה';
    }
    return stem + 'ה';
  }

  return word;
}

// Multi-word Hebrew cut, bone, peel, and ripeness modifier phrases
// stripped only when core ingredient tokens remain.
const MODIFIER_PHRASE_PATTERNS = [
  /(?:^|\s)(?:עם|ללא|בלי)\s+ה?(?:עצם|עצמות|עור|קליפה|גרעינים)(?=\s|$)/g,
  /(?:^|\s)אך\s+(?:יציב|יציבה|יציבים|יציבות|בשל|בשלה|בשלים|בשלות|רך|רכה|קשה|טרי|טרייה|טריה)(?=\s|$)/g,
];

/**
 * Strips secondary cut, bone, peel, and ripeness modifier phrases
 * only when at least one core ingredient token remains.
 */
function stripModifierPhrases(tokens) {
  if (!Array.isArray(tokens) || tokens.length < 2) return tokens;
  let phrase = tokens.join(' ');
  for (let i = 0; i < MODIFIER_PHRASE_PATTERNS.length; i++) {
    phrase = phrase.replace(MODIFIER_PHRASE_PATTERNS[i], ' ');
  }
  const remaining = phrase.trim().split(/\s+/).filter(Boolean);
  return remaining.length > 0 ? remaining : tokens;
}

/**
 * Normalizes a raw ingredient string or object into a canonical search key.
 */
export function normalizeIngredientName(raw) {
  const input = extractRawName(raw);
  if (!input) return '';

  // Remove niqqud and lowercase Latin characters.
  let text = input.replace(NIQQUD_REGEX, '').toLowerCase();

  // Remove parentheticals unless doing so empties the entire string.
  const withoutParens = text.replace(PARENTHETICAL_REGEX, ' ').trim();
  if (withoutParens) {
    text = withoutParens;
  }

  // Remove "to taste" expressions if embedded in the name.
  text = text.replace(TO_TASTE_GLOBAL_REGEX, ' ');

  // Remove quantities and fractions.
  text = text.replace(QUANTITY_REGEX, ' ');

  // Strip quotes/geresh/gershayim cleanly (so ק"ג -> קג, מ"ל -> מל).
  text = text.replace(QUOTES_REGEX, '');

  // Replace remaining punctuation with spaces.
  text = text.replace(PUNCTUATION_REGEX, ' ').trim();

  if (!text) return '';

  let tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  // Check whole-phrase protected/synonym match before stripping units/adjectives
  // (e.g. "שיני שום" -> "שום", "עגבניות שרי" -> "עגבניות שרי").
  const initialPhrase = tokens.join(' ');
  if (PROTECTED_PHRASES.has(initialPhrase)) {
    return initialPhrase;
  }
  if (SYNONYM_MAP.has(initialPhrase)) {
    return SYNONYM_MAP.get(initialPhrase);
  }

  // Strip measurement units when other tokens remain.
  const withoutUnits = tokens.filter((t) => !MEASUREMENT_UNITS.has(t));
  if (withoutUnits.length > 0) {
    tokens = withoutUnits;
  }

  // Strip secondary cut/bone/ripeness modifier phrases ONLY when core tokens remain.
  tokens = stripModifierPhrases(tokens);

  // Strip prep adjectives ONLY when other meaningful words remain.
  const withoutPrep = tokens.filter((t) => !PREP_ADJECTIVES.has(t));
  if (withoutPrep.length > 0) {
    tokens = withoutPrep;
  }

  const phraseAfterClean = tokens.join(' ');
  if (PROTECTED_PHRASES.has(phraseAfterClean)) {
    return phraseAfterClean;
  }
  if (SYNONYM_MAP.has(phraseAfterClean)) {
    return SYNONYM_MAP.get(phraseAfterClean);
  }

  // Strip safe Hebrew prefixes per token.
  const unprefixedTokens = tokens.map(stripSafeHebrewPrefix).filter(Boolean);
  const unprefixedPhrase = unprefixedTokens.join(' ');
  if (PROTECTED_PHRASES.has(unprefixedPhrase)) {
    return unprefixedPhrase;
  }
  if (SYNONYM_MAP.has(unprefixedPhrase)) {
    return SYNONYM_MAP.get(unprefixedPhrase);
  }

  // Canonicalize each token (plural -> singular).
  const canonicalTokens = unprefixedTokens.map(canonicalizeHebrewWord);
  const canonicalPhrase = canonicalTokens.join(' ');

  if (SYNONYM_MAP.has(canonicalPhrase)) {
    return SYNONYM_MAP.get(canonicalPhrase);
  }

  return canonicalPhrase;
}

/**
 * Returns true if the ingredient specifies "to taste" / "לפי הטעם" in amount, unit, or name.
 */
export function isToTasteIngredient(ing) {
  if (ing == null) return false;
  if (typeof ing === 'string') {
    return TO_TASTE_REGEX.test(ing.replace(NIQQUD_REGEX, ''));
  }
  if (typeof ing === 'object') {
    const fields = [ing.amount, ing.unit, ing.name, ing.item, ing.title];
    for (let i = 0; i < fields.length; i++) {
      const val = fields[i];
      if (val != null && TO_TASTE_REGEX.test(String(val).replace(NIQQUD_REGEX, ''))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Builds a normalized Set of staple keys for O(1) lookup.
 */
function buildStapleSet(staples) {
  const list = Array.isArray(staples) ? staples : DEFAULT_STAPLES;
  const set = new Set();
  for (let i = 0; i < list.length; i++) {
    const norm = normalizeIngredientName(list[i]);
    if (norm) set.add(norm);
  }
  return set;
}

const DEFAULT_STAPLE_SET = buildStapleSet(DEFAULT_STAPLES);

/**
 * Internal fast staple check on an already-normalized ingredient name.
 */
function isNormalizedStaple(norm, stapleSet) {
  if (!norm) return false;
  if (stapleSet.has(norm)) return true;

  // Safe salt variants (e.g. "מלח ים") when "מלח" is a staple.
  if (stapleSet.has('מלח') && SALT_STAPLE_VARIANTS.has(norm)) {
    return true;
  }

  // Combined "מלח ופלפל" / "מלח פלפל" when both salt and pepper are staples.
  if (
    (norm === 'מלח פלפל' || norm === 'מלח פלפל שחור') &&
    stapleSet.has('מלח') &&
    (stapleSet.has('פלפל') || stapleSet.has('פלפל שחור'))
  ) {
    return true;
  }

  return false;
}

/**
 * Conservative check against the staples list.
 */
export function isStapleIngredient(rawOrIng, staples = DEFAULT_STAPLES) {
  const norm = normalizeIngredientName(rawOrIng);
  if (!norm) return false;
  const stapleSet =
    staples === DEFAULT_STAPLES ? DEFAULT_STAPLE_SET : buildStapleSet(staples);
  return isNormalizedStaple(norm, stapleSet);
}

/**
 * Conservative ingredient matching: prefers a missed match over a false match.
 */
export function isIngredientMatch(chipRaw, recipeIngRaw) {
  const chipNorm = normalizeIngredientName(chipRaw);
  const recipeNorm = normalizeIngredientName(recipeIngRaw);
  if (!chipNorm || !recipeNorm) return false;

  if (chipNorm === recipeNorm) return true;

  // Explicit guard against known compound-noun false-positive traps.
  const pairKey =
    chipNorm < recipeNorm
      ? `${chipNorm}|${recipeNorm}`
      : `${recipeNorm}|${chipNorm}`;
  if (COMPOUND_TRAP_PAIRS.has(pairKey)) {
    return false;
  }

  return false;
}

/**
 * Lightweight normalization for autocomplete query text (preserves partial prefixes).
 */
function normalizeQueryText(query) {
  if (!query) return '';
  return String(query)
    .replace(NIQQUD_REGEX, '')
    .toLowerCase()
    .replace(QUOTES_REGEX, '')
    .replace(PUNCTUATION_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a deduplicated, normalized ingredient suggestions index ONLY from `recipes`.
 * Sorted by recipe frequency descending, then Hebrew alphabetical.
 */
export function buildIngredientSuggestionsIndex(recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) return [];

  const map = new Map();

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    if (!recipe || !Array.isArray(recipe.ingredients)) continue;

    const seenInRecipe = new Set();

    for (let j = 0; j < recipe.ingredients.length; j++) {
      const ing = recipe.ingredients[j];
      const canonical = normalizeIngredientName(ing);
      if (!canonical || seenInRecipe.has(canonical)) continue;
      seenInRecipe.add(canonical);

      let entry = map.get(canonical);
      if (!entry) {
        const tokenSet = new Set([canonical]);
        const parts = canonical.split(' ');
        for (let k = 0; k < parts.length; k++) {
          if (parts[k]) tokenSet.add(parts[k]);
        }
        entry = {
          canonical,
          display: canonical,
          tokenSet,
          count: 0,
        };
        map.set(canonical, entry);
      }

      entry.count += 1;

      // Also index cleaned raw tokens from the recipe so plural/variant queries find the canonical item.
      const rawQueryForm = normalizeQueryText(extractRawName(ing));
      if (rawQueryForm && rawQueryForm !== canonical) {
        const rawParts = rawQueryForm.split(' ');
        for (let k = 0; k < rawParts.length; k++) {
          const part = rawParts[k];
          if (
            part &&
            part.length >= 2 &&
            !MEASUREMENT_UNITS.has(part) &&
            !PREP_ADJECTIVES.has(part) &&
            !/^\d+$/.test(part)
          ) {
            entry.tokenSet.add(part);
          }
        }
      }
    }
  }

  const result = [];
  for (const entry of map.values()) {
    result.push({
      canonical: entry.canonical,
      display: entry.display,
      searchTokens: Array.from(entry.tokenSet),
      count: entry.count,
    });
  }

  result.sort(
    (a, b) => b.count - a.count || a.display.localeCompare(b.display, 'he')
  );

  return result;
}

/**
 * Searches the recipe-derived ingredient suggestions index.
 * Prefix matches come first, then substring matches; excludes already selected chips.
 */
export function searchSuggestions(index, query, selectedChips = [], limit = 8) {
  if (!Array.isArray(index) || index.length === 0 || limit <= 0) return [];

  const selectedSet = new Set();
  if (Array.isArray(selectedChips)) {
    for (let i = 0; i < selectedChips.length; i++) {
      const norm = normalizeIngredientName(selectedChips[i]);
      if (norm) selectedSet.add(norm);
    }
  }

  const cleanQuery = normalizeQueryText(query);
  if (!cleanQuery) {
    const top = [];
    for (let i = 0; i < index.length && top.length < limit; i++) {
      const item = index[i];
      if (!selectedSet.has(item.canonical)) {
        top.push(item);
      }
    }
    return top;
  }

  const normQuery = normalizeIngredientName(cleanQuery);
  const prefixMatches = [];
  const substringMatches = [];

  for (let i = 0; i < index.length; i++) {
    const item = index[i];
    if (selectedSet.has(item.canonical)) continue;

    let isPrefix =
      item.canonical.startsWith(cleanQuery) ||
      item.display.startsWith(cleanQuery) ||
      (normQuery !== '' && item.canonical.startsWith(normQuery));

    if (!isPrefix && Array.isArray(item.searchTokens)) {
      for (let t = 0; t < item.searchTokens.length; t++) {
        if (item.searchTokens[t].startsWith(cleanQuery)) {
          isPrefix = true;
          break;
        }
      }
    }

    if (isPrefix) {
      prefixMatches.push(item);
      continue;
    }

    let isSubstring =
      item.canonical.includes(cleanQuery) ||
      item.display.includes(cleanQuery) ||
      (normQuery !== '' && item.canonical.includes(normQuery));

    if (!isSubstring && Array.isArray(item.searchTokens)) {
      for (let t = 0; t < item.searchTokens.length; t++) {
        if (item.searchTokens[t].includes(cleanQuery)) {
          isSubstring = true;
          break;
        }
      }
    }

    if (isSubstring) {
      substringMatches.push(item);
    }
  }

  if (prefixMatches.length >= limit) {
    return prefixMatches.slice(0, limit);
  }

  return prefixMatches.concat(
    substringMatches.slice(0, limit - prefixMatches.length)
  );
}

/**
 * Ranks recipes against selected pantry chips with staple exclusion,
 * "to taste" exclusion, filtering, and deterministic stable sorting.
 */
export function rankRecipesByPantry(recipes, chips, options = {}) {
  if (!Array.isArray(recipes) || recipes.length === 0) return [];

  const {
    assumeStaples = true,
    staples = DEFAULT_STAPLES,
    filter = 'all',
  } = options;

  const chipSet = new Set();
  if (Array.isArray(chips)) {
    for (let i = 0; i < chips.length; i++) {
      const norm = normalizeIngredientName(chips[i]);
      if (norm) chipSet.add(norm);
    }
  }

  const stapleSet =
    staples === DEFAULT_STAPLES ? DEFAULT_STAPLE_SET : buildStapleSet(staples);

  const ranked = [];

  for (let recipeIndex = 0; recipeIndex < recipes.length; recipeIndex++) {
    const recipe = recipes[recipeIndex];
    if (!recipe || !Array.isArray(recipe.ingredients)) continue;

    const toTasteIngredients = [];
    const staplesExcluded = [];
    const required = [];
    const matched = [];
    const missing = [];

    const seenRequired = new Set();
    const seenStaples = new Set();
    const seenToTaste = new Set();

    for (let j = 0; j < recipe.ingredients.length; j++) {
      const ing = recipe.ingredients[j];

      if (isToTasteIngredient(ing)) {
        const label = normalizeIngredientName(ing) || extractRawName(ing).trim();
        if (label && !seenToTaste.has(label)) {
          seenToTaste.add(label);
          toTasteIngredients.push(label);
        }
        continue;
      }

      const canonical = normalizeIngredientName(ing);
      if (!canonical) continue;

      if (assumeStaples && isNormalizedStaple(canonical, stapleSet)) {
        if (!seenStaples.has(canonical)) {
          seenStaples.add(canonical);
          staplesExcluded.push(canonical);
        }
        continue;
      }

      if (seenRequired.has(canonical)) continue;
      seenRequired.add(canonical);
      required.push(canonical);

      if (chipSet.has(canonical)) {
        matched.push(canonical);
      } else {
        missing.push(canonical);
      }
    }

    const score =
      required.length > 0
        ? Math.round((matched.length / required.length) * 100)
        : 0;

    let passesFilter = false;
    if (filter === '100') {
      passesFilter = score === 100;
    } else if (filter === '90plus') {
      passesFilter = score >= 90;
    } else if (filter === 'missing2') {
      passesFilter = score > 0 && missing.length <= 2;
    } else {
      passesFilter = score > 0;
    }

    if (!passesFilter) continue;

    const totalTimeMinutes =
      recipe.totalTimeMinutes ||
      (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0) ||
      null;

    ranked.push({
      recipe,
      recipeIndex,
      score,
      matched,
      missing,
      required,
      staplesExcluded,
      toTasteIngredients,
      matchedCount: matched.length,
      missingCount: missing.length,
      requiredCount: required.length,
      totalTimeMinutes,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.missing.length !== b.missing.length) {
      return a.missing.length - b.missing.length;
    }
    const timeA = a.totalTimeMinutes > 0 ? a.totalTimeMinutes : Infinity;
    const timeB = b.totalTimeMinutes > 0 ? b.totalTimeMinutes : Infinity;
    if (timeA !== timeB) return timeA - timeB;
    return a.recipeIndex - b.recipeIndex;
  });

  return ranked;
}
