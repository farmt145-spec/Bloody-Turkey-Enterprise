/* BTE Service Worker — cache powłoki aplikacji + kolejka offline obchodu */
const CACHE = "bte-shell-v1";
const OFFLINE_QUEUE = "bte-offline-queue";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

/* Strategia: API -> network (bez cache). Strony/assets -> network-first z fallbackiem do cache. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return; // API zawsze na żywo
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
  );
});

/* Kolejka offline — obchód zapisany bez zasięgu; wysyłka gdy wróci sieć */
self.addEventListener("message", (e) => {
  if (e.data?.type === "FLUSH_QUEUE") flushQueue();
});

self.addEventListener("sync", (e) => {
  if (e.tag === OFFLINE_QUEUE) e.waitUntil(flushQueue());
});

async function flushQueue() {
  const cache = await caches.open(OFFLINE_QUEUE);
  const requests = await cache.keys();
  let sent = 0, failed = 0;
  for (const req of requests) {
    try {
      const body = await (await cache.match(req)).text();
      const res = await fetch("/api/trpc/obchod.save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(req.headers.get ? {} : {}) },
        body,
        credentials: "include",
      });
      if (res.ok) { await cache.delete(req); sent++; }
      else failed++;
    } catch { failed++; }
  }
  const clients = await self.clients.matchAll();
  clients.forEach((c) => c.postMessage({ type: "QUEUE_FLUSHED", sent, failed, remaining: failed }));
}
