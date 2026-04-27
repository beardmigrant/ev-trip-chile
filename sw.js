// Service Worker - Trip Chile (EV + Turismo) v3
// CACHE_NAME bump fuerza la limpieza de caches antiguas
const CACHE_NAME = 'trip-chile-v3-' + new Date().toISOString().split('T')[0];

const APP_SHELL = [
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

self.addEventListener('install', e => {
  // Instalar inmediatamente, sin esperar a que cierren todas las pestañas
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL).catch(()=>{}))
  );
});

self.addEventListener('activate', e => {
  // Limpiar TODAS las cachés antiguas y tomar control inmediato
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // CRÍTICO: index.html y la raíz del sitio = NETWORK FIRST
  // (siempre intenta bajar la versión más nueva primero)
  if (e.request.mode === 'navigate' || 
      url.pathname.endsWith('/') || 
      url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        // Cache la respuesta nueva para offline
        const c = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }
  
  // Tiles del mapa: cache-first con actualización en background
  if (url.hostname.includes('basemaps.cartocdn.com') || 
      url.hostname.includes('arcgisonline.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          const c = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
  
  // OSRM y Overpass: solo network (datos dinámicos)
  if (url.hostname.includes('router.project-osrm.org') || 
      url.hostname.includes('routing.openstreetmap') ||
      url.hostname.includes('overpass')) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Resto: cache-first con fallback a network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.status === 200 && e.request.method === 'GET') {
        const c = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
      }
      return res;
    }))
  );
});

// Permitir que la app fuerce skipWaiting desde cliente
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
