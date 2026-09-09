import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { generateSchedule } from "../api/org-router";

/* Deterministyczny RNG */
let s = 42;
function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }
const ri = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const rf = (min: number, max: number) => min + rnd() * (max - min);
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }

const COMPANIES = [
  { name: "Bloody Turkey Group S.A. (Demo)", cc: "PL" },
  { name: "Indykpol S.A.", cc: "PL" },
  { name: "Gospodarstwo Kowalski", cc: "PL" },
];

const FARMS: Array<{
  company: number; name: string; cc: string; city: string; lat: number; lng: number; cap: number;
}> = [
  { company: 0, name: "Ferma Wielkopolska", cc: "PL", city: "Września", lat: 52.325, lng: 17.565, cap: 120000 },
  { company: 0, name: "Ferma Mazury", cc: "PL", city: "Olsztyn", lat: 53.778, lng: 20.48, cap: 95000 },
  { company: 0, name: "Ferme Bretagne", cc: "FR", city: "Rennes", lat: 48.117, lng: -1.677, cap: 110000 },
  { company: 0, name: "Putenfarm Niedersachsen", cc: "DE", city: "Cloppenburg", lat: 52.847, lng: 8.045, cap: 100000 },
  { company: 0, name: "Granja Castilla", cc: "ES", city: "Valladolid", lat: 41.652, lng: -4.724, cap: 90000 },
  { company: 0, name: "Allevamento Veneto", cc: "IT", city: "Verona", lat: 45.438, lng: 10.992, cap: 65000 },
  { company: 0, name: "Pulykafarm Hajdú-Bihar", cc: "HU", city: "Debrecen", lat: 47.531, lng: 21.627, cap: 75000 },
  { company: 0, name: "Kalkoenboerderij Brabant", cc: "NL", city: "Eindhoven", lat: 51.441, lng: 5.47, cap: 60000 },
  { company: 0, name: "Turkey Farm Yorkshire", cc: "GB", city: "York", lat: 53.959, lng: -1.081, cap: 55000 },
  { company: 1, name: "Ferma Olsztyńska 1", cc: "PL", city: "Olsztynek", lat: 53.583, lng: 20.285, cap: 140000 },
  { company: 1, name: "Ferma Lubawska", cc: "PL", city: "Lubawa", lat: 53.504, lng: 19.749, cap: 88000 },
  { company: 2, name: "Kowalski — kurniki rodzinne", cc: "PL", city: "Żuromin", lat: 53.064, lng: 19.909, cap: 18000 },
];

const LINES = ["BUT Big 6", "Hybrid Converter", "Aviagen Nicholas 700", "Hendrix XL"];
const SUPPLIERS = ["Grelavi S.A.", "Aviagen Hatchery FR", "Hybrid Turkeys NL", "Gute Brut GmbH"];
const VETS = ["dr A. Kowalska", "Dr. B. Fournier", "Dr. M. Schneider", "Dr. E. Rossi"];
const OPERATORS = ["J. Nowak", "M. Wiśniewski", "C. Dubois", "H. Weber", "L. García", "P. Jensen"];

