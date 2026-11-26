import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { getJwtSecret } from './guest-cookie.util.js';

export const EXTRACTION_JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes
const JOB_CACHE_PREFIX = '__extract_job__:';

export interface ExtractionJobRecord {
  jobId: string;
  ownerUserId: string;
  isAuthenticated: boolean;
  mode: 'url' | 'text' | 'image' | 'carousel_batch';
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  quotaCharged: boolean;
  persistedToCloud: boolean;
  sourceUrl?: string;
  groupLabel?: string;
  totalExpected?: number;
  completedDishIds: string[];
  pendingDishIds: string[];
  recipes: any[];
  multiDish?: boolean;
  multiDishPayload?: any;
  error?: string;
}

export type JobLookupResult =
  | { state: 'not_found' }
  | { state: 'expired'; jobId: string }
  | { state: 'found'; job: ExtractionJobRecord };

export class ExtractionJobService {
  private static memJobs = new Map<string, ExtractionJobRecord>();

  public static createJobId(prefix = 'xjob'): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  }

  public static signJobToken(jobId: string, ownerUserId: string): string {
    return crypto
      .createHmac('sha256', getJwtSecret())
      .update(`extract-job:${jobId}:${ownerUserId}`)
      .digest('hex');
  }

  public static verifyJobToken(jobId: string, ownerUserId: string, token?: string | null): boolean {
    if (!token || typeof token !== 'string') return false;
    const expected = this.signJobToken(jobId, ownerUserId);
    const a = Buffer.from(token.trim(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  public static isAuthenticatedUserId(userId?: string | null): boolean {
    if (!userId || typeof userId !== 'string') return false;
    const trimmed = userId.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('anon_') || trimmed.startsWith('usr_guest_')) return false;
    return true;
  }

  public static verifyJobAccess(
    job: ExtractionJobRecord,
    requesterUserId?: string | null,
    providedToken?: string | null
  ): boolean {
    if (providedToken && this.verifyJobToken(job.jobId, job.ownerUserId, providedToken)) {
      return true;
    }
    if (requesterUserId && requesterUserId === job.ownerUserId) {
      return true;
    }
    return false;
  }

  private static cleanupExpiredMemory(): void {
    const now = Date.now();
    for (const [key, rec] of this.memJobs.entries()) {
      if (rec.expiresAt + 5 * 60 * 1000 < now) {
        this.memJobs.delete(key);
      }
    }
  }

  public static async saveJob(job: ExtractionJobRecord): Promise<ExtractionJobRecord> {
    this.cleanupExpiredMemory();
    const updated: ExtractionJobRecord = {
      ...job,
      updatedAt: Date.now(),
    };
    this.memJobs.set(updated.jobId, updated);

    const db = getDb();
    if (db) {
      const cacheKey = `${JOB_CACHE_PREFIX}${updated.jobId}`;
      try {
        await db.insert(schema.globalRecipesCache).values({
          id: `ejob_${updated.jobId.slice(0, 110)}`,
          normalizedUrl: cacheKey,
          recipeData: updated as any,
          hitCount: 1,
        }).onConflictDoUpdate({
          target: schema.globalRecipesCache.normalizedUrl,
          set: {
            recipeData: updated as any,
            hitCount: sql`${schema.globalRecipesCache.hitCount} + 1`,
            lastHitAt: new Date(),
          },
        });
      } catch (err: any) {
        console.warn(`[EXTRACTION_JOB] DB persist warning for ${updated.jobId}: ${err?.message || err}`);
      }
    }

    return updated;
  }

  public static async getJob(jobId: string): Promise<JobLookupResult> {
    if (!jobId || typeof jobId !== 'string') return { state: 'not_found' };
    const cleanId = jobId.trim();
    if (!cleanId) return { state: 'not_found' };

    let record = this.memJobs.get(cleanId);
    if (!record) {
      const db = getDb();
      if (db) {
        try {
          const rows = await db.select()
            .from(schema.globalRecipesCache)
            .where(eq(schema.globalRecipesCache.normalizedUrl, `${JOB_CACHE_PREFIX}${cleanId}`))
            .limit(1);
          if (rows.length > 0 && rows[0].recipeData && typeof rows[0].recipeData === 'object') {
            record = rows[0].recipeData as ExtractionJobRecord;
            this.memJobs.set(cleanId, record);
          }
        } catch (err: any) {
          console.warn(`[EXTRACTION_JOB] DB lookup warning for ${cleanId}: ${err?.message || err}`);
        }
      }
    }

    if (!record) {
      return { state: 'not_found' };
    }

    if (Date.now() > record.expiresAt) {
      return { state: 'expired', jobId: cleanId };
    }

    return { state: 'found', job: record };
  }

  public static async initJob(params: {
    jobId?: string;
    ownerUserId: string;
    mode: ExtractionJobRecord['mode'];
    sourceUrl?: string;
    groupLabel?: string;
    totalExpected?: number;
    pendingDishIds?: string[];
  }): Promise<{ job: ExtractionJobRecord; jobToken: string; alreadyExisted: boolean }> {
    const cleanId = (params.jobId && params.jobId.trim()) ? params.jobId.trim() : this.createJobId();
    const existing = await this.getJob(cleanId);
    if (existing.state === 'found' && existing.job.ownerUserId === params.ownerUserId) {
      return {
        job: existing.job,
        jobToken: this.signJobToken(existing.job.jobId, existing.job.ownerUserId),
        alreadyExisted: true,
      };
    }

    const now = Date.now();
    const record: ExtractionJobRecord = {
      jobId: cleanId,
      ownerUserId: params.ownerUserId,
      isAuthenticated: this.isAuthenticatedUserId(params.ownerUserId),
      mode: params.mode,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      expiresAt: now + EXTRACTION_JOB_TTL_MS,
      quotaCharged: false,
      persistedToCloud: false,
      sourceUrl: params.sourceUrl,
      groupLabel: params.groupLabel,
      totalExpected: params.totalExpected,
      completedDishIds: [],
      pendingDishIds: Array.isArray(params.pendingDishIds) ? [...params.pendingDishIds] : [],
      recipes: [],
    };
    await this.saveJob(record);
    return {
      job: record,
      jobToken: this.signJobToken(record.jobId, record.ownerUserId),
      alreadyExisted: false,
    };
  }

  public static async appendCarouselDishResult(params: {
    jobId: string;
    ownerUserId: string;
    dishId: string;
    recipe: any;
    totalExpected?: number;
    allDishIds?: string[];
    persistedToCloud: boolean;
    quotaCharged: boolean;
    sourceUrl?: string;
    groupLabel?: string;
  }): Promise<ExtractionJobRecord> {
    const existing = await this.getJob(params.jobId);
    const now = Date.now();
    let job: ExtractionJobRecord;
    if (existing.state === 'found' && existing.job.ownerUserId === params.ownerUserId) {
      job = existing.job;
    } else {
      job = {
        jobId: params.jobId,
        ownerUserId: params.ownerUserId,
        isAuthenticated: this.isAuthenticatedUserId(params.ownerUserId),
        mode: 'carousel_batch',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        expiresAt: now + EXTRACTION_JOB_TTL_MS,
        quotaCharged: false,
        persistedToCloud: false,
        sourceUrl: params.sourceUrl,
        groupLabel: params.groupLabel,
        totalExpected: params.totalExpected,
        completedDishIds: [],
        pendingDishIds: Array.isArray(params.allDishIds) ? [...params.allDishIds] : [],
        recipes: [],
      };
    }

    if (!job.completedDishIds.includes(params.dishId)) {
      job.completedDishIds.push(params.dishId);
    }
    if (Array.isArray(params.allDishIds) && params.allDishIds.length > 0) {
      job.pendingDishIds = params.allDishIds.filter((id) => !job.completedDishIds.includes(id));
      job.totalExpected = params.allDishIds.length;
    } else {
      job.pendingDishIds = job.pendingDishIds.filter((id) => id !== params.dishId);
    }

    // Avoid duplicate recipe entry for the same slide/dish inside the job record
    const existingIdx = job.recipes.findIndex(
      (r) => (r.id && params.recipe.id && r.id === params.recipe.id) ||
        (r.title && params.recipe.title && r.title === params.recipe.title && r.slideIndex === params.recipe.slideIndex)
    );
    if (existingIdx >= 0) {
      job.recipes[existingIdx] = params.recipe;
    } else {
      job.recipes.push(params.recipe);
    }

    job.quotaCharged = job.quotaCharged || params.quotaCharged;
    job.persistedToCloud = job.persistedToCloud || params.persistedToCloud;
    if (params.totalExpected && job.completedDishIds.length >= params.totalExpected) {
      job.status = 'completed';
    } else if (job.pendingDishIds.length === 0 && job.totalExpected && job.completedDishIds.length >= job.totalExpected) {
      job.status = 'completed';
    } else if (!job.totalExpected) {
      job.status = 'completed';
    }

    return this.saveJob(job);
  }

  public static clearForTests(): void {
    this.memJobs.clear();
  }
}
