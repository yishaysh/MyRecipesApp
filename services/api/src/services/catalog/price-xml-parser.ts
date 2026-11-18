import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
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

function unescapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Fast stream-based parser for Israeli Supermarket Price Transparency XML files (<PriceFull> or <Prices>).
 * Handles gzipped stream or plain XML stream chunk by chunk without loading huge 30MB+ files into memory.
 */
export class PriceXmlStreamParser extends Transform {
  private buffer: string = '';
  private decoder: StringDecoder = new StringDecoder('utf8');
  public count: number = 0;

  constructor() {
    super({ objectMode: true });
  }

  private drainCompleteItems(isFlush: boolean): void {
    const itemStartRegex = /<(item|product)(?:\s+[^>]*)?(?<!\/)>/i;
    const itemCloseRegex = /<\/(item|product)>/i;

    let matchStart = this.buffer.search(itemStartRegex);
    while (matchStart !== -1) {
      if (matchStart > 0) {
        this.buffer = this.buffer.slice(matchStart);
      }

      const matchClose = this.buffer.search(itemCloseRegex);
      if (matchClose === -1) {
        break;
      }

      const closeTagOffset = this.buffer.slice(matchClose).indexOf('>');
      if (closeTagOffset === -1) {
        break;
      }

      const closeEnd = matchClose + closeTagOffset + 1;
      const itemXml = this.buffer.slice(0, closeEnd);
      this.buffer = this.buffer.slice(closeEnd);

      const parsed = this.parseItemXml(itemXml);
      if (parsed) {
        this.count++;
        this.push(parsed);
      }

      matchStart = this.buffer.search(itemStartRegex);
    }

    if (!isFlush && matchStart === -1 && this.buffer.length > 100) {
      this.buffer = this.buffer.slice(-50);
    }
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      this.buffer += this.decoder.write(chunk);
      this.drainCompleteItems(false);
      callback();
    } catch (err: any) {
      callback(err);
    }
  }

  _flush(callback: (error?: Error | null) => void): void {
    try {
      this.buffer += this.decoder.end();
      this.drainCompleteItems(true);
      this.buffer = '';
      callback();
    } catch (err: any) {
      callback(err);
    }
  }

  private parseItemXml(rawXml: string): ParsedProduct | null {
    const xml = rawXml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

    const extract = (tags: string): string | undefined => {
      // Disallow self-closing opening tags (/>) and enforce matching closing tag via \1
      const match = xml.match(new RegExp(`<(${tags})(?:\\s+[^>]*)?(?<!\\/)>([\\s\\S]*?)<\\/\\1>`, 'i'));
      if (!match || !match[2]) return undefined;
      return unescapeXml(match[2].trim());
    };

    const itemCode = extract('itemcode|item_code|itemid|sku');
    const name = extract('itemname|item_name|itemnm|name');
    const price = extract('itemprice|item_price|price');

    if (!itemCode || !name || !price) {
      return null;
    }

    const barcode = extract('barcode') || itemCode;
    const manufacturer = extract('manufacturename|manufacturer|mfgname');
    const unitQty = extract('unitqty|unit_of_measure_price|quantity');

    return {
      itemCode,
      barcode,
      name,
      manufacturer,
      price,
      unitQty,
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
