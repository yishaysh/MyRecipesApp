import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { AdminService } from '../services/admin.service.js';
import {
  CommercialAgreement,
  GrowthStoreError,
  GrowthStoreService,
  isReferralsEnabled,
  MerchantStatus,
} from '../services/growth-store.service.js';
import { ChainCatalogService, SUPPORTED_CHAINS } from '../services/catalog/chain-fetchers.js';
import { AutoMapperService } from '../services/catalog/auto-mapper.service.js';
import { getDb } from '../db/index.js';
import { ingredientMappingSuggestions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { Readable } from 'node:stream';

function getAdminJwtSecret(): string {
  return process.env.JWT_SECRET || 'my-recipes-admin-secret-2026';
}

function verifyAdminAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const authHeader = request.headers.authorization;
  const adminTokenHeader = request.headers['x-admin-token'] as string;

  const token = adminTokenHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
  if (!token) {
    reply.status(401).send({ error: 'Missing admin credentials' });
    return false;
  }

  try {
    const decoded = jwt.verify(token, getAdminJwtSecret()) as { role: string };
    if (decoded.role !== 'superadmin') {
      reply.status(403).send({ error: 'Insufficient permissions' });
      return false;
    }
    return true;
  } catch (e) {
    reply.status(401).send({ error: 'Invalid or expired admin session' });
    return false;
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  // 1. Admin Login with master password
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { password?: string };
    if (!body?.password || !AdminService.verifyAdminPassword(body.password)) {
      return reply.status(401).send({ error: 'סיסמת ניהול שגויה' });
    }

    const token = jwt.sign({ role: 'superadmin' }, getAdminJwtSecret(), { expiresIn: '7d' });
    return { success: true, token };
  });

  // 2. System Overview Stats
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const stats = await AdminService.getSystemStats();
    return stats;
  });

  // 3. Promo Codes
  fastify.get('/promo-codes', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const codes = await AdminService.listPromoCodes();
    return { codes };
  });

  fastify.post('/promo-codes', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = request.body as { code: string; discountType?: string; maxUses?: number; notes?: string };
    if (!body?.code) return reply.status(400).send({ error: 'Missing promo code' });

    try {
      const result = await AdminService.createPromoCode(body.code, body.discountType, body.maxUses, body.notes);
      return result;
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || 'Failed to create promo code' });
    }
  });

  fastify.put('/promo-codes/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { code } = request.params as { code: string };
    const body = request.body as { isActive: boolean };
    const result = await AdminService.togglePromoCode(code, Boolean(body?.isActive));
    return result;
  });

  fastify.delete('/promo-codes/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { code } = request.params as { code: string };
    const result = await AdminService.deletePromoCode(code);
    return result;
  });

  // 4. VIP Emails Whitelist
  fastify.get('/vip-emails', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const emails = await AdminService.listVipEmails();
    return { emails };
  });

  fastify.post('/vip-emails', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = request.body as { email: string; tier?: string; notes?: string };
    if (!body?.email) return reply.status(400).send({ error: 'Missing email' });

    try {
      const result = await AdminService.addVipEmail(body.email, body.tier, body.notes);
      return result;
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || 'Failed to add VIP email' });
    }
  });

  fastify.delete('/vip-emails/:email', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { email } = request.params as { email: string };
    const result = await AdminService.deleteVipEmail(decodeURIComponent(email));
    return result;
  });

  // 5. Users Management
  fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const users = await AdminService.listUsers();
    return { users };
  });

  fastify.post('/users/:userId/pro', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { userId } = request.params as { userId: string };
    const body = request.body as { isPro: boolean; proTier?: string };
    const result = await AdminService.toggleUserPro(userId, Boolean(body?.isPro), body?.proTier);
    return result;
  });

  // 6. Publish Trending Recipe to Discover tab
  fastify.post('/trends', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = request.body as { url: string };
    if (!body?.url) return reply.status(400).send({ error: 'נא להזין קישור לסרטון' });

    try {
      const result = await AdminService.publishTrendingRecipe(body.url);
      return result;
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || 'שגיאה בחילוץ ופרסום המתכון לגילוי' });
    }
  });

  // 7. Growth Engine: Sharing Funnel, Takedown Reports, Merchants & SKU Mappings
  fastify.get('/growth-overview', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    try {
      const [merchants, sampleChecks, auditLogs, mappings, reports, events] = await Promise.all([
        GrowthStoreService.listMerchants(),
        GrowthStoreService.listSampleChecks(),
        GrowthStoreService.listMerchantAuditLogs(100),
        GrowthStoreService.listIngredientMappings(false),
        GrowthStoreService.listShareReports(),
        GrowthStoreService.listAnalyticsEvents(1000),
      ]);

      const humanEvents = events.filter((e) => !e.isBot);
      const countByName = (name: string) => humanEvents.filter((e) => e.eventName === name).length;
      const shareViews = countByName('share_view');
      const saves = countByName('shared_recipe_saved');
      const signupStarted = countByName('signup_started');
      const signupCompleted = countByName('signup_completed');
      const redirects = countByName('affiliate_redirect');
      const redirectFailures = humanEvents.filter((e) => e.eventName === 'affiliate_redirect_failed');

      const funnel = {
        shareCreated: countByName('share_created'),
        shareViews,
        saveCtaClicked: countByName('save_cta_clicked'),
        signupStarted,
        signupCompleted,
        sharedRecipeSaved: saves,
        savesPerViewRatio: shareViews > 0 ? Math.round((saves / shareViews) * 1000) / 1000 : 0,
        signupCompletionRatio: signupStarted > 0 ? Math.round((signupCompleted / signupStarted) * 1000) / 1000 : 0,
        affiliateRedirects: redirects,
        redirectFailuresCount: redirectFailures.length,
        purchases: 'לא זמין',
        revenue: 'לא זמין',
      };

      return {
        referralsEnabled: isReferralsEnabled(),
        globalKillSwitch: GrowthStoreService.getRuntimeGlobalKillSwitch(),
        funnel,
        merchants,
        sampleChecks,
        auditLogs,
        mappings,
        reports,
        redirectFailures: redirectFailures.slice(0, 50),
      };
    } catch (e: any) {
      if (e instanceof GrowthStoreError) {
        return reply.status(e.statusCode).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  fastify.post('/merchants/:merchantId/sample-check', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { merchantId } = request.params as { merchantId: string };
    const body = (request.body || {}) as { testedQueries?: string[]; notes?: string };
    try {
      const check = await GrowthStoreService.recordSampleCheck({
        merchantId,
        testedQueries: Array.isArray(body.testedQueries) ? body.testedQueries : [],
        verifiedBy: 'admin',
        notes: body.notes ?? null,
      });
      return { success: true, check };
    } catch (e: any) {
      if (e instanceof GrowthStoreError) {
        return reply.status(e.statusCode).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  fastify.patch('/merchants/:merchantId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { merchantId } = request.params as { merchantId: string };
    const body = (request.body || {}) as {
      status?: MerchantStatus;
      killSwitch?: boolean;
      displayOrder?: number;
      commercialAgreement?: CommercialAgreement | null;
    };
    try {
      const updated = await GrowthStoreService.updateMerchant({
        merchantId,
        actor: 'admin',
        status: body.status,
        killSwitch: body.killSwitch,
        displayOrder: body.displayOrder,
        commercialAgreement: body.commercialAgreement,
      });
      return { success: true, merchant: updated };
    } catch (e: any) {
      if (e instanceof GrowthStoreError) {
        return reply.status(e.statusCode).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  fastify.post('/referrals/kill-switch', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = (request.body || {}) as { disabled?: boolean };
    const disabled = Boolean(body.disabled);
    GrowthStoreService.setRuntimeGlobalKillSwitch(disabled);
    await GrowthStoreService.writeMerchantAuditLog({
      merchantId: '__global__',
      action: 'global_kill_switch_updated',
      actor: 'admin',
      previousState: { globalKillSwitch: !disabled },
      nextState: { globalKillSwitch: disabled },
    }).catch(() => {});
    return {
      success: true,
      globalKillSwitch: disabled,
      referralsEnabled: isReferralsEnabled(),
    };
  });

  // Compatibility endpoint for listing active mappings
  fastify.get('/ingredient-mappings', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    try {
      const mappings = await GrowthStoreService.listIngredientMappings();
      return { mappings };
    } catch (e: any) {
      return { mappings: [] };
    }
  });

  fastify.post('/ingredient-mappings', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = (request.body || {}) as {
      normalizedName?: string;
      merchantId?: string;
      sku?: string;
      productName?: string;
      productUrl?: string;
      active?: boolean;
    };
    if (!body.normalizedName || !body.merchantId || !body.sku || !body.productName || !body.productUrl) {
      return reply.status(400).send({ error: 'נא למלא את כל שדות מיפוי המצרך (שם, חנות, SKU, שם מוצר, כתובת HTTPS)' });
    }
    try {
      const mapping = await GrowthStoreService.upsertIngredientMapping({
        normalizedName: body.normalizedName,
        merchantId: body.merchantId,
        sku: body.sku,
        productName: body.productName,
        productUrl: body.productUrl,
        active: body.active,
      });
      return { success: true, mapping };
    } catch (e: any) {
      if (e instanceof GrowthStoreError) {
        return reply.status(e.statusCode).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  fastify.delete('/ingredient-mappings/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    const deleted = await GrowthStoreService.deleteIngredientMapping(id);
    return { success: deleted };
  });

  fastify.post('/share-reports/:reportId/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { reportId } = request.params as { reportId: string };
    const body = (request.body || {}) as { action?: 'revoke' | 'dismiss' };
    const action = body.action === 'dismiss' ? 'dismiss' : 'revoke';
    const resolved = await GrowthStoreService.resolveShareReport(reportId, action);
    if (!resolved) {
      return reply.status(404).send({ error: 'הדיווח לא נמצא' });
    }
    return { success: true, report: resolved };
  });

  // --- Part D: Supermarket Catalog Import & Auto-Mapping Routes ---

  // 1. Get status of all chain catalogs
  fastify.get('/catalog/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const status = await ChainCatalogService.getCatalogStatus();
    return { chains: status };
  });

  // 2. Trigger auto-import or direct URL import for a chain (Task A & Task B1)
  fastify.post('/catalog/import/:chainKey', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { chainKey } = request.params as { chainKey: string };
    const body = (request.body || {}) as { storeId?: string; url?: string };
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      return reply.status(400).send({ error: 'רשת מזון לא נתמכת' });
    }

    try {
      if (body.url) {
        // Direct server-side import by URL (Task B1)
        const res = await ChainCatalogService.importFromUrl(chainKey, body.url, body.storeId);
        return { success: true, result: res };
      }

      // Auto-sync from chain transparency portal (Task A)
      const res = await ChainCatalogService.autoSyncChain(chainKey, body.storeId);
      return { success: true, result: res };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message || 'שגיאה בייבוא/סנכרון מחירון' });
    }
  });

  // Alias /catalog/refresh/:chainKey for backward compatibility
  fastify.post('/catalog/refresh/:chainKey', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { chainKey } = request.params as { chainKey: string };
    const body = (request.body || {}) as { storeId?: string; url?: string };
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      return reply.status(400).send({ error: 'רשת מזון לא נתמכת' });
    }

    try {
      if (body.url) {
        const res = await ChainCatalogService.importFromUrl(chainKey, body.url, body.storeId);
        return { success: true, result: res };
      }
      const res = await ChainCatalogService.autoSyncChain(chainKey, body.storeId);
      return { success: true, result: res };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message || 'שגיאה ברענון קטלוג' });
    }
  });

  // 3. Chunked file upload import (Task B2 - beats the ~4.5MB Vercel body limit)
  fastify.post('/catalog/upload/:chainKey/chunk', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { chainKey } = request.params as { chainKey: string };
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) {
      return reply.status(400).send({ error: 'רשת מזון לא נתמכת' });
    }

    const body = (request.body || {}) as {
      uploadId?: string;
      index?: number;
      totalChunks?: number;
      data?: string;
      isGzip?: boolean;
      fileName?: string;
      storeId?: string;
    };

    if (!body.uploadId || body.index === undefined || !body.totalChunks || !body.data) {
      return reply.status(400).send({ error: 'Missing chunk upload parameters (uploadId, index, totalChunks, data)' });
    }

    if (body.totalChunks > 25) {
      return reply.status(400).send({ error: 'Total chunks count exceeds limit of 25' });
    }

    try {
      // Save current chunk into database
      await ChainCatalogService.saveUploadChunk(body.uploadId, body.index, body.totalChunks, body.data);

      // If not the final chunk, acknowledge chunk receipt
      if (body.index < body.totalChunks - 1) {
        return { success: true, receivedChunk: body.index, totalChunks: body.totalChunks };
      }

      // Final chunk arrived: reassemble, stream parse and bulk upsert
      const result = await ChainCatalogService.assembleAndImportChunks(chainKey, body.uploadId, body.totalChunks, {
        isGzip: body.isGzip !== undefined ? Boolean(body.isGzip) : true,
        fileName: body.fileName,
        storeId: body.storeId,
      });

      return { success: true, result };
    } catch (e: any) {
      console.error('[Chunk Upload Error]:', e);
      return reply.status(500).send({ error: e.message || 'שגיאה בעיבוד מקטעי קובץ' });
    }
  });

  // 4. Update chain catalog configuration (e.g., preferred storeId or enabled state)
  fastify.post('/catalog/config/:chainKey', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { chainKey } = request.params as { chainKey: string };
    const body = (request.body || {}) as { preferredStoreId?: string; enabled?: boolean };

    try {
      await ChainCatalogService.updateChainConfig(chainKey, body);
      return { success: true };
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || 'שגיאה בעדכון הגדרות רשת' });
    }
  });

  // 5. Manual XML/GZ file upload import (single small payload fallback)
  fastify.post('/catalog/upload/:chainKey', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const { chainKey } = request.params as { chainKey: string };
    const body = (request.body || {}) as { content?: string; isGzip?: boolean; fileName?: string; storeId?: string };

    if (!body.content) {
      return reply.status(400).send({ error: 'לא התקבל תוכן קובץ להעלאה' });
    }

    try {
      const buffer = Buffer.from(body.content, 'base64');
      const stream = Readable.from([buffer]);
      const res = await ChainCatalogService.importFromStream(chainKey, stream, {
        isGzip: Boolean(body.isGzip),
        source: 'manual_upload',
        fileName: body.fileName || `${chainKey}_manual_upload.xml`,
        storeId: body.storeId,
      });

      return { success: true, result: res };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message || 'שגיאה בייבוא הקובץ' });
    }
  });

  // 6. Cron trigger endpoint for catalog auto-sync
  fastify.get('/cron/catalog-sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const querySecret = (request.query as any)?.secret;
    const cronSecret = process.env.CRON_SECRET;

    const hasCronSecret = Boolean(cronSecret && (bearerToken === cronSecret || querySecret === cronSecret));
    let hasAdminAuth = false;
    try {
      const adminTokenHeader = request.headers['x-admin-token'] as string;
      const token = adminTokenHeader || bearerToken;
      if (token) {
        const decoded = jwt.verify(token, getAdminJwtSecret()) as { role: string };
        if (decoded.role === 'superadmin') hasAdminAuth = true;
      }
    } catch {}

    if (!hasCronSecret && !hasAdminAuth) {
      return reply.status(401).send({ error: 'Unauthorized: invalid CRON_SECRET credentials' });
    }

    const status = await ChainCatalogService.getCatalogStatus();
    const results = [];

    for (const chain of status) {
      if (!chain.enabled || chain.chainKey === 'ybitan') {
        results.push({
          chain: chain.chainKey,
          status: 'skipped',
          reason: chain.notes || 'Chain disabled',
          rowsImported: 0,
        });
        continue;
      }

      try {
        const syncRes = await ChainCatalogService.autoSyncChain(chain.chainKey, chain.preferredStoreId);
        results.push({
          chain: chain.chainKey,
          status: syncRes.skipped ? 'skipped' : 'success',
          rowsImported: syncRes.rowsImported || 0,
          fileName: syncRes.fileName,
          storeId: syncRes.storeId,
          reason: syncRes.reason,
        });
      } catch (err: any) {
        results.push({
          chain: chain.chainKey,
          status: 'failed',
          error: err.message || String(err),
          rowsImported: 0,
        });
      }
    }

    return { success: true, timestamp: new Date().toISOString(), results };
  });

  // 4. List mapping suggestions queue
  fastify.get('/catalog/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const db = getDb();
    if (!db) return { suggestions: [] };

    try {
      const suggestions = await db
        .select()
        .from(ingredientMappingSuggestions)
        .where(eq(ingredientMappingSuggestions.status, 'pending'))
        .orderBy(desc(ingredientMappingSuggestions.confidence))
        .limit(100);

      return { suggestions };
    } catch (e: any) {
      return { suggestions: [] };
    }
  });

  // 5. Approve single or bulk suggestions
  fastify.post('/catalog/suggestions/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = (request.body || {}) as { suggestionIds?: string[] };
    const ids = Array.isArray(body.suggestionIds) ? body.suggestionIds : [];

    let approved = 0;
    for (const id of ids) {
      const success = await AutoMapperService.approveSuggestion(id);
      if (success) approved++;
    }

    return { success: true, approvedCount: approved };
  });

  // 6. Reject suggestion
  fastify.post('/catalog/suggestions/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdminAuth(request, reply)) return;
    const body = (request.body || {}) as { suggestionId?: string };
    if (!body.suggestionId) {
      return reply.status(400).send({ error: 'Missing suggestionId' });
    }

    await AutoMapperService.rejectSuggestion(body.suggestionId);
    return { success: true };
  });
}