const INGREDIENTS: Array<{
  name: string; cc: string; price: number; cur: string; protein: number;
  energy: number; lys: number; met: number; fiber: number; fat: number;
  ca: number; p: number; stock: number;
}> = [
  { name: "Pszenica", cc: "PL", price: 205, cur: "EUR", protein: 12.5, energy: 3150, lys: 0.35, met: 0.18, fiber: 2.5, fat: 1.8, ca: 0.05, p: 0.32, stock: 420 },
  { name: "Kukurydza", cc: "HU", price: 198, cur: "EUR", protein: 8.5, energy: 3350, lys: 0.24, met: 0.18, fiber: 2.2, fat: 3.9, ca: 0.02, p: 0.27, stock: 380 },
  { name: "Jęczmień", cc: "DE", price: 185, cur: "EUR", protein: 11.0, energy: 3000, lys: 0.38, met: 0.18, fiber: 4.5, fat: 2.1, ca: 0.06, p: 0.35, stock: 250 },
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

const MEDICINES: Array<{ p: string; s: string; d: string; w: number; cost: number }> = [
  { p: "Doxycyklina 50%", s: "doksykcyklina", d: "10 mg/kg m.c. w wodzie", w: 14, cost: 420 },
  { p: "Amoxicare 70%", s: "amoksycylina", d: "20 mg/kg m.c. w wodzie", w: 7, cost: 380 },
  { p: "Florfenikol 10%", s: "florfenikol", d: "30 mg/kg m.c.", w: 12, cost: 560 },
  { p: "Enroflox 10%", s: "enrofloksacyna", d: "10 mg/kg m.c.", w: 10, cost: 480 },
];

const VACCINES = [
  { v: "ND (Newcastle) — La Sota", m: "woda pitna" },
  { v: "TRT / aMPV", m: "aerozol" },
  { v: "HE (choroba krwotoczna)", m: "woda pitna" },
];

async function seed() {
  const db = getDb();
  console.log("Czyszczenie...");
  const tables = [
    schema.auditLog, schema.scheduleEvents, schema.transfers, schema.recipeItems,
    schema.recipes, schema.silos, schema.warehouses, schema.litter, schema.vaccinations,
    schema.treatments, schema.sales, schema.costs, schema.feedUsages, schema.mortalities,
    schema.selects, schema.weighings, schema.batches, schema.sectors, schema.houses,
    schema.farms, schema.geneticLines, schema.feedIngredients, schema.companies,
  ];
  for (const t of tables) await db.delete(t);

  console.log("Firmy...");
  const companyIds: number[] = [];
  for (const c of COMPANIES) {
    const [{ id }] = await db.insert(schema.companies)
      .values({ name: c.name, countryCode: c.cc, baseCurrency: "EUR" }).$returningId();
    companyIds.push(id);
    await db.insert(schema.auditLog).values({ tableName: "companies", recordId: id, action: "create", newValues: { name: c.name }, author: "seed" });
  }

  console.log("Linie genetyczne...");
  const lineIds: number[][] = [[], [], []];
  for (let ci = 0; ci < companyIds.length; ci++) {
    for (const l of LINES.slice(0, ci === 2 ? 2 : 4)) {
      const [{ id }] = await db.insert(schema.geneticLines)
        .values({ companyId: companyIds[ci], name: l, supplier: pick(SUPPLIERS) }).$returningId();
      lineIds[ci].push(id);
    }
  }

  console.log("Składniki...");
  const ingredientIds: number[] = [];
  for (const ing of INGREDIENTS) {
    const [{ id }] = await db.insert(schema.feedIngredients).values({
      companyId: companyIds[0], name: ing.name, countryCode: ing.cc, pricePerTon: ing.price.toFixed(2),
      currency: ing.cur, proteinPct: ing.protein.toFixed(2), energyKcal: ing.energy,
      lysinePct: ing.lys.toFixed(3), methioninePct: ing.met.toFixed(3),
      fiberPct: ing.fiber.toFixed(2), fatPct: ing.fat.toFixed(2),
      calciumPct: ing.ca.toFixed(2), phosphorusPct: ing.p.toFixed(2), stockTons: ing.stock.toFixed(2),
    }).$returningId();
    ingredientIds.push(id);
  }

  console.log("Fermy, obiekty, sektory, magazyny, rzuty...");
  let batchSeq = 0;
  let demoTransferSource = 0;
  const finisherHouseIds: number[] = [];

  for (const f of FARMS) {
    const companyId = companyIds[f.company];
    const [{ id: farmId }] = await db.insert(schema.farms).values({
      companyId, name: f.name, countryCode: f.cc, city: f.city,
      lat: f.lat.toFixed(5), lng: f.lng.toFixed(5), capacity: f.cap,
    }).$returningId();

    // magazyn + silosy na fermę
    await db.insert(schema.warehouses).values({ farmId, name: `Magazyn ${f.city}`, capacityTons: ri(200, 600).toFixed(1) });
    for (let si = 1; si <= 2; si++) {
      await db.insert(schema.silos).values({
        farmId, name: `Silos ${si}`, capacityTons: ri(40, 80).toFixed(1),
        currentTons: rf(5, 60).toFixed(2),
      });
    }

    const houseCount = f.company === 2 ? 2 : ri(3, 4);
    for (let h = 1; h <= houseCount; h++) {
      const isBrooder = h === 1;
      const area = isBrooder ? ri(600, 900) : ri(1500, 2400);
      const [{ id: houseId }] = await db.insert(schema.houses).values({
        farmId, name: isBrooder ? "Odchowalnia A" : `Kurnik ${h - 1}`,
        houseType: isBrooder ? "brooder" : "finisher",
        areaM2: area.toFixed(1), maxDensityKgM2: isBrooder ? "25.0" : "42.0",
      }).$returningId();
      if (!isBrooder) finisherHouseIds.push(houseId);

      // sektory dla kurników
      if (!isBrooder && rnd() < 0.6) {
        const nSec = ri(2, 4);
        for (let k = 0; k < nSec; k++) {
          await db.insert(schema.sectors).values({
            houseId, name: `Sektor ${String.fromCharCode(65 + k)}`, areaM2: (area / nSec).toFixed(1),
          });
        }
      }

      // ściółka
      await db.insert(schema.litter).values({
        houseId, material: pick(["słoma pszenna", "trociny", "słoma lniana"]),
        thicknessCm: rf(6, 12).toFixed(1), moisturePct: rf(15, 35).toFixed(2),
        cost: rf(800, 2500).toFixed(2), laidAt: dateStr(daysAgo(ri(20, 100))),
      });

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
        const lineIdx = ri(0, Math.max(0, lineIds[f.company].length - 1));
        const [{ id: batchId }] = await db.insert(schema.batches).values({
          houseId, geneticLineId: lineIds[f.company][lineIdx] ?? null,
          code: `RZ/${new Date().getFullYear()}/${String(batchSeq).padStart(3, "0")}`,
          geneticLine: LINES[lineIdx] ?? LINES[0], sex, chickSupplier: pick(SUPPLIERS),
          chickPrice: rf(1.35, 1.85).toFixed(3),
          startDate: dateStr(start),
          plannedEndDate: dateStr(daysAgo(age - (isTom ? 140 : 115))),
          initialCount: initial, currentCount: current, soldCount: sold,
          status: closed ? "closed" : "active",
        }).$returningId();
        await db.insert(schema.auditLog).values({ tableName: "batches", recordId: batchId, action: "create", newValues: { initialCount: initial }, author: "seed" });

        // Workflow Engine — pełny harmonogram
        await generateSchedule(batchId, dateStr(start), sex);
        // oznacz przeszłe zdarzenia jako wykonane
        await db.update(schema.scheduleEvents).set({ done: true, doneAt: new Date() })
          .where(
            // drizzle: day < today — uproszczenie: pobierz i porównaj
            (await import("drizzle-orm")).and(
              (await import("drizzle-orm")).eq(schema.scheduleEvents.batchId, batchId),
              (await import("drizzle-orm")).lt(schema.scheduleEvents.day, dateStr(new Date())),
            ),
          );

        // Ważenia co 7 dni
        const targetKg = isTom ? 21 : 11.5;
        const growthDays = isTom ? 140 : 112;
        let prevAvgG = 45;
        for (let day = 7; day <= age; day += 7) {
          const t = Math.min(day / growthDays, 1);
          const avgKg = targetKg * Math.pow(t, 1.35) * (1 + rf(-0.05, 0.05)) + 0.04;
          const avgG = Math.max(50, Math.round(avgKg * 1000));
          const sd = Math.round(avgG * rf(0.08, 0.14));
          await db.insert(schema.weighings).values({
            batchId, weighedAt: daysAgo(age - day), dayAge: day,
            sampleSize: Math.min(100, Math.max(30, Math.round(current * 0.01))),
            avgWeightG: avgG, medianG: avgG + ri(-60, 60), stdDevG: sd,
            minG: Math.round(avgG - sd * 2.2), maxG: Math.round(avgG + sd * 2.4),
            cv: ((sd / avgG) * 100).toFixed(2), operator: pick(OPERATORS),
          });
          prevAvgG = avgG;
        }

        // Śmiertelność
        let remainingDead = dead;
        for (let day = 1; day <= age && remainingDead > 0; day += ri(1, 3)) {
          const c = Math.min(remainingDead, Math.max(1, Math.round(initial * rf(0.0002, 0.0012))));
          remainingDead -= c;
          await db.insert(schema.mortalities).values({
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
          await db.insert(schema.feedUsages).values({
            batchId, day: dateStr(daysAgo(age - day)), kg: (dailyKg * 7 * rf(0.92, 1.08)).toFixed(1),
          });
        }

        // Selekty dynamiczne
        if (!closed && current > 0) {
          const nSel = ri(2, 3);
          let left = current;
          for (let k = 0; k < nSel; k++) {
            const cnt = k === nSel - 1 ? left : Math.round(current * rf(0.2, 0.45));
            left -= cnt;
            const dev = rf(-0.09, 0.1);
            const status = dev < -0.05 ? "critical" : dev < -0.015 ? "warning" : "ok";
            await db.insert(schema.selects).values({
              batchId, name: `Selekt ${String.fromCharCode(65 + k)}`,
              criteria: dev < -0.05 ? "odchylenie masy < -5% od normy" : dev < -0.015 ? "odchylenie -1.5..-5%" : "w normie wagowej",
              origin: "dynamic", birdCount: cnt,
              avgWeightG: Math.round(prevAvgG * (1 + dev)),
              fcr: (fcr + rf(-0.15, 0.25)).toFixed(3),
              mortalityPct: rf(0.8, 3.2).toFixed(2),
              waterIntakeMl: Math.round(prevAvgG * rf(0.16, 0.22)),
              status,
            });
          }
        }

        // Szczepienia wykonane
        for (const vc of VACCINES) {
          const vday = ri(5, Math.max(6, age - 3));
          await db.insert(schema.vaccinations).values({
            batchId, day: dateStr(daysAgo(age - vday)), vaccine: vc.v, method: vc.m, done: true,
          });
        }

        // Leczenie
        if (rnd() < 0.5) {
          const med = pick(MEDICINES);
          const tday = ri(10, Math.max(11, age - med.w - 2));
          await db.insert(schema.treatments).values({
            batchId, startedAt: dateStr(daysAgo(age - tday)),
            product: med.p, activeSubstance: med.s, dose: med.d,
            reason: pick(["choroby układu oddechowego", "enteritis", "zapalenie podeszwy", "profilaktyka"]),
            withdrawalDays: med.w, vet: pick(VETS), cost: med.cost.toFixed(2),
          });
          await db.insert(schema.costs).values({
            batchId, category: "vet", amount: med.cost.toFixed(2), currency: "EUR",
            day: dateStr(daysAgo(age - tday)), note: med.p,
          });
        }

        // Koszty
        await db.insert(schema.costs).values({ batchId, category: "chicks", amount: (initial * rf(1.35, 1.85)).toFixed(2), currency: "EUR", day: dateStr(start) });
        const feedKg = (initial - dead / 2) * (isTom ? 55 : 30) * rf(0.9, 1.1);
        await db.insert(schema.costs).values({ batchId, category: "feed", amount: (feedKg * rf(0.36, 0.44)).toFixed(2), currency: "EUR", day: dateStr(daysAgo(3)) });
        await db.insert(schema.costs).values({ batchId, category: "energy", amount: rf(2200, 6500).toFixed(2), currency: "EUR", day: dateStr(daysAgo(10)) });
        await db.insert(schema.costs).values({ batchId, category: "litter", amount: rf(1200, 3800).toFixed(2), currency: "EUR", day: dateStr(start) });
        await db.insert(schema.costs).values({ batchId, category: "labor", amount: rf(3500, 9000).toFixed(2), currency: "EUR", day: dateStr(daysAgo(5)) });

        // Sprzedaż dla zamkniętych
        if (closed && sold > 0) {
          await db.insert(schema.sales).values({
            batchId, day: dateStr(daysAgo(ri(1, 30))), birdCount: sold,
            totalWeightKg: (sold * (isTom ? rf(19.5, 21.5) : rf(10.8, 12.2))).toFixed(1),
            pricePerKg: rf(1.55, 1.95).toFixed(3), currency: "EUR",
            buyer: pick(["Indykpol S.A.", "Paul-Philipp GmbH", "Doux SA", "AIA SpA", "Avigrup Iberica"]),
          });
        }

        // zapamiętaj aktywny rzut z odchowalni do transferu demo
        if (!closed && isBrooder && demoTransferSource === 0 && current > 5000) {
          demoTransferSource = batchId;
        }
      }
    }
  }

  console.log("Transfer demonstracyjny...");
  if (demoTransferSource && finisherHouseIds.length > 0) {
    const [src] = await db.select().from(schema.batches).where((await import("drizzle-orm")).eq(schema.batches.id, demoTransferSource));
    const cnt = Math.min(3000, src.currentCount - 1000);
    const [{ id: tgtId }] = await db.insert(schema.batches).values({
      houseId: finisherHouseIds[0], code: `${src.code}/T`, geneticLine: src.geneticLine,
      geneticLineId: src.geneticLineId, sex: src.sex, chickSupplier: src.chickSupplier,
      chickPrice: src.chickPrice, startDate: src.startDate, plannedEndDate: src.plannedEndDate,
      initialCount: cnt, currentCount: cnt,
    }).$returningId();
    await db.update(schema.batches).set({ currentCount: src.currentCount - cnt })
      .where((await import("drizzle-orm")).eq(schema.batches.id, src.id));
    await db.insert(schema.transfers).values({
      sourceBatchId: src.id, targetBatchId: tgtId, birdCount: cnt,
      avgWeightG: 2400, transportMortality: 4, transferDate: daysAgo(3),
      durationMin: 75, driver: "K. Malinowski", vehicle: "PL WND 45213",
      signatureFrom: "J. Nowak", signatureTo: "M. Wiśniewski",
      documentNo: `TR/${new Date().getFullYear()}/00001`,
    });
    await generateSchedule(tgtId, src.startDate, src.sex);
  }

  console.log("Receptury...");
  const grain = ingredientIds[0], corn = ingredientIds[1], sbm = ingredientIds[3];
  const rapeseed = ingredientIds[4], oil = ingredientIds[7], lys = ingredientIds[8];
  const met = ingredientIds[9], lime = ingredientIds[10], premix = ingredientIds[12];

  const RECIPES = [
    {
      name: "Starter OptiCost", age: "0–4 tyg.", strat: "cheapest" as const, cost: 348.2, protein: 27.2, energy: 2870, lys: 1.62,
      expl: "Zwiększono udział śruty rzepakowej (tańsze białko niż soja) oraz dodano L-lizynę — poziom lizyny spadł poniżej normy 1.60% dla 3. tygodnia.",
      items: [{ id: grain, pct: 38 }, { id: corn, pct: 12 }, { id: sbm, pct: 32 }, { id: rapeseed, pct: 8 }, { id: oil, pct: 4.5 }, { id: lys, pct: 0.4 }, { id: met, pct: 0.35 }, { id: lime, pct: 1.8 }, { id: premix, pct: 2.5 }],
    },
    {
      name: "Grower MaxADG", age: "5–9 tyg.", strat: "maxGrowth" as const, cost: 372.6, protein: 24.8, energy: 3030, lys: 1.48,
      expl: "Maksymalizacja przyrostu: podniesiono energię tłuszczem i zwiększono gęstość aminokwasów zgodnie z normą Hybrid Converter dla 7. tygodnia.",
      items: [{ id: corn, pct: 44 }, { id: grain, pct: 12 }, { id: sbm, pct: 30 }, { id: oil, pct: 6.5 }, { id: lys, pct: 0.45 }, { id: met, pct: 0.4 }, { id: lime, pct: 1.7 }, { id: premix, pct: 2.5 }],
    },
    {
      name: "Finisher Balanced", age: "10–15 tyg.", strat: "balanced" as const, cost: 331.4, protein: 20.1, energy: 3180, lys: 1.12,
      expl: "Kompromis koszt/wynik: część śruty sojowej zastąpiono groszkiem i śrutą rzepakową, relacja lizyna:energia 0.35 g/Mcal. Oszczędność 8.4 EUR/t.",
      items: [{ id: grain, pct: 46 }, { id: corn, pct: 18 }, { id: sbm, pct: 18 }, { id: rapeseed, pct: 6 }, { id: oil, pct: 6 }, { id: lys, pct: 0.3 }, { id: met, pct: 0.28 }, { id: lime, pct: 1.6 }, { id: premix, pct: 2.5 }],
    },
  ];
  for (const r of RECIPES) {
    const [{ id: rid }] = await db.insert(schema.recipes).values({
      companyId: companyIds[0], name: r.name, ageGroup: r.age, strategy: r.strat,
      costPerTon: r.cost.toFixed(2), proteinPct: r.protein.toFixed(2),
      energyKcal: r.energy, lysinePct: r.lys.toFixed(3), explanation: r.expl,
    }).$returningId();
    for (const it of r.items) {
      await db.insert(schema.recipeItems).values({ recipeId: rid, ingredientId: it.id, percent: it.pct.toFixed(2) });
    }
  }

  console.log(`Gotowe: firmy=${COMPANIES.length}, fermy=${FARMS.length}, rzuty=${batchSeq}`);
  process.exit(0);
}

seed();
