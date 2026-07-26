/* Service Worker — BIT Study HUB
   Cache offline pour les ressources principales */

const CACHE_NAME = 'bit-study-hub-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/icons.js',
  './js/app.js',
  './data/site.json',
  './data/courses.json',
  './data/exams.json',
  './data/contributors.json',
  './data/flashcards.json',
  './assets/img/bit-logo.jpeg'
];

// Installation: pré-cache des ressources critiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.warn('SW cache error:', err))
  );
  self.skipWaiting();
});

// Activation: nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: stratégie cache-first pour les assets, network-first pour le reste
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Skip cross-origin
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(networkRes => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => {
          // Offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return cached;
        });
      return cached || fetchPromise;
    })
  );
});