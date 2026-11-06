// Minimal service worker: it makes the app installable and shows a friendly page when offline.
// It caches ONLY the offline page and the icon. Pages with a signed-in user's data are never cached
// (a shared or signed-out device must not be able to show them).
const CACHE = "evoa-offline-v1";
const ASSETS = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (ASSETS.includes(new URL(req.url).pathname)) e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
