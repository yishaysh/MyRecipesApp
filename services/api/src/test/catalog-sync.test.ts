import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import jwt from 'jsonwebtoken';
import { buildApp } from '../app.js';
import { getDb } from '../db/index.js';
import { chainProducts, chainImportRuns, chainCatalogConfigs, catalogUploadChunks } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  createPriceParserPipeline,
  normalizeHebrewText,
  PriceXmlStreamParser,
} from '../services/catalog/price-xml-parser.js';
import { ChainCatalogService, SUPPORTED_CHAINS } from '../services/catalog/chain-fetchers.js';

describe('Real Chain Catalog Auto-Import, Streaming & Large-File Chunked Upload Suite', () => {
  let app: any;
  let adminToken: string;
  const originalEnv = { ...process.env };
  const logPhase = (phase: string, msg: string) => console.log(`[${phase}]: ${msg}`);

  before(async () => {
    process.env.JWT_SECRET = 'test-admin-jwt-secret-2026';
    process.env.CRON_SECRET = 'test-cron-secret-2026';
    process.env.ADMIN_PASSWORD = 'test-admin-password';

    adminToken = jwt.sign({ role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    app = buildApp();
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
    process.env = originalEnv;

    // Clean up test items
    const db = getDb();
    if (db) {
      try {
        await db.delete(chainProducts).where(eq(chainProducts.chain, 'shufersal'));
        await db.delete(chainProducts).where(eq(chainProducts.chain, 'rami_levy'));
        await db.delete(chainProducts).where(eq(chainProducts.chain, 'hazi_hinam'));
      } catch {}
    }
  });

  test('1. Streaming XML Parser: handles plain & gzipped XML with CDATA, entities, and Hebrew text normalization', async () => {
    const rawXml = `<?xml version="1.0" encoding="utf-8"?>
<Root>
  <ChainID>7290027600007</ChainID>
  <SubChainID>001</SubChainID>
  <StoreID>091</StoreID>
  <Items>
    <Item>
      <ItemCode>72900001</ItemCode>
      <ItemName><![CDATA[חלב תנובה 3% 1 ליטר &quot;מהדרין&quot;]]></ItemName>
      <ItemPrice>6.81</ItemPrice>
      <ManufactureName>תנובה מרכז שיתופי</ManufactureName>
      <UnitQty>ליטר</UnitQty>
    </Item>
    <Item>
      <ItemCode>72900002</ItemCode>
      <ItemName>גבינה לבנה 5% 250 גרם &amp; טרייה</ItemName>
      <ItemPrice>5.45</ItemPrice>
      <ManufactureName>שטראוס</ManufactureName>
      <UnitQty>גרם</UnitQty>
    </Item>
    <Item>
      <!-- Incomplete item without price should be skipped -->
      <ItemCode>72900003</ItemCode>
      <ItemName>מוצר פגום ללא מחיר</ItemName>
    </Item>
  </Items>
</Root>`;

    // Test A: Plain XML stream
    const plainPipeline = createPriceParserPipeline(false);
    Readable.from([rawXml]).pipe(plainPipeline.input);

    const plainItems: any[] = [];
    for await (const product of plainPipeline.parser) {
      plainItems.push(product);
    }

    assert.strictEqual(plainItems.length, 2, 'Should parse 2 complete products and skip invalid one');
    assert.strictEqual(plainItems[0].itemCode, '72900001');
    assert.strictEqual(plainItems[0].name, 'חלב תנובה 3% 1 ליטר "מהדרין"');
    assert.strictEqual(plainItems[0].price, '6.81');
    assert.strictEqual(plainItems[0].manufacturer, 'תנובה מרכז שיתופי');
    assert.strictEqual(plainItems[0].unitQty, 'ליטר');

    assert.strictEqual(plainItems[1].itemCode, '72900002');
    assert.strictEqual(plainItems[1].name, 'גבינה לבנה 5% 250 גרם & טרייה');

    // Test B: Gzipped XML stream
    const gzippedBuffer = zlib.gzipSync(Buffer.from(rawXml, 'utf-8'));
    const gzPipeline = createPriceParserPipeline(true);
    Readable.from([gzippedBuffer]).pipe(gzPipeline.input);

    const gzItems: any[] = [];
    for await (const product of gzPipeline.parser) {
      gzItems.push(product);
    }

    assert.strictEqual(gzItems.length, 2, 'Gzip pipeline should parse identical items');
    assert.strictEqual(gzItems[0].itemCode, '72900001');

    // Test C: Hebrew normalization
    const normalized = normalizeHebrewText('חָלָב תְּנוּבָה 3% "מְהַדְּרִין"');
    assert.ok(!normalized.includes('\u05B8'), 'Nikud vowel points must be stripped');
    assert.ok(normalized.includes('חלב תנובה'), 'Clean normalized text should match');

    // Test D: Multi-chunk UTF-8 byte-boundary split + self-closing tag handling
    const splitXml = `<Items><Item><ItemCode>7299999</ItemCode><ItemName>חלב תנובה 3%</ItemName><UnitQty /><Quantity>1.00</Quantity><ItemPrice>6.90</ItemPrice></Item></Items>`;
    const utf8Buf = Buffer.from(splitXml, 'utf-8');
    // Split every 3 bytes to intentionally break multi-byte Hebrew letters across chunks
    const tinyChunks: Buffer[] = [];
    for (let i = 0; i < utf8Buf.length; i += 3) {
      tinyChunks.push(utf8Buf.subarray(i, i + 3));
    }
    const splitPipeline = createPriceParserPipeline(false);
    Readable.from(tinyChunks).pipe(splitPipeline.input);

    const splitItems: any[] = [];
    for await (const product of splitPipeline.parser) {
      splitItems.push(product);
    }

    assert.strictEqual(splitItems.length, 1);
    assert.strictEqual(splitItems[0].name, 'חלב תנובה 3%', 'Split UTF-8 bytes must decode without U+FFFD corruption');
    assert.ok(!splitItems[0].name.includes('\uFFFD'));
    assert.strictEqual(splitItems[0].unitQty, '1.00', 'Self-closing <UnitQty /> must not swallow <Quantity>');
  });

  test('2. Supported Chains Registry & Disabled Flag Handling: only 3 active chains exist and disabled chains skip gracefully', async () => {
    console.log(`[TEST START]: Supported Chains & Disabled Handling | Timestamp: ${new Date().toISOString()}`);
    assert.deepStrictEqual(
      Object.keys(SUPPORTED_CHAINS).sort(),
      ['hazi_hinam', 'rami_levy', 'shufersal'],
      'Registry must contain strictly shufersal, rami_levy, and hazi_hinam'
    );

    await assert.rejects(
      () => ChainCatalogService.autoSyncChain('unsupported_chain_key'),
      /Unsupported chain key/,
      'Unknown/removed chain keys must be rejected'
    );

    await ChainCatalogService.updateChainConfig('hazi_hinam', { enabled: false });
    const res = await ChainCatalogService.autoSyncChain('hazi_hinam');
    assert.strictEqual(res.skipped, true, 'Disabled chain must skip gracefully');
    assert.strictEqual(res.rowsImported, 0);

    await ChainCatalogService.updateChainConfig('hazi_hinam', { enabled: true });
    console.log('[TEST END]: Supported Chains & Disabled Handling passed');
  });

  test('3. Task B1: Server-side importFromStream batch upserts products and records run in database', async () => {
    const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<Root>
  <Items>
    <Item>
      <ItemCode>test_shufersal_001</ItemCode>
      <ItemName>קפה נמס עלית 200 גרם</ItemName>
      <ItemPrice>19.90</ItemPrice>
      <ManufactureName>שטראוס קפה</ManufactureName>
      <UnitQty>גרם</UnitQty>
    </Item>
    <Item>
      <ItemCode>test_shufersal_002</ItemCode>
      <ItemName>טחינה גולמית הר ברכה 500 גרם</ItemName>
      <ItemPrice>14.90</ItemPrice>
      <ManufactureName>הר ברכה</ManufactureName>
      <UnitQty>גרם</UnitQty>
    </Item>
  </Items>
</Root>`;

    const stream = Readable.from([sampleXml]);
    const importRes = await ChainCatalogService.importFromStream('shufersal', stream, {
      isGzip: false,
      source: 'auto_download',
      fileName: 'PriceFull7290027600007-001-091-test.xml',
      fileDate: '2026-11-18',
      storeId: '091',
    });

    assert.strictEqual(importRes.rowsImported, 2, 'Should import 2 products');
    assert.strictEqual(importRes.storeId, '091');

    const db = getDb();
    if (db) {
      const dbProducts = await db
        .select()
        .from(chainProducts)
        .where(
          and(
            eq(chainProducts.chain, 'shufersal'),
            eq(chainProducts.itemCode, 'test_shufersal_001')
          )
        );
      assert.strictEqual(dbProducts.length, 1);
      assert.strictEqual(dbProducts[0].name, 'קפה נמס עלית 200 גרם');
      assert.strictEqual(dbProducts[0].price, '19.90');
      assert.strictEqual(dbProducts[0].storeId, '091');

      // Verify run logged in chain_import_runs
      const [run] = await db
        .select()
        .from(chainImportRuns)
        .where(eq(chainImportRuns.id, importRes.runId));
      assert.ok(run);
      assert.strictEqual(run.status, 'success');
      assert.strictEqual(run.rowsImported, 2);
    }
  });

  test('4. Task B2: Chunked Upload flow slices file into chunks, reassembles and imports cleanly', async () => {
    const rawXml = `<?xml version="1.0" encoding="utf-8"?>
<Root>
  <Items>
    <Item>
      <ItemCode>test_chunk_101</ItemCode>
      <ItemName>פסטה ברילה פנה ריגאטה 500 גרם</ItemName>
      <ItemPrice>7.90</ItemPrice>
      <ManufactureName>ברילה איטליה</ManufactureName>
    </Item>
    <Item>
      <ItemCode>test_chunk_102</ItemCode>
      <ItemName>רוטב עגבניות בזיליקום מוטי 400 גרם</ItemName>
      <ItemPrice>10.50</ItemPrice>
      <ManufactureName>מוטי איטליה</ManufactureName>
    </Item>
  </Items>
</Root>`;

    const gzipped = zlib.gzipSync(Buffer.from(rawXml, 'utf-8'));
    // Split into 3 small chunks to test multi-chunk reassembly
    const chunkSize = Math.ceil(gzipped.length / 3);
    const chunkBuffers = [
      gzipped.subarray(0, chunkSize),
      gzipped.subarray(chunkSize, chunkSize * 2),
      gzipped.subarray(chunkSize * 2),
    ];

    const uploadId = `test_upload_${Date.now()}`;
    const totalChunks = chunkBuffers.length;

    // Send Chunk 0
    const resChunk0 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/upload/rami_levy/chunk',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        uploadId,
        index: 0,
        totalChunks,
        data: chunkBuffers[0].toString('base64'),
        isGzip: true,
        fileName: 'PriceFull7290058140886-001-001-chunked.gz',
      },
    });
    assert.strictEqual(resChunk0.statusCode, 200);
    const json0 = JSON.parse(resChunk0.body);
    assert.strictEqual(json0.receivedChunk, 0);

    // Send Chunk 1
    const resChunk1 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/upload/rami_levy/chunk',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        uploadId,
        index: 1,
        totalChunks,
        data: chunkBuffers[1].toString('base64'),
        isGzip: true,
        fileName: 'PriceFull7290058140886-001-001-chunked.gz',
      },
    });
    assert.strictEqual(resChunk1.statusCode, 200);

    // Send Final Chunk 2 (triggers reassembly & streaming import)
    const resChunk2 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/upload/rami_levy/chunk',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        uploadId,
        index: 2,
        totalChunks,
        data: chunkBuffers[2].toString('base64'),
        isGzip: true,
        fileName: 'PriceFull7290058140886-001-001-chunked.gz',
      },
    });
    assert.strictEqual(resChunk2.statusCode, 200);
    const json2 = JSON.parse(resChunk2.body);
    assert.strictEqual(json2.success, true);
    assert.strictEqual(json2.result.rowsImported, 2, 'Should have imported 2 products upon final chunk');

    // Verify chunks were cleaned up from catalog_upload_chunks
    const db = getDb();
    if (db) {
      const remainingChunks = await db
        .select()
        .from(catalogUploadChunks)
        .where(eq(catalogUploadChunks.uploadId, uploadId));
      assert.strictEqual(remainingChunks.length, 0, 'Upload chunks must be purged after assembly');
    }
  });

  test('5. Vercel Cron Endpoint: GET /api/cron/catalog-sync enforces CRON_SECRET authorization and executes enabled chains', async () => {
    // 5a. Unauthorized request without token
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/cron/catalog-sync',
    });
    assert.strictEqual(unauthRes.statusCode, 401, 'Should reject unauthenticated cron request');

    // 5b. Authorized request with Bearer CRON_SECRET
    const authRes = await app.inject({
      method: 'GET',
      url: '/api/cron/catalog-sync',
      headers: {
        authorization: 'Bearer test-cron-secret-2026',
      },
    });
    assert.strictEqual(authRes.statusCode, 200, 'Should accept valid CRON_SECRET');
    const cronData = JSON.parse(authRes.body);
    assert.strictEqual(cronData.success, true);
    assert.ok(Array.isArray(cronData.results), 'Should return array of results');
    assert.deepStrictEqual(
      cronData.results.map((r: any) => r.chain).sort(),
      ['hazi_hinam', 'rami_levy', 'shufersal'],
      'Cron should report only the 3 active supported chains'
    );
  });

  test('6. Admin Catalog Status & Store Config Override: GET /catalog/status and POST /catalog/config/:chainKey', async () => {
    // 6a. Get catalog status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/status',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(statusRes.statusCode, 200);
    const statusData = JSON.parse(statusRes.body);
    assert.strictEqual(statusData.chains.length, 3, 'Should return strictly 3 active chains');

    const shufersal = statusData.chains.find((c: any) => c.chainKey === 'shufersal');
    assert.ok(shufersal);
    assert.strictEqual(shufersal.chainId, '7290027600007');
    assert.strictEqual(shufersal.enabled, true);

    const ramiLevy = statusData.chains.find((c: any) => c.chainKey === 'rami_levy');
    assert.ok(ramiLevy);
    assert.strictEqual(ramiLevy.enabled, true);

    const haziHinam = statusData.chains.find((c: any) => c.chainKey === 'hazi_hinam');
    assert.ok(haziHinam);
    assert.strictEqual(haziHinam.enabled, true);

    // 6b. Update storeId override for Shufersal
    const updateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/config/shufersal',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: { preferredStoreId: '105' },
    });
    assert.strictEqual(updateRes.statusCode, 200);

    // Verify updated storeId in status
    const updatedStatusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/catalog/status',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const updatedStatus = JSON.parse(updatedStatusRes.body);
    const updatedShufersal = updatedStatus.chains.find((c: any) => c.chainKey === 'shufersal');
    assert.strictEqual(updatedShufersal.preferredStoreId, '105');

    // Restore to default '091'
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/catalog/config/shufersal',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: { preferredStoreId: '091' },
    });
  });

  test('7. Smart Supermarket Basket Comparison & Attribution: POST /api/public/basket-compare + /api/affiliate-links + /api/go/:clickToken', async () => {
    logPhase('TEST START', '7. Smart Supermarket Basket Comparison & Attribution');

    // 7a. Compare basket across chains via POST /api/public/basket-compare
    const compareRes = await app.inject({
      method: 'POST',
      url: '/api/public/basket-compare',
      headers: { 'content-type': 'application/json' },
      payload: {
        queries: ['חלב 3%', 'קמח לבן', 'ביצים', 'שמן זית'],
      },
    });
    assert.strictEqual(compareRes.statusCode, 200, 'Basket comparison endpoint should return 200');
    const compareBody = JSON.parse(compareRes.body);
    assert.ok(Array.isArray(compareBody.merchants), 'Should return merchants array');
    assert.strictEqual(compareBody.merchants.length, 3, 'Should compare across all 3 active chains');
    assert.strictEqual(compareBody.items.length, 4, 'Should return 4 basket item comparisons');

    for (const merchant of compareBody.merchants) {
      logPhase('ASSERT', `Chain ${merchant.id}: total=₪${merchant.estimatedTotal}, matched=${merchant.matchedCount}/${merchant.totalCount}, cheapest=${merchant.isCheapest}`);
      assert.ok(merchant.estimatedTotal > 0, `Chain ${merchant.id} should have positive estimatedTotal`);
      assert.strictEqual(merchant.matchedCount, 4, `Chain ${merchant.id} should match all 4 common staples`);
      assert.strictEqual(merchant.totalCount, 4);
    }

    const cheapestChains = compareBody.merchants.filter((c: any) => c.isCheapest);
    assert.ok(cheapestChains.length >= 1, 'At least one chain must be flagged as isCheapest');

    // 7b. Temporarily enable shufersal in GrowthStoreService so we can test affiliate link & click_id redirect
    const { GrowthStoreService } = await import('../services/growth-store.service.js');
    const prevMerchant = await GrowthStoreService.getMerchantById('shufersal');
    await GrowthStoreService.recordSampleCheck({
      merchantId: 'shufersal',
      testedQueries: ['חלב 3%', 'קמח לבן', 'שמן זית'],
      verifiedBy: 'test-runner',
    });
    await GrowthStoreService.updateMerchant({
      merchantId: 'shufersal',
      actor: 'test-runner',
      status: 'referral_only',
    });

    try {
      const firstItem = compareBody.items[0];
      const shufersalMatch = firstItem.matches.shufersal;
      assert.ok(shufersalMatch, 'Should have Shufersal match for first item');

      const linkRes = await app.inject({
        method: 'POST',
        url: '/api/affiliate-links',
        headers: { 'content-type': 'application/json' },
        payload: {
          merchantId: 'shufersal',
          query: firstItem.query,
          productName: shufersalMatch.productName,
          sku: shufersalMatch.itemCode || undefined,
        },
      });
      assert.strictEqual(linkRes.statusCode, 201, 'Should create tracked affiliate link');
      const linkBody = JSON.parse(linkRes.body);
      assert.ok(linkBody.clickToken, 'Should return clickToken');
      assert.strictEqual(linkBody.redirectUrl, `/api/go/${linkBody.clickToken}`);

      // Follow redirect and verify click_id + productName query
      const goRes = await app.inject({
        method: 'GET',
        url: linkBody.redirectUrl,
      });
      assert.strictEqual(goRes.statusCode, 302, 'Should redirect 302 to supermarket');
      const locationHeader = String(goRes.headers.location || '');
      logPhase('ASSERT', `Redirect Location: ${locationHeader}`);
      assert.ok(locationHeader.includes('shufersal.co.il'), 'Location should point to Shufersal');
      assert.ok(locationHeader.includes('click_id='), 'Location must append click_id for purchase attribution');
    } finally {
      if (prevMerchant) {
        await GrowthStoreService.updateMerchant({
          merchantId: 'shufersal',
          actor: 'test-runner',
          status: prevMerchant.status,
        });
      }
    }

    logPhase('TEST END', '7. Smart Supermarket Basket Comparison & Attribution PASSED');
  });
});
