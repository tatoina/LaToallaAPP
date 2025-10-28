// simple service worker: activa rápido y hace fallback a cache si la red falla
const CACHE_NAME = 'toalla-app-cache-v1';
const FALLBACK_URL = '/index.html';

self.addEventListener('install', event => {
  // evita esperar para que tome control de la página inmediatamente
  self.skipWaiting();
  // cachea el index.html inmediatamente para mejorar la instalabilidad/offline básica
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([FALLBACK_URL]))
  );
});

self.addEventListener('activate', event => {
  // toma control de las pestañas ya abiertas
  event.waitUntil(self.clients.claim());
});

// Para peticiones GET: primero intento la red, si falla uso cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // opcional: podrías cachear respuestas aquí si quieres
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => cached || caches.match(FALLBACK_URL))
      )
  );
});