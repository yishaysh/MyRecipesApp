import crypto from 'node:crypto';
import { asc, eq, and } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { getDb, schema } from '../db/index.js';
import { StructuredRecipeSchema } from '../shared/index.js';

export interface CuratedRecipeRecord {
  id: string;
  slug: string;
  recipePayload: any;
  coverImage?: string | null;
  collectionIds: string[];
  tags: string[];
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionRecord {
  id: string;
  slug: string;
  scope: 'curated' | 'user';
  ownerUserId?: string | null;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  icon: string;
  coverImage?: string | null;
  colorGradient: string;
  sortOrder: number;
  published: boolean;
  recipeIds: string[];
  recipeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CuratedOwnerSettings {
  ownerName: string;
  ownerLogoText: string;
  ownerBadgeEmoji: string;
  updatedAt: string;
}

export interface UserPreferencesRecord {
  userId: string;
  viewMode: 'collections' | 'grid';
  onboardingCompleted: boolean;
  onboardingStep: number;
  updatedAt: string;
}

export const SEEDED_CURATED_COLLECTIONS: Array<{
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  icon: string;
  colorGradient: string;
  sortOrder: number;
}> = [
  {
    id: 'col_seed_dear_wife',
    slug: 'dear-wife',
    name: 'אשתי היקרה',
    subtitle: 'בריאות במקסימום',
    icon: '💚',
    colorGradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    sortOrder: 1,
  },
  {
    id: 'col_seed_for_my_wife',
    slug: 'my-recipes-for-wife',
    name: 'המתכונים שלי לאשתי',
    subtitle: 'אהבה בכל ביס',
    icon: '❤️',
    colorGradient: 'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
    sortOrder: 2,
  },
  {
    id: 'col_seed_home_soul',
    slug: 'home-soul-food',
    name: 'מתכוני רוח ביתי',
    subtitle: 'כמו אצל סבתא, רק יותר טוב',
    icon: '🍲',
    colorGradient: 'linear-gradient(135deg, #9a3412 0%, #f59e0b 100%)',
    sortOrder: 3,
  },
  {
    id: 'col_seed_shabbat',
    slug: 'shabbat-table',
    name: 'כמה טוב שהגיע שבת',
    subtitle: 'שולחן שבת שאי אפשר לפספס',
    icon: '🕯️',
    colorGradient: 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)',
    sortOrder: 4,
  },
  {
    id: 'col_seed_happy_kids',
    slug: 'happy-kids',
    name: 'ילדים מרוצים',
    subtitle: 'מנות שנעלמות מהצלחת',
    icon: '😋',
    colorGradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)',
    sortOrder: 5,
  },
  {
    id: 'col_seed_20min_dinner',
    slug: 'dinner-20-min',
    name: 'ארוחת ערב ב-20 דקות',
    subtitle: 'מהיר, פשוט, בלי ויתורים',
    icon: '⚡',
    colorGradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    sortOrder: 6,
  },
  {
    id: 'col_seed_late_night',
    slug: 'after-kids-sleep',
    name: 'בלילה אחרי שהילדים נרדמו',
    subtitle: 'קינוחים וקטנים לנשמה',
    icon: '🌙',
    colorGradient: 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)',
    sortOrder: 7,
  },
  {
    id: 'col_seed_fire_grill',
    slug: 'fire-and-smoke',
    name: 'האש בוערת',
    subtitle: 'על האש, בגריל ובעשן',
    icon: '🔥',
    colorGradient: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)',
    sortOrder: 8,
  },
  {
    id: 'col_seed_home_bakery',
    slug: 'home-bakery',
    name: 'מאפייה ביתית',
    subtitle: 'בצק, התפחה וריח של לחם',
    icon: '🥖',
    colorGradient: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
    sortOrder: 9,
  },
  {
    id: 'col_seed_impressive_guests',
    slug: 'impressive-guests',
    name: 'לאורחים מרשימים',
    subtitle: 'שמרגישים כמו מסעדה',
    icon: '✨',
    colorGradient: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
    sortOrder: 10,
  },
  {
    id: 'col_seed_light_green',
    slug: 'light-and-green',
    name: 'קלילים וירוקים',
    subtitle: 'קל, רענן ובריא',
    icon: '🥗',
    colorGradient: 'linear-gradient(135deg, #3f6212 0%, #65a30d 100%)',
    sortOrder: 11,
  },
];

