process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_HTML_PATH = path.join(REPO_ROOT, 'public', 'app.html');
const MOBILE_APP_JSON_PATH = path.join(REPO_ROOT, 'apps', 'mobile', 'app.json');
const SW_JS_PATH = path.join(REPO_ROOT, 'public', 'sw.js');
const MOBILE_RECIPE_MATCHER_PATH = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'utils', 'recipeMatcher.ts');
const MOBILE_STORE_PATH = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'store', 'recipeStore.ts');
const MOBILE_DETAIL_PATH = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'screens', 'RecipeDetailScreen.tsx');
const MOBILE_EXTRACT_PATH = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'screens', 'ExtractScreen.tsx');

function extractFunctionSource(html: string, funcDecl: string): string {
  const start = html.indexOf(funcDecl);
  assert.ok(start !== -1, `Expected to find "${funcDecl}" in public/app.html`);
  const lineStart = html.lastIndexOf('\n', start) + 1;
  const indentMatch = html.slice(lineStart, start).match(/^[ \t]*/);
  const indent = indentMatch ? indentMatch[0] : '';
  const closeMarker = `\n${indent}}`;
  const endIdx = html.indexOf(closeMarker, start);
  assert.ok(endIdx !== -1, `Expected closing "${closeMarker.trim()}" for "${funcDecl}"`);
  return html.slice(start, endIdx + closeMarker.length);
}

