const CACHE_NAME = "tour-server-cache-v1";
const REQUIRED_CACHE_URLS = [
  "/",
  "/index.html"
];
const OPTIONAL_CACHE_URLS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of REQUIRED_CACHE_URLS) {
        const response = await fetch(url, { cache: "no-cache" });

        if (!response.ok) {
          throw new Error(`Failed to precache required asset: ${url}`);
        }

        await cache.put(url, response.clone());
      }

      await Promise.all(
        OPTIONAL_CACHE_URLS.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((response) => {
              if (response.ok) {
                return cache.put(url, response.clone());
              }

              return undefined;
            })
            .catch(() => undefined)
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("/index.html").then((response) => {
              if (response) {
                return response;
              }

              return new Response("Offline", {
                status: 503,
                statusText: "Service Unavailable",
                headers: {
                  "Content-Type": "text/plain; charset=utf-8"
                }
              });
            });
          }

          return Response.error();
        });
    })
  );
});
