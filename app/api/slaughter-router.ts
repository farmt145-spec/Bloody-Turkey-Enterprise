import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and } from "drizzle-orm";

export const slaughterRouter = createRouter({
  /* ------- koszty end-to-end: batch → ubój ------- */
  getBatchCosts: publicQuery
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const batchId = input.batchId;

      // 1. Pobierz batch — inicjalny koszt pisklaka
      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, batchId));
      if (!batch) throw new Error("Batch nie istnieje");

      // 2. Koszt pisklaka
      const chicksCount = batch.count ?? 0;
      const chicksPrice = batch.chicksPrice ?? 0;
      const chicks_cost = chicksCount * chicksPrice;

      // 3. Koszty paszy — suma z feedRecords
      const feedRecords = await db.select().from(s.feedRecords).where(eq(s.feedRecords.batchId, batchId));
      const feed_cost = feedRecords.reduce((sum, f) => sum + (parseFloat(f.totalCost?.toString() || "0")), 0);

      // 4. Koszty leczenia
      const treatmentRecords = await db.select().from(s.treatmentRecords).where(eq(s.treatmentRecords.batchId, batchId));
      const treatment_cost = treatmentRecords.reduce((sum, t) => sum + (parseFloat(t.cost?.toString() || "0")), 0);

      // 5. Ubojnia — wyniki i waga sprzedaży
      const [slaughterPlan] = await db.select().from(s.slaughterPlans).where(eq(s.slaughterPlans.batchId, batchId));
      const slaughterBatches = await db.select().from(s.slaughterBatches).where(eq(s.slaughterBatches.batchId, batchId));
      
      let slaughter_cost = 0;
      let meatWeightKg = 0;
      let mortality = 0;

      if (slaughterBatches.length > 0) {
        const sb = slaughterBatches[0];
        // Pobierz wyniki ubojni
        const results = await db.select().from(s.slaughterResults).where(eq(s.slaughterResults.slaughterBatchId, BigInt(sb.id)));
        if (results.length > 0) {
          const r = results[0];
          meatWeightKg = parseFloat(r.meatWeightKg?.toString() || "0");
          const deadCount = parseInt(r.deadCountReceived?.toString() || "0");
          mortality = chicksCount > 0 ? (deadCount / chicksCount) * 100 : 0;
        }
        // Koszty ubojni — transportu, ubojni, klasyfikacji
        slaughter_cost = batch.transportCost ?? 0;
      }

      const total_cost = chicks_cost + feed_cost + treatment_cost + slaughter_cost;
      const cost_per_kg = meatWeightKg > 0 ? total_cost / meatWeightKg : 0;

      return {
        batchId,
        chicksCount,
        chicks_cost,
        feed_cost,
        treatment_cost,
        slaughter_cost,
        total_cost,
        meatWeightKg,
        cost_per_kg: parseFloat(cost_per_kg.toFixed(2)),
        mortality: parseFloat(mortality.toFixed(2)),
      };
    }),

  /* ------- pełna ścieżka batch (dla Dashboard) ------- */
  getBatchJourney: publicQuery
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const batchId = input.batchId;

      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, batchId));
      if (!batch) return null;

      const costs = await db.execute(`
        SELECT 
          b.id, b.code, b.chicksPrice, b.count, b.transportCost,
          COALESCE(SUM(CASE WHEN type='feed' THEN cost ELSE 0 END), 0) as feed_cost,
          COALESCE(SUM(CASE WHEN type='treatment' THEN cost ELSE 0 END), 0) as treatment_cost,
          (SELECT COALESCE(SUM(meatWeightKg), 0) FROM slaughter_results sr 
            WHERE sr.slaughterBatchId IN (SELECT id FROM slaughter_batches WHERE batchId = b.id)) as meat_weight_kg
        FROM batches b
        LEFT JOIN costs c ON c.batchId = b.id
        WHERE b.id = ?
      `, [batchId]);

      return {
        batch,
        stage: batch.status,
        days: Math.floor((Date.now() - new Date(batch.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      };
    }),
});
