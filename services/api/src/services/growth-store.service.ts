import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, isDbConnected } from '../db/index.js';
import {
  affiliateClickTokens,
  analyticsEvents,
  conversionLedger,
  ingredientMappings,
  merchantAuditLogs,
  merchantSampleChecks,
  merchants,
  savedRecipeOrigins,
  shareLinks,
  shareReports,
  shareSnapshots,
} from '../db/schema.js';

export type ShareType = 'recipe' | 'book';
export type ShareStatus = 'active' | 'revoked';
export type MerchantStatus = 'disabled' | 'referral_only' | 'affiliate_active';

export interface PublicShareIngredient {
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  group?: string | null;
  category?: string | null;
  qtySource?: string | null;
  qtyMode?: string | null;
}

export interface PublicShareInstruction {
  stepNumber: number;
  instruction: string;
  durationMinutes?: number | null;
  tip?: string | null;
}

export interface PublicShareRecipe {
  id: string;
  title: string;
  description?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  difficulty?: string | null;
  category: string;
  tags: string[];
  platform: string;
  sourceUrl?: string | null;
  sourceCredit?: string | null;
  imageUrl?: string | null;
  ingredients: PublicShareIngredient[];
  instructions: PublicShareInstruction[];
}

export interface ShareSnapshotPayload {
  bookTitle?: string | null;
  sharerDisplayName?: string | null;
  recipes: PublicShareRecipe[];
}

export interface ShareLinkRecord {
  id: string;
  ownerUserId: string;
  type: ShareType;
  tokenHash: string;
  status: ShareStatus;
  snapshotVersion: number;
  currentSnapshotId: string;
  sourceRecipeId: string | null;
  ogConsent: boolean;
  sharerDisplayName: string | null;
  bookTitle: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
}

export interface ShareSnapshotRecord {
  id: string;
  shareId: string;
  snapshotVersion: number;
  payload: ShareSnapshotPayload;
  recipeCount: number;
  createdAt: string;
}

export interface SavedRecipeOriginRecord {
  id: string;
  recipientUserId: string;
  savedRecipeId: string;
  sourceShareId: string;
  sourceSnapshotId: string;
  sourceSnapshotVersion: number;
  sourceRecipeId: string;
  idempotencyKey: string | null;
  savedAt: string;
}

export interface ShareReportRecord {
  id: string;
  shareId: string;
  reason: string;
  details: string | null;
  reporterIpHash: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
}

export interface AnalyticsEventRecord {
  id: string;
  eventName: string;
  opaqueUserId: string | null;
  shareId: string | null;
  snapshotVersion: number | null;
  merchantId: string | null;
  clickId: string | null;
  metadata: Record<string, unknown>;
  isBot: boolean;
  createdAt: string;
}

export interface CommercialAgreement {
  agreementId: string;
  commissionType: string;
  attributionWindow: string;
  publisherId: string;
  campaignId: string;
  disclosureText: string;
  approvedTrafficSources: string[] | string;
  approver: string;
}

export interface MerchantRecord {
  id: string;
  displayName: string;
  status: MerchantStatus;
  killSwitch: boolean;
  displayOrder: number;
  searchUrlTemplate: string;
  allowedDomains: string[];
  utmTemplate: Record<string, string>;
  maxItemsPerLink: number;
  commercialAgreement: CommercialAgreement | null;
  updatedAt: string;
}

export interface MerchantSampleCheckRecord {
  id: string;
  merchantId: string;
  testedQueries: string[];
  sampleUrls: string[];
  verifiedBy: string;
  notes: string | null;
  passed: boolean;
  checkedAt: string;
}

export interface MerchantAuditLogRecord {
  id: string;
  merchantId: string;
  action: string;
  actor: string;
  previousState: Record<string, unknown>;
  nextState: Record<string, unknown>;
  createdAt: string;
}

export interface IngredientMappingRecord {
  id: string;
  normalizedName: string;
  merchantId: string;
  sku: string;
  productName: string;
  productUrl: string;
  active: boolean;
  verifiedAt: string;
  updatedAt: string;
}

export interface AffiliateClickTokenRecord {
  token: string;
  merchantId: string;
  normalizedQuery: string;
  destinationUrl: string;
  shareId: string | null;
  recipeId: string | null;
  disclosureMode: string;
  createdAt: string;
}

export const DEFAULT_REFERRAL_DISCLOSURE_TEXT = 'קישור לחנות, ללא שותפות מסחרית פעילה';

export const DEFAULT_MERCHANTS: MerchantRecord[] = [
  {
    id: 'shufersal',
    displayName: 'שופרסל אונליין',
    status: 'disabled',
    killSwitch: false,
    displayOrder: 1,
    searchUrlTemplate: 'https://www.shufersal.co.il/online/he/search?text={q}',
    allowedDomains: ['www.shufersal.co.il', 'shufersal.co.il'],
    utmTemplate: { utm_source: 'my_recipes_app', utm_campaign: 'ingredients_pilot', utm_content: 'recipe_cta' },
    maxItemsPerLink: 1,
    commercialAgreement: null,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'rami_levy',
    displayName: 'רמי לוי באינטרנט',
    status: 'disabled',
    killSwitch: false,
    displayOrder: 2,
    searchUrlTemplate: 'https://www.rami-levy.co.il/he/online/search?q={q}',
    allowedDomains: ['www.rami-levy.co.il', 'rami-levy.co.il'],
    utmTemplate: { utm_source: 'my_recipes_app', utm_campaign: 'ingredients_pilot', utm_content: 'recipe_cta' },
    maxItemsPerLink: 1,
    commercialAgreement: null,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'carrefour',
    displayName: 'קרפור ישראל',
    status: 'disabled',
    killSwitch: false,
    displayOrder: 3,
    searchUrlTemplate: 'https://www.carrefour.co.il/search/{q}',
    allowedDomains: ['www.carrefour.co.il', 'carrefour.co.il'],
    utmTemplate: { utm_source: 'my_recipes_app', utm_campaign: 'ingredients_pilot', utm_content: 'recipe_cta' },
    maxItemsPerLink: 1,
    commercialAgreement: null,
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'ybitan',
    displayName: 'ביתן אונליין',
    status: 'disabled',
    killSwitch: false,
    displayOrder: 4,
    searchUrlTemplate: 'https://www.ybitan.co.il/search/{q}',
    allowedDomains: ['www.ybitan.co.il', 'ybitan.co.il'],
    utmTemplate: { utm_source: 'my_recipes_app', utm_campaign: 'ingredients_pilot', utm_content: 'recipe_cta' },
    maxItemsPerLink: 1,
    commercialAgreement: null,
    updatedAt: new Date(0).toISOString(),
  },
];

