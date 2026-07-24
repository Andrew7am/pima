// Minimal, update-safe service worker — its main job is to make بيما an
// installable PWA (Chrome requires a fetch handler) and give a basic offline
// shell. Deliberately conservative so it never traps an old build:
//   • version.json is NEVER cached — the in-app update check must see the truth.
//   • navigations are network-first (new deploys' HTML always wins online).
//   • only hashed /assets/ files (immutable) are cache-first.
//   • skipWaiting + clients.claim so a new SW takes over immediately.
const CACHE = 'pima-cache-v1';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // leave Supabase/CDN alone
  if (url.pathname === '/version.json') return;          // update check stays live

  // Immutable hashed build assets → cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // Page navigations → network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
  }
});
