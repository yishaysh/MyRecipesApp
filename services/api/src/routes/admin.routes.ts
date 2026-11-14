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
}

