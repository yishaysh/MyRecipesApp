process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');

const ENGINE_URL = new URL('../../../../public/pantry-search-engine.js', import.meta.url).href;
const UI_URL = new URL('../../../../public/pantry-search-ui.js', import.meta.url).href;

interface PantryEngineModule {
  DEFAULT_STAPLES: string[];
  normalizeIngredientName: (raw: unknown) => string;
  isToTasteIngredient: (ing: unknown) => boolean;
  isStapleIngredient: (rawOrIng: unknown, staples?: string[]) => boolean;
  isIngredientMatch: (chipRaw: unknown, recipeIngRaw: unknown) => boolean;
  buildIngredientSuggestionsIndex: (recipes: any[]) => Array<{
    canonical: string;
    display: string;
    searchTokens: string[];
    count: number;
  }>;
  searchSuggestions: (
    index: Array<{ canonical: string; display: string; searchTokens: string[]; count: number }>,
    query: string,
    selectedChips?: string[],
    limit?: number
  ) => Array<{ canonical: string; display: string; searchTokens: string[]; count: number }>;
  rankRecipesByPantry: (
    recipes: any[],
    chips: string[],
    options?: { assumeStaples?: boolean; staples?: string[]; filter?: string }
  ) => Array<{
    recipe: any;
    recipeIndex: number;
    score: number;
    matched: string[];
    missing: string[];
    required: string[];
    staplesExcluded: string[];
    toTasteIngredients: string[];
    matchedCount: number;
    missingCount: number;
    requiredCount: number;
    totalTimeMinutes: number | null;
  }>;
}

interface PantryUiModule {
  PANTRY_SEARCH_STORAGE_KEY: string;
  loadPantrySearchState: () => { chips: string[]; assumeStaples: boolean; filter: string };
  savePantrySearchState: (state: { chips?: string[]; assumeStaples?: boolean; filter?: string }) => boolean;
}