// Test / local-dev state (strictly forbidden on Vercel production when DATABASE_URL is absent)
const memShareLinks = new Map<string, ShareLinkRecord>();
const memTokenHashIndex = new Map<string, string>();
const memShareSnapshots = new Map<string, ShareSnapshotRecord>();
const memSavedOrigins: SavedRecipeOriginRecord[] = [];
const memShareReports: ShareReportRecord[] = [];
const memAnalyticsEvents: AnalyticsEventRecord[] = [];
const memMerchants = new Map<string, MerchantRecord>();
const memSampleChecks: MerchantSampleCheckRecord[] = [];
const memAuditLogs: MerchantAuditLogRecord[] = [];
const memIngredientMappings: IngredientMappingRecord[] = [];
const memClickTokens = new Map<string, AffiliateClickTokenRecord>();
const memConversionReplayKeys = new Set<string>();

let tablesEnsured = false;
let ensureTablesPromise: Promise<void> | null = null;
let runtimeGlobalReferralKillSwitch = false;
let forceAnalyticsFailureForTests = false;

export class GrowthStoreError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function generateRawShareToken(): string {
  // 24 bytes = 192 bits of cryptographic entropy (> 128-bit requirement)
  return crypto.randomBytes(24).toString('base64url');
}

export function hashShareToken(rawToken: string): string {
  return crypto.createHash('sha256').update(String(rawToken || '').trim()).digest('hex');
}

export function opaqueAnalyticsId(rawId?: string | null): string | null {
  if (!rawId) return null;
  return crypto.createHash('sha256').update(String(rawId)).digest('hex').slice(0, 24);
}

const BOT_UA_PATTERN =
  /(WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|Googlebot|bingbot|YandexBot|Applebot|HeadlessChrome|Preview|crawler|spider|curl\/|wget\/)/i;

export function isBotOrPreviewUserAgent(userAgent?: string | string[] | null): boolean {
  const ua = Array.isArray(userAgent) ? userAgent.join(' ') : String(userAgent || '');
  if (!ua.trim()) return false;
  return BOT_UA_PATTERN.test(ua);
}

