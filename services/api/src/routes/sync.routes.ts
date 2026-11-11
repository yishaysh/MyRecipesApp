import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';

export const syncRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Helper to extract session
  const getSession = (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized: Missing token' });
      return null;
    }
    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (!session) {
      reply.status(401).send({ error: 'Unauthorized: Invalid token' });
      return null;
    }
    return session;
  };

  // POST /api/v1/sync/pull (Fetch user's cloud recipes)
  fastify.post('/pull', async (request, reply) => {
    const session = getSession(request, reply);
    if (!session) return;

    await SyncService.cleanupDuplicateRecipes(session.userId);
    const recipes = SyncService.deduplicateRecipes(await SyncService.pullRecipes(session.userId));
    const usage = await SyncService.checkUsageLimit(session.userId);

    return reply.send({
      recipes,
      total: recipes.length,
      usage,
    });
  });

  // POST /api/v1/sync/push (Batch upload user's local recipes to cloud)
  fastify.post('/push', async (request, reply) => {
    const session = getSession(request, reply);
    if (!session) return;

    const body = request.body as { recipes?: any[] };
    const recipesList = body && Array.isArray(body.recipes) ? body.recipes : [];

    const result = await SyncService.pushRecipes(session.userId, recipesList);
    return reply.send({
      success: true,
      savedCount: result.savedCount,
    });
  });

  // POST /api/v1/sync/recipes (Bidirectional cloud sync for web client & mobile)
  fastify.post('/recipes', async (request, reply) => {
    const session = getSession(request, reply);
    if (!session) return;

    const body = (request.body || {}) as { localRecipes?: any[]; recipes?: any[] };
    const localList = body.localRecipes || body.recipes || [];

    // 1. Push local recipes to Neon DB (or clean up any pre-existing DB duplicates when local is empty)
    if (Array.isArray(localList) && localList.length > 0) {
      await SyncService.pushRecipes(session.userId, localList);
    } else {
      await SyncService.cleanupDuplicateRecipes(session.userId);
    }

    // 2. Pull all cloud recipes for user (deduplicated and cleanly merged)
    const cloudRecipes = await SyncService.pullRecipes(session.userId);

    // 3. Merge cloud + local canonically using mobile-compatible carousel-safe deduplication
    const mergedRecipes = SyncService.deduplicateRecipes([...cloudRecipes, ...(Array.isArray(localList) ? localList : [])]);

    const usage = await SyncService.checkUsageLimit(session.userId);

    return reply.send({
      success: true,
      mergedRecipes,
      cloudCount: cloudRecipes.length,
      usage,
    });
  });

  // GET /api/v1/sync/usage (Check Freemium limit status)
  fastify.get('/usage', async (request, reply) => {
    const session = getSession(request, reply);
    if (!session) return;

    const usage = await SyncService.checkUsageLimit(session.userId);
    return reply.send(usage);
  });
};

