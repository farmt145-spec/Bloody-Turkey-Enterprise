/**
 * LINIE GENETYCZNE — wiele ras/linii z normami żywieniowymi per faza wieku.
 * Normy są współdzielone w obrębie firmy (spójność wartości odżywczych
 * całego chowu i układania pasz); firma może je edytować i dodawać własne linie.
 */
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { audit } from "./audit";
import { requireCompanyId } from "./tenant";


/* 6 faz wieku — wspólne z modelem żywienia */
export const PHASE_KEYS = ["prestarter", "starter", "grower1", "grower2", "finisher1", "finisher2"] as const;

/* Normy otwarte dla popularnych linii indyczych (wartości startowe do edycji).
   Nie są to normy oficjalne dostawców — to wartości robocze systemu. */
const DEFAULT_NORMS: Record<string, { proteinPct: number; energyKcal: number; lysinePct: number; methioninePct: number; feedPerBirdG: number; targetWeightG: number; dayFrom: number; dayTo: number }[]> = {
  "B.U.T. BIG 6": [
    { dayFrom: 0, dayTo: 14, proteinPct: 28.0, energyKcal: 2850, lysinePct: 1.70, methioninePct: 0.65, feedPerBirdG: 38, targetWeightG: 500 },
    { dayFrom: 15, dayTo: 35, proteinPct: 26.0, energyKcal: 2900, lysinePct: 1.55, methioninePct: 0.60, feedPerBirdG: 160, targetWeightG: 2100 },
    { dayFrom: 36, dayTo: 56, proteinPct: 23.5, energyKcal: 2950, lysinePct: 1.35, methioninePct: 0.54, feedPerBirdG: 320, targetWeightG: 5200 },
    { dayFrom: 57, dayTo: 77, proteinPct: 21.0, energyKcal: 3000, lysinePct: 1.15, methioninePct: 0.48, feedPerBirdG: 480, targetWeightG: 9500 },
    { dayFrom: 78, dayTo: 98, proteinPct: 18.5, energyKcal: 3050, lysinePct: 0.95, methioninePct: 0.42, feedPerBirdG: 620, targetWeightG: 14500 },
    { dayFrom: 99, dayTo: 140, proteinPct: 16.5, energyKcal: 3100, lysinePct: 0.80, methioninePct: 0.36, feedPerBirdG: 720, targetWeightG: 21000 },
  ],
  "B.U.T. 6": [
    { dayFrom: 0, dayTo: 14, proteinPct: 28.0, energyKcal: 2850, lysinePct: 1.70, methioninePct: 0.65, feedPerBirdG: 36, targetWeightG: 480 },
    { dayFrom: 15, dayTo: 35, proteinPct: 26.0, energyKcal: 2900, lysinePct: 1.55, methioninePct: 0.60, feedPerBirdG: 150, targetWeightG: 2000 },
    { dayFrom: 36, dayTo: 56, proteinPct: 23.0, energyKcal: 2950, lysinePct: 1.32, methioninePct: 0.53, feedPerBirdG: 300, targetWeightG: 5000 },
    { dayFrom: 57, dayTo: 77, proteinPct: 20.5, energyKcal: 3000, lysinePct: 1.12, methioninePct: 0.47, feedPerBirdG: 450, targetWeightG: 9000 },
    { dayFrom: 78, dayTo: 98, proteinPct: 18.0, energyKcal: 3050, lysinePct: 0.92, methioninePct: 0.41, feedPerBirdG: 580, targetWeightG: 13800 },
    { dayFrom: 99, dayTo: 140, proteinPct: 16.0, energyKcal: 3100, lysinePct: 0.78, methioninePct: 0.35, feedPerBirdG: 680, targetWeightG: 19500 },
  ],
  "NICHOLAS": [
    { dayFrom: 0, dayTo: 14, proteinPct: 28.5, energyKcal: 2820, lysinePct: 1.72, methioninePct: 0.66, feedPerBirdG: 37, targetWeightG: 490 },
    { dayFrom: 15, dayTo: 35, proteinPct: 26.5, energyKcal: 2880, lysinePct: 1.58, methioninePct: 0.61, feedPerBirdG: 155, targetWeightG: 2050 },
    { dayFrom: 36, dayTo: 56, proteinPct: 23.5, energyKcal: 2940, lysinePct: 1.36, methioninePct: 0.55, feedPerBirdG: 310, targetWeightG: 5100 },
    { dayFrom: 57, dayTo: 77, proteinPct: 21.0, energyKcal: 2990, lysinePct: 1.16, methioninePct: 0.48, feedPerBirdG: 465, targetWeightG: 9300 },
    { dayFrom: 78, dayTo: 98, proteinPct: 18.5, energyKcal: 3040, lysinePct: 0.96, methioninePct: 0.42, feedPerBirdG: 600, targetWeightG: 14200 },
    { dayFrom: 99, dayTo: 140, proteinPct: 16.5, energyKcal: 3090, lysinePct: 0.81, methioninePct: 0.36, feedPerBirdG: 700, targetWeightG: 20300 },
  ],
  "HYBRID CONVERTER": [
    { dayFrom: 0, dayTo: 14, proteinPct: 27.5, energyKcal: 2850, lysinePct: 1.65, methioninePct: 0.63, feedPerBirdG: 36, targetWeightG: 470 },
    { dayFrom: 15, dayTo: 35, proteinPct: 25.5, energyKcal: 2900, lysinePct: 1.50, methioninePct: 0.58, feedPerBirdG: 150, targetWeightG: 1980 },
    { dayFrom: 36, dayTo: 56, proteinPct: 23.0, energyKcal: 2950, lysinePct: 1.30, methioninePct: 0.52, feedPerBirdG: 300, targetWeightG: 4950 },
    { dayFrom: 57, dayTo: 77, proteinPct: 20.5, energyKcal: 3000, lysinePct: 1.10, methioninePct: 0.46, feedPerBirdG: 445, targetWeightG: 8900 },
    { dayFrom: 78, dayTo: 98, proteinPct: 18.0, energyKcal: 3050, lysinePct: 0.90, methioninePct: 0.40, feedPerBirdG: 570, targetWeightG: 13500 },
    { dayFrom: 99, dayTo: 140, proteinPct: 16.0, energyKcal: 3100, lysinePct: 0.76, methioninePct: 0.34, feedPerBirdG: 660, targetWeightG: 19000 },
  ],
  "HYBRID GRADE MAKER": [
    { dayFrom: 0, dayTo: 14, proteinPct: 28.0, energyKcal: 2830, lysinePct: 1.68, methioninePct: 0.64, feedPerBirdG: 37, targetWeightG: 485 },
    { dayFrom: 15, dayTo: 35, proteinPct: 26.0, energyKcal: 2890, lysinePct: 1.54, methioninePct: 0.59, feedPerBirdG: 152, targetWeightG: 2020 },
    { dayFrom: 36, dayTo: 56, proteinPct: 23.5, energyKcal: 2945, lysinePct: 1.34, methioninePct: 0.54, feedPerBirdG: 305, targetWeightG: 5050 },
    { dayFrom: 57, dayTo: 77, proteinPct: 21.0, energyKcal: 2995, lysinePct: 1.14, methioninePct: 0.47, feedPerBirdG: 455, targetWeightG: 9150 },
    { dayFrom: 78, dayTo: 98, proteinPct: 18.5, energyKcal: 3045, lysinePct: 0.94, methioninePct: 0.41, feedPerBirdG: 590, targetWeightG: 14000 },
    { dayFrom: 99, dayTo: 140, proteinPct: 16.5, energyKcal: 3095, lysinePct: 0.79, methioninePct: 0.35, feedPerBirdG: 690, targetWeightG: 19900 },
  ],
};

