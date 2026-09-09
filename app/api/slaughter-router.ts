/**
 * UBOJNIA — router tRPC: plan uboju → partia UB → transport → przyjęcie
 * → wynik (auto wydajność) → klasyfikacja → rozliczenie → analityka.
 * Izolacja danych: wszystko filtrowane po companyId/farmId z kontekstu.
 * System przygotowuje punkty integracji z ubojnią (reception/result/settlement),
 * ale NIE jest połączony z żadnym realnym systemem zakładowym.
 */
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { audit } from "./audit";
import { requireCompanyId, scopedFarmIds, assertBatchAccess } from "./tenant";
import { computeYieldPct, computeSettlement, nextSlaughterCode, planVsReality, computeEconomics } from "./slaughter-calc";

const num = (v: unknown) => Number(v ?? 0);

async function logEvent(slaughterBatchId: number, eventType: string, message: string, payload?: unknown) {
  await getDb().insert(s.slaughterEvents).values({
    slaughterBatchId, eventType, message, payload: payload == null ? null : payload,
  });
}

/** Ładuje pełny łańcuch partii ubojowej. */
async function loadChain(slaughterBatchId: number) {
  const db = getDb();
  const [sb] = await db.select().from(s.slaughterBatches).where(eq(s.slaughterBatches.id, slaughterBatchId));
  if (!sb) return null;
  const [plan] = sb.planId
    ? await db.select().from(s.slaughterPlans).where(eq(s.slaughterPlans.id, sb.planId)) : [null];
  const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, sb.batchId));
  const [house] = batch ? await db.select().from(s.houses).where(eq(s.houses.id, batch.houseId)) : [null];
  const [farm] = house ? await db.select().from(s.farms).where(eq(s.farms.id, house.farmId)) : [null];
  const transportRows = await db.select().from(s.transports)
    .where(eq(s.transports.slaughterBatchId, slaughterBatchId)).orderBy(s.transports.id);
  const [reception] = await db.select().from(s.slaughterReceptions)
    .where(eq(s.slaughterReceptions.slaughterBatchId, slaughterBatchId)).limit(1);
  const [result] = await db.select().from(s.slaughterResults)
    .where(eq(s.slaughterResults.slaughterBatchId, slaughterBatchId)).limit(1);
  const classification = await db.select().from(s.carcassClassifications)
    .where(eq(s.carcassClassifications.slaughterBatchId, slaughterBatchId));
  const [settlement] = await db.select().from(s.slaughterSettlements)
    .where(eq(s.slaughterSettlements.slaughterBatchId, slaughterBatchId)).limit(1);
  const events = await db.select().from(s.slaughterEvents)
    .where(eq(s.slaughterEvents.slaughterBatchId, slaughterBatchId)).orderBy(desc(s.slaughterEvents.id));
  return { slaughterBatch: sb, plan, batch, house, farm, transports: transportRows, reception, result, classification, settlement, events };
}

async function assertSlaughterAccess(ctx: any, slaughterBatchId: number) {
  const cid = requireCompanyId(ctx);
  const fids = await scopedFarmIds(ctx);
  const [sb] = await getDb().select().from(s.slaughterBatches)
    .where(and(eq(s.slaughterBatches.id, slaughterBatchId), eq(s.slaughterBatches.companyId, cid), inArray(s.slaughterBatches.farmId, fids)))
    .limit(1);
  if (!sb) throw new Error("Partia ubojowa nie należy do wybranego gospodarstwa.");
  return sb;
}

