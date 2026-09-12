import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and, desc, sql, gt, or, like } from "drizzle-orm";
import { audit } from "./audit";

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
      const [batch] = await db.select().from(s.slaughterBatches).where(eq(s.slaughterBatches.id, input.id));
      if (!batch) return null;

      const [plan] = await db.select().from(s.slaughterPlans).where(eq(s.slaughterPlans.id, BigInt(batch.id)));
      const [prod] = batch.batchId ? await db.select().from(s.batches).where(eq(s.batches.id, batch.batchId)) : [null];
      const farm = batch.farmId ? (await db.select().from(s.farms).where(eq(s.farms.id, batch.farmId)))[0] : null;
      const house = prod?.houseId ? (await db.select().from(s.houses).where(eq(s.houses.id, prod.houseId)))[0] : null;
      
      const transports = await db.select().from(s.slaughterTransports).where(eq(s.slaughterTransports.slaughterBatchId, BigInt(batch.id)));
      const [reception] = await db.select().from(s.slaughterReceptions).where(eq(s.slaughterReceptions.slaughterBatchId, BigInt(batch.id)));
      const [result] = await db.select().from(s.slaughterResults).where(eq(s.slaughterResults.slaughterBatchId, BigInt(batch.id)));
      const classifications = await db.select().from(s.slaughterClassifications).where(eq(s.slaughterClassifications.slaughterBatchId, BigInt(batch.id)));
      const [settlement] = await db.select().from(s.slaughterSettlements).where(eq(s.slaughterSettlements.slaughterBatchId, BigInt(batch.id)));
      const events = await db.select().from(s.slaughterEvents).where(eq(s.slaughterEvents.slaughterBatchId, BigInt(batch.id))).orderBy(desc(s.slaughterEvents.createdAt));

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
        planVsReality: result && reception && plan ? {
          countPct: plan.plannedCount ? Math.round((reception.receivedCount / plan.plannedCount) * 100) : null,
          avgLiveWeightKg: reception.receivedCount ? (parseFloat(reception.liveWeightKg?.toString() || "0") / reception.receivedCount).toFixed(2) : null,
          weightTargetDiff: plan.targetAvgWeightKg ? (parseFloat(reception.liveWeightKg?.toString() || "0") / reception.receivedCount - parseFloat(plan.targetAvgWeightKg.toString())).toFixed(2) : null,
          yieldPct: result.yieldPct,
          daysVsPlan: Math.floor((new Date(result.slaughteredAt || new Date()).getTime() - new Date(plan.plannedDate).getTime()) / 86400000),
        } : null,
        economics: result && reception ? {
          chickCost: (prod?.chicksPrice || 0) * (prod?.count || 0),
          feedCost: 0, // TODO: sum from production
          transportCost: transports.reduce((a, t) => a + (parseFloat(t.transportCost?.toString() || "0")), 0),
          totalCost: (prod?.chicksPrice || 0) * (prod?.count || 0) + transports.reduce((a, t) => a + (parseFloat(t.transportCost?.toString() || "0")), 0),
          revenueNet: settlement?.netAmount ? parseFloat(settlement.netAmount.toString()) : null,
          margin: settlement ? parseFloat(settlement.netAmount?.toString() || "0") - ((prod?.chicksPrice || 0) * (prod?.count || 0)) : null,
          roiPct: settlement ? Math.round(((parseFloat(settlement.netAmount?.toString() || "0") - ((prod?.chicksPrice || 0) * (prod?.count || 0))) / ((prod?.chicksPrice || 0) * (prod?.count || 0))) * 100) : null,
          costPerKgLive: reception.liveWeightKg ? ((prod?.chicksPrice || 0) * (prod?.count || 0)) / parseFloat(reception.liveWeightKg.toString()) : null,
        } : null,
        avgFeedPricePerTon: 2800,
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
    return db.select().from(s.slaughterClassDict)
      .where(ctx.companyId ? or(eq(s.slaughterClassDict.companyId, BigInt(ctx.companyId)), eq(s.slaughterClassDict.companyId, null)) : undefined)
      .orderBy(s.slaughterClassDict.sortOrder);
  }),

  /* ------- tworzenie partii ubojowej ------- */
  createBatch: publicQuery
    .input(z.object({ batchId: z.number(), plannedDate: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (!ctx.companyId || !ctx.farmId) throw new Error("Brak farmId");

      const code = `UB-${String(ctx.farmId).padStart(4, "0")}-${String(Date.now()).slice(-6)}`;
      const [{ id }] = await db.insert(s.slaughterBatches).values({
        code,
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

      const [{ id }] = await db.insert(s.slaughterPlans).values({
        companyId: BigInt(ctx.companyId),
        farmId: BigInt(ctx.farmId),
        batchId: BigInt(input.batchId),
        plannedDate: input.plannedDate,
        plannedCount: input.plannedCount,
        targetAvgWeightKg: input.targetAvgWeightKg || null,
        status: "planned",
        notes: input.notes,
      }).$returningId();

      return { id };
    }),

  /* ------- transport ------- */
  addTransport: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), vehiclePlate: z.string(), driverName: z.string(), loadedCount: z.number(), distanceKm: z.number().optional(), transportCost: z.number(), deadInTransport: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.slaughterTransports).values({
        slaughterBatchId: BigInt(input.slaughterBatchId),
        vehiclePlate: input.vehiclePlate,
        driverName: input.driverName,
        loadedCount: input.loadedCount,
        distanceKm: input.distanceKm,
        transportCost: input.transportCost,
        deadInTransport: input.deadInTransport,
        status: "completed",
      }).$returningId();
      return { id };
    }),

  /* ------- przyjęcie ------- */
  addReception: publicQuery
    .input(z.object({ slaughterBatchId: z.number(), receivedCount: z.number(), liveWeightKg: z.number(), deadOnArrival: z.number().optional(), rejectedCount: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
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
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const [reception] = await db.select().from(s.slaughterReceptions).where(eq(s.slaughterReceptions.slaughterBatchId, BigInt(input.slaughterBatchId)));
      if (!reception) throw new Error("Brak przyjęcia");

      const yieldPct = reception.liveWeightKg ? Math.round((input.carcassWeightKg / parseFloat(reception.liveWeightKg.toString())) * 10000) / 100 : 0;

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
    .mutation(async ({ input }) => {
      const db = getDb();
      
      await db.delete(s.slaughterClassifications).where(eq(s.slaughterClassifications.slaughterBatchId, BigInt(input.slaughterBatchId)));
      
      for (const row of input.rows) {
        await db.insert(s.slaughterClassifications).values({
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
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const [result] = await db.select().from(s.slaughterResults).where(eq(s.slaughterResults.slaughterBatchId, BigInt(input.slaughterBatchId)));
      if (!result) throw new Error("Brak wyników");

      const carcassWeightKg = parseFloat(result.carcassWeightKg?.toString() || "0");
      const gross = carcassWeightKg * input.pricePerKg;
      const net = gross + (input.bonuses || 0) - (input.deductions || 0);

      const [{ id }] = await db.insert(s.slaughterSettlements).values({
        slaughterBatchId: BigInt(input.slaughterBatchId),
        pricePerKg: input.pricePerKg,
        grossAmount: gross.toString(),
        bonuses: (input.bonuses || 0).toString(),
        deductions: (input.deductions || 0).toString(),
        netAmount: net.toString(),
        currency: "PLN",
        documentNumber: input.documentNumber,
      }).$returningId();

      return { id, netAmount: net };
    }),

  /* ------- dodaj klasę do słownika ------- */
  addClassDictEntry: publicQuery
    .input(z.object({ code: z.string(), label: z.string(), sortOrder: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.slaughterClassDict).values({
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
      await db.delete(s.slaughterClassDict).where(eq(s.slaughterClassDict.id, input.id));
      return { ok: true };
    }),

  /* ------- pełny scenariusz DEMO ------- */
  demoScenario: publicQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.companyId || !ctx.farmId) throw new Error("Brak danych firmy");

    // 1. Find first house for this farm
    const [house] = await db.select().from(s.houses).where(eq(s.houses.farmId, BigInt(ctx.farmId))).limit(1);
    const houseId = house?.id || BigInt(1);

    // 2. Stwórz batch demo
    const demoCode = `DEMO-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const [{ id: batchId }] = await db.insert(s.batches).values({
      code: demoCode,
      houseId,
      geneticLine: "Ross 308",
      sex: "mixed",
      chickSupplier: "Hatchery Demo",
      chickPrice: 2.5,
      startDate: today,
      plannedEndDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      initialCount: 5000,
      currentCount: 5000,
      soldCount: 0,
      status: "active",
      updatedBy: "demo",
    }).$returningId();

    // 3. Stwórz plan uboju
    const plannedDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [{ id: planId }] = await db.insert(s.slaughterPlans).values({
      companyId: BigInt(ctx.companyId),
      farmId: BigInt(ctx.farmId),
      batchId: BigInt(batchId),
      plannedDate,
      plannedCount: 4800,
      targetAvgWeightKg: 2.4,
      status: "planned",
    }).$returningId();

    // 4. Stwórz partię ubojową
    const code = `UB-${String(ctx.farmId).padStart(4, "0")}-${String(Date.now()).slice(-6)}`;
    const [{ id: sbId }] = await db.insert(s.slaughterBatches).values({
      code,
      companyId: BigInt(ctx.companyId),
      farmId: BigInt(ctx.farmId),
      batchId: BigInt(batchId),
      status: "created",
      isDemo: true,
    }).$returningId();

    // 5. Dodaj transport
    await db.insert(s.slaughterTransports).values({
      slaughterBatchId: BigInt(sbId),
      vehiclePlate: "WX1234A",
      driverName: "Jan Nowak",
      loadedCount: 4800,
      distanceKm: 45,
      transportCost: 450,
      deadInTransport: 12,
      status: "completed",
    });

    // 6. Przyjęcie
    await db.insert(s.slaughterReceptions).values({
      slaughterBatchId: BigInt(sbId),
      receivedCount: 4788,
      deadOnArrival: 5,
      rejectedCount: 2,
      liveWeightKg: "11496",
    });

    // 7. Wynik uboju
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

    // 8. Klasyfikacja
    await db.insert(s.slaughterClassifications).values({
      slaughterBatchId: BigInt(sbId),
      classCode: "A",
      count: 3832,
      weightKg: "9043",
    });

    // 9. Rozliczenie
    const netAmount = (11304 * 11.5) + 500 - 100;
    await db.insert(s.slaughterSettlements).values({
      slaughterBatchId: BigInt(sbId),
      pricePerKg: 11.50,
      grossAmount: (11304 * 11.5).toString(),
      bonuses: "500",
      deductions: "100",
      netAmount: netAmount.toString(),
      currency: "PLN",
      documentNumber: `FV-${Date.now()}`,
    });

    // 10. Update status partii
    await db.update(s.slaughterBatches).set({ status: "settled" }).where(eq(s.slaughterBatches.id, sbId));

    return { code, id: sbId };
  }),
});

