import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ParseRecipeRequestSchema } from '../shared/index.js';
import { JobQueueService } from '../services/job-queue.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { ExtractorService } from '../services/extractor.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';
import { TrendDiscoveryService } from '../services/trend-discovery.service.js';
import { AuthService } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';

function resolveUserId(request: FastifyRequest, bodyUserId?: string): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (session) return session.userId;
  }
  return bodyUserId;
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

  // POST /api/v1/recipes/fast-parse (Synchronous direct parsing for instant response)
  fastify.post('/fast-parse', async (request, reply) => {
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

    // Check Global Recipe Cache
    const cachedRecipe = await SyncService.getFromGlobalCache(sourceUrl);
    if (cachedRecipe) {
      storage.save(cachedRecipe);
      if (effectiveUserId) {
        await SyncService.incrementUsage(effectiveUserId);
      }
      return reply.send(cachedRecipe);
    }

    const raw = await extractor.extractRawContent(sourceUrl);
    const recipes = await parser.parseToRecipes(raw);
    for (const r of recipes) {
      storage.save(r);
    }

    if (recipes.length > 0) {
      await SyncService.saveToGlobalCache(sourceUrl, recipes[0]);
    }

    if (effectiveUserId) {
      await SyncService.incrementUsage(effectiveUserId);
    }

    if (recipes.length === 1) {
      return reply.send(recipes[0]);
    }
    return reply.send({ recipe: recipes[0], recipes });
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

  // DELETE /api/v1/recipes/:id (Delete recipe)
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = storage.delete(id);

    if (!success) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    return reply.send({ success: true, message: 'Recipe deleted' });
  });
};
