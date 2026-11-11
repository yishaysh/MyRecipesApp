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
   * Normalize social URLs into a clean HTTPS URL by stripping analytics/tracking query params and trailing slashes
   */
  public static normalizeSocialUrl(url: string): string {
    try {
      const parsed = new URL(url.trim());
      const trackingParams = [
        'igsh', 'igshid', 'si', 'exln', 'dlrf', 'rdid', 'share_app_id',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'ref', 'source', 'share_id', 'srtk', 'xtok',
        'is_from_webapp', 'sender_device'
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
   * Canonical identifier for duplicate comparison across Web, Mobile, and Cloud DB.
   * Mirrors mobile `normalizeUrl` semantics (preserving shortcode casing).
   */
  public static canonicalUrlKey(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const clean = rawUrl.trim();
    if (!clean) return '';

    try {
      const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

      // YouTube
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        const v = parsed.searchParams.get('v');
        if (v) return `youtube:video:${v}`;
        const pathMatch = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]+)/i);
        if (pathMatch) return `youtube:video:${pathMatch[1]}`;
      } else if (host === 'youtu.be') {
        const v = parsed.pathname.replace(/^\/+/, '').split('/')[0];
        if (v) return `youtube:video:${v}`;
      }

      // Instagram (Reels, Posts, IGTV, /username/reel/ID)
      if (host === 'instagram.com' || host === 'm.instagram.com') {
        const igMatch = parsed.pathname.match(/^(?:\/[a-zA-Z0-9._-]+)?\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
        if (igMatch) return `instagram:post:${igMatch[1]}`;
      }

      // TikTok (Video, Photo carousel, Shortlinks)
      if (host === 'tiktok.com' || host === 'm.tiktok.com') {
        const ttMatch = parsed.pathname.match(/(?:video|photo|v)\/(\d+)/i);
        if (ttMatch) return `tiktok:video:${ttMatch[1]}`;
      } else if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') {
        const code = parsed.pathname.replace(/^\/+/, '').split('/')[0];
        if (code) return `tiktok:short:${code}`;
      }

      const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
      return `${host}${path}`;
    } catch {
      return clean
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]
        .replace(/\/+$/, '');
    }
  }

  /**
   * Normalize recipe title for deduplication comparison (strips emojis, punctuation, whitespace)
   */
  public static normalizeTitle(title: string): string {
    return (title || '')
      .toLowerCase()
      .replace(/[\u200B-\u200F\uFEFF]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim();
  }

  /**
   * Determines whether two recipe records represent the same recipe,
   * using canonical URL matching + multi-recipe carousel protection.
   */
  public static areRecipesDuplicate(existing: any, incoming: any): boolean {
    if (!existing || !incoming) return false;
    if (existing.id && incoming.id && existing.id === incoming.id) return true;

    const existingUrl = typeof existing.sourceUrl === 'string' ? existing.sourceUrl.trim() : '';
    const incomingUrl = typeof incoming.sourceUrl === 'string' ? incoming.sourceUrl.trim() : '';

    if (existingUrl && incomingUrl) {
      const normExisting = this.canonicalUrlKey(existingUrl);
      const normIncoming = this.canonicalUrlKey(incomingUrl);
      const urlsMatch =
        (normExisting && normIncoming && normExisting === normIncoming) ||
        existingUrl.toLowerCase() === incomingUrl.toLowerCase();

      if (urlsMatch) {
        if (existing.title?.trim() && incoming.title?.trim()) {
          const normExistingTitle = this.normalizeTitle(existing.title);
          const normIncomingTitle = this.normalizeTitle(incoming.title);

          if (normExistingTitle === normIncomingTitle) {
            return true;
          }

          if (normExistingTitle.length >= 4 && normIncomingTitle.length >= 4) {
            if (
              normExistingTitle.includes(normIncomingTitle) ||
              normIncomingTitle.includes(normExistingTitle)
            ) {
              return true;
            }
            return false;
          }
        }
        return true;
      }

      return false;
    }

    if (existing.title && incoming.title) {
      const normExistingTitle = this.normalizeTitle(existing.title);
      const normIncomingTitle = this.normalizeTitle(incoming.title);
      if (normExistingTitle.length >= 4 && normIncomingTitle.length >= 4) {
        return normExistingTitle === normIncomingTitle;
      }
    }

    return false;
  }

  /**
   * Merges two duplicate recipe records using LWW timestamps for user flags and tag union.
   */
  public static mergeRecipeRecords(primary: any, incoming: any): any {
    const incomingTime = incoming?.updatedAt ? new Date(incoming.updatedAt).getTime() : NaN;
    const primaryTime = primary?.updatedAt ? new Date(primary.updatedAt).getTime() : NaN;
    const hasComparableTimes = !Number.isNaN(incomingTime) && !Number.isNaN(primaryTime);
    const incomingIsNewer = hasComparableTimes ? incomingTime >= primaryTime : false;

    const mergedBookmark = hasComparableTimes
      ? (incomingIsNewer ? Boolean(incoming.isBookmarked) : Boolean(primary.isBookmarked))
      : Boolean(primary.isBookmarked || incoming.isBookmarked);
    const mergedPinned = hasComparableTimes
      ? (incomingIsNewer ? Boolean(incoming.isPinned) : Boolean(primary.isPinned))
      : Boolean(primary.isPinned || incoming.isPinned);
    const mergedArchived = hasComparableTimes
      ? (incomingIsNewer ? Boolean(incoming.isArchived) : Boolean(primary.isArchived))
      : Boolean(primary.isArchived || incoming.isArchived);

    const mergedTags = Array.from(new Set([...(primary.tags || []), ...(incoming.tags || [])]));
    const latestIso = hasComparableTimes
      ? (incomingIsNewer ? new Date(incomingTime).toISOString() : new Date(primaryTime).toISOString())
      : (incoming.updatedAt || primary.updatedAt || new Date().toISOString());

    return {
      ...primary,
      title: incoming.title || primary.title,
      description: incoming.description || primary.description,
      sourceUrl: primary.sourceUrl || incoming.sourceUrl,
      category: (incoming.category && incoming.category !== 'כללי') ? incoming.category : (primary.category || incoming.category || 'כללי'),
      imageUrl: incoming.imageUrl || primary.imageUrl,
      servings: incoming.servings || primary.servings,
      prepTimeMinutes: incoming.prepTimeMinutes || primary.prepTimeMinutes,
      cookTimeMinutes: incoming.cookTimeMinutes || primary.cookTimeMinutes,
      totalTimeMinutes: incoming.totalTimeMinutes || primary.totalTimeMinutes,
      ingredients: Array.isArray(incoming.ingredients) && incoming.ingredients.length > 0 ? incoming.ingredients : primary.ingredients,
      instructions: Array.isArray(incoming.instructions) && incoming.instructions.length > 0 ? incoming.instructions : primary.instructions,
      tags: mergedTags,
      isBookmarked: mergedBookmark,
      isPinned: mergedPinned,
      isArchived: mergedArchived,
      createdAt: primary.createdAt || incoming.createdAt,
      updatedAt: latestIso,
    };
  }

  /**
   * Deduplicates an array of recipes using canonical URL and title rules.
   */
  public static deduplicateRecipes(recipes: any[]): any[] {
    if (!Array.isArray(recipes)) return [];
    const deduped: any[] = [];
    for (const r of recipes) {
      if (!r || !r.title) continue;
      const idx = deduped.findIndex((existing) => this.areRecipesDuplicate(existing, r));
      if (idx >= 0) {
        deduped[idx] = this.mergeRecipeRecords(deduped[idx], r);
      } else {
        deduped.push({
          ...r,
          isBookmarked: Boolean(r.isBookmarked),
          isPinned: Boolean(r.isPinned),
          isArchived: Boolean(r.isArchived),
        });
      }
    }
    return deduped;
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
   * Actively scans and purges duplicate recipe rows in Neon DB for a user,
   * merging bookmarks, pins, archive flags, and tags onto the primary row.
   */
  public static async cleanupDuplicateRecipes(userId: string): Promise<number> {
    const db = getDb();
    if (!db) return 0;

    try {
      const rows = await db
        .select()
        .from(schema.recipes)
        .where(eq(schema.recipes.userId, userId))
        .orderBy(desc(schema.recipes.isPinned), desc(schema.recipes.updatedAt), desc(schema.recipes.createdAt));

      if (rows.length <= 1) return 0;

      const keptRows: any[] = [];
      const duplicateIdsToDelete: string[] = [];

      for (const row of rows) {
        const primary = keptRows.find((k) => this.areRecipesDuplicate(k, row));
        if (primary) {
          const merged = this.mergeRecipeRecords(primary, row);
          const cleanPrimaryUrl = merged.sourceUrl ? this.normalizeSocialUrl(merged.sourceUrl) : primary.sourceUrl;
          const needsUpdate =
            merged.isBookmarked !== Boolean(primary.isBookmarked) ||
            merged.isPinned !== Boolean(primary.isPinned) ||
            merged.isArchived !== Boolean(primary.isArchived) ||
            cleanPrimaryUrl !== primary.sourceUrl ||
            merged.imageUrl !== primary.imageUrl ||
            merged.description !== primary.description ||
            JSON.stringify(merged.tags) !== JSON.stringify(primary.tags || []) ||
            JSON.stringify(merged.ingredients) !== JSON.stringify(primary.ingredients || []) ||
            JSON.stringify(merged.instructions) !== JSON.stringify(primary.instructions || []);

          if (needsUpdate) {
            await db
              .update(schema.recipes)
              .set({
                title: merged.title,
                description: merged.description,
                sourceUrl: cleanPrimaryUrl,
                category: merged.category,
                imageUrl: merged.imageUrl,
                servings: merged.servings,
                prepTimeMinutes: merged.prepTimeMinutes,
                cookTimeMinutes: merged.cookTimeMinutes,
                totalTimeMinutes: merged.totalTimeMinutes,
                ingredients: merged.ingredients,
                instructions: merged.instructions,
                isBookmarked: merged.isBookmarked,
                isPinned: merged.isPinned,
                isArchived: merged.isArchived,
                tags: merged.tags,
              })
              .where(and(eq(schema.recipes.id, primary.id), eq(schema.recipes.userId, userId)))
              .catch(() => {});

            Object.assign(primary, merged, { sourceUrl: cleanPrimaryUrl });
          }

          duplicateIdsToDelete.push(row.id);
        } else {
          keptRows.push(row);
        }
      }

      for (const dupId of duplicateIdsToDelete) {
        await db
          .delete(schema.recipes)
          .where(and(eq(schema.recipes.id, dupId), eq(schema.recipes.userId, userId)))
          .catch(() => {});
      }

      if (duplicateIdsToDelete.length > 0) {
        console.log(`[SYNC] Purged ${duplicateIdsToDelete.length} duplicate recipes for user ${userId}`);
      }

      return duplicateIdsToDelete.length;
    } catch (err) {
      console.error('[SYNC] Error in cleanupDuplicateRecipes:', err);
      return 0;
    }
  }

  /**
   * Push recipes from client to cloud with canonical matching & deduplication:
   * 1. Matches existing recipes by ID, canonical social URL key (multi-recipe carousel aware), or normalized title
   * 2. Resolves bookmarks/pins/archives via updatedAt LWW timestamps (or union fallback)
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
      const byCanonicalUrl = new Map<string, any[]>();
      const byTitle = new Map<string, any>();

      const indexRow = (row: any) => {
        byId.set(row.id, row);
        if (row.sourceUrl) {
          const canonUrl = this.canonicalUrlKey(row.sourceUrl);
          if (canonUrl) {
            const bucket = byCanonicalUrl.get(canonUrl) || [];
            bucket.push(row);
            byCanonicalUrl.set(canonUrl, bucket);
          }
        }
        const normTitle = this.normalizeTitle(row.title);
        if (normTitle) byTitle.set(normTitle, row);
      };

      for (const row of existingRows) {
        indexRow(row);
      }

      let saved = 0;
      for (const r of validRecipes) {
        const canonUrl = r.sourceUrl ? this.canonicalUrlKey(r.sourceUrl) : null;
        const normTitle = this.normalizeTitle(r.title);

        // Find existing match by ID, canonical URL (preserving carousels), or Title (only when at least one lacks URL)
        let matched = r.id ? byId.get(r.id) : null;
        if (!matched && canonUrl) {
          const candidates = byCanonicalUrl.get(canonUrl) || [];
          matched = candidates.find((candidate) => this.areRecipesDuplicate(candidate, r)) || null;
        }
        if (!matched && normTitle) {
          const titleCandidate = byTitle.get(normTitle);
          if (titleCandidate && this.areRecipesDuplicate(titleCandidate, r)) {
            matched = titleCandidate;
          }
        }

        if (matched) {
          // Merge with existing record using LWW timestamps + tag union
          const targetId = matched.id;
          const merged = this.mergeRecipeRecords(matched, r);
          const cleanSourceUrl = merged.sourceUrl ? this.normalizeSocialUrl(merged.sourceUrl) : null;

          await db.update(schema.recipes).set({
            title: merged.title,
            description: merged.description,
            sourceUrl: cleanSourceUrl,
            category: merged.category,
            imageUrl: merged.imageUrl,
            servings: merged.servings,
            prepTimeMinutes: merged.prepTimeMinutes,
            cookTimeMinutes: merged.cookTimeMinutes,
            totalTimeMinutes: merged.totalTimeMinutes,
            ingredients: merged.ingredients,
            instructions: merged.instructions,
            tags: merged.tags,
            isBookmarked: merged.isBookmarked,
            isPinned: merged.isPinned,
            isArchived: merged.isArchived,
            updatedAt: new Date(),
          }).where(and(eq(schema.recipes.id, targetId), eq(schema.recipes.userId, userId)));

          // Update in-memory references so later items in this batch see merged values
          Object.assign(matched, merged, { sourceUrl: cleanSourceUrl });
          saved++;
        } else {
          // Insert new unique recipe
          const newId = r.id || `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const cleanSourceUrl = r.sourceUrl ? this.normalizeSocialUrl(r.sourceUrl) : null;
          const newRow = {
            id: newId,
            userId,
            title: r.title,
            description: r.description || null,
            sourceUrl: cleanSourceUrl,
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
          indexRow(newRow);
          saved++;
        }
      }

      // 2. Active Cleanup: purge any existing duplicate rows in Neon DB for this user
      await this.cleanupDuplicateRecipes(userId);

      return { savedCount: saved };
    } catch (err) {
      console.error('[SYNC] Error in pushRecipes:', err);
      return { savedCount: 0 };
    }
  }
}

