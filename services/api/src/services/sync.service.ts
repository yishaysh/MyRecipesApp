import { eq, and, sql, desc } from 'drizzle-orm';
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
  public static inMemoryProUsers = new Set<string>();

  /**
   * Normalize social URLs by stripping analytics/tracking query params and trailing slashes
   */
  public static normalizeSocialUrl(url: string): string {
    try {
      const parsed = new URL(url.trim());
      const trackingParams = [
        'igsh', 'si', 'utm_source', 'utm_medium', 'utm_campaign',
        'utm_term', 'utm_content', 'fbclid', 'ref', 'source', 'share_id', 'srtk'
      ];
      for (const p of trackingParams) {
        parsed.searchParams.delete(p);
      }
      let pathname = parsed.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      parsed.pathname = pathname;
      const search = parsed.searchParams.toString();
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}${search ? `?${search}` : ''}`;
    } catch {
      return (url || '').trim();
    }
  }

  /**
   * Normalize recipe title for deduplication comparison
   */
  public static normalizeTitle(title: string): string {
    return (title || '')
      .toLowerCase()
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Check if user is allowed to extract a new recipe based on Freemium quota
   */
  public static async checkUsageLimit(userId: string): Promise<UsageStatus> {
    const db = getDb();
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!db) {
      // In-memory / development fallback
      const inMemoryPro = SyncService.inMemoryProUsers.has(userId);
      if (inMemoryPro) {
        return {
          allowed: true,
          remaining: 9999,
          totalLimit: 9999,
          used: 0,
          isPro: true,
          period,
        };
      }
      return {
        allowed: true,
        remaining: FREE_MONTHLY_EXTRACTIONS,
        totalLimit: FREE_MONTHLY_EXTRACTIONS,
        used: 0,
        isPro: false,
        period,
      };
    }

    try {
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
    } catch (err) {
      console.error('[SYNC] checkUsageLimit query error, falling back to defaults:', err);
      return {
        allowed: true,
        remaining: FREE_MONTHLY_EXTRACTIONS,
        totalLimit: FREE_MONTHLY_EXTRACTIONS,
        used: 0,
        isPro: false,
        period,
      };
    }
  }

  /**
   * Increment extraction usage count for user atomically via database upsert
   */
  public static async incrementUsage(userId: string): Promise<void> {
    const db = getDb();
    if (!db) return;

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const limitId = `lim_${userId}_${period}`;

    try {
      await db.insert(schema.usageLimits).values({
        id: limitId,
        userId,
        periodYearMonth: period,
        extractionsCount: 1,
      }).onConflictDoUpdate({
        target: [schema.usageLimits.userId, schema.usageLimits.periodYearMonth],
        set: {
          extractionsCount: sql`${schema.usageLimits.extractionsCount} + 1`,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[SYNC] Failed to increment usage atomically in Neon DB:', err);
    }
  }

  /**
   * Refund/decrement usage if an asynchronous extraction failed
   */
  public static async decrementUsage(userId: string): Promise<void> {
    const db = getDb();
    if (!db) return;

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      await db.update(schema.usageLimits).set({
        extractionsCount: sql`GREATEST(0, ${schema.usageLimits.extractionsCount} - 1)`,
        updatedAt: new Date(),
      }).where(and(eq(schema.usageLimits.userId, userId), eq(schema.usageLimits.periodYearMonth, period)));
    } catch (err) {
      console.error('[SYNC] Failed to decrement usage in Neon DB:', err);
    }
  }

  private static inMemoryCache: Map<string, any> = new Map();

  /**
   * Check global cache to avoid running Gemini LLM for popular recipes
   */
  public static async getFromGlobalCache(rawUrl: string): Promise<any | null> {
    const normalizedUrl = this.normalizeSocialUrl(rawUrl);
    const db = getDb();
    if (!db) {
      return this.inMemoryCache.get(normalizedUrl) || null;
    }

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
  public static async saveToGlobalCache(rawUrl: string, recipeData: any): Promise<void> {
    const normalizedUrl = this.normalizeSocialUrl(rawUrl);
    const db = getDb();
    if (!db) {
      this.inMemoryCache.set(normalizedUrl, recipeData);
      return;
    }

    try {
      await db.insert(schema.globalRecipesCache).values({
        id: `cache_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        normalizedUrl,
        recipeData,
        hitCount: 1,
      }).onConflictDoUpdate({
        target: schema.globalRecipesCache.normalizedUrl,
        set: {
          recipeData,
          hitCount: sql`${schema.globalRecipesCache.hitCount} + 1`,
          lastHitAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[CACHE] Error saving to global cache:', err);
    }
  }

  /**
   * Pull all cloud recipes for user (sorted by pinned first, then newest)
   */
  public static async pullRecipes(userId: string): Promise<any[]> {
    const db = getDb();
    if (!db) return [];

    try {
      const rows = await db.select().from(schema.recipes)
        .where(eq(schema.recipes.userId, userId))
        .orderBy(desc(schema.recipes.isPinned), desc(schema.recipes.createdAt));

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
        isBookmarked: Boolean(r.isBookmarked),
        isPinned: Boolean(r.isPinned),
        isArchived: Boolean(r.isArchived),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch (err) {
      console.error('[SYNC] Error pulling recipes from Neon DB:', err);
      return [];
    }
  }

  /**
   * Push recipes from client to cloud with canonical matching & deduplication:
   * 1. Matches existing recipes by ID, normalized sourceUrl, or normalized title
   * 2. Preserves bookmark status (Union: true if either cloud or incoming has true)
   * 3. Prevents recipe multiplication across mobile and web devices
   * 4. Cleans up existing DB duplicates for this user
   */
  public static async pushRecipes(userId: string, recipesList: any[]): Promise<{ savedCount: number }> {
    const db = getDb();
    if (!db || !Array.isArray(recipesList) || recipesList.length === 0) {
      return { savedCount: 0 };
    }

    const validRecipes = recipesList.filter(r => r && r.title);
    if (validRecipes.length === 0) {
      return { savedCount: 0 };
    }

    try {
      // 1. Fetch current user recipes from DB
      const existingRows = await db.select().from(schema.recipes).where(eq(schema.recipes.userId, userId));

      const byId = new Map<string, any>();
      const byUrl = new Map<string, any>();
      const byTitle = new Map<string, any>();

      for (const row of existingRows) {
        byId.set(row.id, row);
        if (row.sourceUrl) {
          const normUrl = this.normalizeSocialUrl(row.sourceUrl);
          if (normUrl) byUrl.set(normUrl, row);
        }
        const normTitle = this.normalizeTitle(row.title);
        if (normTitle) byTitle.set(normTitle, row);
      }

      let saved = 0;
      for (const r of validRecipes) {
        const normUrl = r.sourceUrl ? this.normalizeSocialUrl(r.sourceUrl) : null;
        const normTitle = this.normalizeTitle(r.title);

        // Find existing match by ID, URL, or Title
        const matched = (r.id && byId.get(r.id)) ||
                        (normUrl && byUrl.get(normUrl)) ||
                        (normTitle && byTitle.get(normTitle));

        if (matched) {
          // Merge with existing record
          const targetId = matched.id;
          const mergedBookmark = Boolean(matched.isBookmarked || r.isBookmarked);
          const mergedPinned = Boolean(matched.isPinned || r.isPinned);
          const mergedArchived = Boolean(matched.isArchived && r.isArchived);
          const mergedTags = Array.from(new Set([...(matched.tags || []), ...(r.tags || [])]));

          await db.update(schema.recipes).set({
            title: r.title || matched.title,
            description: r.description || matched.description,
            category: (r.category && r.category !== 'כללי') ? r.category : matched.category,
            imageUrl: r.imageUrl || matched.imageUrl,
            servings: r.servings || matched.servings,
            prepTimeMinutes: r.prepTimeMinutes || matched.prepTimeMinutes,
            cookTimeMinutes: r.cookTimeMinutes || matched.cookTimeMinutes,
            totalTimeMinutes: r.totalTimeMinutes || matched.totalTimeMinutes,
            ingredients: Array.isArray(r.ingredients) && r.ingredients.length > 0 ? r.ingredients : matched.ingredients,
            instructions: Array.isArray(r.instructions) && r.instructions.length > 0 ? r.instructions : matched.instructions,
            tags: mergedTags,
            isBookmarked: mergedBookmark,
            isPinned: mergedPinned,
            isArchived: mergedArchived,
            updatedAt: new Date(),
          }).where(and(eq(schema.recipes.id, targetId), eq(schema.recipes.userId, userId)));

          // Update cache maps so later items in this batch also see merged values
          matched.isBookmarked = mergedBookmark;
          matched.isPinned = mergedPinned;
          matched.tags = mergedTags;
          saved++;
        } else {
          // Insert new unique recipe
          const newId = r.id || `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newRow = {
            id: newId,
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
            isBookmarked: Boolean(r.isBookmarked),
            isPinned: Boolean(r.isPinned),
            isArchived: Boolean(r.isArchived),
          };

          await db.insert(schema.recipes).values(newRow);

          byId.set(newId, newRow);
          if (normUrl) byUrl.set(normUrl, newRow);
          if (normTitle) byTitle.set(normTitle, newRow);
          saved++;
        }
      }

      // 2. Active Cleanup: purge any existing duplicate rows in Neon DB for this user
      const refreshedRows = await db.select().from(schema.recipes).where(eq(schema.recipes.userId, userId));
      const seenCanonical = new Map<string, any>(); // canonicalKey -> primaryRow
      const duplicateIdsToDelete: string[] = [];

      for (const row of refreshedRows) {
        const canonicalKey = row.sourceUrl ? `url:${this.normalizeSocialUrl(row.sourceUrl)}` : `title:${this.normalizeTitle(row.title)}`;
        const primary = seenCanonical.get(canonicalKey);
        if (primary) {
          // If the duplicate had bookmark true, ensure primary has bookmark true
          if (row.isBookmarked && !primary.isBookmarked) {
            await db.update(schema.recipes).set({ isBookmarked: true }).where(eq(schema.recipes.id, primary.id));
            primary.isBookmarked = true;
          }
          duplicateIdsToDelete.push(row.id);
        } else {
          seenCanonical.set(canonicalKey, row);
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        for (const dupId of duplicateIdsToDelete) {
          await db.delete(schema.recipes).where(and(eq(schema.recipes.id, dupId), eq(schema.recipes.userId, userId))).catch(() => {});
        }
        console.log(`[SYNC] Purged ${duplicateIdsToDelete.length} duplicate recipes for user ${userId}`);
      }

      return { savedCount: saved };
    } catch (err) {
      console.error('[SYNC] Error in pushRecipes:', err);
      return { savedCount: 0 };
    }
  }
}

