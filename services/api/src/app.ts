import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { recipesRoutes } from './routes/recipes.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { syncRoutes } from './routes/sync.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { getWebClientHtml } from './views/web-client.html.js';
import { getAdminDashboardHtml } from './views/admin.html.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false
  });

  // Enable CORS for mobile app & local dev
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  // Web Client routes for iOS PWA and desktop
  const sendHtml = async (_request: any, reply: any) => {
    return reply.type('text/html; charset=utf-8').send(getWebClientHtml());
  };
  app.get('/', sendHtml);
  app.get('/index.html', sendHtml);
  app.get('/app', sendHtml);
  app.get('/api/index', sendHtml);

  // Hidden Admin Dashboard route (zero buttons in client UI)
  app.get('/admin', async (_request: any, reply: any) => {
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(getAdminDashboardHtml());
  });

  // Serve app icons for iOS Add to Home Screen & Favicon
  app.get('/apple-touch-icon.png', async (_req, reply) => {
    return reply.redirect(302, 'https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/apple-touch-icon.png');
  });
  app.get('/apple-touch-icon-precomposed.png', async (_req, reply) => {
    return reply.redirect(302, 'https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/apple-touch-icon.png');
  });
  app.get('/favicon.ico', async (_req, reply) => {
    return reply.redirect(302, 'https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/favicon.png');
  });
  app.get('/favicon.png', async (_req, reply) => {
    return reply.redirect(302, 'https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/favicon.png');
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register recipe API routes
  app.register(recipesRoutes, { prefix: '/api/v1/recipes' });

  // Register Commercial SaaS routes (Auth & Cloud Sync)
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(syncRoutes, { prefix: '/api/v1/sync' });
  app.register(adminRoutes, { prefix: '/api/v1/admin' });

  return app;
}
