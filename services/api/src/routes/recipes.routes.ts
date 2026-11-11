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

function resolveUserId(request: FastifyRequest, bodyUserId?: string): string {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (session) return session.userId;
  }

  // In automated test environment, permit explicit test user ID from payload
  if (process.env.NODE_ENV === 'test' && bodyUserId) {
    return bodyUserId;
  }

  // Secure fallback: Derive guest ID from client IP to prevent quota bypass and victim quota depletion IDOR
  const rawIp = request.ip || (request.headers['x-forwarded-for'] as string) || '127.0.0.1';
  const ipHash = crypto.createHash('md5').update(String(rawIp)).digest('hex').substring(0, 16);
  return `anon_${ipHash}`;
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

    const { sourceUrl, userId: bodyUserId } = parseResult.data;
    const effectiveUserId = resolveUserId(request, bodyUserId);

    // Freemium Quota Enforcement
    if (effectiveUserId) {
      const usage = await SyncService.checkUsageLimit(effectiveUserId);
      if (!usage.allowed) {
        return reply.status(403).send({
          error: 'QUOTA_EXCEEDED',
          message: 'מיצית את מכסת 5 החילוצים החודשית החינמית. שדרג ל-Pro לחילוצים ללא הגבלה!',
          usage,
        });
      }
    }

    // On Vercel / serverless runtime, process synchronously so it completes before response closes
    if (process.env.VERCEL) {
      const completedJob = await jobQueue.createJobAsync(sourceUrl, effectiveUserId);
      return reply.status(200).send(completedJob);
    }

    const job = jobQueue.createJob(sourceUrl, effectiveUserId);
    return reply.status(202).send(job);
  });

  // GET /api/v1/recipes/jobs/:jobId (Poll job status)
  fastify.get('/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobQueue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send(job);
  });

  // Synchronous fast extraction handler (supports /fast-parse and /extract alias)
  const handleFastExtraction = async (
    request: FastifyRequest<{ Body: { sourceUrl?: string; url?: string; userId?: string } }>,
    reply: FastifyReply
  ) => {
    const body = (request.body || {}) as { sourceUrl?: string; url?: string; userId?: string };
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
    const effectiveUserId = resolveUserId(request, bodyUserId);

    // Freemium Quota Enforcement
    if (effectiveUserId) {
      const usage = await SyncService.checkUsageLimit(effectiveUserId);
      if (!usage.allowed) {
        return reply.status(403).send({
          error: 'QUOTA_EXCEEDED',
          message: 'מיצית את מכסת 5 החילוצים החודשית החינמית. שדרג ל-Pro לחילוצים ללא הגבלה!',
          usage,
        });
      }
    }

    // Check Global Recipe Cache
    const cachedData = await SyncService.getFromGlobalCache(sourceUrl);
    if (cachedData) {
      const cachedRecipes = Array.isArray(cachedData.recipes) ? cachedData.recipes : [cachedData];
      for (const r of cachedRecipes) {
        storage.save(r);
      }
      if (effectiveUserId) {
        await SyncService.incrementUsage(effectiveUserId);
      }
      const primary = cachedData.primary || cachedRecipes[0];
      return reply.send({ success: true, recipe: primary, recipes: cachedRecipes, ...(primary || {}) });
    }

    const raw = await extractor.extractRawContent(sourceUrl);
    const recipes = await parser.parseToRecipes(raw);
    for (const r of recipes) {
      storage.save(r);
    }

    if (recipes.length > 0) {
      await SyncService.saveToGlobalCache(sourceUrl, { recipes, primary: recipes[0] });
      if (effectiveUserId) {
        await SyncService.incrementUsage(effectiveUserId);
      }
    }

    const primary = recipes.length > 0 ? recipes[0] : null;
    return reply.send({ success: true, recipe: primary, recipes, ...(primary || {}) });
  };

  // POST /api/v1/recipes/fast-parse
  fastify.post('/fast-parse', handleFastExtraction);

  // POST /api/v1/recipes/extract (Web client alias)
  fastify.post('/extract', handleFastExtraction);

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

  // DELETE /api/v1/recipes/:id (Delete recipe)
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = storage.delete(id);

    if (!success) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    return reply.send({ success: true, message: 'Recipe deleted' });
  });

  // GET /api/v1/recipes/image-proxy (Safe server-side proxy for expiring / hotlink-protected social thumbnails)
  fastify.get('/image-proxy', async (request: FastifyRequest<{ Querystring: { url?: string } }>, reply: FastifyReply) => {
    const targetUrl = request.query?.url;
    const fallbackUrl = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop';

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return reply.redirect(fallbackUrl, 302);
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return reply.redirect(fallbackUrl, 302);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400, s-maxage=86400')
        .header('Access-Control-Allow-Origin', '*')
        .send(buffer);
    } catch {
      return reply.redirect(fallbackUrl, 302);
    }
  });
};
