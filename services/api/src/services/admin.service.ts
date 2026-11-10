import { eq, desc, sql, count } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { ExtractorService } from './extractor.service.js';
import { LlmParserService } from './llm-parser.service.js';
import { SyncService } from './sync.service.js';
import crypto from 'crypto';

export interface AdminStats {
  totalUsers: number;
  proUsers: number;
  totalRecipes: number;
  cacheHits: number;
  activePromoCodes: number;
  vipEmailsCount: number;
}

export class AdminService {
  private static tablesInitialized = false;

  /**
   * Verify admin master password
   */
  public static verifyAdminPassword(password: string): boolean {
    if (!password || typeof password !== 'string') return false;
    const configuredPassword = process.env.ADMIN_PASSWORD || 'ChefAdmin2026!';
    return password.trim() === configuredPassword.trim();
  }

  /**
   * Ensure admin tables exist in Neon DB and seed default codes if needed
   */
  public static async ensureAdminTables(): Promise<void> {
    if (this.tablesInitialized) return;
    const db = getDb();
    if (!db) return;

    try {
      // Create promo_codes table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS promo_codes (
          id VARCHAR(128) PRIMARY KEY,
          code VARCHAR(64) NOT NULL UNIQUE,
          discount_type VARCHAR(50) NOT NULL DEFAULT 'lifetime_pro',
          max_uses INTEGER,
          used_count INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create vip_emails table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vip_emails (
          id VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          tier VARCHAR(50) NOT NULL DEFAULT 'family_vip',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Seed default promo codes if table is empty
      const existingCodes = await db.select({ count: count() }).from(schema.promoCodes);
      if (Number(existingCodes[0]?.count || 0) === 0) {
        const defaultCodes = ['FAMILY2026', 'CHEFVIP', 'MYRECIPESVIP'];
        for (const code of defaultCodes) {
          await db.insert(schema.promoCodes).values({
            id: `promo_${crypto.randomUUID()}`,
            code,
            discountType: 'lifetime_pro',
            maxUses: null,
            usedCount: 0,
            isActive: true,
            notes: 'Default system promo code',
          }).onConflictDoNothing();
        }
      }

      this.tablesInitialized = true;
    } catch (err) {
      console.error('[AdminService] Table auto-migration notice:', err);
    }
  }

  /**
   * Get System Overview Stats
   */
  public static async getSystemStats(): Promise<AdminStats> {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) {
      return {
        totalUsers: 0,
        proUsers: 0,
        totalRecipes: 0,
        cacheHits: 0,
        activePromoCodes: 3,
        vipEmailsCount: 0,
      };
    }

    try {
      const [uCount] = await db.select({ count: count() }).from(schema.users);
      const [proCount] = await db.select({ count: count() }).from(schema.users).where(eq(schema.users.isPro, true));
      const [rCount] = await db.select({ count: count() }).from(schema.recipes);
      const [cacheCount] = await db.select({ count: count() }).from(schema.globalRecipesCache);
      const [promoCount] = await db.select({ count: count() }).from(schema.promoCodes).where(eq(schema.promoCodes.isActive, true));
      const [vipCount] = await db.select({ count: count() }).from(schema.vipEmails);

      return {
        totalUsers: Number(uCount?.count || 0),
        proUsers: Number(proCount?.count || 0),
        totalRecipes: Number(rCount?.count || 0),
        cacheHits: Number(cacheCount?.count || 0),
        activePromoCodes: Number(promoCount?.count || 0),
        vipEmailsCount: Number(vipCount?.count || 0),
      };
    } catch (err) {
      console.error('[AdminService] Failed to fetch stats:', err);
      return {
        totalUsers: 0,
        proUsers: 0,
        totalRecipes: 0,
        cacheHits: 0,
        activePromoCodes: 0,
        vipEmailsCount: 0,
      };
    }
  }

