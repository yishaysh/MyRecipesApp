import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, UserSession } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';
import {
  GrowthStoreError,
  GrowthStoreService,
  isBotOrPreviewUserAgent,
  isSharingEnabled,
  opaqueAnalyticsId,
  sanitizeRecipeForSnapshot,
  ShareType,
} from '../services/growth-store.service.js';
import { renderPublicShareHtml, renderRevokedShareHtml } from '../views/public-share.html.js';

const ALLOWED_CLIENT_ANALYTICS_EVENTS = new Set([
  'share_link_copied',
  'save_cta_clicked',
  'signup_started',
  'signup_completed',
  'ingredients_cta_viewed',
  'ingredients_cta_clicked',
  'shopping_list_confirmed',
  'merchant_selected',
  'ingredient_search_clicked',
]);

const ALLOWED_IMAGE_CDN_HOSTS = [
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
  'images.unsplash.com',
  'my-recipes-app-mu.vercel.app',
  'raw.githubusercontent.com',
];

const PLACEHOLDER_RECIPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#ecfdf5"/><text x="300" y="210" font-size="64" text-anchor="middle">🍽️</text></svg>`;

function isPrivateOrDisallowedImageHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '169.254.169.254' ||
    lower.endsWith('.internal') ||
    lower.endsWith('.local') ||
    /^10\./.test(lower) ||
    /^192\.168\./.test(lower) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(lower)
  ) {
    return true;
  }
  return !ALLOWED_IMAGE_CDN_HOSTS.some((d) => lower === d || lower.endsWith(`.${d}`));
}

function setPublicPrivacyHeaders(reply: FastifyReply): void {
  reply
    .header('Cache-Control', 'no-store, no-cache, must-revalidate')
    .header('Referrer-Policy', 'no-referrer')
    .header('X-Robots-Tag', 'noindex, nofollow');
}

function getBaseUrlFromRequest(request: FastifyRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  const host = request.headers.host;
  const proto = request.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

function requireRegisteredUser(request: FastifyRequest, reply: FastifyReply): UserSession | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      error: 'AUTH_REQUIRED',
      message: 'יש להתחבר לחשבון חינמי כדי לשתף או לשמור מתכונים משותפים',
    });
    return null;
  }
  const session = AuthService.verifySessionToken(authHeader.substring(7));
  if (!session || session.userId.startsWith('guest_') || session.userId.startsWith('anon_')) {
    reply.status(401).send({
      error: 'AUTH_REQUIRED',
      message: 'פעולה זו זמינה למשתמשים רשומים (בחינם). אנא התחברו תחילה.',
    });
    return null;
  }
  return session;
}

function handleStoreError(reply: FastifyReply, err: unknown) {
  if (err instanceof GrowthStoreError) {
    return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  }
  console.error('[SharesRouteError]', err);
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'אירעה שגיאה בשרת בעת יצירת קישור השיתוף. נסו שוב בעוד רגע.',
  });
}

