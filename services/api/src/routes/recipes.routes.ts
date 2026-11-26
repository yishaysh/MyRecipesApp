import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { ParseRecipeRequestSchema } from '../shared/index.js';
import { JobQueueService } from '../services/job-queue.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { ExtractorService } from '../services/extractor.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';
import { TrendDiscoveryService } from '../services/trend-discovery.service.js';
import { AuthService } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';
import { EntitlementService } from '../services/entitlement.service.js';
import { extractVerifiedGuestIdFromRequest } from '../services/guest-cookie.util.js';
import { GrowthStoreService } from '../services/growth-store.service.js';
import { ExtractionJobService } from '../services/extraction-job.service.js';
import { cropImageBuffer, parseCropParam, validateNormalizedCropBox } from '../services/image-crop.util.js';

async function persistRecipesForAuthenticatedUser(effectiveUserId: string, recipes: any[]): Promise<boolean> {
  if (!ExtractionJobService.isAuthenticatedUserId(effectiveUserId)) return false;
  if (!Array.isArray(recipes) || recipes.length === 0) return false;
  try {
    await SyncService.pushRecipes(effectiveUserId, recipes);
    return true;
  } catch (err) {
    console.error('[RECIPES_ROUTES] Failed durable cloud persistence for authenticated user:', err);
    return false;
  }
}

// In-flight extraction deduplication lock keyed by `${effectiveUserId}:${normalizedInput}`
// Prevents duplicate concurrent extractions from charging double quota (A7).
const inFlightExtractions = new Map<string, Promise<any>>();

// Tracks multi-dish picker batches that already consumed their single quota unit (FIX 3)
const chargedMultiDishBatches = new Map<string, number>();

function cleanupChargedBatches() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, ts] of chargedMultiDishBatches.entries()) {
    if (ts < cutoff) chargedMultiDishBatches.delete(k);
  }
}

function resolveUserId(request: FastifyRequest, bodyUserId?: string): string {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (session) return session.userId;
  }

  // Fallback 1: Persistent signed HttpOnly guest cookie (survives localStorage clears)
  const cookieGuestId = extractVerifiedGuestIdFromRequest(request.headers as Record<string, string | string[] | undefined>);
  if (cookieGuestId) {
    return cookieGuestId;
  }

  // In automated test environment, permit explicit test user ID from payload
  if (process.env.NODE_ENV === 'test' && bodyUserId) {
    return bodyUserId;
  }

  // Fallback 2: Derive guest ID from client IP to prevent quota bypass and victim quota depletion IDOR
  const rawIp = request.ip || (request.headers['x-forwarded-for'] as string) || '127.0.0.1';
  const ipHash = crypto.createHash('md5').update(String(rawIp)).digest('hex').substring(0, 16);
  return `anon_${ipHash}`;
}

async function enforceExtractionQuota(reply: FastifyReply, effectiveUserId: string): Promise<boolean> {
  if (!effectiveUserId) return true;
  const usage = await SyncService.checkUsageLimit(effectiveUserId);
  if (usage.allowed) return true;

  const entitlement = await EntitlementService.getEntitlement(effectiveUserId);
  reply.status(402).send({
    error: 'QUOTA_EXCEEDED',
    message: 'מיצית את מכסת 5 החילוצים החודשית החינמית. שדרג ל-Chef Pro לחילוצים ללא הגבלה!',
    usage,
    entitlement,
    upgradeUrl: '/paywall',
  });
  return false;
}

