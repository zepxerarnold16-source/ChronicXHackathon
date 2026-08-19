const CACHE_NAME = "chronicai-offline-v1";
const OFFLINE_URLS = [
  "./",
  "./index.html",
  "./global.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./login.html",
  "./register.html",
  "./report-problem.html",
  "./scan-product.html",
  "./life-helper.html",
  "./track.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            event.request.url.startsWith(self.location.origin) &&
            networkResponse && networkResponse.status === 200
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }

          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});