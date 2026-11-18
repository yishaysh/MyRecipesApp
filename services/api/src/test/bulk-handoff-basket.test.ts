import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareShoppingIngredients,
  buildCleanStorePasteList,
  buildPersonalReferenceList,
  extractDietaryConstraints,
} from '../shared/utils/ingredientBasket.js';
import {
  scoreProductCandidate,
  computeQuantityAwarePricing,
  parseProductPackAndBasis,
  AutoMapperService,
} from '../services/catalog/auto-mapper.service.js';
import { GrowthStoreService } from '../services/growth-store.service.js';
import { buildApp } from '../app.js';

test('Bulk-List Supermarket Handoff, Data Quality & Pricing Gates Suite', async (t) => {
  // Gate 1: Truthful Workflow & Attribution
  await t.test('Gate 1: Verified merchant entry URLs, bulk handoff mode, and honest click attribution', async () => {
    const merchants = await GrowthStoreService.listMerchants();
    const haziHinam = merchants.find((m) => m.id === 'hazi_hinam');
    const shufersal = merchants.find((m) => m.id === 'shufersal');
    const ramiLevy = merchants.find((m) => m.id === 'rami_levy');

    assert.ok(haziHinam, 'Hazi Hinam merchant must be registered');
    assert.strictEqual(
      haziHinam.entryUrl,
      'https://shop.hazi-hinam.co.il/quickbuy/editor',
      'Hazi Hinam entryUrl must point to verified /quickbuy/editor, never broken /search?q='
    );
    assert.ok(
      haziHinam.instructionsStepsHe && haziHinam.instructionsStepsHe.length >= 3,
      'Hazi Hinam must provide 3-step Hebrew quick-buy guidance'
    );
    assert.ok(
      shufersal?.menuPathHe && ramiLevy?.menuPathHe,
      'Shufersal and Rami Levy must specify menu navigation paths for quick list'
    );

    // Verify Fastify app affiliate links route
    const app = await buildApp();
    try {
      const linkRes = await app.inject({
        method: 'POST',
        url: '/api/affiliate-links',
        payload: {
          merchantId: 'hazi_hinam',
          recipeId: 'rcp_carbonara_gate1',
          mode: 'bulk_handoff',
          ingredientQuery: 'ignored_in_bulk_mode',
        },
      });

      assert.strictEqual(linkRes.statusCode, 201);
      const linkData = JSON.parse(linkRes.body);
      assert.strictEqual(linkData.handoffMode, 'bulk_paste_editor');
      assert.ok(linkData.clickToken, 'Must generate clickToken');
      const goUrl = linkData.redirectUrl || linkData.goUrl;
      assert.ok(goUrl, 'Must return redirectUrl or goUrl');

      // Verify click redirection via /api/go/:clickToken
      const goRes = await app.inject({
        method: 'GET',
        url: goUrl,
      });

      assert.strictEqual(goRes.statusCode, 302);
      const targetLocation = goRes.headers.location;
      assert.ok(
        targetLocation && targetLocation.startsWith('https://shop.hazi-hinam.co.il/quickbuy/editor'),
        'Redirection target must be verified quickbuy editor URL'
      );
      assert.ok(
        !targetLocation.includes('ignored_in_bulk_mode'),
        'Bulk handoff must never leak individual ingredient names into store URL query params'
      );
    } finally {
      await app.close();
    }
  });

  // Gate 2: Clean Bulk List Generation
  await t.test('Gate 2: Ingredient normalization splits compounds, converts cooking forms, and excludes headers', async () => {
    const rawCarbonaraIngredients = [
      'לרוטב:',
      '200 גרם ספגטי',
      '150 גרם גואנצ׳אלה או פנצ׳טה',
      '4 חלמונים',
      '50 גרם פקורינו רומנו (או פרמזן)',
      'מלח ופלפל שחור',
      '1 כף שמן זית',
    ];

    const prepared = prepareShoppingIngredients(rawCarbonaraIngredients);

    // Section header excluded
    assert.ok(
      !prepared.some((it) => it.shoppingName.includes('לרוטב')),
      'Section headers must be stripped from purchasable list'
    );

    // Compound ingredient split: מלח ופלפל שחור -> מלח + פלפל שחור
    const saltItem = prepared.find((it) => it.shoppingName === 'מלח');
    const pepperItem = prepared.find((it) => it.shoppingName === 'פלפל שחור');
    assert.ok(saltItem, 'Must extract separate salt item');
    assert.ok(pepperItem, 'Must extract separate black pepper item');
    assert.strictEqual(saltItem.originalRecipeRequirement, 'מלח ופלפל שחור');

    // Cooking form conversion: 4 חלמונים -> ביצים with review note
    const eggItem = prepared.find((it) => it.shoppingName === 'ביצים');
    assert.ok(eggItem, 'Must convert egg yolks to purchasable eggs');
    assert.strictEqual(eggItem.requiresUserReview, true);
    assert.ok(
      eggItem.conversionNote && eggItem.conversionNote.includes('חלמונים'),
      'Egg item must explain yolks to whole eggs conversion'
    );

    // Alternative ingredients preserved
    const porkItem = prepared.find((it) => it.shoppingName.includes("גואנצ'אלה") || it.shoppingName.includes('פנצ'));
    assert.ok(porkItem, 'Must preserve alternative meat ingredient');
    assert.ok(
      porkItem.alternatives && porkItem.alternatives.length > 0,
      'Must offer user choice of alternative meats'
    );

    // Verify clean store paste list format (1 per line, strictly zero units, numbers, or bullets)
    const storePasteText = buildCleanStorePasteList(prepared);
    const storeLines = storePasteText.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of storeLines) {
      assert.ok(
        !/^\d+/.test(line),
        `Store paste line must not start with quantity/numbers: "${line}"`
      );
      assert.ok(
        !/[•\-*✓]/.test(line),
        `Store paste line must not contain bullets or checkmarks: "${line}"`
      );
      assert.ok(
        !/\b(?:גרם|ק"ג|מ"ל|ליטר|כף|כפות|כוס|כוסות)\b/.test(line),
        `Store paste line must not contain measurement units: "${line}"`
      );
    }

    // Verify personal reference list retains quantities
    const personalText = buildPersonalReferenceList(prepared);
    assert.ok(
      personalText.includes('ספגטי') && personalText.includes('200 גרם'),
      'Personal list must include full quantity and unit'
    );
  });

  // Gate 3: Ingredient Matching & Disqualifier Gates
  await t.test('Gate 3: Negative token and category disqualifiers reject squash, seeds, and wrong dietary products', async () => {
    // Spaghetti vs Spaghetti Squash
    const squashScore = scoreProductCandidate('ספגטי', 'דלעת ערמונים או דלעת ספגטי שלמה');
    assert.strictEqual(squashScore, 0, 'Spaghetti query must disqualify spaghetti squash');

    const realSpaghettiScore = scoreProductCandidate('ספגטי', 'ספגטי מס 5 ברילה 500 גרם');
    assert.ok(realSpaghettiScore >= 80, 'Spaghetti query must match real pasta');

    // Salt vs Unsalted Black Sunflower Seeds
    const sunflowerSeedsScore = scoreProductCandidate('מלח', 'גרעיני חמניה שחורים לא קלויים ללא מלח במשקל');
    assert.strictEqual(sunflowerSeedsScore, 0, 'Salt query must disqualify unsalted seeds');

    const pepperVsSeedsScore = scoreProductCandidate('פלפל שחור', 'גרעינים שחורים קלויים עם מלח');
    assert.strictEqual(pepperVsSeedsScore, 0, 'Black pepper query must disqualify sunflower seeds');

    // Dietary Symmetry: Gluten-free mismatch
    const normalSpaghettiVsGF = scoreProductCandidate('ספגטי', 'ספגטי ללא גלוטן ברילה 400 גרם');
    assert.strictEqual(normalSpaghettiVsGF, 0, 'Regular spaghetti query must reject gluten-free products');

    const gfSpaghettiMatch = scoreProductCandidate('ספגטי ללא גלוטן', 'ספגטי ללא גלוטן ברילה 400 גרם', ['ללא גלוטן']);
    assert.ok(gfSpaghettiMatch >= 80, 'Gluten-free request must match gluten-free product');

    // Olive Oil vs Oil Spray / Tuna / Memorial Candles
    const sprayScore = scoreProductCandidate('שמן זית', 'תרסיס שמן זית כתית מעולה 200 מ"ל');
    assert.strictEqual(sprayScore, 0, 'Olive oil query must reject oil sprays when spray not requested');

    const tunaScore = scoreProductCandidate('שמן זית', 'טונה בהירה בשמן זית פילטונה 4 מארז');
    assert.strictEqual(tunaScore, 0, 'Olive oil query must reject canned tuna in olive oil');

    const candleScore = scoreProductCandidate('שמן זית', 'כוסיות שמן זית לחנוכה 44 יח');
    assert.strictEqual(candleScore, 0, 'Olive oil query must reject Hanukkah memorial/oil cups');
  });

  // Gate 4: Quantity-Aware Pricing & Fair Basket Comparisons
  await t.test('Gate 4: Packaged and weighted pricing scale accurately with servings and prevent false cheapest claims', async () => {
    // 1. Weighted Pecorino: 50g requirement from a ₪169/kg deli basis
    const pecorinoPricing = computeQuantityAwarePricing(169.0, 'גבינת פקורינו רומנו במשקל לק"ג', '1 קילוגרם', 50, 'גרם');
    assert.strictEqual(pecorinoPricing.pricingBasis, 'per_kg');
    assert.strictEqual(pecorinoPricing.consumptionCost, 8.45, '50g pecorino consumption cost should be ₪8.45');
    assert.strictEqual(pecorinoPricing.purchasableCost, 16.9, 'Min deli purchasable quantity (100g) cost should be ₪16.90');

    // 2. Packaged Spaghetti (500g pack at ₪5.90): 2 servings (200g) vs 6 servings (600g)
    const spaghetti2Servings = computeQuantityAwarePricing(5.9, 'ספגטי מס 5 ברילה 500 גרם', '500 גרם', 200, 'גרם');
    assert.strictEqual(spaghetti2Servings.packsNeeded, 1, '200g requires 1 pack of 500g');
    assert.strictEqual(spaghetti2Servings.purchasableCost, 5.9);
    assert.strictEqual(spaghetti2Servings.consumptionCost, 2.36);

    const spaghetti6Servings = computeQuantityAwarePricing(5.9, 'ספגטי מס 5 ברילה 500 גרם', '500 גרם', 600, 'גרם');
    assert.strictEqual(spaghetti6Servings.packsNeeded, 2, '600g requires 2 packs of 500g');
    assert.strictEqual(spaghetti6Servings.purchasableCost, 11.8, '2 packs cost ₪11.80');
    assert.strictEqual(spaghetti6Servings.consumptionCost, 7.08);

    // 3. Basket Comparison: Partial coverage must never be flagged as cheapest basket
    const comparison = await AutoMapperService.compareBasketAcrossChains([
      { query: 'ספגטי', amount: 200, unit: 'גרם' },
      { query: 'גבינת פקורינו', amount: 50, unit: 'גרם' },
      { query: 'גואנצ׳אלה נדיר שאינו קיים במלאי', amount: 150, unit: 'גרם' },
    ]);

    for (const [ck, total] of Object.entries(comparison.chainTotals)) {
      if (total.matchedCount < total.totalCount) {
        assert.strictEqual(
          total.isCheapest,
          false,
          `Chain ${ck} has partial coverage (${total.matchedCount}/${total.totalCount}) and must never be labeled cheapest`
        );
        assert.strictEqual(total.isCompleteBasket, false);
        assert.ok(
          total.exclusionsNote && total.exclusionsNote.includes('הערכה חלקית'),
          `Chain ${ck} must include an honest partial estimation disclaimer`
        );
      }
    }
  });
});