describe('v1.9.8 (Build 37) Targeted QA Regression Suite (H-1 & L-2)', () => {
  let app: FastifyInstance;
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

  before(async () => {
    console.log('[SETUP / FIXTURE] Booting isolated Fastify instance for v1.9.8 H-1 & L-2 regression tests');
    SyncService.inMemoryUserRecipes.clear();
    app = buildApp();
    await app.ready();
  });

  after(async () => {
    console.log('[CLEANUP / TEARDOWN] Closing Fastify instance and clearing isolated in-memory sync fixtures');
    SyncService.inMemoryUserRecipes.clear();
    await app.close();
  });

  // =========================================================================
  // H-1: RE-EXTRACT AS NEW MUST INSERT, NOT OVERWRITE (A, B, C, D, E)
  // =========================================================================

  test('H-1 (A, B, C, D): Web duplicate dialog view, create-new insert, repeat create-new, rapid taps, cancel/fail safety', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: H-1 Web Duplicate Dialog (A-D) | ${new Date().toISOString()}`);

    const fns = [
      'let isExtractInFlight = false;',
      'let isSyncingWebCloud = false;',
      'let pendingDuplicateRecipe = null;',
      'let pendingDuplicateUrl = "";',
      'let lastExtractRetryFn = null;',
      'const CLIENT_EXTRACT_TIMEOUT_MS = 10000;',
      extractFunctionSource(appHtml, 'function normalizeUrlForCompare('),
      extractFunctionSource(appHtml, 'function normalizeTitleForCompare('),
      extractFunctionSource(appHtml, 'function areRecipesDuplicateWeb('),
      extractFunctionSource(appHtml, 'function mergeRecipeEntriesWeb('),
      extractFunctionSource(appHtml, 'function deduplicateRecipesList('),
      extractFunctionSource(appHtml, 'function findExistingRecipeByUrlWeb('),
      extractFunctionSource(appHtml, 'function openDuplicateRecipeModal('),
      extractFunctionSource(appHtml, 'function handleDuplicateModalAction('),
      extractFunctionSource(appHtml, 'function isValidExtractHttpUrl('),
      extractFunctionSource(appHtml, 'function saveRecipeToStorage('),
      extractFunctionSource(appHtml, 'async function triggerExtract(')
    ].join('\n\n');

    const storageMap = new Map<string, string>();
    const toasts: Array<{ msg: string; type?: string }> = [];
    const errorsShown: string[] = [];
    let fetchCalls = 0;
    let nextFetchBehavior: (() => Promise<any>) | null = null;
    const urlInputEl = { value: '', focus: () => {} };
    const modalEl = { style: { display: 'none' } };
    const descEl = { textContent: '' };

    const ctx: any = {
      STORAGE_KEY: 'my_recipes_saved',
      savedRecipes: [],
      currentRecipe: null,
      servingMultiplier: 1,
      currentAuthToken: null,
      localStorage: {
        setItem: (k: string, v: string) => storageMap.set(k, v),
        getItem: (k: string) => storageMap.get(k) || null
      },
      document: {
        getElementById: (id: string) => {
          if (id === 'url-input') return urlInputEl;
          if (id === 'duplicate-recipe-modal') return modalEl;
          if (id === 'duplicate-recipe-desc') return descEl;
          return { style: {}, disabled: false, textContent: '' };
        }
      },
      fetch: async () => {
        fetchCalls++;
        if (nextFetchBehavior) return nextFetchBehavior();
        throw new Error('Unexpected fetch call');
      },
      checkQuotaBeforeExtract: () => true,
      applySuccessfulExtractionQuota: () => {},
      handleQuotaExceededResponse: () => {},
      setStep: () => {},
      renderRecipe: () => {},
      switchTab: () => {},
      updateLibraryUI: () => {},
      syncCloudRecipes: () => {},
      showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
      showError: (msg: string) => errorsShown.push(msg),
      friendlyExtractError: (err: any) => err?.message || 'error',
      AbortController,
      setTimeout,
      clearTimeout,
      URL,
      Date,
      Math,
      Set,
      Array,
      JSON,
      Boolean,
      String,
      Number,
      Error
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    // Seed original recipe with known id, URL, 2026-11-13 createdAt, user notes & cookCount
    const seededOriginal = {
      id: 'rec_original_20261113',
      title: 'פסטה עגבניות מהקרוסלה',
      sourceUrl: 'https://www.instagram.com/reel/CxCarousel999/',
      createdAt: '2026-11-13T08:30:00.000Z',
      updatedAt: '2026-11-13T08:30:00.000Z',
      notes: 'הערה אישית מקורית',
      cookCount: 3,
      lastCookedAt: '2026-11-20T18:00:00.000Z',
      lastCookedDate: '2026-11-20',
      isBookmarked: true,
      ingredients: [{ name: 'ספגטי', amount: 400, unit: 'גרם' }],
      instructions: [{ stepNumber: 1, instruction: 'מבשלים' }]
    };
    ctx.savedRecipes = [JSON.parse(JSON.stringify(seededOriginal))];
    storageMap.set('my_recipes_saved', JSON.stringify(ctx.savedRecipes));
    const snapshotBeforeView = storageMap.get('my_recipes_saved');

    // --- Test A: "צפייה במתכון" (view-only, no extraction, storage & count unchanged) ---
    urlInputEl.value = seededOriginal.sourceUrl;
    await ctx.triggerExtract(false);
    assert.equal(modalEl.style.display, 'flex', 'Duplicate dialog must open for existing URL');
    assert.equal(fetchCalls, 0, 'Duplicate pre-check must not call extraction API');

    ctx.handleDuplicateModalAction('view');
    assert.equal(ctx.currentRecipe.id, seededOriginal.id, 'A: View must open existing recipe id');
    assert.equal(fetchCalls, 0, 'A: View must NOT call extraction API');
    assert.equal(storageMap.get('my_recipes_saved'), snapshotBeforeView, 'A: View must leave localStorage untouched');
    assert.equal(ctx.savedRecipes.length, 1, 'A: Library count remains 1');
    console.log('[ASSERT]: H-1 Test A passed (view-only preserves storage, timestamps, count, 0 API calls)');

    // --- Test B: "חילוץ מחדש (מתכון חדש)" creates separate entry with fresh id/createdAt & clean user defaults ---
    urlInputEl.value = seededOriginal.sourceUrl;
    await ctx.triggerExtract(false);
    assert.equal(modalEl.style.display, 'flex');

    let resolveExtractionB!: (val: any) => void;
    nextFetchBehavior = () =>
      new Promise((resolve) => {
        resolveExtractionB = resolve;
      });

    // Fire re-extract AND immediately simulate a rapid duplicate tap while in-flight (part of Test D)
    const pExtractB = ctx.triggerExtract(true, seededOriginal.sourceUrl);
    const pRapidTap = ctx.triggerExtract(true, seededOriginal.sourceUrl);
    await pRapidTap; // must return immediately due to isExtractInFlight lock
    assert.equal(fetchCalls, 1, 'D: Rapid double-tap while in-flight must only trigger ONE extraction request');

    resolveExtractionB({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        recipe: {
          id: seededOriginal.id, // Even if cache/server returns the same id, client must mint a brand-new id!
          title: 'פסטה עגבניות מהקרוסלה - גרסה שנייה',
          sourceUrl: seededOriginal.sourceUrl,
          createdAt: seededOriginal.createdAt,
          cookCount: 3, // Even if upstream payload had stale user state, create-new must reset defaults!
          notes: 'stale',
          ingredients: [{ name: 'פנה', amount: 500, unit: 'גרם' }],
          instructions: [{ stepNumber: 1, instruction: 'מבשלים פנה' }]
        }
      })
    });
    await pExtractB;

    const storedAfterB = JSON.parse(storageMap.get('my_recipes_saved')!);
    assert.equal(storedAfterB.length, 2, 'B: Library count must rise from 1 to 2');
    const origAfterB = storedAfterB.find((r: any) => r.id === seededOriginal.id);
    const newAfterB = storedAfterB.find((r: any) => r.id !== seededOriginal.id);
    assert.ok(origAfterB, 'B: Original record must remain in storage');
    assert.ok(newAfterB, 'B: New record must be inserted with distinct id');
    assert.equal(origAfterB.createdAt, seededOriginal.createdAt, 'B: Original createdAt must be unchanged');
    assert.equal(origAfterB.updatedAt, seededOriginal.updatedAt, 'B: Original updatedAt must be unchanged');
    assert.equal(origAfterB.title, seededOriginal.title, 'B: Original title/content must be unchanged');
    assert.equal(origAfterB.cookCount, 3, 'B: Original cookCount must be unchanged');
    assert.equal(origAfterB.notes, 'הערה אישית מקורית', 'B: Original user notes must be unchanged');

    assert.notEqual(newAfterB.id, seededOriginal.id, 'B: New entry must have a fresh unique id');
    assert.notEqual(newAfterB.createdAt, seededOriginal.createdAt, 'B: New entry must have fresh createdAt');
    assert.equal(newAfterB.title, 'פסטה עגבניות מהקרוסלה - גרסה שנייה', 'B: New entry must store new extraction content');
    assert.equal(newAfterB.cookCount, 0, 'B: New entry must NOT inherit old cookCount');
    assert.equal(newAfterB.notes, null, 'B: New entry must NOT inherit old notes');
    assert.equal(newAfterB.isBookmarked, false, 'B: New entry must use clean new-recipe defaults');
    assert.equal(ctx.currentRecipe.id, newAfterB.id, 'B: Newly created recipe must be opened as currentRecipe');
    console.log(`[ASSERT]: H-1 Test B passed (orig=${origAfterB.id}@${origAfterB.createdAt}, new=${newAfterB.id}@${newAfterB.createdAt}, count=2)`);

    // --- Test C: Repeat create-new for SAME source with IDENTICAL title -> count rises 2 -> 3 ---
    nextFetchBehavior = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        recipe: {
          id: 'rec_identical_title_server',
          title: seededOriginal.title, // EXACT same title & URL!
          sourceUrl: seededOriginal.sourceUrl,
          ingredients: [{ name: 'טליאטלה', amount: 300, unit: 'גרם' }],
          instructions: [{ stepNumber: 1, instruction: 'מבשלים טליאטלה' }]
        }
      })
    });
    await ctx.triggerExtract(true, seededOriginal.sourceUrl);
    const storedAfterC = JSON.parse(storageMap.get('my_recipes_saved')!);
    assert.equal(storedAfterC.length, 3, 'C: Repeat create-new with matching URL & title must rise count from 2 to 3');
    const uniqueIdsC = new Set(storedAfterC.map((r: any) => r.id));
    assert.equal(uniqueIdsC.size, 3, 'C: All 3 recipes must have distinct IDs');
    // Reload dedup check: all 3 must survive
    assert.equal(ctx.deduplicateRecipesList(storedAfterC).length, 3, 'C: All 3 entries must survive deduplicateRecipesList on reload');
    console.log('[ASSERT]: H-1 Test C passed (repeat create-new with identical title -> 3 distinct entries)');

    // --- Test D: Failed extraction & cancellation leave original untouched and add 0 phantom entries ---
    const snapshotBeforeFail = storageMap.get('my_recipes_saved');
    nextFetchBehavior = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Temporary server error' })
    });
    await ctx.triggerExtract(true, seededOriginal.sourceUrl);
    assert.equal(storageMap.get('my_recipes_saved'), snapshotBeforeFail, 'D: Failed extraction must NOT mutate storage or add phantom entry');

    // Simulate AbortError (cancelled extraction)
    nextFetchBehavior = async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };
    await ctx.triggerExtract(true, seededOriginal.sourceUrl);
    assert.equal(storageMap.get('my_recipes_saved'), snapshotBeforeFail, 'D: Cancelled extraction must NOT mutate storage or add phantom entry');

    // Genuine edit of original recipe must still UPDATE in place (not create duplicate!)
    const editedOriginal = { ...origAfterB, title: 'פסטה עגבניות ערוכה', isUserEdited: true, updatedAt: new Date().toISOString() };
    ctx.saveRecipeToStorage(editedOriginal);
    const storedAfterEdit = JSON.parse(storageMap.get('my_recipes_saved')!);
    assert.equal(storedAfterEdit.length, 3, 'Genuine edit must update existing id in place without creating a 4th entry');
    assert.equal(storedAfterEdit.find((r: any) => r.id === seededOriginal.id).title, 'פסטה עגבניות ערוכה');
    console.log('[ASSERT]: H-1 Test D passed (rapid taps, 500 failure, abort cancellation, and genuine in-place edit)');
    console.log(`[TEST END]: H-1 Web (A-D) SUCCESS | ${Date.now() - t0}ms`);
  });

  test('H-1 (E): Cloud Sync API (POST /api/v1/sync/recipes) preserves both original & re-extracted duplicate entries + Android matcher/store parity', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: H-1 Test E Cloud Sync & Android Parity | ${new Date().toISOString()}`);

    // Create isolated test session via AuthService.createGuestSession
    const { token: session } = await AuthService.createGuestSession('usr_v198_h1_isolated');

    const original = {
      id: 'rec_cloud_orig_1',
      title: 'עוגת שוקולד מהקרוסלה',
      sourceUrl: 'https://www.instagram.com/reel/CloudCarousel777/',
      createdAt: '2026-11-13T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
      cookCount: 2,
      lastCookedAt: '2026-11-20T12:00:00.000Z',
      lastCookedDate: '2026-11-20',
      ingredients: [{ id: 'i1', name: 'קמח', amount: 200, unit: 'גרם', originalText: '200 גרם קמח' }],
      instructions: [{ stepNumber: 1, instruction: 'מערבבים' }]
    };

    // Step 1: Initial cloud sync with original recipe
    const sync1 = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/recipes',
      headers: { Authorization: `Bearer ${session}` },
      payload: { localRecipes: [original] }
    });
    assert.equal(sync1.statusCode, 200);
    const body1 = JSON.parse(sync1.payload);
    assert.equal(body1.mergedRecipes.length, 1);

    // Step 2: User clicks "חילוץ מחדש (מתכון חדש)" -> client inserts second entry with allowDuplicate: true and syncs to cloud!
    const reExtractedNew = {
      id: 'rec_cloud_new_2_re',
      title: 'עוגת שוקולד מהקרוסלה', // EXACT same title & URL!
      sourceUrl: 'https://www.instagram.com/reel/CloudCarousel777/',
      allowDuplicate: true,
      createdAt: '2026-11-22T12:00:00.000Z',
      updatedAt: '2026-11-22T12:00:00.000Z',
      cookCount: 0,
      lastCookedAt: null,
      lastCookedDate: null,
      ingredients: [{ id: 'i2', name: 'קקאו', amount: 100, unit: 'גרם', originalText: '100 גרם קקאו' }],
      instructions: [{ stepNumber: 1, instruction: 'אופים 30 דקות' }]
    };

    const sync2 = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/recipes',
      headers: { Authorization: `Bearer ${session}` },
      payload: { localRecipes: [reExtractedNew, original] }
    });
    assert.equal(sync2.statusCode, 200);
    const body2 = JSON.parse(sync2.payload);
    assert.equal(body2.mergedRecipes.length, 2, 'Cloud sync MUST preserve BOTH original and re-extracted recipe (not collapse into 1!)');

    const cloudOrig = body2.mergedRecipes.find((r: any) => r.id === 'rec_cloud_orig_1');
    const cloudNew = body2.mergedRecipes.find((r: any) => r.id === 'rec_cloud_new_2_re');
    assert.ok(cloudOrig, 'Original recipe must survive cloud sync with original id');
    assert.ok(cloudNew, 'Re-extracted recipe must survive cloud sync with new id');
    assert.equal(cloudOrig.createdAt, '2026-11-13T10:00:00.000Z', 'Original createdAt untouched after cloud sync');
    assert.equal(cloudOrig.cookCount, 2, 'Original cookCount untouched after cloud sync');
    assert.equal(cloudNew.createdAt, '2026-11-22T12:00:00.000Z', 'New recipe createdAt preserved in cloud sync');
    assert.equal(Number(cloudNew.cookCount || 0), 0, 'New recipe keeps independent cookCount=0');

    // Step 3: Subsequent POST /api/v1/sync/pull must ALSO return both records intact
    const pullRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/pull',
      headers: { Authorization: `Bearer ${session}` }
    });
    assert.equal(pullRes.statusCode, 200);
    const pullBody = JSON.parse(pullRes.payload);
    assert.equal(pullBody.recipes.length, 2, 'Cloud pull must keep both original & re-extracted entries');

    // Verify Android matcher + store + ExtractScreen carry forceNew & in-flight lock
    const mobileMatcherSrc = fs.readFileSync(MOBILE_RECIPE_MATCHER_PATH, 'utf8');
    const mobileStoreSrc = fs.readFileSync(MOBILE_STORE_PATH, 'utf8');
    const mobileExtractSrc = fs.readFileSync(MOBILE_EXTRACT_PATH, 'utf8');
    assert.ok(mobileMatcherSrc.includes('allowDuplicate'), 'Mobile recipeMatcher must respect allowDuplicate');
    assert.ok(mobileStoreSrc.includes('allowDuplicate: true') && mobileStoreSrc.includes('cookCount: 0'), 'Mobile store forceNew must mint clean new recipe');
    assert.ok(mobileExtractSrc.includes('isExtractingRef.current') && mobileExtractSrc.includes('runExtraction(cleanUrl, true)'), 'Mobile ExtractScreen must lock in-flight and pass forceNew=true');
    console.log('[ASSERT]: H-1 Test E passed (cloud sync push+pull preserves both records; Android parity verified)');
    console.log(`[TEST END]: H-1 (E) SUCCESS | ${Date.now() - t0}ms`);
  });

  // =========================================================================
  // L-2: RECORD COOKING AT MOST ONCE PER RECIPE PER LOCAL CALENDAR DAY (A-F)
  // =========================================================================

  test('L-2 (A, B, C, D, E, F): Per-recipe local-calendar-day idempotency, midnight transition, UTC-diff boundary, independent recipes, persistence failure & Android parity', async () => {
    const t0 = Date.now();
    console.log(`\n[TEST START]: L-2 Local Calendar Day Idempotency (A-F) | ${new Date().toISOString()}`);

    const fns = [
      'const isRecordingCookByRecipe = {};',
      'let lastRenderedLocalDateKey = "";',
      'let localMidnightRefreshTimer = null;',
      'let cookingVisibilityBound = false;',
      extractFunctionSource(appHtml, 'function getLocalCalendarDateKey('),
      extractFunctionSource(appHtml, 'function getRecipeLastCookedLocalDate('),
      extractFunctionSource(appHtml, 'function hasRecipeBeenCookedOnDate('),
      extractFunctionSource(appHtml, 'function refreshIfLocalDateChanged('),
      extractFunctionSource(appHtml, 'function scheduleLocalMidnightRefresh('),
      extractFunctionSource(appHtml, 'function markRecipeCookedToday(')
    ].join('\n\n');

    // Controllable clock class so we can freeze & advance local time deterministically
    let fakeNowMs = new Date(2026, 10, 22, 14, 0, 0).getTime(); // Local 2026-11-22 14:00:00
    class FakeDate extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) super(fakeNowMs);
        else if (args.length === 1) super(args[0]);
        else super(args[0], args[1], args[2], args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0);
      }
      static now() {
        return fakeNowMs;
      }
    }

    const storageMap = new Map<string, string>();
    let failNextStorageWrite = false;
    let renderCount = 0;
    const toasts: Array<{ msg: string; type?: string }> = [];
    let scheduledMidnightFn: (() => void) | null = null;
    let scheduledMidnightDelay = 0;

    const recipeA = { id: 'rec_cook_A', title: 'שקשוקה', cookCount: 0, lastCookedAt: null, lastCookedDate: null, updatedAt: '2026-11-20T00:00:00.000Z' };
    const recipeB = { id: 'rec_cook_B', title: 'פסטה', cookCount: 0, lastCookedAt: null, lastCookedDate: null, updatedAt: '2026-11-20T00:00:00.000Z' };

    const ctx: any = {
      STORAGE_KEY: 'my_recipes_saved',
      savedRecipes: [JSON.parse(JSON.stringify(recipeA)), JSON.parse(JSON.stringify(recipeB))],
      currentRecipe: JSON.parse(JSON.stringify(recipeA)),
      currentAuthToken: null,
      areRecipesDuplicateWeb: (a: any, b: any) => a && b && a.id === b.id,
      localStorage: {
        setItem: (k: string, v: string) => {
          if (failNextStorageWrite) throw new Error('QuotaExceededError');
          storageMap.set(k, v);
        },
        getItem: (k: string) => storageMap.get(k) || null
      },
      renderRecipe: () => { renderCount++; },
      updateLibraryUI: () => {},
      syncCloudRecipes: () => {},
      showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
      setTimeout: (fn: () => void, ms: number) => {
        scheduledMidnightFn = fn;
        scheduledMidnightDelay = ms;
        return 1;
      },
      clearTimeout: () => {},
      Date: FakeDate,
      Math,
      Number,
      String,
      Boolean,
      JSON
    };
    vm.createContext(ctx);
    vm.runInContext(fns, ctx);

    // --- Test A: Frozen local date 2026-11-22 -> record once ---
    ctx.markRecipeCookedToday();
    const persistedA1 = JSON.parse(storageMap.get('my_recipes_saved')!).find((r: any) => r.id === 'rec_cook_A');
    assert.equal(persistedA1.cookCount, 1, 'A: First tap must increment cookCount to 1');
    assert.equal(persistedA1.lastCookedDate, '2026-11-22', 'A: Persisted local date must be 2026-11-22');
    assert.equal(ctx.hasRecipeBeenCookedOnDate(persistedA1, new FakeDate()), true, 'A: Eligibility check must report recorded today');
    assert.equal(toasts.filter((t) => t.type === 'success').length, 1, 'A: Exactly one success toast');
    console.log('[ASSERT]: L-2 Test A passed (1st tap -> cookCount=1, lastCookedDate=2026-11-22, 1 success toast)');

    // --- Test B: Repeated/rapid taps same day + after reload/remount ---
    const timestampAfterFirst = persistedA1.lastCookedAt;
    ctx.markRecipeCookedToday();
    ctx.markRecipeCookedToday();
    fakeNowMs = new Date(2026, 10, 22, 23, 50, 0).getTime(); // 9h50m later, STILL same local calendar day
    ctx.markRecipeCookedToday();
    const persistedA2 = JSON.parse(storageMap.get('my_recipes_saved')!).find((r: any) => r.id === 'rec_cook_A');
    assert.equal(persistedA2.cookCount, 1, 'B: Same-day repeated taps must NOT increment cookCount');
    assert.equal(persistedA2.lastCookedAt, timestampAfterFirst, 'B: Same-day duplicate must NOT change lastCookedAt');
    assert.equal(toasts.filter((t) => t.type === 'success').length, 1, 'B: Must NOT repeat success toast on same day');

    // Simulate page reload / remount from persisted localStorage
    ctx.savedRecipes = JSON.parse(storageMap.get('my_recipes_saved')!);
    ctx.currentRecipe = JSON.parse(JSON.stringify(ctx.savedRecipes.find((r: any) => r.id === 'rec_cook_A')));
    ctx.markRecipeCookedToday();
    assert.equal(ctx.currentRecipe.cookCount, 1, 'B: Reloaded same-day tap must remain blocked at cookCount=1');
    assert.equal(toasts.filter((t) => t.type === 'success').length, 1, 'B: No success toast after reload on same day');
    console.log('[ASSERT]: L-2 Test B passed (same-day repeat taps + reload blocked, no extra toast)');

    // --- Test D: Near local midnight where UTC date differs vs local date ---
    // Record on recipe B at 23:58 local on 2026-11-22, then advance ONLY 4 minutes to 00:02 local on 2026-11-23.
    // (In UTC+2, 23:58 local is 21:58Z on Nov 22, and 00:02 local is 22:02Z STILL on Nov 22 UTC! And only 4 min elapsed, not 24h!)
    fakeNowMs = new Date(2026, 10, 22, 23, 58, 0).getTime();
    ctx.currentRecipe = JSON.parse(JSON.stringify(ctx.savedRecipes.find((r: any) => r.id === 'rec_cook_B')));
    ctx.markRecipeCookedToday();
    const persistedB1 = JSON.parse(storageMap.get('my_recipes_saved')!).find((r: any) => r.id === 'rec_cook_B');
    assert.equal(persistedB1.cookCount, 1, 'E/D: Recipe B is independently eligible on same day 2026-11-22');
    assert.equal(persistedB1.lastCookedDate, '2026-11-22', 'D: Recipe B recorded on local date 2026-11-22');

    // Schedule midnight timer while app remains open
    ctx.lastRenderedLocalDateKey = '2026-11-22';
    ctx.scheduleLocalMidnightRefresh();
    assert.ok(scheduledMidnightFn && scheduledMidnightDelay > 0 && scheduledMidnightDelay <= 3 * 60 * 1000, 'C: Midnight timer scheduled cleanly');

    // --- Test C & D: Advance 4 minutes across local midnight -> 2026-11-23 00:02 local ---
    fakeNowMs = new Date(2026, 10, 23, 0, 2, 0).getTime();
    const rendersBeforeMidnight = renderCount;
    scheduledMidnightFn!(); // Fires midnight callback while app stayed open
    assert.ok(renderCount > rendersBeforeMidnight, 'C: Open app must re-render when crossing local midnight');
    assert.equal(ctx.hasRecipeBeenCookedOnDate(persistedB1, new FakeDate()), false, 'C/D: Control must re-enable on next local calendar day (even 4 min later & same UTC date)');

    ctx.markRecipeCookedToday();
    const persistedB2 = JSON.parse(storageMap.get('my_recipes_saved')!).find((r: any) => r.id === 'rec_cook_B');
    assert.equal(persistedB2.cookCount, 2, 'C: Next-day tap must increment lifetime cookCount from 1 to 2');
    assert.equal(persistedB2.lastCookedDate, '2026-11-23', 'C: Updated lastCookedDate to 2026-11-23');
    // Second tap on new day must again be blocked
    ctx.markRecipeCookedToday();
    assert.equal(JSON.parse(storageMap.get('my_recipes_saved')!).find((r: any) => r.id === 'rec_cook_B').cookCount, 2, 'C: Second tap on new day blocked');
    console.log('[ASSERT]: L-2 Tests C & D passed (midnight rollover re-enabled after 4m across local midnight; lifetime count preserved)');

    // --- Test E: Persistence failure restores retry eligibility, then retry succeeds once ---
    ctx.currentRecipe = JSON.parse(JSON.stringify(ctx.savedRecipes.find((r: any) => r.id === 'rec_cook_A')));
    failNextStorageWrite = true;
    const successToastsBeforeFail = toasts.filter((t) => t.type === 'success').length;
    ctx.markRecipeCookedToday();
    assert.equal(ctx.currentRecipe.cookCount, 1, 'E: Failed write must roll back cookCount to 1');
    assert.equal(ctx.currentRecipe.lastCookedDate, '2026-11-22', 'E: Failed write must roll back lastCookedDate');
    assert.equal(toasts.filter((t) => t.type === 'success').length, successToastsBeforeFail, 'E: Failed write must NOT show success toast');
    assert.equal(toasts[toasts.length - 1].type, 'danger', 'E: Failed write must show error feedback');

    // Retry now succeeds
    failNextStorageWrite = false;
    ctx.markRecipeCookedToday();
    const persistedARetry = JSON.parse(storageMap.get('my_recipes_saved')!).find((r: any) => r.id === 'rec_cook_A');
    assert.equal(persistedARetry.cookCount, 2, 'E: Retry after failure must succeed once (cookCount=2)');
    assert.equal(persistedARetry.lastCookedDate, '2026-11-23', 'E: Retry persists 2026-11-23');
    console.log('[ASSERT]: L-2 Test E passed (independent recipes + persistence failure rollback & clean retry)');

    // --- Test F: Cloud sync preserves lastCookedDate + Android foreground/resume & store guard verified ---
    const { token: session } = await AuthService.createGuestSession('usr_v198_l2_isolated');
    const cookSyncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/recipes',
      headers: { Authorization: `Bearer ${session}` },
      payload: { localRecipes: [persistedARetry] }
    });
    assert.equal(cookSyncRes.statusCode, 200);
    const syncedCooked = JSON.parse(cookSyncRes.payload).mergedRecipes.find((r: any) => r.id === 'rec_cook_A');
    assert.equal(syncedCooked.cookCount, 2, 'F: Cloud sync must preserve cookCount');
    assert.equal(syncedCooked.lastCookedDate, '2026-11-23', 'F: Cloud sync must preserve lastCookedDate');

    const mobileStoreSrc = fs.readFileSync(MOBILE_STORE_PATH, 'utf8');
    const mobileDetailSrc = fs.readFileSync(MOBILE_DETAIL_PATH, 'utf8');
    assert.ok(mobileStoreSrc.includes('hasRecipeBeenCookedOnDate(target, dateKey)'), 'F: Mobile store must guard markRecipeCookedToday authoritatively');
    assert.ok(mobileDetailSrc.includes("AppState.addEventListener('change'") && mobileDetailSrc.includes('msUntilLocalMidnight'), 'F: Mobile RecipeDetailScreen must recompute on Android foreground resume and midnight');
    assert.ok(mobileDetailSrc.includes('disabled={isCookedToday}'), 'F: Mobile button must disable when recorded today');

    // Version consistency check across all web & config surfaces
    const mobileAppJson = JSON.parse(fs.readFileSync(MOBILE_APP_JSON_PATH, 'utf8'));
    const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
    const expectedLabel = `v${mobileAppJson.expo.version} (Build ${mobileAppJson.expo.android.versionCode})`;
    assert.equal(mobileAppJson.expo.ios.buildNumber, String(mobileAppJson.expo.android.versionCode));
    assert.ok(appHtml.includes(expectedLabel), `public/app.html must display ${expectedLabel}`);
    assert.ok(swJs.includes(expectedLabel), `public/sw.js must match ${expectedLabel}`);
    console.log(`[ASSERT]: L-2 Test F + ${expectedLabel} consistency passed`);
    console.log(`[TEST END]: L-2 (A-F) SUCCESS | ${Date.now() - t0}ms`);
  });
});
