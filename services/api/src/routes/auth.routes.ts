import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/auth/google
  fastify.post('/google', async (request, reply) => {
    const body = request.body as { idToken?: string; mockUser?: any };
    if (!body || (!body.idToken && !body.mockUser)) {
      return reply.status(400).send({ error: 'Missing idToken' });
    }

    let googleUser;
    if (body.mockUser && process.env.NODE_ENV !== 'production') {
      googleUser = body.mockUser;
    } else if (body.idToken) {
      googleUser = await AuthService.verifyGoogleToken(body.idToken);
    }

    if (!googleUser) {
      return reply.status(401).send({ error: 'Invalid Google ID token' });
    }

    const authResult = await AuthService.authenticateWithGoogle(googleUser);
    const usage = await SyncService.checkUsageLimit(authResult.user.userId);

    return reply.send({
      user: authResult.user,
      token: authResult.token,
      usage,
    });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
    }

    const usage = await SyncService.checkUsageLimit(session.userId);

    return reply.send({
      user: session,
      usage,
    });
  });

  // POST /api/v1/auth/redeem-code
  fastify.post('/redeem-code', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
    }

    const body = request.body as { code?: string };
    if (!body || !body.code) {
      return reply.status(400).send({ error: 'נא להזין קוד הטבה' });
    }

    const result = await AuthService.redeemPromoCode(session.userId, body.code);
    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    const usage = await SyncService.checkUsageLimit(session.userId);

    return reply.send({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token,
      usage,
    });
  });
};

