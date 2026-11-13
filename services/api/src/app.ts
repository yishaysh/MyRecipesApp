import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { recipesRoutes } from './routes/recipes.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { syncRoutes } from './routes/sync.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { billingApiRoutes, billingPageRoutes } from './routes/billing.routes.js';
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
  app.get('/app/share-target', sendHtml);
  app.get('/paywall', async (_req, reply) => {
    return reply.redirect('/app?paywall=1');
  });
  app.get('/api/index', sendHtml);

  // Serve Service Worker & Web App Manifest directly (critical for PWA & local Fastify dev)
  const resolvePublicFile = (filename: string): string | null => {
    const candidates = [
      path.resolve(process.cwd(), 'public', filename),
      path.resolve(process.cwd(), '../../public', filename),
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
  };

  app.get('/sw.js', async (_req, reply) => {
    const file = resolvePublicFile('sw.js');
    if (!file) return reply.status(404).send({ error: 'sw.js not found' });
    return reply
      .type('application/javascript; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .header('Service-Worker-Allowed', '/')
      .send(fs.readFileSync(file, 'utf8'));
  });

  app.get('/manifest.webmanifest', async (_req, reply) => {
    const file = resolvePublicFile('manifest.webmanifest');
    if (!file) return reply.status(404).send({ error: 'manifest.webmanifest not found' });
    return reply
      .type('application/manifest+json; charset=utf-8')
      .header('Cache-Control', 'no-cache, must-revalidate')
      .send(fs.readFileSync(file, 'utf8'));
  });

  for (const iconName of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
    app.get(`/${iconName}`, async (_req, reply) => {
      const file = resolvePublicFile(iconName);
      if (!file) return reply.status(404).send({ error: `${iconName} not found` });
      return reply.type('image/png').send(fs.readFileSync(file));
    });
  }

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

  // Register Commercial SaaS routes (Auth, Cloud Sync & Billing)
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(syncRoutes, { prefix: '/api/v1/sync' });
  app.register(adminRoutes, { prefix: '/api/v1/admin' });
  app.register(billingApiRoutes, { prefix: '/api/v1/billing' });
  app.register(billingPageRoutes);

  return app;
}
