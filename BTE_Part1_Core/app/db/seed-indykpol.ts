/**
 * SEED INDIKPOL — idempotentny seed firmy demonstracyjnej Indykpol S.A.
 * Używa seedDomainData() do wypełnienia wszystkich danych hodowlanych.
 * Dodaje: fermy, kurniki, rzuty z pełną historią produkcyjną.
 */
import { getDb } from "../api/queries/connection";
import * as s from "./schema";
import { eq, and, ne } from "drizzle-orm";
import { generateSchedule } from "../api/org-router";
import { seedDomainData } from "./seed-domain-data";

let seed = 42;
function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
const ri = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const rf = (min: number, max: number) => min + rnd() * (max - min);
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }

export async function ensureIndykpolDemo(): Promise<number> {
  const db = getDb();

  // 1. Znajdź lub utwórz firmę Indykpol
  const [existing] = await db.select().from(s.companies)
    .where(and(eq(s.companies.name, "Indykpol S.A."), ne(s.companies.status, "archived")));

  let companyId: number;
  if (existing) {
    companyId = existing.id;
    console.log(`Indykpol S.A. już istnieje (id=${companyId})`);
  } else {
    console.log("Tworzę Indykpol S.A. (demo)...");
    [{ id: companyId }] = await db.insert(s.companies).values({
      name: "Indykpol S.A.", countryCode: "PL", baseCurrency: "PLN", isDemo: true,
      address: "ul. Indykowa 15, 11-015 Olsztynek", nip: "7390001234",
      contact: "biuro@indykpol-demo.pl",
    }).$returningId();
  }

  // 2. Dane domenowe (normy, receptury, programy, choroby, leki, dostawcy)
  await seedDomainData(companyId);

  // 3. Sprawdź czy ma już dane produkcyjne
  const existingBatches = await db.select().from(s.batches)
    .where(eq(s.batches.companyId, companyId)).limit(1);
  if (existingBatches.length > 0) {
    console.log("Indykpol ma już dane produkcyjne — pomijam.");
    return companyId;
  }

  // 4. Fermy Indykpol
  const FARMS = [
    { name: "Ferma Olsztyńska 1", cc: "PL", city: "Olsztynek", lat: 53.583, lng: 20.285, cap: 140000 },
    { name: "Ferma Lubawska", cc: "PL", city: "Lubawa", lat: 53.504, lng: 19.749, cap: 88000 },
  ];

  // Pobierz linie genetyczne i receptury dla tej firmy
  const lines = await db.select().from(s.geneticLines)
    .where(and(eq(s.geneticLines.companyId, companyId), ne(s.geneticLines.status, "archived")));
  const recipes = await db.select().from(s.recipes)
    .where(eq(s.recipes.companyId, companyId));

  let batchSeq = 0;

  for (const f of FARMS) {
    const [{ id: farmId }] = await db.insert(s.farms).values({
      companyId, name: f.name, countryCode: f.cc, city: f.city,
      lat: f.lat.toFixed(5), lng: f.lng.toFixed(5), capacity: f.cap, isDemo: true,
    }).$returningId();

    // Magazyn + silosy
    await db.insert(s.warehouses).values({ farmId, name: `Magazyn ${f.city}`, capacityTons: "400.0" });
    for (let si = 1; si <= 2; si++) {
      await db.insert(s.silos).values({
        farmId, name: `Silos ${si}`, capacityTons: "60.0", currentTons: rf(20, 55).toFixed(2),
      });
    }

    // Kurniki
    const houseCount = ri(3, 4);
    for (let h = 1; h <= houseCount; h++) {
      const isBrooder = h === 1;
      const area = isBrooder ? ri(600, 900) : ri(1500, 2400);
      const [{ id: houseId }] = await db.insert(s.houses).values({
        farmId, name: isBrooder ? "Odchowalnia A" : `Kurnik ${h - 1}`,
        houseType: isBrooder ? "brooder" : "finisher",
        areaM2: area.toFixed(1), maxDensityKgM2: isBrooder ? "25.0" : "42.0",
      }).$returningId();

      // Ściółka
      await db.insert(s.litter).values({
        houseId, material: pick(["słoma pszenna", "trociny"]),
        thicknessCm: rf(6, 12).toFixed(1), moisturePct: rf(15, 35).toFixed(2),
        cost: rf(800, 2500).toFixed(2), laidAt: dateStr(daysAgo(ri(20, 100))),
      });

      // Rzuty
      const nBatches = ri(1, 2);
      for (let b = 0; b < nBatches; b++) {
        batchSeq++;
        const sex = pick(["toms", "hens"] as const);
        const isTom = sex === "toms";
        const closed = rnd() < 0.3;
        const age = closed ? ri(115, 145) : ri(28, 120);
        const start = daysAgo(age);
        const initial = ri(8000, 22000);
        const mortalityPct = rf(1.5, 5.5);
        const dead = Math.round(initial * mortalityPct / 100);
        const sold = closed ? initial - dead : 0;
        const current = closed ? 0 : initial - dead;
        const lineIdx = ri(0, lines.length - 1);

        const [{ id: batchId }] = await db.insert(s.batches).values({
          houseId, geneticLineId: lines[lineIdx]?.id ?? null,
          code: `RZ/${new Date().getFullYear()}/${String(batchSeq).padStart(3, "0")}`,
          geneticLine: lines[lineIdx]?.name ?? "B.U.T. BIG 6",
          sex, chickSupplier: pick(["Grelavi S.A.", "Aviagen Turkeys", "Hybrid Turkeys"]),
          chickPrice: rf(1.35, 1.85).toFixed(3),
          startDate: dateStr(start),
          plannedEndDate: dateStr(daysAgo(age - (isTom ? 140 : 115))),
          initialCount: initial, currentCount: current, soldCount: sold,
          status: closed ? "closed" : "active",
        }).$returningId();

        // Harmonogram
        await generateSchedule(batchId, dateStr(start), sex);
        const pastEvents = await db.select().from(s.scheduleEvents)
          .where(eq(s.scheduleEvents.batchId, batchId));
        for (const ev of pastEvents) {
          if (ev.day < dateStr(new Date())) {
            await db.update(s.scheduleEvents).set({ done: true, doneAt: new Date() })
              .where(eq(s.scheduleEvents.id, ev.id));
          }
        }

        // Ważenia co 7 dni
        const targetKg = isTom ? 21 : 11.5;
        const growthDays = isTom ? 140 : 112;
        let prevAvgG = 45;
        for (let day = 7; day <= age; day += 7) {
          const t = Math.min(day / growthDays, 1);
          const avgKg = targetKg * Math.pow(t, 1.35) * (1 + rf(-0.05, 0.05)) + 0.04;
          const avgG = Math.max(50, Math.round(avgKg * 1000));
          const sd = Math.round(avgG * rf(0.08, 0.14));
          await db.insert(s.weighings).values({
            batchId, weighedAt: daysAgo(age - day), dayAge: day,
            sampleSize: Math.min(100, Math.max(30, Math.round(current * 0.01))),
            avgWeightG: avgG, medianG: avgG + ri(-60, 60), stdDevG: sd,
            minG: Math.round(avgG - sd * 2.2), maxG: Math.round(avgG + sd * 2.4),
            cv: ((sd / avgG) * 100).toFixed(2), operator: pick(["J. Nowak", "M. Wiśniewski"]),
          });
          prevAvgG = avgG;
        }

        // Padnięcia
        let remainingDead = dead;
        for (let day = 1; day <= age && remainingDead > 0; day += ri(1, 3)) {
          const c = Math.min(remainingDead, Math.max(1, Math.round(initial * rf(0.0002, 0.0012))));
          remainingDead -= c;
          await db.insert(s.mortalities).values({
            batchId, day: dateStr(daysAgo(age - day)), count: c,
            cause: pick(["podbieranie", "zawał", "zaburzenia trawienne", "noga/ochwat", "nieznana"]),
          });
        }

        // Zużycie paszy
        const fcr = rf(2.25, 2.75);
        for (let day = 7; day <= age; day += 7) {
          const t = Math.min(day / growthDays, 1);
          const kgNow = initial * targetKg * Math.pow(t, 1.35);
          const dailyKg = (kgNow * fcr) / Math.max(day, 1);
          const recipeIdx = Math.min(Math.floor(day / 40), recipes.length - 1);
          await db.insert(s.feedUsages).values({
            batchId, day: dateStr(daysAgo(age - day)), kg: (dailyKg * 7 * rf(0.92, 1.08)).toFixed(1),
            recipeId: recipes[recipeIdx]?.id ?? null,
          });
        }

        // Koszty
        await db.insert(s.costs).values({ batchId, category: "chicks", amount: (initial * rf(1.35, 1.85)).toFixed(2), currency: "PLN", day: dateStr(start) });
        const feedKg = (initial - dead / 2) * (isTom ? 55 : 30) * rf(0.9, 1.1);
        await db.insert(s.costs).values({ batchId, category: "feed", amount: (feedKg * rf(0.36, 0.44)).toFixed(2), currency: "PLN", day: dateStr(daysAgo(3)) });
        await db.insert(s.costs).values({ batchId, category: "energy", amount: rf(2200, 6500).toFixed(2), currency: "PLN", day: dateStr(daysAgo(10)) });
        await db.insert(s.costs).values({ batchId, category: "litter", amount: rf(1200, 3800).toFixed(2), currency: "PLN", day: dateStr(start) });
        await db.insert(s.costs).values({ batchId, category: "labor", amount: rf(3500, 9000).toFixed(2), currency: "PLN", day: dateStr(daysAgo(5)) });

        // Sprzedaż dla zamkniętych
        if (closed && sold > 0) {
          await db.insert(s.sales).values({
            batchId, day: dateStr(daysAgo(ri(1, 30))), birdCount: sold,
            totalWeightKg: (sold * (isTom ? rf(19.5, 21.5) : rf(10.8, 12.2))).toFixed(1),
            pricePerKg: rf(1.55, 1.95).toFixed(3), currency: "PLN",
            buyer: pick(["Indykpol S.A.", "Paul-Philipp GmbH", "Doux SA"]),
          });
        }

        // Szczepienia
        const VACCINES = [
          { v: "ND — La Sota", m: "aerozol/woda" },
          { v: "TRT / aMPV", m: "aerozol" },
          { v: "HE — choroba krwotoczna", m: "injekcja" },
          { v: "FP — ospka ptasia", m: "skrobanie" },
        ];
        for (const vc of VACCINES) {
          const vday = ri(5, Math.max(6, age - 3));
          if (vday <= age) {
            await db.insert(s.vaccinations).values({
              batchId, day: dateStr(daysAgo(age - vday)), vaccine: vc.v, method: vc.m, done: true,
            });
          }
        }

        // Leczenie (dla ~50% rzutów)
        if (rnd() < 0.5) {
          const meds = [
            { p: "Doksycyklina 50%", s: "Doksycyklina", d: "10 mg/kg mc.", w: 14, cost: rf(150, 400) },
            { p: "Toltrazuril 2.5%", s: "Toltrazuril", d: "7 mg/kg mc.", w: 14, cost: rf(200, 500) },
            { p: "Amoksycylina 15%", s: "Amoksycylina", d: "15 mg/kg mc.", w: 7, cost: rf(100, 300) },
          ];
          const med = pick(meds);
          const tday = ri(10, Math.max(11, age - med.w - 2));
          if (tday <= age) {
            await db.insert(s.treatments).values({
              batchId, startedAt: dateStr(daysAgo(age - tday)),
              product: med.p, activeSubstance: med.s, dose: med.d,
              reason: pick(["choroby układu oddechowego", "enteritis", "zapalenie podeszwy", "profilaktyka"]),
              withdrawalDays: med.w, vet: pick(["dr A. Kowalska", "Dr. B. Fournier"]),
              cost: med.cost.toFixed(2),
            });
            await db.insert(s.costs).values({
              batchId, category: "vet", amount: med.cost.toFixed(2), currency: "PLN",
              day: dateStr(daysAgo(age - tday)), note: med.p,
            });
          }
        }
      }
    }
  }

  console.log(`Indykpol S.A. gotowe: ${FARMS.length} fermy, ${batchSeq} rzutów`);
  return companyId;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureIndykpolDemo()
    .then((id) => { console.log(`OK: companyId=${id}`); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
