import { pgTable, varchar, text, boolean, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  isPro: boolean('is_pro').default(false).notNull(),
  proTier: varchar('pro_tier', { length: 50 }).default('free').notNull(),
  proExpiresAt: timestamp('pro_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const recipes = pgTable('recipes', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  sourceUrl: text('source_url'),
  platform: varchar('platform', { length: 50 }).notNull(),
  category: varchar('category', { length: 100 }).default('כללי').notNull(),
  imageUrl: text('image_url'),
  servings: integer('servings').default(4),
  prepTimeMinutes: integer('prep_time_minutes'),
  cookTimeMinutes: integer('cook_time_minutes'),
  totalTimeMinutes: integer('total_time_minutes'),
  difficulty: varchar('difficulty', { length: 50 }),
  nutrition: jsonb('nutrition'),
  ingredients: jsonb('ingredients').notNull(),
  instructions: jsonb('instructions').notNull(),
  tags: jsonb('tags').notNull().default([]),
  isBookmarked: boolean('is_bookmarked').default(false).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('recipes_user_id_idx').on(table.userId),
  sourceUrlIdx: index('recipes_source_url_idx').on(table.sourceUrl),
}));

export const usageLimits = pgTable('usage_limits', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  periodYearMonth: varchar('period_year_month', { length: 7 }).notNull(), // e.g. "2026-11"
  extractionsCount: integer('extractions_count').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userPeriodUniqueIdx: uniqueIndex('usage_user_period_idx').on(table.userId, table.periodYearMonth),
  userIdIdx: index('usage_limits_user_id_idx').on(table.userId),
}));

export const globalRecipesCache = pgTable('global_recipes_cache', {
  id: varchar('id', { length: 128 }).primaryKey(),
  normalizedUrl: text('normalized_url').notNull().unique(),
  recipeData: jsonb('recipe_data').notNull(),
  hitCount: integer('hit_count').default(1).notNull(),
  lastHitAt: timestamp('last_hit_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  normalizedUrlUniqueIdx: uniqueIndex('global_cache_url_unique_idx').on(table.normalizedUrl),
}));

export const promoCodes = pgTable('promo_codes', {
  id: varchar('id', { length: 128 }).primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  discountType: varchar('discount_type', { length: 50 }).default('lifetime_pro').notNull(),
  maxUses: integer('max_uses'), // null = unlimited
  usedCount: integer('used_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex('promo_code_idx').on(table.code),
}));

export const vipEmails = pgTable('vip_emails', {
  id: varchar('id', { length: 128 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  tier: varchar('tier', { length: 50 }).default('family_vip').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('vip_email_idx').on(table.email),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbRecipe = typeof recipes.$inferSelect;
export type NewDbRecipe = typeof recipes.$inferInsert;
export type UsageLimit = typeof usageLimits.$inferSelect;
export type GlobalRecipeCache = typeof globalRecipesCache.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type NewPromoCode = typeof promoCodes.$inferInsert;
export type VipEmail = typeof vipEmails.$inferSelect;
export type NewVipEmail = typeof vipEmails.$inferInsert;



