// Service Worker - EV Trip Chile
// Cache-first para HTML y assets, network-first para tiles del mapa

const CACHE_NAME = 'ev-trip-chile-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

// Install: precachear app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(err => {
        console.warn('SW: algunos recursos no se pudieron precachear:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Activate: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: estrategia híbrida
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Tiles del mapa: network-first con fallback a cache (datos cambian poco)
  if (url.hostname.includes('basemaps.cartocdn.com') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('tile.openstreetmap')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cachear el tile para offline
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // OSRM y APIs externas: solo network (no cachear, pueden cambiar)
  if (url.hostname.includes('router.project-osrm.org') ||
      url.hostname.includes('routing.openstreetmap.de')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Todo lo demás: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(res => {
        // Cachear respuestas exitosas para próxima vez
        if (res.status === 200 && event.request.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return res;
      }))
      .catch(() => {
        // Si todo falla y es una página HTML, retornar la app shell
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});
