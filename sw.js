// Offline cache for the app shell. Bump VERSION when files change.
const VERSION = 'ucus-v17';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/parser.js', 'js/model.js', 'js/stations.js', 'js/traffic.js',
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

// GitHub Pages sends max-age=600; always revalidate so updates show up immediately.
const fresh = (url) => new Request(url, { cache: 'no-cache', credentials: 'same-origin' });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.all(ASSETS.map((a) => fetch(fresh(new URL(a, self.registration.scope))).then((r) => c.put(a === './' ? new URL('./', self.registration.scope) : new URL(a, self.registration.scope), r)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// network first (revalidated), cache fallback when offline
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(fresh(url.href))
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match(new URL('./', self.registration.scope)))),
  );
});
