import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { audit } from "./audit";
import { assertBatchAccess } from "./tenant";

const num = (v: unknown) => Number(v ?? 0);

export const dailyRouter = createRouter({
  /* lista dzienników rzutu */
  logs: publicQuery
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertBatchAccess(ctx, input.batchId);
      return getDb().select().from(s.dailyLogs)
        .where(eq(s.dailyLogs.batchId, input.batchId))
        .orderBy(asc(s.dailyLogs.day));
    }),

  /* upsert dziennego wpisu — zmiana liczby ptaków przelicza stan (Calculation Engine) */
  upsert: publicQuery
    .input(z.object({
      batchId: z.number(),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      mortality: z.number().int().min(0).default(0),
      culls: z.number().int().min(0).default(0),
      waterLiters: z.number().min(0).optional(),
      feedKg: z.number().min(0).optional(),
      tempC: z.number().min(-30).max(60).optional(),
      humidityPct: z.number().min(0).max(100).optional(),
      ammoniaPpm: z.number().min(0).max(200).optional(),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if ("batchId" in input && typeof (input as any).batchId === "number") {
        await assertBatchAccess(ctx, (input as any).batchId);
      }
      const db = getDb();
      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, input.batchId));
      if (!batch) throw new Error("Rzut nie istnieje");
      if (batch.status !== "active") throw new Error("Rzut jest zamknięty — wpisy zablokowane");
      if (input.mortality + input.culls > batch.currentCount)
        throw new Error(`Upadki + brakowania (${input.mortality + input.culls}) przekraczają stan stada (${batch.currentCount})`);

      const [existing] = await db.select().from(s.dailyLogs)
        .where(and(eq(s.dailyLogs.batchId, input.batchId), eq(s.dailyLogs.day, input.day)));

      await db.transaction(async (tx) => {
        const values = {
          batchId: input.batchId, day: input.day,
          mortality: input.mortality, culls: input.culls,
          waterLiters: input.waterLiters?.toFixed(1), feedKg: input.feedKg?.toFixed(1),
          tempC: input.tempC?.toFixed(1), humidityPct: input.humidityPct?.toFixed(1),
          ammoniaPpm: input.ammoniaPpm?.toFixed(1), note: input.note, updatedBy: "dziennik",
        };
        if (existing) {
          // korekta: różnica upadków wraca / schodzi ze stada
          const delta = (input.mortality + input.culls) - (existing.mortality + existing.culls);
          await tx.update(s.dailyLogs).set(values).where(eq(s.dailyLogs.id, existing.id));
          if (delta !== 0) {
            await tx.update(s.batches)
              .set({ currentCount: sql`${s.batches.currentCount} - ${delta}`, updatedBy: "dziennik" })
              .where(eq(s.batches.id, input.batchId));
          }
        } else {
          await tx.insert(s.dailyLogs).values(values);
          if (input.mortality + input.culls > 0) {
            await tx.update(s.batches)
              .set({ currentCount: sql`${s.batches.currentCount} - ${input.mortality + input.culls}`, updatedBy: "dziennik" })
              .where(eq(s.batches.id, input.batchId));
          }
        }
        // woda i pasza z dziennika trafiają do strumienia zużycia (feed_usages)
        if (input.feedKg && input.feedKg > 0 && !existing) {
          await tx.insert(s.feedUsages).values({ batchId: input.batchId, day: input.day, kg: input.feedKg.toFixed(1) });
        }
        if (input.mortality > 0 && !existing) {
          await tx.insert(s.mortalities).values({ batchId: input.batchId, day: input.day, count: input.mortality, cause: input.note ?? "dziennik" });
        }
      });
      await audit("daily_logs", existing?.id ?? input.batchId, existing ? "update" : "create", { newValues: input, author: "dziennik" });
      return { ok: true, updated: !!existing };
    }),

  /* statystyki rozbudowane — agregaty i wskaźniki z dziennika */
  stats: publicQuery
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertBatchAccess(ctx, input.batchId);
      const db = getDb();
      const logs = await db.select().from(s.dailyLogs)
        .where(eq(s.dailyLogs.batchId, input.batchId)).orderBy(asc(s.dailyLogs.day));
      const [batch] = await db.select().from(s.batches).where(eq(s.batches.id, input.batchId));
      if (!batch) return null;

      const totalMort = logs.reduce((a, l) => a + l.mortality, 0);
      const totalCulls = logs.reduce((a, l) => a + l.culls, 0);
      const totalWater = logs.reduce((a, l) => a + num(l.waterLiters), 0);
      const totalFeed = logs.reduce((a, l) => a + num(l.feedKg), 0);

      const lastW = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, input.batchId)).orderBy(sql`${s.weighings.dayAge} desc`).limit(1);
      const avgG = lastW[0]?.avgWeightG ?? 0;
      const biomassKg = (batch.currentCount * avgG) / 1000;

      // serie do wykresów + wskaźniki
      let cumMort = 0;
      const series = logs.map((l) => {
        cumMort += l.mortality + l.culls;
        const birds = batch.initialCount - cumMort;
        const waterPerBirdMl = birds > 0 && l.waterLiters ? (num(l.waterLiters) * 1000) / birds : null;
        const feedPerBirdG = birds > 0 && l.feedKg ? (num(l.feedKg) * 1000) / birds : null;
        const expectedWaterMl = avgG > 0 ? avgG * 0.18 : null; // norma ~1.8x paszy
        return {
          day: l.day, mortality: l.mortality, culls: l.culls, cumLoss: cumMort,
          water: num(l.waterLiters), feed: num(l.feedKg),
          waterPerBirdMl, feedPerBirdG,
          waterDeviationPct: waterPerBirdMl && expectedWaterMl ? ((waterPerBirdMl - expectedWaterMl) / expectedWaterMl) * 100 : null,
          tempC: l.tempC ? num(l.tempC) : null, humidityPct: l.humidityPct ? num(l.humidityPct) : null,
          ammoniaPpm: l.ammoniaPpm ? num(l.ammoniaPpm) : null,
        };
      });

      const daysWithData = Math.max(logs.filter((l) => l.waterLiters).length, 1);
      return {
        batch, logs: series,
        totals: {
          mortality: totalMort, culls: totalCulls, lossPct: (totalMort + totalCulls) / batch.initialCount * 100,
          waterLiters: totalWater, feedKg: totalFeed,
          avgWaterLitersDay: totalWater / daysWithData,
          biomassKg,
          feedPerKgBiomass: biomassKg > 0 ? totalFeed / biomassKg : 0,
        },
        // ostatni dzień — wskaźniki alarmowe
        latest: series.length ? series[series.length - 1] : null,
      };
    }),
});

