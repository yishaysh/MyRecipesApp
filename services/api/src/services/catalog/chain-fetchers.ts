import { getDb } from '../../db/index.js';
import { chainProducts, chainImportRuns, chainCatalogConfigs, catalogUploadChunks } from '../../db/schema.js';
import { eq, desc, and, sql, lt } from 'drizzle-orm';
import { createPriceParserPipeline, normalizeHebrewText, ParsedProduct } from './price-xml-parser.js';
import { Readable } from 'node:stream';
import https from 'node:https';
import http from 'node:http';

export interface ChainConfig {
  key: string;
  name: string;
  chainId: string;
  defaultStoreId: string;
  filePrefix: string;
  enabled: boolean;
  credentialsRequired: boolean;
  notes?: string;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  shufersal: {
    key: 'shufersal',
    name: 'שופרסל',
    chainId: '7290027600007',
    defaultStoreId: '091',
    filePrefix: 'PriceFull7290027600007',
    enabled: true,
    credentialsRequired: false,
    notes: 'שופרסל סניף מרכזי (091)',
  },
  rami_levy: {
    key: 'rami_levy',
    name: 'רמי לוי',
    chainId: '7290058140886',
    defaultStoreId: '001',
    filePrefix: 'PriceFull7290058140886',
    enabled: true,
    credentialsRequired: true,
    notes: 'רמי לוי שיווק השקמה (001)',
  },
  hazi_hinam: {
    key: 'hazi_hinam',
    name: 'חצי חינם',
    chainId: '7290700100008',
    defaultStoreId: '219',
    filePrefix: 'PriceFull7290700100008',
    enabled: true,
    credentialsRequired: false,
    notes: 'חצי חינם סניף מרכזי (219)',
  },
};

/**
 * HTTPS request helper with configurable TLS validation.
 * Needed for Cerberus (publishedprices.co.il) due to multi-level subdomain wildcard SSL mismatch.
 */
