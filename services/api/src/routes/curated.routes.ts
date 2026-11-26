import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, UserSession } from '../services/auth.service.js';
import { CuratedCollectionsService } from '../services/curated-collections.service.js';
import { renderPublicCollectionHtml, renderPublicCuratedRecipeHtml } from '../views/public-showcase.html.js';

// Simple per-IP in-memory rate limiter for public read endpoints (120 req/min/IP)
const publicReadBuckets = new Map<string, { count: number; resetAt: number }>();

function checkPublicRateLimit(request: FastifyRequest, reply: FastifyReply): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const ip = String(request.ip || request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const bucket = publicReadBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    publicReadBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count++;
  if (bucket.count > 120) {
    reply.status(429).send({ error: 'Too many requests' });
    return false;
  }
  return true;
}

function getAuthenticatedSession(request: FastifyRequest, reply: FastifyReply): UserSession | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Unauthorized: Missing token' });
    return null;
  }
  const session = AuthService.verifySessionToken(authHeader.substring(7));
  if (!session) {
    reply.status(401).send({ error: 'Unauthorized: Invalid token' });
    return null;
  }
  return session;
}

function getBaseUrl(request: FastifyRequest): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const host = request.headers.host || 'my-recipes-app-mu.vercel.app';
  const proto = request.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export const curatedRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Public Showcase API (read-only, cached, rate-limited)
  fastify.get('/api/v1/showcase', async (request, reply) => {
    if (!checkPublicRateLimit(request, reply)) return;
    const [ownerBranding, curatedRecipes, collections] = await Promise.all([
      CuratedCollectionsService.getOwnerSettings(),
      CuratedCollectionsService.listCuratedRecipes({ publishedOnly: true }),
      CuratedCollectionsService.listCuratedCollections({ publishedOnly: true }),
    ]);

    return reply
      .header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
      .send({
        ownerBranding,
        curatedRecipes,
        collections,
        totalPublishedRecipes: curatedRecipes.length,
        totalPublishedCollections: collections.length,
      });
  });

  // 2. Public single curated recipe JSON
  fastify.get('/api/v1/curated/recipes/:slug', async (request, reply) => {
    if (!checkPublicRateLimit(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const curated = await CuratedCollectionsService.getCuratedRecipeBySlug(slug, true);
    if (!curated) return reply.status(404).send({ error: 'Curated recipe not found' });
    const [ownerBranding, allCols] = await Promise.all([
      CuratedCollectionsService.getOwnerSettings(),
      CuratedCollectionsService.listCuratedCollections({ publishedOnly: true }),
    ]);
    const collections = allCols.filter((c) => curated.collectionIds.includes(c.id));
    return reply
      .header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
      .send({ curated, collections, ownerBranding });
  });

  // 3. Public single curated collection JSON
  fastify.get('/api/v1/curated/collections/:slug', async (request, reply) => {
    if (!checkPublicRateLimit(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const result = await CuratedCollectionsService.getCuratedCollectionBySlug(slug, true);
    if (!result) return reply.status(404).send({ error: 'Collection not found' });
    const ownerBranding = await CuratedCollectionsService.getOwnerSettings();
    return reply
      .header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
      .send({ ...result, ownerBranding });
  });

  // 4. Public SEO-friendly curated recipe HTML page (/r/:slug)
  fastify.get('/r/:slug', async (request, reply) => {
    if (!checkPublicRateLimit(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const curated = await CuratedCollectionsService.getCuratedRecipeBySlug(slug, true);
    if (!curated) {
      return reply.status(404).type('text/html; charset=utf-8').send('<html lang="he" dir="rtl"><body><h1>המתכון לא נמצא</h1><a href="/app">חזרה לאפליקציה</a></body></html>');
    }
    const [branding, allCols] = await Promise.all([
      CuratedCollectionsService.getOwnerSettings(),
      CuratedCollectionsService.listCuratedCollections({ publishedOnly: true }),
    ]);
    const collections = allCols.filter((c) => curated.collectionIds.includes(c.id));
    const html = renderPublicCuratedRecipeHtml({
      curated,
      collections,
      branding,
      canonicalUrl: `${getBaseUrl(request)}/r/${encodeURIComponent(curated.slug)}`,
    });
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      .send(html);
  });

  // 5. Public SEO-friendly curated collection HTML page (/c/:slug)
  fastify.get('/c/:slug', async (request, reply) => {
    if (!checkPublicRateLimit(request, reply)) return;
    const { slug } = request.params as { slug: string };
    const result = await CuratedCollectionsService.getCuratedCollectionBySlug(slug, true);
    if (!result) {
      return reply.status(404).type('text/html; charset=utf-8').send('<html lang="he" dir="rtl"><body><h1>הקבוצה לא נמצאה</h1><a href="/app">חזרה לאפליקציה</a></body></html>');
    }
    const branding = await CuratedCollectionsService.getOwnerSettings();
    const html = renderPublicCollectionHtml({
      collection: result.collection,
      recipes: result.recipes,
      branding,
      canonicalUrl: `${getBaseUrl(request)}/c/${encodeURIComponent(result.collection.slug)}`,
    });
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      .send(html);
  });

  // 6. User Personal Collections & Preferences (cloud-synced for signed-in users)
  fastify.get('/api/v1/user/collections', async (request, reply) => {
    const session = getAuthenticatedSession(request, reply);
    if (!session) return;
    const [collections, preferences] = await Promise.all([
      CuratedCollectionsService.listUserCollections(session.userId),
      CuratedCollectionsService.getUserPreferences(session.userId),
    ]);
    return reply.send({ collections, preferences });
  });

  fastify.post('/api/v1/user/collections', async (request, reply) => {
    const session = getAuthenticatedSession(request, reply);
    if (!session) return;
    const body = (request.body || {}) as {
      name?: string;
      subtitle?: string;
      icon?: string;
      colorGradient?: string;
      recipeIds?: string[];
    };
    if (!body.name || !body.name.trim()) {
      return reply.status(400).send({ error: 'נא להזין שם לקבוצה' });
    }
    const created = await CuratedCollectionsService.createCollection({
      scope: 'user',
      ownerUserId: session.userId,
      name: body.name,
      subtitle: body.subtitle,
      icon: body.icon,
      colorGradient: body.colorGradient,
      recipeIds: body.recipeIds,
      published: true,
    });
    return reply.status(201).send({ success: true, collection: created });
  });

  fastify.put('/api/v1/user/collections/:id', async (request, reply) => {
    const session = getAuthenticatedSession(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const updated = await CuratedCollectionsService.updateCollection(id, {
      name: body.name,
      subtitle: body.subtitle,
      icon: body.icon,
      colorGradient: body.colorGradient,
      recipeIds: body.recipeIds,
      sortOrder: body.sortOrder,
    }, session.userId);
    if (!updated) return reply.status(404).send({ error: 'Collection not found' });
    return reply.send({ success: true, collection: updated });
  });

  fastify.delete('/api/v1/user/collections/:id', async (request, reply) => {
    const session = getAuthenticatedSession(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const deleted = await CuratedCollectionsService.deleteCollection(id, session.userId);
    if (!deleted) return reply.status(404).send({ error: 'Collection not found' });
    return reply.send({ success: true });
  });

  fastify.put('/api/v1/user/preferences', async (request, reply) => {
    const session = getAuthenticatedSession(request, reply);
    if (!session) return;
    const body = (request.body || {}) as {
      viewMode?: 'collections' | 'grid';
      onboardingCompleted?: boolean;
      onboardingStep?: number;
    };
    const preferences = await CuratedCollectionsService.updateUserPreferences(session.userId, body);
    return reply.send({ success: true, preferences });
  });
};
