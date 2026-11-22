process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { StructuredRecipeSchema } from '../shared/schemas/recipe.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const SHARE_HTML_TS_PATH = path.join(REPO_ROOT, 'services', 'api', 'src', 'views', 'public-share.html.ts');
const MOBILE_APP_JSON_PATH = path.join(REPO_ROOT, 'apps', 'mobile', 'app.json');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');

function extractFunctionSource(html: string, funcDecl: string): string {
  const start = html.indexOf(funcDecl);
  assert.ok(start !== -1, `Expected to find "${funcDecl}" in public/app.html`);
  // Determine leading indentation on the line where funcDecl begins (top-level script functions use 4 spaces)
  const lineStart = html.lastIndexOf('\n', start) + 1;
  const indentMatch = html.slice(lineStart, start).match(/^[ \t]*/);
  const indent = indentMatch ? indentMatch[0] : '';
  const closeMarker = `\n${indent}}`;
  const endIdx = html.indexOf(closeMarker, start);
  assert.ok(endIdx !== -1, `Expected closing "${closeMarker.trim()}" for "${funcDecl}"`);
  return html.slice(start, endIdx + closeMarker.length);
}

describe('v1.9.7 (Build 36) QA Regression Suite (P0-1 through L-2)', () => {
  let app: FastifyInstance;
  const storage = RecipeStorageService.getInstance();
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const shareHtmlTs = fs.readFileSync(SHARE_HTML_TS_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Starting Fastify test server for v1.9.7 regression suite');
    storage.clear();
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify test server');
    storage.clear();
    await app.close();
  });

  // P0-1: Text, Image, and Link extraction all succeed with HTTP 200 and pass canonical schema
  test('P0-1: Text extraction, image extraction, and link extraction all return 200 with canonical schema', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: P0-1 Extraction Modes (Text, Image, Link) | ${new Date().toISOString()}`);

    // 1. Canonical schema explicitly accepts empty/null/absent sourceUrl AND valid URLs
    const baseRecipe = {
      title: 'פסטה עגבניות מהירה',
      description: 'מתכון ביתי קל',
      ingredients: [{ name: 'ספגטי', amount: 400, unit: 'גרם', originalText: '400 גרם ספגטי' }],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים את הפסטה 8 דקות.' }]
    };
    for (const candidateSourceUrl of ['', null, undefined, 'https://example.com/pasta']) {
      const parsed = StructuredRecipeSchema.safeParse({ ...baseRecipe, sourceUrl: candidateSourceUrl });
      assert.equal(parsed.success, true, `Schema must accept sourceUrl=${JSON.stringify(candidateSourceUrl)}`);
      if (candidateSourceUrl === 'https://example.com/pasta') {
        assert.equal(parsed.data.sourceUrl, 'https://example.com/pasta');
      } else {
        assert.equal(parsed.data.sourceUrl, '');
      }
    }
    console.log('[ASSERT]: StructuredRecipeSchema accepts empty, null, undefined, and valid HTTP sourceUrl');

    // 2. Text-mode extraction (Hebrew recipe ~400 chars)
    const hebrewRecipeText = [
      'שקשוקה עגבניות חריפה לבית (4 מנות)',
      'מצרכים:',
      '6 עגבניות בשלות חתוכות לקוביות',
      '4 שיני שום פרוסות',
      '1 פלפל ירוק חריף קצוץ',
      '3 כפות שמן זית',
      '1 כף רסק עגבניות',
      '1 כפית פפריקה מתוקה',
      '4 ביצים גדולות',
      'מלח ופלפל שחור לפי הטעם',
      'הוראות הכנה:',
      '1. מחממים שמן זית במחבת רחבה ומטגנים שום ופלפל חריף 2 דקות.',
      '2. מוסיפים עגבניות ורסק, מבשלים 15 דקות עד שהרוטב מסמיך.',
      '3. שוברים ביצים מעל, מכסים ומבשלים עוד 5 דקות.'
    ].join('\n');

    console.log('[ACT]: POST /api/v1/recipes/extract-content (text mode)');
    const textRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-content',
      payload: { text: hebrewRecipeText }
    });
    assert.equal(textRes.statusCode, 200, `Expected 200 for text extraction, got ${textRes.statusCode}: ${textRes.payload}`);
    const textBody = JSON.parse(textRes.payload);
    assert.equal(textBody.success, true);
    assert.ok(textBody.recipe && textBody.recipe.title, 'Text extraction must return valid recipe with title');
    assert.equal(textBody.recipe.sourceUrl, '', 'Text extraction recipe must store empty sourceUrl');
    assert.ok(Array.isArray(textBody.recipe.ingredients) && textBody.recipe.ingredients.length >= 1);
    assert.ok(Array.isArray(textBody.recipe.instructions) && textBody.recipe.instructions.length >= 1);
    console.log(`[ASSERT]: Text extraction returned 200 with recipe "${textBody.recipe.title}"`);

    // 3. Image-mode extraction (valid 1x1 PNG screenshot base64)
    const samplePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    console.log('[ACT]: POST /api/v1/recipes/extract-content (image mode)');
    const imgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract-content',
      payload: {
        imageBase64: `data:image/png;base64,${samplePngBase64}`,
        mimeType: 'image/png'
      }
    });
    assert.equal(imgRes.statusCode, 200, `Expected 200 for image extraction, got ${imgRes.statusCode}: ${imgRes.payload}`);
    const imgBody = JSON.parse(imgRes.payload);
    assert.equal(imgBody.success, true);
    assert.ok(imgBody.recipe && imgBody.recipe.title, 'Image extraction must return valid recipe with title');
    assert.equal(imgBody.recipe.sourceUrl, '', 'Image extraction recipe must store empty sourceUrl');
    assert.ok(Array.isArray(imgBody.recipe.ingredients) && imgBody.recipe.ingredients.length >= 1);
    console.log(`[ASSERT]: Image extraction returned 200 with recipe "${imgBody.recipe.title}"`);

    // 4. Link-mode extraction (ensure no regression)
    console.log('[ACT]: POST /api/v1/recipes/extract (link mode)');
    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/recipes/extract',
      payload: { url: 'https://www.instagram.com/reel/spaghetti-carbonara-authentic' }
    });
    assert.equal(linkRes.statusCode, 200, `Expected 200 for link extraction, got ${linkRes.statusCode}: ${linkRes.payload}`);
    const linkBody = JSON.parse(linkRes.payload);
    assert.ok(linkBody.recipe && linkBody.recipe.title);
    assert.ok(String(linkBody.recipe.sourceUrl).startsWith('https://'), 'Link extraction must preserve sourceUrl');
    console.log(`[ASSERT]: Link extraction returned 200 with preserved sourceUrl "${linkBody.recipe.sourceUrl}"`);

    // 5. Verify recipe view hides source banner when sourceUrl is empty
    assert.ok(
      appHtml.includes("currentRecipe.sourceUrl && isSafeHttpUrl(currentRecipe.sourceUrl)"),
      'Web recipe view must hide source banner when sourceUrl is empty or non-HTTP'
    );
    console.log(`[TEST END]: P0-1 SUCCESS | ${Date.now() - t0}ms`);
  });

  // H-1: Re-extract ("חילוץ מחדש (מתכון חדש)") creates a NEW recipe without overwriting existing
  test('H-1: Duplicate-URL dialog view preserves existing, re-extract creates a distinct new recipe across reloads', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: H-1 Duplicate-URL Dialog View vs Re-extract | ${new Date().toISOString()}`);

    const fns = [
      extractFunctionSource(appHtml, 'function normalizeUrlForCompare('),
      extractFunctionSource(appHtml, 'function normalizeTitleForCompare('),
      extractFunctionSource(appHtml, 'function areRecipesDuplicateWeb('),
      extractFunctionSource(appHtml, 'function mergeRecipeEntriesWeb('),
      extractFunctionSource(appHtml, 'function deduplicateRecipesList('),
      extractFunctionSource(appHtml, 'function saveRecipeToStorage('),
      extractFunctionSource(appHtml, 'function handleDuplicateModalAction(')
    ].join('\n\n');

    const storageMap = new Map<string, string>();
    const toasts: string[] = [];
    let triggerForceArg: boolean | null = null;
    const ctx: any = {
      STORAGE_KEY: 'my_recipes_saved',
      savedRecipes: [],
      currentRecipe: null,
      servingMultiplier: 1,
      currentAuthToken: null,
      isSyncingWebCloud: false,
      pendingDuplicateRecipe: null,
      pendingDuplicateUrl: '',
      localStorage: {
        setItem: (k: string, v: string) => storageMap.set(k, v),
        getItem: (k: string) => storageMap.get(k) || null
      },
      document: { getElementById: () => ({ style: {}, value: '' }) },
      renderRecipe: () => {},
      switchTab: () => {},
      updateLibraryUI: () => {},
      syncCloudRecipes: () => {},
      showToast: (msg: string) => toasts.push(msg),
      triggerExtract: (forceReExtract: boolean) => { triggerForceArg = forceReExtract; },
      URL,
      Date,
      Math,
      Set,
      Array,
      JSON,
      Boolean,
      String,
      Number
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    const originalRecipe = {
      id: 'rec_orig_1',
      title: 'ספגטי קרבונרה',
      sourceUrl: 'https://www.instagram.com/reel/carousel-123/',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      ingredients: [{ name: 'ספגטי', amount: 400, unit: 'גרם' }],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים' }]
    };

    // Save initial recipe
    ctx.saveRecipeToStorage(originalRecipe);
    assert.equal(ctx.savedRecipes.length, 1);

    // Path 1: User clicks "צפייה במתכון" (view)
    ctx.pendingDuplicateRecipe = ctx.savedRecipes[0];
    ctx.pendingDuplicateUrl = originalRecipe.sourceUrl;
    ctx.handleDuplicateModalAction('view');
    assert.equal(ctx.currentRecipe.id, 'rec_orig_1', 'View path must open existing recipe');
    assert.equal(ctx.savedRecipes.length, 1, 'View path must not create extra recipes');
    assert.equal(triggerForceArg, null, 'View path must not trigger extraction');
    console.log('[ASSERT]: Duplicate dialog "view" path opened existing recipe without re-extracting');

    // Path 2: User clicks "חילוץ מחדש (מתכון חדש)" (reextract)
    ctx.pendingDuplicateRecipe = ctx.savedRecipes[0];
    ctx.pendingDuplicateUrl = originalRecipe.sourceUrl;
    ctx.handleDuplicateModalAction('reextract');
    assert.equal(triggerForceArg, true, 'Re-extract path must call triggerExtract(true)');

    // Simulate triggerExtract(true) saving re-extracted recipe with forceNewEntry: true
    const reExtractedIncoming = {
      id: 'rec_server_same_url',
      title: 'ספגטי קרבונרה',
      sourceUrl: 'https://www.instagram.com/reel/carousel-123/',
      createdAt: '2026-11-20T10:00:00.000Z',
      ingredients: [{ name: 'ספגטי', amount: 400, unit: 'גרם' }, { name: 'פרמזן', amount: 60, unit: 'גרם' }],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים' }]
    };
    const newSaved = ctx.saveRecipeToStorage(reExtractedIncoming, { forceNewEntry: true, preserveEditedDuplicate: true });

    assert.equal(ctx.savedRecipes.length, 2, 'Re-extract must create a SECOND distinct recipe entry');
    assert.notEqual(newSaved.id, 'rec_orig_1', 'New recipe must have a fresh distinct ID');
    assert.notEqual(newSaved.createdAt, originalRecipe.createdAt, 'New recipe must have its own createdAt timestamp');
    const stillOld = ctx.savedRecipes.find((r: any) => r.id === 'rec_orig_1');
    assert.ok(stillOld, 'Original recipe must remain in savedRecipes untouched');
    assert.equal(stillOld.ingredients.length, 1, 'Original recipe ingredients must remain untouched');

    // Simulate reload: deduplicateRecipesList must NOT collapse the two entries
    const afterReload = ctx.deduplicateRecipesList(JSON.parse(storageMap.get('my_recipes_saved')!));
    assert.equal(afterReload.length, 2, 'Both old and newly re-extracted recipes must survive reload deduplication');
    console.log(`[ASSERT]: Re-extract created distinct recipe ${newSaved.id} while keeping rec_orig_1 intact across reload`);
    console.log(`[TEST END]: H-1 SUCCESS | ${Date.now() - t0}ms`);
  });

  // H-2: Shopping list double-add prevention
  test('H-2: Adding the same recipe to shopping list twice prevents quantity doubling and keeps contributions consistent', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: H-2 Shopping-List Double-Add Prevention | ${new Date().toISOString()}`);

    const fns = [
      extractFunctionSource(appHtml, 'function normalizeHebrewText('),
      extractFunctionSource(appHtml, 'function formatShoppingQuantity('),
      extractFunctionSource(appHtml, 'function mergeShoppingItemIntoList('),
      extractFunctionSource(appHtml, 'function isRecipeAlreadyInShoppingList('),
      extractFunctionSource(appHtml, 'function addAllCurrentIngredientsToShopping(')
    ].join('\n\n');

    let shoppingList: any[] = [];
    const toasts: string[] = [];
    const pantry = ['מלח', 'פלפל שחור'];
    const ctx: any = {
      currentRecipe: {
        id: 'rec_carb_42',
        title: 'ספגטי קרבונרה',
        servings: 4,
        ingredients: [
          { name: 'ספגטי', amount: 400, unit: 'גרם', category: 'pantry' },
          { name: 'מלח', amount: null, unit: 'לפי הטעם', category: 'spices' },
          { name: 'ביצים', amount: 4, unit: 'יחידות', category: 'dairy' }
        ]
      },
      servingMultiplier: 1,
      lastSkippedPantryItems: [],
      loadShoppingItems: () => JSON.parse(JSON.stringify(shoppingList)),
      saveShoppingItems: (items: any[]) => { shoppingList = JSON.parse(JSON.stringify(items)); },
      renderShopping: () => {},
      classifyShoppingSection: (name: string) => (name.includes('ביצ') ? 'מוצרי חלב וביצים' : 'מזווה ויבשים'),
      normalizeWebIngredient: (ing: any) => ({ ...ing }),
      isIngredientInPantry: (name: string) => pantry.includes(name),
      plural: (n: number, forms: any) => (n === 0 ? forms.zero : n === 1 ? forms.one : forms.many.replace('{n}', String(n))),
      showToast: (msg: string) => toasts.push(msg),
      Number,
      String,
      Boolean,
      Array,
      Object,
      JSON,
      Math
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    // 1st add
    ctx.addAllCurrentIngredientsToShopping();
    const pastaRow1 = shoppingList.find((i) => i.name === 'ספגטי');
    assert.ok(pastaRow1, 'Spaghetti must be added on first click');
    assert.equal(pastaRow1.amount, 400, 'Spaghetti must start at 400g');
    assert.equal(ctx.lastSkippedPantryItems.length, 1, 'Pantry item (salt) must still be excluded');
    assert.equal(pastaRow1.recipeContributions['rec_carb_42'].amount, 400);

    // 2nd add of the exact same recipe
    ctx.addAllCurrentIngredientsToShopping();
    const pastaRow2 = shoppingList.find((i) => i.name === 'ספגטי');
    assert.equal(pastaRow2.amount, 400, 'Second click must NOT double spaghetti to 800g');
    assert.equal(shoppingList.length, 2, 'Item count must remain unchanged on duplicate add');
    assert.ok(
      toasts[toasts.length - 1].includes('המתכון הזה כבר ברשימת הקניות'),
      `Expected Hebrew already-in-list toast, got: ${toasts[toasts.length - 1]}`
    );

    // Verify per-recipe contribution sum == row total
    const contribSum = Object.values(pastaRow2.recipeContributions).reduce((acc: number, c: any) => acc + (Number(c.amount) || 0), 0);
    assert.equal(contribSum, pastaRow2.amount, 'Per-recipe contribution sum must equal row total');
    console.log('[ASSERT]: Duplicate recipe add blocked with Hebrew toast; quantities stayed at 400g; pantry exclusion preserved');
    console.log(`[TEST END]: H-2 SUCCESS | ${Date.now() - t0}ms`);
  });

  // M-1: Combined retailer handoff opens ONE tab, never about:blank, and reports popup-blocked ONLY when truly blocked
  test('M-1: Combined copy-and-open opens exactly 1 tab with verified URL and accurate popup-blocked detection', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: M-1 Single-Tab Retailer Handoff & Popup Detection | ${new Date().toISOString()}`);

    // Static checks: zero window.open('about:blank'...) and zero window.open(directUrl, '_blank', 'noopener,noreferrer')
    assert.ok(!appHtml.includes("window.open('about:blank'"), 'public/app.html must NEVER call window.open("about:blank")');
    assert.ok(!shareHtmlTs.includes("window.open('about:blank'"), 'public-share.html.ts must NEVER call window.open("about:blank")');
    assert.ok(
      !appHtml.includes("window.open(directUrl, '_blank', 'noopener,noreferrer')"),
      'public/app.html must NOT pass noopener,noreferrer in windowFeatures (causes false null return)'
    );
    assert.ok(
      !shareHtmlTs.includes("window.open(directUrl, '_blank', 'noopener,noreferrer')"),
      'public-share.html.ts must NOT pass noopener,noreferrer in windowFeatures'
    );

    // Runtime test via vm
    const fns = [
      extractFunctionSource(appHtml, 'function buildDirectStoreHandoffUrlWeb('),
      extractFunctionSource(appHtml, 'async function triggerBulkStoreHandoffWeb(')
    ].join('\n\n');

    const openedTabs: Array<{ url: string; target: string; features?: string; opener: any; closed: boolean }> = [];
    let simulateBlock = false;
    const toasts: string[] = [];
    const ctx: any = {
      window: {
        open: (url: string, target: string, features?: string) => {
          if (simulateBlock) return null;
          const tab = { url, target, features, opener: { fake: true }, closed: false };
          openedTabs.push(tab);
          return tab;
        }
      },
      fetch: () => Promise.resolve({ ok: true }),
      getActiveWebBasketItems: () => ({ active: [{ shoppingName: 'ספגטי' }, { shoppingName: 'ביצים' }] }),
      buildCleanStorePasteListJs: (items: any[]) => items.map((i) => i.shoppingName).join('\n'),
      tryCopyWebClipboardSync: () => true,
      tryCopyWebClipboard: async () => true,
      renderIngredientBasketBody: () => {},
      showToast: (msg: string) => toasts.push(msg),
      document: { getElementById: () => null },
      setTimeout: (fn: any) => { fn(); return 1; },
      URL,
      crypto: globalThis.crypto,
      Date,
      Math,
      JSON,
      Boolean
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    const state: any = {
      selectedMerchantId: 'hazi_hinam',
      recipeId: 'rec_1',
      listRevision: 1,
      handoffFeedback: null,
      showPlainCopyBox: false,
      merchants: [{
        id: 'hazi_hinam',
        displayName: 'חצי חינם',
        selectable: true,
        entryUrl: 'https://shop.hazi-hinam.co.il/quickbuy/editor'
      }]
    };

    // Case A: Normal browser (tab opens)
    await ctx.triggerBulkStoreHandoffWeb(state, true, null);
    assert.equal(openedTabs.length, 1, 'Must open EXACTLY ONE tab');
    assert.ok(openedTabs[0].url.startsWith('https://shop.hazi-hinam.co.il/quickbuy/editor?'), 'Opened URL must be Hazi Hinam quickbuy editor');
    assert.ok(openedTabs[0].url.includes('utm_source=my_recipes_app') && openedTabs[0].url.includes('click_id='), 'URL must retain UTM & click_id');
    assert.equal(openedTabs[0].opener, null, 'Must sever tab.opener for security');
    assert.equal(state.handoffFeedback.tone, 'success', 'Feedback must be success when tab opened');
    assert.ok(!state.handoffFeedback.message.includes('חסם'), 'Must NOT claim popup blocked when tab opened');

    // Case B: Genuine popup block (window.open returns null)
    simulateBlock = true;
    await ctx.triggerBulkStoreHandoffWeb(state, true, null);
    assert.equal(state.handoffFeedback.tone, 'warning', 'Feedback must warn on genuine popup block');
    assert.ok(state.handoffFeedback.message.includes('חסם'), 'Must show popup-blocked guidance ONLY on real block');
    assert.ok(state.handoffFeedback.fallbackUrl.startsWith('https://shop.hazi-hinam.co.il/quickbuy/editor'), 'Must provide direct fallback URL on real block');
    console.log('[ASSERT]: Single-tab handoff verified; opener severed; popup-blocked message shown ONLY on genuine block');
    console.log(`[TEST END]: M-1 SUCCESS | ${Date.now() - t0}ms`);
  });

  // M-2, M-3, L-1, L-2, and Version Bump
  test('M-2, M-3, L-1, L-2 & Version Bump: Dark header, 1-serving min, URL validation, cooked debounce, v1.9.7 Build 36', () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: M-2 Dark Header, M-3 Servings Min 1, L-1 URL Validation, L-2 Cooked Debounce, Version | ${new Date().toISOString()}`);

    // M-2: Dark mode top header CSS + theme-color sync
    assert.ok(appHtml.includes('body.dark-theme .top-nav'), 'Dark mode must explicitly style .top-nav');
    assert.ok(appHtml.includes('body.dark-theme .top-nav-title'), 'Dark mode must explicitly style .top-nav-title');
    assert.ok(appHtml.includes('body.dark-theme .top-nav-badge'), 'Dark mode must explicitly style .top-nav-badge');
    assert.ok(appHtml.includes('body.dark-theme .top-nav-profile-btn'), 'Dark mode must explicitly style .top-nav-profile-btn');
    assert.ok(!appHtml.includes('body.dark .ing-group-header'), 'Stale body.dark selector must be fixed to body.dark-theme');
    console.log('[ASSERT]: M-2 Dark mode header CSS verified');

    // M-3, L-1, L-2 via vm
    const fns = [
      'const COOKED_TAP_COOLDOWN_MS = 5000;',
      'const lastCookedTapByRecipe = {};',
      extractFunctionSource(appHtml, 'function updateServings('),
      extractFunctionSource(appHtml, 'function isValidExtractHttpUrl('),
      extractFunctionSource(appHtml, 'function markRecipeCookedToday(')
    ].join('\n\n');

    const toasts: string[] = [];
    const ctx: any = {
      STORAGE_KEY: 'my_recipes_saved',
      currentRecipe: { id: 'rec_pasta', title: 'פסטה', servings: 4, cookCount: 0 },
      savedRecipes: [{ id: 'rec_pasta', title: 'פסטה', servings: 4, cookCount: 0 }],
      servingMultiplier: 1,
      currentAuthToken: null,
      areRecipesDuplicateWeb: (a: any, b: any) => a.id === b.id,
      localStorage: { setItem: () => {} },
      renderRecipe: () => {},
      updateLibraryUI: () => {},
      syncCloudRecipes: () => {},
      showToast: (msg: string) => toasts.push(msg),
      setTimeout: () => 1,
      URL,
      Date,
      Math,
      Number,
      String,
      JSON
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    // M-3: Servings 4 -> 3 -> 2 -> 1 -> clamped at 1; and up to 20 -> clamped at 20
    ctx.updateServings(-1);
    assert.equal(Math.round(4 * ctx.servingMultiplier), 3);
    assert.equal(400 * ctx.servingMultiplier, 300);
    ctx.updateServings(-1);
    assert.equal(Math.round(4 * ctx.servingMultiplier), 2);
    assert.equal(400 * ctx.servingMultiplier, 200);
    ctx.updateServings(-1);
    assert.equal(Math.round(4 * ctx.servingMultiplier), 1, 'Servings stepper must allow reaching 1 serving');
    assert.equal(400 * ctx.servingMultiplier, 100);
    ctx.updateServings(-1);
    assert.equal(Math.round(4 * ctx.servingMultiplier), 1, 'Servings stepper must clamp at minimum 1');

    // Step up to cap 20
    for (let i = 0; i < 25; i++) ctx.updateServings(1);
    assert.equal(Math.round(4 * ctx.servingMultiplier), 20, 'Servings stepper must cap at 20');
    assert.equal(400 * ctx.servingMultiplier, 2000, '400g at 20 servings must equal 2000g');
    console.log('[ASSERT]: M-3 Servings stepper reaches 1, caps at 20, and preserves exact scaling math');

    // L-1: Client-side URL validation
    assert.equal(ctx.isValidExtractHttpUrl('זהו בכלל לא קישור תקין !!!'), false);
    assert.equal(ctx.isValidExtractHttpUrl('not-a-url'), false);
    assert.equal(ctx.isValidExtractHttpUrl('http://localhost'), false);
    assert.equal(ctx.isValidExtractHttpUrl('ftp://example.com/recipe'), false);
    assert.equal(ctx.isValidExtractHttpUrl('https://www.instagram.com/reel/abc123/'), true);
    assert.equal(ctx.isValidExtractHttpUrl('https://share.google/xyz123'), true);
    console.log('[ASSERT]: L-1 Client-side URL validation rejects garbage instantly and accepts valid links');

    // L-2: "בישלתי היום" debounce & confirmation feedback
    ctx.markRecipeCookedToday();
    assert.equal(ctx.currentRecipe.cookCount, 1, 'First click increments cookCount to 1');
    assert.ok(toasts[toasts.length - 1].includes('תועד'), 'First click must display confirmation toast');
    ctx.markRecipeCookedToday();
    assert.equal(ctx.currentRecipe.cookCount, 1, 'Immediate second click must NOT double-increment cookCount');
    assert.ok(toasts[toasts.length - 1].includes('כבר תועד'), 'Immediate second click shows already-recorded feedback');
    console.log('[ASSERT]: L-2 Cooked-today button gives confirmation feedback and prevents accidental double-increments');

    // Version bump check
    const mobileAppJson = JSON.parse(fs.readFileSync(MOBILE_APP_JSON_PATH, 'utf8'));
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    assert.equal(mobileAppJson.expo.version, '1.9.7');
    assert.equal(mobileAppJson.expo.android.versionCode, 36);
    assert.equal(mobileAppJson.expo.ios.buildNumber, '36');
    assert.ok(appHtml.includes('v1.9.7 (Build 36)'), 'public/app.html must display v1.9.7 (Build 36)');
    assert.ok(swJs.includes('v1.9.7 (Build 36)'), 'public/sw.js cache version must be bumped to v1.9.7 (Build 36)');
    console.log('[ASSERT]: Version bumped consistently to v1.9.7 (Build 36)');
    console.log(`[TEST END]: M-2..L-2 & Version Bump SUCCESS | ${Date.now() - t0}ms`);
  });
});
