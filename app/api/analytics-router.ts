/* ============================================================
   ANALITYKA — porównania stad, prognozy (masa/sprzedaż/zysk)
   oraz AI ADVISOR — silnik regułowy analizujący produkcję,
   żywienie, zdrowie, klimat, laboratorium i koszty.
   ============================================================ */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { and, eq, desc, inArray, sql, gte } from "drizzle-orm";
import { loadAggregates, kpisFromAgg } from "./farm-router";
import { scopedBatchIds, scopedHouseIds, scopedFarmIds } from "./tenant";

const num = (v: unknown) => Number(v ?? 0);

/* Prosta regresja liniowa dla prognozy masy na podstawie ważeń */
function forecastWeight(points: { dayAge: number; avgWeightG: number }[], targetAge: number) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.dayAge);
  const ys = points.map((p) => p.avgWeightG);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (sxx === 0) return null;
  const a = sxy / sxx;
  const b = my - a * mx;
  const raw = a * targetAge + b;
  // indyk nie rośnie liniowo w nieskończoność — ogranicz logistycznie do ~24 kg
  const cap = 24000;
  return Math.round(cap / (1 + (cap / Math.max(raw, 1) - 1) * Math.exp(-0.15)));
}

export const analyticsRouter = createRouter({
  /* Porównanie wszystkich aktywnych stad — kluczowe KPI jednym zapytaniem agregującym */
  compareBatches: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const agg = await loadAggregates(ids);
    const bs = await db.select().from(s.batches).where(and(eq(s.batches.status, "active"), inArray(s.batches.id, ids)));
    const gls = await db.select().from(s.geneticLines);
    const glMap = new Map(gls.map((g) => [g.id, g.name]));
    // koszty per rzut
    const costRows = await db
      .select({ batchId: s.costs.batchId, total: sql<string>`COALESCE(SUM(${s.costs.amount}),0)` })
      .from(s.costs).where(inArray(s.costs.batchId, ids)).groupBy(s.costs.batchId);
    const costMap = new Map(costRows.map((c) => [c.batchId, num(c.total)]));
    // woda z dzienników (14 dni)
    const waterRows = await db
      .select({ batchId: s.dailyLogs.batchId, total: sql<string>`COALESCE(SUM(${s.dailyLogs.waterLiters}),0)`, feed: sql<string>`COALESCE(SUM(${s.dailyLogs.feedKg}),0)` })
      .from(s.dailyLogs).where(inArray(s.dailyLogs.batchId, ids)).groupBy(s.dailyLogs.batchId);
    const waterMap = new Map(waterRows.map((w) => [w.batchId, { water: num(w.total), feed14: num(w.feed) }]));
    // cena sprzedaży (średnia ostatnich sprzedaży firmy)
    const [priceRow] = await db.select({ avg: sql<string>`COALESCE(AVG(${s.sales.pricePerKg}), 4.9)` }).from(s.sales).where(inArray(s.sales.batchId, ids));
    const pricePerKg = num(priceRow?.avg) || 4.9;

    return bs.map((b) => {
      const k = kpisFromAgg(b, agg);
      const costs = costMap.get(b.id) ?? 0;
      const w = waterMap.get(b.id) ?? { water: 0, feed14: 0 };
      const biomassT = k.biomassKg / 1000;
      const costPerKgLive = k.biomassKg > 0 ? costs / k.biomassKg : 0;
      const ageRemaining = Math.max((b.sex === "toms" ? 140 : 112) - k.ageDays, 0);
      const targetAge = k.ageDays + ageRemaining;
      return {
        id: b.id, code: b.code, geneticLine: glMap.get(b.geneticLineId ?? 0) ?? "—", sex: b.sex,
        ageDays: k.ageDays, currentCount: b.currentCount, avgWeightG: k.avgWeightG,
        fcr: k.fcr, adgG: k.adgG, epef: k.epef, mortalityPct: k.mortalityPct, livability: k.livability,
        biomassT, costsEur: costs, costPerKgLive, water14dL: w.water, feed14dKg: w.feed14,
        feedCostPerKgGain: k.fcr > 0 ? k.fcr * 0.42 : 0,
        forecastFinalWeightG: forecastWeight(
          [...(agg.lastW.get(b.id) ? [{ dayAge: agg.lastW.get(b.id)!.dayAge, avgWeightG: agg.lastW.get(b.id)!.avgWeightG ?? 0 }] : [])],
          targetAge,
        ),
        forecastRevenueEur: (b.currentCount * k.avgWeightG) / 1000 * pricePerKg,
        forecastProfitEur: (b.currentCount * k.avgWeightG) / 1000 * pricePerKg - costs,
        pricePerKg,
      };
    });
  }),

  /* Serie czasowe zużycia wody/paszy/temperatury dla centrum analityki */
  consumptionSeries: publicQuery.input(z.object({ days: z.number().default(30) })).query(async ({ input, ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const since = new Date(Date.now() - input.days * 864e5).toISOString().slice(0, 10);
    return db
      .select({
        day: s.dailyLogs.day,
        water: sql<string>`COALESCE(SUM(${s.dailyLogs.waterLiters}),0)`,
        feed: sql<string>`COALESCE(SUM(${s.dailyLogs.feedKg}),0)`,
        mortality: sql<number>`COALESCE(SUM(${s.dailyLogs.mortality}),0)`,
        temp: sql<string>`COALESCE(AVG(${s.dailyLogs.tempC}),0)`,
      })
      .from(s.dailyLogs).where(and(gte(s.dailyLogs.day, since), inArray(s.dailyLogs.batchId, ids))).groupBy(s.dailyLogs.day).orderBy(s.dailyLogs.day);
  }),

  /* Energia — koszty wg rodzaju, ostatnie 90 dni */
  energySummary: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const fids = await scopedFarmIds(ctx);
    if (fids.length === 0) return [];
    return db
      .select({ kind: s.energyLogs.kind, consumption: sql<string>`COALESCE(SUM(${s.energyLogs.consumption}),0)`, cost: sql<string>`COALESCE(SUM(${s.energyLogs.costEur}),0)` })
      .from(s.energyLogs).where(inArray(s.energyLogs.farmId, fids)).groupBy(s.energyLogs.kind);
  }),
});

