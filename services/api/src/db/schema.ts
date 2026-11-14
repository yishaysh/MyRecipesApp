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

export const userEntitlements = pgTable('user_entitlements', {
  userId: varchar('user_id', { length: 128 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  plan: varchar('plan', { length: 32 }).notNull().default('free'), // 'free' | 'pro_monthly' | 'pro_yearly' | 'pro_vip'
  status: varchar('status', { length: 32 }).notNull().default('expired'), // 'active' | 'canceled' | 'expired'
  source: varchar('source', { length: 32 }).notNull().default('billing'), // 'billing' | 'vip'
  provider: varchar('provider', { length: 32 }).default('cardcom'), // 'cardcom' | 'payplus' | 'test' | 'vip'
  providerRecurringId: varchar('provider_recurring_id', { length: 255 }),
  renewsAt: timestamp('renews_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const billingEvents = pgTable('billing_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  provider: varchar('provider', { length: 32 }).notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 128 }),
  plan: varchar('plan', { length: 32 }),
  providerRecurringId: varchar('provider_recurring_id', { length: 255 }),
  status: varchar('status', { length: 32 }).notNull(),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_billing_events_user_id').on(table.userId),
}));

// --- Growth Engine Phase A: Sharing & Attribution ---

export const shareLinks = pgTable('share_links', {
  id: varchar('id', { length: 128 }).primaryKey(),
  ownerUserId: varchar('owner_user_id', { length: 128 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'recipe' | 'book'
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 32 }).default('active').notNull(), // 'active' | 'revoked'
  snapshotVersion: integer('snapshot_version').default(1).notNull(),
  currentSnapshotId: varchar('current_snapshot_id', { length: 128 }).notNull(),
  sourceRecipeId: varchar('source_recipe_id', { length: 128 }),
  ogConsent: boolean('og_consent').default(false).notNull(),
  sharerDisplayName: varchar('sharer_display_name', { length: 255 }),
  bookTitle: text('book_title'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
}, (table) => ({
  tokenHashIdx: uniqueIndex('share_links_token_hash_idx').on(table.tokenHash),
  ownerIdx: index('share_links_owner_user_idx').on(table.ownerUserId),
  sourceRecipeIdx: index('share_links_source_recipe_idx').on(table.sourceRecipeId),
}));

export const shareSnapshots = pgTable('share_snapshots', {
  id: varchar('id', { length: 128 }).primaryKey(),
  shareId: varchar('share_id', { length: 128 }).references(() => shareLinks.id, { onDelete: 'cascade' }).notNull(),
  snapshotVersion: integer('snapshot_version').default(1).notNull(),
  payload: jsonb('payload').notNull(),
  recipeCount: integer('recipe_count').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  shareVersionIdx: index('share_snapshots_share_version_idx').on(table.shareId, table.snapshotVersion),
}));

export const savedRecipeOrigins = pgTable('saved_recipe_origins', {
  id: varchar('id', { length: 128 }).primaryKey(),
  recipientUserId: varchar('recipient_user_id', { length: 128 }).notNull(),
  savedRecipeId: varchar('saved_recipe_id', { length: 128 }).notNull(),
  sourceShareId: varchar('source_share_id', { length: 128 }).notNull(),
  sourceSnapshotId: varchar('source_snapshot_id', { length: 128 }).notNull(),
  sourceSnapshotVersion: integer('source_snapshot_version').notNull(),
  sourceRecipeId: varchar('source_recipe_id', { length: 128 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  recipientOriginIdx: index('saved_origins_recipient_share_recipe_idx').on(table.recipientUserId, table.sourceShareId, table.sourceRecipeId),
}));

export const shareReports = pgTable('share_reports', {
  id: varchar('id', { length: 128 }).primaryKey(),
  shareId: varchar('share_id', { length: 128 }).notNull(),
  reason: varchar('reason', { length: 128 }).notNull(),
  details: text('details'),
  reporterIpHash: varchar('reporter_ip_hash', { length: 128 }),
  status: varchar('status', { length: 32 }).default('open').notNull(), // 'open' | 'resolved' | 'dismissed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  shareIdx: index('share_reports_share_id_idx').on(table.shareId),
}));