export const recipesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const jobQueue = JobQueueService.getInstance();
  const storage = RecipeStorageService.getInstance();
  const extractor = new ExtractorService();
  const parser = new LlmParserService();

  // POST /api/v1/recipes/parse (Asynchronous Ingestion Endpoint per Spec)
  fastify.post('/parse', async (request, reply) => {
    const parseResult = ParseRecipeRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format()
      });
    }

    const { sourceUrl: rawSourceUrl, userId: bodyUserId } = parseResult.data;
    const sourceUrl = SyncService.normalizeSocialUrl(rawSourceUrl);
    const effectiveUserId = resolveUserId(request, bodyUserId);

    // Freemium Quota Enforcement
    if (!(await enforceExtractionQuota(reply, effectiveUserId))) {
      return;
    }

    // On Vercel / serverless runtime, process synchronously so it completes before response closes
    if (process.env.VERCEL) {
      const completedJob = await jobQueue.createJobAsync(sourceUrl, effectiveUserId);
      const httpStatus = completedJob.status === 'failed' ? ((completedJob as any).statusCode || 422) : 200;
      return reply.status(httpStatus).send(completedJob);
    }

    const job = jobQueue.createJob(sourceUrl, effectiveUserId);
    return reply.status(202).send(job);
  });

  // GET /api/v1/recipes/jobs/:jobId (Poll legacy async job status)
  fastify.get('/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobQueue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send(job);
  });

  // GET /api/v1/recipes/extraction-jobs/:jobId (FIX 1: Durable resumable extraction job lookup)
  fastify.get('/extraction-jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const query = (request.query || {}) as { token?: string };
    const headerToken = typeof request.headers['x-job-token'] === 'string' ? request.headers['x-job-token'] : undefined;
    const providedToken = query.token || headerToken;
    const requesterUserId = resolveUserId(request);

    const lookup = await ExtractionJobService.getJob(jobId);
    if (lookup.state === 'not_found') {
      return reply.status(404).send({ status: 'not_found', jobId, error: 'Extraction job not found' });
    }
    if (lookup.state === 'expired') {
      return reply.status(404).send({ status: 'expired', jobId, error: 'Extraction job expired' });
    }

    const job = lookup.job;
    if (!ExtractionJobService.verifyJobAccess(job, requesterUserId, providedToken)) {
      return reply.status(403).send({ status: 'forbidden', error: 'Access denied for this extraction job' });
    }

    return reply.send({
      status: job.status,
      jobId: job.jobId,
      mode: job.mode,
      persistedToCloud: job.persistedToCloud,
      quotaCharged: job.quotaCharged,
      sourceUrl: job.sourceUrl,
      groupLabel: job.groupLabel,
      totalExpected: job.totalExpected,
      completedDishIds: job.completedDishIds,
      pendingDishIds: job.pendingDishIds,
      recipe: job.recipes.length > 0 ? job.recipes[0] : null,
      recipes: job.recipes,
      multiDish: Boolean(job.multiDish),
      multiDishPayload: job.multiDishPayload || null,
      error: job.error || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      expiresAt: job.expiresAt,
    });
  });

  // Synchronous fast extraction handler (supports /fast-parse and /extract alias)
  const handleFastExtraction = async (
    request: FastifyRequest<{ Body: { sourceUrl?: string; url?: string; userId?: string; forceRefresh?: boolean; jobId?: string } }>,
    reply: FastifyReply
  ) => {
    const body = (request.body || {}) as { sourceUrl?: string; url?: string; userId?: string; forceRefresh?: boolean; jobId?: string };
    const rawUrl = body.sourceUrl || body.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'Missing sourceUrl or url in request body'
      });
    }

    const urlMatch = rawUrl.match(/https?:\/\/[^\s"'<>]+/i);
    if (!urlMatch) {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'Must provide a valid http or https URL'
      });
    }

    const sourceUrl = SyncService.normalizeSocialUrl(urlMatch[0]);
    const bodyUserId = body.userId;
    const forceRefresh = Boolean(body.forceRefresh);
    const effectiveUserId = resolveUserId(request, bodyUserId);

    // Idempotent job initialization (FIX 1): if this exact jobId already completed, return stored result with 0 extra quota
    const { job: trackedJob, jobToken, alreadyExisted } = await ExtractionJobService.initJob({
      jobId: body.jobId,
      ownerUserId: effectiveUserId,
      mode: 'url',
      sourceUrl,
    });

    if (alreadyExisted && trackedJob.status === 'completed') {
      const latestUsage = effectiveUserId ? await SyncService.checkUsageLimit(effectiveUserId) : undefined;
      if (trackedJob.multiDish && trackedJob.multiDishPayload) {
        return reply.send({
          success: true,
          idempotentReplay: true,
          jobId: trackedJob.jobId,
          jobToken,
          ...trackedJob.multiDishPayload,
          usage: latestUsage,
        });
      }
      const primary = trackedJob.recipes[0] || null;
      return reply.send({
        success: true,
        idempotentReplay: true,
        jobId: trackedJob.jobId,
        jobToken,
        persistedToCloud: trackedJob.persistedToCloud,
        recipe: primary,
        recipes: trackedJob.recipes,
        usage: latestUsage,
        ...(primary || {}),
      });
    }

    // Freemium Quota Enforcement (skip if this jobId already paid)
    if (!trackedJob.quotaCharged) {
      if (!(await enforceExtractionQuota(reply, effectiveUserId))) {
        await ExtractionJobService.saveJob({ ...trackedJob, status: 'failed', error: 'QUOTA_EXCEEDED' });
        return;
      }
    }

    const lockKey = `${effectiveUserId}:${SyncService.canonicalUrlKey(sourceUrl) || sourceUrl}`;
    let extractionPromise = inFlightExtractions.get(lockKey);
    const isInitiator = !extractionPromise;

    if (!extractionPromise) {
      extractionPromise = (async () => {
        try {
          // Check Global Recipe Cache (bypass legacy single-recipe cache for Instagram /p/ carousel URLs or explicit forceRefresh)
          const isInstagramPostUrl = /instagram\.com\/p\//i.test(sourceUrl);
          const cachedData = forceRefresh ? null : await SyncService.getFromGlobalCache(sourceUrl);
          if (cachedData) {
            if (cachedData.multiDish === true && Array.isArray(cachedData.dishes) && cachedData.dishes.length > 1) {
              const batchId = `batch_${crypto.randomBytes(6).toString('hex')}`;
              const multiPayload = {
                multiDish: true,
                batchId,
                sourceUrl,
                platform: cachedData.platform || 'instagram',
                groupLabel: cachedData.groupLabel || 'מתכוני קרוסלה',
                captionText: cachedData.captionText || '',
                dishes: cachedData.dishes,
                quotaCost: 1,
              };
              await ExtractionJobService.saveJob({
                ...trackedJob,
                status: 'completed',
                multiDish: true,
                multiDishPayload: multiPayload,
              });
              return { ...multiPayload, primary: null, recipes: [], persistedToCloud: false };
            }

            const shouldBypassLegacyIgPost = isInstagramPostUrl && !cachedData.carouselCheckedV199;
            if (!shouldBypassLegacyIgPost) {
              const rawCachedRecipes = Array.isArray(cachedData.recipes) ? cachedData.recipes : [cachedData];
              const cachedRecipes = await parser.postProcessCachedRecipes(rawCachedRecipes);
              for (const r of cachedRecipes) {
                storage.save(r);
              }
              if (cachedRecipes.length > 0 && JSON.stringify(cachedRecipes) !== JSON.stringify(rawCachedRecipes)) {
                void SyncService.saveToGlobalCache(sourceUrl, {
                  recipes: cachedRecipes,
                  primary: cachedRecipes[0],
                  carouselCheckedV199: true,
                });
              }
              const persistedToCloud = await persistRecipesForAuthenticatedUser(effectiveUserId, cachedRecipes);
              let quotaCharged = trackedJob.quotaCharged;
              if (cachedRecipes.length > 0 && effectiveUserId && !quotaCharged) {
                await SyncService.incrementUsage(effectiveUserId);
                quotaCharged = true;
              }
              await ExtractionJobService.saveJob({
                ...trackedJob,
                status: 'completed',
                recipes: cachedRecipes,
                quotaCharged,
                persistedToCloud,
              });
              return { primary: cachedRecipes[0] || cachedData.primary, recipes: cachedRecipes, persistedToCloud };
            }
          }

          const raw = await extractor.extractRawContent(sourceUrl);

          // FIX 1 & 2 & 3: Detect carousels and multi-dish list posts and return dish picker candidates
          const maybeMultiDish = Boolean(
            raw.isCarousel ||
            raw.isListPost ||
            (raw.carouselSlides && raw.carouselSlides.length > 1) ||
            (raw.carouselImages && raw.carouselImages.length > 1)
          );

          if (maybeMultiDish) {
            const discovery = await parser.discoverMultiDishes(raw);
            if (discovery.isMultiDish && discovery.dishes.length > 1) {
              const batchId = `batch_${crypto.randomBytes(6).toString('hex')}`;
              const multiPayload = {
                multiDish: true,
                batchId,
                sourceUrl: raw.sourceUrl,
                platform: raw.platform,
                groupLabel: discovery.groupLabel,
                captionText: raw.captionText,
                dishes: discovery.dishes,
                quotaCost: 1,
              };
              await SyncService.saveToGlobalCache(sourceUrl, {
                ...multiPayload,
                carouselCheckedV199: true,
              });
              await ExtractionJobService.saveJob({
                ...trackedJob,
                status: 'completed',
                multiDish: true,
                multiDishPayload: multiPayload,
              });
              return { ...multiPayload, primary: null, recipes: [], persistedToCloud: false };
            }
          }

          const recipes = await parser.parseToRecipes(raw);
          for (const r of recipes) {
            storage.save(r);
          }

          let persistedToCloud = false;
          let quotaCharged = trackedJob.quotaCharged;
          if (recipes.length > 0) {
            await SyncService.saveToGlobalCache(sourceUrl, {
              recipes,
              primary: recipes[0],
              carouselCheckedV199: true,
            });
            persistedToCloud = await persistRecipesForAuthenticatedUser(effectiveUserId, recipes);
            if (effectiveUserId && !quotaCharged) {
              await SyncService.incrementUsage(effectiveUserId);
              quotaCharged = true;
            }
          }

          await ExtractionJobService.saveJob({
            ...trackedJob,
            status: 'completed',
            recipes,
            quotaCharged,
            persistedToCloud,
          });

          return { primary: recipes.length > 0 ? recipes[0] : null, recipes, persistedToCloud };
        } catch (err: any) {
          await ExtractionJobService.saveJob({
            ...trackedJob,
            status: 'failed',
            error: err?.message || 'Extraction failed',
          });
          throw err;
        } finally {
          inFlightExtractions.delete(lockKey);
        }
      })();
      inFlightExtractions.set(lockKey, extractionPromise);
    }

    try {
      const result = await extractionPromise;
      const latestUsage = effectiveUserId ? await SyncService.checkUsageLimit(effectiveUserId) : undefined;
      if (result.multiDish) {
        return reply.send({
          success: true,
          jobId: trackedJob.jobId,
          jobToken,
          multiDish: true,
          batchId: result.batchId,
          sourceUrl: result.sourceUrl,
          platform: result.platform,
          groupLabel: result.groupLabel,
          captionText: result.captionText,
          dishes: result.dishes,
          quotaCost: 1,
          usage: latestUsage,
        });
      }
      const { primary, recipes, persistedToCloud } = result;
      return reply.send({
        success: true,
        deduplicatedInFlight: !isInitiator,
        jobId: trackedJob.jobId,
        jobToken,
        persistedToCloud: Boolean(persistedToCloud),
        recipe: primary,
        recipes,
        usage: latestUsage,
        ...(primary || {}),
      });
    } catch (err: any) {
      const message = err?.message || 'לא הצלחנו לחלץ את המתכון מהקישור הזה — ייתכן שהפוסט פרטי, חסום לגישה או שאין בו טקסט מתכון.';
      const statusCode = err?.statusCode === 400 ? 400 : 422;
      return reply.status(statusCode).send({
        statusCode,
        error: statusCode === 400 ? 'Bad Request' : 'Unprocessable Entity',
        message,
        jobId: trackedJob.jobId,
      });
    }
  };

  // POST /api/v1/recipes/fast-parse
  fastify.post('/fast-parse', handleFastExtraction);

  // POST /api/v1/recipes/extract (Web client alias)
  fastify.post('/extract', handleFastExtraction);

  // POST /api/v1/recipes/extract-dish (FIX 1, 2 & 3: Extract a single chosen dish from a multi-dish carousel/list post)
  fastify.post('/extract-dish', async (
    request: FastifyRequest<{
      Body: {
        batchId?: string;
        sourceUrl?: string;
        platform?: string;
        groupLabel?: string;
        captionText?: string;
        totalDishes?: number;
        totalSelected?: number;
        allDishIds?: string[];
        dish?: {
          dishId?: string;
          slideIndex?: number;
          title?: string;
          summary?: string;
          imageUrl?: string;
          videoUrl?: string;
          slideText?: string;
          aiCompleted?: boolean;
          cropBox?: { x: number; y: number; w: number; h: number } | null;
          sharedSlideCount?: number;
        };
        userId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const body = request.body || {};
    const dish = body.dish;
    if (!dish || typeof dish.title !== 'string' || !dish.title.trim()) {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'Missing dish title for carousel extraction'
      });
    }

    const rawSourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    const sourceUrl = rawSourceUrl ? SyncService.normalizeSocialUrl(rawSourceUrl) : '';
    const effectiveUserId = resolveUserId(request, body.userId);
    const batchId = typeof body.batchId === 'string' && body.batchId.trim()
      ? body.batchId.trim()
      : ExtractionJobService.createJobId('batch');
    const dishId = dish.dishId || `dish_${dish.slideIndex || 1}`;
    const jobToken = ExtractionJobService.signJobToken(batchId, effectiveUserId);

    cleanupChargedBatches();
    const batchQuotaKey = `${effectiveUserId}:${batchId}`;
    const existingBatchLookup = await ExtractionJobService.getJob(batchId);
    const existingBatchJob = existingBatchLookup.state === 'found' && existingBatchLookup.job.ownerUserId === effectiveUserId
      ? existingBatchLookup.job
      : null;

    // Idempotent replay: if this exact dishId was already completed in this batch, return it with 0 extra quota & 0 duplicate save
    if (existingBatchJob && existingBatchJob.completedDishIds.includes(dishId)) {
      const existingRecipe = existingBatchJob.recipes.find(
        (r) => r.slideIndex === (Number(dish.slideIndex) || 1) && r.title === dish.title!.trim()
      ) || existingBatchJob.recipes.find((r) => r.title === dish.title!.trim());
      if (existingRecipe) {
        const latestUsage = effectiveUserId ? await SyncService.checkUsageLimit(effectiveUserId) : undefined;
        return reply.send({
          success: true,
          idempotentReplay: true,
          jobId: batchId,
          jobToken,
          recipe: existingRecipe,
          persistedToCloud: existingBatchJob.persistedToCloud,
          quotaCharged: false,
          usage: latestUsage,
        });
      }
    }

    const alreadyChargedForBatch = Boolean(
      chargedMultiDishBatches.has(batchQuotaKey) || existingBatchJob?.quotaCharged
    );

    // Only enforce quota if this multi-dish batch has not already paid its 1 extraction unit
    if (!alreadyChargedForBatch) {
      if (!(await enforceExtractionQuota(reply, effectiveUserId))) {
        return;
      }
    }

    try {
      const platform = (['instagram', 'tiktok', 'facebook', 'youtube', 'web'].includes(body.platform || '')
        ? body.platform
        : ExtractorService.detectPlatform(sourceUrl || 'https://instagram.com')) as any;

      const recipe = await parser.extractSingleDishFromMultiPost({
        sourceUrl,
        platform,
        groupLabel: typeof body.groupLabel === 'string' && body.groupLabel.trim() ? body.groupLabel.trim() : 'מתכוני קרוסלה',
        captionText: typeof body.captionText === 'string' ? body.captionText : undefined,
        totalDishes: Math.max(2, Number(body.totalDishes) || 2),
        dish: {
          dishId,
          slideIndex: Math.max(1, Number(dish.slideIndex) || 1),
          title: dish.title.trim(),
          summary: typeof dish.summary === 'string' ? dish.summary : '',
          imageUrl: typeof dish.imageUrl === 'string' ? dish.imageUrl : undefined,
          videoUrl: typeof dish.videoUrl === 'string' ? dish.videoUrl : undefined,
          slideText: typeof dish.slideText === 'string' ? dish.slideText : undefined,
          aiCompleted: Boolean(dish.aiCompleted),
          cropBox: validateNormalizedCropBox(dish.cropBox),
          sharedSlideCount: Number(dish.sharedSlideCount) || 1,
        }
      });

      storage.save(recipe);

      // Durable server-side cloud save immediately as each batch recipe completes (FIX 1A & 1D)
      const persistedToCloud = await persistRecipesForAuthenticatedUser(effectiveUserId, [recipe]);

      let quotaCharged = false;
      if (effectiveUserId && !alreadyChargedForBatch) {
        await SyncService.incrementUsage(effectiveUserId);
        chargedMultiDishBatches.set(batchQuotaKey, Date.now());
        quotaCharged = true;
      }

      // Incrementally record completed & pending dishes in the durable batch job (FIX 1B & 1D)
      await ExtractionJobService.appendCarouselDishResult({
        jobId: batchId,
        ownerUserId: effectiveUserId,
        dishId,
        recipe,
        totalExpected: body.totalSelected || (Array.isArray(body.allDishIds) ? body.allDishIds.length : undefined),
        allDishIds: Array.isArray(body.allDishIds) ? body.allDishIds : undefined,
        persistedToCloud,
        quotaCharged: quotaCharged || alreadyChargedForBatch,
        sourceUrl,
        groupLabel: body.groupLabel,
      });

      const latestUsage = effectiveUserId ? await SyncService.checkUsageLimit(effectiveUserId) : undefined;
      return reply.send({
        success: true,
        jobId: batchId,
        jobToken,
        recipe,
        persistedToCloud,
        quotaCharged,
        usage: latestUsage,
      });
    } catch (err: any) {
      const message = err?.message || 'לא הצלחנו לחלץ את המתכון מהשקופית הזו.';
      return reply.status(422).send({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message,
        jobId: batchId,
      });
    }
  });

  // POST /api/v1/recipes/extract-content (P9 & FIX 1: Extract recipe from pasted text or uploaded screenshot/photo)
  fastify.post('/extract-content', { bodyLimit: 10 * 1024 * 1024 }, async (
    request: FastifyRequest<{ Body: { text?: string; imageBase64?: string; mimeType?: string; userId?: string; jobId?: string } }>,
    reply: FastifyReply
  ) => {
    const body = (request.body || {}) as { text?: string; imageBase64?: string; mimeType?: string; userId?: string; jobId?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim() : '';
    const mimeType = typeof body.mimeType === 'string' && body.mimeType.startsWith('image/') ? body.mimeType : 'image/jpeg';

    if (!text && !imageBase64) {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'נא להדביק טקסט של מתכון או להעלות תמונה / צילום מסך.'
      });
    }

    const effectiveUserId = resolveUserId(request, body.userId);
    const { job: trackedJob, jobToken, alreadyExisted } = await ExtractionJobService.initJob({
      jobId: body.jobId,
      ownerUserId: effectiveUserId,
      mode: imageBase64 ? 'image' : 'text',
    });

    if (alreadyExisted && trackedJob.status === 'completed') {
      const latestUsage = effectiveUserId ? await SyncService.checkUsageLimit(effectiveUserId) : undefined;
      const primary = trackedJob.recipes[0] || null;
      return reply.send({
        success: true,
        idempotentReplay: true,
        jobId: trackedJob.jobId,
        jobToken,
        persistedToCloud: trackedJob.persistedToCloud,
        recipe: primary,
        recipes: trackedJob.recipes,
        usage: latestUsage,
        ...(primary || {}),
      });
    }

    if (!trackedJob.quotaCharged) {
      if (!(await enforceExtractionQuota(reply, effectiveUserId))) {
        await ExtractionJobService.saveJob({ ...trackedJob, status: 'failed', error: 'QUOTA_EXCEEDED' });
        return;
      }
    }

    const raw = {
      sourceUrl: '', // No external social link for manually pasted text or screenshots
      platform: 'web' as const,
      titleHint: 'מתכון מיובא',
      captionText: text || 'מתכון מתמונה / צילום מסך שהועלה על ידי המשתמש',
      hasDirectCaption: Boolean(text),
      inlineImageBase64: imageBase64 || undefined,
      inlineImageMimeType: imageBase64 ? mimeType : undefined,
    };

    let recipes;
    try {
      recipes = await parser.parseToRecipes(raw);
    } catch (err: any) {
      await ExtractionJobService.saveJob({
        ...trackedJob,
        status: 'failed',
        error: err?.message || 'Extraction failed',
      });
      request.log.error({ err }, '[EXTRACT_CONTENT] Failed to extract recipe from text/image');
      return reply.status(500).send({
        error: 'Extraction failed',
        message: 'אירעה תקלה זמנית בשרת העיבוד. ניתן לנסות שוב בעוד רגע.',
        jobId: trackedJob.jobId,
      });
    }
    for (const r of recipes) {
      storage.save(r);
    }

    const persistedToCloud = await persistRecipesForAuthenticatedUser(effectiveUserId, recipes);

    let latestUsage = undefined;
    let quotaCharged = trackedJob.quotaCharged;
    if (recipes.length > 0 && effectiveUserId) {
      if (!quotaCharged) {
        await SyncService.incrementUsage(effectiveUserId);
        quotaCharged = true;
      }
      latestUsage = await SyncService.checkUsageLimit(effectiveUserId);
    }

    await ExtractionJobService.saveJob({
      ...trackedJob,
      status: 'completed',
      recipes,
      quotaCharged,
      persistedToCloud,
    });

    const primary = recipes.length > 0 ? recipes[0] : null;
    return reply.send({
      success: true,
      jobId: trackedJob.jobId,
      jobToken,
      persistedToCloud,
      recipe: primary,
      recipes,
      usage: latestUsage,
      ...(primary || {}),
    });
  });

  // GET /api/v1/recipes/trends (Live Culinary Social Media Trends)
  fastify.get('/trends', async (request, reply) => {
    const { category, platform, search } = request.query as {
      category?: string;
      platform?: string;
      search?: string;
    };
    const trendService = TrendDiscoveryService.getInstance();
    const trends = await trendService.getTrends(category, platform, search);
    return reply.send(trends);
  });

  // GET /api/v1/recipes (List all stored recipes)
  fastify.get('/', async (_request, reply) => {
    const recipes = storage.getAll();
    return reply.send({
      recipes,
      total: recipes.length
    });
  });

  // GET /api/v1/recipes/:id (Get single recipe)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const recipe = storage.getById(id);

    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    return reply.send(recipe);
  });

  // DELETE /api/v1/recipes/:id (Delete recipe & auto-revoke single-recipe share if authenticated)
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = storage.delete(id);
    const effectiveUserId = resolveUserId(request);
    if (effectiveUserId && !effectiveUserId.startsWith('anon_')) {
      await GrowthStoreService.revokeSharesForDeletedRecipe(effectiveUserId, id);
    }

    if (!success) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    return reply.send({ success: true, message: 'Recipe deleted' });
  });

  // GET /api/v1/recipes/image-proxy (Safe server-side proxy for expiring / hotlink-protected social thumbnails)
  const ALLOWED_CDN_DOMAINS = [
    'cdninstagram.com',
    'fbcdn.net',
    'instagram.com',
    'tiktokcdn.com',
    'tiktokcdn-us.com',
    'tiktokcdn-eu.com',
    'tiktokcdn-in.com',
    'byteoversea.com',
    'ibyteimg.com',
    'muscdn.com',
    'tiktokv.com',
    'ytimg.com',
    'ggpht.com',
  ];

  fastify.get('/image-proxy', async (request: FastifyRequest<{ Querystring: { url?: string; category?: string; title?: string; crop?: string } }>, reply: FastifyReply) => {
    const targetUrl = request.query?.url;
    const category = request.query?.category;
    const title = request.query?.title;
    const cropParam = request.query?.crop;
    const defaultFallbackUrl = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop';
    const fallbackUrl = ((category || title)
      ? parser.resolveThematicFoodImage(title || '', category ? [category] : [])
      : undefined) || defaultFallbackUrl;
    const redirectToFallback = () =>
      reply.header('Cache-Control', 'public, max-age=300').redirect(fallbackUrl, 302);

    // If a crop was requested for a multi-dish slide, validate strictly; never serve an uncropped multi-dish slide on malformed crop!
    const requestedCropBox = cropParam ? parseCropParam(cropParam) : null;
    if (cropParam && !requestedCropBox) {
      return redirectToFallback();
    }

    if (!targetUrl || typeof targetUrl !== 'string') {
      return redirectToFallback();
    }

    try {
      const parsed = new URL(targetUrl);
      // Validate protocol - strictly HTTPS
      if (parsed.protocol !== 'https:') {
        return redirectToFallback();
      }

      // Domain Whitelist: only permitted social media CDNs
      const hostname = parsed.hostname.toLowerCase();
      const isAllowedDomain = ALLOWED_CDN_DOMAINS.some(
        domain => hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isAllowedDomain) {
        return redirectToFallback();
      }

      // Prevent SSRF to internal/private IPs
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname === '169.254.169.254' ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.local')
      ) {
        return redirectToFallback();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      let safeContentType = 'image/jpeg';
      let buffer: Buffer;

      try {
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        if (!response.ok) {
          return redirectToFallback();
        }

        const rawContentType = (response.headers.get('content-type') || '').toLowerCase();
        // Whitelist only safe raster image content types (prevent SVG XSS)
        if (rawContentType.includes('image/webp')) safeContentType = 'image/webp';
        else if (rawContentType.includes('image/png')) safeContentType = 'image/png';
        else if (rawContentType.includes('image/avif')) safeContentType = 'image/avif';
        else if (rawContentType.includes('image/gif')) safeContentType = 'image/gif';
        else if (rawContentType.includes('image/jpeg') || rawContentType.includes('image/jpg')) safeContentType = 'image/jpeg';
        else {
          // Disallowed image type (e.g. svg or html masquerading)
          return redirectToFallback();
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > 5 * 1024 * 1024) { // Max 5MB
          return redirectToFallback();
        }

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        if (buffer.byteLength > 5 * 1024 * 1024) {
          return redirectToFallback();
        }

        if (requestedCropBox) {
          const cropped = cropImageBuffer(buffer, safeContentType, requestedCropBox);
          if (!cropped) {
            // Never return an uncropped multi-dish slide when per-dish crop fails
            return redirectToFallback();
          }
          buffer = cropped.buffer;
          safeContentType = cropped.contentType;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      return reply
        .header('Content-Type', safeContentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'public, max-age=86400, s-maxage=86400')
        .header('Access-Control-Allow-Origin', '*')
        .send(buffer);
    } catch {
      return redirectToFallback();
    }
  });
};
