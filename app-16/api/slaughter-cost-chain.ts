/**
 * SLAUGHTER COST CHAIN — pełny łańcuch kosztów od pisklaka do kg tuszki.
 * Łączy dane z: batches, costs, feedUsages, transports, slaughterResults, slaughterSettlements.
 */
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { computeFullCostChain, compareCostChains, type FullCostChain } from "./slaughter-calc";

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const slaughterCostChainRouter = createRouter({
  /** Pełny łańcuch kosztów dla JEDNEGO rzutu ubojowego */
  getCostChain: publicQuery
    .input(z.object({ slaughterBatchId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();

      // 1. Pobierz partię ubojową
      const [sb] = await db.select().from(s.slaughterBatches)
        .where(eq(s.slaughterBatches.id, input.slaughterBatchId)).limit(1);
      if (!sb) throw new Error("Nie znaleziono partii ubojowej");

      // 2. Pobierz rzut produkcyjny
      const [batch] = await db.select().from(s.batches)
        .where(eq(s.batches.id, sb.batchId)).limit(1);
      if (!batch) throw new Error("Nie znaleziono rzutu produkcyjnego");

      // 3. Pobierz wszystkie koszty rzutu
      const costs = await db.select().from(s.costs)
        .where(eq(s.costs.batchId, sb.batchId));

      const costsByCategory: Record<string, number> = {};
      for (const c of costs) {
        costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + num(c.amount);
      }

      // 4. Pobierz zużycie paszy
      const feedUsages = await db.select().from(s.feedUsages)
        .where(eq(s.feedUsages.batchId, sb.batchId));
      const totalFeedKg = feedUsages.reduce((a, f) => a + num(f.kg), 0);

      // 5. Pobierz transport
      const [transport] = await db.select().from(s.transports)
        .where(eq(s.transports.slaughterBatchId, input.slaughterBatchId)).limit(1);
      const transportCost = transport ? num(transport.transportCost) : 0;

      // 6. Pobierz wynik uboju
      const [result] = await db.select().from(s.slaughterResults)
        .where(eq(s.slaughterResults.slaughterBatchId, input.slaughterBatchId)).limit(1);

      // 7. Pobierz przyjęcie (żywiec)
      const [reception] = await db.select().from(s.slaughterReceptions)
        .where(eq(s.slaughterReceptions.slaughterBatchId, input.slaughterBatchId)).limit(1);

      // 8. Pobierz rozliczenie
      const [settlement] = await db.select().from(s.slaughterSettlements)
        .where(eq(s.slaughterSettlements.slaughterBatchId, input.slaughterBatchId)).limit(1);

      // 9. Pobierz cenę paszy (średnia z receptur)
      let feedPricePerTon = 400; // domyślna
      if (feedUsages.length > 0 && feedUsages[0].recipeId) {
        const [recipe] = await db.select().from(s.recipes)
          .where(eq(s.recipes.id, feedUsages[0].recipeId)).limit(1);
        if (recipe) feedPricePerTon = num(recipe.costPerTon);
      }

      // 10. Oblicz pełny łańcuch kosztów
      const costChain = computeFullCostChain({
        initialCount: batch.initialCount,
        currentCount: batch.currentCount,
        soldCount: batch.soldCount,
        chickPrice: num(batch.chickPrice),
        feedKg: totalFeedKg,
        feedPricePerTon,
        costsByCategory,
        slaughterFee: 0, // TODO: dodać pole slaughterFee do schematu
        transportCost,
        liveWeightKg: reception ? num(reception.liveWeightKg) : 0,
        carcassWeightKg: result ? num(result.carcassWeightKg) : 0,
        revenueNet: settlement ? num(settlement.netAmount) : null,
        currency: settlement?.currency ?? "PLN",
      });

      return {
        slaughterBatch: sb,
        batch,
        costChain,
        details: {
          costsCount: costs.length,
          feedUsagesCount: feedUsages.length,
          hasTransport: !!transport,
          hasResult: !!result,
          hasReception: !!reception,
          hasSettlement: !!settlement,
        },
      };
    }),

  /** Porównanie łańcuchów kosztów dla wielu partii */
  compareCostChains: publicQuery
    .input(z.object({ slaughterBatchIds: z.array(z.number()).min(1).max(50) }))
    .query(async ({ input }) => {
      const db = getDb();
      const chains: FullCostChain[] = [];

      for (const sbId of input.slaughterBatchIds) {
        const [sb] = await db.select().from(s.slaughterBatches)
          .where(eq(s.slaughterBatches.id, sbId)).limit(1);
        if (!sb) continue;

        const [batch] = await db.select().from(s.batches)
          .where(eq(s.batches.id, sb.batchId)).limit(1);
        if (!batch) continue;

        const costs = await db.select().from(s.costs)
          .where(eq(s.costs.batchId, sb.batchId));
        const costsByCategory: Record<string, number> = {};
        for (const c of costs) {
          costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + num(c.amount);
        }

        const feedUsages = await db.select().from(s.feedUsages)
          .where(eq(s.feedUsages.batchId, sb.batchId));
        const totalFeedKg = feedUsages.reduce((a, f) => a + num(f.kg), 0);

        const [transport] = await db.select().from(s.transports)
          .where(eq(s.transports.slaughterBatchId, sbId)).limit(1);

        const [result] = await db.select().from(s.slaughterResults)
          .where(eq(s.slaughterResults.slaughterBatchId, sbId)).limit(1);

        const [reception] = await db.select().from(s.slaughterReceptions)
          .where(eq(s.slaughterReceptions.slaughterBatchId, sbId)).limit(1);

        const [settlement] = await db.select().from(s.slaughterSettlements)
          .where(eq(s.slaughterSettlements.slaughterBatchId, sbId)).limit(1);

        let feedPricePerTon = 400;
        if (feedUsages.length > 0 && feedUsages[0].recipeId) {
          const [recipe] = await db.select().from(s.recipes)
            .where(eq(s.recipes.id, feedUsages[0].recipeId)).limit(1);
          if (recipe) feedPricePerTon = num(recipe.costPerTon);
        }

        chains.push(computeFullCostChain({
          initialCount: batch.initialCount,
          currentCount: batch.currentCount,
          soldCount: batch.soldCount,
          chickPrice: num(batch.chickPrice),
          feedKg: totalFeedKg,
          feedPricePerTon,
          costsByCategory,
          slaughterFee: 0,
          transportCost: transport ? num(transport.transportCost) : 0,
          liveWeightKg: reception ? num(reception.liveWeightKg) : 0,
          carcassWeightKg: result ? num(result.carcassWeightKg) : 0,
          revenueNet: settlement ? num(settlement.netAmount) : null,
          currency: settlement?.currency ?? "PLN",
        }));
      }

      return {
        chains,
        comparison: compareCostChains(chains),
      };
    }),

  /** Koszt kg żywca dla wszystkich partii w firmie (z filtrami) */
  getCompanyCostOverview: publicQuery
    .input(z.object({
      farmId: z.number().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      geneticLine: z.string().optional(),
      sex: z.enum(["toms", "hens"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      // Pobierz wszystkie partie ubojowe firmy
      let sbQuery = db.select().from(s.slaughterBatches)
        .where(eq(s.slaughterBatches.companyId, cid));

      const sbRows = await sbQuery;

      const chains: FullCostChain[] = [];
      const batchInfo: { id: number; code: string; geneticLine: string; sex: string; slaughteredAt: string | null }[] = [];

      for (const sb of sbRows) {
        // Filtry
        if (input.farmId && sb.farmId !== input.farmId) continue;

        const [batch] = await db.select().from(s.batches)
          .where(eq(s.batches.id, sb.batchId)).limit(1);
        if (!batch) continue;

        if (input.geneticLine && batch.geneticLine !== input.geneticLine) continue;
        if (input.sex && batch.sex !== input.sex) continue;

        // Filtr daty
        if (input.dateFrom || input.dateTo) {
          const [result] = await db.select().from(s.slaughterResults)
            .where(eq(s.slaughterResults.slaughterBatchId, sb.id)).limit(1);
          if (!result) continue;

          // TODO: dodać slaughteredAt do slaughterResults
          // Na razie używamy createdAt
          const d = new Date(result.createdAt);
          if (input.dateFrom && d < new Date(input.dateFrom)) continue;
          if (input.dateTo && d > new Date(input.dateTo)) continue;
        }

        // Pobierz dane i oblicz
        const costs = await db.select().from(s.costs)
          .where(eq(s.costs.batchId, sb.batchId));
        const costsByCategory: Record<string, number> = {};
        for (const c of costs) {
          costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + num(c.amount);
        }

        const feedUsages = await db.select().from(s.feedUsages)
          .where(eq(s.feedUsages.batchId, sb.batchId));
        const totalFeedKg = feedUsages.reduce((a, f) => a + num(f.kg), 0);

        const [transport] = await db.select().from(s.transports)
          .where(eq(s.transports.slaughterBatchId, sb.id)).limit(1);

        const [result] = await db.select().from(s.slaughterResults)
          .where(eq(s.slaughterResults.slaughterBatchId, sb.id)).limit(1);

        const [reception] = await db.select().from(s.slaughterReceptions)
          .where(eq(s.slaughterReceptions.slaughterBatchId, sb.id)).limit(1);

        const [settlement] = await db.select().from(s.slaughterSettlements)
          .where(eq(s.slaughterSettlements.slaughterBatchId, sb.id)).limit(1);

        let feedPricePerTon = 400;
        if (feedUsages.length > 0 && feedUsages[0].recipeId) {
          const [recipe] = await db.select().from(s.recipes)
            .where(eq(s.recipes.id, feedUsages[0].recipeId)).limit(1);
          if (recipe) feedPricePerTon = num(recipe.costPerTon);
        }

        chains.push(computeFullCostChain({
          initialCount: batch.initialCount,
          currentCount: batch.currentCount,
          soldCount: batch.soldCount,
          chickPrice: num(batch.chickPrice),
          feedKg: totalFeedKg,
          feedPricePerTon,
          costsByCategory,
          slaughterFee: 0,
          transportCost: transport ? num(transport.transportCost) : 0,
          liveWeightKg: reception ? num(reception.liveWeightKg) : 0,
          carcassWeightKg: result ? num(result.carcassWeightKg) : 0,
          revenueNet: settlement ? num(settlement.netAmount) : null,
          currency: settlement?.currency ?? "PLN",
        }));

        batchInfo.push({
          id: sb.id,
          code: sb.code,
          geneticLine: batch.geneticLine,
          sex: batch.sex,
          slaughteredAt: result?.createdAt?.toISOString().slice(0, 10) ?? null,
        });
      }

      return {
        chains,
        batchInfo,
        comparison: compareCostChains(chains),
        summary: {
          totalBatches: chains.length,
          totalCost: chains.reduce((a, c) => a + c.costs.total, 0),
          totalRevenue: chains.reduce((a, c) => a + (c.revenueNet ?? 0), 0),
          totalMargin: chains.reduce((a, c) => a + (c.margin ?? 0), 0),
          avgCostPerKgLive: chains.length > 0 
            ? chains.reduce((a, c) => a + c.costPerKgLive, 0) / chains.length 
            : 0,
          avgCostPerKgCarcass: chains.length > 0 
            ? chains.reduce((a, c) => a + c.costPerKgCarcass, 0) / chains.length 
            : 0,
          avgYieldPct: chains.length > 0 
            ? chains.reduce((a, c) => a + c.yieldPct, 0) / chains.length 
            : 0,
        },
      };
    }),
});
