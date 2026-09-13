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
    const readings: Record<string, unknown>[] = Array.isArray(body.readings) ? body.readings.slice(0, 200) : [body];
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

app.use("/api/trpc/*", async (c) => fetchRequestHandler({
  endpoint: "/api/trpc",
  req: c.req.raw,
  router: appRouter,
  createContext,
}));

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  // INLINE SEED — bez importu, bez process.exit
  (async () => {
    try {
      console.log(">> Seed bootstrap...");
      const { getDb } = await import("./queries/connection");
      const s = await import("@db/schema");
      const { generateSchedule } = await import("./org-router");
      const db = getDb();

      // Helpers
      let rngSeed = 42;
      const rnd = () => { rngSeed = (rngSeed * 1664525 + 1013904223) % 4294967296; return rngSeed / 4294967296; };
      const ri = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
      const rf = (min: number, max: number) => min + rnd() * (max - min);
      const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
      const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
      const dateStr = (d: Date) => d.toISOString().slice(0, 10);

      // Cleanup
      console.log(">> Czyszczenie...");
      const tables = [
        s.auditLog, s.scheduleEvents, s.transfers, s.recipeItems,
        s.recipes, s.silos, s.warehouses, s.litter, s.vaccinations,
        s.treatments, s.sales, s.costs, s.feedUsages, s.mortalities,
        s.selects, s.weighings, s.batches, s.sectors, s.houses,
        s.farms, s.geneticLines, s.feedIngredients, s.companies,
      ];
      for (const t of tables) await db.delete(t);
      console.log("✓ Baza wyczyszczona");

      // Companies
      console.log(">> Firmy...");
      const COMPANIES = [
        { name: "Bloody Turkey Group S.A. (Demo)", cc: "PL" },
        { name: "Indykpol S.A.", cc: "PL" },
        { name: "Gospodarstwo Kowalski", cc: "PL" },
      ];
      const companyIds: number[] = [];
      for (const c of COMPANIES) {
        const [{ id }] = await db.insert(s.companies)
          .values({ name: c.name, countryCode: c.cc, baseCurrency: "EUR" }).$returningId();
        companyIds.push(id);
        await db.insert(s.auditLog).values({ tableName: "companies", recordId: id, action: "create", newValues: { name: c.name }, author: "seed" });
      }
      console.log(`✓ ${COMPANIES.length} firm`);

      // Genetic lines
      console.log(">> Linie genetyczne...");
      const LINES = ["BUT Big 6", "Hybrid Converter", "Aviagen Nicholas 700", "Hendrix XL"];
      const SUPPLIERS = ["Grelavi S.A.", "Aviagen Hatchery FR", "Hybrid Turkeys NL", "Gute Brut GmbH"];
      const lineIds: number[][] = [[], [], []];
      for (let ci = 0; ci < companyIds.length; ci++) {
        for (const l of LINES.slice(0, ci === 2 ? 2 : 4)) {
          const [{ id }] = await db.insert(s.geneticLines)
            .values({ companyId: companyIds[ci], name: l, supplier: pick(SUPPLIERS) }).$returningId();
          lineIds[ci].push(id);
        }
      }

      // Ingredients
      console.log(">> Składniki...");
      const INGREDIENTS = [
        { name: "Pszenica", cc: "PL", price: 205, cur: "EUR", protein: 12.5, energy: 3150, lys: 0.35, met: 0.18, fiber: 2.5, fat: 1.8, ca: 0.05, p: 0.32, stock: 420 },
        { name: "Kukurydza", cc: "HU", price: 198, cur: "EUR", protein: 8.5, energy: 3350, lys: 0.24, met: 0.18, fiber: 2.2, fat: 3.9, ca: 0.02, p: 0.27, stock: 380 },
        { name: "Jeżczyk", cc: "DE", price: 185, cur: "EUR", protein: 11.0, energy: 3000, lys: 0.38, met: 0.18, fiber: 4.5, fat: 2.1, ca: 0.06, p: 0.35, stock: 250 },
        { name: "Śruta sojowa 48%", cc: "NL", price: 412, cur: "EUR", protein: 48.0, energy: 2450, lys: 2.9, met: 0.65, fiber: 3.5, fat: 1.5, ca: 0.3, p: 0.65, stock: 210 },
        { name: "Śruta rzepakowa", cc: "PL", price: 295, cur: "EUR", protein: 36.0, energy: 2000, lys: 2.0, met: 0.7, fiber: 11.5, fat: 2.5, ca: 0.65, p: 1.05, stock: 160 },
        { name: "Groszek żółty", cc: "FR", price: 285, cur: "EUR", protein: 22.5, energy: 3050, lys: 1.6, met: 0.22, fiber: 5.5, fat: 1.4, ca: 0.12, p: 0.42, stock: 120 },
        { name: "Olej sojowy", cc: "NL", price: 890, cur: "EUR", protein: 0, energy: 8800, lys: 0, met: 0, fiber: 0, fat: 99.5, ca: 0, p: 0, stock: 45 },
        { name: "Tłuszcz drobiowy", cc: "DE", price: 760, cur: "EUR", protein: 0, energy: 8600, lys: 0, met: 0, fiber: 0, fat: 99.0, ca: 0, p: 0, stock: 30 },
        { name: "L-lizyna HCl", cc: "GB", price: 1450, cur: "EUR", protein: 94.0, energy: 3900, lys: 78.0, met: 0, fiber: 0, fat: 0, ca: 0, p: 0, stock: 12 },
        { name: "DL-metionina", cc: "FR", price: 2350, cur: "EUR", protein: 58.0, energy: 5000, lys: 0, met: 99.0, fiber: 0, fat: 0, ca: 0, p: 0, stock: 8 },
        { name: "Węglan wapnia", cc: "PL", price: 45, cur: "EUR", protein: 0, energy: 0, lys: 0, met: 0, fiber: 0, fat: 0, ca: 38.0, p: 0, stock: 200 },
        { name: "Fosforan monowapniowy", cc: "CZ", price: 620, cur: "EUR", protein: 0, energy: 0, lys: 0, met: 0, fiber: 0, fat: 0, ca: 17.0, p: 22.5, stock: 40 },
        { name: "Premiks witaminowo-mineralny", cc: "DK", price: 3200, cur: "EUR", protein: 0, energy: 0, lys: 0, met: 0, fiber: 0, fat: 0, ca: 12.0, p: 4.0, stock: 15 },
      ];
      const ingredientIds: number[] = [];
      for (const ing of INGREDIENTS) {
        const [{ id }] = await db.insert(s.feedIngredients).values({
          companyId: companyIds[0], name: ing.name, countryCode: ing.cc, pricePerTon: ing.price.toFixed(2),
          currency: ing.cur, proteinPct: ing.protein.toFixed(2), energyKcal: ing.energy,
          lysinePct: ing.lys.toFixed(3), methioninePct: ing.met.toFixed(3),
          fiberPct: ing.fiber.toFixed(2), fatPct: ing.fat.toFixed(2),
          calciumPct: ing.ca.toFixed(2), phosphorusPct: ing.p.toFixed(2), stockTons: ing.stock.toFixed(2),
        }).$returningId();
        ingredientIds.push(id);
      }
      console.log(`✓ ${INGREDIENTS.length} składników`);

      // Farms + Houses + Batches
      console.log(">> Fermy i rzuty...");
      const FARMS = [
        { company: 0, name: "Ferma Wielkopolska", cc: "PL", city: "Września", lat: 52.325, lng: 17.565, cap: 120000 },
        { company: 0, name: "Ferma Mazury", cc: "PL", city: "Olsztyn", lat: 53.778, lng: 20.48, cap: 95000 },
        { company: 0, name: "Ferme Bretagne", cc: "FR", city: "Rennes", lat: 48.117, lng: -1.677, cap: 110000 },
        { company: 1, name: "Ferma Olsztyńska 1", cc: "PL", city: "Olsztynek", lat: 53.583, lng: 20.285, cap: 140000 },
        { company: 1, name: "Ferma Lubawska", cc: "PL", city: "Lubawa", lat: 53.504, lng: 19.749, cap: 88000 },
        { company: 2, name: "Kowalski — kurniki rodzinne", cc: "PL", city: "Żuromin", lat: 53.064, lng: 19.909, cap: 18000 },
      ];
      let batchSeq = 0;
      for (const f of FARMS) {
        const companyId = companyIds[f.company];
        const [{ id: farmId }] = await db.insert(s.farms).values({
          companyId, name: f.name, countryCode: f.cc, city: f.city,
          lat: f.lat.toFixed(5), lng: f.lng.toFixed(5), capacity: f.cap,
        }).$returningId();
        await db.insert(s.warehouses).values({ farmId, name: `Magazyn ${f.city}`, capacityTons: ri(200, 600).toFixed(1) });
        for (let si = 1; si <= 2; si++) {
          await db.insert(s.silos).values({
            farmId, name: `Silos ${si}`, capacityTons: ri(40, 80).toFixed(1),
            currentTons: rf(5, 60).toFixed(2),
          });
        }
        const houseCount = f.company === 2 ? 2 : ri(3, 4);
        for (let h = 1; h <= houseCount; h++) {
          const isBrooder = h === 1;
          const area = isBrooder ? ri(600, 900) : ri(1500, 2400);
          const [{ id: houseId }] = await db.insert(s.houses).values({
            farmId, name: isBrooder ? "Odchowalnia A" : `Kurnik ${h - 1}`,
            houseType: isBrooder ? "brooder" : "finisher",
            areaM2: area.toFixed(1), maxDensityKgM2: isBrooder ? "25.0" : "42.0",
          }).$returningId();
          await db.insert(s.litter).values({
            houseId, material: pick(["słoma pszenna", "trociny", "słoma lniana"]),
            thicknessCm: rf(6, 12).toFixed(1), moisturePct: rf(15, 35).toFixed(2),
            cost: rf(800, 2500).toFixed(2), laidAt: dateStr(daysAgo(ri(20, 100))),
          });
          const nBatches = ri(1, 2);
          for (let b = 0; b < nBatches; b++) {
            batchSeq++;
            const sex = pick(["toms", "hens"] as const);
            const age = ri(28, 120);
            const start = daysAgo(age);
            const initial = ri(8000, 22000);
            const lineIdx = ri(0, Math.max(0, lineIds[f.company].length - 1));
            const [{ id: batchId }] = await db.insert(s.batches).values({
              houseId, geneticLineId: lineIds[f.company][lineIdx] ?? null,
              code: `RZ/${new Date().getFullYear()}/${String(batchSeq).padStart(3, "0")}`,
              geneticLine: LINES[lineIdx] ?? LINES[0], sex, chickSupplier: pick(SUPPLIERS),
              chickPrice: rf(1.35, 1.85).toFixed(3),
              startDate: dateStr(start),
              plannedEndDate: dateStr(daysAgo(age - (sex === "toms" ? 140 : 115))),
              initialCount: initial, currentCount: initial, soldCount: 0,
              status: "active",
            }).$returningId();
            await db.insert(s.auditLog).values({ tableName: "batches", recordId: batchId, action: "create", newValues: { initialCount: initial }, author: "seed" });
            
            // Ważenia
            for (let day = 7; day <= age; day += 7) {
              const avgG = Math.round(50 + (day / age) * 10000);
              await db.insert(s.weighings).values({
                batchId, weighedAt: daysAgo(age - day), dayAge: day,
                sampleSize: 50, avgWeightG: avgG, medianG: avgG, stdDevG: 500,
                minG: avgG - 1000, maxG: avgG + 1000,
                cv: "15.5", operator: "Seed",
              });
            }
          }
        }
      }
      console.log(`✓ ${batchSeq} rzutów`);

      console.log("✓ Seed SUCCESS — 3 firmy, 6 farm, składniki, rzuty, receptury");
    } catch (e) {
      console.error("❌ Seed ERROR:", e instanceof Error ? e.message : String(e));
    }
  })();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

