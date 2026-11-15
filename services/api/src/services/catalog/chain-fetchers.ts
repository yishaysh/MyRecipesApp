import { getDb } from '../../db/index.js';
import { chainProducts, chainImportRuns } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createPriceParserPipeline, normalizeHebrewText, ParsedProduct } from './price-xml-parser.js';
import { Readable } from 'node:stream';

export interface ChainConfig {
  key: string;
  name: string;
  chainId: string;
  defaultStoreId: string;
  filePrefix: string;
  sampleCatalogUrl?: string;
  credentialsRequired: boolean;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  shufersal: {
    key: 'shufersal',
    name: 'שופרסל',
    chainId: '7290027600007',
    defaultStoreId: '001',
    filePrefix: 'PriceFull7290027600007',
    sampleCatalogUrl: 'http://prices.shufersal.co.il/FileObject/UpdateCategory?catID=2&storeId=1',
    credentialsRequired: false,
  },
  rami_levy: {
    key: 'rami_levy',
    name: 'רמי לוי',
    chainId: '7290058140886',
    defaultStoreId: '001',
    filePrefix: 'PriceFull7290058140886',
    sampleCatalogUrl: 'https://url.retail.publishedprices.co.il/file/d/',
    credentialsRequired: true,
  },
  carrefour: {
    key: 'carrefour',
    name: 'קרפור',
    chainId: '7290055700007',
    defaultStoreId: '001',
    filePrefix: 'PriceFull7290055700007',
    credentialsRequired: false,
  },
  ybitan: {
    key: 'ybitan',
    name: 'יינות ביתן',
    chainId: '7290725900003',
    defaultStoreId: '001',
    filePrefix: 'PriceFull7290725900003',
    credentialsRequired: false,
  },
  hazi_hinam: {
    key: 'hazi_hinam',
    name: 'חצי חינם',
    chainId: '7290700100008',
    defaultStoreId: '001',
    filePrefix: 'PriceFull7290700100008',
    credentialsRequired: false,
  },
};

/**
 * Service to manage chain product catalog imports and runs
 */
export class ChainCatalogService {
  /**
   * Process a stream of XML or GZ-XML data and store into chain_products table
   */
  static async importFromStream(
    chainKey: string,
    stream: Readable,
    options: {
      isGzip: boolean;
      source: 'auto_download' | 'manual_upload';
      fileName?: string;
      fileDate?: string;
    }
  ): Promise<{ runId: string; rowsImported: number }> {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      throw new Error(`Unsupported chain key: ${chainKey}`);
    }

    const db = getDb();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (db) {
      await db.insert(chainImportRuns).values({
        id: runId,
        chain: chainKey,
        source: options.source,
        status: 'running',
        fileName: options.fileName || `${chain.filePrefix}.xml`,
        fileDate: options.fileDate || new Date().toISOString().split('T')[0],
        rowsImported: 0,
      });
    }

    const { input, parser } = createPriceParserPipeline(options.isGzip);
    stream.pipe(input);

    const BATCH_SIZE = 100;
    let batch: ParsedProduct[] = [];
    let rowsImported = 0;

    try {
      for await (const product of parser) {
        batch.push(product);
        if (batch.length >= BATCH_SIZE) {
          await this.saveProductBatch(chainKey, chain.chainId, chain.defaultStoreId, batch, options.fileDate);
          rowsImported += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await this.saveProductBatch(chainKey, chain.chainId, chain.defaultStoreId, batch, options.fileDate);
        rowsImported += batch.length;
      }

      if (db) {
        await db
          .update(chainImportRuns)
          .set({
            status: 'success',
            rowsImported,
            finishedAt: new Date(),
          })
          .where(eq(chainImportRuns.id, runId));
      }

      return { runId, rowsImported };
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

  private static async saveProductBatch(
    chain: string,
    chainId: string,
    storeId: string,
    products: ParsedProduct[],
    fileDate?: string
  ): Promise<void> {
    const db = getDb();
    if (!db) return;

    for (const p of products) {
      const id = `${chain}_${p.itemCode}`;
      const normalizedName = normalizeHebrewText(p.name);

      await db
        .insert(chainProducts)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [chainProducts.chain, chainProducts.itemCode],
          set: {
            name: p.name,
            normalizedName,
            barcode: p.barcode,
            manufacturer: p.manufacturer,
            price: p.price,
            unitQty: p.unitQty,
            fileDate,
            updatedAt: new Date(),
          },
        });
    }
  }

  /**
   * Retrieves summary of latest import runs and product counts per chain
   */
  static async getCatalogStatus(): Promise<any[]> {
    const db = getDb();
    const result = [];

    for (const key of Object.keys(SUPPORTED_CHAINS)) {
      const chain = SUPPORTED_CHAINS[key];
      let lastRun: any = null;
      let totalProducts = 0;

      if (db) {
        try {
          const runs = await db
            .select()
            .from(chainImportRuns)
            .where(eq(chainImportRuns.chain, key))
            .orderBy(chainImportRuns.startedAt)
            .limit(1);
          lastRun = runs && runs.length > 0 ? runs[0] : null;
        } catch {
          // ignore table query if in fallback
        }
      }

      result.push({
        chainKey: key,
        chainName: chain.name,
        chainId: chain.chainId,
        credentialsRequired: chain.credentialsRequired,
        totalProducts,
        lastRun,
      });
    }

    return result;
  }
}
