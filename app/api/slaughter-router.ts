import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and, desc, sql, gt, or } from "drizzle-orm";
import { audit } from "./audit";
import { assertBatchAccess, requireCompanyId } from "./tenant";
import { computeEconomics, computeSettlement, computeYieldPct, planVsReality } from "./slaughter-calc";

export const slaughterRouter = createRouter({
  /* ------- dashboard ------- */
  dashboard: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.companyId) return null;

    const batches = await db.select().from(s.slaughterBatches).where(eq(s.slaughterBatches.companyId, BigInt(ctx.companyId)));
    const plans = await db.select().from(s.slaughterPlans).where(and(
      eq(s.slaughterPlans.companyId, BigInt(ctx.companyId)),
      gt(s.slaughterPlans.plannedDate, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ));

    let totalLiveWeightKg = 0;
    let totalCarcassWeightKg = 0;
    let totalYieldPct = 0;
    let totalRevenueNet = 0;
    let totalDeadOnArrival = 0;
    let countWithYield = 0;

    for (const batch of batches) {
      const receptions = await db.select().from(s.slaughterReceptions).where(eq(s.slaughterReceptions.slaughterBatchId, BigInt(batch.id)));
      const results = await db.select().from(s.slaughterResults).where(eq(s.slaughterResults.slaughterBatchId, BigInt(batch.id)));
      const settlement = await db.select().from(s.slaughterSettlements).where(eq(s.slaughterSettlements.slaughterBatchId, BigInt(batch.id)));

      if (receptions.length > 0) {
        const r = receptions[0];
        totalLiveWeightKg += parseFloat(r.liveWeightKg?.toString() || "0");
        totalDeadOnArrival += parseInt(r.deadOnArrival?.toString() || "0");
      }
      if (results.length > 0) {
        const res = results[0];
        totalCarcassWeightKg += parseFloat(res.carcassWeightKg?.toString() || "0");
        const yp = parseFloat(res.yieldPct?.toString() || "0");
        if (yp > 0) {
          totalYieldPct += yp;
          countWithYield++;
        }
      }
      if (settlement.length > 0) {
        const set = settlement[0];
        totalRevenueNet += parseFloat(set.netAmount?.toString() || "0");
      }
    }

    return {
      totalSlaughterBatches: batches.length,
      plannedUpcoming: plans.filter(p => p.status === "planned").length,
      liveWeightKg: totalLiveWeightKg,
      carcassWeightKg: totalCarcassWeightKg,
      avgYieldPct: countWithYield > 0 ? Math.round((totalYieldPct / countWithYield) * 100) / 100 : 0,
      revenueNet: totalRevenueNet,
      deadOnArrival: totalDeadOnArrival,
      alerts: [],
    };
  }),

  /* ------- lista partii ubojowych ------- */
  list: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.companyId) return [];
    
    const batches = await db.select().from(s.slaughterBatches)
      .where(eq(s.slaughterBatches.companyId, BigInt(ctx.companyId)))
      .orderBy(desc(s.slaughterBatches.createdAt));
    
    return batches.map(b => ({ id: b.id, code: b.code, status: b.status, isDemo: b.isDemo }));
  }),

  /* ------- plany uboju ------- */
  plans: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.companyId) return [];
    
    return db.select().from(s.slaughterPlans)
      .where(eq(s.slaughterPlans.companyId, BigInt(ctx.companyId)))
      .orderBy(desc(s.slaughterPlans.plannedDate));
  }),

  /* ------- szczegóły partii ------- */
  detail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [batch] = await db.select().from(s.slaughterBatches).where(and(
        eq(s.slaughterBatches.id, input.id), eq(s.slaughterBatches.companyId, BigInt(requireCompanyId(ctx))),
      ));
      if (!batch) return null;

      const [plan] = batch.planId
        ? await db.select().from(s.slaughterPlans).where(eq(s.slaughterPlans.id, batch.planId)) : [null];
      const [prod] = batch.batchId ? await db.select().from(s.batches).where(eq(s.batches.id, batch.batchId)) : [null];
      const farm = batch.farmId ? (await db.select().from(s.farms).where(eq(s.farms.id, batch.farmId)))[0] : null;
      const house = prod?.houseId ? (await db.select().from(s.houses).where(eq(s.houses.id, prod.houseId)))[0] : null;
      
      const transports = await db.select().from(s.transports).where(eq(s.transports.slaughterBatchId, BigInt(batch.id)));
      const [reception] = await db.select().from(s.slaughterReceptions).where(eq(s.slaughterReceptions.slaughterBatchId, BigInt(batch.id)));
      const [result] = await db.select().from(s.slaughterResults).where(eq(s.slaughterResults.slaughterBatchId, BigInt(batch.id)));
      const classifications = await db.select().from(s.carcassClassifications).where(eq(s.carcassClassifications.slaughterBatchId, BigInt(batch.id)));
      const [settlement] = await db.select().from(s.slaughterSettlements).where(eq(s.slaughterSettlements.slaughterBatchId, BigInt(batch.id)));
      const events = await db.select().from(s.slaughterEvents).where(eq(s.slaughterEvents.slaughterBatchId, BigInt(batch.id))).orderBy(desc(s.slaughterEvents.createdAt));

      const [costRows, feedRows, recipes] = prod
        ? await Promise.all([
          db.select().from(s.costs).where(eq(s.costs.batchId, prod.id)),
          db.select().from(s.feedUsages).where(eq(s.feedUsages.batchId, prod.id)),
          db.select().from(s.recipes),
        ]) : [[], [], []] as const;
      const num = (value: unknown) => Number(value ?? 0);
      const feedCostFromUsage = feedRows.reduce((sum, row) => {
        const recipe = recipes.find((r) => r.id === row.recipeId);
        return sum + (num(row.kg) / 1000) * num(recipe?.costPerTon);
      }, 0);
      const explicitFeedCost = costRows.filter((x) => x.category === "feed").reduce((sum, x) => sum + num(x.amount), 0);
      const otherCosts = costRows.filter((x) => !["chicks", "feed", "transport"].includes(x.category))
        .reduce((sum, x) => sum + num(x.amount), 0);
      const transportCost = transports.reduce((sum, row) => sum + num(row.transportCost), 0);
      const economics = prod && reception ? computeEconomics({
        initialCount: prod.initialCount,
        chickPrice: num(prod.chickPrice),
        feedKg: feedRows.reduce((sum, row) => sum + num(row.kg), 0),
        // Gdy nie było rejestru wydań, używamy ręcznie zaksięgowanego kosztu paszy.
        feedPricePerTon: feedRows.length > 0 ? (feedCostFromUsage * 1000) / Math.max(feedRows.reduce((sum, row) => sum + num(row.kg), 0), 1) : 0,
        transportCost,
        otherCosts: otherCosts + (feedRows.length === 0 ? explicitFeedCost : 0),
        revenueNet: settlement ? num(settlement.netAmount) : null,
        liveWeightKg: num(reception.liveWeightKg),
      }) : null;

      return {
        slaughterBatch: batch,
        batch: prod,
        farm,
        house,
        plan,
        transports,
        reception,
        result,
        classification: classifications,
        settlement,
        events,
        planVsReality: result && reception && plan ? planVsReality({
          plannedDate: plan.plannedDate, plannedCount: plan.plannedCount, targetAvgWeightKg: num(plan.targetAvgWeightKg),
          actualCount: reception.receivedCount, liveWeightKg: num(reception.liveWeightKg),
          carcassWeightKg: num(result.carcassWeightKg), yieldPct: num(result.yieldPct), slaughteredAt: result.slaughteredAt,
        }) : null,
        economics,
        avgFeedPricePerTon: feedRows.length ? Number(((feedCostFromUsage * 1000) / feedRows.reduce((sum, row) => sum + num(row.kg), 0)).toFixed(2)) : null,
      };
    }),

  /* ------- analityka ------- */
  analytics: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.companyId) return [];
    return [];
  }),

  /* ------- identyfikowalność (traceability) ------- */
  traceability: publicQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [batch] = await db.select().from(s.slaughterBatches)
        .where(and(eq(s.slaughterBatches.code, input.code), eq(s.slaughterBatches.companyId, BigInt(ctx.companyId || 0))));
      if (!batch) return null;
      return batch;
    }),

  /* ------- słownik klas ------- */
  classDict: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.select().from(s.carcassClassDict)
      .where(ctx.companyId ? or(eq(s.carcassClassDict.companyId, BigInt(ctx.companyId)), eq(s.carcassClassDict.companyId, null)) : undefined)
      .orderBy(s.carcassClassDict.sortOrder);
  }),

  /* ------- tworzenie partii ubojowej ------- */
  createBatch: publicQuery
    .input(z.object({ batchId: z.number(), planId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (!ctx.companyId || !ctx.farmId) throw new Error("Brak farmId");

      const code = `UB-${String(ctx.farmId).padStart(4, "0")}-${String(Date.now()).slice(-6)}`;
      await assertBatchAccess(ctx, input.batchId);
      if (input.planId) {
        const [plan] = await db.select().from(s.slaughterPlans).where(and(
          eq(s.slaughterPlans.id, input.planId), eq(s.slaughterPlans.batchId, input.batchId),
          eq(s.slaughterPlans.companyId, ctx.companyId),
        ));
        if (!plan) throw new Error("Plan uboju nie należy do wybranego stada");
      }
      const [{ id }] = await db.insert(s.slaughterBatches).values({
        code,
        planId: input.planId,
        companyId: BigInt(ctx.companyId),
        farmId: BigInt(ctx.farmId),
        batchId: BigInt(input.batchId),
        status: "created",
        isDemo: false,
      }).$returningId();

      return { id, code };
    }),

  /* ------- tworzenie planu uboju ------- */
  createPlan: publicQuery
    .input(z.object({ batchId: z.number(), plannedDate: z.string(), plannedCount: z.number(), targetAvgWeightKg: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (!ctx.companyId || !ctx.farmId) throw new Error("Brak danych");

      await assertBatchAccess(ctx, input.batchId);
      const [{ id }] = await db.insert(s.slaughterPlans).values({
        companyId: BigInt(ctx.companyId),
        farmId: BigInt(ctx.farmId),
        batchId: BigInt(input.batchId),
        plannedDate: input.plannedDate,
        plannedCount: input.plannedCount,
        targetAvgWeightKg: input.targetAvgWeightKg ? input.targetAvgWeightKg.toString() : null,
        status: "planned",
        notes: input.notes,
      }).$returningId();

      return { id };
    }),

  /* ------- transport ------- */
  addTransport: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), vehiclePlate: z.string(), driverName: z.string(), loadedCount: z.number(), distanceKm: z.number().optional(), transportCost: z.number(), deadInTransport: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [batch] = await db.select().from(s.slaughterBatches).where(and(eq(s.slaughterBatches.id, input.slaughterBatchId), eq(s.slaughterBatches.companyId, BigInt(requireCompanyId(ctx)))));
      if (!batch) throw new Error("Nie znaleziono partii ubojowej");
      const [{ id }] = await db.insert(s.transports).values({
        slaughterBatchId: BigInt(input.slaughterBatchId),
        vehiclePlate: input.vehiclePlate,
        driverName: input.driverName,
        loadedCount: input.loadedCount,
        distanceKm: input.distanceKm,
        transportCost: input.transportCost.toString(),
        deadInTransport: input.deadInTransport,
      }).$returningId();
      await db.insert(s.costs).values({
        batchId: batch.batchId, category: "transport", amount: input.transportCost.toFixed(2),
        currency: "PLN", day: new Date().toISOString().slice(0, 10),
        note: `Transport do ubojni ${batch.code}`,
      });
      return { id };
    }),

  /* ------- przyjęcie ------- */
  addReception: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), receivedCount: z.number(), liveWeightKg: z.number(), deadOnArrival: z.number().optional(), rejectedCount: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [batch] = await db.select().from(s.slaughterBatches).where(and(eq(s.slaughterBatches.id, input.slaughterBatchId), eq(s.slaughterBatches.companyId, BigInt(requireCompanyId(ctx)))));
      if (!batch) throw new Error("Nie znaleziono partii ubojowej");
      const [{ id }] = await db.insert(s.slaughterReceptions).values({
        slaughterBatchId: BigInt(input.slaughterBatchId),
        receivedCount: input.receivedCount,
        liveWeightKg: input.liveWeightKg.toString(),
        deadOnArrival: input.deadOnArrival,
        rejectedCount: input.rejectedCount,
      }).$returningId();
      return { id };
    }),

  /* ------- wyniki uboju ------- */
  addResult: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), carcassCount: z.number(), carcassWeightKg: z.number(), wasteKg: z.number().optional(), byproductsKg: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [owned] = await db.select().from(s.slaughterBatches).where(and(eq(s.slaughterBatches.id, input.slaughterBatchId), eq(s.slaughterBatches.companyId, BigInt(requireCompanyId(ctx)))));
      if (!owned) throw new Error("Nie znaleziono partii ubojowej");
      
      const [reception] = await db.select().from(s.slaughterReceptions).where(eq(s.slaughterReceptions.slaughterBatchId, BigInt(input.slaughterBatchId)));
      if (!reception) throw new Error("Brak przyjęcia");

      const yieldPct = computeYieldPct(input.carcassWeightKg, Number(reception.liveWeightKg));

      const [{ id }] = await db.insert(s.slaughterResults).values({
        slaughterBatchId: BigInt(input.slaughterBatchId),
        carcassCount: input.carcassCount,
        carcassWeightKg: input.carcassWeightKg.toString(),
        wasteKg: input.wasteKg?.toString(),
        byproductsKg: input.byproductsKg?.toString(),
        yieldPct: yieldPct.toString(),
        slaughteredAt: new Date(),
      }).$returningId();

      return { id, yieldPct };
    }),

  /* ------- klasyfikacja ------- */
  setClassification: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), rows: z.array(z.object({ classCode: z.string(), count: z.number(), weightKg: z.number() })) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [owned] = await db.select().from(s.slaughterBatches).where(and(eq(s.slaughterBatches.id, input.slaughterBatchId), eq(s.slaughterBatches.companyId, BigInt(requireCompanyId(ctx)))));
      if (!owned) throw new Error("Nie znaleziono partii ubojowej");
      await db.delete(s.carcassClassifications).where(eq(s.carcassClassifications.slaughterBatchId, BigInt(input.slaughterBatchId)));
      
      for (const row of input.rows) {
        await db.insert(s.carcassClassifications).values({
          slaughterBatchId: BigInt(input.slaughterBatchId),
          classCode: row.classCode,
          count: row.count,
          weightKg: row.weightKg.toString(),
        });
      }
      return { ok: true };
    }),

  /* ------- rozliczenie ------- */
  addSettlement: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), pricePerKg: z.number(), bonuses: z.number().optional(), deductions: z.number().optional(), documentNumber: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [owned] = await db.select().from(s.slaughterBatches).where(and(eq(s.slaughterBatches.id, input.slaughterBatchId), eq(s.slaughterBatches.companyId, BigInt(requireCompanyId(ctx)))));
      if (!owned) throw new Error("Nie znaleziono partii ubojowej");
      
      const [result] = await db.select().from(s.slaughterResults).where(eq(s.slaughterResults.slaughterBatchId, BigInt(input.slaughterBatchId)));
      if (!result) throw new Error("Brak wyników");

      const settlement = computeSettlement({
        carcassWeightKg: Number(result.carcassWeightKg), pricePerKg: input.pricePerKg,
        bonuses: input.bonuses, deductions: input.deductions,
      });

      const [{ id }] = await db.insert(s.slaughterSettlements).values({
        slaughterBatchId: BigInt(input.slaughterBatchId),
        pricePerKg: input.pricePerKg.toString(),
        grossAmount: settlement.grossAmount.toString(),
        bonuses: (input.bonuses || 0).toString(),
        deductions: (input.deductions || 0).toString(),
        netAmount: settlement.netAmount.toString(),
        currency: "PLN",
        documentNumber: input.documentNumber,
      }).$returningId();
      // To samo rozliczenie zasila P&L produkcji — dzięki temu przychód
      // z ubojni jest widoczny w module Ekonomia i na dashboardzie.
      await db.insert(s.sales).values({
        batchId: owned.batchId, day: new Date().toISOString().slice(0, 10),
        birdCount: result.carcassCount, totalWeightKg: result.carcassWeightKg,
        pricePerKg: (settlement.netAmount / Math.max(Number(result.carcassWeightKg), 1)).toFixed(3),
        currency: "PLN", buyer: "Ubojnia",
      });

      return { id, netAmount: settlement.netAmount };
    }),

  /* ------- dodaj klasę do słownika ------- */
  addClassDictEntry: publicQuery
    .input(z.object({ code: z.string(), label: z.string(), sortOrder: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.carcassClassDict).values({
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder ?? 0,
        companyId: ctx.companyId ? BigInt(ctx.companyId) : null,
      }).$returningId();
      return { id };
    }),

  /* ------- usuń klasę ze słownika ------- */
  removeClassDictEntry: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(s.carcassClassDict).where(eq(s.carcassClassDict.id, input.id));
      return { ok: true };
    }),

  /* ------- pełny scenariusz DEMO ------- */
  demoScenario: publicQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.companyId || !ctx.farmId) throw new Error("Brak danych firmy");

    // 1. Stwórz batch demo (jeśli nie istnieje)
    let batch = (await db.select().from(s.batches).where(and(
      eq(s.batches.companyId, BigInt(ctx.companyId)),
      eq(s.batches.farmId, BigInt(ctx.farmId)),
      s.batches.code.like('DEMO-%')
    )).limit(1))[0];

    if (!batch) {
      const demoCode = `DEMO-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      const [{ id: batchId }] = await db.insert(s.batches).values({
        code: demoCode,
        companyId: BigInt(ctx.companyId),
        farmId: BigInt(ctx.farmId),
        houseId: BigInt(1), // Default house
        geneticLine: "Ross 308",
        sex: "mixed",
        chickSupplier: "Hatchery Demo",
        chickPrice: "2.5",
        startDate: today,
        plannedEndDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        initialCount: 5000,
        currentCount: 5000,
        soldCount: 0,
        status: "active",
        updatedBy: "demo",
      }).$returningId();
      batch = { id: batchId, code: demoCode, batchId, companyId: ctx.companyId, farmId: ctx.farmId } as any;
    }

    // 2. Stwórz plan uboju
    const plannedDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [{ planId }] = await db.insert(s.slaughterPlans).values({
      code: `PLAN-${Date.now()}`,
      companyId: BigInt(ctx.companyId),
      farmId: BigInt(ctx.farmId),
      batchId: BigInt(batch.id),
      plannedDate,
      plannedCount: 4800,
      targetAvgWeightKg: "2.4",
      status: "planned",
    }).$returningId();

    // 3. Stwórz partię ubojową
    const code = `UB-${String(ctx.farmId).padStart(4, "0")}-${String(Date.now()).slice(-6)}`;
    const [{ id: sbId }] = await db.insert(s.slaughterBatches).values({
      code,
      planId: BigInt(planId),
      companyId: BigInt(ctx.companyId),
      farmId: BigInt(ctx.farmId),
      batchId: BigInt(batch.id),
      status: "created",
      isDemo: true,
    }).$returningId();

    // 4. Dodaj transport
    await db.insert(s.slaughterTransports).values({
      slaughterBatchId: BigInt(sbId),
      vehiclePlate: "WX1234A",
      driverName: "Jan Nowak",
      loadedCount: 4800,
      distanceKm: 45,
      transportCost: "450",
      deadInTransport: 12,
      status: "completed",
    });

    // 5. Przyjęcie
    const [{ recId }] = await db.insert(s.slaughterReceptions).values({
      slaughterBatchId: BigInt(sbId),
      receivedCount: 4788,
      deadOnArrival: 5,
      rejectedCount: 2,
      liveWeightKg: "11496",
    }).$returningId();

    // 6. Wynik uboju
    const yieldPct = (11304 / 11496) * 100;
    await db.insert(s.slaughterResults).values({
      slaughterBatchId: BigInt(sbId),
      carcassCount: 4786,
      carcassWeightKg: "11304",
      wasteKg: "145",
      byproductsKg: "47",
      yieldPct: yieldPct.toFixed(2),
      slaughteredAt: new Date(),
      meatWeightKg: "9043",
      deadCountReceived: 7,
    });

    // 7. Klasyfikacja
    await db.insert(s.slaughterClassifications).values({
      slaughterBatchId: BigInt(sbId),
      classCode: "A",
      count: 3832,
      weightKg: "9043",
    });

    // 8. Rozliczenie
    const netAmount = (11304 * 11.5) + 500 - 100;
    await db.insert(s.slaughterSettlements).values({
      slaughterBatchId: BigInt(sbId),
      pricePerKg: "11.50",
      grossAmount: (11304 * 11.5).toString(),
      bonuses: "500",
      deductions: "100",
      netAmount: netAmount.toString(),
      currency: "PLN",
      documentNumber: `FV-${Date.now()}`,
    });

    // 9. Update status partii
    await db.update(s.slaughterBatches).set({ status: "settled" }).where(eq(s.slaughterBatches.id, sbId));

    return { code, id: sbId };
  }),
});
