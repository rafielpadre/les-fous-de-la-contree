// Service worker : permet d'ouvrir l'app sans réseau.
// Pensez à changer VERSION à chaque mise à jour des fichiers.
const VERSION = 'fdc-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/store.js', 'js/scoring.js', 'js/stats.js',
  'js/charts.js', 'js/photo.js', 'js/csv.js', 'js/demo.js',
  'fonts/anybody.woff2', 'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                   // synchro Supabase : jamais en cache
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;

  // Fichiers de l'app : réseau d'abord (pour avoir les mises à jour), cache si hors ligne
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
    );
  }
});
