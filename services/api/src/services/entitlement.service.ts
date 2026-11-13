import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { billingEvents, userEntitlements, users, vipEmails } from '../db/schema.js';
import { AdminService } from './admin.service.js';

export type EntitlementPlan = 'free' | 'pro_monthly' | 'pro_yearly' | 'pro_vip';
export type EntitlementStatus = 'active' | 'canceled' | 'expired';
export type EntitlementSource = 'billing' | 'vip';

export interface UserEntitlement {
  userId: string;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  source: EntitlementSource;
  provider?: string | null;
  providerRecurringId?: string | null;
  renewsAt: string | null;
  canceledAt?: string | null;
  updatedAt: string;
}

export interface BillingEventRecordInput {
  eventId: string;
  provider: string;
  eventType: string;
  userId: string;
  plan?: EntitlementPlan;
  providerRecurringId?: string | null;
  status: string;
  rawPayload?: Record<string, unknown>;
}

const inMemoryEntitlements = new Map<string, UserEntitlement>();
const inMemoryBillingEvents = new Map<string, BillingEventRecordInput>();
let entitlementTablesEnsured = false;

export function isBillingTestMode(): boolean {
  const raw = (process.env.BILLING_TEST_MODE ?? '').trim().toLowerCase();
  if (raw === '0' || raw === 'false') {
    return false;
  }
  return true;
}

function normalizePlanValue(rawPlan: unknown): EntitlementPlan {
  const val = String(rawPlan || '').trim().toLowerCase();
  if (val === 'pro_monthly' || val === 'monthly') return 'pro_monthly';
  if (val === 'pro_yearly' || val === 'pro_annual' || val === 'yearly' || val === 'annual') return 'pro_yearly';
  if (val === 'pro_vip' || val === 'promo_vip' || val === 'family_vip' || val === 'lifetime_pro' || val === 'vip') {
    return 'pro_vip';
  }
  return 'free';
}

function normalizeStatusValue(rawStatus: unknown, plan: EntitlementPlan): EntitlementStatus {
  const val = String(rawStatus || '').trim().toLowerCase();
  if (val === 'active' || val === 'canceled' || val === 'expired') {
    return val;
  }
  return plan === 'free' ? 'expired' : 'active';
}

export function isEntitlementProActive(entitlement: Pick<UserEntitlement, 'plan' | 'status' | 'renewsAt'> | null | undefined): boolean {
  if (!entitlement || entitlement.plan === 'free') {
    return false;
  }
  if (entitlement.plan === 'pro_vip') {
    return entitlement.status === 'active';
  }
  if (entitlement.status === 'expired') {
    return false;
  }
  if (entitlement.renewsAt) {
    const expiresMs = new Date(entitlement.renewsAt).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      return false;
    }
  }
  return entitlement.status === 'active' || entitlement.status === 'canceled';
}

