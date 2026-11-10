import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { AdminService } from '../services/admin.service.js';

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
}