export const slaughterRouter = createRouter({
  /* ---------- PLANY UBOJU ---------- */
  plans: publicQuery.query(async ({ ctx }) => {
    const cid = requireCompanyId(ctx); const fids = await scopedFarmIds(ctx);
    const db = getDb();
    const rows = await db.select().from(s.slaughterPlans)
      .where(and(eq(s.slaughterPlans.companyId, cid), inArray(s.slaughterPlans.farmId, fids)))
      .orderBy(desc(s.slaughterPlans.plannedDate));
    const batchRows = await db.select().from(s.batches);
    const byId = new Map(batchRows.map((b) => [b.id, b]));
    return rows.map((p) => ({ ...p, batch: byId.get(p.batchId) ?? null }));
  }),

  createPlan: publicQuery
    .input(z.object({
      batchId: z.number(), plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      plannedCount: z.number().int().min(1), targetAvgWeightKg: z.number().min(0).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      const batch = await assertBatchAccess(ctx, input.batchId);
      const [house] = await getDb().select().from(s.houses).where(eq(s.houses.id, batch.houseId));
      const fid = house.farmId;
      const [{ id }] = await getDb().insert(s.slaughterPlans).values({
        companyId: cid, farmId: fid, batchId: input.batchId, plannedDate: input.plannedDate,
        plannedCount: input.plannedCount,
        targetAvgWeightKg: input.targetAvgWeightKg != null ? String(input.targetAvgWeightKg) : null,
        notes: input.notes ?? null,
      }).$returningId();
      await audit("slaughter_plans", id, "create", { newValues: input });
      return { id };
    }),

  updatePlanStatus: publicQuery
    .input(z.object({ planId: z.number(), status: z.enum(["planned", "confirmed", "inProgress", "completed", "cancelled"]) }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      await getDb().update(s.slaughterPlans).set({ status: input.status })
        .where(and(eq(s.slaughterPlans.id, input.planId), eq(s.slaughterPlans.companyId, cid)));
      return { ok: true };
    }),

  /* ---------- PARTIE UBOJOWE ---------- */
  list: publicQuery.query(async ({ ctx }) => {
    const cid = requireCompanyId(ctx); const fids = await scopedFarmIds(ctx);
    const db = getDb();
    const rows = await db.select().from(s.slaughterBatches)
      .where(and(eq(s.slaughterBatches.companyId, cid), inArray(s.slaughterBatches.farmId, fids)))
      .orderBy(desc(s.slaughterBatches.id));
    const out = [];
    for (const sb of rows) {
      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, sb.batchId));
      const [result] = await db.select().from(s.slaughterResults)
        .where(eq(s.slaughterResults.slaughterBatchId, sb.id)).limit(1);
      const [settlement] = await db.select().from(s.slaughterSettlements)
        .where(eq(s.slaughterSettlements.slaughterBatchId, sb.id)).limit(1);
      out.push({ ...sb, batch: batch ?? null, result: result ?? null, settlement: settlement ?? null });
    }
    return out;
  }),

  /** Tworzy partię ubojową z planu (lub bez) — nadaje kod UB-RRRR-NNNNNN. */
  createBatch: publicQuery
    .input(z.object({
      planId: z.number().optional(),
      batchId: z.number(),
      notes: z.string().max(2000).optional(),
      demo: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      const batchRow = await assertBatchAccess(ctx, input.batchId);
      const db = getDb();
      const [houseRow] = await db.select().from(s.houses).where(eq(s.houses.id, batchRow.houseId));
      const fid = houseRow.farmId;
      const year = new Date().getFullYear();
      const [{ cnt }] = await db.select({ cnt: sql<number>`COUNT(*)` })
        .from(s.slaughterBatches).where(sql`${s.slaughterBatches.code} LIKE ${`UB-${year}-%`}`);
      const code = nextSlaughterCode(year, Number(cnt) + 1);
      const [{ id }] = await db.insert(s.slaughterBatches).values({
        code, planId: input.planId ?? null, companyId: cid, farmId: fid,
        batchId: input.batchId, isDemo: input.demo, notes: input.notes ?? null,
      }).$returningId();
      if (input.planId) {
        await db.update(s.slaughterPlans).set({ status: "inProgress" }).where(eq(s.slaughterPlans.id, input.planId));
      }
      await logEvent(id, "created", `Utworzono partię ubojową ${code}${input.demo ? " (DANE TESTOWE)" : ""}`);
      await audit("slaughter_batches", id, "create", { newValues: { code, ...input } });
      return { id, code };
    }),

  /** Szczegóły: pełny łańcuch FERMA→UBOJNIA + plan vs rzeczywistość + ekonomika. */
  detail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertSlaughterAccess(ctx, input.id);
      const chain = await loadChain(input.id);
      if (!chain) return null;
      const db = getDb();
      const { batch, plan, reception, result, settlement, transports } = chain;

      const feed = batch ? await db.select({ total: sql<string>`COALESCE(SUM(${s.feedUsages.kg}),0)` })
        .from(s.feedUsages).where(eq(s.feedUsages.batchId, batch.id)) : [{ total: "0" }];
      const transportCost = transports.reduce((a, t) => a + num(t.transportCost), 0);

      const pv = plan ? planVsReality({
        plannedDate: plan.plannedDate, plannedCount: plan.plannedCount,
        targetAvgWeightKg: plan.targetAvgWeightKg != null ? num(plan.targetAvgWeightKg) : null,
        actualCount: reception?.receivedCount ?? null,
        liveWeightKg: reception ? num(reception.liveWeightKg) : null,
        carcassWeightKg: result ? num(result.carcassWeightKg) : null,
        yieldPct: result ? num(result.yieldPct) : null,
        slaughteredAt: result?.slaughteredAt ?? null,
      }) : null;

      // koszt paszy: średnia z receptur firmy (lub globalnych) — estymacja jawna
      const recs = await db.select().from(s.recipes);
      const avgFeedPrice = recs.length ? recs.reduce((a, r) => a + num(r.costPerTon), 0) / recs.length : 0;
      const economics = batch ? computeEconomics({
        initialCount: batch.initialCount, chickPrice: num(batch.chickPrice),
        feedKg: num(feed[0]?.total), feedPricePerTon: avgFeedPrice,
        transportCost, revenueNet: settlement ? num(settlement.netAmount) : null,
        liveWeightKg: reception ? num(reception.liveWeightKg) : null,
      }) : null;

      return { ...chain, planVsReality: pv, economics, avgFeedPricePerTon: Number(avgFeedPrice.toFixed(2)) };
    }),

  updateBatchStatus: publicQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["created", "transport", "reception", "slaughtered", "settled", "closed"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertSlaughterAccess(ctx, input.id);
      await getDb().update(s.slaughterBatches).set({ status: input.status })
        .where(eq(s.slaughterBatches.id, input.id));
      await logEvent(input.id, "status", `Zmiana statusu: ${input.status}`);
      return { ok: true };
    }),

  /* ---------- TRANSPORT ---------- */
  addTransport: publicQuery
    .input(z.object({
      slaughterBatchId: z.number(), vehiclePlate: z.string().max(32).optional(),
      driverName: z.string().max(128).optional(), cratesCount: z.number().int().min(0).optional(),
      loadedCount: z.number().int().min(0), distanceKm: z.number().min(0).optional(),
      transportCost: z.number().min(0).default(0), deadInTransport: z.number().int().min(0).default(0),
      departureAt: z.string().optional(), arrivalAt: z.string().optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const sb = await assertSlaughterAccess(ctx, input.slaughterBatchId);
      const db = getDb();
      // BILANS: nie można wysłać więcej ptaków, niż stado ma na stanie
      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, sb.batchId)).limit(1);
      const alreadyLoaded = await db.select({ total: sql<number>`COALESCE(SUM(${s.transports.loadedCount}),0)` })
        .from(s.transports).where(eq(s.transports.slaughterBatchId, input.slaughterBatchId));
      const totalLoaded = num(alreadyLoaded[0]?.total) + input.loadedCount;
      if (batch && totalLoaded > batch.currentCount) {
        throw new Error(`Bilans: wysłano by ${totalLoaded} szt., a stado ma tylko ${batch.currentCount} szt. na stanie.`);
      }
      if (input.deadInTransport > input.loadedCount) {
        throw new Error("Bilans: upadki transportowe nie mogą przekraczać liczby załadowanych ptaków.");
      }
      const [{ id }] = await db.insert(s.transports).values({
        slaughterBatchId: input.slaughterBatchId, vehiclePlate: input.vehiclePlate ?? null,
        driverName: input.driverName ?? null, cratesCount: input.cratesCount ?? null,
        loadedCount: input.loadedCount, distanceKm: input.distanceKm != null ? String(input.distanceKm) : null,
        transportCost: String(input.transportCost), deadInTransport: input.deadInTransport,
        departureAt: input.departureAt ? new Date(input.departureAt) : null,
        arrivalAt: input.arrivalAt ? new Date(input.arrivalAt) : null,
        notes: input.notes ?? null,
      }).$returningId();
      await db.update(s.slaughterBatches).set({ status: "transport" })
        .where(and(eq(s.slaughterBatches.id, input.slaughterBatchId), eq(s.slaughterBatches.status, "created")));
      await logEvent(input.slaughterBatchId, "transport", `Transport: ${input.loadedCount} szt., pojazd ${input.vehiclePlate ?? "—"}`);
      return { id };
    }),

  /* ---------- PRZYJĘCIE NA UBOJNI ---------- */
  addReception: publicQuery
    .input(z.object({
      slaughterBatchId: z.number(), receivedCount: z.number().int().min(0),
      deadOnArrival: z.number().int().min(0).default(0), rejectedCount: z.number().int().min(0).default(0),
      liveWeightKg: z.number().min(0), notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertSlaughterAccess(ctx, input.slaughterBatchId);
      const db = getDb();
      // BILANS: nie można przyjąć więcej ptaków, niż wysłano transportami
      const loaded = await db.select({ total: sql<number>`COALESCE(SUM(${s.transports.loadedCount}),0)` })
        .from(s.transports).where(eq(s.transports.slaughterBatchId, input.slaughterBatchId));
      const totalLoaded = num(loaded[0]?.total);
      if (totalLoaded > 0 && input.receivedCount + input.deadOnArrival + input.rejectedCount > totalLoaded) {
        throw new Error(`Bilans: przyjęto by ${input.receivedCount + input.deadOnArrival + input.rejectedCount} szt. (żywe+DOA+odrzuty), a wysłano tylko ${totalLoaded} szt.`);
      }
      const [{ id }] = await db.insert(s.slaughterReceptions).values({
        slaughterBatchId: input.slaughterBatchId, receivedCount: input.receivedCount,
        deadOnArrival: input.deadOnArrival, rejectedCount: input.rejectedCount,
        liveWeightKg: String(input.liveWeightKg), notes: input.notes ?? null,
      }).$returningId();
      await db.update(s.slaughterBatches).set({ status: "reception" }).where(eq(s.slaughterBatches.id, input.slaughterBatchId));
      await logEvent(input.slaughterBatchId, "reception",
        `Przyjęcie: ${input.receivedCount} szt., żywiec ${input.liveWeightKg} kg, DOA ${input.deadOnArrival}`);
      return { id };
    }),

  /* ---------- WYNIK UBOJU (auto wydajność) ---------- */
  addResult: publicQuery
    .input(z.object({
      slaughterBatchId: z.number(), carcassCount: z.number().int().min(0),
      carcassWeightKg: z.number().min(0), wasteKg: z.number().min(0).default(0),
      byproductsKg: z.number().min(0).default(0), notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertSlaughterAccess(ctx, input.slaughterBatchId);
      const db = getDb();
      const [reception] = await db.select().from(s.slaughterReceptions)
        .where(eq(s.slaughterReceptions.slaughterBatchId, input.slaughterBatchId)).limit(1);
      const liveKg = reception ? num(reception.liveWeightKg) : 0;
      // BILANS: masa tuszek i liczba tuszek nie mogą przekraczać przyjętego żywca
      if (liveKg > 0 && input.carcassWeightKg > liveKg) {
        throw new Error(`Bilans: masa tuszek (${input.carcassWeightKg} kg) nie może przekraczać masy żywej (${liveKg} kg).`);
      }
      if (reception && input.carcassCount > reception.receivedCount) {
        throw new Error(`Bilans: ubitych sztuk (${input.carcassCount}) nie może być więcej niż przyjętych (${reception.receivedCount}).`);
      }
      const yieldPct = computeYieldPct(input.carcassWeightKg, liveKg);
      const [{ id }] = await db.insert(s.slaughterResults).values({
        slaughterBatchId: input.slaughterBatchId, carcassCount: input.carcassCount,
        carcassWeightKg: String(input.carcassWeightKg), yieldPct: String(yieldPct),
        wasteKg: String(input.wasteKg), byproductsKg: String(input.byproductsKg),
        notes: input.notes ?? null,
      }).$returningId();
      await db.update(s.slaughterBatches).set({ status: "slaughtered" }).where(eq(s.slaughterBatches.id, input.slaughterBatchId));
      await logEvent(input.slaughterBatchId, "result",
        `Wynik uboju: ${input.carcassWeightKg} kg tuszek, wydajność ${yieldPct}% (auto: tuszki/żywiec ×100)`);
      return { id, yieldPct };
    }),

  /* ---------- SŁOWNIK KLAS (konfigurowalny — bez narzuconych norm) ---------- */
  classDict: publicQuery.query(async ({ ctx }) => {
    const cid = ctx.companyId;
    return getDb().select().from(s.carcassClassDict)
      .where(and(eq(s.carcassClassDict.active, true),
        sql`(${s.carcassClassDict.companyId} = ${cid ?? -1} OR ${s.carcassClassDict.companyId} IS NULL)`))
      .orderBy(s.carcassClassDict.sortOrder);
  }),

  addClassDictEntry: publicQuery
    .input(z.object({ code: z.string().min(1).max(32), label: z.string().min(1).max(128), sortOrder: z.number().int().default(0) }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      const [{ id }] = await getDb().insert(s.carcassClassDict).values({ ...input, companyId: cid }).$returningId();
      return { id };
    }),

  removeClassDictEntry: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      await getDb().update(s.carcassClassDict).set({ active: false })
        .where(and(eq(s.carcassClassDict.id, input.id), eq(s.carcassClassDict.companyId, cid)));
      return { ok: true };
    }),

  setClassification: publicQuery
    .input(z.object({
      slaughterBatchId: z.number(),
      rows: z.array(z.object({ classCode: z.string().max(32), count: z.number().int().min(0), weightKg: z.number().min(0) })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertSlaughterAccess(ctx, input.slaughterBatchId);
      const db = getDb();
      await db.delete(s.carcassClassifications).where(eq(s.carcassClassifications.slaughterBatchId, input.slaughterBatchId));
      for (const r of input.rows) {
        await db.insert(s.carcassClassifications).values({
          slaughterBatchId: input.slaughterBatchId, classCode: r.classCode,
          count: r.count, weightKg: String(r.weightKg),
        });
      }
      await logEvent(input.slaughterBatchId, "classification",
        `Klasyfikacja: ${input.rows.map((r) => `${r.classCode}=${r.count} szt.`).join(", ")}`);
      return { ok: true };
    }),

  /* ---------- ROZLICZENIE ---------- */
  addSettlement: publicQuery
    .input(z.object({
      slaughterBatchId: z.number(), pricePerKg: z.number().min(0),
      bonuses: z.number().default(0), deductions: z.number().default(0),
      currency: z.string().length(3).default("PLN"),
      documentNumber: z.string().max(64).optional(),
      settledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertSlaughterAccess(ctx, input.slaughterBatchId);
      const db = getDb();
      const [result] = await db.select().from(s.slaughterResults)
        .where(eq(s.slaughterResults.slaughterBatchId, input.slaughterBatchId)).limit(1);
      if (!result) throw new Error("Najpierw wprowadź wynik uboju (masa tuszek).");
      const amounts = computeSettlement({
        carcassWeightKg: num(result.carcassWeightKg), pricePerKg: input.pricePerKg,
        bonuses: input.bonuses, deductions: input.deductions,
      });
      const [{ id }] = await db.insert(s.slaughterSettlements).values({
        slaughterBatchId: input.slaughterBatchId, pricePerKg: String(input.pricePerKg),
        bonuses: String(input.bonuses), deductions: String(input.deductions),
        grossAmount: String(amounts.grossAmount), netAmount: String(amounts.netAmount),
        currency: input.currency, documentNumber: input.documentNumber ?? null,
        settledAt: input.settledAt ?? null, notes: input.notes ?? null,
      }).$returningId();
      await db.update(s.slaughterBatches).set({ status: "settled" }).where(eq(s.slaughterBatches.id, input.slaughterBatchId));
      await logEvent(input.slaughterBatchId, "settlement",
        `Rozliczenie: netto ${amounts.netAmount} ${input.currency} (${input.documentNumber ?? "bez dokumentu"})`);
      await audit("slaughter_settlements", id, "create", { newValues: { ...input, ...amounts } });
      return { id, ...amounts };
    }),

  /* ---------- ANALITYKA: genetyka i płeć ---------- */
  analytics: publicQuery.query(async ({ ctx }) => {
    const cid = requireCompanyId(ctx); const fids = await scopedFarmIds(ctx);
    const db = getDb();
    const rows = await db.select().from(s.slaughterBatches)
      .where(and(eq(s.slaughterBatches.companyId, cid), inArray(s.slaughterBatches.farmId, fids)));
    const byGenetics = new Map<string, { n: number; yieldSum: number; revSum: number; liveSum: number }>();
    const bySex = new Map<string, { n: number; yieldSum: number }>();
    for (const sb of rows) {
      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, sb.batchId));
      const [result] = await db.select().from(s.slaughterResults)
        .where(eq(s.slaughterResults.slaughterBatchId, sb.id)).limit(1);
      const [reception] = await db.select().from(s.slaughterReceptions)
        .where(eq(s.slaughterReceptions.slaughterBatchId, sb.id)).limit(1);
      const [settlement] = await db.select().from(s.slaughterSettlements)
        .where(eq(s.slaughterSettlements.slaughterBatchId, sb.id)).limit(1);
      const y = result ? num(result.yieldPct) : 0;
      if (batch) {
        const g = byGenetics.get(batch.geneticLine) ?? { n: 0, yieldSum: 0, revSum: 0, liveSum: 0 };
        g.n++; g.yieldSum += y; g.revSum += settlement ? num(settlement.netAmount) : 0;
        g.liveSum += reception ? num(reception.liveWeightKg) : 0;
        byGenetics.set(batch.geneticLine, g);
        const sx = bySex.get(batch.sex) ?? { n: 0, yieldSum: 0 };
        sx.n++; sx.yieldSum += y; bySex.set(batch.sex, sx);
      }
    }
    return {
      byGenetics: [...byGenetics.entries()].map(([geneticLine, v]) => ({
        geneticLine, batches: v.n, avgYieldPct: v.n ? Number((v.yieldSum / v.n).toFixed(2)) : 0,
        revenueNet: Number(v.revSum.toFixed(2)), liveWeightKg: Number(v.liveSum.toFixed(0)),
      })),
      bySex: [...bySex.entries()].map(([sex, v]) => ({
        sex, batches: v.n, avgYieldPct: v.n ? Number((v.yieldSum / v.n).toFixed(2)) : 0,
      })),
      totalBatches: rows.length,
    };
  }),

  /* ---------- DASHBOARD KPI ---------- */
  dashboard: publicQuery.query(async ({ ctx }) => {
    const cid = requireCompanyId(ctx); const fids = await scopedFarmIds(ctx);
    const db = getDb();
    const rows = await db.select().from(s.slaughterBatches)
      .where(and(eq(s.slaughterBatches.companyId, cid), inArray(s.slaughterBatches.farmId, fids)));
    const planned = await db.select().from(s.slaughterPlans)
      .where(and(eq(s.slaughterPlans.companyId, cid), inArray(s.slaughterPlans.farmId, fids),
        inArray(s.slaughterPlans.status, ["planned", "confirmed"])));
    let liveKg = 0, carcassKg = 0, yieldSum = 0, yieldN = 0, revenue = 0, doa = 0;
    for (const sb of rows) {
      const [rec] = await db.select().from(s.slaughterReceptions)
        .where(eq(s.slaughterReceptions.slaughterBatchId, sb.id)).limit(1);
      const [res] = await db.select().from(s.slaughterResults)
        .where(eq(s.slaughterResults.slaughterBatchId, sb.id)).limit(1);
      const [set] = await db.select().from(s.slaughterSettlements)
        .where(eq(s.slaughterSettlements.slaughterBatchId, sb.id)).limit(1);
      if (rec) { liveKg += num(rec.liveWeightKg); doa += rec.deadOnArrival; }
      if (res) { carcassKg += num(res.carcassWeightKg); yieldSum += num(res.yieldPct); yieldN++; }
      if (set) revenue += num(set.netAmount);
    }
    const alerts: { type: string; message: string }[] = [];
    if (doa > 0) alerts.push({ type: "warning", message: `Padłe podczas transportu/przyjęcia łącznie: ${doa} szt.` });
    for (const p of planned) {
      const days = Math.ceil((new Date(p.plannedDate).getTime() - Date.now()) / 86400000);
      if (days <= 7 && days >= 0) alerts.push({ type: "info", message: `Plan uboju za ${days} dni (stado #${p.batchId}, ${p.plannedCount} szt.)` });
      if (days < 0) alerts.push({ type: "warning", message: `Plan uboju po terminie (stado #${p.batchId}, plan: ${p.plannedDate})` });
    }
    return {
      totalSlaughterBatches: rows.length,
      plannedUpcoming: planned.length,
      liveWeightKg: Number(liveKg.toFixed(0)),
      carcassWeightKg: Number(carcassKg.toFixed(0)),
      avgYieldPct: yieldN ? Number((yieldSum / yieldN).toFixed(2)) : 0,
      revenueNet: Number(revenue.toFixed(2)),
      deadOnArrival: doa,
      alerts,
    };
  }),

  /* ---------- PEŁNY PRZYKŁAD DEMO (dane testowe, oznaczone) ---------- */
  demoScenario: publicQuery.mutation(async ({ ctx }) => {
    const cid = requireCompanyId(ctx); const fids = await scopedFarmIds(ctx);
    const db = getDb();
    // aktywne stado z wybranego gospodarstwa / firmy
    const houseRows = await db.select().from(s.houses).where(inArray(s.houses.farmId, fids));
    if (!houseRows.length) throw new Error("Brak kurników w wybranej firmie.");
    const batchRows = await db.select().from(s.batches)
      .where(and(inArray(s.batches.houseId, houseRows.map((h) => h.id)), eq(s.batches.status, "active"))).limit(1);
    if (!batchRows.length) throw new Error("Brak aktywnego stada — najpierw utwórz rzut w module Produkcja.");
    const batch = batchRows[0];
    const [demoHouse] = await db.select().from(s.houses).where(eq(s.houses.id, batch.houseId));
    const fid = demoHouse.farmId;

    const year = new Date().getFullYear();
    const [{ cnt }] = await db.select({ cnt: sql<number>`COUNT(*)` })
      .from(s.slaughterBatches).where(sql`${s.slaughterBatches.code} LIKE ${`UB-${year}-%`}`);
    const code = nextSlaughterCode(year, Number(cnt) + 1);

    const plannedDate = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const [{ id: planId }] = await db.insert(s.slaughterPlans).values({
      companyId: cid, farmId: fid, batchId: batch.id, plannedDate,
      plannedCount: batch.currentCount, targetAvgWeightKg: "12.500",
      status: "completed", notes: "DEMO / DANE TESTOWE",
    }).$returningId();
    const [{ id: sbId }] = await db.insert(s.slaughterBatches).values({
      code, planId, companyId: cid, farmId: fid, batchId: batch.id,
      isDemo: true, status: "settled", notes: "DEMO / DANE TESTOWE — pełny przepływ",
    }).$returningId();

    const count = Math.min(batch.currentCount, 2000);
    const liveKg = Number((count * 12.3).toFixed(2));
    const carcassKg = Number((liveKg * 0.78).toFixed(2));
    await db.insert(s.transports).values({
      slaughterBatchId: sbId, vehiclePlate: "DEMO-001", driverName: "DANE TESTOWE",
      loadedCount: count, distanceKm: "85.0", transportCost: "950.00", deadInTransport: 3,
    });
    await db.insert(s.slaughterReceptions).values({
      slaughterBatchId: sbId, receivedCount: count - 3, deadOnArrival: 3, rejectedCount: 5,
      liveWeightKg: String(liveKg), notes: "DEMO / DANE TESTOWE",
    });
    const yieldPct = computeYieldPct(carcassKg, liveKg);
    await db.insert(s.slaughterResults).values({
      slaughterBatchId: sbId, carcassCount: count - 8, carcassWeightKg: String(carcassKg),
      yieldPct: String(yieldPct), wasteKg: "120.00", byproductsKg: "450.00", notes: "DEMO / DANE TESTOWE",
    });
    const amounts = computeSettlement({ carcassWeightKg: carcassKg, pricePerKg: 7.85, bonuses: 1200, deductions: 380 });
    await db.insert(s.slaughterSettlements).values({
      slaughterBatchId: sbId, pricePerKg: "7.850", bonuses: "1200.00", deductions: "380.00",
      grossAmount: String(amounts.grossAmount), netAmount: String(amounts.netAmount),
      currency: "PLN", documentNumber: "DEMO/FV/001", settledAt: new Date().toISOString().slice(0, 10),
      notes: "DEMO / DANE TESTOWE",
    });
    for (const [ev, msg] of [
      ["created", `Utworzono partię DEMO ${code}`],
      ["transport", `Transport DEMO: ${count} szt.`],
      ["reception", `Przyjęcie DEMO: ${liveKg} kg żywca`],
      ["result", `Wynik DEMO: wydajność ${yieldPct}%`],
      ["settlement", `Rozliczenie DEMO: netto ${amounts.netAmount} PLN`],
    ] as const) {
      await logEvent(sbId, ev, msg);
    }
    await audit("slaughter_batches", sbId, "create", { newValues: { code, demo: true } });
    return { id: sbId, code, yieldPct };
  }),

  /* ---------- IDENTYFIKOWALNOŚĆ (traceability) w obie strony ---------- */
  traceability: publicQuery
    .input(z.object({ batchId: z.number().optional(), code: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx); const fids = await scopedFarmIds(ctx);
      const db = getDb();
      let sbRows: s.SlaughterBatch[] = [];
      if (input.code) {
        sbRows = await db.select().from(s.slaughterBatches)
          .where(and(eq(s.slaughterBatches.code, input.code), eq(s.slaughterBatches.companyId, cid)));
      } else if (input.batchId) {
        sbRows = await db.select().from(s.slaughterBatches)
          .where(and(eq(s.slaughterBatches.batchId, input.batchId), eq(s.slaughterBatches.companyId, cid), inArray(s.slaughterBatches.farmId, fids)));
      }
      const chains = [];
      for (const sb of sbRows) {
        const chain = await loadChain(sb.id);
        if (chain) chains.push(chain);
      }
      return chains;
    }),
});