export function httpsRequest(
  urlStr: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    rejectUnauthorized?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  text: () => Promise<string>;
  json: () => Promise<any>;
  buffer: () => Promise<Buffer>;
  stream: () => http.IncomingMessage;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : true,
    };

    const req = client.request(reqOptions, (res) => {
      let cachedBuffer: Buffer | null = null;
      let bufferPromise: Promise<Buffer> | null = null;

      const getBuffer = () => {
        if (!bufferPromise) {
          bufferPromise = new Promise((resBuf, rejBuf) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            res.on('end', () => {
              cachedBuffer = Buffer.concat(chunks);
              resBuf(cachedBuffer);
            });
            res.on('error', rejBuf);
          });
        }
        return bufferPromise;
      };

      resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        text: async () => (await getBuffer()).toString('utf8'),
        json: async () => JSON.parse((await getBuffer()).toString('utf8')),
        buffer: getBuffer,
        stream: () => res,
      });
    });

    if (options.timeoutMs) {
      req.setTimeout(options.timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${options.timeoutMs}ms`));
      });
    }

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Format date in Israel timezone (Asia/Jerusalem) as YYYYMMDD
 */
export function getIsraelDateString(daysAgo: number = 0): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  return `${year}${month}${day}`;
}

export interface FetchResult {
  downloadUrl: string;
  fileName: string;
  fileDate: string;
  storeId: string;
  cookie?: string;
  headers?: Record<string, string>;
}

// In-memory fallbacks for unit tests & offline environments without active database
const inMemoryUploadChunks = new Map<string, { id: string; uploadId: string; chunkIndex: number; totalChunks: number; data: string; createdAt: Date }>();
const inMemoryCatalogConfigs = new Map<string, { preferredStoreId?: string; enabled?: boolean; lastSyncAt?: Date; lastFile?: string; lastItemCount?: number; notes?: string }>();
const inMemoryRuns = new Map<string, any>();

/**
 * Service to manage chain product catalog imports and runs
 */
export class ChainCatalogService {
  /**
   * 1. Shufersal PriceFull Fetcher
   * Hits the public server-rendered listing table and picks the newest PriceFull Azure blob signed URL
   */
  static async fetchShufersal(preferredStoreId: string = '091'): Promise<FetchResult> {
    const listUrl = 'https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=2&storeId=0&page=1';
    const res = await httpsRequest(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (res.status !== 200) {
      throw new Error(`Shufersal portal returned HTTP ${res.status}`);
    }

    const html = await res.text();
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    let candidateUrl = '';
    let candidateFile = '';
    let candidateStore = '';

    const cleanPaddedStore = preferredStoreId.padStart(3, '0');

    // First pass: look for exact store match
    for (const row of rows) {
      const hrefMatch = row.match(/href="([^"]*pricesprodpublic\.blob\.core\.windows\.net\/pricefull\/([^"?]+)[^"]*)"/i);
      if (hrefMatch) {
        const fullHref = hrefMatch[1].replace(/&amp;/g, '&');
        const filename = hrefMatch[2];
        if (filename.includes(`-${cleanPaddedStore}-`)) {
          candidateUrl = fullHref;
          candidateFile = filename;
          candidateStore = cleanPaddedStore;
          break;
        }
      }
    }

    // Second pass: if preferred store not on page 1, pick newest PriceFull row
    if (!candidateUrl) {
      for (const row of rows) {
        const hrefMatch = row.match(/href="([^"]*pricesprodpublic\.blob\.core\.windows\.net\/pricefull\/([^"?]+)[^"]*)"/i);
        if (hrefMatch) {
          candidateUrl = hrefMatch[1].replace(/&amp;/g, '&');
          candidateFile = hrefMatch[2];
          const storeMatch = candidateFile.match(/PriceFull7290027600007-\d+-(\d+)-/);
          candidateStore = storeMatch ? storeMatch[1] : preferredStoreId;
          break;
        }
      }
    }

    if (!candidateUrl) {
      throw new Error('No Shufersal PriceFull download link found on portal listing');
    }

    // Extract file date from filename (e.g., PriceFull7290027600007-001-091-20261118-030000.gz)
    const dateMatch = candidateFile.match(/-(\d{4})(\d{2})(\d{2})-/);
    const fileDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split('T')[0];

    return {
      downloadUrl: candidateUrl,
      fileName: candidateFile,
      fileDate,
      storeId: candidateStore || preferredStoreId,
    };
  }

  /**
   * 2. Rami Levy PriceFull Fetcher
   * Authenticates with Cerberus Web Client using public credentials, retrieves file list, and selects PriceFull
   */
  static async fetchRamiLevy(preferredStoreId: string = '001'): Promise<FetchResult> {
    const username = process.env.RAMI_LEVY_USER || 'RamiLevi';
    const password = process.env.RAMI_LEVY_PASS || '';

    // Step a: GET /login to retrieve csrftoken and initial cftpSID cookie
    const loginPage = await httpsRequest('https://url.retail.publishedprices.co.il/login', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      rejectUnauthorized: false,
    });

    const setCookie = loginPage.headers['set-cookie'];
    const sidCookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie || '';
    const sidMatch = sidCookieStr.match(/cftpSID=([^;]+)/);
    const sid = sidMatch ? sidMatch[1] : '';

    const loginHtml = await loginPage.text();
    const csrfMatch =
      loginHtml.match(/name="csrftoken"\s+content="([^"]+)"/i) ||
      loginHtml.match(/name="csrftoken"\s+value="([^"]+)"/i);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    if (!csrfToken) {
      throw new Error('Failed to acquire CSRF token from Rami Levy portal');
    }

    // Step b: POST /login/user with credentials
    const postBody = new URLSearchParams({
      username,
      password,
      csrftoken: csrfToken,
      r: '',
    }).toString();

    const loginRes = await httpsRequest('https://url.retail.publishedprices.co.il/login/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(postBody)),
        Cookie: `cftpSID=${sid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: postBody,
      rejectUnauthorized: false,
    });

    if (loginRes.status !== 302 && loginRes.status !== 200) {
      throw new Error(`Rami Levy login failed with HTTP ${loginRes.status}`);
    }

    const postCookies = loginRes.headers['set-cookie'];
    const updatedSidMatch = (Array.isArray(postCookies) ? postCookies.join('; ') : postCookies || '').match(
      /cftpSID=([^;]+)/
    );
    const activeSid = updatedSidMatch ? updatedSidMatch[1] : sid;

    // Step c: GET /file with session cookie to acquire active session CSRF token
    const filePage = await httpsRequest('https://url.retail.publishedprices.co.il/file', {
      headers: {
        Cookie: `cftpSID=${activeSid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      rejectUnauthorized: false,
    });

    const fileHtml = await filePage.text();
    const fileCsrfMatch =
      fileHtml.match(/name="csrftoken"\s+content="([^"]+)"/i) ||
      fileHtml.match(/csrf[a-zA-Z]*\s*[:=]\s*["']([^"']+)["']/i);
    const activeCsrf = fileCsrfMatch ? fileCsrfMatch[1] : csrfToken;

    // Step d: POST /file/json/dir to list PriceFull files
    const listBody = new URLSearchParams({
      csrftoken: activeCsrf,
      cd: '',
      iDisplayStart: '0',
      iDisplayLength: '500',
      sEcho: '1',
      sSearch: 'PriceFull',
    }).toString();

    const listRes = await httpsRequest('https://url.retail.publishedprices.co.il/file/json/dir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(listBody)),
        Cookie: `cftpSID=${activeSid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: listBody,
      rejectUnauthorized: false,
    });

    if (listRes.status !== 200) {
      throw new Error(`Rami Levy file listing failed with HTTP ${listRes.status}`);
    }

    const listJson = await listRes.json();
    const files: Array<{ name: string; size: number }> = listJson.aaData || [];

    const validFiles = files.filter(
      (f) => f.name.startsWith('PriceFull7290058140886') && f.name.endsWith('.gz')
    );

    if (validFiles.length === 0) {
      throw new Error('No valid PriceFull files returned by Rami Levy portal');
    }

    const cleanPaddedStore = preferredStoreId.padStart(3, '0');
    let candidate = validFiles.find((f) => f.name.includes(`-${cleanPaddedStore}-`));
    if (!candidate) {
      candidate = validFiles[0];
    }

    const chosenFile = candidate.name;
    const storeMatch = chosenFile.match(/PriceFull7290058140886-\d+-(\d+)-/);
    const chosenStore = storeMatch ? storeMatch[1] : preferredStoreId;

    const dateMatch = chosenFile.match(/-(\d{4})(\d{2})(\d{2})-/);
    const fileDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split('T')[0];

    const downloadUrl = `https://url.retail.publishedprices.co.il/file/d/${chosenFile}`;

    return {
      downloadUrl,
      fileName: chosenFile,
      fileDate,
      storeId: chosenStore,
      cookie: `cftpSID=${activeSid}`,
      headers: { Cookie: `cftpSID=${activeSid}` },
    };
  }

  /**
   * 3. Hazi Hinam PriceFull Fetcher
   * Direct listing or candidate probe against public Azure blob container (bypassing Cloudflare IL-only block)
   */
  static async fetchHaziHinam(preferredStoreId: string = '219'): Promise<FetchResult> {
    // Strategy a: Attempt direct listing from Prices page
    try {
      const pricesRes = await httpsRequest('https://shop.hazi-hinam.co.il/Prices', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeoutMs: 5000,
      });

      if (pricesRes.status === 200) {
        const html = await pricesRes.text();
        const blobMatches = html.match(/https?:\/\/hazihinamprod01\.blob\.core\.windows\.net\/regulatories\/PriceFull[^\s"'<>]+\.gz/gi) || [];

        if (blobMatches.length > 0) {
          const cleanPaddedStore = preferredStoreId.padStart(3, '0');
          const matchedUrl = blobMatches.find((u) => u.includes(`-${cleanPaddedStore}-`)) || blobMatches[0];
          if (matchedUrl) {
            const fileNameMatch = matchedUrl.match(/\/([^\/?#]+)$/);
            const fileName = fileNameMatch ? fileNameMatch[1] : `PriceFull7290700100008-000-${cleanPaddedStore}.gz`;
            const dateMatch = fileName.match(/-(\d{4})(\d{2})(\d{2})-/);
            const fileDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split('T')[0];

            return {
              downloadUrl: matchedUrl,
              fileName,
              fileDate,
              storeId: preferredStoreId,
            };
          }
        }
      }
    } catch {
      // Direct listing failed (e.g., non-IL egress 403 on Vercel), fall through to candidate probe
    }

    // Strategy b: Probe Azure blob container directly for large store candidates (219, 103, 206)
    const candidateStores = [preferredStoreId, '219', '103', '206'];
    const today = getIsraelDateString(0);
    const yesterday = getIsraelDateString(1);
    const dateCandidates = [today, yesterday];

    // Common publishing time patterns for large stores: ~00:16 - ~09:16 hourly or ~01:00
    // Try probing known candidate patterns
    for (const d of dateCandidates) {
      for (const st of candidateStores) {
        const paddedSt = st.padStart(3, '0');
        // Probe top candidate timestamps (hourly on the 16th minute, early morning, etc.)
        const timeProbes = ['091602', '081600', '071629', '061628', '010000', '004000', '014000'];
        for (const tm of timeProbes) {
          const probeFile = `PriceFull7290700100008-000-${paddedSt}-${d}-${tm}.gz`;
          const probeUrl = `https://hazihinamprod01.blob.core.windows.net/regulatories/${probeFile}`;

          try {
            const probeRes = await httpsRequest(probeUrl, { method: 'HEAD', timeoutMs: 3000 });
            if (probeRes.status === 200) {
              const fileDate = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
              return {
                downloadUrl: probeUrl,
                fileName: probeFile,
                fileDate,
                storeId: paddedSt,
              };
            }
          } catch {
            // continue probe
          }
        }
      }
    }

    throw new Error(
      'חצי חינם: לא נמצא קובץ מתאים בסריקה ישירה עקב חסימת מיקום גיאוגרפי בפורטל. באפשרותך לייבא ישירות באמצעות הזנת קישור הקובץ ב-Azure Blob בתיבת "ייבוא מקישור".'
    );
  }

  /**
   * Process a stream of XML or GZ-XML data and store into chain_products table using batch upserts
   */
  static async importFromStream(
    chainKey: string,
    stream: Readable,
    options: {
      isGzip: boolean;
      source: 'auto_download' | 'manual_upload' | 'chunked_upload';
      fileName?: string;
      fileDate?: string;
      storeId?: string;
    }
  ): Promise<{ runId: string; rowsImported: number; fileName: string; storeId: string }> {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      throw new Error(`Unsupported chain key: ${chainKey}`);
    }

    const effectiveStoreId = options.storeId || chain.defaultStoreId;
    const effectiveFileName = options.fileName || `${chain.filePrefix}.gz`;
    const effectiveFileDate = options.fileDate || new Date().toISOString().split('T')[0];

    const db = getDb();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (db) {
      await db.insert(chainImportRuns).values({
        id: runId,
        chain: chainKey,
        storeId: effectiveStoreId,
        source: options.source,
        status: 'running',
        fileName: effectiveFileName,
        fileDate: effectiveFileDate,
        rowsImported: 0,
      });
    }

    const { input, parser } = createPriceParserPipeline(options.isGzip);
    stream.pipe(input);

    const BATCH_SIZE = 500;
    let batch: ParsedProduct[] = [];
    let rowsImported = 0;

    try {
      for await (const product of parser) {
        batch.push(product);
        if (batch.length >= BATCH_SIZE) {
          await this.saveProductBatch(chainKey, chain.chainId, effectiveStoreId, batch, effectiveFileDate);
          rowsImported += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await this.saveProductBatch(chainKey, chain.chainId, effectiveStoreId, batch, effectiveFileDate);
        rowsImported += batch.length;
      }

      if (db) {
        // Update run status
        await db
          .update(chainImportRuns)
          .set({
            status: 'success',
            rowsImported,
            finishedAt: new Date(),
          })
          .where(eq(chainImportRuns.id, runId));

        // Update chain catalog config with latest sync stats
        await db
          .insert(chainCatalogConfigs)
          .values({
            chainKey,
            chainId: chain.chainId,
            name: chain.name,
            enabled: chain.enabled,
            preferredStoreId: effectiveStoreId,
            lastSyncAt: new Date(),
            lastFile: effectiveFileName,
            lastItemCount: rowsImported,
          })
          .onConflictDoUpdate({
            target: [chainCatalogConfigs.chainKey],
            set: {
              lastSyncAt: new Date(),
              lastFile: effectiveFileName,
              lastItemCount: rowsImported,
              updatedAt: new Date(),
            },
          });
      } else {
        const existing = inMemoryCatalogConfigs.get(chainKey) || {};
        inMemoryCatalogConfigs.set(chainKey, {
          ...existing,
          lastSyncAt: new Date(),
          lastFile: effectiveFileName,
          lastItemCount: rowsImported,
        });
        inMemoryRuns.set(chainKey, {
          id: runId,
          chain: chainKey,
          storeId: effectiveStoreId,
          source: options.source,
          status: 'success',
          fileName: effectiveFileName,
          fileDate: effectiveFileDate,
          rowsImported,
          finishedAt: new Date(),
        });
      }

      return { runId, rowsImported, fileName: effectiveFileName, storeId: effectiveStoreId };
    } catch (err: any) {
      if (db) {
        await db
          .update(chainImportRuns)
          .set({
            status: 'failed',
            rowsImported,
            error: err.message || String(err),
            finishedAt: new Date(),
          })
          .where(eq(chainImportRuns.id, runId));
      }
      throw err;
    }
  }

  /**
   * Fast batch upsert into chain_products table using multi-row INSERT ... ON CONFLICT DO UPDATE
   */
  private static async saveProductBatch(
    chain: string,
    chainId: string,
    storeId: string,
    products: ParsedProduct[],
    fileDate?: string
  ): Promise<void> {
    const db = getDb();
    if (!db || products.length === 0) return;

    // Deduplicate within the batch itself to prevent PostgreSQL CardinalityViolation
    const dedupedMap = new Map<string, ParsedProduct>();
    for (const p of products) {
      dedupedMap.set(p.itemCode, p);
    }

    const rows = Array.from(dedupedMap.values()).map((p) => {
      const id = `${chain}_${p.itemCode}`;
      const normalizedName = normalizeHebrewText(p.name);
      return {
        id,
        chain,
        chainId,
        storeId,
        itemCode: p.itemCode,
        barcode: p.barcode,
        name: p.name,
        normalizedName,
        manufacturer: p.manufacturer,
        price: p.price,
        unitQty: p.unitQty,
        fileDate,
      };
    });

    await db
      .insert(chainProducts)
      .values(rows)
      .onConflictDoUpdate({
        target: [chainProducts.chain, chainProducts.itemCode],
        set: {
          name: sql`EXCLUDED.name`,
          normalizedName: sql`EXCLUDED.normalized_name`,
          barcode: sql`EXCLUDED.barcode`,
          manufacturer: sql`EXCLUDED.manufacturer`,
          price: sql`EXCLUDED.price`,
          unitQty: sql`EXCLUDED.unit_qty`,
          fileDate: sql`EXCLUDED.file_date`,
          storeId: sql`EXCLUDED.store_id`,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Import directly from URL on the server (bypassing Vercel request body limits)
   */
  static async importFromUrl(
    chainKey: string,
    url: string,
    storeId?: string,
    customHeaders?: Record<string, string>
  ): Promise<{ runId: string; rowsImported: number; fileName: string; storeId: string }> {
    const isGzip = url.endsWith('.gz') || url.includes('.gz?') || url.includes('PriceFull');
    const fileNameMatch = url.match(/\/([^\/?#]+)(?:[?#]|$)/);
    const fileName = fileNameMatch ? fileNameMatch[1] : `${chainKey}_import.gz`;

    const res = await httpsRequest(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        ...(customHeaders || {}),
      },
      rejectUnauthorized: false,
    });

    if (res.status !== 200) {
      throw new Error(`Failed to download catalog from URL (HTTP ${res.status})`);
    }

    const stream = res.stream();
    return this.importFromStream(chainKey, stream, {
      isGzip,
      source: 'auto_download',
      fileName,
      storeId,
    });
  }

  /**
   * Automatically fetch and sync a chain catalog
   */
  static async autoSyncChain(
    chainKey: string,
    storeIdOverride?: string
  ): Promise<{ runId?: string; rowsImported: number; fileName?: string; storeId?: string; skipped?: boolean; reason?: string }> {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      throw new Error(`Unsupported chain key: ${chainKey}`);
    }

    const db = getDb();
    let isEnabled = chain.enabled;
    let preferredStoreId = storeIdOverride || chain.defaultStoreId;

    if (db) {
      try {
        const [config] = await db
          .select()
          .from(chainCatalogConfigs)
          .where(eq(chainCatalogConfigs.chainKey, chainKey))
          .limit(1);

        if (config) {
          isEnabled = config.enabled;
          if (!storeIdOverride && config.preferredStoreId) {
            preferredStoreId = config.preferredStoreId;
          }
        }
      } catch {
        // fallback to default config
      }
    } else {
      const memConfig = inMemoryCatalogConfigs.get(chainKey);
      if (memConfig) {
        if (memConfig.enabled !== undefined) isEnabled = memConfig.enabled;
        if (!storeIdOverride && memConfig.preferredStoreId) {
          preferredStoreId = memConfig.preferredStoreId;
        }
      }
    }

    if (!isEnabled) {
      console.log(`[CatalogSync] Chain ${chainKey} is disabled, skipping.`);
      return {
        skipped: true,
        rowsImported: 0,
        reason: chain.notes || 'Chain is disabled',
      };
    }

    let fetchResult: FetchResult;
    switch (chainKey) {
      case 'shufersal':
        fetchResult = await this.fetchShufersal(preferredStoreId);
        break;
      case 'rami_levy':
        fetchResult = await this.fetchRamiLevy(preferredStoreId);
        break;
      case 'hazi_hinam':
        fetchResult = await this.fetchHaziHinam(preferredStoreId);
        break;
      default:
        throw new Error(`Auto-sync fetcher not implemented for chain: ${chainKey}`);
    }

    return this.importFromUrl(chainKey, fetchResult.downloadUrl, fetchResult.storeId, fetchResult.headers);
  }

  /**
   * Sync all enabled supported chains sequentially (shared by cron and admin triggers)
   */
  static async syncAllEnabledChains(): Promise<Array<{
    chain: string;
    status: 'skipped' | 'success' | 'failed';
    rowsImported: number;
    fileName?: string;
    storeId?: string;
    reason?: string;
    error?: string;
  }>> {
    const status = await this.getCatalogStatus();
    const results: Array<{
      chain: string;
      status: 'skipped' | 'success' | 'failed';
      rowsImported: number;
      fileName?: string;
      storeId?: string;
      reason?: string;
      error?: string;
    }> = [];

    for (const chain of status) {
      if (!chain.enabled) {
        results.push({
          chain: chain.chainKey,
          status: 'skipped',
          reason: chain.notes || 'Chain disabled',
          rowsImported: 0,
        });
        continue;
      }

      try {
        const syncRes = await this.autoSyncChain(chain.chainKey, chain.preferredStoreId);
        results.push({
          chain: chain.chainKey,
          status: syncRes.skipped ? 'skipped' : 'success',
          rowsImported: syncRes.rowsImported || 0,
          fileName: syncRes.fileName,
          storeId: syncRes.storeId,
          reason: syncRes.reason,
        });
      } catch (err: any) {
        results.push({
          chain: chain.chainKey,
          status: 'failed',
          error: err.message || String(err),
          rowsImported: 0,
        });
      }
    }

    return results;
  }

  /**
   * Remove chunks for an uploadId across database or in-memory store
   */
  private static async deleteUploadChunks(uploadId: string, db: ReturnType<typeof getDb>): Promise<void> {
    if (db) {
      await db.delete(catalogUploadChunks).where(eq(catalogUploadChunks.uploadId, uploadId)).catch(() => { });
      return;
    }
    for (const [key, val] of inMemoryUploadChunks.entries()) {
      if (val.uploadId === uploadId) inMemoryUploadChunks.delete(key);
    }
  }

  /**
   * Save a single chunk of an uploaded file into database or in-memory store
   */
  static async saveUploadChunk(
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    data: string
  ): Promise<void> {
    if (totalChunks > 25) {
      throw new Error('Total chunk count exceeds maximum permitted limit (25)');
    }
    if (data.length > 5 * 1024 * 1024) {
      throw new Error('Chunk size exceeds maximum permitted limit (5MB)');
    }

    const chunkId = `${uploadId}_${chunkIndex}`;
    const db = getDb();
    if (!db) {
      inMemoryUploadChunks.set(chunkId, {
        id: chunkId,
        uploadId,
        chunkIndex,
        totalChunks,
        data,
        createdAt: new Date(),
      });
      return;
    }

    await db
      .insert(catalogUploadChunks)
      .values({
        id: chunkId,
        uploadId,
        chunkIndex,
        totalChunks,
        data,
      })
      .onConflictDoUpdate({
        target: [catalogUploadChunks.id],
        set: {
          data,
          createdAt: new Date(),
        },
      });

    // Cleanup abandoned chunks older than 1 hour asynchronously
    db.delete(catalogUploadChunks)
      .where(lt(catalogUploadChunks.createdAt, new Date(Date.now() - 60 * 60 * 1000)))
      .catch(() => { });
  }

  /**
   * Assemble uploaded chunks into a stream and process import
   */
  static async assembleAndImportChunks(
    chainKey: string,
    uploadId: string,
    totalChunks: number,
    options: { isGzip?: boolean; fileName?: string; storeId?: string }
  ): Promise<{ runId: string; rowsImported: number; fileName: string; storeId: string }> {
    const db = getDb();
    let chunks: Array<{ chunkIndex: number; data: string }>;

    if (!db) {
      chunks = Array.from(inMemoryUploadChunks.values())
        .filter((c) => c.uploadId === uploadId)
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
    } else {
      chunks = await db
        .select()
        .from(catalogUploadChunks)
        .where(eq(catalogUploadChunks.uploadId, uploadId))
        .orderBy(catalogUploadChunks.chunkIndex);
    }

    if (chunks.length !== totalChunks) {
      throw new Error(`Missing upload chunks: received ${chunks.length} of ${totalChunks}`);
    }

    // Stream chunks sequentially through Readable to avoid memory spike
    let currentIndex = 0;
    const stream = new Readable({
      read() {
        if (currentIndex < chunks.length) {
          const chunkRecord = chunks[currentIndex++];
          this.push(Buffer.from(chunkRecord.data, 'base64'));
        } else {
          this.push(null);
        }
      },
    });

    try {
      const res = await this.importFromStream(chainKey, stream, {
        isGzip: options.isGzip !== undefined ? options.isGzip : true,
        source: 'chunked_upload',
        fileName: options.fileName,
        storeId: options.storeId,
      });

      await this.deleteUploadChunks(uploadId, db);
      return res;
    } catch (err) {
      await this.deleteUploadChunks(uploadId, db);
      throw err;
    }
  }

  /**
   * Retrieves summary of latest import runs and product counts per chain
   */
  static async getCatalogStatus(): Promise<any[]> {
    const db = getDb();
    const result = [];

    for (const key of Object.keys(SUPPORTED_CHAINS)) {
      const staticChain = SUPPORTED_CHAINS[key];
      let config: any = inMemoryCatalogConfigs.get(key) || null;
      let lastRun: any = inMemoryRuns.get(key) || null;
      let totalProducts = config?.lastItemCount || 0;

      if (db) {
        try {
          const [dbConfig] = await db
            .select()
            .from(chainCatalogConfigs)
            .where(eq(chainCatalogConfigs.chainKey, key))
            .limit(1);
          if (dbConfig) config = dbConfig;
        } catch {
          // ignore
        }

        try {
          const runs = await db
            .select()
            .from(chainImportRuns)
            .where(eq(chainImportRuns.chain, key))
            .orderBy(desc(chainImportRuns.startedAt))
            .limit(1);
          lastRun = runs && runs.length > 0 ? runs[0] : null;
        } catch {
          // ignore
        }

        try {
          const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(chainProducts)
            .where(eq(chainProducts.chain, key));
          totalProducts = Number(countResult?.count || 0);
        } catch {
          totalProducts = config?.lastItemCount || 0;
        }
      }

      result.push({
        chainKey: key,
        chainName: staticChain.name,
        chainId: staticChain.chainId,
        enabled: config && config.enabled !== undefined ? config.enabled : staticChain.enabled,
        preferredStoreId: config?.preferredStoreId || staticChain.defaultStoreId,
        credentialsRequired: staticChain.credentialsRequired,
        notes: config?.notes || staticChain.notes,
        lastSyncAt: config?.lastSyncAt || lastRun?.finishedAt,
        lastFile: config?.lastFile || lastRun?.fileName,
        totalProducts: totalProducts || config?.lastItemCount || lastRun?.rowsImported || 0,
        lastRun,
      });
    }

    return result;
  }

  /**
   * Update store configuration override
   */
  static async updateChainConfig(
    chainKey: string,
    updates: { preferredStoreId?: string; enabled?: boolean }
  ): Promise<void> {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      throw new Error(`Unsupported chain key: ${chainKey}`);
    }

    const db = getDb();
    if (!db) {
      const existing = inMemoryCatalogConfigs.get(chainKey) || {};
      inMemoryCatalogConfigs.set(chainKey, {
        ...existing,
        ...(updates.preferredStoreId ? { preferredStoreId: updates.preferredStoreId } : {}),
        ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
      });
      return;
    }

    await db
      .insert(chainCatalogConfigs)
      .values({
        chainKey,
        chainId: chain.chainId,
        name: chain.name,
        enabled: updates.enabled !== undefined ? updates.enabled : chain.enabled,
        preferredStoreId: updates.preferredStoreId || chain.defaultStoreId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [chainCatalogConfigs.chainKey],
        set: {
          ...(updates.preferredStoreId ? { preferredStoreId: updates.preferredStoreId } : {}),
          ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
          updatedAt: new Date(),
        },
      });
  }
}
