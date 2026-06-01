const CACHE_VERSION = "primeria-v10";
const ASSET_CACHE   = "primeria-assets-v10";

const PRECACHE = [
  "./",
  "./manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("./")))
    );
    return;
  }

  const isHeavyAsset =
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/audio/");

  if (isHeavyAsset) {
    e.respondWith(
      caches.open(ASSET_CACHE).then((c) =>
        c.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((res) => {
              c.put(request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