export function computeNextRenewalIso(plan: 'pro_monthly' | 'pro_yearly', fromDate: Date = new Date()): string {
  const next = new Date(fromDate.getTime());
  if (plan === 'pro_yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}

export class EntitlementService {
  private static legacyProUserCheck: ((userId: string) => boolean) | null = null;
  private static legacyProUserWriter: ((userId: string, isPro: boolean) => void) | null = null;

  static registerLegacyUsageHooks(
    checker: (userId: string) => boolean,
    writer: (userId: string, isPro: boolean) => void,
  ): void {
    this.legacyProUserCheck = checker;
    this.legacyProUserWriter = writer;
  }

  static async ensureTables(): Promise<void> {
    if (entitlementTablesEnsured) return;
    const db = getDb();
    if (!db) return;

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_entitlements (
          user_id VARCHAR(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          plan VARCHAR(32) NOT NULL DEFAULT 'free',
          status VARCHAR(32) NOT NULL DEFAULT 'expired',
          source VARCHAR(32) NOT NULL DEFAULT 'billing',
          provider VARCHAR(32) DEFAULT 'cardcom',
          provider_recurring_id VARCHAR(255),
          renews_at TIMESTAMPTZ,
          canceled_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS billing_events (
          event_id VARCHAR(255) PRIMARY KEY,
          provider VARCHAR(32) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          user_id VARCHAR(128),
          plan VARCHAR(32),
          provider_recurring_id VARCHAR(255),
          status VARCHAR(32) NOT NULL,
          raw_payload JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON billing_events(user_id);
      `);
      entitlementTablesEnsured = true;
    } catch (err) {
      console.error('[EntitlementService] Failed ensuring billing tables:', err);
    }
  }

  static async ensureUserExists(userId: string, email?: string, name?: string): Promise<void> {
    const db = getDb();
    if (!db || !userId) return;

    const cleanId = userId.trim();
    const safeEmailLocal = cleanId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'user';
    const resolvedEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${safeEmailLocal}@guest.myrecipes.local`;

    try {
      await db
        .insert(users)
        .values({
          id: cleanId,
          email: resolvedEmail,
          name: name || (cleanId.startsWith('usr_guest_') ? 'אורח' : 'שף'),
          isPro: false,
          proTier: 'free',
        })
        .onConflictDoNothing({ target: users.id });
    } catch (err) {
      console.error(`[EntitlementService] Failed ensureUserExists for ${cleanId}:`, err);
    }
  }

  static defaultFreeEntitlement(userId: string): UserEntitlement {
    return {
      userId,
      plan: 'free',
      status: 'expired',
      source: 'billing',
      provider: null,
      providerRecurringId: null,
      renewsAt: null,
      canceledAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private static normalizeAndCheckExpiry(entitlement: UserEntitlement): { normalized: UserEntitlement; changed: boolean } {
    if (
      (entitlement.plan === 'pro_monthly' || entitlement.plan === 'pro_yearly')
      && entitlement.renewsAt
      && new Date(entitlement.renewsAt).getTime() <= Date.now()
    ) {
      return {
        normalized: {
          ...entitlement,
          plan: 'free',
          status: 'expired',
          updatedAt: new Date().toISOString(),
        },
        changed: true,
      };
    }
    return { normalized: entitlement, changed: false };
  }

  private static async syncLegacyUserFlags(entitlement: UserEntitlement): Promise<void> {
    const activePro = isEntitlementProActive(entitlement);
    if (this.legacyProUserWriter) {
      this.legacyProUserWriter(entitlement.userId, activePro);
    }

    const db = getDb();
    if (!db) return;
    try {
      await db
        .update(users)
        .set({
          isPro: activePro,
          proTier: activePro ? (entitlement.plan === 'pro_vip' ? 'promo_vip' : entitlement.plan) : 'free',
          proExpiresAt: entitlement.renewsAt ? new Date(entitlement.renewsAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, entitlement.userId));
    } catch (err) {
      console.error(`[EntitlementService] Failed syncing users flags for ${entitlement.userId}:`, err);
    }
  }

  private static async persistEntitlement(entitlement: UserEntitlement): Promise<UserEntitlement> {
    inMemoryEntitlements.set(entitlement.userId, entitlement);

    const db = getDb();
    if (db) {
      try {
        await this.ensureTables();
        await this.ensureUserExists(entitlement.userId);
        await db
          .insert(userEntitlements)
          .values({
            userId: entitlement.userId,
            plan: entitlement.plan,
            status: entitlement.status,
            source: entitlement.source,
            provider: entitlement.provider || null,
            providerRecurringId: entitlement.providerRecurringId || null,
            renewsAt: entitlement.renewsAt ? new Date(entitlement.renewsAt) : null,
            canceledAt: entitlement.canceledAt ? new Date(entitlement.canceledAt) : null,
            updatedAt: new Date(entitlement.updatedAt),
          })
          .onConflictDoUpdate({
            target: userEntitlements.userId,
            set: {
              plan: entitlement.plan,
              status: entitlement.status,
              source: entitlement.source,
              provider: entitlement.provider || null,
              providerRecurringId: entitlement.providerRecurringId || null,
              renewsAt: entitlement.renewsAt ? new Date(entitlement.renewsAt) : null,
              canceledAt: entitlement.canceledAt ? new Date(entitlement.canceledAt) : null,
              updatedAt: new Date(entitlement.updatedAt),
            },
          });
      } catch (err) {
        console.error(`[EntitlementService] Failed persisting entitlement for ${entitlement.userId}:`, err);
      }
    }

    await this.syncLegacyUserFlags(entitlement);
    return entitlement;
  }

  static async getEntitlement(userId: string): Promise<UserEntitlement> {
    if (!userId) {
      return this.defaultFreeEntitlement('guest');
    }

    const db = getDb();
    if (db) {
      try {
        await this.ensureTables();
        const rows = await db
          .select()
          .from(userEntitlements)
          .where(eq(userEntitlements.userId, userId));

        if (rows.length > 0) {
          const entitlement = this.mapDbRowToEntitlement(rows[0]);
          const { normalized, changed } = this.normalizeAndCheckExpiry(entitlement);
          if (changed) {
            return await this.persistEntitlement(normalized);
          }
          inMemoryEntitlements.set(userId, normalized);
          return normalized;
        }

        // Migrate legacy users.isPro / VIP email grant lazily into user_entitlements
        const userRows = await db.select().from(users).where(eq(users.id, userId));
        if (userRows.length > 0) {
          const u = userRows[0];
          const isEmailVip = u.email ? await AdminService.isEmailVip(u.email) : false;
          if (u.isPro || isEmailVip) {
            const migratedPlan = normalizePlanValue(u.proTier);
            const effectivePlan: EntitlementPlan = migratedPlan === 'free' ? 'pro_vip' : migratedPlan;
            const source: EntitlementSource = effectivePlan === 'pro_vip' ? 'vip' : 'billing';
            const migrated: UserEntitlement = {
              userId,
              plan: effectivePlan,
              status: 'active',
              source,
              provider: source === 'vip' ? 'vip' : 'cardcom',
              providerRecurringId: null,
              renewsAt: u.proExpiresAt ? u.proExpiresAt.toISOString() : null,
              canceledAt: null,
              updatedAt: new Date().toISOString(),
            };
            return await this.persistEntitlement(migrated);
          }
        }
      } catch (err) {
        console.error(`[EntitlementService] DB getEntitlement error for ${userId}:`, err);
      }
    }

    const mem = inMemoryEntitlements.get(userId);
    if (mem) {
      const { normalized, changed } = this.normalizeAndCheckExpiry(mem);
      if (changed) {
        inMemoryEntitlements.set(userId, normalized);
        await this.syncLegacyUserFlags(normalized);
      }
      return normalized;
    }

    if (this.legacyProUserCheck && this.legacyProUserCheck(userId)) {
      const seeded: UserEntitlement = {
        userId,
        plan: 'pro_vip',
        status: 'active',
        source: 'vip',
        provider: 'vip',
        providerRecurringId: null,
        renewsAt: null,
        canceledAt: null,
        updatedAt: new Date().toISOString(),
      };
      inMemoryEntitlements.set(userId, seeded);
      return seeded;
    }

    return this.defaultFreeEntitlement(userId);
  }

  static async grantVipEntitlement(userId: string, provider: string = 'vip'): Promise<UserEntitlement> {
    const entitlement: UserEntitlement = {
      userId,
      plan: 'pro_vip',
      status: 'active',
      source: 'vip',
      provider,
      providerRecurringId: null,
      renewsAt: null,
      canceledAt: null,
      updatedAt: new Date().toISOString(),
    };
    return await this.persistEntitlement(entitlement);
  }

  static async revokeToFreeEntitlement(userId: string): Promise<UserEntitlement> {
    const existing = await this.getEntitlement(userId);
    const updated: UserEntitlement = {
      userId,
      plan: 'free',
      status: 'expired',
      source: existing.source || 'billing',
      provider: existing.provider || null,
      providerRecurringId: null,
      renewsAt: null,
      canceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await this.persistEntitlement(updated);
  }

  static async activatePaidEntitlement(
    userId: string,
    plan: 'pro_monthly' | 'pro_yearly',
    provider: string,
    providerRecurringId?: string | null,
    renewsAtIso?: string | null,
  ): Promise<UserEntitlement> {
    const entitlement: UserEntitlement = {
      userId,
      plan,
      status: 'active',
      source: 'billing',
      provider,
      providerRecurringId: providerRecurringId || null,
      renewsAt: renewsAtIso || computeNextRenewalIso(plan),
      canceledAt: null,
      updatedAt: new Date().toISOString(),
    };
    return await this.persistEntitlement(entitlement);
  }

  static async markEntitlementCanceled(userId: string): Promise<UserEntitlement> {
    const current = await this.getEntitlement(userId);
    const updated: UserEntitlement = {
      ...current,
      status: 'canceled',
      canceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await this.persistEntitlement(updated);
  }

  static async recordBillingEventOnce(input: BillingEventRecordInput): Promise<{ duplicate: boolean }> {
    const eventId = input.eventId.trim();
    if (!eventId) {
      throw new Error('Missing billing eventId');
    }

    const db = getDb();
    if (db) {
      try {
        await this.ensureTables();
        const inserted = await db
          .insert(billingEvents)
          .values({
            eventId,
            provider: input.provider,
            eventType: input.eventType,
            userId: input.userId,
            plan: input.plan || null,
            providerRecurringId: input.providerRecurringId || null,
            status: input.status,
            rawPayload: input.rawPayload || {},
          })
          .onConflictDoNothing({ target: billingEvents.eventId })
          .returning({ eventId: billingEvents.eventId });

        if (inserted.length === 0) {
          return { duplicate: true };
        }
        inMemoryBillingEvents.set(eventId, input);
        return { duplicate: false };
      } catch (err) {
        console.error(`[EntitlementService] Failed recording billing event ${eventId}:`, err);
      }
    }

    if (inMemoryBillingEvents.has(eventId)) {
      return { duplicate: true };
    }
    inMemoryBillingEvents.set(eventId, input);
    return { duplicate: false };
  }

  static async syncVipStatusForEmail(userId: string, email: string): Promise<UserEntitlement> {
    const db = getDb();
    let isVip = await AdminService.isEmailVip(email);
    if (!isVip && db) {
      try {
        const rows = await db.select().from(vipEmails).where(eq(vipEmails.email, email.toLowerCase()));
        isVip = rows.length > 0;
      } catch {
        // Ignore if table check fails
      }
    }
    if (isVip) {
      return await this.grantVipEntitlement(userId, 'vip_email');
    }
    return await this.getEntitlement(userId);
  }

  private static mapDbRowToEntitlement(row: typeof userEntitlements.$inferSelect): UserEntitlement {
    const plan = normalizePlanValue(row.plan);
    const status = normalizeStatusValue(row.status, plan);
    return {
      userId: row.userId,
      plan,
      status,
      source: row.source === 'vip' ? 'vip' : 'billing',
      provider: row.provider || null,
      providerRecurringId: row.providerRecurringId || null,
      renewsAt: row.renewsAt ? row.renewsAt.toISOString() : null,
      canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  static async findEntitlementByRecurringId(providerRecurringId: string): Promise<UserEntitlement | null> {
    const cleanRecurringId = String(providerRecurringId || '').trim();
    if (!cleanRecurringId) return null;

    const db = getDb();
    if (db) {
      try {
        await this.ensureTables();
        const rows = await db
          .select()
          .from(userEntitlements)
          .where(eq(userEntitlements.providerRecurringId, cleanRecurringId))
          .orderBy(desc(userEntitlements.updatedAt))
          .limit(1);

        if (rows.length > 0) {
          const mapped = this.mapDbRowToEntitlement(rows[0]);
          const { normalized, changed } = this.normalizeAndCheckExpiry(mapped);
          return changed ? await this.persistEntitlement(normalized) : normalized;
        }
      } catch (err) {
        console.error(`[EntitlementService] Failed lookup by recurringId ${cleanRecurringId}:`, err);
      }
    }

    for (const candidate of inMemoryEntitlements.values()) {
      if (candidate.providerRecurringId === cleanRecurringId) {
        return candidate;
      }
    }
    return null;
  }

  static async mergeGuestEntitlementToUser(guestUserId: string, targetUserId: string): Promise<UserEntitlement> {
    const cleanGuest = String(guestUserId || '').trim();
    const cleanTarget = String(targetUserId || '').trim();
    if (!cleanGuest || !cleanTarget || cleanGuest === cleanTarget) {
      return await this.getEntitlement(cleanTarget || 'guest');
    }

    const guestEnt = await this.getEntitlement(cleanGuest);
    const targetEnt = await this.getEntitlement(cleanTarget);

    if (!isEntitlementProActive(guestEnt)) {
      return targetEnt;
    }

    const shouldAdopt =
      !isEntitlementProActive(targetEnt)
      || (guestEnt.plan === 'pro_vip' && targetEnt.plan !== 'pro_vip');

    if (!shouldAdopt) {
      return targetEnt;
    }

    const migrated: UserEntitlement = {
      userId: cleanTarget,
      plan: guestEnt.plan,
      status: guestEnt.status,
      source: guestEnt.source,
      provider: guestEnt.provider || null,
      providerRecurringId: guestEnt.providerRecurringId || null,
      renewsAt: guestEnt.renewsAt,
      canceledAt: guestEnt.canceledAt || null,
      updatedAt: new Date().toISOString(),
    };

    const persisted = await this.persistEntitlement(migrated);
    await this.revokeToFreeEntitlement(cleanGuest);
    return persisted;
  }

  static resetMemoryForTests(): void {
    inMemoryEntitlements.clear();
    inMemoryBillingEvents.clear();
  }
}
