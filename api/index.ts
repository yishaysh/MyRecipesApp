let appPromise: Promise<any> | null = null;
let cachedHtml: string | null = null;
let cachedAdminHtml: string | null = null;

async function getAppInstance(): Promise<any> {
  if (!appPromise) {
    appPromise = (async () => {
      const { buildApp } = await import('../services/api/dist/app.js');
      const app = buildApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

async function getHtml(): Promise<string> {
  if (!cachedHtml) {
    const { getWebClientHtml } = await import('../services/api/dist/views/web-client.html.js');
    cachedHtml = getWebClientHtml();
  }
  return cachedHtml;
}

async function getAdminHtml(): Promise<string> {
  if (!cachedAdminHtml) {
    const { getAdminDashboardHtml } = await import('../services/api/dist/views/admin.html.js');
    cachedAdminHtml = getAdminDashboardHtml();
  }
  return cachedAdminHtml;
}

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = (req && (req.url || req.originalUrl)) || '';
    const urlPath = String(rawUrl).split('?')[0].replace(/\/$/, '') || '/';

    // 1. Instantly redirect root to /app (308 permanent redirect) with zero module overhead
    if (urlPath === '/' || urlPath === '' || urlPath === '/index') {
      if (typeof res.redirect === 'function') {
        res.redirect(308, '/app');
        return;
      }
      res.statusCode = 308;
      res.setHeader('Location', '/app');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.end();
      return;
    }

    // 1.1 Serve HTML web client on /app, /index.html, and /api/index with zero cold start
    if (urlPath === '/app' || urlPath === '/index.html' || urlPath === '/api/index') {
      const html = await getHtml();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.end(html);
      return;
    }

    // 1.2 Secret Admin Dashboard
    if (urlPath === '/admin') {
      const adminHtml = await getAdminHtml();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.end(adminHtml);
      return;
    }

    // 2. Serve app icons for iOS Add to Home Screen & Favicon
    if (urlPath === '/apple-touch-icon.png' || urlPath === '/apple-touch-icon-precomposed.png') {
      res.statusCode = 302;
      res.setHeader('Location', 'https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/apple-touch-icon.png');
      res.end();
      return;
    }

    if (urlPath === '/favicon.ico' || urlPath === '/favicon.png') {
      res.statusCode = 302;
      res.setHeader('Location', 'https://raw.githubusercontent.com/yishaysh/MyRecipesApp/main/apps/mobile/public/favicon.png');
      res.end();
      return;
    }

    // 3. Health check
    if (urlPath === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // 4. API Routes - Delegate to Fastify
    const app = await getAppInstance();

    await new Promise<void>((resolve, reject) => {
      res.on('finish', () => resolve());
      res.on('close', () => resolve());
      res.on('error', (err: any) => reject(err));
      app.server.emit('request', req, res);
    });
  } catch (error: any) {
    console.error('[Vercel Handler Error]:', error);
    if (!res.headersSent) {
      // If root crashed unexpectedly, fail-safe redirect to /app
      const rawUrl = (req && (req.url || req.originalUrl)) || '';
      if (!rawUrl || rawUrl === '/' || rawUrl === '/index') {
        res.statusCode = 308;
        res.setHeader('Location', '/app');
        res.end();
        return;
      }
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal Server Error'
      }));
    }
  }
}
