/* Kolejka offline dla obchodu — wpisy lądują w Cache Storage przeglądarki
   i są wysyłane automatycznie, gdy wróci zasięg. */

const QUEUE_CACHE = "bte-offline-queue";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch { /* brak SW nie blokuje aplikacji */ }
}

export async function queueObchod(payload: unknown, headers: Record<string, string>) {
  const cache = await caches.open(QUEUE_CACHE);
  const res = new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", "x-bte-headers": JSON.stringify(headers) },
  });
  await cache.put(`/queue/${Date.now()}-${Math.random().toString(36).slice(2)}`, res);
}

export async function queueSize(): Promise<number> {
  if (!("caches" in window)) return 0;
  const cache = await caches.open(QUEUE_CACHE);
  return (await cache.keys()).length;
}

/* Ręczna wysyłka kolejki z poziomu strony (fetch po tRPC) */
export async function flushQueueNow(postFn: (payload: unknown, headers: Record<string, string>) => Promise<boolean>): Promise<{ sent: number; failed: number }> {
  if (!("caches" in window)) return { sent: 0, failed: 0 };
  const cache = await caches.open(QUEUE_CACHE);
  const keys = await cache.keys();
  let sent = 0, failed = 0;
  for (const k of keys) {
    try {
      const res = await cache.match(k);
      if (!res) continue;
      const payload = await res.json();
      const headers = JSON.parse(res.headers.get("x-bte-headers") ?? "{}");
      if (await postFn(payload, headers)) { await cache.delete(k); sent++; }
      else failed++;
    } catch { failed++; }
  }
  return { sent, failed };
}