export function makeSlug(input: string, fallbackPrefix = 'item'): string {
  const cleaned = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  if (cleaned.length >= 2) return cleaned;
  return `${fallbackPrefix}-${crypto.randomBytes(4).toString('hex')}`;
}

export class CuratedCollectionsService {
  private static memCuratedRecipes = new Map<string, CuratedRecipeRecord>();
  private static memCollections = new Map<string, CollectionRecord>();
  private static memSettings: CuratedOwnerSettings = {
    ownerName: 'מהמטבח של הבעלים',
    ownerLogoText: 'מהמטבח של הבעלים',
    ownerBadgeEmoji: '👨‍🍳',
    updatedAt: new Date().toISOString(),
  };
  private static memUserPrefs = new Map<string, UserPreferencesRecord>();
  private static tablesEnsured = false;
  private static seededOnce = false;

  public static resetForTests(): void {
    this.memCuratedRecipes.clear();
    this.memCollections.clear();
    this.memUserPrefs.clear();
    this.memSettings = {
      ownerName: 'מהמטבח של הבעלים',
      ownerLogoText: 'מהמטבח של הבעלים',
      ownerBadgeEmoji: '👨‍🍳',
      updatedAt: new Date().toISOString(),
    };
    this.seededOnce = false;
  }

  /**
   * Idempotently ensures the v2.1.0 tables exist in Neon DB so production deployments
   * work immediately with zero manual migration blockers.
   */
  public static async ensureTables(): Promise<void> {
    if (this.tablesEnsured) return;
    const conn = process.env.DATABASE_URL;
    if (!conn) {
      this.tablesEnsured = true;
      return;
    }
    try {
      const sql = neon(conn);
      await sql`
        CREATE TABLE IF NOT EXISTS curated_recipes (
          id VARCHAR(128) PRIMARY KEY,
          slug VARCHAR(255) NOT NULL UNIQUE,
          recipe_payload JSONB NOT NULL,
          cover_image TEXT,
          collection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          sort_order INTEGER NOT NULL DEFAULT 0,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS collections (
          id VARCHAR(128) PRIMARY KEY,
          slug VARCHAR(255) NOT NULL UNIQUE,
          scope VARCHAR(32) NOT NULL DEFAULT 'curated',
          owner_user_id VARCHAR(128),
          name VARCHAR(120) NOT NULL,
          subtitle VARCHAR(80),
          description TEXT,
          icon VARCHAR(64) NOT NULL DEFAULT '🍽️',
          cover_image TEXT,
          color_gradient VARCHAR(160) NOT NULL DEFAULT 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
          sort_order INTEGER NOT NULL DEFAULT 0,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          recipe_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS curated_settings (
          id VARCHAR(64) PRIMARY KEY,
          owner_name VARCHAR(120) NOT NULL DEFAULT 'מהמטבח של הבעלים',
          owner_logo_text VARCHAR(120) NOT NULL DEFAULT 'מהמטבח של הבעלים',
          owner_badge_emoji VARCHAR(16) NOT NULL DEFAULT '👨‍🍳',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id VARCHAR(128) PRIMARY KEY,
          view_mode VARCHAR(24) NOT NULL DEFAULT 'collections',
          onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
          onboarding_step INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      this.tablesEnsured = true;
    } catch (err: any) {
      console.warn('[CURATED] ensureTables warning:', err?.message || err);
    }
  }

  /**
   * Idempotently seeds the 11 curated collections (published=false by default so owner reviews first).
   */
  public static async seedCuratedCollections(): Promise<{ inserted: number; total: number }> {
    await this.ensureTables();
    const db = getDb();
    const nowIso = new Date().toISOString();
    let inserted = 0;

    if (!db) {
      for (const item of SEEDED_CURATED_COLLECTIONS) {
        if (!this.memCollections.has(item.id)) {
          this.memCollections.set(item.id, {
            id: item.id,
            slug: item.slug,
            scope: 'curated',
            ownerUserId: null,
            name: item.name,
            subtitle: item.subtitle,
            description: null,
            icon: item.icon,
            coverImage: null,
            colorGradient: item.colorGradient,
            sortOrder: item.sortOrder,
            published: false,
            recipeIds: [],
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          inserted++;
        }
      }
      this.seededOnce = true;
      return { inserted, total: SEEDED_CURATED_COLLECTIONS.length };
    }

    for (const item of SEEDED_CURATED_COLLECTIONS) {
      try {
        const existing = await db.select().from(schema.collections).where(eq(schema.collections.slug, item.slug)).limit(1);
        if (existing.length === 0) {
          await db.insert(schema.collections).values({
            id: item.id,
            slug: item.slug,
            scope: 'curated',
            ownerUserId: null,
            name: item.name,
            subtitle: item.subtitle,
            description: null,
            icon: item.icon,
            coverImage: null,
            colorGradient: item.colorGradient,
            sortOrder: item.sortOrder,
            published: false,
            recipeIds: [],
          }).onConflictDoNothing();
          inserted++;
        }
      } catch (err: any) {
        console.warn(`[CURATED] Seed warning for ${item.slug}:`, err?.message || err);
      }
    }
    this.seededOnce = true;
    return { inserted, total: SEEDED_CURATED_COLLECTIONS.length };
  }

  private static async ensureSeeded(): Promise<void> {
    if (!this.seededOnce) {
      await this.seedCuratedCollections();
    }
  }

  // =========================================================================
  // OWNER BRANDING SETTINGS
  // =========================================================================
  public static async getOwnerSettings(): Promise<CuratedOwnerSettings> {
    await this.ensureTables();
    const db = getDb();
    if (!db) return { ...this.memSettings };
    try {
      const rows = await db.select().from(schema.curatedSettings).where(eq(schema.curatedSettings.id, 'default')).limit(1);
      if (rows.length > 0) {
        return {
          ownerName: rows[0].ownerName,
          ownerLogoText: rows[0].ownerLogoText,
          ownerBadgeEmoji: rows[0].ownerBadgeEmoji,
          updatedAt: rows[0].updatedAt.toISOString(),
        };
      }
    } catch {}
    return { ...this.memSettings };
  }

  public static async updateOwnerSettings(patch: Partial<CuratedOwnerSettings>): Promise<CuratedOwnerSettings> {
    await this.ensureTables();
    const current = await this.getOwnerSettings();
    const next: CuratedOwnerSettings = {
      ownerName: typeof patch.ownerName === 'string' && patch.ownerName.trim() ? patch.ownerName.trim().slice(0, 120) : current.ownerName,
      ownerLogoText: typeof patch.ownerLogoText === 'string' && patch.ownerLogoText.trim() ? patch.ownerLogoText.trim().slice(0, 120) : current.ownerLogoText,
      ownerBadgeEmoji: typeof patch.ownerBadgeEmoji === 'string' && patch.ownerBadgeEmoji.trim() ? patch.ownerBadgeEmoji.trim().slice(0, 16) : current.ownerBadgeEmoji,
      updatedAt: new Date().toISOString(),
    };
    this.memSettings = next;
    const db = getDb();
    if (db) {
      await db.insert(schema.curatedSettings).values({
        id: 'default',
        ownerName: next.ownerName,
        ownerLogoText: next.ownerLogoText,
        ownerBadgeEmoji: next.ownerBadgeEmoji,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: schema.curatedSettings.id,
        set: {
          ownerName: next.ownerName,
          ownerLogoText: next.ownerLogoText,
          ownerBadgeEmoji: next.ownerBadgeEmoji,
          updatedAt: new Date(),
        },
      });
    }
    return next;
  }

  // =========================================================================
  // CURATED RECIPES (CRUD, REORDER, PROMOTE, BULK IMPORT)
  // =========================================================================
  private static mapCuratedRow(row: any): CuratedRecipeRecord {
    return {
      id: row.id,
      slug: row.slug,
      recipePayload: row.recipePayload,
      coverImage: row.coverImage || row.recipePayload?.imageUrl || null,
      collectionIds: Array.isArray(row.collectionIds) ? row.collectionIds : [],
      tags: Array.isArray(row.tags) ? row.tags : (Array.isArray(row.recipePayload?.tags) ? row.recipePayload.tags : []),
      sortOrder: Number(row.sortOrder) || 0,
      published: Boolean(row.published),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || new Date().toISOString()),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt || new Date().toISOString()),
    };
  }

  public static async listCuratedRecipes(opts: { publishedOnly?: boolean } = {}): Promise<CuratedRecipeRecord[]> {
    await this.ensureTables();
    const db = getDb();
    let list: CuratedRecipeRecord[];
    if (!db) {
      list = Array.from(this.memCuratedRecipes.values());
      if (opts.publishedOnly) list = list.filter((r) => r.published);
      return list.sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
    }
    const rows = opts.publishedOnly
      ? await db.select().from(schema.curatedRecipes).where(eq(schema.curatedRecipes.published, true)).orderBy(asc(schema.curatedRecipes.sortOrder))
      : await db.select().from(schema.curatedRecipes).orderBy(asc(schema.curatedRecipes.sortOrder));
    return rows.map((r) => this.mapCuratedRow(r));
  }

  public static async getCuratedRecipeBySlug(slug: string, publishedOnly = true): Promise<CuratedRecipeRecord | null> {
    await this.ensureTables();
    const db = getDb();
    if (!db) {
      const found = Array.from(this.memCuratedRecipes.values()).find((r) => r.slug === slug || r.id === slug);
      if (!found || (publishedOnly && !found.published)) return null;
      return found;
    }
    const rows = await db.select().from(schema.curatedRecipes).where(eq(schema.curatedRecipes.slug, slug)).limit(1);
    if (rows.length === 0) return null;
    const mapped = this.mapCuratedRow(rows[0]);
    if (publishedOnly && !mapped.published) return null;
    return mapped;
  }

  public static async createCuratedRecipe(input: {
    recipePayload: any;
    slug?: string;
    coverImage?: string | null;
    collectionIds?: string[];
    tags?: string[];
    sortOrder?: number;
    published?: boolean;
  }): Promise<CuratedRecipeRecord> {
    await this.ensureTables();
    const parsed = StructuredRecipeSchema.safeParse(input.recipePayload);
    if (!parsed.success) {
      throw new Error(`Invalid recipe payload: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    const payload = parsed.data;
    const id = `cur_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const baseSlug = makeSlug(input.slug || payload.title, 'recipe');
    const existingAll = await this.listCuratedRecipes({ publishedOnly: false });
    const slugTaken = existingAll.some((r) => r.slug === baseSlug);
    const slug = slugTaken ? `${baseSlug}-${crypto.randomBytes(2).toString('hex')}` : baseSlug;
    const nowIso = new Date().toISOString();
    const record: CuratedRecipeRecord = {
      id,
      slug,
      recipePayload: { ...payload, id },
      coverImage: input.coverImage ?? payload.imageUrl ?? null,
      collectionIds: Array.isArray(input.collectionIds) ? Array.from(new Set(input.collectionIds)) : [],
      tags: Array.isArray(input.tags) ? Array.from(new Set(input.tags)) : (payload.tags || []),
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : existingAll.length + 1,
      published: Boolean(input.published),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const db = getDb();
    if (!db) {
      this.memCuratedRecipes.set(id, record);
      return record;
    }
    await db.insert(schema.curatedRecipes).values({
      id: record.id,
      slug: record.slug,
      recipePayload: record.recipePayload,
      coverImage: record.coverImage,
      collectionIds: record.collectionIds,
      tags: record.tags,
      sortOrder: record.sortOrder,
      published: record.published,
    });
    return record;
  }

  public static async updateCuratedRecipe(id: string, patch: Partial<{
    recipePayload: any;
    slug: string;
    coverImage: string | null;
    collectionIds: string[];
    tags: string[];
    sortOrder: number;
    published: boolean;
  }>): Promise<CuratedRecipeRecord | null> {
    await this.ensureTables();
    const db = getDb();
    const all = await this.listCuratedRecipes({ publishedOnly: false });
    const existing = all.find((r) => r.id === id);
    if (!existing) return null;

    let nextPayload = existing.recipePayload;
    if (patch.recipePayload) {
      const mergedPayload = { ...existing.recipePayload, ...patch.recipePayload, id: existing.id };
      const parsed = StructuredRecipeSchema.safeParse(mergedPayload);
      if (!parsed.success) {
        throw new Error(`Invalid recipe payload: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      nextPayload = parsed.data;
    }

    const updated: CuratedRecipeRecord = {
      ...existing,
      slug: typeof patch.slug === 'string' && patch.slug.trim() ? makeSlug(patch.slug, 'recipe') : existing.slug,
      recipePayload: nextPayload,
      coverImage: patch.coverImage !== undefined ? patch.coverImage : (nextPayload.imageUrl ?? existing.coverImage),
      collectionIds: Array.isArray(patch.collectionIds) ? Array.from(new Set(patch.collectionIds)) : existing.collectionIds,
      tags: Array.isArray(patch.tags) ? Array.from(new Set(patch.tags)) : (nextPayload.tags || existing.tags),
      sortOrder: typeof patch.sortOrder === 'number' ? patch.sortOrder : existing.sortOrder,
      published: typeof patch.published === 'boolean' ? patch.published : existing.published,
      updatedAt: new Date().toISOString(),
    };

    if (!db) {
      this.memCuratedRecipes.set(id, updated);
      return updated;
    }
    await db.update(schema.curatedRecipes).set({
      slug: updated.slug,
      recipePayload: updated.recipePayload,
      coverImage: updated.coverImage,
      collectionIds: updated.collectionIds,
      tags: updated.tags,
      sortOrder: updated.sortOrder,
      published: updated.published,
      updatedAt: new Date(),
    }).where(eq(schema.curatedRecipes.id, id));
    return updated;
  }

