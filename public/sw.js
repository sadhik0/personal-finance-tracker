// Runtime-caching service worker for the app shell.
//
// Deliberately NOT a full precache list: Next.js renames every JS/CSS chunk
// on each build (content hashes), so a hand-written precache manifest would
// go stale the moment you deploy. Instead this caches whatever the browser
// actually requests, as it requests it — after one full visit online, the
// shell (HTML/CSS/JS/fonts/icons) is available offline.
//
// API routes (/api/*) are intentionally never cached here — offline reads
// for transaction data go through IndexedDB (see frontend/lib/offlineApi.ts),
// not through a stale cached JSON response.

const CACHE = "pft-shell-v2";

// Only store normal successful responses: never redirects (e.g. a bounce to
// the login page) or error pages.
const cacheable = (res) => res && res.ok && !res.redirected && res.type === "basic";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (fonts CDN etc.) pass through normally
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  // Static assets (Next build output, icons, manifest): cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (cacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Pages/navigation: network-first, falling back to cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (cacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/dashboard"))),
  );
});
