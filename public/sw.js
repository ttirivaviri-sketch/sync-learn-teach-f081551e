/**
 * StudySync service worker — low-data / offline shell.
 *
 * Strategy (deliberately conservative):
 *  - Vite-hashed build assets (/assets/*) are immutable → cache-first.
 *  - Images & fonts → cache-first with a size-capped cache.
 *  - Navigations → network-first, falling back to the cached app shell so
 *    the SPA still opens on flaky connections (top barrier in ZA/ZW).
 *  - Supabase API/auth/edge-function calls are NEVER cached.
 */
const VERSION = "v1";
const SHELL_CACHE = `ss-shell-${VERSION}`;
const ASSET_CACHE = `ss-assets-${VERSION}`;
const MEDIA_CACHE = `ss-media-${VERSION}`;
const MEDIA_MAX_ENTRIES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(["/", "/manifest.json"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && (response.type === "basic" || response.type === "cors")) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    if (cacheName === MEDIA_CACHE) trimCache(MEDIA_CACHE, MEDIA_MAX_ENTRIES);
  }
  return response;
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match("/");
    if (cached) return cached;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept Supabase (API, auth, realtime, storage, functions).
  if (url.hostname.endsWith(".supabase.co")) return;

  // SPA navigations → network-first with offline shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (url.origin === self.location.origin) {
    // Immutable hashed build assets.
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
      return;
    }
    // Local images / icons / uploads.
    if (/\.(png|jpe?g|webp|svg|gif|ico|woff2?)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, MEDIA_CACHE));
      return;
    }
    return;
  }

  // Cross-origin fonts (Google Fonts) are safe to cache-first.
  if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
