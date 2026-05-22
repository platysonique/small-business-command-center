/* SBCC offline shell — same app anywhere; AI needs network when online */
const SBCC_CACHE = 'sbcc-v2';
const SBCC_ASSETS = [
  './',
  './command-center.html',
  './index.html',
  './js/sbcc-api.js',
  './js/sbcc-ai.js',
  './js/sbcc-ai.css',
  './js/sbcc-research-layer.js',
  './js/sbcc-research-layer.css',
  './js/sbcc-void-search.js',
  './js/sbcc-void-search.css',
  './mobile/command-center.html',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SBCC_CACHE).then((cache) => cache.addAll(SBCC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SBCC_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.includes('/api/')) {
    return;
  }
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SBCC_CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
