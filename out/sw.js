/* DreamUtopia clone — cache static chrome; never cache /api. */
const CACHE = "du-static-v9";
const PRECACHE = [
  "/",
  "/workspace",
  "/pricing",
  "/auth",
  "/offline",
  "/manifest.webmanifest",
  "/assets/css/chrome.css",
  "/assets/js/du.js",
  "/assets/js/i18n.js",
  "/assets/js/nav.js",
  "/assets/js/pwa.js",
  "/assets/js/seo.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event && event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.destination !== "document") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === "navigate" || req.destination === "document") {
            return caches.match("/offline").then((offline) => offline || caches.match("/"));
          }
          return new Response("", { status: 503, statusText: "offline" });
        })
      )
  );
});