export const sharesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/shares - Create single-recipe or book share (or update book snapshot)
  fastify.post('/api/v1/shares', async (request, reply) => {
    if (!isSharingEnabled()) {
      return reply.status(503).send({ error: 'SHARING_DISABLED', message: 'השיתוף מושבת זמנית' });
    }
    const session = requireRegisteredUser(request, reply);
    if (!session) return;

    const body = (request.body || {}) as {
      type?: ShareType;
      recipes?: any[];
      shareIdToUpdate?: string;
      rightsConfirmed?: boolean;
      ogConsent?: boolean;
      sharerDisplayName?: string;
      bookTitle?: string;
    };

    if (!body.rightsConfirmed) {
      return reply.status(400).send({
        error: 'RIGHTS_CONFIRMATION_REQUIRED',
        message: 'יש לאשר שיש לך זכות לשתף את התוכן לפני יצירת קישור',
      });
    }

    const type: ShareType = body.type === 'book' ? 'book' : 'recipe';
    const recipesList = Array.isArray(body.recipes) ? body.recipes : [];

    try {
      const result = await GrowthStoreService.createOrUpdateShare({
        ownerUserId: session.userId,
        type,
        recipes: recipesList,
        shareIdToUpdate: body.shareIdToUpdate,
        ogConsent: Boolean(body.ogConsent),
        sharerDisplayName: body.sharerDisplayName ? (body.sharerDisplayName === '__profile__' ? session.name || null : body.sharerDisplayName) : null,
        bookTitle: body.bookTitle ?? null,
      });

      await GrowthStoreService.recordAnalyticsEvent({
        eventName: result.updated ? 'share_updated' : 'share_created',
        opaqueUserId: opaqueAnalyticsId(session.userId),
        shareId: result.share.id,
        snapshotVersion: result.share.snapshotVersion,
        metadata: { type: result.share.type, recipeCount: result.snapshot.recipeCount },
      }).catch(() => {});

      return reply.status(result.updated ? 200 : 201).send({
        success: true,
        shareId: result.share.id,
        type: result.share.type,
        status: result.share.status,
        snapshotVersion: result.share.snapshotVersion,
        recipeCount: result.snapshot.recipeCount,
        updated: result.updated,
        ...(result.rawToken
          ? {
              token: result.rawToken,
              shareUrl: `/s/${result.rawToken}`,
            }
          : {}),
      });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // GET /api/v1/shares - List owner's shares
  fastify.get('/api/v1/shares', async (request, reply) => {
    const session = requireRegisteredUser(request, reply);
    if (!session) return;

    try {
      const shares = await GrowthStoreService.listSharesForOwner(session.userId);
      return reply.send({
        shares: shares.map((s) => ({
          shareId: s.id,
          type: s.type,
          status: s.status,
          snapshotVersion: s.snapshotVersion,
          recipeCount: s.recipeCount,
          titleSummary: s.titleSummary,
          ogConsent: s.ogConsent,
          sharerDisplayName: s.sharerDisplayName,
          bookTitle: s.bookTitle,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          revokedAt: s.revokedAt,
        })),
      });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // POST /api/v1/shares/:shareId/revoke - Revoke share immediately
  fastify.post('/api/v1/shares/:shareId/revoke', async (request, reply) => {
    const session = requireRegisteredUser(request, reply);
    if (!session) return;
    const { shareId } = request.params as { shareId: string };

    try {
      const revoked = await GrowthStoreService.revokeShare(shareId, session.userId);
      if (!revoked) {
        return reply.status(404).send({ error: 'SHARE_NOT_FOUND', message: 'השיתוף לא נמצא' });
      }
      await GrowthStoreService.recordAnalyticsEvent({
        eventName: 'share_revoked',
        opaqueUserId: opaqueAnalyticsId(session.userId),
        shareId: revoked.id,
        snapshotVersion: revoked.snapshotVersion,
      }).catch(() => {});

      return reply.send({
        success: true,
        shareId: revoked.id,
        status: revoked.status,
        revokedAt: revoked.revokedAt,
        notice: 'הקישור בוטל מיד. עותקים שכבר נשמרו אצל אחרים או תצוגות מקדימות בצ׳אט אינם ניתנים למחיקה.',
      });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // GET /api/public/shares/:token - Strictly whitelisted public snapshot JSON
  fastify.get('/api/public/shares/:token', async (request, reply) => {
    setPublicPrivacyHeaders(reply);
    const { token } = request.params as { token: string };

    try {
      const found = await GrowthStoreService.getShareByRawToken(token);
      if (!found) {
        return reply.status(404).send({ error: 'SHARE_NOT_FOUND', message: 'הקישור לא נמצא' });
      }
      if (found.share.status === 'revoked') {
        return reply.status(410).send({
          error: 'SHARE_REVOKED',
          message: 'הקישור בוטל',
          notice: 'בעל השיתוף ביטל את הקישור או שהמתכון הוסר. תצוגות מקדימות או עותקים שכבר נשמרו אצל אחרים אינם ניתנים למחיקה.',
        });
      }

      const isBot = isBotOrPreviewUserAgent(request.headers['user-agent']);
      if (!isBot) {
        await GrowthStoreService.markShareViewed(found.share.id).catch(() => {});
        await GrowthStoreService.recordAnalyticsEvent({
          eventName: 'share_view',
          shareId: found.share.id,
          snapshotVersion: found.snapshot.snapshotVersion,
          isBot: false,
          metadata: { channel: 'api', type: found.share.type },
        }).catch(() => {});
      }

      const publicRecipes = found.snapshot.payload.recipes.map((r) => {
        const clean = sanitizeRecipeForSnapshot(r);
        return {
          ...clean,
          imageUrl: clean.imageUrl
            ? `/api/public/shares/${encodeURIComponent(token)}/image?recipeId=${encodeURIComponent(clean.id)}`
            : null,
        };
      });

      return reply.send({
        shareId: found.share.id,
        type: found.share.type,
        status: found.share.status,
        snapshotVersion: found.snapshot.snapshotVersion,
        createdAt: found.share.createdAt,
        sharerDisplayName: found.snapshot.payload.sharerDisplayName ?? null,
        bookTitle: found.snapshot.payload.bookTitle ?? null,
        recipes: publicRecipes,
      });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // GET /api/public/shares/:token/image - Controlled image access verifying share is still active
  fastify.get('/api/public/shares/:token/image', async (request, reply) => {
    setPublicPrivacyHeaders(reply);
    const { token } = request.params as { token: string };
    const { recipeId } = (request.query || {}) as { recipeId?: string };

    try {
      const found = await GrowthStoreService.getShareByRawToken(token);
      if (!found) {
        return reply.status(404).send({ error: 'SHARE_NOT_FOUND' });
      }
      if (found.share.status === 'revoked') {
        return reply.status(410).send({ error: 'SHARE_REVOKED', message: 'הקישור בוטל' });
      }

      const targetRecipe = recipeId
        ? found.snapshot.payload.recipes.find((r) => r.id === recipeId)
        : found.snapshot.payload.recipes[0];
      const targetUrl = targetRecipe?.imageUrl;
      if (!targetUrl) {
        return reply.type('image/svg+xml').send(PLACEHOLDER_RECIPE_SVG);
      }

      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'https:' || isPrivateOrDisallowedImageHost(parsed.hostname)) {
          return reply.type('image/svg+xml').send(PLACEHOLDER_RECIPE_SVG);
        }
        const upstream = await fetch(parsed.toString(), { signal: AbortSignal.timeout(5000) });
        if (!upstream.ok) {
          return reply.type('image/svg+xml').send(PLACEHOLDER_RECIPE_SVG);
        }
        const ct = upstream.headers.get('content-type') || 'image/jpeg';
        if (!ct.startsWith('image/')) {
          return reply.type('image/svg+xml').send(PLACEHOLDER_RECIPE_SVG);
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        return reply.type(ct).send(buf);
      } catch {
        return reply.type('image/svg+xml').send(PLACEHOLDER_RECIPE_SVG);
      }
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // GET /s/:token - Server-rendered public share HTML (Open Graph + read-only UI)
  fastify.get('/s/:token', async (request, reply) => {
    setPublicPrivacyHeaders(reply);
    const { token } = request.params as { token: string };
    const baseUrl = getBaseUrlFromRequest(request);

    try {
      const found = await GrowthStoreService.getShareByRawToken(token);
      if (!found) {
        return reply.status(404).type('text/html; charset=utf-8').send(renderRevokedShareHtml({ notFound: true, baseUrl }));
      }
      if (found.share.status === 'revoked') {
        return reply.status(410).type('text/html; charset=utf-8').send(renderRevokedShareHtml({ notFound: false, baseUrl }));
      }

      const isBot = isBotOrPreviewUserAgent(request.headers['user-agent']);
      if (!isBot) {
        await GrowthStoreService.markShareViewed(found.share.id).catch(() => {});
        await GrowthStoreService.recordAnalyticsEvent({
          eventName: 'share_view',
          shareId: found.share.id,
          snapshotVersion: found.snapshot.snapshotVersion,
          isBot: false,
          metadata: { channel: 'web', type: found.share.type },
        }).catch(() => {});
      }

      return reply.status(200).type('text/html; charset=utf-8').send(
        renderPublicShareHtml({
          share: found.share,
          snapshot: found.snapshot,
          rawToken: token,
          baseUrl,
        })
      );
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // POST /api/public/shares/:token/report - Public takedown report intake
  fastify.post('/api/public/shares/:token/report', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = (request.body || {}) as { reason?: string; details?: string };

    try {
      const found = await GrowthStoreService.getShareByRawToken(token);
      if (!found) {
        return reply.status(404).send({ error: 'SHARE_NOT_FOUND', message: 'השיתוף לא נמצא' });
      }
      const report = await GrowthStoreService.createShareReport({
        shareId: found.share.id,
        reason: body.reason || 'other',
        details: body.details ?? null,
        reporterIp: request.ip || null,
      });
      await GrowthStoreService.recordAnalyticsEvent({
        eventName: 'share_reported',
        shareId: found.share.id,
        metadata: { reason: report.reason },
      }).catch(() => {});

      return reply.status(201).send({ success: true, reportId: report.id });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // POST /api/v1/shares/:token/save - Save shared recipe(s) to recipient's book (FREE, zero quota impact)
  fastify.post('/api/v1/shares/:token/save', async (request, reply) => {
    const session = requireRegisteredUser(request, reply);
    if (!session) return;

    const { token } = request.params as { token: string };
    const body = (request.body || {}) as {
      recipeIds?: string[] | null;
      forceDuplicate?: boolean;
      simulateFailIds?: string[]; // test-only hook in NODE_ENV=test to verify partial book failures
    };
    const idempotencyKeyHeader = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader || null;

    try {
      // Always re-verify current share status right before saving (handles revocation mid-signup!)
      const found = await GrowthStoreService.getShareByRawToken(token);
      if (!found) {
        return reply.status(404).send({ error: 'SHARE_NOT_FOUND', message: 'קישור השיתוף לא נמצא' });
      }
      if (found.share.status === 'revoked') {
        return reply.status(410).send({
          error: 'SHARE_REVOKED',
          message: 'הקישור בוטל על ידי המשתף לפני השלמת השמירה',
        });
      }

      const snapshotRecipes = found.snapshot.payload.recipes || [];
      const targetRecipes =
        Array.isArray(body.recipeIds) && body.recipeIds.length > 0
          ? snapshotRecipes.filter((r) => body.recipeIds!.includes(r.id))
          : snapshotRecipes;

      if (targetRecipes.length === 0) {
        return reply.status(400).send({ error: 'NO_RECIPES_SELECTED', message: 'לא נמצאו מתכונים לשמירה' });
      }

      const items: Array<{ sourceRecipeId: string; savedRecipeId?: string; status: 'saved' | 'already_saved' | 'failed'; message?: string }> = [];
      let savedCount = 0;
      let alreadySavedCount = 0;
      let failedCount = 0;

      for (const srcRecipe of targetRecipes) {
        if (process.env.NODE_ENV === 'test' && Array.isArray(body.simulateFailIds) && body.simulateFailIds.includes(srcRecipe.id)) {
          failedCount++;
          items.push({ sourceRecipeId: srcRecipe.id, status: 'failed', message: 'Simulated save failure' });
          continue;
        }

        const existingOrigin = await GrowthStoreService.findSavedOrigin(
          session.userId,
          found.share.id,
          srcRecipe.id,
          idempotencyKey
        );

        if (existingOrigin && !body.forceDuplicate) {
          alreadySavedCount++;
          items.push({
            sourceRecipeId: srcRecipe.id,
            savedRecipeId: existingOrigin.savedRecipeId,
            status: 'already_saved',
            message: 'המתכון כבר שמור בספר שלך',
          });
          continue;
        }

        const newRecipeId = `rcp_${crypto.randomUUID()}`;
        const copyPayload = {
          ...sanitizeRecipeForSnapshot(srcRecipe),
          id: newRecipeId,
          sharedCopyNonce: crypto.randomUUID(),
          sourceCredit: srcRecipe.sourceCredit || srcRecipe.sourceUrl || null,
          savedFromShare: {
            shareId: found.share.id,
            snapshotVersion: found.snapshot.snapshotVersion,
            sourceRecipeId: srcRecipe.id,
            sharerDisplayName: found.snapshot.payload.sharerDisplayName || null,
            savedAt: new Date().toISOString(),
          },
        };

        try {
          // NOTE: Intentionally NEVER calls SyncService.incrementUsage or LlmParserService!
          const savedCopy = await SyncService.insertSharedRecipeCopy(session.userId, copyPayload);
          await GrowthStoreService.recordSavedOrigin({
            recipientUserId: session.userId,
            savedRecipeId: savedCopy.id,
            sourceShareId: found.share.id,
            sourceSnapshotId: found.snapshot.id,
            sourceSnapshotVersion: found.snapshot.snapshotVersion,
            sourceRecipeId: srcRecipe.id,
            idempotencyKey,
          });
          savedCount++;
          items.push({ sourceRecipeId: srcRecipe.id, savedRecipeId: savedCopy.id, status: 'saved' });
        } catch (err: any) {
          failedCount++;
          items.push({ sourceRecipeId: srcRecipe.id, status: 'failed', message: err?.message || 'Save failed' });
        }
      }

      if (savedCount > 0) {
        await GrowthStoreService.recordAnalyticsEvent({
          eventName: 'shared_recipe_saved',
          opaqueUserId: opaqueAnalyticsId(session.userId),
          shareId: found.share.id,
          snapshotVersion: found.snapshot.snapshotVersion,
          metadata: { savedCount, totalCount: targetRecipes.length, type: found.share.type },
        }).catch(() => {});
      }

      return reply.status(failedCount > 0 && savedCount === 0 ? 500 : 200).send({
        success: failedCount === 0 || savedCount > 0 || alreadySavedCount > 0,
        savedCount,
        alreadySavedCount,
        failedCount,
        totalCount: targetRecipes.length,
        alreadySaved: alreadySavedCount > 0 && savedCount === 0 && failedCount === 0,
        items,
      });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });

  // POST /api/public/analytics - Client event intake (stripped of PII / raw share tokens)
  fastify.post('/api/public/analytics', async (request, reply) => {
    const body = (request.body || {}) as {
      eventName?: string;
      shareId?: string;
      snapshotVersion?: number;
      merchantId?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.eventName || !ALLOWED_CLIENT_ANALYTICS_EVENTS.has(body.eventName)) {
      return reply.status(400).send({ error: 'INVALID_EVENT', message: 'שם אירוע אינו מורשה' });
    }

    if (isBotOrPreviewUserAgent(request.headers['user-agent'])) {
      return reply.send({ success: true, ignoredBot: true });
    }

    // Strip any accidental sensitive keys from metadata
    const cleanMeta: Record<string, unknown> = {};
    if (body.metadata && typeof body.metadata === 'object') {
      for (const [k, v] of Object.entries(body.metadata)) {
        const lk = k.toLowerCase();
        if (lk.includes('token') || lk.includes('email') || lk.includes('password') || lk.includes('note')) {
          continue;
        }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || Array.isArray(v)) {
          cleanMeta[k] = v;
        }
      }
    }

    const authHeader = request.headers.authorization;
    let opaqueUser: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const s = AuthService.verifySessionToken(authHeader.substring(7));
      if (s) opaqueUser = opaqueAnalyticsId(s.userId);
    }

    try {
      await GrowthStoreService.recordAnalyticsEvent({
        eventName: body.eventName,
        opaqueUserId: opaqueUser,
        shareId: body.shareId ?? null,
        snapshotVersion: typeof body.snapshotVersion === 'number' ? body.snapshotVersion : null,
        merchantId: body.merchantId ?? null,
        metadata: cleanMeta,
        isBot: false,
      });
      return reply.send({ success: true });
    } catch (err) {
      return handleStoreError(reply, err);
    }
  });
};
