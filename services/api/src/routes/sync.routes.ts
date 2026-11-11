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

    const recipes = await SyncService.pullRecipes(session.userId);
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

    // 1. Push local recipes to Neon DB with deduplication and bookmark union
    if (Array.isArray(localList) && localList.length > 0) {
      await SyncService.pushRecipes(session.userId, localList);
    }

    // 2. Pull all cloud recipes for user (now deduplicated and cleanly merged)
    const cloudRecipes = await SyncService.pullRecipes(session.userId);

    // 3. Merge: recipes from cloud take precedence, deduplicate by ID, URL, and Title
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();

    const mergedRecipes: any[] = [];
    for (const r of cloudRecipes) {
      const normUrl = r.sourceUrl ? SyncService.normalizeSocialUrl(r.sourceUrl) : null;
      const normTitle = SyncService.normalizeTitle(r.title);

      seenIds.add(r.id);
      if (normUrl) seenUrls.add(normUrl);
      if (normTitle) seenTitles.add(normTitle);
      mergedRecipes.push(r);
    }

    for (const local of localList) {
      if (!local || !local.title) continue;
      const localNormUrl = local.sourceUrl ? SyncService.normalizeSocialUrl(local.sourceUrl) : null;
      const localNormTitle = SyncService.normalizeTitle(local.title);

      const isDuplicate =
        seenIds.has(local.id) ||
        (localNormUrl && seenUrls.has(localNormUrl)) ||
        (!localNormUrl && localNormTitle && seenTitles.has(localNormTitle));

      if (!isDuplicate) {
        seenIds.add(local.id);
        if (localNormUrl) seenUrls.add(localNormUrl);
        if (localNormTitle) seenTitles.add(localNormTitle);
        mergedRecipes.push(local);
      }
    }

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

