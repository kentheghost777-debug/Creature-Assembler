const CACHE_VERSION = "primeria-v40";
const ASSET_CACHE   = "primeria-assets-v39";

// Same host gate as index.html. A service worker that lingers on a dev preview
// host pins old code (it can serve its own cached index.html, so the in-page
// gate never even runs). On dev hosts this SW therefore *self-destructs*:
// clears every cache, unregisters itself, and reloads open tabs so they come
// back SW-free with fresh code. Only production keeps a real caching SW.
const HOST = self.location.hostname;
const IS_DEV =
  HOST === "localhost" ||
  HOST === "127.0.0.1" ||
  HOST.endsWith(".replit.dev") ||
  HOST.endsWith(".repl.co");

const PRECACHE = [
  "./",
  "./manifest.json",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  if (IS_DEV) return;
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE))
  );
});

self.addEventListener("activate", (e) => {
  if (IS_DEV) {
    e.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        // NOTE: deliberately do NOT navigate/reload open tabs. Reloading yanks
        // the player back to the title screen ("game resets from time to time").
        // Caches are cleared + the SW is unregistered; the next *natural*
        // navigation comes back SW-free with fresh code, no forced reload.
      })()
    );
    return;
  }
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
  if (IS_DEV) return; // dev: never intercept — browser fetches everything fresh

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
