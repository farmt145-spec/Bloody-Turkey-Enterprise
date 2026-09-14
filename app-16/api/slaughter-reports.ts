/**
 * SLAUGHTER REPORTS — eksport PDF i Excel raportów kosztów uboju.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { computeFullCostChain, type FullCostChain } from "./slaughter-calc";

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const slaughterReportsRouter = createRouter({
  /** Eksport CSV — wszystkie partie z rozbiciem kosztów */
  exportCsv: publicQuery
    .input(z.object({
      slaughterBatchIds: z.array(z.number()).min(1).max(100),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows: string[] = [];

      // Header CSV
      rows.push([
        "Kod partii", "Linia genetyczna", "Płeć",
        "Pisklęta (szt)", "Sprzedane (szt)", "Padłe (szt)",
        "Masa żywa (kg)", "Masa tuszek (kg)", "Wydajność (%)",
        "Koszt piskląt", "Koszt paszy", "Koszt weterynarii", "Koszt energii",
        "Koszt ściółki", "Koszt robocizny", "Koszt transportu", "Koszt uboju",
        "Koszt inne", "Koszt całkowity",
        "Koszt/kg żywca", "Koszt/kg tuszki", "Koszt/sztuka",
        "Przychód netto", "Marża", "Marża (%)",
        "FCR", "EPEF", "Waluta"
      ].join(";"));

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

        const chain = computeFullCostChain({
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
        });

        rows.push([
          sb.code,
          batch.geneticLine,
          batch.sex === "toms" ? "Indor" : "Indyczka",
          chain.initialCount,
          chain.soldCount,
          chain.deadCount,
          chain.liveWeightKg.toFixed(1),
          chain.carcassWeightKg.toFixed(1),
          chain.yieldPct.toFixed(2),
          chain.costs.chicks.toFixed(2),
          chain.costs.feed.toFixed(2),
          chain.costs.vet.toFixed(2),
          chain.costs.energy.toFixed(2),
          chain.costs.litter.toFixed(2),
          chain.costs.labor.toFixed(2),
          chain.costs.transport.toFixed(2),
          chain.costs.slaughter.toFixed(2),
          chain.costs.other.toFixed(2),
          chain.costs.total.toFixed(2),
          chain.costPerKgLive.toFixed(2),
          chain.costPerKgCarcass.toFixed(2),
          chain.costPerBird.toFixed(2),
          chain.revenueNet?.toFixed(2) ?? "",
          chain.margin?.toFixed(2) ?? "",
          chain.marginPct?.toFixed(1) ?? "",
          chain.fcr?.toFixed(2) ?? "",
          chain.epef?.toFixed(1) ?? "",
          chain.currency,
        ].join(";"));
      }

      return {
        filename: `slaughter-costs-${new Date().toISOString().slice(0,10)}.csv`,
        content: rows.join("\n"),
        mimeType: "text/csv; charset=utf-8",
      };
    }),

  /** Eksport JSON — pełne dane dla własnej analizy */
  exportJson: publicQuery
    .input(z.object({
      slaughterBatchIds: z.array(z.number()).min(1).max(100),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const data: any[] = [];

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

        const chain = computeFullCostChain({
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
        });

        data.push({
          slaughterBatch: sb,
          batch,
          costChain: chain,
        });
      }

      return {
        filename: `slaughter-costs-${new Date().toISOString().slice(0,10)}.json`,
        content: JSON.stringify(data, null, 2),
        mimeType: "application/json",
      };
    }),

  /** Trend kosztów w czasie — dla wykresu */
  getCostTrend: publicQuery
    .input(z.object({
      months: z.number().min(1).max(24).default(12),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      // Pobierz wszystkie partie ubojowe firmy
      const sbRows = await db.select().from(s.slaughterBatches)
        .where(eq(s.slaughterBatches.companyId, cid));

      // Grupuj po miesiącu
      const monthlyData: Record<string, {
        month: string;
        batches: number;
        totalCost: number;
        totalRevenue: number;
        totalLiveWeight: number;
        totalCarcassWeight: number;
        avgCostPerKgLive: number;
        avgCostPerKgCarcass: number;
        avgYieldPct: number;
      }> = {};

      for (const sb of sbRows) {
        const [result] = await db.select().from(s.slaughterResults)
          .where(eq(s.slaughterResults.slaughterBatchId, sb.id)).limit(1);
        if (!result) continue;

        const month = result.createdAt.toISOString().slice(0, 7); // YYYY-MM

        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            batches: 0,
            totalCost: 0,
            totalRevenue: 0,
            totalLiveWeight: 0,
            totalCarcassWeight: 0,
            avgCostPerKgLive: 0,
            avgCostPerKgCarcass: 0,
            avgYieldPct: 0,
          };
        }

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
          .where(eq(s.transports.slaughterBatchId, sb.id)).limit(1);

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

        const chain = computeFullCostChain({
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
        });

        monthlyData[month].batches++;
        monthlyData[month].totalCost += chain.costs.total;
        monthlyData[month].totalRevenue += chain.revenueNet ?? 0;
        monthlyData[month].totalLiveWeight += chain.liveWeightKg;
        monthlyData[month].totalCarcassWeight += chain.carcassWeightKg;
      }

      // Oblicz średnie
      const trend = Object.values(monthlyData).map(m => ({
        ...m,
        avgCostPerKgLive: m.totalLiveWeight > 0 ? m.totalCost / m.totalLiveWeight : 0,
        avgCostPerKgCarcass: m.totalCarcassWeight > 0 ? m.totalCost / m.totalCarcassWeight : 0,
        avgYieldPct: m.totalLiveWeight > 0 ? (m.totalCarcassWeight / m.totalLiveWeight) * 100 : 0,
      })).sort((a, b) => a.month.localeCompare(b.month));

      // Ogranicz do ostatnich N miesięcy
      const limited = trend.slice(-input.months);

      return {
        trend: limited,
        summary: {
          months: limited.length,
          avgCostPerKgLive: limited.length > 0 
            ? limited.reduce((a, m) => a + m.avgCostPerKgLive, 0) / limited.length 
            : 0,
          avgCostPerKgCarcass: limited.length > 0 
            ? limited.reduce((a, m) => a + m.avgCostPerKgCarcass, 0) / limited.length 
            : 0,
          avgYieldPct: limited.length > 0 
            ? limited.reduce((a, m) => a + m.avgYieldPct, 0) / limited.length 
            : 0,
          totalBatches: limited.reduce((a, m) => a + m.batches, 0),
        },
      };
    }),
});
