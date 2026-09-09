import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

/* Upload plików (multipart) — zapis do /mnt/agents/output/uploads */
app.post("/api/upload", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "Brak pliku" }, 400);
  const { mkdir, writeFile } = await import("fs/promises");
  const dir = env.uploadDir;
  await mkdir(dir, { recursive: true });
  const safe = file.name.replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, "_").slice(-120);
  const name = `${Date.now()}_${safe}`;
  await writeFile(`${dir}/${name}`, Buffer.from(await file.arrayBuffer()));
  return c.json({ ok: true, url: `/uploads/${name}`, name: file.name, size: file.size });
});
app.get("/uploads/*", async (c) => {
  const { readFile } = await import("fs/promises");
  const path = `${env.uploadDir}/${c.req.path.replace(/^\/uploads\//, "")}`;
  try {
    const buf = await readFile(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";
    return c.body(new Uint8Array(buf), 200, { "Content-Type": mime });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});
/* Test połączenia dla komputerów kurnika — szybka weryfikacja klucza i łączności.
   Przykład: curl -H "X-API-Key: KLUCZ" https://…/api/v1/ping */
app.get("/api/v1/ping", async (c) => {
  try {
    const { verifyApiKey } = await import("./transfer-router");
    const key = c.req.header("x-api-key") ?? "";
    const apiKey = key ? await verifyApiKey(key) : null;
    if (!apiKey) return c.json({ ok: false, error: "Nieprawidłowy lub nieaktywny klucz API" }, 401);
    return c.json({ ok: true, serverTime: new Date().toISOString(), keyLabel: apiKey.label, keyPrefix: apiKey.keyPrefix });
  } catch (e) {
    return c.json({ ok: false, error: `Błąd serwera: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});

/* Walidacja zakresów odczytów — odrzuca błędne dane zanim trafią do bazy */
const RANGES: Record<string, [number, number]> = {
  tempC: [-40, 80], humidityPct: [0, 100], co2Ppm: [0, 20000], ammoniaPpm: [0, 500],
  ventilationPct: [0, 100], kg: [0, 1000000], count: [0, 1000000],
  avgWeightG: [10, 40000], sampleSize: [1, 100000], dayAge: [0, 400],
};
function checkRanges(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    const v = obj[f];
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) return `Pole ${f} musi być liczbą (otrzymano: ${JSON.stringify(v)})`;
    const [lo, hi] = RANGES[f] ?? [-Infinity, Infinity];
    if (n < lo || n > hi) return `Pole ${f} poza zakresem ${lo}–${hi} (otrzymano: ${n})`;
  }
  return null;
}

/* Ingest danych z komputerów/czujników/systemów zewnętrznych — autoryzacja kluczem API (nagłówek X-API-Key).
   Pojedynczy odczyt:  {"type":"climate","houseId":1,"tempC":21.5}
   Paczka odczytów:    {"type":"climate","readings":[{"houseId":1,"tempC":21.5},{"houseId":2,"tempC":22.1}]} */
app.post("/api/v1/ingest", async (c) => {
  try {
    const { verifyApiKey } = await import("./transfer-router");
    const key = c.req.header("x-api-key") ?? "";
    const apiKey = key ? await verifyApiKey(key) : null;
    if (!apiKey) return c.json({ ok: false, error: "Nieprawidłowy lub nieaktywny klucz API" }, 401);

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.type !== "string") return c.json({ ok: false, error: "Wymagane pole type" }, 400);

    const { getDb } = await import("./queries/connection");
    const s = await import("@db/schema");
    const db = getDb();

    // pojedynczy odczyt albo paczka `readings` (maks. 200 na żądanie)
    const readings: Record<string, unknown>[] = Array.isArray(body.readings)
      ? body.readings.slice(0, 200)
      : [body];
    if (readings.length === 0) return c.json({ ok: false, error: "Pusta paczka readings" }, 400);

    const ids: number[] = [];
    const errors: string[] = [];

    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      try {
        switch (body.type) {
          case "climate": {
            if (!r.houseId) { errors.push(`#${i}: wymagane houseId`); break; }
            const bad = checkRanges(r, ["tempC", "humidityPct", "co2Ppm", "ammoniaPpm", "ventilationPct"]);
            if (bad) { errors.push(`#${i}: ${bad}`); break; }
            const [{ id }] = await db.insert(s.climateLogs).values({
              houseId: Number(r.houseId),
              tempC: r.tempC != null ? String(r.tempC) : null,
              humidityPct: r.humidityPct != null ? String(r.humidityPct) : null,
              co2Ppm: r.co2Ppm != null ? Number(r.co2Ppm) : null,
              ammoniaPpm: r.ammoniaPpm != null ? String(r.ammoniaPpm) : null,
              ventilationPct: r.ventilationPct != null ? Number(r.ventilationPct) : null,
              source: `api:${apiKey.keyPrefix}`,
            }).$returningId();
            ids.push(id);
            break;
          }
          case "feedUsage": {
            if (!r.batchId || !r.kg) { errors.push(`#${i}: wymagane batchId i kg`); break; }
            const bad = checkRanges(r, ["kg"]);
            if (bad) { errors.push(`#${i}: ${bad}`); break; }
            const [{ id }] = await db.insert(s.feedUsages).values({
              batchId: Number(r.batchId),
              day: String(r.day ?? new Date().toISOString().slice(0, 10)),
              kg: String(r.kg),
            }).$returningId();
            ids.push(id);
            break;
          }
          case "mortality": {
            if (!r.batchId || !r.count) { errors.push(`#${i}: wymagane batchId i count`); break; }
            const bad = checkRanges(r, ["count"]);
            if (bad) { errors.push(`#${i}: ${bad}`); break; }
            const [{ id }] = await db.insert(s.mortalities).values({
              batchId: Number(r.batchId),
              day: String(r.day ?? new Date().toISOString().slice(0, 10)),
              count: Number(r.count),
              cause: String(r.cause ?? "zgłoszenie API").slice(0, 255),
            }).$returningId();
            ids.push(id);
            break;
          }
          case "weighing": {
            if (!r.batchId || !r.avgWeightG) { errors.push(`#${i}: wymagane batchId i avgWeightG`); break; }
            const bad = checkRanges(r, ["avgWeightG", "sampleSize", "dayAge"]);
            if (bad) { errors.push(`#${i}: ${bad}`); break; }
            const [{ id }] = await db.insert(s.weighings).values({
              batchId: Number(r.batchId),
              weighedAt: r.weighedAt ? new Date(String(r.weighedAt)) : new Date(),
              dayAge: Number(r.dayAge ?? 0),
              sampleSize: Number(r.sampleSize ?? 1),
              avgWeightG: Number(r.avgWeightG),
              operator: `api:${apiKey.keyPrefix}`,
            }).$returningId();
            ids.push(id);
            break;
          }
          default:
            return c.json({ ok: false, error: `Nieznany typ: ${body.type}. Dozwolone: climate, feedUsage, mortality, weighing` }, 400);
        }
      } catch (e) {
        errors.push(`#${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (ids.length === 0 && errors.length > 0)
      return c.json({ ok: false, error: "Żaden odczyt nie został zapisany", errors }, 400);
    return c.json({ ok: true, inserted: body.type, count: ids.length, ids, ...(errors.length ? { errors } : {}) });
  } catch (e) {
    return c.json({ ok: false, error: `Błąd serwera: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});

app.use("/api/trpc/*", async (c) => {  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
