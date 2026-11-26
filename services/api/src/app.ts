import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { recipesRoutes } from './routes/recipes.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { syncRoutes } from './routes/sync.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { billingApiRoutes, billingPageRoutes } from './routes/billing.routes.js';
import { sharesRoutes } from './routes/shares.routes.js';
import { affiliateRoutes } from './routes/affiliate.routes.js';
import { curatedRoutes } from './routes/curated.routes.js';
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
  app.get('/', async (_request: any, reply: any) => {
    return reply.redirect(308, '/app');
  });
  app.get('/index', async (_request: any, reply: any) => {
    return reply.redirect(308, '/app');
  });
  app.get('/index.html', sendHtml);
  app.get('/app', sendHtml);
  app.get('/app/share-target', sendHtml);
  app.get('/paywall', async (_req, reply) => {
    return reply.redirect('/app?paywall=1');
  });
  app.get('/api/index', sendHtml);

  // Serve Service Worker & Web App Manifest directly (critical for PWA & serverless runtimes)
  const resolvePublicFile = (filename: string): string | null => {
    const candidates = [
      path.resolve(process.cwd(), 'public', filename),
      path.resolve(process.cwd(), '../../public', filename),
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
  };

  const FALLBACK_PWA_MANIFEST = JSON.stringify({
    name: 'ספר המתכונים שלי',
    short_name: 'ספר המתכונים',
    description: 'חילוץ מתכונים חכם מסרטונים, טקסט וצילומי מסך',
    lang: 'he',
    dir: 'rtl',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/app',
    scope: '/',
    theme_color: '#064e3b',
    background_color: '#f4f9f5',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    share_target: {
      action: '/app/share-target',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' }
    }
  });

  app.get('/sw.js', async (_req, reply) => {
    const file = resolvePublicFile('sw.js');
    if (!file) return reply.status(404).send({ error: 'sw.js not found' });
    return reply
      .type('application/javascript; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .header('Service-Worker-Allowed', '/')
      .send(fs.readFileSync(file, 'utf8'));
  });

  const sendPwaManifest = async (_req: any, reply: any) => {
    const file = resolvePublicFile('manifest.webmanifest');
    const body = file ? fs.readFileSync(file, 'utf8') : FALLBACK_PWA_MANIFEST;
    return reply
      .type('application/manifest+json; charset=utf-8')
      .header('Cache-Control', 'no-cache, must-revalidate')
      .send(body);
  };

  app.get('/manifest.webmanifest', sendPwaManifest);
  app.get('/app/manifest.webmanifest', sendPwaManifest);

  // Legacy manifest route: clean 301 redirect to canonical PWA manifest (never 500)
  app.get('/manifest.json', async (_req, reply) => {
    return reply
      .header('Cache-Control', 'public, max-age=3600')
      .redirect(301, '/manifest.webmanifest');
  });

  // Legacy Android TWA/App Links route: clean 404 (web-only app, no Android/APK support)
  app.get('/.well-known/assetlinks.json', async (_req, reply) => {
    return reply
      .status(404)
      .header('Cache-Control', 'public, max-age=300')
      .send({ error: 'Not Found' });
  });

  for (const iconName of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
    app.get(`/${iconName}`, async (_req, reply) => {
      const file = resolvePublicFile(iconName);
      if (!file) {
        return reply.redirect(302, `https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/public/${iconName}`);
      }
      return reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(fs.readFileSync(file));
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

  // Redirect legacy /manual/:id URLs to /app
  app.get('/manual/:id', async (_req: any, reply: any) => {
    return reply.redirect(302, '/app');
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Vercel Cron endpoint: daily catalog auto-sync (Task A)
  app.get('/api/cron/catalog-sync', async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const querySecret = request.query?.secret;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && bearerToken !== cronSecret && querySecret !== cronSecret) {
      return reply.status(401).send({ error: 'Unauthorized: invalid CRON_SECRET credentials' });
    }

    const { ChainCatalogService } = await import('./services/catalog/chain-fetchers.js');
    const results = await ChainCatalogService.syncAllEnabledChains();
    return { success: true, timestamp: new Date().toISOString(), results };
  });

  // Register recipe API routes
  app.register(recipesRoutes, { prefix: '/api/v1/recipes' });

  // Register Commercial SaaS routes (Auth, Cloud Sync & Billing)
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(syncRoutes, { prefix: '/api/v1/sync' });
  app.register(adminRoutes, { prefix: '/api/v1/admin' });
  app.register(billingApiRoutes, { prefix: '/api/v1/billing' });
  app.register(billingPageRoutes);
  app.register(sharesRoutes);
  app.register(affiliateRoutes);
  app.register(curatedRoutes);

  return app;
}