/* ============================================================
   AI ADVISOR — regułowy silnik ekspercki na realnych danych
   ============================================================ */
type Advice = {
  area: "nutrition" | "veterinary" | "production" | "climate" | "economics";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  recommendation: string;
  batchCode?: string;
};

export const aiRouter = createRouter({
  advise: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const hids = await scopedHouseIds(ctx);
    const fids = await scopedFarmIds(ctx);
    const agg = await loadAggregates(ids);
    const bs = await db.select().from(s.batches).where(and(eq(s.batches.status, "active"), inArray(s.batches.id, ids)));
    const out: Advice[] = [];

    // dane pomocnicze
    const [labBad] = await db.select({ cnt: sql<number>`count(*)` }).from(s.labResults)
      .where(and(eq(s.labResults.verdict, "critical"), inArray(s.labResults.farmId, fids)));
    const recentTreat = await db.select().from(s.treatments).where(inArray(s.treatments.batchId, ids)).orderBy(desc(s.treatments.id)).limit(20);
    const climate = hids.length
      ? await db.select().from(s.climateLogs).where(inArray(s.climateLogs.houseId, hids)).orderBy(desc(s.climateLogs.id)).limit(200)
      : [];
    const since14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const daily = await db.select().from(s.dailyLogs).where(and(gte(s.dailyLogs.day, since14), inArray(s.dailyLogs.batchId, ids)));
    const dailyByBatch = new Map<number, s.DailyLog[]>();
    for (const d of daily) {
      const arr = dailyByBatch.get(d.batchId) ?? [];
      arr.push(d);
      dailyByBatch.set(d.batchId, arr);
    }

    for (const b of bs) {
      const k = kpisFromAgg(b, agg);
      // --- żywienie: FCR ---
      if (k.fcr > 3.2) out.push({ area: "nutrition", severity: "critical", batchCode: b.code, title: `FCR ${k.fcr.toFixed(2)} — poważnie powyżej celu`, detail: `Stado ${b.code} (wiek ${k.ageDays} dni) zużywa ${k.fcr.toFixed(2)} kg paszy na kg przyrostu przy normie 2.4–2.9 dla tego wieku.`, recommendation: "Zweryfikuj jakość paszy (energia metaboliczna), sprawdź temperaturę w budynku (zbyt niska podnosi FCR) i rozważ zmianę receptury na wariant o wyższej gęstości energetycznej z dodatkiem enzymów." });
      else if (k.fcr > 2.9) out.push({ area: "nutrition", severity: "warning", batchCode: b.code, title: `FCR ${k.fcr.toFixed(2)} — powyżej normy`, detail: `Konwersja paszy w stadzie ${b.code} przekracza cel o ${((k.fcr - 2.7) * 100 / 2.7).toFixed(0)}%.`, recommendation: "Sprawdź wysypki i marnotrawstwo przy karmnikach, skoryguj normę żywieniową o 3–5% i rozważ dodatek probiotyku poprawiającego strawność." });

      // --- wzrost: ADG ---
      const adgNorm = b.sex === "toms" ? 145 : 105;
      if (k.ageDays > 30 && k.adgG < adgNorm * 0.75) out.push({ area: "production", severity: "warning", batchCode: b.code, title: `ADG ${k.adgG.toFixed(0)} g/d — poniżej potencjału genetycznego`, detail: `Dzienny przyrost w stadzie ${b.code} to ${k.adgG.toFixed(0)} g przy oczekiwanym ≥${adgNorm} g dla linii i płci.`, recommendation: "Zweryfikuj front karmienia (dostępność karmników), jakość wody i program świetlny; rozważ ważenie kontrolne w ciągu 48 h." });

      // --- śmiertelność ---
      if (k.mortalityPct > 6) out.push({ area: "veterinary", severity: "critical", batchCode: b.code, title: `Śmiertelność ${k.mortalityPct.toFixed(1)}% — próg interwencji`, detail: `Stado ${b.code} przekroczyło 6% strat. Wymagana diagnostyka przyczynowa.`, recommendation: "Zleć sekcję kontrolną i badania laboratoryjne (posiewy, serologia ND/AI), wdróż kurację wspomagającą z elektrolitami i rozważ korektę programu szczepień." });
      else if (k.mortalityPct > 3.5) out.push({ area: "veterinary", severity: "warning", batchCode: b.code, title: `Śmiertelność ${k.mortalityPct.toFixed(1)}% — podwyższona`, detail: `Straty w stadzie ${b.code} powyżej celu 3.5%.`, recommendation: "Wzmów monitoring dzienny, skontroluj ściółkę i mikroklimat, rozważ profilaktykę witaminową (A, D3, E)." });

      // --- woda ---
      const logs = dailyByBatch.get(b.id) ?? [];
      if (logs.length >= 3 && k.avgWeightG > 0) {
        const norm = k.avgWeightG * 0.18;
        const avgWater = logs.reduce((a, l) => a + num(l.waterLiters), 0) / logs.length / Math.max(b.currentCount, 1) * 1000;
        const dev = ((avgWater - norm) / norm) * 100;
        if (dev > 30) out.push({ area: "production", severity: "warning", batchCode: b.code, title: `Zużycie wody +${dev.toFixed(0)}% powyżej normy`, detail: `Średnie dzienne spożycie wody na sztukę to ${avgWater.toFixed(0)} ml przy normie ~${norm.toFixed(0)} ml dla masy ${(k.avgWeightG / 1000).toFixed(1)} kg.`, recommendation: "Sprawdź wycieki na liniach pojenia, poziom sodu w paszy i temperaturę w budynku — podwyższone pobranie wody często poprzedza problemy zdrowotne." });
        else if (dev < -25) out.push({ area: "production", severity: "warning", batchCode: b.code, title: `Zużycie wody ${dev.toFixed(0)}% poniżej normy`, detail: `Spadek pobrania wody w stadzie ${b.code} o ${Math.abs(dev).toFixed(0)}%.`, recommendation: "Spadek pobrania wody to wczesny sygnał choroby — skontroluj stado, ciśnienie na liniach i smakowitość wody." });
      }
    }

    // --- klimat (globalnie z ostatnich odczytów IoT) ---
    const hiAmmonia = climate.filter((c) => num(c.ammoniaPpm) > 20).length;
    const hiTemp = climate.filter((c) => num(c.tempC) > 28).length;
    if (hiAmmonia > 5) out.push({ area: "climate", severity: "critical", title: `Amoniak >20 ppm w ${hiAmmonia} odczytach IoT`, detail: "Przekroczenia stężenia amoniaku wykryte w ostatnich odczytach czujników.", recommendation: "Zwiększ wentylację minimalną, wymień ściółkę w newralgicznych strefach i sprawdź szczelność pojenia — NH₃ >20 ppm uszkadza nabłonek oddechowy i obniża ADG." });
    if (hiTemp > 5) out.push({ area: "climate", severity: "warning", title: `Temperatura >28°C w ${hiTemp} odczytach`, detail: "Wykryto epizody przegrzania.", recommendation: "Uruchom chłodzenie adiabatyczne/tunnel ventilation i obniż gęstość obsady w najgorętszych strefach; rozważ witaminę C w wodzie." });

    // --- laboratorium ---
    if (num(labBad?.cnt) > 0) out.push({ area: "veterinary", severity: "critical", title: `${labBad!.cnt} krytycznych wyników laboratoryjnych`, detail: "Najnowsze badania wykazały wyniki poza zakresami referencyjnymi (status critical).", recommendation: "Natychmiastowa konsultacja weterynaryjna, izolacja dotkniętych budynków i wdrożenie programu leczenia zgodnie z antybiogramem." });
    if (recentTreat.length > 0) out.push({ area: "veterinary", severity: "info", title: `${recentTreat.length} terapii w ostatnim okresie`, detail: "System rejestruje aktywne programy leczenia.", recommendation: "Zweryfikuj okresy karencji przed planowanymi sprzedażami i dokumentuj skuteczność terapii w dzienniku." });

    // --- ekonomia ---
    const comp = await db.select({ total: sql<string>`COALESCE(SUM(${s.costs.amount}),0)` }).from(s.costs).where(inArray(s.costs.batchId, ids));
    const rev = await db.select({ total: sql<string>`COALESCE(SUM(${s.sales.totalWeightKg} * ${s.sales.pricePerKg}),0)` }).from(s.sales).where(inArray(s.sales.batchId, ids));
    if (num(rev[0]?.total) > 0) {
      const margin = ((num(rev[0].total) - num(comp[0]?.total)) / num(rev[0].total)) * 100;
      out.push({ area: "economics", severity: margin < 8 ? "warning" : "info", title: `Marża produkcji: ${margin.toFixed(1)}%`, detail: `Przychody ${num(rev[0].total).toLocaleString("pl-PL")} EUR, koszty ${num(comp[0]?.total).toLocaleString("pl-PL")} EUR.`, recommendation: margin < 8 ? "Marża poniżej 8% — renegocjuj ceny paszy (największy składnik kosztu), optymalizuj wiek uboju pod kątem krzywej FCR i rozważ kontraktację sprzedaży." : "Marża w zdrowym zakresie. Utrzymaj dyscyplinę FCR i monitoruj cenę paszy — to 65–70% kosztu kg żywca." });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
  }),
});
