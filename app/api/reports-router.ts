/**
 * RAPORTY + REGUŁY ALERTÓW
 * - weekly: zestawienie produkcyjne za wybrany zakres (domyślnie ostatnie 7 dni)
 *   per stado: FCR, upadki, pasza, masa, przeżywalność + podsumowanie fermy
 *   + alarmy IoT (amoniak, temperatura) i zdarzenia ścielenia
 * - generateAlerts: skan reguł (amoniak, brak danych IoT, pusty silos, skok upadków)
 *   i dopisuje powiadomienia (bez duplikatów z ostatnich 24 h)
 */
import { z } from "zod";
import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { scopedBatchIds, scopedHouseIds, scopedFarmIds, requireCompanyId } from "./tenant";

const num = (v: unknown) => Number(v ?? 0);
const dayRange = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const reportsRouter = createRouter({
  /** Raport produkcyjny za zakres dat (do podglądu i wydruku/PDF). */
  weekly: publicQuery.input(dayRange).query(async ({ input, ctx }) => {
    const db = getDb();
    const batchIds = await scopedBatchIds(ctx);
    const houseIds = await scopedHouseIds(ctx);
    const farmIds = await scopedFarmIds(ctx);
    if (batchIds.length === 0) return { from: input.from, to: input.to, farms: [], rows: [], totals: null, alerts: [], litter: [] };

    const [batches, houses, farms, mort, feed, logs, weigh, lit, climate] = await Promise.all([
      db.select().from(s.batches).where(and(inArray(s.batches.id, batchIds), ne(s.batches.status, "archived"))),
      db.select().from(s.houses).where(inArray(s.houses.id, houseIds)),
      farmIds.length ? db.select().from(s.farms).where(inArray(s.farms.id, farmIds)) : [],
      db.select({ batchId: s.mortalities.batchId, total: sql<number>`COALESCE(SUM(${s.mortalities.count}),0)` })
        .from(s.mortalities).where(and(inArray(s.mortalities.batchId, batchIds), gte(s.mortalities.day, input.from), lte(s.mortalities.day, input.to)))
        .groupBy(s.mortalities.batchId),
      db.select({ batchId: s.feedUsages.batchId, total: sql<string>`COALESCE(SUM(${s.feedUsages.kg}),0)` })
        .from(s.feedUsages).where(and(inArray(s.feedUsages.batchId, batchIds), gte(s.feedUsages.day, input.from), lte(s.feedUsages.day, input.to)))
        .groupBy(s.feedUsages.batchId),
      db.select().from(s.dailyLogs).where(and(inArray(s.dailyLogs.batchId, batchIds), gte(s.dailyLogs.day, input.from), lte(s.dailyLogs.day, input.to))),
      db.select().from(s.weighings).where(inArray(s.weighings.batchId, batchIds)),
      db.select().from(s.litter).where(and(inArray(s.litter.houseId, houseIds), gte(s.litter.laidAt, input.from), lte(s.litter.laidAt, input.to))),
      db.select().from(s.climateLogs).where(and(inArray(s.climateLogs.houseId, houseIds), gte(s.climateLogs.ts, new Date(`${input.from}T00:00:00`)), lte(s.climateLogs.ts, new Date(`${input.to}T23:59:59`))))
        .orderBy(desc(s.climateLogs.ts)).limit(5000),
    ]);

    const houseMap = new Map(houses.map((h) => [h.id, h]));
    const mortMap = new Map(mort.map((m) => [m.batchId, num(m.total)]));
    const feedMap = new Map(feed.map((f) => [f.batchId, num(f.total)]));
    const lastW = new Map<number, { avgWeightG: number; dayAge: number }>();
    for (const w of weigh) {
      const cur = lastW.get(w.batchId);
      if (!cur || w.dayAge > cur.dayAge) lastW.set(w.batchId, { avgWeightG: w.avgWeightG, dayAge: w.dayAge });
    }

    const rows = batches.map((b) => {
      const dead = mortMap.get(b.id) ?? 0;
      const feedKg = feedMap.get(b.id) ?? 0;
      const w = lastW.get(b.id);
      const avgG = w?.avgWeightG ?? 0;
      const biomassKg = (b.currentCount * avgG) / 1000;
      const gainKg = Math.max(biomassKg - b.initialCount * 0.05, 1);
      const fcr = feedKg > 0 && avgG > 0 ? feedKg / gainKg : 0;
      const livability = b.initialCount > 0 ? ((b.initialCount - dead) / b.initialCount) * 100 : 100;
      const ageDays = Math.max(0, Math.round((new Date(input.to).getTime() - new Date(b.startDate).getTime()) / 86400000));
      const epef = ageDays >= 60 && fcr > 0 ? ((livability / 100) * (avgG / 1000) * 10000) / (ageDays * fcr) : 0;
      return {
        batchId: b.id, code: b.code, house: houseMap.get(b.houseId)?.name ?? "?",
        geneticLine: b.geneticLine, sex: b.sex, status: b.status,
        ageDays, currentCount: b.currentCount, deadInPeriod: dead,
        mortalityPct: b.initialCount > 0 ? (dead / b.initialCount) * 100 : 0,
        feedKg, avgWeightG: avgG, fcr, livability, epef,
      };
    }).sort((a, b) => a.house.localeCompare(b.house) || a.code.localeCompare(b.code));

    const act = rows.filter((r) => r.status === "active");
    const totals = rows.length ? {
      birds: act.reduce((a, r) => a + r.currentCount, 0),
      dead: rows.reduce((a, r) => a + r.deadInPeriod, 0),
      feedKg: rows.reduce((a, r) => a + r.feedKg, 0),
      avgFcr: (() => { const x = rows.filter((r) => r.fcr > 0); return x.length ? x.reduce((a, r) => a + r.fcr, 0) / x.length : 0; })(),
      avgLivability: (() => { const x = rows.filter((r) => r.status === "active"); return x.length ? x.reduce((a, r) => a + r.livability, 0) / x.length : 100; })(),
      avgEpef: (() => { const x = rows.filter((r) => r.epef > 0); return x.length ? x.reduce((a, r) => a + r.epef, 0) / x.length : 0; })(),
      daysWithLogs: new Set(logs.map((l) => l.day)).size,
    } : null;

    /* alarmy IoT w zakresie: amoniak >20 ppm, temperatura poza 16–30°C */
    const alertRows: { house: string; what: string; value: string; ts: string }[] = [];
    for (const c of climate) {
      const hname = houseMap.get(c.houseId)?.name ?? `Kurnik ${c.houseId}`;
      const ts = c.ts ? new Date(c.ts).toISOString().slice(0, 16).replace("T", " ") : "";
      if (num(c.ammoniaPpm) > 20) alertRows.push({ house: hname, what: "Amoniak", value: `${num(c.ammoniaPpm).toFixed(0)} ppm`, ts });
      if (c.tempC != null && (num(c.tempC) < 16 || num(c.tempC) > 30)) alertRows.push({ house: hname, what: "Temperatura", value: `${num(c.tempC).toFixed(1)} °C`, ts });
    }
    // skróć do najnowszych 50
    const alerts = alertRows.slice(0, 50);

    const litter = lit.map((l) => ({
      house: houseMap.get(l.houseId)?.name ?? `Kurnik ${l.houseId}`,
      day: l.laidAt, material: l.material,
      balesCount: l.balesCount ?? null, baleKg: l.baleKg != null ? num(l.baleKg) : null,
      cost: num(l.cost),
    }));

    return {
      from: input.from, to: input.to,
      farms: farms.map((f) => f.name),
      rows, totals, alerts, litter,
    };
  }),

  /** Skan reguł alertowych — dopisuje powiadomienia (max 1 taki sam wpis / 24 h). */
  generateAlerts: publicQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const cid = requireCompanyId(ctx);
    const batchIds = await scopedBatchIds(ctx);
    const houseIds = await scopedHouseIds(ctx);
    const farmIds = await scopedFarmIds(ctx);
    const created: string[] = [];
    if (houseIds.length === 0) return { created };

    const since24 = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await db.select().from(s.notifications)
      .where(and(eq(s.notifications.companyId, cid), gte(s.notifications.createdAt, since24)));
    const seen = new Set(recent.map((n) => `${n.title}|${n.body ?? ""}`));
    const push = async (severity: "info" | "warning" | "critical", title: string, body: string, link?: string) => {
      const k = `${title}|${body}`;
      if (seen.has(k)) return;
      seen.add(k);
      await db.insert(s.notifications).values({ companyId: cid, severity, title, body, link: link ?? null });
      created.push(title);
    };

    const houses = await db.select().from(s.houses).where(inArray(s.houses.id, houseIds));

    /* 1) Amoniak / temperatura — najnowszy odczyt każdego kurnika */
    for (const h of houses) {
      const [c] = await db.select().from(s.climateLogs)
        .where(eq(s.climateLogs.houseId, h.id)).orderBy(desc(s.climateLogs.id)).limit(1);
      if (!c) continue;
      if (num(c.ammoniaPpm) > 25)
        await push("critical", `Wysoki amoniak — ${h.name}`, `${num(c.ammoniaPpm).toFixed(0)} ppm (norma <20). Zwiększ wentylację i sprawdź ściółkę.`, "/centrum-decyzji");
      else if (num(c.ammoniaPpm) > 20)
        await push("warning", `Podwyższony amoniak — ${h.name}`, `${num(c.ammoniaPpm).toFixed(0)} ppm (norma <20).`, "/centrum-decyzji");
      if (c.tempC != null && num(c.tempC) > 30)
        await push("critical", `Przegrzanie — ${h.name}`, `${num(c.tempC).toFixed(1)} °C. Sprawdź wentylację i wodę.`, "/centrum-decyzji");
      else if (c.tempC != null && num(c.tempC) < 16)
        await push("warning", `Za zimno — ${h.name}`, `${num(c.tempC).toFixed(1)} °C. Sprawdź ogrzewanie.`, "/centrum-decyzji");
    }

    /* 2) Brak danych IoT > 6 h przy aktywnym chowie */
    if (batchIds.length) {
      const active = await db.select().from(s.batches).where(and(inArray(s.batches.id, batchIds), eq(s.batches.status, "active")));
      const housesWithBatch = new Set(active.map((b) => b.houseId));
      for (const h of houses) {
        if (!housesWithBatch.has(h.id)) continue;
        const [c] = await db.select().from(s.climateLogs)
          .where(eq(s.climateLogs.houseId, h.id)).orderBy(desc(s.climateLogs.id)).limit(1);
        const ageMin = c?.ts ? (Date.now() - new Date(c.ts).getTime()) / 60000 : Infinity;
        if (ageMin > 360)
          await push("warning", `Brak danych z komputera — ${h.name}`,
            c ? `Ostatni odczyt ${Math.round(ageMin / 60)} h temu. Sprawdź połączenie kontrolera (Integracje → test /api/v1/ping).` : "Kontroler nigdy nie wysłał danych. Sprawdź konfigurację klucza API.",
            "/integracje");
      }
    }

    /* 3) Silosy poniżej 20% */
    if (farmIds.length) {
      const silos = await db.select().from(s.silos).where(inArray(s.silos.farmId, farmIds));
      for (const sl of silos) {
        const cap = num(sl.capacityTons);
        if (cap <= 0) continue;
        const pct = (num(sl.currentTons) / cap) * 100;
        if (pct < 20)
          await push(pct < 10 ? "critical" : "warning", `Niski stan silosu — ${sl.name}`,
            `Zostało ${pct.toFixed(0)}% (${num(sl.currentTons).toFixed(1)} t z ${cap} t). Zaplanuj dostawę paszy.`, "/zywienie");
      }
    }

    /* 4) Skok upadków — wczorajsze padnięcia > 2× średnia z 7 dni */
    if (batchIds.length) {
      const today = new Date().toISOString().slice(0, 10);
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const w7 = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
      const rows = await db.select({ batchId: s.mortalities.batchId, day: s.mortalities.day, total: sql<number>`SUM(${s.mortalities.count})` })
        .from(s.mortalities).where(and(inArray(s.mortalities.batchId, batchIds), gte(s.mortalities.day, w7)))
        .groupBy(s.mortalities.batchId, s.mortalities.day);
      const byBatch = new Map<number, { yday: number; other: number[] }>();
      for (const r of rows) {
        const e = byBatch.get(r.batchId) ?? { yday: 0, other: [] };
        if (r.day === y) e.yday = num(r.total); else if (r.day !== today) e.other.push(num(r.total));
        byBatch.set(r.batchId, e);
      }
      const batches = await db.select().from(s.batches).where(inArray(s.batches.id, batchIds));
      for (const [bid, v] of byBatch) {
        const avg = v.other.length ? v.other.reduce((a, b) => a + b, 0) / v.other.length : 0;
        if (v.yday >= 5 && v.yday > Math.max(avg * 2, 4)) {
          const b = batches.find((x) => x.id === bid);
          await push("critical", `Skok upadków — ${b?.code ?? `rzut ${bid}`}`,
            `Wczoraj padło ${v.yday} szt. przy średniej ${avg.toFixed(1)} szt./dzień. Sprawdź stado i skonsultuj z weterynarzem.`, "/zdrowie");
        }
      }
    }

    return { created };
  }),
});
