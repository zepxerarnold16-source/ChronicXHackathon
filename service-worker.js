const CACHE_NAME = "chronicai-offline-v3";
const OFFLINE_URLS = [
  "./",
  "./index.html",
  "./admin.html",
  "./citizen.html",
  "./dashboard.html",
  "./journey.html",
  "./life-helper.html",
  "./login.html",
  "./register.html",
  "./report-problem.html",
  "./resource-center.html",
  "./scan-product.html",
  "./track.html",
  "./app.js",
  "./auth.js",
  "./citizen.js",
  "./complaint.js",
  "./firebase.js",
  "./journey.js",
  "./login.js",
  "./register.js",
  "./report-problem.js",
  "./resource-center.js",
  "./global.css",
  "./citizen.css",
  "./journey.css",
  "./report.css",
  "./resource-center.css",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        OFFLINE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn(`Offline cache skipped ${url}:`, error);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (isSameOrigin && event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            isSameOrigin &&
            networkResponse && networkResponse.status === 200
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return new Response("Offline", {
            status: 503,
            headers: {
              "Content-Type": "text/plain"
            }
          });
        });
    })
  );
});