describe('v2.3.6 (Build 55) "What can I cook?" Pantry Search Engine, Persistence & Integration Suite', () => {
  let app: FastifyInstance;
  let engine: PantryEngineModule;
  let ui: PantryUiModule;

  before(async () => {
    console.log('[SETUP / FIXTURE] Loading pantry-search ES modules and booting Fastify instance');
    engine = (await import(ENGINE_URL)) as PantryEngineModule;
    ui = (await import(UI_URL)) as PantryUiModule;
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance');
    await app.close();
  });

  test('1. Normalization & Conservative Matching (Niqqud, prefixes, plurals, synonyms, trap rejection)', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: Normalization & Conservative Matching | ${new Date().toISOString()}`);

    const { normalizeIngredientName, isIngredientMatch } = engine;

    // Niqqud stripping, trim, Latin lowercase, quantity/unit & prep adjective stripping
    assert.equal(normalizeIngredientName('  בָּצָל  '), 'בצל', 'Niqqud and surrounding whitespace must be stripped');
    assert.equal(normalizeIngredientName('עַגְבָנִיָּה'), 'עגבניה', 'Niqqud on tomato must normalize to עגבניה');
    assert.equal(normalizeIngredientName('  Olive Oil  '), 'olive oil', 'Latin input must be trimmed and lowercased');
    assert.equal(normalizeIngredientName('2 כפות שמן זית'), 'שמן זית', 'Quantity and Hebrew unit must be stripped');
    assert.equal(normalizeIngredientName('500 גרם חזה עוף קצוץ'), 'חזה עוף', 'Quantity, unit, and prep adjective must be stripped');
    console.log('[ASSERT]: Niqqud, trim, lowercase, and quantity/unit stripping verified');

    // Safe Hebrew prefixes: definite article / conjunction stripped without corrupting root words
    assert.equal(normalizeIngredientName('הבצל'), 'בצל', 'Definite article prefix ה on הבצל must be stripped');
    assert.equal(normalizeIngredientName('והשום'), 'שום', 'Conjunction + article prefix on והשום must be stripped');
    for (const protectedRoot of ['בצל', 'ביצה', 'לחם', 'לימון', 'וניל']) {
      assert.equal(
        normalizeIngredientName(protectedRoot),
        protectedRoot,
        `Root word "${protectedRoot}" must NOT be corrupted by prefix stripping`
      );
    }
    console.log('[ASSERT]: Safe Hebrew prefix stripping and protected root words verified');

    // Singular / plural canonicalization
    assert.equal(normalizeIngredientName('עגבניות'), 'עגבניה');
    assert.equal(normalizeIngredientName('עגבנייה'), 'עגבניה');
    assert.equal(normalizeIngredientName('בצלים'), 'בצל');
    assert.equal(normalizeIngredientName('ביצים'), 'ביצה');
    console.log('[ASSERT]: Hebrew singular/plural normalization verified');

    // Conservative synonyms
    assert.equal(normalizeIngredientName('שיני שום'), 'שום');
    assert.equal(normalizeIngredientName('3 שיני שום כתושות'), 'שום');
    assert.equal(normalizeIngredientName('שום'), 'שום');
    assert.equal(normalizeIngredientName('פפריקה מתוקה'), 'פפריקה');
    assert.equal(normalizeIngredientName('פפריקה'), 'פפריקה');
    assert.equal(isIngredientMatch('שום', '3 שיני שום כתושות'), true, 'Garlic synonym must match');
    assert.equal(isIngredientMatch('פפריקה', 'כפית פפריקה מתוקה'), true, 'Paprika synonym must match');
    console.log('[ASSERT]: Conservative synonyms verified');

    // Conservative trap rejection (both directions)
    const trapPairs: Array<[string, string]> = [
      ['חמאת בוטנים', 'חמאה'],
      ['חלב קוקוס', 'חלב'],
      ['רוטב עגבניות', 'עגבניה'],
      ['בצל ירוק', 'בצל'],
      ['פלפל אדום', 'פלפל'],
    ];
    for (const [compound, base] of trapPairs) {
      assert.equal(
        isIngredientMatch(compound, base),
        false,
        `Conservative trap: "${compound}" must NOT match "${base}"`
      );
      assert.equal(
        isIngredientMatch(base, compound),
        false,
        `Conservative trap (reversed): "${base}" must NOT match "${compound}"`
      );
    }
    console.log('[ASSERT]: All 5 conservative compound-noun trap pairs rejected in both directions');
    console.log(`[TEST END]: Normalization & Conservative Matching PASSED (${Date.now() - t0}ms)`);
  });

  test('2. AC1 - Autocomplete Suggestions strictly derived from user recipes and exclude selected chips', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: AC1 Autocomplete Suggestions | ${new Date().toISOString()}`);

    const { buildIngredientSuggestionsIndex, searchSuggestions } = engine;

    const sampleRecipes = [
      {
        id: 'r1',
        title: 'שקשוקה',
        ingredients: ['4 עגבניות טריות', '2 בצלים קצוצים', '4 ביצים', '2 שיני שום', 'מלח'],
      },
      {
        id: 'r2',
        title: 'חביתת ירק',
        ingredients: ['3 ביצים', 'בצל ירוק קצוץ', 'פטרוזיליה', 'שמן זית'],
      },
      {
        id: 'r3',
        title: 'מרק בצל',
        ingredients: ['5 בצלים גדולים', 'חמאה', 'קמח', 'מים'],
      },
    ];

    const index = buildIngredientSuggestionsIndex(sampleRecipes);
    assert.ok(index.length > 0, 'Suggestions index must be populated from recipes');

    // Query "בצ" returns only onion-like ingredients present in the user's recipes
    const onionMatches = searchSuggestions(index, 'בצ', [], 10);
    const onionCanonicals = onionMatches.map((item) => item.canonical);
    console.log(`[ASSERT]: Query "בצ" returned: ${JSON.stringify(onionCanonicals)}`);
    assert.ok(onionCanonicals.includes('בצל'), 'Query "בצ" must include "בצל"');
    assert.ok(onionCanonicals.includes('בצל ירוק'), 'Query "בצ" must include "בצל ירוק"');
    assert.equal(onionCanonicals.length, 2, 'Query "בצ" must return only the 2 onion ingredients from user recipes');

    // Absent ingredient ("אבוקדו") is NEVER suggested
    assert.equal(
      index.some((item) => item.canonical.includes('אבוקדו')),
      false,
      'Absent ingredient "אבוקדו" must not exist in recipe-derived index'
    );
    assert.equal(
      searchSuggestions(index, 'אבו', [], 10).length,
      0,
      'Searching for absent ingredient "אבו" must return empty array'
    );

    // Already-selected chips are excluded from suggestions
    const afterSelectingOnion = searchSuggestions(index, 'בצ', ['בצל'], 10);
    const remainingCanonicals = afterSelectingOnion.map((item) => item.canonical);
    console.log(`[ASSERT]: After selecting "בצל", query "בצ" returned: ${JSON.stringify(remainingCanonicals)}`);
    assert.equal(remainingCanonicals.includes('בצל'), false, 'Selected chip "בצל" must be excluded');
    assert.deepEqual(remainingCanonicals, ['בצל ירוק'], 'Only unselected matching ingredient should remain');

    console.log(`[TEST END]: AC1 Autocomplete Suggestions PASSED (${Date.now() - t0}ms)`);
  });

  test('3. AC2, AC3, AC4 - Scoring, Staples ON/OFF, False Staples, and "לפי הטעם" handling', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: AC2/AC3/AC4 Scoring, Staples & To-Taste | ${new Date().toISOString()}`);

    const { rankRecipesByPantry, isStapleIngredient } = engine;

    // AC2 + AC3: Recipe with core ingredients + staples + "לפי הטעם"
    const shakshuka = {
      id: 'shakshuka',
      title: 'שקשוקה קלאסית',
      totalTimeMinutes: 25,
      ingredients: [
        { name: 'עגבניות', amount: '4' },
        { name: 'ביצים', amount: '4' },
        { name: 'בצל', amount: '1' },
        { name: 'מלח', amount: '1 כפית' },
        { name: 'פלפל שחור', amount: '0.5 כפית' },
        { name: 'שמן זית', amount: '2 כפות' },
        { name: 'מים', amount: '0.5 כוס' },
        { name: 'כוסברה', amount: 'לפי הטעם' },
      ],
    };

    // AC2: All non-staple ingredients matched with staples ON -> score === 100, missing.length === 0
    const resStaplesOn = rankRecipesByPantry([shakshuka], ['עגבניה', 'ביצה', 'בצל'], {
      assumeStaples: true,
      filter: 'all',
    });
    assert.equal(resStaplesOn.length, 1);
    assert.equal(resStaplesOn[0].score, 100, 'AC2: Full match with staples ON must score 100');
    assert.equal(resStaplesOn[0].missing.length, 0, 'AC2: Full match must have 0 missing items');
    assert.deepEqual(
      resStaplesOn[0].toTasteIngredients,
      ['כוסברה'],
      '"לפי הטעם" ingredient must be returned in toTasteIngredients without lowering score'
    );
    for (const staple of ['מלח', 'פלפל שחור', 'שמן זית', 'מים']) {
      assert.equal(resStaplesOn[0].missing.includes(staple), false, `AC3: Staple "${staple}" must not be in missing when staples ON`);
    }
    console.log('[ASSERT]: AC2 (100% score, 0 missing) and "לפי הטעם" handling verified');

    // AC3: Staples OFF -> salt/pepper/oil/water appear in missing
    const resStaplesOff = rankRecipesByPantry([shakshuka], ['עגבניה', 'ביצה', 'בצל'], {
      assumeStaples: false,
      filter: 'all',
    });
    assert.equal(resStaplesOff.length, 1);
    assert.ok(resStaplesOff[0].score < 100, 'AC3: With staples OFF, missing staples must reduce score');
    for (const staple of ['מלח', 'פלפל שחור', 'שמן זית', 'מים']) {
      assert.ok(
        resStaplesOff[0].missing.includes(staple),
        `AC3: Staple "${staple}" must appear in missing when assumeStaples is false`
      );
    }
    console.log('[ASSERT]: AC3 staples OFF places salt/pepper/oil/water in missing');

    // AC3 False staples: red bell pepper & sesame oil must NOT be excluded as staples
    assert.equal(isStapleIngredient('פלפל אדום'), false, 'פלפל אדום must NOT be treated as a staple');
    assert.equal(isStapleIngredient('שמן שומשום'), false, 'שמן שומשום must NOT be treated as a staple');
    const stirFry = {
      id: 'stir-fry',
      title: 'מוקפץ אסייתי',
      ingredients: ['חזה עוף', 'פלפל אדום', 'שמן שומשום', 'מלח'],
    };
    const resFalseStaples = rankRecipesByPantry([stirFry], ['חזה עוף'], { assumeStaples: true });
    assert.equal(resFalseStaples.length, 1);
    assert.ok(resFalseStaples[0].missing.includes('פלפל אדום'), 'פלפל אדום must stay in missing even with staples ON');
    assert.ok(resFalseStaples[0].missing.includes('שמן שומשום'), 'שמן שומשום must stay in missing even with staples ON');
    assert.equal(resFalseStaples[0].missing.includes('מלח'), false, 'מלח must be excluded when staples ON');
    console.log('[ASSERT]: False staples (פלפל אדום, שמן שומשום) are never excluded as staples');

    // AC4: 8 required ingredients, 6 matched -> score === 75 and exact 2 missing items
    const eightIngRecipe = {
      id: 'pasta-8',
      title: 'פסטה עשירה',
      ingredients: [
        'פסטה',
        'עגבניות',
        'שום',
        'בצל',
        'בזיליקום',
        'גבינת פרמזן',
        'שמנת מתוקה',
        'פטריות',
        'מלח',
        { name: 'צ׳ילי גרוס', amount: 'לפי הטעם' },
      ],
    };
    const resAC4 = rankRecipesByPantry(
      [eightIngRecipe],
      ['פסטה', 'עגבניה', 'שום', 'בצל', 'בזיליקום', 'גבינת פרמזן'],
      { assumeStaples: true }
    );
    assert.equal(resAC4.length, 1);
    assert.equal(resAC4[0].requiredCount, 8, 'AC4: Recipe must have 8 required non-staple ingredients');
    assert.equal(resAC4[0].matchedCount, 6, 'AC4: Exactly 6 ingredients matched');
    assert.equal(resAC4[0].score, 75, 'AC4: 6/8 matched must yield score === 75');
    assert.deepEqual(
      resAC4[0].missing,
      ['שמנת מתוקה', 'פטריה'],
      'AC4: Exact 2 missing items must be reported'
    );
    console.log('[ASSERT]: AC4 (6/8 => 75% and exact 2 missing) verified');
    console.log(`[TEST END]: AC2/AC3/AC4 Scoring, Staples & To-Taste PASSED (${Date.now() - t0}ms)`);
  });

  test('4. AC5 - Deterministic Sorting (score, missing, time, original index) & Filter Chips', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: AC5 Sorting, Tie Stability & Filter Chips | ${new Date().toISOString()}`);

    const { rankRecipesByPantry } = engine;

    const recipes = [
      // Index 0: score 50, 2 missing, 20 min
      { id: 'r-50-miss2', title: 'R 50% miss2', totalTimeMinutes: 20, ingredients: ['ביצה', 'בצל', 'חמאה', 'קמח'] },
      // Index 1: score 100, 0 missing, 30 min
      { id: 'r-100-slow', title: 'R 100% 30m', totalTimeMinutes: 30, ingredients: ['ביצה', 'בצל'] },
      // Index 2: score 100, 0 missing, 15 min (first tie)
      { id: 'r-100-fast-a', title: 'R 100% 15m A', totalTimeMinutes: 15, ingredients: ['ביצה', 'בצל'] },
      // Index 3: score 100, 0 missing, 15 min (second tie -> must stay after Index 2)
      { id: 'r-100-fast-b', title: 'R 100% 15m B', totalTimeMinutes: 15, ingredients: ['ביצה', 'בצל'] },
      // Index 4: score 50, 1 missing, 45 min (same score 50 as Index 0, but fewer missing -> before Index 0)
      { id: 'r-50-miss1', title: 'R 50% miss1', totalTimeMinutes: 45, ingredients: ['ביצה', 'גזר'] },
      // Index 5: score 90 (9/10 matched, 1 missing)
      {
        id: 'r-90',
        title: 'R 90%',
        totalTimeMinutes: 25,
        ingredients: ['ביצה', 'בצל', 'שום', 'עגבניה', 'פפריקה', 'כמון', 'אורז', 'תפוח אדמה', 'גבינה', 'תרד'],
      },
      // Index 6: score 0 (must be excluded from all filters)
      { id: 'r-0', title: 'R 0%', totalTimeMinutes: 10, ingredients: ['אבוקדו', 'מנגו'] },
      // Index 7: score 25 (1/4 matched, 3 missing -> excluded from missing2)
      { id: 'r-25-miss3', title: 'R 25% miss3', totalTimeMinutes: 10, ingredients: ['ביצה', 'חציל', 'קישוא', 'סלק'] },
    ];

    const chips = ['ביצה', 'בצל', 'שום', 'עגבניה', 'פפריקה', 'כמון', 'אורז', 'תפוח אדמה', 'גבינה'];

    const allRanked = rankRecipesByPantry(recipes, chips, { filter: 'all' });
    const allIds = allRanked.map((r) => r.recipe.id);
    console.log(`[ASSERT]: Filter "all" sorted order: ${JSON.stringify(allIds)}`);
    assert.deepEqual(
      allIds,
      ['r-100-fast-a', 'r-100-fast-b', 'r-100-slow', 'r-90', 'r-50-miss1', 'r-50-miss2', 'r-25-miss3'],
      'Sorting must order by score desc -> missing asc -> totalTimeMinutes asc -> original index asc, excluding 0% matches'
    );

    const filter90 = rankRecipesByPantry(recipes, chips, { filter: '90plus' }).map((r) => r.recipe.id);
    assert.deepEqual(filter90, ['r-100-fast-a', 'r-100-fast-b', 'r-100-slow', 'r-90'], 'Filter "90plus" must include score >= 90');

    const filter100 = rankRecipesByPantry(recipes, chips, { filter: '100' }).map((r) => r.recipe.id);
    assert.deepEqual(filter100, ['r-100-fast-a', 'r-100-fast-b', 'r-100-slow'], 'Filter "100" must include only score === 100');

    const filterMissing2 = rankRecipesByPantry(recipes, chips, { filter: 'missing2' }).map((r) => r.recipe.id);
    assert.deepEqual(
      filterMissing2,
      ['r-100-fast-a', 'r-100-fast-b', 'r-100-slow', 'r-90', 'r-50-miss1', 'r-50-miss2'],
      'Filter "missing2" must include score > 0 with missing.length <= 2'
    );
    console.log('[ASSERT]: All 4 filter chips (all, 90plus, 100, missing2) verified');
    console.log(`[TEST END]: AC5 Sorting, Tie Stability & Filter Chips PASSED (${Date.now() - t0}ms)`);
  });

  test('5. AC6 - Persistence State Helper (defaults, save under pantrySearch.v1, isolated reload)', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: AC6 Persistence State Helper | ${new Date().toISOString()}`);

    const { PANTRY_SEARCH_STORAGE_KEY, loadPantrySearchState, savePantrySearchState } = ui;
    assert.equal(PANTRY_SEARCH_STORAGE_KEY, 'pantrySearch.v1', 'Storage key must be pantrySearch.v1');

    const prevLocalStorage = (globalThis as any).localStorage;
    const store = new Map<string, string>();
    store.set('unrelated_app_key', 'must-not-change');

    (globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    };

    try {
      // Defaults when key is absent
      const initial = loadPantrySearchState();
      assert.deepEqual(
        initial,
        { chips: [], assumeStaples: true, filter: 'all' },
        'Default state must be { chips: [], assumeStaples: true, filter: "all" }'
      );
      console.log('[ASSERT]: Default loadPantrySearchState() verified');

      // Save state and verify exact storage key and persisted JSON
      const savedOk = savePantrySearchState({
        chips: ['ביצה', 'עגבניה', 'בצל'],
        assumeStaples: false,
        filter: 'missing2',
      });
      assert.equal(savedOk, true, 'savePantrySearchState must return true');
      assert.ok(store.has('pantrySearch.v1'), 'State must be stored under key "pantrySearch.v1"');

      // Reload restores exact chips, toggle, and filter without touching any other localStorage key
      const reloaded = loadPantrySearchState();
      assert.deepEqual(
        reloaded,
        { chips: ['ביצה', 'עגבניה', 'בצל'], assumeStaples: false, filter: 'missing2' },
        'Reloaded state must match persisted chips, assumeStaples toggle, and filter'
      );
      assert.equal(
        store.get('unrelated_app_key'),
        'must-not-change',
        'Unrelated localStorage keys must never be modified or deleted'
      );
      assert.equal(store.size, 2, 'Only the unrelated key and pantrySearch.v1 should exist in localStorage');
      console.log('[ASSERT]: Save/reload round-trip and localStorage key isolation verified');
    } finally {
      if (prevLocalStorage === undefined) {
        delete (globalThis as any).localStorage;
      } else {
        (globalThis as any).localStorage = prevLocalStorage;
      }
    }

    console.log(`[TEST END]: AC6 Persistence State Helper PASSED (${Date.now() - t0}ms)`);
  });

  test('6. Performance - 500 Recipes Synchronous Benchmark (< 200ms)', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: 500-Recipe Synchronous Performance Benchmark | ${new Date().toISOString()}`);

    const { buildIngredientSuggestionsIndex, rankRecipesByPantry } = engine;

    const pool = [
      '2 עגבניות טריות',
      '1 בצל קצוץ',
      '3 שיני שום כתושות',
      '4 ביצים',
      '200 גרם פסטה',
      '500 גרם חזה עוף',
      '1 כוס אורז',
      '2 גזרים מקולפים',
      '1 פלפל אדום',
      '100 גרם גבינה צהובה',
      '2 כפות שמן זית',
      '1 כפית מלח',
      '0.5 כפית פלפל שחור',
      '1 כפית פפריקה מתוקה',
      '1 כוס מים',
      '2 תפוחי אדמה',
      '1 קישוא',
      '1 חציל',
      '200 גרם פטריות',
      '1 חבילה פטרוזיליה',
      '100 גרם חמאה',
      '1 כוס חלב',
      '2 כוסות קמח',
      '1 כף סוכר',
      '1 לימון סחוט',
    ];

    const recipes = Array.from({ length: 500 }, (_, i) => {
      const ingCount = 8 + (i % 5); // 8 to 12 ingredients per recipe
      const ingredients: string[] = [];
      for (let j = 0; j < ingCount; j++) {
        ingredients.push(pool[(i * 7 + j * 3) % pool.length]);
      }
      return {
        id: `bench-${i}`,
        title: `מתכון ${i}`,
        totalTimeMinutes: 15 + (i % 60),
        ingredients,
      };
    });

    const benchStart = performance.now();
    const index = buildIngredientSuggestionsIndex(recipes);
    const ranked = rankRecipesByPantry(
      recipes,
      ['עגבניה', 'בצל', 'שום', 'ביצה', 'חזה עוף', 'אורז'],
      { assumeStaples: true, filter: 'all' }
    );
    const elapsedMs = performance.now() - benchStart;

    console.log(
      `[ASSERT]: 500 recipes indexed (${index.length} unique ingredients) + ranked (${ranked.length} matches) in ${elapsedMs.toFixed(2)}ms`
    );
    assert.ok(index.length > 10, 'Index must contain normalized ingredients from benchmark recipes');
    assert.ok(ranked.length > 0, 'Benchmark ranking must return matching recipes');
    assert.ok(elapsedMs < 200, `Synchronous index + rank for 500 recipes must finish in < 200ms, got ${elapsedMs.toFixed(2)}ms`);

    console.log(`[TEST END]: 500-Recipe Performance Benchmark PASSED (${Date.now() - t0}ms)`);
  });

  test('7. HTTP Serving & v2.3.6 Integration Guards', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: HTTP Serving & v2.3.6 Integration Guards | ${new Date().toISOString()}`);

    const engineRes = await app.inject({ method: 'GET', url: '/pantry-search-engine.js' });
    assert.equal(engineRes.statusCode, 200, 'GET /pantry-search-engine.js must return 200');
    assert.ok(
      String(engineRes.headers['content-type']).toLowerCase().includes('javascript'),
      `GET /pantry-search-engine.js must serve javascript content-type, got "${engineRes.headers['content-type']}"`
    );

    const uiRes = await app.inject({ method: 'GET', url: '/pantry-search-ui.js' });
    assert.equal(uiRes.statusCode, 200, 'GET /pantry-search-ui.js must return 200');
    assert.ok(
      String(uiRes.headers['content-type']).toLowerCase().includes('javascript'),
      `GET /pantry-search-ui.js must serve javascript content-type, got "${uiRes.headers['content-type']}"`
    );
    console.log('[ASSERT]: Both /pantry-search-engine.js and /pantry-search-ui.js serve HTTP 200 with javascript content-type');

    const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');

    for (const token of ['open-pantry-search-btn', 'panel-pantry-search', 'goBackFromRecipe', 'v2.3.6 (Build 55)']) {
      assert.ok(appHtml.includes(token), `public/app.html must include "${token}"`);
    }
    for (const swToken of ['/pantry-search-engine.js', '/pantry-search-ui.js']) {
      assert.ok(swJs.includes(swToken), `public/sw.js must include "${swToken}"`);
    }
    console.log('[ASSERT]: public/app.html and public/sw.js v2.3.6 integration guards verified');
    console.log(`[TEST END]: HTTP Serving & v2.3.6 Integration Guards PASSED (${Date.now() - t0}ms)`);
  });
});
