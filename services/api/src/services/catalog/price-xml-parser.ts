import { Transform } from 'node:stream';
import zlib from 'node:zlib';

export interface ParsedProduct {
  itemCode: string;
  barcode?: string;
  name: string;
  manufacturer?: string;
  price: string;
  unitQty?: string;
}

/**
 * Normalizes Hebrew text for matching:
 * - strips nikud (vowel marks)
 * - trims and collapses spaces
 * - converts quotes to standardized characters
 * - lowers casing
 */
export function normalizeHebrewText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0591-\u05C7]/g, '') // strip Hebrew cantillation and points
    .replace(/["״״]/g, '"')
    .replace(/['׳׳]/g, "'")
    .replace(/[^\w\s\u0590-\u05FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Fast stream-based parser for Israeli Supermarket Price Transparency XML files (<PriceFull> or <Prices>).
 * Handles gzipped stream or plain XML stream chunk by chunk without loading huge 30MB+ files into memory.
 */
export class PriceXmlStreamParser extends Transform {
  private buffer: string = '';
  private currentTag: string = '';
  private inProduct: boolean = false;
  private productData: Record<string, string> = {};
  public count: number = 0;

  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      this.buffer += chunk.toString('utf-8');

      let openIdx = this.buffer.indexOf('<');
      while (openIdx !== -1) {
        const closeIdx = this.buffer.indexOf('>', openIdx);
        if (closeIdx === -1) {
          // Incomplete tag in this chunk, break and wait for next
          break;
        }

        const tagContent = this.buffer.slice(openIdx + 1, closeIdx).trim();
        const isClosing = tagContent.startsWith('/');
        const rawTagName = (isClosing ? tagContent.slice(1) : tagContent).split(/\s+/)[0];
        const tagName = rawTagName.toLowerCase();

        if (tagName === 'item' || tagName === 'product') {
          if (isClosing) {
            this.inProduct = false;
            const parsed = this.mapProductRecord(this.productData);
            if (parsed) {
              this.count++;
              this.push(parsed);
            }
            this.productData = {};
          } else {
            this.inProduct = true;
            this.productData = {};
          }
        } else if (this.inProduct) {
          if (!isClosing && !tagContent.endsWith('/')) {
            this.currentTag = tagName;
          } else if (isClosing && tagName === this.currentTag) {
            this.currentTag = '';
          }
        }

        // Look for inner text between close of this tag and next open tag
        const nextOpen = this.buffer.indexOf('<', closeIdx);
        if (nextOpen !== -1) {
          if (this.inProduct && this.currentTag) {
            const textVal = this.buffer.slice(closeIdx + 1, nextOpen).trim();
            if (textVal) {
              this.productData[this.currentTag] = (this.productData[this.currentTag] || '') + textVal;
            }
          }
          openIdx = nextOpen;
        } else {
          // Leftover text without closing <
          this.buffer = this.buffer.slice(closeIdx + 1);
          return callback();
        }
      }

      if (openIdx !== -1) {
        this.buffer = this.buffer.slice(openIdx);
      } else {
        this.buffer = '';
      }

      callback();
    } catch (err: any) {
      callback(err);
    }
  }

  private mapProductRecord(data: Record<string, string>): ParsedProduct | null {
    // Government Israeli schema tag variants
    const itemCode = data.itemcode || data.item_code || data.itemid || data.sku;
    const name = data.itemname || data.item_name || data.itemnm || data.name;
    const price = data.itemprice || data.item_price || data.price;

    if (!itemCode || !name || !price) {
      return null;
    }

    const barcode = data.barcode || data.itemcode;
    const manufacturer = data.manufacturename || data.manufacturer || data.mfgname;
    const unitQty = data.unitqty || data.unit_of_measure_price || data.quantity;

    return {
      itemCode: String(itemCode).trim(),
      barcode: barcode ? String(barcode).trim() : undefined,
      name: String(name).trim(),
      manufacturer: manufacturer ? String(manufacturer).trim() : undefined,
      price: String(price).trim(),
      unitQty: unitQty ? String(unitQty).trim() : undefined,
    };
  }
}

/**
 * Creates a stream pipeline that decompresses gzip (if needed) and parses Israeli Supermarket XML
 */
export function createPriceParserPipeline(isGzip: boolean): { input: Transform; parser: PriceXmlStreamParser } {
  const parser = new PriceXmlStreamParser();
  if (isGzip) {
    const gunzip = zlib.createGunzip();
    gunzip.pipe(parser);
    return { input: gunzip, parser };
  }
  return { input: parser, parser };
}
