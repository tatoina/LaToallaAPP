// Service Worker básico: cache-first para recursos estáticos y fallback network
const CACHE_NAME = "toalla-app-v1";
const urlsToCache = ["/", "/index.html", "/styles.css", "/loco.png"];

// Install - cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        // no bloquear si falta algún recurso
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch - respond with cache, fallback to network
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // opcional: cache dynamic assets
          return res;
        })
        .catch(() => {
          // fallback si quieres (imagen por defecto, etc.)
        });
    })
  );
});