  public static async deleteCuratedRecipe(id: string): Promise<boolean> {
    await this.ensureTables();
    const db = getDb();
    if (!db) {
      return this.memCuratedRecipes.delete(id);
    }
    await db.delete(schema.curatedRecipes).where(eq(schema.curatedRecipes.id, id));
    return true;
  }

  public static async reorderCuratedRecipes(orderedIds: string[]): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!db) {
        const rec = this.memCuratedRecipes.get(id);
        if (rec) this.memCuratedRecipes.set(id, { ...rec, sortOrder: i + 1, updatedAt: new Date().toISOString() });
      } else {
        await db.update(schema.curatedRecipes).set({ sortOrder: i + 1, updatedAt: new Date() }).where(eq(schema.curatedRecipes.id, id));
      }
    }
  }

  public static async bulkImportCuratedRecipes(items: any[], dryRun = false): Promise<{
    validCount: number;
    errorCount: number;
    importedIds: string[];
    preview: Array<{ index: number; title: string; valid: boolean; error?: string }>;
  }> {
    const preview: Array<{ index: number; title: string; valid: boolean; error?: string }> = [];
    const validItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      const payload = raw?.recipePayload || raw;
      const parsed = StructuredRecipeSchema.safeParse(payload);
      if (!parsed.success) {
        preview.push({
          index: i + 1,
          title: String(payload?.title || `פריט #${i + 1}`),
          valid: false,
          error: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
        });
      } else {
        preview.push({ index: i + 1, title: parsed.data.title, valid: true });
        validItems.push({
          recipePayload: parsed.data,
          collectionIds: Array.isArray(raw?.collectionIds) ? raw.collectionIds : [],
          published: Boolean(raw?.published),
          coverImage: raw?.coverImage ?? parsed.data.imageUrl ?? null,
        });
      }
    }

    const importedIds: string[] = [];
    if (!dryRun) {
      for (const v of validItems) {
        const created = await this.createCuratedRecipe(v);
        importedIds.push(created.id);
      }
    }

    return {
      validCount: validItems.length,
      errorCount: preview.filter((p) => !p.valid).length,
      importedIds,
      preview,
    };
  }

  // =========================================================================
  // COLLECTIONS (CURATED & USER PERSONAL)
  // =========================================================================
  private static mapCollectionRow(row: any): CollectionRecord {
    return {
      id: row.id,
      slug: row.slug,
      scope: row.scope === 'user' ? 'user' : 'curated',
      ownerUserId: row.ownerUserId || null,
      name: row.name,
      subtitle: row.subtitle || null,
      description: row.description || null,
      icon: row.icon || '🍽️',
      coverImage: row.coverImage || null,
      colorGradient: row.colorGradient || 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
      sortOrder: Number(row.sortOrder) || 0,
      published: Boolean(row.published),
      recipeIds: Array.isArray(row.recipeIds) ? row.recipeIds : [],
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || new Date().toISOString()),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt || new Date().toISOString()),
    };
  }

  public static async listCuratedCollections(opts: { publishedOnly?: boolean } = {}): Promise<CollectionRecord[]> {
    await this.ensureSeeded();
    const db = getDb();
    let list: CollectionRecord[];
    if (!db) {
      list = Array.from(this.memCollections.values()).filter((c) => c.scope === 'curated');
      if (opts.publishedOnly) list = list.filter((c) => c.published);
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    } else {
      const rows = opts.publishedOnly
        ? await db.select().from(schema.collections)
          .where(and(eq(schema.collections.scope, 'curated'), eq(schema.collections.published, true)))
          .orderBy(asc(schema.collections.sortOrder))
        : await db.select().from(schema.collections)
          .where(eq(schema.collections.scope, 'curated'))
          .orderBy(asc(schema.collections.sortOrder));
      list = rows.map((r) => this.mapCollectionRow(r));
    }

    // Compute recipe counts from curated recipes (many-to-many via curatedRecipe.collectionIds)
    const recipes = await this.listCuratedRecipes({ publishedOnly: Boolean(opts.publishedOnly) });
    return list.map((c) => {
      const matching = recipes.filter((r) => r.collectionIds.includes(c.id));
      return {
        ...c,
        recipeIds: matching.map((r) => r.id),
        recipeCount: matching.length,
        coverImage: c.coverImage || matching[0]?.coverImage || null,
      };
    });
  }

  public static async getCuratedCollectionBySlug(slug: string, publishedOnly = true): Promise<{
    collection: CollectionRecord;
    recipes: CuratedRecipeRecord[];
  } | null> {
    const allCols = await this.listCuratedCollections({ publishedOnly });
    const col = allCols.find((c) => c.slug === slug || c.id === slug);
    if (!col) return null;
    const allRecipes = await this.listCuratedRecipes({ publishedOnly });
    const recipes = allRecipes.filter((r) => r.collectionIds.includes(col.id));
    return { collection: { ...col, recipeCount: recipes.length }, recipes };
  }

  public static async createCollection(input: {
    scope: 'curated' | 'user';
    ownerUserId?: string | null;
    name: string;
    subtitle?: string | null;
    description?: string | null;
    icon?: string;
    coverImage?: string | null;
    colorGradient?: string;
    sortOrder?: number;
    published?: boolean;
    recipeIds?: string[];
  }): Promise<CollectionRecord> {
    await this.ensureTables();
    const cleanName = String(input.name || '').trim().slice(0, 120);
    if (!cleanName) throw new Error('Collection name is required');

    const id = `${input.scope === 'curated' ? 'col_cur' : 'col_usr'}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const slug = `${makeSlug(cleanName, 'col')}-${crypto.randomBytes(2).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const record: CollectionRecord = {
      id,
      slug,
      scope: input.scope,
      ownerUserId: input.scope === 'user' ? (input.ownerUserId || null) : null,
      name: cleanName,
      subtitle: typeof input.subtitle === 'string' && input.subtitle.trim() ? input.subtitle.trim().slice(0, 80) : null,
      description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null,
      icon: typeof input.icon === 'string' && input.icon.trim() ? input.icon.trim().slice(0, 64) : '🍽️',
      coverImage: typeof input.coverImage === 'string' && input.coverImage.trim() ? input.coverImage.trim() : null,
      colorGradient: typeof input.colorGradient === 'string' && input.colorGradient.trim()
        ? input.colorGradient.trim().slice(0, 160)
        : 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 100,
      published: input.scope === 'user' ? true : Boolean(input.published),
      recipeIds: Array.isArray(input.recipeIds) ? Array.from(new Set(input.recipeIds)) : [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const db = getDb();
    if (!db) {
      this.memCollections.set(id, record);
      return record;
    }
    await db.insert(schema.collections).values({
      id: record.id,
      slug: record.slug,
      scope: record.scope,
      ownerUserId: record.ownerUserId,
      name: record.name,
      subtitle: record.subtitle,
      description: record.description,
      icon: record.icon,
      coverImage: record.coverImage,
      colorGradient: record.colorGradient,
      sortOrder: record.sortOrder,
      published: record.published,
      recipeIds: record.recipeIds,
    });
    return record;
  }

  public static async updateCollection(id: string, patch: Partial<{
    name: string;
    subtitle: string | null;
    description: string | null;
    icon: string;
    coverImage: string | null;
    colorGradient: string;
    sortOrder: number;
    published: boolean;
    recipeIds: string[];
  }>, ownerUserId?: string): Promise<CollectionRecord | null> {
    await this.ensureTables();
    const db = getDb();
    let existing: CollectionRecord | null = null;
    if (!db) {
      existing = this.memCollections.get(id) || null;
    } else {
      const rows = await db.select().from(schema.collections).where(eq(schema.collections.id, id)).limit(1);
      existing = rows.length > 0 ? this.mapCollectionRow(rows[0]) : null;
    }
    if (!existing) return null;
    if (ownerUserId && existing.scope === 'user' && existing.ownerUserId !== ownerUserId) {
      return null;
    }

    const updated: CollectionRecord = {
      ...existing,
      name: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim().slice(0, 120) : existing.name,
      subtitle: patch.subtitle !== undefined ? (typeof patch.subtitle === 'string' && patch.subtitle.trim() ? patch.subtitle.trim().slice(0, 80) : null) : existing.subtitle,
      description: patch.description !== undefined ? patch.description : existing.description,
      icon: typeof patch.icon === 'string' && patch.icon.trim() ? patch.icon.trim().slice(0, 64) : existing.icon,
      coverImage: patch.coverImage !== undefined ? patch.coverImage : existing.coverImage,
      colorGradient: typeof patch.colorGradient === 'string' && patch.colorGradient.trim() ? patch.colorGradient.trim().slice(0, 160) : existing.colorGradient,
      sortOrder: typeof patch.sortOrder === 'number' ? patch.sortOrder : existing.sortOrder,
      published: typeof patch.published === 'boolean' ? patch.published : existing.published,
      recipeIds: Array.isArray(patch.recipeIds) ? Array.from(new Set(patch.recipeIds)) : existing.recipeIds,
      updatedAt: new Date().toISOString(),
    };

    if (!db) {
      this.memCollections.set(id, updated);
    } else {
      await db.update(schema.collections).set({
        name: updated.name,
        subtitle: updated.subtitle,
        description: updated.description,
        icon: updated.icon,
        coverImage: updated.coverImage,
        colorGradient: updated.colorGradient,
        sortOrder: updated.sortOrder,
        published: updated.published,
        recipeIds: updated.recipeIds,
        updatedAt: new Date(),
      }).where(eq(schema.collections.id, id));
    }

    // If admin passed recipeIds for a curated collection, sync many-to-many membership on curated_recipes
    if (existing.scope === 'curated' && Array.isArray(patch.recipeIds)) {
      const targetSet = new Set(patch.recipeIds);
      const allCurated = await this.listCuratedRecipes({ publishedOnly: false });
      for (const rec of allCurated) {
        const has = rec.collectionIds.includes(id);
        const shouldHave = targetSet.has(rec.id);
        if (has !== shouldHave) {
          const nextIds = shouldHave
            ? [...rec.collectionIds, id]
            : rec.collectionIds.filter((cid) => cid !== id);
          await this.updateCuratedRecipe(rec.id, { collectionIds: nextIds });
        }
      }
    }

    return updated;
  }

  public static async deleteCollection(id: string, ownerUserId?: string): Promise<boolean> {
    await this.ensureTables();
    const db = getDb();
    let existing: CollectionRecord | null = null;
    if (!db) {
      existing = this.memCollections.get(id) || null;
      if (!existing) return false;
      if (ownerUserId && existing.scope === 'user' && existing.ownerUserId !== ownerUserId) return false;
      this.memCollections.delete(id);
    } else {
      const rows = await db.select().from(schema.collections).where(eq(schema.collections.id, id)).limit(1);
      existing = rows.length > 0 ? this.mapCollectionRow(rows[0]) : null;
      if (!existing) return false;
      if (ownerUserId && existing.scope === 'user' && existing.ownerUserId !== ownerUserId) return false;
      await db.delete(schema.collections).where(eq(schema.collections.id, id));
    }

    // Deleting a collection NEVER deletes recipes; remove collectionId reference from curated recipes
    if (existing.scope === 'curated') {
      const allCurated = await this.listCuratedRecipes({ publishedOnly: false });
      for (const rec of allCurated) {
        if (rec.collectionIds.includes(id)) {
          await this.updateCuratedRecipe(rec.id, {
            collectionIds: rec.collectionIds.filter((cid) => cid !== id),
          });
        }
      }
    }
    return true;
  }

  public static async reorderCollections(orderedIds: string[]): Promise<void> {
    await this.ensureTables();
    const db = getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!db) {
        const col = this.memCollections.get(id);
        if (col) this.memCollections.set(id, { ...col, sortOrder: i + 1, updatedAt: new Date().toISOString() });
      } else {
        await db.update(schema.collections).set({ sortOrder: i + 1, updatedAt: new Date() }).where(eq(schema.collections.id, id));
      }
    }
  }

  public static async publishAllCuratedCollections(): Promise<number> {
    await this.ensureSeeded();
    const db = getDb();
    if (!db) {
      let count = 0;
      for (const [id, col] of this.memCollections.entries()) {
        if (col.scope === 'curated' && !col.published) {
          this.memCollections.set(id, { ...col, published: true, updatedAt: new Date().toISOString() });
          count++;
        }
      }
      return count;
    }
    const all = await this.listCuratedCollections({ publishedOnly: false });
    let count = 0;
    for (const col of all) {
      if (!col.published) {
        await db.update(schema.collections).set({ published: true, updatedAt: new Date() }).where(eq(schema.collections.id, col.id));
        count++;
      }
    }
    return count;
  }

  public static async listUserCollections(userId: string): Promise<CollectionRecord[]> {
    await this.ensureTables();
    const db = getDb();
    if (!db) {
      return Array.from(this.memCollections.values())
        .filter((c) => c.scope === 'user' && c.ownerUserId === userId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    const rows = await db.select().from(schema.collections)
      .where(and(eq(schema.collections.scope, 'user'), eq(schema.collections.ownerUserId, userId)))
      .orderBy(asc(schema.collections.sortOrder));
    return rows.map((r) => this.mapCollectionRow(r));
  }

  // =========================================================================
  // USER PREFERENCES (VIEW MODE + CLOUD ONBOARDING FLAG)
  // =========================================================================
  public static async getUserPreferences(userId: string): Promise<UserPreferencesRecord> {
    await this.ensureTables();
    const fallback: UserPreferencesRecord = {
      userId,
      viewMode: 'collections',
      onboardingCompleted: false,
      onboardingStep: 0,
      updatedAt: new Date().toISOString(),
    };
    const db = getDb();
    if (!db) {
      return this.memUserPrefs.get(userId) || fallback;
    }
    try {
      const rows = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)).limit(1);
      if (rows.length > 0) {
        return {
          userId: rows[0].userId,
          viewMode: rows[0].viewMode === 'grid' ? 'grid' : 'collections',
          onboardingCompleted: Boolean(rows[0].onboardingCompleted),
          onboardingStep: Number(rows[0].onboardingStep) || 0,
          updatedAt: rows[0].updatedAt.toISOString(),
        };
      }
    } catch {}
    return fallback;
  }

  public static async updateUserPreferences(
    userId: string,
    patch: Partial<{ viewMode: 'collections' | 'grid'; onboardingCompleted: boolean; onboardingStep: number }>
  ): Promise<UserPreferencesRecord> {
    await this.ensureTables();
    const current = await this.getUserPreferences(userId);
    const next: UserPreferencesRecord = {
      userId,
      viewMode: patch.viewMode === 'grid' ? 'grid' : (patch.viewMode === 'collections' ? 'collections' : current.viewMode),
      onboardingCompleted: typeof patch.onboardingCompleted === 'boolean' ? patch.onboardingCompleted : current.onboardingCompleted,
      onboardingStep: typeof patch.onboardingStep === 'number' ? Math.max(0, Math.min(20, patch.onboardingStep)) : current.onboardingStep,
      updatedAt: new Date().toISOString(),
    };
    this.memUserPrefs.set(userId, next);
    const db = getDb();
    if (db) {
      await db.insert(schema.userPreferences).values({
        userId: next.userId,
        viewMode: next.viewMode,
        onboardingCompleted: next.onboardingCompleted,
        onboardingStep: next.onboardingStep,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: schema.userPreferences.userId,
        set: {
          viewMode: next.viewMode,
          onboardingCompleted: next.onboardingCompleted,
          onboardingStep: next.onboardingStep,
          updatedAt: new Date(),
        },
      });
    }
    return next;
  }
}