  /**
   * List all Promo Codes
   */
  public static async listPromoCodes() {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) return [];
    try {
      return await db.select().from(schema.promoCodes).orderBy(desc(schema.promoCodes.createdAt));
    } catch (err) {
      console.error('[AdminService] Error listing promo codes:', err);
      return [];
    }
  }

  /**
   * Create or update a Promo Code
   */
  public static async createPromoCode(code: string, discountType = 'lifetime_pro', maxUses?: number, notes?: string) {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) throw new Error('Database is offline');

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) throw new Error('Code cannot be empty');

    const newId = `promo_${crypto.randomUUID()}`;
    await db.insert(schema.promoCodes).values({
      id: newId,
      code: cleanCode,
      discountType,
      maxUses: maxUses || null,
      usedCount: 0,
      isActive: true,
      notes: notes || null,
    }).onConflictDoUpdate({
      target: schema.promoCodes.code,
      set: {
        isActive: true,
        discountType,
        maxUses: maxUses || null,
        notes: notes || null,
        updatedAt: new Date(),
      }
    });

    return { success: true, code: cleanCode };
  }

  /**
   * Toggle Promo Code Active state
   */
  public static async togglePromoCode(code: string, isActive: boolean) {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) throw new Error('Database is offline');

    await db.update(schema.promoCodes)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schema.promoCodes.code, code.trim().toUpperCase()));

    return { success: true };
  }

  /**
   * Delete Promo Code
   */
  public static async deletePromoCode(code: string) {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) throw new Error('Database is offline');

    await db.delete(schema.promoCodes)
      .where(eq(schema.promoCodes.code, code.trim().toUpperCase()));

    return { success: true };
  }

  /**
   * List VIP Emails
   */
  public static async listVipEmails() {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) return [];
    try {
      return await db.select().from(schema.vipEmails).orderBy(desc(schema.vipEmails.createdAt));
    } catch (err) {
      console.error('[AdminService] Error listing VIP emails:', err);
      return [];
    }
  }

  /**
   * Add a VIP Email
   */
  public static async addVipEmail(email: string, tier = 'family_vip', notes?: string) {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) throw new Error('Database is offline');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('כתובת אימייל לא חוקית');

    const newId = `vip_${crypto.randomUUID()}`;
    await db.insert(schema.vipEmails).values({
      id: newId,
      email: cleanEmail,
      tier,
      notes: notes || null,
    }).onConflictDoUpdate({
      target: schema.vipEmails.email,
      set: {
        tier,
        notes: notes || null,
        updatedAt: new Date(),
      }
    });

    // Also upgrade user if already in users table
    try {
      await db.update(schema.users)
        .set({ isPro: true, proTier: tier, updatedAt: new Date() })
        .where(eq(schema.users.email, cleanEmail));
    } catch (e) {}

    return { success: true, email: cleanEmail };
  }

  /**
   * Delete VIP Email
   */
  public static async deleteVipEmail(email: string) {
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) throw new Error('Database is offline');

    await db.delete(schema.vipEmails)
      .where(eq(schema.vipEmails.email, email.trim().toLowerCase()));

    return { success: true };
  }

  /**
   * Check if an email is VIP (checks Neon DB + process.env.VIP_EMAILS)
   */
  public static async isEmailVip(email: string): Promise<boolean> {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check process.env.VIP_EMAILS
    const envVips = (process.env.VIP_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    if (envVips.includes(cleanEmail)) return true;

    // 2. Check Neon DB
    await this.ensureAdminTables();
    const db = getDb();
    if (!db) return false;

    try {
      const rows = await db.select().from(schema.vipEmails).where(eq(schema.vipEmails.email, cleanEmail)).limit(1);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if a promo code is valid (checks Neon DB + default codes)
   */
  public static async isPromoCodeValid(code: string): Promise<{ valid: boolean; discountType: string }> {
    if (!code) return { valid: false, discountType: 'free' };
    const cleanCode = code.trim().toUpperCase();

    // 1. Check Neon DB
    await this.ensureAdminTables();
    const db = getDb();
    if (db) {
      try {
        const rows = await db.select().from(schema.promoCodes).where(eq(schema.promoCodes.code, cleanCode)).limit(1);
        if (rows.length > 0) {
          const promo = rows[0];
          if (!promo.isActive) return { valid: false, discountType: 'free' };
          if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
            return { valid: false, discountType: 'free' };
          }
          return { valid: true, discountType: promo.discountType };
        }
      } catch (e) {
        console.error('[AdminService] Error checking DB promo code:', e);
      }
    }

    // 2. Fallback to default codes
    const defaultCodes = (process.env.PROMO_CODES || 'FAMILY2026,CHEFVIP,MYRECIPESVIP')
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);

    if (defaultCodes.includes(cleanCode)) {
      return { valid: true, discountType: 'lifetime_pro' };
    }

    return { valid: false, discountType: 'free' };
  }

  /**
   * Increment promo code usage
   */
  public static async recordPromoCodeUse(code: string): Promise<void> {
    const cleanCode = code.trim().toUpperCase();
    const db = getDb();
    if (!db) return;
    try {
      await db.update(schema.promoCodes)
        .set({
          usedCount: sql`${schema.promoCodes.usedCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(schema.promoCodes.code, cleanCode));
    } catch (e) {}
  }

  /**
   * List recent registered users
   */
  public static async listUsers(limit = 50) {
    const db = getDb();
    if (!db) return [];
    try {
      return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).limit(limit);
    } catch {
      return [];
    }
  }

  /**
   * Manually toggle user Pro status
   */
  public static async toggleUserPro(userId: string, isPro: boolean, proTier = 'lifetime_pro') {
    const db = getDb();
    if (!db) throw new Error('Database is offline');

    await db.update(schema.users)
      .set({
        isPro,
        proTier: isPro ? proTier : 'free',
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId));

    return { success: true };
  }

  /**
   * Publish a new viral trending recipe to the Discover tab from Admin
   */
  public static async publishTrendingRecipe(rawUrl: string): Promise<any> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('נא להזין קישור תקין לסרטון');
    }

    const normalizedUrl = SyncService.normalizeSocialUrl(rawUrl);
    const extractor = new ExtractorService();
    const parser = new LlmParserService();

    const rawContent = await extractor.extractRawContent(normalizedUrl);
    const recipes = await parser.parseToRecipes(rawContent);

    if (!recipes || recipes.length === 0) {
      throw new Error('לא הצלחנו לחלץ מתכון מהסרטון שצוין. ודא שהסרטון פתוח לצפייה ציבורית');
    }

    const primaryRecipe = recipes[0];
    const db = getDb();

    if (db) {
      await db.insert(schema.globalRecipesCache).values({
        id: `trend_admin_${Date.now()}`,
        normalizedUrl,
        recipeData: { recipes, primary: primaryRecipe },
        hitCount: 25, // High priority to show at top of Discover tab
      }).onConflictDoUpdate({
        target: schema.globalRecipesCache.normalizedUrl,
        set: {
          recipeData: { recipes, primary: primaryRecipe },
          hitCount: sql`${schema.globalRecipesCache.hitCount} + 25`,
          lastHitAt: new Date(),
        }
      });
    }

    return { success: true, recipe: primaryRecipe };
  }
}

