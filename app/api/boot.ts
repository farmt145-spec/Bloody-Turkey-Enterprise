import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

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

  // INLINE SEED — kompletne seedowanie przy boot
  try {
    console.log(">> SEED: Czyszczenie i seedowanie bazy...");
    const { getDb } = await import("./queries/connection");
    const s = await import("@db/schema");
    const db = getDb();

    // Wyczyść tabele
    const tables = [
      s.auditLog, s.scheduleEvents, s.transfers, s.recipeItems,
      s.recipes, s.silos, s.warehouses, s.litter, s.vaccinations,
      s.treatments, s.sales, s.costs, s.feedUsages, s.mortalities,
      s.selects, s.weighings, s.batches, s.sectors, s.houses,
      s.farms, s.geneticLines, s.feedIngredients, s.companies,
    ];
    for (const t of tables) await db.delete(t);
    console.log("✓ Tabele wyczyszczone");

    // Seed: 3 firmy
    const companies = [
      { name: "Bloody Turkey Group S.A. (Demo)", cc: "PL", baseCurrency: "EUR" },
      { name: "Indykpol S.A.", cc: "PL", baseCurrency: "EUR" },
      { name: "Gospodarstwo Kowalski", cc: "PL", baseCurrency: "EUR" },
    ];
    const companyIds: number[] = [];
    for (const c of companies) {
      const [{ id }] = await db.insert(s.companies).values(c).$returningId();
      companyIds.push(id);
      console.log(`✓ Firma: ${c.name}`);
    }

    // Seed: 2 farmy dla firm 0 i 1
    const farms = [
      { companyId: companyIds[0], name: "Ferma Wielkopolska", countryCode: "PL", city: "Września", lat: "52.325", lng: "17.565", capacity: 120000 },
      { companyId: companyIds[0], name: "Ferma Mazury", countryCode: "PL", city: "Olsztyn", lat: "53.778", lng: "20.48", capacity: 95000 },
      { companyId: companyIds[1], name: "Ferma Olsztyńska 1", countryCode: "PL", city: "Olsztynek", lat: "53.583", lng: "20.285", capacity: 140000 },
      { companyId: companyIds[2], name: "Kowalski — kurniki rodzinne", countryCode: "PL", city: "Żuromin", lat: "53.064", lng: "19.909", capacity: 18000 },
    ];
    const farmIds: number[] = [];
    for (const f of farms) {
      const [{ id }] = await db.insert(s.farms).values(f).$returningId();
      farmIds.push(id);
      console.log(`✓ Ferma: ${f.name}`);
    }

    // Seed: 2 obiekty na farmę (odchowalnia + kurnik)
    for (const farmId of farmIds) {
      const [{ id: h1 }] = await db.insert(s.houses).values({
        farmId, name: "Odchowalnia A", houseType: "brooder", areaM2: "750", maxDensityKgM2: "25.0",
      }).$returningId();
      const [{ id: h2 }] = await db.insert(s.houses).values({
        farmId, name: "Kurnik 1", houseType: "finisher", areaM2: "2000", maxDensityKgM2: "42.0",
      }).$returningId();
      console.log(`✓ Obiekty na fermę ${farmId}`);

      // Seed: 1-2 partie na objetk
      for (const houseId of [h1, h2]) {
        const [{ id: batchId }] = await db.insert(s.batches).values({
          houseId,
          code: `RZ/2026/${Math.random().toString().slice(2, 5)}`,
          geneticLine: "BUT Big 6",
          sex: Math.random() > 0.5 ? "toms" : "hens",
          chickSupplier: "Grelavi S.A.",
          chickPrice: "1.55",
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          plannedEndDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          initialCount: Math.floor(Math.random() * 12000 + 8000),
          currentCount: Math.floor(Math.random() * 12000 + 7500),
          status: "active",
        }).$returningId();
        console.log(`✓ Partia ${batchId}`);

        // Seed: 3 ważenia na partię
        for (let day = 7; day <= 21; day += 7) {
          await db.insert(s.weighings).values({
            batchId,
            weighedAt: new Date(Date.now() - (30 - day) * 24 * 60 * 60 * 1000),
            dayAge: day,
            sampleSize: 50,
            avgWeightG: Math.floor(50 + day * 80),
            operator: "seed",
          });
        }
        console.log(`✓ Ważenia dla partii ${batchId}`);

        // Seed: 3 śmiertelności na partię
        for (let i = 1; i <= 3; i++) {
          await db.insert(s.mortalities).values({
            batchId,
            day: new Date(Date.now() - (30 - i * 5) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            count: Math.floor(Math.random() * 50 + 10),
            cause: "różne",
          });
        }
        console.log(`✓ Śmiertelności dla partii ${batchId}`);
      }
    }

    console.log("✓✓✓ SEED KOMPLETNY — Baza gotowa do użytku!");
  } catch (e) {
    console.error("⚠⚠⚠ SEED ERROR:", e instanceof Error ? e.message : String(e));
    console.error(e);
  }

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

