/* ============================================================
   GAP ROUTER — moduły z dokumentacji architektury, których
   brakowało: biblioteka chorób, nekropsja, karencja, partie
   magazynowe (FIFO/FEFO + traceability), scenariusze
   ekonomiczne, benchmarki, historia receptur, dokładność
   prognoz, integracje oraz generyczny rejestr encji (/v1).
   ============================================================ */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { audit } from "./audit";
import { loadAggregates, kpisFromAgg } from "./farm-router";

const num = (v: unknown) => Number(v ?? 0);

/* ---------- ZDROWIE: biblioteka chorób + nekropsja + karencja ---------- */
const healthIntelRouter = createRouter({
  diseases: publicQuery.query(async () => getDb().select().from(s.diseases).orderBy(asc(s.diseases.name))),
  createDisease: publicQuery
    .input(z.object({
      name: z.string().min(2), latinName: z.string().optional(),
      category: z.enum(["viral", "bacterial", "parasitic", "metabolic", "fungal", "other"]),
      symptoms: z.string().optional(), diagnosis: z.string().optional(),
      treatmentProtocol: z.string().optional(), prevention: z.string().optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.diseases).values(input).$returningId();
      await audit("diseases", id, "create", { newValues: input });
      return { id };
    }),

  necropsyList: publicQuery.input(z.object({ batchId: z.number() })).query(async ({ input }) =>
    getDb().select().from(s.necropsy).where(eq(s.necropsy.batchId, input.batchId)).orderBy(desc(s.necropsy.day))),
  addNecropsy: publicQuery
    .input(z.object({
      batchId: z.number(), day: z.string(), birdCount: z.number().default(1),
      findings: z.string().min(3), suspectedDiseaseId: z.number().optional(),
      vet: z.string().default("panel"), verdict: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.necropsy).values(input).$returningId();
      await audit("necropsy", id, "create", { newValues: input, author: input.vet });
      return { id };
    }),

  /* karencja — wyliczenie bezpiecznej daty sprzedaży dla leczenia */
  calculateWithdrawal: publicQuery
    .input(z.object({ treatmentId: z.number(), withdrawalDays: z.number().min(0).max(60) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [t] = await db.select().from(s.treatments).where(eq(s.treatments.id, input.treatmentId));
      if (!t) throw new Error("Leczenie nie istnieje");
      const start = String(t.startedAt).slice(0, 10);
      const safe = new Date(new Date(start).getTime() + input.withdrawalDays * 864e5).toISOString().slice(0, 10);
      const [{ id }] = await db.insert(s.withdrawalPeriods).values({
        treatmentId: input.treatmentId, batchId: t.batchId,
        medicine: t.product, startDay: start, withdrawalDays: input.withdrawalDays, safeFrom: safe,
      }).$returningId();
      return { id, safeFrom: safe };
    }),
  withdrawals: publicQuery.query(async () =>
    getDb().select().from(s.withdrawalPeriods).orderBy(desc(s.withdrawalPeriods.id)).limit(50)),
});

/* ---------- MAGAZYN: partie (loty), ruchy, traceability ---------- */
const lotsRouter = createRouter({
  lots: publicQuery.input(z.object({ warehouseId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = getDb();
    return input?.warehouseId
      ? db.select().from(s.warehouseLots).where(eq(s.warehouseLots.warehouseId, input.warehouseId)).orderBy(asc(s.warehouseLots.expiryDate))
      : db.select().from(s.warehouseLots).orderBy(asc(s.warehouseLots.expiryDate));
  }),
  createLot: publicQuery
    .input(z.object({
      warehouseId: z.number(), product: z.string().min(2), lotNumber: z.string().min(1),
      qty: z.number(), unit: z.string().default("kg"), receivedDate: z.string(),
      expiryDate: z.string().optional(), supplierId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.warehouseLots).values({ ...input, qty: String(input.qty) }).$returningId();
      await db.insert(s.stockMovements).values({ lotId: id, kind: "in", qty: String(input.qty), reference: "przyjęcie partii", day: input.receivedDate });
      await audit("warehouse_lots", id, "create", { newValues: input });
      return { id };
    }),
  /* FEFO: wydanie z partii o najkrótszym terminie ważności */
  issueFefo: publicQuery
    .input(z.object({ product: z.string(), qty: z.number(), batchId: z.number().optional(), day: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const lots = await db.select().from(s.warehouseLots)
        .where(and(eq(s.warehouseLots.product, input.product), eq(s.warehouseLots.status, "active")))
        .orderBy(asc(s.warehouseLots.expiryDate));
      let remaining = input.qty;
      const used: { lotNumber: string; qty: number }[] = [];
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(num(lot.qty), remaining);
        if (take <= 0) continue;
        await db.update(s.warehouseLots).set({ qty: String(num(lot.qty) - take) }).where(eq(s.warehouseLots.id, lot.id));
        await db.insert(s.stockMovements).values({ lotId: lot.id, kind: "out", qty: String(take), batchId: input.batchId ?? null, reference: "wydanie FEFO", day: input.day });
        used.push({ lotNumber: lot.lotNumber, qty: take });
        remaining -= take;
      }
      if (remaining > 0) throw new Error(`Brak zapasu: wydano ${input.qty - remaining} z ${input.qty}`);
      return { used };
    }),
  traceability: publicQuery.input(z.object({ lotNumber: z.string() })).query(async ({ input }) => {
    const db = getDb();
    const [lot] = await db.select().from(s.warehouseLots).where(eq(s.warehouseLots.lotNumber, input.lotNumber));
    if (!lot) return null;
    const movements = await db.select().from(s.stockMovements).where(eq(s.stockMovements.lotId, lot.id)).orderBy(asc(s.stockMovements.day));
    return { lot, movements };
  }),
  /* skan alertów: przeterminowane / niskie stany */
  scanAlerts: publicQuery.mutation(async () => {
    const db = getDb();
    const lots = await db.select().from(s.warehouseLots);
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    let created = 0;
    for (const l of lots) {
      if (l.expiryDate && l.expiryDate <= soon) {
        await db.insert(s.notifications).values({
          severity: l.expiryDate < today ? "critical" : "warning",
          title: l.expiryDate < today ? `Partia przeterminowana: ${l.product} (${l.lotNumber})` : `Partia wygasa w 14 dni: ${l.product} (${l.lotNumber})`,
          body: `Magazyn #${l.warehouseId}, stan ${num(l.qty)} ${l.unit}, ważność ${l.expiryDate}`,
          link: "/magazyn",
        });
        created++;
      }
    }
    return { alertsCreated: created };
  }),
});

/* ---------- EKONOMIA: scenariusze + benchmarki ---------- */
const economicsIntelRouter = createRouter({
  createScenario: publicQuery
    .input(z.object({
      batchId: z.number().optional(), name: z.string().min(2),
      pricePerKgDelta: z.number().default(0), fcrDelta: z.number().default(0),
      mortalityDelta: z.number().default(0), feedPriceDeltaPct: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const agg = await loadAggregates();
      const bs = await db.select().from(s.batches);
      const ref = input.batchId ? bs.find((b) => b.id === input.batchId) : bs[0];
      if (!ref) throw new Error("Brak rzutów");
      const k = kpisFromAgg(ref, agg);
      const fcr = Math.max(k.fcr + input.fcrDelta, 1.5);
      const livability = k.livability - input.mortalityDelta;
      const soldKg = (ref.currentCount * (livability / 100) * k.avgWeightG) / 1000;
      const price = 4.9 * (1 + input.pricePerKgDelta / 100);
      const feedCost = soldKg * fcr * 0.42 * (1 + input.feedPriceDeltaPct / 100);
      const other = soldKg * 1.1;
      const profit = soldKg * price - feedCost - other;
      const result = { fcr, livability, soldKg, pricePerKg: price, feedCostEur: feedCost, profitEur: profit, marginPct: (profit / Math.max(soldKg * price, 1)) * 100 };
      const [{ id }] = await db.insert(s.scenarios).values({
        batchId: input.batchId ?? null, name: input.name,
        assumptions: { ...input }, result,
      }).$returningId();
      return { id, result };
    }),
  scenarios: publicQuery.query(async () => getDb().select().from(s.scenarios).orderBy(desc(s.scenarios.id)).limit(25)),

  recalculateBenchmarks: publicQuery.mutation(async () => {
    const db = getDb();
    const agg = await loadAggregates();
    const bs = await db.select().from(s.batches).where(eq(s.batches.status, "active"));
    await db.delete(s.benchmarks);
    const metrics: Record<string, number[]> = { fcr: [], adgG: [], mortalityPct: [], epef: [] };
    for (const b of bs) {
      const k = kpisFromAgg(b, agg);
      metrics.fcr.push(k.fcr); metrics.adgG.push(k.adgG); metrics.mortalityPct.push(k.mortalityPct); if (k.epef > 0) metrics.epef.push(k.epef);
    }
    for (const [metric, vals] of Object.entries(metrics)) {
      if (!vals.length) continue;
      await db.insert(s.benchmarks).values({ metric, value: String(vals.reduce((a, b) => a + b, 0) / vals.length), period: "bieżący chów", source: "internal" });
    }
    return { recalculated: Object.keys(metrics).length };
  }),
  benchmarks: publicQuery.query(async () => getDb().select().from(s.benchmarks)),
});

/* ---------- ŻYWIENIE: historia receptur + dokładność prognoz ---------- */
const feedIntelRouter = createRouter({
  recipeHistory: publicQuery.input(z.object({ recipeId: z.number() })).query(async ({ input }) =>
    getDb().select().from(s.recipeHistory).where(eq(s.recipeHistory.recipeId, input.recipeId)).orderBy(desc(s.recipeHistory.id))),
  logRecipeChange: publicQuery
    .input(z.object({ recipeId: z.number(), changeNote: z.string(), expertReport: z.string().optional(), author: z.string().default("panel") }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.recipeHistory).values(input).$returningId();
      await audit("recipe_history", id, "create", { newValues: input, author: input.author });
      return { id };
    }),
  analyzeAccuracy: publicQuery.mutation(async () => {
    // porównaj prognozy z analytics (masa) z rzeczywistymi ostatnimi ważeniami
    const db = getDb();
    const agg = await loadAggregates();
    const bs = await db.select().from(s.batches);
    let n = 0;
    for (const b of bs.slice(0, 20)) {
      const k = kpisFromAgg(b, agg);
      if (k.avgWeightG <= 100) continue;
      const predicted = k.adgG * (k.ageDays - 14); // retro-prognoza z 14 dni temu
      const actual = k.avgWeightG;
      const acc = Math.max(100 - Math.abs(predicted - actual) / Math.max(actual, 1) * 100, 0);
      await db.insert(s.forecastAccuracy).values({
        batchId: b.id, metric: "avgWeightG", predicted: String(predicted), actual: String(actual),
        accuracyPct: acc.toFixed(2), day: new Date().toISOString().slice(0, 10),
      });
      n++;
    }
    return { analyzed: n };
  }),
  forecastAccuracy: publicQuery.query(async () =>
    getDb().select().from(s.forecastAccuracy).orderBy(desc(s.forecastAccuracy.id)).limit(50)),
});

/* ---------- INTEGRACJE między modułami ---------- */
const integrationsRouter = createRouter({
  list: publicQuery.query(async () => getDb().select().from(s.integrations)),
  register: publicQuery
    .input(z.object({ sourceModule: z.string(), targetModule: z.string(), kind: z.enum(["api", "webhook", "device", "file"]).default("api"), config: z.record(z.string(), z.unknown()).optional() }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.integrations).values(input).$returningId();
      return { id };
    }),
});

/* ---------- GENERYCZNY REJESTR ENCJI (odpowiednik /v1/entities/:entity) ---------- */
const entityRouter = createRouter({
  list: publicQuery.input(z.object({ entity: z.string() })).query(async ({ input }) =>
    getDb().select().from(s.dynamicEntities).where(eq(s.dynamicEntities.entity, input.entity)).orderBy(desc(s.dynamicEntities.id))),
  create: publicQuery
    .input(z.object({ entity: z.string(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.dynamicEntities).values(input).$returningId();
      return { id };
    }),
  update: publicQuery
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await getDb().update(s.dynamicEntities).set({ data: input.data }).where(eq(s.dynamicEntities.id, input.id));
      return { ok: true };
    }),
  remove: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await getDb().delete(s.dynamicEntities).where(eq(s.dynamicEntities.id, input.id));
    return { ok: true };
  }),
});

export const gapRouter = createRouter({
  healthIntel: healthIntelRouter,
  lots: lotsRouter,
  economicsIntel: economicsIntelRouter,
  feedIntel: feedIntelRouter,
  integrations: integrationsRouter,
  entities: entityRouter,
});
