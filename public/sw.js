const CACHE_VERSION = 'v1.6.1 (Build 25)';
const CACHE_NAME = 'my-recipes-' + CACHE_VERSION.replace(/[^a-zA-Z0-9._-]+/g, '-');
const APP_SHELL_URLS = [
  '/app',
  '/app/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).catch((err) => {
      console.warn('[SW] Precache failed:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('my-recipes-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, extraction, or auth requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (url.pathname === '/sw.js') return;

  // Never serve stale cache for share-target; always hit network (with offline app-shell fallback)
  if (url.pathname === '/app/share-target') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match('/app'))
    );
    return;
  }

  // Network-first for HTML / navigation / app shell so deployed version is always fresh
  const isNavigation =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/app' ||
    url.pathname === '/app/' ||
    url.pathname.endsWith('.html');

  if (isNavigation) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/app')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, hashed bundles)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