export const analyticsEvents = pgTable('analytics_events', {
  id: varchar('id', { length: 128 }).primaryKey(),
  eventName: varchar('event_name', { length: 64 }).notNull(),
  opaqueUserId: varchar('opaque_user_id', { length: 128 }),
  shareId: varchar('share_id', { length: 128 }),
  snapshotVersion: integer('snapshot_version'),
  merchantId: varchar('merchant_id', { length: 64 }),
  clickId: varchar('click_id', { length: 128 }),
  metadata: jsonb('metadata').notNull().default({}),
  isBot: boolean('is_bot').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  eventCreatedIdx: index('analytics_events_name_created_idx').on(table.eventName, table.createdAt),
}));

// --- Growth Engine Phase B: Merchants & Affiliate Foundation ---

export const merchants = pgTable('merchants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 32 }).default('disabled').notNull(), // 'disabled' | 'referral_only' | 'affiliate_active'
  killSwitch: boolean('kill_switch').default(false).notNull(),
  displayOrder: integer('display_order').default(1).notNull(),
  searchUrlTemplate: text('search_url_template').notNull(),
  allowedDomains: jsonb('allowed_domains').notNull().default([]),
  utmTemplate: jsonb('utm_template').notNull().default({}),
  maxItemsPerLink: integer('max_items_per_link').default(1).notNull(),
  commercialAgreement: jsonb('commercial_agreement'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const merchantSampleChecks = pgTable('merchant_sample_checks', {
  id: varchar('id', { length: 128 }).primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 }).references(() => merchants.id, { onDelete: 'cascade' }).notNull(),
  testedQueries: jsonb('tested_queries').notNull(),
  sampleUrls: jsonb('sample_urls').notNull(),
  verifiedBy: varchar('verified_by', { length: 128 }).notNull(),
  notes: text('notes'),
  passed: boolean('passed').default(false).notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
});

export const merchantAuditLogs = pgTable('merchant_audit_logs', {
  id: varchar('id', { length: 128 }).primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  actor: varchar('actor', { length: 128 }).notNull(),
  previousState: jsonb('previous_state').notNull(),
  nextState: jsonb('next_state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ingredientMappings = pgTable('ingredient_mappings', {
  id: varchar('id', { length: 128 }).primaryKey(),
  normalizedName: varchar('normalized_name', { length: 255 }).notNull(),
  merchantId: varchar('merchant_id', { length: 64 }).references(() => merchants.id, { onDelete: 'cascade' }).notNull(),
  sku: varchar('sku', { length: 128 }).notNull(),
  productName: text('product_name').notNull(),
  productUrl: text('product_url').notNull(),
  active: boolean('active').default(true).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameMerchantIdx: index('ingredient_mappings_name_merchant_idx').on(table.normalizedName, table.merchantId),
}));

export const affiliateClickTokens = pgTable('affiliate_click_tokens', {
  token: varchar('token', { length: 128 }).primaryKey(),
  merchantId: varchar('merchant_id', { length: 64 }).notNull(),
  normalizedQuery: text('normalized_query').notNull(),
  destinationUrl: text('destination_url').notNull(),
  shareId: varchar('share_id', { length: 128 }),
  recipeId: varchar('recipe_id', { length: 128 }),
  disclosureMode: varchar('disclosure_mode', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversionLedger = pgTable('conversion_ledger', {
  id: varchar('id', { length: 128 }).primaryKey(),
  partner: varchar('partner', { length: 64 }).notNull(),
  orderId: varchar('order_id', { length: 128 }).notNull(),
  clickId: varchar('click_id', { length: 128 }).notNull(),
  status: varchar('status', { length: 64 }).notNull(),
  replayKey: varchar('replay_key', { length: 255 }).notNull().unique(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type UserEntitlementRow = typeof userEntitlements.$inferSelect;
export type NewUserEntitlementRow = typeof userEntitlements.$inferInsert;
export type BillingEventRow = typeof billingEvents.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbRecipe = typeof recipes.$inferSelect;
export type NewDbRecipe = typeof recipes.$inferInsert;
export type UsageLimit = typeof usageLimits.$inferSelect;
export type GlobalRecipeCache = typeof globalRecipesCache.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type NewPromoCode = typeof promoCodes.$inferInsert;
export type VipEmail = typeof vipEmails.$inferSelect;
export type NewVipEmail = typeof vipEmails.$inferInsert;