export function isSharingEnabled(): boolean {
  const raw = String(process.env.SHARING_ENABLED ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false';
}

export function isReferralsEnabled(): boolean {
  if (runtimeGlobalReferralKillSwitch) return false;
  const raw = String(process.env.REFERRALS_ENABLED ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false';
}

export function getShareMaxBookRecipes(): number {
  const parsed = Number.parseInt(String(process.env.SHARE_MAX_BOOK_RECIPES ?? '100'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export function sanitizeRecipeForSnapshot(raw: any): PublicShareRecipe {
  const ingredients: PublicShareIngredient[] = Array.isArray(raw?.ingredients)
    ? raw.ingredients.map((ing: any) => ({
        name: String(ing?.name || '').trim(),
        ...(ing?.amount !== undefined && ing?.amount !== null ? { amount: ing.amount } : {}),
        ...(ing?.unit ? { unit: String(ing.unit) } : {}),
        ...(ing?.group ? { group: String(ing.group) } : {}),
        ...(ing?.category ? { category: String(ing.category) } : {}),
        ...(ing?.qtySource ? { qtySource: String(ing.qtySource) } : {}),
        ...(ing?.qtyMode ? { qtyMode: String(ing.qtyMode) } : {}),
      }))
    : [];

  const instructions: PublicShareInstruction[] = Array.isArray(raw?.instructions)
    ? raw.instructions.map((step: any, idx: number) => ({
        stepNumber: Number(step?.stepNumber || idx + 1),
        instruction: String(step?.instruction || ''),
        ...(typeof step?.durationMinutes === 'number' ? { durationMinutes: step.durationMinutes } : {}),
        ...(step?.tip ? { tip: String(step.tip) } : {}),
      }))
    : [];

  let safeSourceUrl: string | null = null;
  if (typeof raw?.sourceUrl === 'string' && raw.sourceUrl.trim()) {
    try {
      const parsed = new URL(raw.sourceUrl.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        safeSourceUrl = parsed.toString();
      }
    } catch {
      safeSourceUrl = null;
    }
  }

  let safeImageUrl: string | null = null;
  if (typeof raw?.imageUrl === 'string' && raw.imageUrl.trim()) {
    try {
      const parsed = new URL(raw.imageUrl.trim());
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        safeImageUrl = parsed.toString();
      }
    } catch {
      safeImageUrl = null;
    }
  }

  const tags = Array.isArray(raw?.tags)
    ? raw.tags
        .map((t: any) => String(t || '').trim())
        .filter((t: string) => t.length > 0 && t.length <= 50)
    : [];

  return {
    id: String(raw?.id || crypto.randomUUID()),
    title: String(raw?.title || 'מתכון ללא שם').trim(),
    description: typeof raw?.description === 'string' ? raw.description : null,
    servings: typeof raw?.servings === 'number' ? raw.servings : 4,
    prepTimeMinutes: typeof raw?.prepTimeMinutes === 'number' ? raw.prepTimeMinutes : null,
    cookTimeMinutes: typeof raw?.cookTimeMinutes === 'number' ? raw.cookTimeMinutes : null,
    totalTimeMinutes: typeof raw?.totalTimeMinutes === 'number' ? raw.totalTimeMinutes : null,
    difficulty: typeof raw?.difficulty === 'string' ? raw.difficulty : null,
    category: String(raw?.category || 'כללי'),
    tags,
    platform: String(raw?.platform || 'other'),
    sourceUrl: safeSourceUrl,
    sourceCredit: typeof raw?.sourceCredit === 'string' ? raw.sourceCredit : safeSourceUrl,
    imageUrl: safeImageUrl,
    ingredients,
    instructions,
  };
}

export function hasCompleteCommercialAgreement(agreement: any): agreement is CommercialAgreement {
  if (!agreement || typeof agreement !== 'object') return false;
  const requiredStrings = [
    'agreementId',
    'commissionType',
    'attributionWindow',
    'publisherId',
    'campaignId',
    'disclosureText',
    'approver',
  ];
  for (const key of requiredStrings) {
    if (typeof agreement[key] !== 'string' || agreement[key].trim().length === 0) {
      return false;
    }
  }
  const sources = agreement.approvedTrafficSources;
  if (Array.isArray(sources)) {
    return sources.some((s) => typeof s === 'string' && s.trim().length > 0);
  }
  return typeof sources === 'string' && sources.trim().length > 0;
}

export function buildMerchantSearchUrl(merchant: MerchantRecord, rawQuery: string): string {
  const cleanQuery = String(rawQuery || '').trim().slice(0, 120);
  if (!cleanQuery) {
    throw new GrowthStoreError(400, 'EMPTY_QUERY', 'יש להזין שם מצרך לחיפוש בחנות');
  }
  const encodedQuery = encodeURIComponent(cleanQuery);
  const baseStr = merchant.searchUrlTemplate.replace('{q}', encodedQuery);
  const url = new URL(baseStr);

  if (url.protocol !== 'https:' || !merchant.allowedDomains.includes(url.hostname)) {
    throw new GrowthStoreError(400, 'DISALLOWED_DOMAIN', 'כתובת החנות אינה תואמת לרשימת הדומיינים המורשים');
  }

  const utmSource = process.env.UTM_SOURCE || merchant.utmTemplate?.utm_source || 'my_recipes_app';
  const utmCampaign = process.env.UTM_CAMPAIGN || merchant.utmTemplate?.utm_campaign || 'ingredients_pilot';
  const utmContent = process.env.UTM_CONTENT || merchant.utmTemplate?.utm_content || 'recipe_cta';

  url.searchParams.set('utm_source', utmSource);
  url.searchParams.set('utm_campaign', utmCampaign);
  url.searchParams.set('utm_content', utmContent);

  return url.toString();
}

export function isDomainAllowedForMerchant(merchant: MerchantRecord, candidateUrl: string): boolean {
  try {
    const parsed = new URL(candidateUrl);
    return parsed.protocol === 'https:' && merchant.allowedDomains.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function assertPersistenceAvailable(): void {
  if (!isDbConnected() && process.env.VERCEL === '1') {
    throw new GrowthStoreError(
      503,
      'GROWTH_DB_NOT_CONFIGURED',
      'שיתוף וקישורי חנויות דורשים חיבור פעיל למסד הנתונים בפרודקשן'
    );
  }
}

function seedMemoryMerchants(): void {
  for (const m of DEFAULT_MERCHANTS) {
    if (!memMerchants.has(m.id)) {
      memMerchants.set(m.id, { ...m, allowedDomains: [...m.allowedDomains], utmTemplate: { ...m.utmTemplate } });
    }
  }
}

// Neon HTTP uses the Postgres extended query protocol and rejects multiple SQL statements per execute() call.
const GROWTH_DDL_STATEMENTS = [
  sql`
    CREATE TABLE IF NOT EXISTS share_links (
      id VARCHAR(128) PRIMARY KEY,
      owner_user_id VARCHAR(128) NOT NULL,
      type VARCHAR(32) NOT NULL,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      snapshot_version INTEGER NOT NULL DEFAULT 1,
      current_snapshot_id VARCHAR(128) NOT NULL,
      source_recipe_id VARCHAR(128),
      og_consent BOOLEAN NOT NULL DEFAULT FALSE,
      sharer_display_name VARCHAR(255),
      book_title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      last_viewed_at TIMESTAMPTZ
    )
  `,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS share_links_token_hash_idx ON share_links(token_hash)`,
  sql`CREATE INDEX IF NOT EXISTS share_links_owner_user_idx ON share_links(owner_user_id)`,
  sql`CREATE INDEX IF NOT EXISTS share_links_source_recipe_idx ON share_links(source_recipe_id)`,
  sql`
    CREATE TABLE IF NOT EXISTS share_snapshots (
      id VARCHAR(128) PRIMARY KEY,
      share_id VARCHAR(128) NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
      snapshot_version INTEGER NOT NULL DEFAULT 1,
      payload JSONB NOT NULL,
      recipe_count INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`CREATE INDEX IF NOT EXISTS share_snapshots_share_version_idx ON share_snapshots(share_id, snapshot_version)`,
  sql`
    CREATE TABLE IF NOT EXISTS saved_recipe_origins (
      id VARCHAR(128) PRIMARY KEY,
      recipient_user_id VARCHAR(128) NOT NULL,
      saved_recipe_id VARCHAR(128) NOT NULL,
      source_share_id VARCHAR(128) NOT NULL,
      source_snapshot_id VARCHAR(128) NOT NULL,
      source_snapshot_version INTEGER NOT NULL,
      source_recipe_id VARCHAR(128) NOT NULL,
      idempotency_key VARCHAR(255),
      saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`
    CREATE INDEX IF NOT EXISTS saved_origins_recipient_share_recipe_idx
      ON saved_recipe_origins(recipient_user_id, source_share_id, source_recipe_id)
  `,
  sql`
    CREATE TABLE IF NOT EXISTS share_reports (
      id VARCHAR(128) PRIMARY KEY,
      share_id VARCHAR(128) NOT NULL,
      reason VARCHAR(128) NOT NULL,
      details TEXT,
      reporter_ip_hash VARCHAR(128),
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id VARCHAR(128) PRIMARY KEY,
      event_name VARCHAR(64) NOT NULL,
      opaque_user_id VARCHAR(128),
      share_id VARCHAR(128),
      snapshot_version INTEGER,
      merchant_id VARCHAR(64),
      click_id VARCHAR(128),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_bot BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx ON analytics_events(event_name, created_at)`,
  sql`
    CREATE TABLE IF NOT EXISTS merchants (
      id VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'disabled',
      kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INTEGER NOT NULL DEFAULT 1,
      search_url_template TEXT NOT NULL,
      allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
      utm_template JSONB NOT NULL DEFAULT '{}'::jsonb,
      max_items_per_link INTEGER NOT NULL DEFAULT 1,
      commercial_agreement JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS merchant_sample_checks (
      id VARCHAR(128) PRIMARY KEY,
      merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      tested_queries JSONB NOT NULL,
      sample_urls JSONB NOT NULL,
      verified_by VARCHAR(128) NOT NULL,
      notes TEXT,
      passed BOOLEAN NOT NULL DEFAULT FALSE,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS merchant_audit_logs (
      id VARCHAR(128) PRIMARY KEY,
      merchant_id VARCHAR(64) NOT NULL,
      action VARCHAR(64) NOT NULL,
      actor VARCHAR(128) NOT NULL,
      previous_state JSONB NOT NULL,
      next_state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS ingredient_mappings (
      id VARCHAR(128) PRIMARY KEY,
      normalized_name VARCHAR(255) NOT NULL,
      merchant_id VARCHAR(64) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      sku VARCHAR(128) NOT NULL,
      product_name TEXT NOT NULL,
      product_url TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS affiliate_click_tokens (
      token VARCHAR(128) PRIMARY KEY,
      merchant_id VARCHAR(64) NOT NULL,
      normalized_query TEXT NOT NULL,
      destination_url TEXT NOT NULL,
      share_id VARCHAR(128),
      recipe_id VARCHAR(128),
      disclosure_mode VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  sql`
    CREATE TABLE IF NOT EXISTS conversion_ledger (
      id VARCHAR(128) PRIMARY KEY,
      partner VARCHAR(64) NOT NULL,
      order_id VARCHAR(128) NOT NULL,
      click_id VARCHAR(128) NOT NULL,
      status VARCHAR(64) NOT NULL,
      replay_key VARCHAR(255) NOT NULL UNIQUE,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
];

async function ensureDbReady(): Promise<ReturnType<typeof getDb>> {
  assertPersistenceAvailable();
  const db = getDb();
  if (!db) {
    seedMemoryMerchants();
    return null;
  }
  if (!tablesEnsured) {
    if (!ensureTablesPromise) {
      ensureTablesPromise = (async () => {
        for (const statement of GROWTH_DDL_STATEMENTS) {
          await db.execute(statement);
        }

        for (const m of DEFAULT_MERCHANTS) {
          await db
            .insert(merchants)
            .values({
              id: m.id,
              displayName: m.displayName,
              status: m.status,
              killSwitch: m.killSwitch,
              displayOrder: m.displayOrder,
              searchUrlTemplate: m.searchUrlTemplate,
              allowedDomains: m.allowedDomains,
              utmTemplate: m.utmTemplate,
              maxItemsPerLink: m.maxItemsPerLink,
              commercialAgreement: null,
            })
            .onConflictDoNothing({ target: merchants.id });
        }
        tablesEnsured = true;
      })().finally(() => {
        ensureTablesPromise = null;
      });
    }
    await ensureTablesPromise;
  }
  return db;
}

function mapDbShareLink(row: typeof shareLinks.$inferSelect): ShareLinkRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    type: row.type === 'book' ? 'book' : 'recipe',
    tokenHash: row.tokenHash,
    status: row.status === 'revoked' ? 'revoked' : 'active',
    snapshotVersion: row.snapshotVersion,
    currentSnapshotId: row.currentSnapshotId,
    sourceRecipeId: row.sourceRecipeId ?? null,
    ogConsent: Boolean(row.ogConsent),
    sharerDisplayName: row.sharerDisplayName ?? null,
    bookTitle: row.bookTitle ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    lastViewedAt: row.lastViewedAt ? row.lastViewedAt.toISOString() : null,
  };
}

function mapDbMerchant(row: typeof merchants.$inferSelect): MerchantRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    status: (row.status as MerchantStatus) || 'disabled',
    killSwitch: Boolean(row.killSwitch),
    displayOrder: row.displayOrder,
    searchUrlTemplate: row.searchUrlTemplate,
    allowedDomains: Array.isArray(row.allowedDomains) ? (row.allowedDomains as string[]) : [],
    utmTemplate: (row.utmTemplate as Record<string, string>) || {},
    maxItemsPerLink: row.maxItemsPerLink,
    commercialAgreement: (row.commercialAgreement as CommercialAgreement | null) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class GrowthStoreService {
  static resetForTests(): void {
    memShareLinks.clear();
    memTokenHashIndex.clear();
    memShareSnapshots.clear();
    memSavedOrigins.length = 0;
    memShareReports.length = 0;
    memAnalyticsEvents.length = 0;
    memMerchants.clear();
    memSampleChecks.length = 0;
    memAuditLogs.length = 0;
    memIngredientMappings.length = 0;
    memClickTokens.clear();
    memConversionReplayKeys.clear();
    runtimeGlobalReferralKillSwitch = false;
    forceAnalyticsFailureForTests = false;
    tablesEnsured = false;
    ensureTablesPromise = null;
    seedMemoryMerchants();
  }

  static setForceAnalyticsFailureForTests(val: boolean): void {
    forceAnalyticsFailureForTests = val;
  }

  static setRuntimeGlobalKillSwitch(disabled: boolean): void {
    runtimeGlobalReferralKillSwitch = disabled;
  }

  static getRuntimeGlobalKillSwitch(): boolean {
    return runtimeGlobalReferralKillSwitch;
  }

  static async createOrUpdateShare(input: {
    ownerUserId: string;
    type: ShareType;
    recipes: any[];
    shareIdToUpdate?: string;
    ogConsent?: boolean;
    sharerDisplayName?: string | null;
    bookTitle?: string | null;
  }): Promise<{ share: ShareLinkRecord; snapshot: ShareSnapshotRecord; rawToken?: string; updated: boolean }> {
    const db = await ensureDbReady();
    const sanitizedRecipes = input.recipes.map(sanitizeRecipeForSnapshot);
    if (sanitizedRecipes.length === 0) {
      throw new GrowthStoreError(400, 'EMPTY_SHARE', 'יש לבחור לפחות מתכון אחד לשיתוף');
    }

    const maxBook = getShareMaxBookRecipes();
    if (input.type === 'book' && sanitizedRecipes.length > maxBook) {
      throw new GrowthStoreError(
        400,
        'BOOK_LIMIT_EXCEEDED',
        `ניתן לשתף עד ${maxBook} מתכונים בספר משותף אחד. אנא בחרו עד ${maxBook} מתכונים.`
      );
    }

    const now = new Date();
    const cleanSharerName =
      typeof input.sharerDisplayName === 'string' && input.sharerDisplayName.trim()
        ? input.sharerDisplayName.trim().slice(0, 80)
        : null;
    const cleanBookTitle =
      typeof input.bookTitle === 'string' && input.bookTitle.trim()
        ? input.bookTitle.trim().slice(0, 120)
        : null;

    const payload: ShareSnapshotPayload = {
      bookTitle: cleanBookTitle,
      sharerDisplayName: cleanSharerName,
      recipes: sanitizedRecipes,
    };

    if (input.shareIdToUpdate) {
      const existing = await this.getShareById(input.shareIdToUpdate);
      if (!existing || existing.ownerUserId !== input.ownerUserId) {
        throw new GrowthStoreError(404, 'SHARE_NOT_FOUND', 'קישור השיתוף לא נמצא');
      }
      if (existing.status === 'revoked') {
        throw new GrowthStoreError(400, 'SHARE_REVOKED', 'לא ניתן לעדכן שיתוף שבוטל; יש ליצור קישור חדש');
      }

      const nextVersion = existing.snapshotVersion + 1;
      const snapshotId = crypto.randomUUID();
      const snapshot: ShareSnapshotRecord = {
        id: snapshotId,
        shareId: existing.id,
        snapshotVersion: nextVersion,
        payload,
        recipeCount: sanitizedRecipes.length,
        createdAt: now.toISOString(),
      };

      const nextOgConsent = input.ogConsent ?? existing.ogConsent;

      if (db) {
        await db.insert(shareSnapshots).values({
          id: snapshot.id,
          shareId: snapshot.shareId,
          snapshotVersion: snapshot.snapshotVersion,
          payload: snapshot.payload,
          recipeCount: snapshot.recipeCount,
          createdAt: now,
        });
        await db
          .update(shareLinks)
          .set({
            snapshotVersion: nextVersion,
            currentSnapshotId: snapshotId,
            ogConsent: nextOgConsent,
            sharerDisplayName: cleanSharerName ?? existing.sharerDisplayName,
            bookTitle: cleanBookTitle ?? existing.bookTitle,
            updatedAt: now,
          })
          .where(eq(shareLinks.id, existing.id));
      } else {
        memShareSnapshots.set(snapshot.id, snapshot);
        memShareLinks.set(existing.id, {
          ...existing,
          snapshotVersion: nextVersion,
          currentSnapshotId: snapshotId,
          ogConsent: nextOgConsent,
          sharerDisplayName: cleanSharerName ?? existing.sharerDisplayName,
          bookTitle: cleanBookTitle ?? existing.bookTitle,
          updatedAt: now.toISOString(),
        });
      }

      const updatedShare = (await this.getShareById(existing.id))!;
      return { share: updatedShare, snapshot, updated: true };
    }

    const rawToken = generateRawShareToken();
    const tokenHash = hashShareToken(rawToken);
    const shareId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const sourceRecipeId = input.type === 'recipe' ? sanitizedRecipes[0].id : null;

    const share: ShareLinkRecord = {
      id: shareId,
      ownerUserId: input.ownerUserId,
      type: input.type,
      tokenHash,
      status: 'active',
      snapshotVersion: 1,
      currentSnapshotId: snapshotId,
      sourceRecipeId,
      ogConsent: Boolean(input.ogConsent),
      sharerDisplayName: cleanSharerName,
      bookTitle: cleanBookTitle,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      revokedAt: null,
      lastViewedAt: null,
    };

    const snapshot: ShareSnapshotRecord = {
      id: snapshotId,
      shareId,
      snapshotVersion: 1,
      payload,
      recipeCount: sanitizedRecipes.length,
      createdAt: now.toISOString(),
    };

    if (db) {
      await db.insert(shareLinks).values({
        id: share.id,
        ownerUserId: share.ownerUserId,
        type: share.type,
        tokenHash: share.tokenHash,
        status: share.status,
        snapshotVersion: share.snapshotVersion,
        currentSnapshotId: share.currentSnapshotId,
        sourceRecipeId: share.sourceRecipeId,
        ogConsent: share.ogConsent,
        sharerDisplayName: share.sharerDisplayName,
        bookTitle: share.bookTitle,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(shareSnapshots).values({
        id: snapshot.id,
        shareId: snapshot.shareId,
        snapshotVersion: snapshot.snapshotVersion,
        payload: snapshot.payload,
        recipeCount: snapshot.recipeCount,
        createdAt: now,
      });
    } else {
      memShareLinks.set(share.id, share);
      memTokenHashIndex.set(tokenHash, share.id);
      memShareSnapshots.set(snapshot.id, snapshot);
    }

    return { share, snapshot, rawToken, updated: false };
  }

  static async getShareById(shareId: string): Promise<ShareLinkRecord | null> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db.select().from(shareLinks).where(eq(shareLinks.id, shareId)).limit(1);
      return rows[0] ? mapDbShareLink(rows[0]) : null;
    }
    return memShareLinks.get(shareId) ?? null;
  }

  static async getShareByRawToken(rawToken: string): Promise<{ share: ShareLinkRecord; snapshot: ShareSnapshotRecord } | null> {
    const db = await ensureDbReady();
    const tokenHash = hashShareToken(rawToken);
    if (db) {
      const links = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash)).limit(1);
      const link = links[0];
      if (!link) return null;
      const snaps = await db
        .select()
        .from(shareSnapshots)
        .where(eq(shareSnapshots.id, link.currentSnapshotId))
        .limit(1);
      const snap = snaps[0];
      if (!snap) return null;
      return {
        share: mapDbShareLink(link),
        snapshot: {
          id: snap.id,
          shareId: snap.shareId,
          snapshotVersion: snap.snapshotVersion,
          payload: snap.payload as ShareSnapshotPayload,
          recipeCount: snap.recipeCount,
          createdAt: snap.createdAt.toISOString(),
        },
      };
    }

    const shareId = memTokenHashIndex.get(tokenHash);
    if (!shareId) return null;
    const share = memShareLinks.get(shareId);
    if (!share) return null;
    const snapshot = memShareSnapshots.get(share.currentSnapshotId);
    if (!snapshot) return null;
    return { share, snapshot };
  }

  static async listSharesForOwner(ownerUserId: string): Promise<Array<ShareLinkRecord & { recipeCount: number; titleSummary: string }>> {
    const db = await ensureDbReady();
    if (db) {
      const links = await db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.ownerUserId, ownerUserId))
        .orderBy(desc(shareLinks.createdAt));

      const results: Array<ShareLinkRecord & { recipeCount: number; titleSummary: string }> = [];
      for (const link of links) {
        const snapRows = await db
          .select()
          .from(shareSnapshots)
          .where(eq(shareSnapshots.id, link.currentSnapshotId))
          .limit(1);
        const snap = snapRows[0];
        const payload = (snap?.payload as ShareSnapshotPayload | undefined) || { recipes: [] };
        const count = snap?.recipeCount ?? payload.recipes.length;
        const summary =
          link.type === 'book'
            ? link.bookTitle || `ספר מתכונים (${count})`
            : payload.recipes[0]?.title || 'מתכון משותף';
        results.push({ ...mapDbShareLink(link), recipeCount: count, titleSummary: summary });
      }
      return results;
    }

    return Array.from(memShareLinks.values())
      .filter((s) => s.ownerUserId === ownerUserId)
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .map((s) => {
        const snap = memShareSnapshots.get(s.currentSnapshotId);
        const count = snap?.recipeCount ?? 0;
        const summary =
          s.type === 'book'
            ? s.bookTitle || `ספר מתכונים (${count})`
            : snap?.payload.recipes[0]?.title || 'מתכון משותף';
        return { ...s, recipeCount: count, titleSummary: summary };
      });
  }

  static async revokeShare(shareId: string, ownerUserId?: string): Promise<ShareLinkRecord | null> {
    const db = await ensureDbReady();
    const existing = await this.getShareById(shareId);
    if (!existing) return null;
    if (ownerUserId && existing.ownerUserId !== ownerUserId) {
      throw new GrowthStoreError(403, 'FORBIDDEN', 'אין הרשאה לבטל שיתוף זה');
    }
    const now = new Date();
    if (db) {
      await db
        .update(shareLinks)
        .set({ status: 'revoked', revokedAt: now, updatedAt: now })
        .where(eq(shareLinks.id, shareId));
      return this.getShareById(shareId);
    }
    const updated: ShareLinkRecord = {
      ...existing,
      status: 'revoked',
      revokedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    memShareLinks.set(shareId, updated);
    return updated;
  }

  static async revokeSharesForDeletedRecipe(ownerUserId: string, sourceRecipeId: string): Promise<number> {
    const db = await ensureDbReady();
    const now = new Date();
    if (db) {
      const affected = await db
        .select({ id: shareLinks.id })
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.ownerUserId, ownerUserId),
            eq(shareLinks.type, 'recipe'),
            eq(shareLinks.sourceRecipeId, sourceRecipeId),
            eq(shareLinks.status, 'active')
          )
        );
      if (affected.length > 0) {
        await db
          .update(shareLinks)
          .set({ status: 'revoked', revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(shareLinks.ownerUserId, ownerUserId),
              eq(shareLinks.type, 'recipe'),
              eq(shareLinks.sourceRecipeId, sourceRecipeId),
              eq(shareLinks.status, 'active')
            )
          );
      }
      return affected.length;
    }

    let count = 0;
    for (const [id, link] of memShareLinks.entries()) {
      if (
        link.ownerUserId === ownerUserId &&
        link.type === 'recipe' &&
        link.sourceRecipeId === sourceRecipeId &&
        link.status === 'active'
      ) {
        memShareLinks.set(id, { ...link, status: 'revoked', revokedAt: now.toISOString(), updatedAt: now.toISOString() });
        count++;
      }
    }
    return count;
  }

  static async markShareViewed(shareId: string): Promise<void> {
    const db = await ensureDbReady();
    const now = new Date();
    if (db) {
      await db.update(shareLinks).set({ lastViewedAt: now }).where(eq(shareLinks.id, shareId));
    } else {
      const existing = memShareLinks.get(shareId);
      if (existing) {
        memShareLinks.set(shareId, { ...existing, lastViewedAt: now.toISOString() });
      }
    }
  }

  static async findSavedOrigin(
    recipientUserId: string,
    sourceShareId: string,
    sourceRecipeId: string,
    idempotencyKey?: string | null
  ): Promise<SavedRecipeOriginRecord | null> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db
        .select()
        .from(savedRecipeOrigins)
        .where(
          and(
            eq(savedRecipeOrigins.recipientUserId, recipientUserId),
            eq(savedRecipeOrigins.sourceShareId, sourceShareId),
            eq(savedRecipeOrigins.sourceRecipeId, sourceRecipeId)
          )
        )
        .limit(1);
      if (rows[0]) {
        return {
          ...rows[0],
          idempotencyKey: rows[0].idempotencyKey ?? null,
          savedAt: rows[0].savedAt.toISOString(),
        };
      }
      if (idempotencyKey) {
        const idemRows = await db
          .select()
          .from(savedRecipeOrigins)
          .where(
            and(
              eq(savedRecipeOrigins.recipientUserId, recipientUserId),
              eq(savedRecipeOrigins.sourceShareId, sourceShareId),
              eq(savedRecipeOrigins.idempotencyKey, idempotencyKey)
            )
          )
          .limit(1);
        if (idemRows[0]) {
          return {
            ...idemRows[0],
            idempotencyKey: idemRows[0].idempotencyKey ?? null,
            savedAt: idemRows[0].savedAt.toISOString(),
          };
        }
      }
      return null;
    }

    return (
      memSavedOrigins.find(
        (o) =>
          o.recipientUserId === recipientUserId &&
          o.sourceShareId === sourceShareId &&
          (o.sourceRecipeId === sourceRecipeId || (idempotencyKey && o.idempotencyKey === idempotencyKey))
      ) ?? null
    );
  }

  static async recordSavedOrigin(input: Omit<SavedRecipeOriginRecord, 'id' | 'savedAt'>): Promise<SavedRecipeOriginRecord> {
    const db = await ensureDbReady();
    const now = new Date();
    const rec: SavedRecipeOriginRecord = {
      id: crypto.randomUUID(),
      ...input,
      savedAt: now.toISOString(),
    };
    if (db) {
      await db.insert(savedRecipeOrigins).values({
        id: rec.id,
        recipientUserId: rec.recipientUserId,
        savedRecipeId: rec.savedRecipeId,
        sourceShareId: rec.sourceShareId,
        sourceSnapshotId: rec.sourceSnapshotId,
        sourceSnapshotVersion: rec.sourceSnapshotVersion,
        sourceRecipeId: rec.sourceRecipeId,
        idempotencyKey: rec.idempotencyKey,
        savedAt: now,
      });
    } else {
      memSavedOrigins.push(rec);
    }
    return rec;
  }

  static async createShareReport(input: {
    shareId: string;
    reason: string;
    details?: string | null;
    reporterIp?: string | null;
  }): Promise<ShareReportRecord> {
    const db = await ensureDbReady();
    const now = new Date();
    const rec: ShareReportRecord = {
      id: crypto.randomUUID(),
      shareId: input.shareId,
      reason: String(input.reason || 'other').slice(0, 120),
      details: input.details ? String(input.details).slice(0, 1000) : null,
      reporterIpHash: input.reporterIp ? opaqueAnalyticsId(input.reporterIp) : null,
      status: 'open',
      createdAt: now.toISOString(),
      resolvedAt: null,
    };
    if (db) {
      await db.insert(shareReports).values({
        id: rec.id,
        shareId: rec.shareId,
        reason: rec.reason,
        details: rec.details,
        reporterIpHash: rec.reporterIpHash,
        status: rec.status,
        createdAt: now,
      });
    } else {
      memShareReports.push(rec);
    }
    return rec;
  }

  static async listShareReports(): Promise<ShareReportRecord[]> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db.select().from(shareReports).orderBy(desc(shareReports.createdAt));
      return rows.map((r) => ({
        id: r.id,
        shareId: r.shareId,
        reason: r.reason,
        details: r.details ?? null,
        reporterIpHash: r.reporterIpHash ?? null,
        status: (r.status as ShareReportRecord['status']) || 'open',
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      }));
    }
    return [...memShareReports].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }

  static async resolveShareReport(reportId: string, action: 'revoke' | 'dismiss'): Promise<ShareReportRecord | null> {
    const db = await ensureDbReady();
    const now = new Date();
    const reports = await this.listShareReports();
    const target = reports.find((r) => r.id === reportId);
    if (!target) return null;

    if (action === 'revoke') {
      await this.revokeShare(target.shareId);
    }
    const nextStatus: ShareReportRecord['status'] = action === 'revoke' ? 'resolved' : 'dismissed';

    if (db) {
      await db
        .update(shareReports)
        .set({ status: nextStatus, resolvedAt: now })
        .where(eq(shareReports.id, reportId));
    } else {
      target.status = nextStatus;
      target.resolvedAt = now.toISOString();
    }
    return { ...target, status: nextStatus, resolvedAt: now.toISOString() };
  }

  static async recordAnalyticsEvent(input: {
    eventName: string;
    opaqueUserId?: string | null;
    shareId?: string | null;
    snapshotVersion?: number | null;
    merchantId?: string | null;
    clickId?: string | null;
    metadata?: Record<string, unknown>;
    isBot?: boolean;
  }): Promise<AnalyticsEventRecord> {
    if (forceAnalyticsFailureForTests) {
      throw new Error('Injected analytics failure for test');
    }
    const db = await ensureDbReady();
    const now = new Date();
    const rec: AnalyticsEventRecord = {
      id: crypto.randomUUID(),
      eventName: input.eventName,
      opaqueUserId: input.opaqueUserId ?? null,
      shareId: input.shareId ?? null,
      snapshotVersion: input.snapshotVersion ?? null,
      merchantId: input.merchantId ?? null,
      clickId: input.clickId ?? null,
      metadata: input.metadata ?? {},
      isBot: Boolean(input.isBot),
      createdAt: now.toISOString(),
    };
    if (db) {
      await db.insert(analyticsEvents).values({
        id: rec.id,
        eventName: rec.eventName,
        opaqueUserId: rec.opaqueUserId,
        shareId: rec.shareId,
        snapshotVersion: rec.snapshotVersion,
        merchantId: rec.merchantId,
        clickId: rec.clickId,
        metadata: rec.metadata,
        isBot: rec.isBot,
        createdAt: now,
      });
    } else {
      memAnalyticsEvents.push(rec);
    }
    return rec;
  }

  static async listAnalyticsEvents(limit = 500): Promise<AnalyticsEventRecord[]> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db
        .select()
        .from(analyticsEvents)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        eventName: r.eventName,
        opaqueUserId: r.opaqueUserId ?? null,
        shareId: r.shareId ?? null,
        snapshotVersion: r.snapshotVersion ?? null,
        merchantId: r.merchantId ?? null,
        clickId: r.clickId ?? null,
        metadata: (r.metadata as Record<string, unknown>) || {},
        isBot: Boolean(r.isBot),
        createdAt: r.createdAt.toISOString(),
      }));
    }
    return [...memAnalyticsEvents]
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  // --- Phase B: Merchant Registry, Sample Checks, Audit Logs & SKU Mappings ---

  static async listMerchants(): Promise<MerchantRecord[]> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db.select().from(merchants);
      return rows.map(mapDbMerchant).sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return Array.from(memMerchants.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  static async getMerchantById(merchantId: string): Promise<MerchantRecord | null> {
    const list = await this.listMerchants();
    return list.find((m) => m.id === merchantId) ?? null;
  }

  static async recordSampleCheck(input: {
    merchantId: string;
    testedQueries: string[];
    verifiedBy: string;
    notes?: string | null;
  }): Promise<MerchantSampleCheckRecord> {
    const db = await ensureDbReady();
    const merchant = await this.getMerchantById(input.merchantId);
    if (!merchant) {
      throw new GrowthStoreError(404, 'MERCHANT_NOT_FOUND', 'החנות לא נמצאה');
    }

    // Require at least 3 distinct real Hebrew ingredient names (not just a single word like "קמח")
    const distinctQueries = Array.from(
      new Set(
        (input.testedQueries || [])
          .map((q) => String(q || '').trim())
          .filter((q) => q.length >= 2 && /[\u0590-\u05FF]/.test(q))
      )
    );
    if (distinctQueries.length < 3) {
      throw new GrowthStoreError(
        400,
        'SAMPLE_CHECK_REQUIRES_3_HEBREW_INGREDIENTS',
        'בדיקת קישור לדוגמה חייבת לכלול לפחות 3 שמות מצרכים שונים בעברית (למשל: שמן זית, חלב 3%, עגבניות שרי)'
      );
    }

    const sampleUrls = distinctQueries.map((q) => buildMerchantSearchUrl(merchant, q));
    const now = new Date();
    const record: MerchantSampleCheckRecord = {
      id: crypto.randomUUID(),
      merchantId: merchant.id,
      testedQueries: distinctQueries,
      sampleUrls,
      verifiedBy: input.verifiedBy,
      notes: input.notes ?? null,
      passed: true,
      checkedAt: now.toISOString(),
    };

    if (db) {
      await db.insert(merchantSampleChecks).values({
        id: record.id,
        merchantId: record.merchantId,
        testedQueries: record.testedQueries,
        sampleUrls: record.sampleUrls,
        verifiedBy: record.verifiedBy,
        notes: record.notes,
        passed: true,
        checkedAt: now,
      });
    } else {
      memSampleChecks.push(record);
    }

    await this.writeMerchantAuditLog({
      merchantId: merchant.id,
      action: 'sample_check_recorded',
      actor: input.verifiedBy,
      previousState: { status: merchant.status },
      nextState: { sampleCheckId: record.id, testedQueries: distinctQueries, sampleUrls },
    });

    return record;
  }

  static async listSampleChecks(merchantId?: string): Promise<MerchantSampleCheckRecord[]> {
    const db = await ensureDbReady();
    if (db) {
      const rows = merchantId
        ? await db
            .select()
            .from(merchantSampleChecks)
            .where(eq(merchantSampleChecks.merchantId, merchantId))
            .orderBy(desc(merchantSampleChecks.checkedAt))
        : await db.select().from(merchantSampleChecks).orderBy(desc(merchantSampleChecks.checkedAt));
      return rows.map((r) => ({
        id: r.id,
        merchantId: r.merchantId,
        testedQueries: (r.testedQueries as string[]) || [],
        sampleUrls: (r.sampleUrls as string[]) || [],
        verifiedBy: r.verifiedBy,
        notes: r.notes ?? null,
        passed: Boolean(r.passed),
        checkedAt: r.checkedAt.toISOString(),
      }));
    }
    return memSampleChecks
      .filter((c) => !merchantId || c.merchantId === merchantId)
      .sort((a, b) => (b.checkedAt > a.checkedAt ? 1 : -1));
  }

  static async updateMerchant(input: {
    merchantId: string;
    actor: string;
    status?: MerchantStatus;
    killSwitch?: boolean;
    displayOrder?: number;
    commercialAgreement?: CommercialAgreement | null;
  }): Promise<MerchantRecord> {
    const db = await ensureDbReady();
    const existing = await this.getMerchantById(input.merchantId);
    if (!existing) {
      throw new GrowthStoreError(404, 'MERCHANT_NOT_FOUND', 'החנות לא נמצאה');
    }

    const nextStatus = input.status ?? existing.status;
    const nextAgreement = input.commercialAgreement !== undefined ? input.commercialAgreement : existing.commercialAgreement;

    if (nextStatus === 'referral_only') {
      const checks = await this.listSampleChecks(existing.id);
      const hasPassingCheck = checks.some((c) => c.passed && c.testedQueries.length >= 3);
      if (!hasPassingCheck) {
        throw new GrowthStoreError(
          400,
          'SAMPLE_CHECK_REQUIRED',
          'לא ניתן להפעיל referral_only לפני שנרשמה בדיקת קישור לדוגמה (SampleLinkCheck) עם 3 מצרכים בעברית לפחות'
        );
      }
    }

    if (nextStatus === 'affiliate_active') {
      const checks = await this.listSampleChecks(existing.id);
      const hasPassingCheck = checks.some((c) => c.passed && c.testedQueries.length >= 3);
      if (!hasPassingCheck) {
        throw new GrowthStoreError(
          400,
          'SAMPLE_CHECK_REQUIRED',
          'לא ניתן להפעיל שותפות ללא בדיקת קישור לדוגמה תקינה'
        );
      }
      if (!hasCompleteCommercialAgreement(nextAgreement)) {
        throw new GrowthStoreError(
          400,
          'COMMERCIAL_AGREEMENT_REQUIRED',
          'לא ניתן לעבור ל-affiliate_active ללא כל פרטי ההסכם המסחרי (agreementId, commissionType, attributionWindow, publisherId, campaignId, disclosureText, approvedTrafficSources, approver)'
        );
      }
    }

    const now = new Date();
    const nextKillSwitch = input.killSwitch !== undefined ? input.killSwitch : existing.killSwitch;
    const nextDisplayOrder =
      typeof input.displayOrder === 'number' && Number.isFinite(input.displayOrder)
        ? input.displayOrder
        : existing.displayOrder;

    if (db) {
      await db
        .update(merchants)
        .set({
          status: nextStatus,
          killSwitch: nextKillSwitch,
          displayOrder: nextDisplayOrder,
          commercialAgreement: nextAgreement,
          updatedAt: now,
        })
        .where(eq(merchants.id, existing.id));
    } else {
      memMerchants.set(existing.id, {
        ...existing,
        status: nextStatus,
        killSwitch: nextKillSwitch,
        displayOrder: nextDisplayOrder,
        commercialAgreement: nextAgreement,
        updatedAt: now.toISOString(),
      });
    }

    await this.writeMerchantAuditLog({
      merchantId: existing.id,
      action: 'merchant_updated',
      actor: input.actor,
      previousState: {
        status: existing.status,
        killSwitch: existing.killSwitch,
        displayOrder: existing.displayOrder,
        hasAgreement: Boolean(existing.commercialAgreement),
      },
      nextState: {
        status: nextStatus,
        killSwitch: nextKillSwitch,
        displayOrder: nextDisplayOrder,
        hasAgreement: Boolean(nextAgreement),
      },
    });

    return (await this.getMerchantById(existing.id))!;
  }

  static async writeMerchantAuditLog(input: {
    merchantId: string;
    action: string;
    actor: string;
    previousState: Record<string, unknown>;
    nextState: Record<string, unknown>;
  }): Promise<MerchantAuditLogRecord> {
    const db = await ensureDbReady();
    const now = new Date();
    const log: MerchantAuditLogRecord = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: now.toISOString(),
    };
    if (db) {
      await db.insert(merchantAuditLogs).values({
        id: log.id,
        merchantId: log.merchantId,
        action: log.action,
        actor: log.actor,
        previousState: log.previousState,
        nextState: log.nextState,
        createdAt: now,
      });
    } else {
      memAuditLogs.push(log);
    }
    return log;
  }

  static async listMerchantAuditLogs(limit = 100): Promise<MerchantAuditLogRecord[]> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db
        .select()
        .from(merchantAuditLogs)
        .orderBy(desc(merchantAuditLogs.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        merchantId: r.merchantId,
        action: r.action,
        actor: r.actor,
        previousState: (r.previousState as Record<string, unknown>) || {},
        nextState: (r.nextState as Record<string, unknown>) || {},
        createdAt: r.createdAt.toISOString(),
      }));
    }
    return [...memAuditLogs].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, limit);
  }

  static async upsertIngredientMapping(input: {
    normalizedName: string;
    merchantId: string;
    sku: string;
    productName: string;
    productUrl: string;
    active?: boolean;
  }): Promise<IngredientMappingRecord> {
    const db = await ensureDbReady();
    const merchant = await this.getMerchantById(input.merchantId);
    if (!merchant) {
      throw new GrowthStoreError(404, 'MERCHANT_NOT_FOUND', 'החנות לא נמצאה');
    }
    if (!isDomainAllowedForMerchant(merchant, input.productUrl)) {
      throw new GrowthStoreError(400, 'DISALLOWED_DOMAIN', 'קישור המוצר חייב להיות HTTPS מדומיין מורשה של החנות');
    }

    const now = new Date();
    const rec: IngredientMappingRecord = {
      id: crypto.randomUUID(),
      normalizedName: input.normalizedName.trim(),
      merchantId: merchant.id,
      sku: input.sku.trim(),
      productName: input.productName.trim(),
      productUrl: input.productUrl.trim(),
      active: input.active !== false,
      verifiedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (db) {
      await db.insert(ingredientMappings).values({
        id: rec.id,
        normalizedName: rec.normalizedName,
        merchantId: rec.merchantId,
        sku: rec.sku,
        productName: rec.productName,
        productUrl: rec.productUrl,
        active: rec.active,
        verifiedAt: now,
        updatedAt: now,
      });
    } else {
      memIngredientMappings.push(rec);
    }
    return rec;
  }

  static async listIngredientMappings(activeOnly = false): Promise<IngredientMappingRecord[]> {
    const db = await ensureDbReady();
    if (db) {
      const rows = activeOnly
        ? await db.select().from(ingredientMappings).where(eq(ingredientMappings.active, true))
        : await db.select().from(ingredientMappings).orderBy(desc(ingredientMappings.updatedAt));
      return rows.map((r) => ({
        id: r.id,
        normalizedName: r.normalizedName,
        merchantId: r.merchantId,
        sku: r.sku,
        productName: r.productName,
        productUrl: r.productUrl,
        active: Boolean(r.active),
        verifiedAt: r.verifiedAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    }
    return memIngredientMappings.filter((m) => !activeOnly || m.active);
  }

  static async deleteIngredientMapping(id: string): Promise<boolean> {
    const db = await ensureDbReady();
    if (db) {
      await db.delete(ingredientMappings).where(eq(ingredientMappings.id, id));
      return true;
    }
    const idx = memIngredientMappings.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    memIngredientMappings.splice(idx, 1);
    return true;
  }

  static async createClickToken(input: {
    merchantId: string;
    normalizedQuery: string;
    destinationUrl: string;
    shareId?: string | null;
    recipeId?: string | null;
    disclosureMode: string;
  }): Promise<AffiliateClickTokenRecord> {
    const db = await ensureDbReady();
    const now = new Date();
    const rec: AffiliateClickTokenRecord = {
      token: crypto.randomBytes(16).toString('base64url'),
      merchantId: input.merchantId,
      normalizedQuery: input.normalizedQuery,
      destinationUrl: input.destinationUrl,
      shareId: input.shareId ?? null,
      recipeId: input.recipeId ?? null,
      disclosureMode: input.disclosureMode,
      createdAt: now.toISOString(),
    };
    if (db) {
      await db.insert(affiliateClickTokens).values({
        token: rec.token,
        merchantId: rec.merchantId,
        normalizedQuery: rec.normalizedQuery,
        destinationUrl: rec.destinationUrl,
        shareId: rec.shareId,
        recipeId: rec.recipeId,
        disclosureMode: rec.disclosureMode,
        createdAt: now,
      });
    } else {
      memClickTokens.set(rec.token, rec);
    }
    return rec;
  }

  static async getClickToken(token: string): Promise<AffiliateClickTokenRecord | null> {
    const db = await ensureDbReady();
    if (db) {
      const rows = await db
        .select()
        .from(affiliateClickTokens)
        .where(eq(affiliateClickTokens.token, token))
        .limit(1);
      if (!rows[0]) return null;
      return {
        ...rows[0],
        shareId: rows[0].shareId ?? null,
        recipeId: rows[0].recipeId ?? null,
        createdAt: rows[0].createdAt.toISOString(),
      };
    }
    return memClickTokens.get(token) ?? null;
  }

  static async isConversionReplay(partner: string, orderId: string, status: string): Promise<boolean> {
    const replayKey = `${partner}:${orderId}:${status}`;
    const db = await ensureDbReady();
    if (db) {
      const inserted = await db
        .insert(conversionLedger)
        .values({
          id: crypto.randomUUID(),
          partner,
          orderId,
          clickId: 'postback_stub_check',
          status,
          replayKey,
          payload: {},
        })
        .onConflictDoNothing()
        .returning({ id: conversionLedger.id });
      return inserted.length === 0;
    }
    if (memConversionReplayKeys.has(replayKey)) return true;
    memConversionReplayKeys.add(replayKey);
    return false;
  }
}
