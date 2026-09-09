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


/* 8 faz wieku — wspólne z modelem żywienia (3 startery: Starter 1/2/3).
   "starter" pozostaje jako alias wsteczny → starter2. */
export const PHASE_KEYS = ["prestarter", "starter1", "starter2", "grower1", "grower2", "finisher1", "finisher2"] as const;

/* Normy otwarte dla popularnych linii indyczych (wartości startowe do edycji).
   Nie są to normy oficjalne dostawców — to wartości robocze systemu. */
const DEFAULT_NORMS: Record<string, { proteinPct: number; energyKcal: number; lysinePct: number; methioninePct: number; feedPerBirdG: number; targetWeightG: number; dayFrom: number; dayTo: number }[]> = {
  "B.U.T. BIG 6": [
    { dayFrom: 0, dayTo: 7, proteinPct: 28.5, energyKcal: 2820, lysinePct: 1.75, methioninePct: 0.66, feedPerBirdG: 22, targetWeightG: 250 },
    { dayFrom: 8, dayTo: 14, proteinPct: 27.5, energyKcal: 2880, lysinePct: 1.65, methioninePct: 0.63, feedPerBirdG: 55, targetWeightG: 500 },
    { dayFrom: 15, dayTo: 21, proteinPct: 26.0, energyKcal: 2900, lysinePct: 1.55, methioninePct: 0.60, feedPerBirdG: 110, targetWeightG: 1100 },
    { dayFrom: 22, dayTo: 56, proteinPct: 23.0, energyKcal: 2950, lysinePct: 1.32, methioninePct: 0.53, feedPerBirdG: 320, targetWeightG: 5200 },
    { dayFrom: 57, dayTo: 84, proteinPct: 20.5, energyKcal: 3020, lysinePct: 1.12, methioninePct: 0.47, feedPerBirdG: 500, targetWeightG: 10800 },
    { dayFrom: 85, dayTo: 112, proteinPct: 18.0, energyKcal: 3080, lysinePct: 0.93, methioninePct: 0.41, feedPerBirdG: 650, targetWeightG: 17000 },
    { dayFrom: 113, dayTo: 140, proteinPct: 16.5, energyKcal: 3120, lysinePct: 0.80, methioninePct: 0.36, feedPerBirdG: 740, targetWeightG: 21000 },
  ],
  "B.U.T. 6": [
    { dayFrom: 0, dayTo: 7, proteinPct: 28.5, energyKcal: 2820, lysinePct: 1.75, methioninePct: 0.66, feedPerBirdG: 21, targetWeightG: 240 },
    { dayFrom: 8, dayTo: 14, proteinPct: 27.5, energyKcal: 2880, lysinePct: 1.65, methioninePct: 0.63, feedPerBirdG: 52, targetWeightG: 480 },
    { dayFrom: 15, dayTo: 21, proteinPct: 26.0, energyKcal: 2900, lysinePct: 1.55, methioninePct: 0.60, feedPerBirdG: 105, targetWeightG: 1050 },
    { dayFrom: 22, dayTo: 56, proteinPct: 22.5, energyKcal: 2950, lysinePct: 1.30, methioninePct: 0.52, feedPerBirdG: 300, targetWeightG: 5000 },
    { dayFrom: 57, dayTo: 84, proteinPct: 20.0, energyKcal: 3020, lysinePct: 1.10, methioninePct: 0.46, feedPerBirdG: 470, targetWeightG: 10300 },
    { dayFrom: 85, dayTo: 112, proteinPct: 17.5, energyKcal: 3080, lysinePct: 0.90, methioninePct: 0.40, feedPerBirdG: 610, targetWeightG: 16200 },
    { dayFrom: 113, dayTo: 140, proteinPct: 16.0, energyKcal: 3120, lysinePct: 0.78, methioninePct: 0.35, feedPerBirdG: 700, targetWeightG: 19500 },
  ],
  "NICHOLAS": [
    { dayFrom: 0, dayTo: 7, proteinPct: 29.0, energyKcal: 2800, lysinePct: 1.77, methioninePct: 0.67, feedPerBirdG: 22, targetWeightG: 245 },
    { dayFrom: 8, dayTo: 14, proteinPct: 28.0, energyKcal: 2860, lysinePct: 1.67, methioninePct: 0.64, feedPerBirdG: 54, targetWeightG: 490 },
    { dayFrom: 15, dayTo: 21, proteinPct: 26.5, energyKcal: 2880, lysinePct: 1.58, methioninePct: 0.61, feedPerBirdG: 108, targetWeightG: 1080 },
    { dayFrom: 22, dayTo: 56, proteinPct: 23.0, energyKcal: 2940, lysinePct: 1.33, methioninePct: 0.54, feedPerBirdG: 310, targetWeightG: 5100 },
    { dayFrom: 57, dayTo: 84, proteinPct: 20.5, energyKcal: 3010, lysinePct: 1.13, methioninePct: 0.47, feedPerBirdG: 485, targetWeightG: 10600 },
    { dayFrom: 85, dayTo: 112, proteinPct: 18.0, energyKcal: 3070, lysinePct: 0.94, methioninePct: 0.41, feedPerBirdG: 630, targetWeightG: 16600 },
    { dayFrom: 113, dayTo: 140, proteinPct: 16.5, energyKcal: 3110, lysinePct: 0.81, methioninePct: 0.36, feedPerBirdG: 720, targetWeightG: 20300 },
  ],
  "HYBRID CONVERTER": [
    { dayFrom: 0, dayTo: 7, proteinPct: 28.0, energyKcal: 2830, lysinePct: 1.70, methioninePct: 0.64, feedPerBirdG: 21, targetWeightG: 235 },
    { dayFrom: 8, dayTo: 14, proteinPct: 27.0, energyKcal: 2880, lysinePct: 1.60, methioninePct: 0.61, feedPerBirdG: 52, targetWeightG: 470 },
    { dayFrom: 15, dayTo: 21, proteinPct: 25.5, energyKcal: 2900, lysinePct: 1.50, methioninePct: 0.58, feedPerBirdG: 104, targetWeightG: 1040 },
    { dayFrom: 22, dayTo: 56, proteinPct: 22.5, energyKcal: 2950, lysinePct: 1.28, methioninePct: 0.51, feedPerBirdG: 300, targetWeightG: 4950 },
    { dayFrom: 57, dayTo: 84, proteinPct: 20.0, energyKcal: 3020, lysinePct: 1.08, methioninePct: 0.45, feedPerBirdG: 465, targetWeightG: 10200 },
    { dayFrom: 85, dayTo: 112, proteinPct: 17.5, energyKcal: 3070, lysinePct: 0.88, methioninePct: 0.39, feedPerBirdG: 600, targetWeightG: 15900 },
    { dayFrom: 113, dayTo: 140, proteinPct: 16.0, energyKcal: 3120, lysinePct: 0.76, methioninePct: 0.34, feedPerBirdG: 680, targetWeightG: 19000 },
  ],
  "HYBRID GRADE MAKER": [
    { dayFrom: 0, dayTo: 7, proteinPct: 28.5, energyKcal: 2810, lysinePct: 1.73, methioninePct: 0.65, feedPerBirdG: 22, targetWeightG: 242 },
    { dayFrom: 8, dayTo: 14, proteinPct: 27.5, energyKcal: 2870, lysinePct: 1.63, methioninePct: 0.62, feedPerBirdG: 53, targetWeightG: 485 },
    { dayFrom: 15, dayTo: 21, proteinPct: 26.0, energyKcal: 2890, lysinePct: 1.54, methioninePct: 0.59, feedPerBirdG: 106, targetWeightG: 1060 },
    { dayFrom: 22, dayTo: 56, proteinPct: 23.0, energyKcal: 2945, lysinePct: 1.31, methioninePct: 0.53, feedPerBirdG: 305, targetWeightG: 5050 },
    { dayFrom: 57, dayTo: 84, proteinPct: 20.0, energyKcal: 3015, lysinePct: 1.11, methioninePct: 0.46, feedPerBirdG: 475, targetWeightG: 10450 },
    { dayFrom: 85, dayTo: 112, proteinPct: 18.0, energyKcal: 3075, lysinePct: 0.92, methioninePct: 0.40, feedPerBirdG: 620, targetWeightG: 16400 },
    { dayFrom: 113, dayTo: 140, proteinPct: 16.5, energyKcal: 3115, lysinePct: 0.79, methioninePct: 0.35, feedPerBirdG: 710, targetWeightG: 19900 },
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
