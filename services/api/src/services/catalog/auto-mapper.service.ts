import { getDb } from '../../db/index.js';
import { chainProducts, ingredientMappingSuggestions, ingredientMappings } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { normalizeHebrewText } from './price-xml-parser.js';

export interface MatchCandidate {
  itemCode: string;
  chain: string;
  name: string;
  price: string;
  confidence: number;
  method: 'exact' | 'similarity' | 'gemini';
}

/**
 * Service to automatically match recipe ingredients to chain supermarket products
 */
export class AutoMapperService {
  /**
   * Search for product matches for a given ingredient name across chains
   */
  static async findMatchesForIngredient(
    ingredientName: string,
    chainKey: string = 'shufersal'
  ): Promise<MatchCandidate[]> {
    const db = getDb();
    if (!db) return [];

    const normalized = normalizeHebrewText(ingredientName);
    if (!normalized) return [];

    // Stage 1: Exact match on normalized name
    const exactMatches = await db
      .select()
      .from(chainProducts)
      .where(and(eq(chainProducts.chain, chainKey), eq(chainProducts.normalizedName, normalized)))
      .limit(3);

    if (exactMatches.length > 0) {
      return exactMatches.map((m) => ({
        itemCode: m.itemCode,
        chain: m.chain,
        name: m.name,
        price: m.price,
        confidence: 98,
        method: 'exact',
      }));
    }

    // Stage 2: Substring / Prefix similarity match
    const likeMatches = await db
      .select()
      .from(chainProducts)
      .where(
        and(
          eq(chainProducts.chain, chainKey),
          sql`${chainProducts.normalizedName} LIKE ${`%${normalized}%`}`
        )
      )
      .limit(5);

    if (likeMatches.length > 0) {
      return likeMatches.map((m) => {
        // Calculate rough similarity score
        const score = Math.max(65, Math.min(90, Math.round((normalized.length / m.normalizedName.length) * 100)));
        return {
          itemCode: m.itemCode,
          chain: m.chain,
          name: m.name,
          price: m.price,
          confidence: score,
          method: 'similarity',
        };
      });
    }

    return [];
  }

  /**
   * Run auto-mapping on a list of ingredients and generate suggestions in DB
   */
  static async generateSuggestions(
    ingredients: { id?: string; name: string }[],
    chainKey: string = 'shufersal'
  ): Promise<{ generated: number; autoApproved: number }> {
    const db = getDb();
    if (!db) return { generated: 0, autoApproved: 0 };

    let generated = 0;
    let autoApproved = 0;

    for (const ing of ingredients) {
      const candidates = await this.findMatchesForIngredient(ing.name, chainKey);
      if (candidates.length === 0) continue;

      const best = candidates[0];
      const suggestionId = `sug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const isHighConfidence = best.confidence >= 95;
      const initialStatus = isHighConfidence ? 'approved' : 'pending';

      await db
        .insert(ingredientMappingSuggestions)
        .values({
          id: suggestionId,
          ingredientId: ing.id,
          ingredientName: ing.name,
          chain: chainKey,
          itemCode: best.itemCode,
          productName: best.name,
          price: best.price,
          confidence: best.confidence,
          method: best.method,
          status: initialStatus,
        })
        .onConflictDoNothing();

      generated++;

      // If confidence >= 95%, auto-approve directly into ingredient_mappings if not locked
      if (isHighConfidence) {
        await this.approveSuggestionInternal(db, {
          ingredientName: ing.name,
          merchantId: chainKey,
          sku: best.itemCode,
          productName: best.name,
          productUrl: `https://www.shufersal.co.il/online/he/search?text=${encodeURIComponent(best.name)}`,
          source: 'auto',
        });
        autoApproved++;
      }
    }

    return { generated, autoApproved };
  }

  /**
   * Internal helper to upsert mapping into ingredient_mappings
   */
  private static async approveSuggestionInternal(
    db: any,
    mapping: {
      ingredientName: string;
      merchantId: string;
      sku: string;
      productName: string;
      productUrl: string;
      source: 'auto' | 'manual';
    }
  ): Promise<void> {
    const normalizedName = normalizeHebrewText(mapping.ingredientName);
    const existing = await db
      .select()
      .from(ingredientMappings)
      .where(and(eq(ingredientMappings.normalizedName, normalizedName), eq(ingredientMappings.merchantId, mapping.merchantId)))
      .limit(1);

    if (existing.length > 0) {
      // Don't overwrite if locked
      if (existing[0].isLocked && mapping.source === 'auto') {
        return;
      }

      await db
        .update(ingredientMappings)
        .set({
          sku: mapping.sku,
          productName: mapping.productName,
          productUrl: mapping.productUrl,
          source: mapping.source,
          updatedAt: new Date(),
        })
        .where(eq(ingredientMappings.id, existing[0].id));
    } else {
      const id = `map_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await db.insert(ingredientMappings).values({
        id,
        normalizedName,
        merchantId: mapping.merchantId,
        sku: mapping.sku,
        productName: mapping.productName,
        productUrl: mapping.productUrl,
        source: mapping.source,
        isLocked: false,
        active: true,
      });
    }
  }

  /**
   * Approve a pending suggestion by ID
   */
  static async approveSuggestion(suggestionId: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;

    const suggestions = await db
      .select()
      .from(ingredientMappingSuggestions)
      .where(eq(ingredientMappingSuggestions.id, suggestionId))
      .limit(1);

    if (suggestions.length === 0) return false;
    const sug = suggestions[0];

    await this.approveSuggestionInternal(db, {
      ingredientName: sug.ingredientName,
      merchantId: sug.chain,
      sku: sug.itemCode,
      productName: sug.productName,
      productUrl: sug.productUrl || `https://www.shufersal.co.il/online/he/search?text=${encodeURIComponent(sug.productName)}`,
      source: 'auto',
    });

    await db
      .update(ingredientMappingSuggestions)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(ingredientMappingSuggestions.id, suggestionId));

    return true;
  }

  /**
   * Reject a suggestion
   */
  static async rejectSuggestion(suggestionId: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;

    await db
      .update(ingredientMappingSuggestions)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(ingredientMappingSuggestions.id, suggestionId));

    return true;
  }
}
