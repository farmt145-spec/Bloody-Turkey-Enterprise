/* ============================================================
   AI COMMAND CENTER — Centrum Decyzji, Digital Twin,
   AI Weterynarz, Global Intelligence, Executive Center.
   Wszystko liczone na realnych danych produkcyjnych.
   ============================================================ */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { loadAggregates, kpisFromAgg } from "./farm-router";
import { scopedBatchIds, scopedHouseIds, scopedFarmIds, requireCompanyId } from "./tenant";

const num = (v: unknown) => Number(v ?? 0);

export const commandRouter = createRouter({
  /* 🧠 Codzienny raport priorytetów dla kierownika fermy */
  dailyReport: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    const hids = await scopedHouseIds(ctx);
    const fids = await scopedFarmIds(ctx);
    if (ids.length === 0) return { priorities: [], healthy: [], ts: Date.now() };
    const agg = await loadAggregates(ids);
    const bs = await db.select().from(s.batches).where(and(eq(s.batches.status, "active"), inArray(s.batches.id, ids)));
    const houses = hids.length ? await db.select().from(s.houses).where(inArray(s.houses.id, hids)) : [];
    const farms = fids.length ? await db.select().from(s.farms).where(inArray(s.farms.id, fids)) : [];
    const houseMap = new Map(houses.map((h) => [h.id, h]));
    const farmMap = new Map(farms.map((f) => [f.id, f.name]));

    const priorities: { severity: "critical" | "warning" | "info"; title: string; why: string; action: string; batchCode?: string }[] = [];

    const since3 = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const recentLogs = await db.select().from(s.dailyLogs)
      .where(and(gte(s.dailyLogs.day, since3), inArray(s.dailyLogs.batchId, ids)));
    const logsByBatch = new Map<number, s.DailyLog[]>();
    for (const l of recentLogs) {
      const a = logsByBatch.get(l.batchId) ?? []; a.push(l); logsByBatch.set(l.batchId, a);
    }

    for (const b of bs) {
      const k = kpisFromAgg(b, agg);
      const logs = logsByBatch.get(b.id) ?? [];
      const lastLog = logs.sort((x, y) => y.day.localeCompare(x.day))[0];
      const farm = houseMap.get(b.houseId) ? farmMap.get(houseMap.get(b.houseId)!.farmId) : undefined;

      if (k.mortalityPct > 5) priorities.push({
        severity: "critical", batchCode: b.code,
        title: `Stado ${b.code} — śmiertelność ${k.mortalityPct.toFixed(1)}%`,
        why: `Straty przekroczyły próg 5% przy ${b.currentCount} szt. w chowie${farm ? ` (ferma ${farm})` : ""}. Ostatnie 3 dni: ${logs.reduce((a, l) => a + l.mortality + l.culls, 0)} szt. upadło/selekcja.`,
        action: "Zleć sekcję kontrolną dziś rano, pobierz wymazy do laboratorium, zwiększ częstotliwość obchodów do 3× dziennie.",
      });
      if (k.fcr > 3.0) priorities.push({
        severity: "warning", batchCode: b.code,
        title: `Stado ${b.code} — FCR ${k.fcr.toFixed(2)}`,
        why: `Konwersja paszy znacznie powyżej celu 2.7 dla wieku ${k.ageDays} dni. Każde 0.1 FCR to ~${Math.round(k.biomassKg * 0.1 * 0.9)} PLN dodatkowego kosztu paszy na rzut.`,
        action: "Sprawdź wysypki przy karmnikach, zweryfikuj jakość ostatniej dostawy paszy, rozważ korektę receptury w AI Nutrition Lab.",
      });
      if (lastLog && num(lastLog.waterLiters) > 0 && k.avgWeightG > 0) {
        const norm = (k.avgWeightG * 0.18 * b.currentCount) / 1000;
        const dev = ((num(lastLog.waterLiters) - norm) / norm) * 100;
        if (dev > 35) priorities.push({
          severity: "warning", batchCode: b.code,
          title: `Stado ${b.code} — pobór wody +${dev.toFixed(0)}%`,
          why: `Wczorajsze zużycie ${num(lastLog.waterLiters).toFixed(0)} l vs norma ${norm.toFixed(0)} l. Podwyższone pobranie wody często poprzedza problemy zdrowotne lub wskazuje na przegrzanie.`,
          action: "Sprawdź temperaturę w budynku, szczelność nippelków i poziom sodu w paszy.",
        });
      }
      // brak wpisów dziennika = zanik nadzoru
      if (logs.length === 0) priorities.push({
        severity: "info", batchCode: b.code,
        title: `Stado ${b.code} — brak wpisów dziennika od 3 dni`,
        why: "Brak rejestracji upadków, wody i paszy utrudnia wykrycie problemów we wczesnej fazie.",
        action: "Przypomnij obsadzie o codziennych wpisach — to 2 minuty w aplikacji.",
      });
    }

    // zadania i awarie
    const openTickets = fids.length
      ? await db.select().from(s.maintenanceTickets)
          .where(and(eq(s.maintenanceTickets.ticketStatus, "open"), inArray(s.maintenanceTickets.farmId, fids)))
      : [];
    const critTickets = openTickets.filter((t) => t.priority === "critical" || t.priority === "high");
    if (critTickets.length) priorities.push({
      severity: "warning",
      title: `${critTickets.length} pilnych zgłoszeń utrzymania ruchu`,
      why: `Otwarte awarie o wysokim priorytecie: ${critTickets.map((t) => t.title).slice(0, 3).join("; ")}.`,
      action: "Przydziel serwis na dziś — awaria wentylacji lub pojenia w sezonie letnim to ryzyko strat w ciągu godzin.",
    });

    // leki poniżej stanu minimalnego
    const meds = await db.select().from(s.medicines).where(eq(s.medicines.companyId, requireCompanyId(ctx)));
    const lowMeds = meds.filter((m) => num(m.stockQty) <= num(m.minStock));
    if (lowMeds.length) priorities.push({
      severity: "info",
      title: `Niskie stany leków: ${lowMeds.map((m) => m.name).slice(0, 3).join(", ")}`,
      why: "Brak leku w kryzysie zdrowotnym kosztuje dni opóźnienia terapii.",
      action: "Złóż zamówienie w module Zamówienia zakupu — dostawa standardowo 2–3 dni.",
    });

    const order = { critical: 0, warning: 1, info: 2 };
    priorities.sort((a, b) => order[a.severity] - order[b.severity]);

    // podsumowanie dla dyrektora (Executive Center)
    const [costRow] = await db.select({ t: sql<string>`COALESCE(SUM(${s.costs.amount}),0)` }).from(s.costs).where(inArray(s.costs.batchId, ids));
    const [revRow] = await db.select({ t: sql<string>`COALESCE(SUM(${s.sales.totalWeightKg} * ${s.sales.pricePerKg}),0)` }).from(s.sales).where(inArray(s.sales.batchId, ids));
    const totalBirds = bs.reduce((a, b) => a + b.currentCount, 0);
    const totalBiomass = bs.reduce((a, b) => a + kpisFromAgg(b, agg).biomassKg, 0);
    const worst = bs.map((b) => ({ b, k: kpisFromAgg(b, agg) })).sort((x, y) => y.k.fcr - x.k.fcr).slice(0, 3);
    const best = bs.map((b) => ({ b, k: kpisFromAgg(b, agg) })).sort((x, y) => y.k.epef - x.k.epef).slice(0, 3);

    return {
      priorities,
      executive: {
        revenueEur: num(revRow?.t), costsEur: num(costRow?.t),
        profitEur: num(revRow?.t) - num(costRow?.t),
        totalBirds, biomassT: totalBiomass / 1000, activeBatches: bs.length,
        criticalCount: priorities.filter((p) => p.severity === "critical").length,
        bestHalls: best.map((x) => ({ code: x.b.code, epef: x.k.epef })),
        worstHalls: worst.map((x) => ({ code: x.b.code, fcr: x.k.fcr })),
      },
    };
  }),

  /* 🏭 Digital Twin — symulator wpływu warunków środowiskowych */
  digitalTwin: publicQuery
    .input(z.object({
      batchId: z.number(),
      tempDeltaC: z.number().min(-8).max(8).default(0),
      ventilationDeltaPct: z.number().min(-50).max(50).default(0),
      densityDeltaPct: z.number().min(-30).max(30).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const agg = await loadAggregates([input.batchId]);
      const [b] = await db.select().from(s.batches).where(eq(s.batches.id, input.batchId));
      await import("./tenant").then((t) => t.assertBatchAccess(ctx, input.batchId));
      if (!b) return null;
      const k = kpisFromAgg(b, agg);
      // model wpływu środowiska (kalibracja dla indyków)
      const tempEffect = -Math.abs(input.tempDeltaC) * 0.012 + (input.tempDeltaC < 0 && k.ageDays > 35 ? input.tempDeltaC * 0.004 : 0);
      const ventEffect = input.ventilationDeltaPct > 0 ? -0.0008 * input.ventilationDeltaPct : 0.0012 * Math.abs(input.ventilationDeltaPct);
      const densityEffect = input.densityDeltaPct * 0.004;
      const fcr = Math.max(k.fcr * (1 + tempEffect + ventEffect + densityEffect), 1.5);
      const adgG = Math.max(k.adgG * (1 - Math.abs(input.tempDeltaC) * 0.015 - Math.abs(input.densityDeltaPct) * 0.006), 20);
      const litterWetRisk = Math.min(Math.max(30 - input.ventilationDeltaPct * 0.5 + Math.max(input.tempDeltaC, 0) * 4 + input.densityDeltaPct * 0.8, 0), 100);
      const mortalityDeltaPct = Math.max(Math.abs(input.tempDeltaC) * 0.3 + litterWetRisk * 0.02 + Math.max(input.densityDeltaPct, 0) * 0.05 - Math.max(input.ventilationDeltaPct, 0) * 0.01, -1);
      const costDeltaPerBird = (fcr - k.fcr) * (k.avgWeightG / 1000) * 1.9; // PLN przy cenie paszy 1900 PLN/t
      return {
        base: { fcr: k.fcr, adgG: k.adgG, mortalityPct: k.mortalityPct, avgWeightG: k.avgWeightG, ageDays: k.ageDays, count: b.currentCount },
        predicted: {
          fcr, adgG,
          finalWeightDeltaG: (adgG - k.adgG) * Math.max((b.sex === "toms" ? 140 : 112) - k.ageDays, 0),
          litterWetRiskPct: litterWetRisk,
          mortalityDeltaPct,
          costDeltaEurTotal: costDeltaPerBird * b.currentCount,
        },
        summary: `Zmiana temperatury o ${input.tempDeltaC > 0 ? "+" : ""}${input.tempDeltaC}°C, wentylacji o ${input.ventilationDeltaPct > 0 ? "+" : ""}${input.ventilationDeltaPct}% i gęstości o ${input.densityDeltaPct > 0 ? "+" : ""}${input.densityDeltaPct}%: przewidywany FCR ${fcr.toFixed(2)} (${fcr > k.fcr ? "gorzej" : "lepiej"} o ${Math.abs(fcr - k.fcr).toFixed(2)}), ADG ${adgG.toFixed(0)} g/d, ryzyko mokrej ściółki ${litterWetRisk.toFixed(0)}%, zmiana kosztu ${(costDeltaPerBird * b.currentCount).toFixed(0)} PLN na rzut.`,
      };
    }),

  /* 🤖 AI Weterynarz — diagnoza z objawów */
  vetDiagnose: publicQuery
    .input(z.object({ symptoms: z.string().min(3) }))
    .query(async ({ input }) => {
      const t = input.symptoms.toLowerCase();
      const dx: { name: string; probability: number; tests: string[]; actions: string[] }[] = [];
      const has = (...ws: string[]) => ws.some((w) => t.includes(w));

      if (has("siedzą", "osowiałe", "apatia", "spadło pobranie", "spadek pobrania", "nie jedzą")) {
        dx.push({
          name: "Infekcja bakteryjna dróg oddechowych (ORT / E. coli)",
          probability: has("31", "gorąco", "przegrzanie") ? 55 : 70,
          tests: ["Wymaz z krtani na PCR ORT", "Posiew na E. coli z antybiogramem", "Sekcja 3–5 padłych sztuk"],
          actions: ["Terapia wg antybiogramu (doksycyklina w wodzie jako pierwszy wybór)", "Elektrolity + witamina C w wodzie", "Kontrola amoniaku i wentylacji"],
        });
      }
      if (has("31", "30", "gorąco", "przegrzanie", "dyszą", "otwarte dzioby")) {
        dx.push({
          name: "Stres cieplny",
          probability: has("31") ? 85 : 60,
          tests: ["Pomiar temperatury w strefie ptaka (nie na suficie)", "Kontrola wilgotności — powyżej 75% przy 30°C to strefa krytyczna"],
          actions: ["Tunnel ventilation + chłodzenie adiabatyczne natychmiast", "Witamina C 1 g/l wody w godzinach szczytu", "Ogranicz karmienie w najgorętszych godzinach", "Obniż gęstość obsady w najcieplejszych strefach"],
        });
      }
      if (has("wodniste", "biegunka", "mokra ściółka", "luźne")) {
        dx.push({
          name: "Zaburzenia jelitowe (dysbakterioza / kokcydioza)",
          probability: 65,
          tests: ["Badanie kału na oocysty kokcydii", "Ocena jakości tłuszczu w paszy (zjełczenie)", "Analiza włókna i sodu w recepcie"],
          actions: ["Probiotyk lub kwas organiczny w wodzie", "Wymiana mokrej ściółki w strefach pojenia", "Sprawdź czy receptura nie przekracza 6% włókna"],
        });
      }
      if (has("kulawe", "kulawy", "nogi", "opuszki", "poduszki")) {
        dx.push({
          name: "Zapalenie opuszek stóp (FPD) / problemy szkieletowe",
          probability: 75,
          tests: ["Ocena wilgotności ściółki (>35% = ryzyko)", "Badanie poduszek — skala 0–2", "Analiza Ca:P i witaminy D3 w paszy"],
          actions: ["Popraw jakość ściółki i wentylację", "Biotyna + cynk w premiksie", "Zwiększ przestrzeń przy pojeniu, by ograniczyć chodzenie po mokrej ściółce"],
        });
      }
      if (has("upadki", "padają", "śmiertelność", "umierają")) {
        dx.push({
          name: "Wzmożona śmiertelność — wymagana diagnostyka różnicowa",
          probability: 90,
          tests: ["Sekcja kontrolna min. 5 sztuk", "Posiewy wątroby i serca", "Serologia ND/AI", "Mikotoksyny w paszy"],
          actions: ["Izoluj budynek (środki bioasekuracji)", "Raport do weterynarza nadzorującego dziś", "Dokumentuj przebieg w dzienniku co 12 h"],
        });
      }
      if (!dx.length) {
        dx.push({
          name: "Obraz niespecyficzny — monitoring wzmożony",
          probability: 40,
          tests: ["Ważenie kontrolne stada", "Analiza pobrania wody/paszy z ostatnich 3 dni w dzienniku produkcji"],
          actions: ["Obchód z checklistą kliniczną 2× dziennie", "Skonsultuj z lekarzem nadzorującym przy pogorszeniu"],
        });
      }
      return { symptoms: input.symptoms, diagnoses: dx.sort((a, b) => b.probability - a.probability) };
    }),

  /* 🌍 Global Intelligence — sygnały rynkowe (na danych surowców z bazy) */
  globalSignals: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const cid = requireCompanyId(ctx);
    const ings = await db.select().from(s.feedIngredients);
    const orders = await db.select().from(s.purchaseOrders)
      .where(eq(s.purchaseOrders.companyId, cid)).orderBy(desc(s.purchaseOrders.id)).limit(20);
    // benchmark cen: porównanie z medianą rynkową (zahardkodowane referencje UE 2026)
    const benchmark: Record<string, number> = {
      Pszenica: 950, Kukurydza: 890, "Śruta sojowa 48%": 1750, "Śruta rzepakowa": 1250,
      "Olej sojowy": 3900, "Tłuszcz drobiowy": 3300, Jęczmień: 830, "Groszek żółty": 1200,
    };
    const signals = ings.map((i) => {
      const ref = benchmark[i.name];
      if (!ref) return null;
      const pricePln = num(i.pricePerTon) * 4.28; // EUR→PLN
      const dev = ((pricePln - ref) / ref) * 100;
      if (dev > 12) return { ingredient: i.name, signal: "avoid" as const, detail: `${i.name}: cena ${pricePln.toFixed(0)} PLN/t o ${dev.toFixed(0)}% powyżej benchmarku UE (${ref} PLN/t). Nie kupuj obecnie — rozważ zamiennik lub odłóż zakup.`, deviationPct: dev };
      if (dev < -8) return { ingredient: i.name, signal: "buy" as const, detail: `${i.name}: cena ${pricePln.toFixed(0)} PLN/t o ${Math.abs(dev).toFixed(0)}% poniżej benchmarku UE (${ref} PLN/t). Warto skontraktować dostawę na 4–6 tygodni.`, deviationPct: dev };
      return { ingredient: i.name, signal: "neutral" as const, detail: `${i.name}: cena w zgodzie z rynkiem (${pricePln.toFixed(0)} PLN/t, odchylenie ${dev.toFixed(0)}%).`, deviationPct: dev };
    }).filter(Boolean);
    const pending = orders.filter((o) => o.orderStatus === "sent" || o.orderStatus === "confirmed").length;
    return {
      signals,
      pendingOrders: pending,
      note: "Sygnały generowane na podstawie cen surowców w systemie vs benchmarki rynku UE. Podłączenie live feedów (ceny MATIF, kursy NBP, pogoda) — kolejny krok rozwoju.",
    };
  }),

  /* 🧬 Nutrition Genome — które receptury realnie dawały najlepszy FCR */
  nutritionGenome: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const deliveries = await db.select().from(s.feedDeliveries).where(inArray(s.feedDeliveries.batchId, ids));
    const recipes = await db.select().from(s.recipes);
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const agg = await loadAggregates(ids);
    const bs = await db.select().from(s.batches).where(inArray(s.batches.id, ids));
    const batchMap = new Map(bs.map((b) => [b.id, b]));
    // grupuj dostawy wg receptury i licz FCR stad, które ją jadły
    const byRecipe = new Map<number, number[]>();
    for (const d of deliveries) {
      if (!d.recipeId || !batchMap.has(d.batchId)) continue;
      const k = kpisFromAgg(batchMap.get(d.batchId)!, agg);
      const arr = byRecipe.get(d.recipeId) ?? [];
      arr.push(k.fcr);
      byRecipe.set(d.recipeId, arr);
    }
    return [...byRecipe.entries()].map(([recipeId, fcrs]) => {
      const r = recipeMap.get(recipeId);
      return {
        recipeId, name: r?.name ?? `Receptura #${recipeId}`,
        batchesServed: fcrs.length,
        avgRealFcr: fcrs.reduce((a, b) => a + b, 0) / fcrs.length,
        bestFcr: Math.min(...fcrs),
        costPerTon: r ? num(r.costPerTon) : 0,
        learned: fcrs.length >= 3,
      };
    }).sort((a, b) => a.avgRealFcr - b.avgRealFcr);
  }),

  /* 📡 IoT Live — ostatnie odczyty czujników per budynek */
  iotLive: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const hids = await scopedHouseIds(ctx);
    const fids = await scopedFarmIds(ctx);
    if (hids.length === 0) return [];
    const houses = await db.select().from(s.houses).where(inArray(s.houses.id, hids));
    const farms = fids.length ? await db.select().from(s.farms).where(inArray(s.farms.id, fids)) : [];
    const farmMap = new Map(farms.map((f) => [f.id, f.name]));
    const silos = fids.length ? await db.select().from(s.silos).where(inArray(s.silos.farmId, fids)) : [];
    const result = [];
    for (const h of houses.slice(0, 24)) {
      const [c] = await db.select().from(s.climateLogs).where(eq(s.climateLogs.houseId, h.id)).orderBy(desc(s.climateLogs.id)).limit(1);
      const silo = silos.find((x) => x.farmId === h.farmId);
      const ts = c?.ts ? new Date(c.ts) : null;
      const minutesSince = ts ? Math.max(0, Math.round((Date.now() - ts.getTime()) / 60000)) : null;
      const linkStatus = minutesSince == null ? "offline" : minutesSince <= 15 ? "online" : minutesSince <= 120 ? "stale" : "offline";
      result.push({
        houseId: h.id, name: h.name, farm: farmMap.get(h.farmId) ?? "—",
        tempC: c ? num(c.tempC) : null, humidityPct: c ? num(c.humidityPct) : null,
        ammoniaPpm: c ? num(c.ammoniaPpm) : null, co2Ppm: c?.co2Ppm ?? null,
        ventilationPct: c?.ventilationPct ?? null,
        ts: c?.ts ?? null, minutesSince, linkStatus, source: c?.source ?? null,
        siloPct: silo && num(silo.capacityTons) > 0 ? (num(silo.currentTons) / num(silo.capacityTons)) * 100 : null,
      });
    }
    return result;
  }),
});
