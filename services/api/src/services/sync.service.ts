import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';

export const FREE_MONTHLY_EXTRACTIONS = 5;

export interface UsageStatus {
  allowed: boolean;
  remaining: number;
  totalLimit: number;
  used: number;
  isPro: boolean;
  period: string;
}

export class SyncService {
  /**
   * Check if user is allowed to extract a new recipe based on Freemium quota
   */
  public static async checkUsageLimit(userId: string): Promise<UsageStatus> {
    const db = getDb();
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!db) {
      // In-memory / development fallback
      return {
        allowed: true,
        remaining: FREE_MONTHLY_EXTRACTIONS,
        totalLimit: FREE_MONTHLY_EXTRACTIONS,
        used: 0,
        isPro: false,
        period,
      };
    }

    // Check user pro status
    const userRows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const isPro = userRows.length > 0 ? userRows[0].isPro : false;

    if (isPro) {
      return {
        allowed: true,
        remaining: 9999,
        totalLimit: 9999,
        used: 0,
        isPro: true,
        period,
      };
    }

    // Check usage record
    const limitRows = await db.select().from(schema.usageLimits)
      .where(and(eq(schema.usageLimits.userId, userId), eq(schema.usageLimits.periodYearMonth, period)))
      .limit(1);

    const used = limitRows.length > 0 ? limitRows[0].extractionsCount : 0;
    const remaining = Math.max(0, FREE_MONTHLY_EXTRACTIONS - used);

    return {
      allowed: remaining > 0,
      remaining,
      totalLimit: FREE_MONTHLY_EXTRACTIONS,
      used,
      isPro: false,
      period,
    };
  }

  /**
   * Increment extraction usage count for user
   */
  public static async incrementUsage(userId: string): Promise<void> {
    const db = getDb();
    if (!db) return;

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      const limitRows = await db.select().from(schema.usageLimits)
        .where(and(eq(schema.usageLimits.userId, userId), eq(schema.usageLimits.periodYearMonth, period)))
        .limit(1);

      if (limitRows.length > 0) {
        await db.update(schema.usageLimits).set({
          extractionsCount: limitRows[0].extractionsCount + 1,
          updatedAt: new Date(),
        }).where(eq(schema.usageLimits.id, limitRows[0].id));
      } else {
        await db.insert(schema.usageLimits).values({
          id: `lim_${userId}_${period}`,
          userId,
          periodYearMonth: period,
          extractionsCount: 1,
        });
      }
    } catch (err) {
      console.error('[SYNC] Failed to increment usage in Neon DB:', err);
    }
  }

  /**
   * Check global cache to avoid running Gemini LLM for popular recipes
   */
  public static async getFromGlobalCache(normalizedUrl: string): Promise<any | null> {
    const db = getDb();
    if (!db) return null;

    try {
      const cached = await db.select().from(schema.globalRecipesCache)
        .where(eq(schema.globalRecipesCache.normalizedUrl, normalizedUrl))
        .limit(1);

      if (cached.length > 0) {
        // Increment hit count asynchronously
        db.update(schema.globalRecipesCache).set({
          hitCount: cached[0].hitCount + 1,
          lastHitAt: new Date(),
        }).where(eq(schema.globalRecipesCache.id, cached[0].id)).catch(() => {});

        return cached[0].recipeData;
      }
    } catch (err) {
      console.error('[CACHE] Error reading from global cache:', err);
    }
    return null;
  }

  /**
   * Store parsed recipe in global cache
   */
  public static async saveToGlobalCache(normalizedUrl: string, recipeData: any): Promise<void> {
    const db = getDb();
    if (!db) return;

    try {
      await db.insert(schema.globalRecipesCache).values({
        id: `cache_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        normalizedUrl,
        recipeData,
        hitCount: 1,
      }).onConflictDoNothing();
    } catch (err) {
      console.error('[CACHE] Error saving to global cache:', err);
    }
  }

  /**
   * Pull all cloud recipes for user
   */
  public static async pullRecipes(userId: string): Promise<any[]> {
    const db = getDb();
    if (!db) return [];

    try {
      const rows = await db.select().from(schema.recipes).where(eq(schema.recipes.userId, userId));
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        sourceUrl: r.sourceUrl,
        platform: r.platform,
        category: r.category,
        imageUrl: r.imageUrl,
        servings: r.servings,
        prepTimeMinutes: r.prepTimeMinutes,
        cookTimeMinutes: r.cookTimeMinutes,
        totalTimeMinutes: r.totalTimeMinutes,
        difficulty: r.difficulty,
        nutrition: r.nutrition,
        ingredients: r.ingredients,
        instructions: r.instructions,
        tags: r.tags,
        isBookmarked: r.isBookmarked,
        isPinned: r.isPinned,
        isArchived: r.isArchived,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch (err) {
      console.error('[SYNC] Error pulling recipes from Neon DB:', err);
      return [];
    }
  }

  /**
   * Push recipes from client to cloud (batch upsert)
   */
  public static async pushRecipes(userId: string, recipesList: any[]): Promise<{ savedCount: number }> {
    const db = getDb();
    if (!db || !Array.isArray(recipesList) || recipesList.length === 0) {
      return { savedCount: 0 };
    }

    let saved = 0;
    for (const r of recipesList) {
      if (!r.title) continue;
      const recipeId = r.id || `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        await db.insert(schema.recipes).values({
          id: recipeId,
          userId,
          title: r.title,
          description: r.description || null,
          sourceUrl: r.sourceUrl || null,
          platform: r.platform || 'manual',
          category: r.category || 'כללי',
          imageUrl: r.imageUrl || null,
          servings: r.servings || 4,
          prepTimeMinutes: r.prepTimeMinutes || null,
          cookTimeMinutes: r.cookTimeMinutes || null,
          totalTimeMinutes: r.totalTimeMinutes || null,
          difficulty: r.difficulty || 'medium',
          nutrition: r.nutrition || null,
          ingredients: r.ingredients || [],
          instructions: r.instructions || [],
          tags: r.tags || [],
          isBookmarked: !!r.isBookmarked,
          isPinned: !!r.isPinned,
          isArchived: !!r.isArchived,
        }).onConflictDoUpdate({
          target: schema.recipes.id,
          set: {
            title: r.title,
            description: r.description || null,
            category: r.category || 'כללי',
            imageUrl: r.imageUrl || null,
            ingredients: r.ingredients || [],
            instructions: r.instructions || [],
            tags: r.tags || [],
            isBookmarked: !!r.isBookmarked,
            isPinned: !!r.isPinned,
            isArchived: !!r.isArchived,
            updatedAt: new Date(),
          },
        });
        saved++;
      } catch (err) {
        console.error(`[SYNC] Failed to upsert recipe ${recipeId}:`, err);
      }
    }

    return { savedCount: saved };
  }
}
