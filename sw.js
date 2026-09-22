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

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.type !== "error" &&
      (response.ok || response.status === 0 || response.status < 400)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        for (const url of REQUIRED_CACHE_URLS) {
          const response = await fetch(url, { cache: "no-cache" });

          if (!isCacheableResponse(response)) {
            throw new Error(`Failed to precache required asset: ${url}`);
          }

          await cache.put(url, response.clone());
        }

        await Promise.all(
          OPTIONAL_CACHE_URLS.map((url) =>
            fetch(url, { cache: "no-cache" })
              .then((response) => {
                if (isCacheableResponse(response)) {
                  return cache.put(url, response.clone());
                }

                return undefined;
              })
              .catch(() => undefined)
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
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
          if (isCacheableResponse(response)) {
            const responseClone = response.clone();

            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => {
                return cache.put(event.request, responseClone);
              })
            );
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
