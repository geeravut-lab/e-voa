// Minimal service worker: it makes the app installable and shows a friendly page when offline.
// It caches ONLY the offline page and the icon. Pages with a signed-in user's data are never cached
// (a shared or signed-out device must not be able to show them).
const CACHE = "evoa-offline-v3";
// The offline page, the icon and the emergency numbers (a static page without any personal data) are the only things kept.
const ASSETS = ["/offline.html", "/offline-emergency.html", "/icons/icon-192.png"];       // the emergency page is built by the server from the current numbers; a copy is kept and refreshed on every visit

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
    if (new URL(req.url).pathname === "/offline-emergency.html") {                                                                    // the emergency numbers open even without a signal; online, the copy is refreshed
      e.respondWith(caches.open(CACHE).then(async (c) => {
        const net = fetch(req).then((r) => { if (r.ok) c.put("/offline-emergency.html", r.clone()); return r; });
        const hit = await c.match("/offline-emergency.html");
        return hit ? (net.catch(() => undefined), hit) : net.catch(() => caches.match("/offline.html"));
      }));
      return;
    }
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (ASSETS.includes(new URL(req.url).pathname)) e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});

// ---- Web Push: show the notice the server sent, and open the right page when it is tapped.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = typeof d.title === "string" && d.title ? d.title : "ThaiPass e-VOA";
  e.waitUntil(self.registration.showNotification(title, { body: typeof d.body === "string" ? d.body : "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: typeof d.tag === "string" ? d.tag : undefined, data: { url: typeof d.url === "string" ? d.url : "/notifications" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || "/notifications";
  const path = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/notifications";          // only pages of this site
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(path); } catch {} } return; } }
    await self.clients.openWindow(path);
  })());
});