const normInput = z.object({
  phaseKey: z.enum(PHASE_KEYS),
  dayFrom: z.number().int().min(0), dayTo: z.number().int().min(0),
  proteinPct: z.number().min(0).max(60), energyKcal: z.number().int().min(0).max(4000),
  lysinePct: z.number().min(0).max(5), methioninePct: z.number().min(0).max(3),
  feedPerBirdG: z.number().int().min(0).default(0), targetWeightG: z.number().int().min(0).default(0),
});

export const geneticsRouter = createRouter({
  /** Linie aktywnej firmy + normy. Gdy firma nie ma linii — zakłada zestaw startowy (5 otwartych linii z normami). */
  lines: publicQuery.query(async ({ ctx }) => {
    const cid = requireCompanyId(ctx);
    const db = getDb();
    let lines = await db.select().from(s.geneticLines)
      .where(and(eq(s.geneticLines.companyId, cid), ne(s.geneticLines.status, "archived")));
    if (lines.length === 0) {
      for (const [name, norms] of Object.entries(DEFAULT_NORMS)) {
        const supplier = name.startsWith("B.U.T.") ? "Aviagen Turkeys" : name.startsWith("NICHOLAS") ? "Aviagen Turkeys" : "Hybrid Turkeys";
        const [{ id }] = await db.insert(s.geneticLines).values({
          companyId: cid, name, supplier,
          notes: "Linia startowa z normami otwartymi — edytuj wg zaleceń dostawcy",
        }).$returningId();
        for (let i = 0; i < norms.length; i++) {
          const n = norms[i];
          await db.insert(s.geneticLineNorms).values({
            geneticLineId: id, phaseKey: PHASE_KEYS[i],
            dayFrom: n.dayFrom, dayTo: n.dayTo, proteinPct: String(n.proteinPct),
            energyKcal: n.energyKcal, lysinePct: String(n.lysinePct), methioninePct: String(n.methioninePct),
            feedPerBirdG: n.feedPerBirdG, targetWeightG: n.targetWeightG,
          });
        }
      }
      lines = await db.select().from(s.geneticLines)
        .where(and(eq(s.geneticLines.companyId, cid), ne(s.geneticLines.status, "archived")));
      await audit("genetic_lines", 0, "create", { newValues: { seed: cid, count: lines.length } });
    }
    const norms = lines.length
      ? await db.select().from(s.geneticLineNorms)
          .where(sql`${s.geneticLineNorms.geneticLineId} IN (${sql.join(lines.map((l) => sql`${l.id}`), sql`, `)})`)
      : [];
    // uzupełnij brakujące normy dla istniejących linii (dopasowanie po nazwie)
    for (const l of lines) {
      if (norms.some((n) => n.geneticLineId === l.id)) continue;
      const key = Object.keys(DEFAULT_NORMS).find((k) =>
        l.name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()
          .includes(k.replace(/B\.U\.T\. /, "BUT ").toUpperCase()));
      if (!key) continue;
      const defs = DEFAULT_NORMS[key];
      for (let i = 0; i < defs.length; i++) {
        const n = defs[i];
        const [{ id: nid }] = await db.insert(s.geneticLineNorms).values({
          geneticLineId: l.id, phaseKey: PHASE_KEYS[i],
          dayFrom: n.dayFrom, dayTo: n.dayTo, proteinPct: String(n.proteinPct),
          energyKcal: n.energyKcal, lysinePct: String(n.lysinePct), methioninePct: String(n.methioninePct),
          feedPerBirdG: n.feedPerBirdG, targetWeightG: n.targetWeightG,
        }).$returningId();
        norms.push({ id: nid, geneticLineId: l.id, phaseKey: PHASE_KEYS[i], dayFrom: n.dayFrom, dayTo: n.dayTo,
          proteinPct: String(n.proteinPct), energyKcal: n.energyKcal, lysinePct: String(n.lysinePct),
          methioninePct: String(n.methioninePct), feedPerBirdG: n.feedPerBirdG, targetWeightG: n.targetWeightG,
          status: "active", createdAt: new Date(), updatedAt: new Date(), updatedBy: "system" } as any);
      }
    }
    return lines.map((l) => ({
      ...l,
      norms: norms.filter((n) => n.geneticLineId === l.id)
        .sort((a, b) => a.dayFrom - b.dayFrom),
    }));
  }),

  createLine: publicQuery
    .input(z.object({ name: z.string().min(2).max(128), supplier: z.string().max(255).optional(), notes: z.string().max(2000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      const [{ id }] = await getDb().insert(s.geneticLines).values({ ...input, companyId: cid }).$returningId();
      await audit("genetic_lines", id, "create", { newValues: input });
      return { id };
    }),

  updateNorms: publicQuery
    .input(z.object({ geneticLineId: z.number(), norms: z.array(normInput).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      const db = getDb();
      const [line] = await db.select().from(s.geneticLines)
        .where(and(eq(s.geneticLines.id, input.geneticLineId), eq(s.geneticLines.companyId, cid))).limit(1);
      if (!line) throw new Error("Linia nie należy do wybranej firmy.");
      await db.delete(s.geneticLineNorms).where(eq(s.geneticLineNorms.geneticLineId, input.geneticLineId));
      for (const n of input.norms) {
        await db.insert(s.geneticLineNorms).values({
          geneticLineId: input.geneticLineId, phaseKey: n.phaseKey, dayFrom: n.dayFrom, dayTo: n.dayTo,
          proteinPct: String(n.proteinPct), energyKcal: n.energyKcal,
          lysinePct: String(n.lysinePct), methioninePct: String(n.methioninePct),
          feedPerBirdG: n.feedPerBirdG, targetWeightG: n.targetWeightG,
        });
      }
      await audit("genetic_line_norms", input.geneticLineId, "update", { newValues: { norms: input.norms.length } });
      return { ok: true };
    }),

  removeNorm: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(s.geneticLineNorms).where(eq(s.geneticLineNorms.id, input.id));
      return { ok: true };
    }),

  archiveLine: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const cid = requireCompanyId(ctx);
      await getDb().update(s.geneticLines).set({ status: "archived" })
        .where(and(eq(s.geneticLines.id, input.id), eq(s.geneticLines.companyId, cid)));
      return { ok: true };
    }),
});