/* ================= ROZBUDOWANE ŻYWIENIE ================= */

export const feedProgramRouter = createRouter({
  programs: publicQuery.query(async () => {
    const db = getDb();
    const [programs, stages, recipes] = await Promise.all([
      db.select().from(s.feedPrograms),
      db.select().from(s.feedProgramStages).orderBy(asc(s.feedProgramStages.dayFrom)),
      db.select().from(s.recipes),
    ]);
    return programs.map((p) => ({
      ...p,
      stages: stages.filter((x) => x.programId === p.id).map((x) => ({
        ...x, recipe: recipes.find((r) => r.id === x.recipeId) ?? null,
      })),
    }));
  }),

  createProgram: publicQuery
    .input(z.object({
      companyId: z.number(), name: z.string().min(2),
      sex: z.enum(["toms", "hens", "mixed"]),
      stages: z.array(z.object({
        name: z.string(), dayFrom: z.number().int().min(0), dayTo: z.number().int().min(1),
        recipeId: z.number().optional(), proteinTargetPct: z.number().optional(),
        energyTargetKcal: z.number().int().optional(), feedPerBirdG: z.number().int().optional(),
      })).min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.feedPrograms)
        .values({ companyId: input.companyId, name: input.name, sex: input.sex }).$returningId();
      for (const st of input.stages) {
        await db.insert(s.feedProgramStages).values({
          programId: id, name: st.name, dayFrom: st.dayFrom, dayTo: st.dayTo,
          recipeId: st.recipeId, proteinTargetPct: st.proteinTargetPct?.toFixed(2),
          energyTargetKcal: st.energyTargetKcal, feedPerBirdG: st.feedPerBirdG,
        });
      }
      await audit("feed_programs", id, "create", { newValues: input });
      return { id };
    }),

  /* wydanie paszy z silosu na rzut — odejmuje stan silosu, dodaje koszt */
  delivery: publicQuery
    .input(z.object({
      siloId: z.number(), batchId: z.number(), day: z.string(),
      kg: z.number().min(1), recipeId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [silo] = await db.select().from(s.silos).where(eq(s.silos.id, input.siloId));
      if (!silo) throw new Error("Silos nie istnieje");
      if (num(silo.currentTons) * 1000 < input.kg)
        throw new Error(`Za mało paszy w silosie: dostępne ${fmt(num(silo.currentTons) * 1000)} kg, żądane ${input.kg} kg`);
      await db.transaction(async (tx) => {
        await tx.update(s.silos)
          .set({ currentTons: ((num(silo.currentTons) * 1000 - input.kg) / 1000).toFixed(2) })
          .where(eq(s.silos.id, input.siloId));
        await tx.insert(s.feedDeliveries).values({
          siloId: input.siloId, batchId: input.batchId, day: input.day,
          kg: input.kg.toFixed(1), recipeId: input.recipeId ?? silo.recipeId,
        });
        await tx.insert(s.feedUsages).values({ batchId: input.batchId, day: input.day, kg: input.kg.toFixed(1), recipeId: input.recipeId ?? silo.recipeId });
      });
      await audit("feed_deliveries", input.siloId, "create", { newValues: input });
      return { ok: true };
    }),

  deliveries: publicQuery
    .input(z.object({ batchId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const [rows, silos, batches, recipes] = await Promise.all([
        input?.batchId
          ? db.select().from(s.feedDeliveries).where(eq(s.feedDeliveries.batchId, input.batchId))
          : db.select().from(s.feedDeliveries),
        db.select().from(s.silos),
        db.select().from(s.batches),
        db.select().from(s.recipes),
      ]);
      return rows.map((d) => ({
        ...d,
        silo: silos.find((x) => x.id === d.siloId) ?? null,
        batchCode: batches.find((b) => b.id === d.batchId)?.code ?? "?",
        recipe: recipes.find((r) => r.id === d.recipeId) ?? null,
      })).sort((a, b) => b.day.localeCompare(a.day));
    }),

  /* uzupełnienie silosu */
  refillSilo: publicQuery
    .input(z.object({ siloId: z.number(), tons: z.number().min(0.1), recipeId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [silo] = await db.select().from(s.silos).where(eq(s.silos.id, input.siloId));
      if (!silo) throw new Error("Silos nie istnieje");
      const newTons = num(silo.currentTons) + input.tons;
      if (newTons > num(silo.capacityTons)) throw new Error(`Przekroczenie pojemności silosu (${num(silo.capacityTons)} t)`);
      await db.update(s.silos).set({
        currentTons: newTons.toFixed(2),
        ...(input.recipeId ? { recipeId: input.recipeId } : {}),
      }).where(eq(s.silos.id, input.siloId));
      await audit("silos", input.siloId, "update", { newValues: { refillTons: input.tons } });
      return { ok: true, currentTons: newTons };
    }),
});

function fmt(n: number) { return n.toLocaleString("pl-PL", { maximumFractionDigits: 0 }); }
