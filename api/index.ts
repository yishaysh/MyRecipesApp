import { buildApp } from '../services/api/dist/app.js';
import { getWebClientHtml } from '../services/api/dist/views/web-client.html.js';

let appPromise: Promise<any> | null = null;
let cachedHtml: string | null = null;

function getAppInstance(): Promise<any> {
  if (!appPromise) {
    appPromise = (async () => {
      const app = buildApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

function getHtml(): string {
  if (!cachedHtml) {
    cachedHtml = getWebClientHtml();
  }
  return cachedHtml;
}

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = req.url || '';
    const urlPath = rawUrl.split('?')[0].replace(/\/$/, '') || '/';

    // 1. Instantly serve HTML web client on root, /app, /index.html, and /api/index with zero cold start
    if (urlPath === '/' || urlPath === '/app' || urlPath === '/index.html' || urlPath === '/api/index') {
      const html = getHtml();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.end(html);
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

    // 4. API Routes - Delegate to Fastify and ensure Promise resolves only when response finishes
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
      const isDev = process.env.NODE_ENV === 'development';
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        ...(isDev ? { message: error?.message || String(error) } : {})
      }));
    }
  }
}
