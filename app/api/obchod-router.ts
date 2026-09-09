/**
 * OBCHÓD DNIA — zbiorczy zapis najważniejszych danych dobowych
 * dla wszystkich kurników aktywnego gospodarstwa (jedna tabela, zero szukania).
 */
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { scopedBatchIds, scopedHouseIds } from "./tenant";
import { generateSchedule } from "./org-router";

const num = (v: unknown) => Number(v ?? 0);

export const obchodRouter = createRouter({
  /** Dziennik dnia: aktywne stada + istniejące wpisy danego dnia. */
  day: publicQuery
    .input(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input, ctx }) => {
      const batchIds = await scopedBatchIds(ctx);
      if (batchIds.length === 0) return { day: input.day, rows: [] };
      const db = getDb();
      const [batchRows, logs] = await Promise.all([
        db.select().from(s.batches).where(and(inArray(s.batches.id, batchIds), eq(s.batches.status, "active"))),
        db.select().from(s.dailyLogs).where(and(inArray(s.dailyLogs.batchId, batchIds), eq(s.dailyLogs.day, input.day))),
      ]);
      const houseRows = await db.select().from(s.houses).where(inArray(s.houses.id, batchRows.map((b) => b.houseId)));
      const houseOf = (id: number) => houseRows.find((h) => h.id === id);
      const weighRows = batchIds.length
        ? await db.select().from(s.weighings).where(inArray(s.weighings.batchId, batchIds))
        : [];
      const lastW = new Map<number, number>();
      for (const w of weighRows) {
        const cur = lastW.get(w.batchId);
        if (cur == null || w.dayAge > (weighRows.find((x) => x.batchId === w.batchId && x.avgWeightG === cur)?.dayAge ?? -1)) lastW.set(w.batchId, w.avgWeightG);
      }
      const lineIds = [...new Set(batchRows.map((b) => b.geneticLineId).filter((x): x is number => x != null))];
      const normRows = lineIds.length
        ? await db.select().from(s.geneticLineNorms).where(inArray(s.geneticLineNorms.geneticLineId, lineIds))
        : [];
      return {
        day: input.day,
        rows: batchRows.map((b) => {
          const log = logs.find((l) => l.batchId === b.id) ?? null;
          const dayAge = Math.max(0, Math.round((new Date(input.day).getTime() - new Date(b.startDate).getTime()) / 86400000));
          const norm = b.geneticLineId
            ? normRows.find((n) => n.geneticLineId === b.geneticLineId && dayAge >= n.dayFrom && dayAge <= n.dayTo)
            : undefined;
          const suggestedFeedKg = norm && norm.feedPerBirdG > 0
            ? Number(((b.currentCount * norm.feedPerBirdG) / 1000).toFixed(1))
            : null;
          return {
            batchId: b.id, code: b.code, house: houseOf(b.houseId)?.name ?? "?",
            currentCount: b.currentCount, dayAge, geneticLine: b.geneticLine,
            lastWeightG: lastW.get(b.id) ?? null,
            suggestedFeedKg,
            mortality: log?.mortality ?? 0, culls: log?.culls ?? 0,
            waterLiters: log ? num(log.waterLiters) : null,
            feedKg: log ? num(log.feedKg) : null,
            tempC: log?.tempC != null ? num(log.tempC) : null,
            humidityPct: log?.humidityPct != null ? num(log.humidityPct) : null,
            hasLog: !!log,
          };
        }),
      };
    }),

  /** Wolne kurniki (bez aktywnego stada) — do wstawienia piskląt prosto z obchodu. */
  /** Kurniki z info o dostępności — wolne lub możliwe do chowu mieszanego (indory + indyczki). */
  freeHouses: publicQuery.query(async ({ ctx }) => {
    const houseIds = await scopedHouseIds(ctx);
    if (houseIds.length === 0) return [];
    const db = getDb();
    const active = await db.select({ houseId: s.batches.houseId, sex: s.batches.sex, code: s.batches.code })
      .from(s.batches).where(and(inArray(s.batches.houseId, houseIds), eq(s.batches.status, "active")));
    const byHouse = new Map<number, { sex: string; code: string }[]>();
    for (const a of active) {
      const arr = byHouse.get(a.houseId) ?? []; arr.push({ sex: a.sex, code: a.code }); byHouse.set(a.houseId, arr);
    }
    const houses = await db.select().from(s.houses).where(inArray(s.houses.id, houseIds));
    return houses.map((h) => {
      const act = byHouse.get(h.id) ?? [];
      const sexes = new Set(act.map((a) => a.sex));
      // dostępny: pusty, albo chów rozdzielny płci — druga płeć (toms+hens), bez stada "mixed"
      const canToms = act.length === 0 || (!sexes.has("toms") && !sexes.has("mixed"));
      const canHens = act.length === 0 || (!sexes.has("hens") && !sexes.has("mixed"));
      const canMixed = act.length === 0;
      return {
        id: h.id, name: h.name, houseType: h.houseType,
        activeBatches: act,
        available: { toms: canToms, hens: canHens, mixed: canMixed },
      };
    });
  }),

  /** Wstawienie piskląt — tworzy nowy rzut (stado) w wybranym kurniku. */
  placement: publicQuery
    .input(z.object({
      houseId: z.number(),
      geneticLineId: z.number(),
      sex: z.enum(["toms", "hens", "mixed"]),
      initialCount: z.number().int().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      chickSupplier: z.string().max(255).optional(),
      chickPrice: z.number().min(0).optional(),
      code: z.string().min(3).max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const houseIds = await scopedHouseIds(ctx);
      if (!houseIds.includes(input.houseId)) throw new Error("Kurnik nie należy do wybranego gospodarstwa.");
      // Chów mieszany na jednym kurniku: dozwolone indory + indyczki jako osobne stada;
      // nie wolno drugi raz tej samej płci ani dokładać do stada mieszanego.
      const activeInHouse = await db.select({ sex: s.batches.sex, code: s.batches.code }).from(s.batches)
        .where(and(eq(s.batches.houseId, input.houseId), eq(s.batches.status, "active")));
      const sexes = new Set(activeInHouse.map((a) => a.sex));
      if (input.sex === "mixed" && activeInHouse.length > 0)
        throw new Error(`Kurnik jest zajęty (${activeInHouse.map((a) => a.code).join(", ")}) — stado mieszane wymaga pustego kurnika.`);
      if (sexes.has("mixed"))
        throw new Error(`W kurniku jest już stado mieszane (${activeInHouse[0].code}) — nie można dołożyć osobnej płci.`);
      if (sexes.has(input.sex))
        throw new Error(`W tym kurniku jest już aktywne stado tej samej płci (${activeInHouse.map((a) => a.code).join(", ")}). Dozwolony chów mieszany: indory + indyczki.`);
      const [line] = await db.select().from(s.geneticLines).where(eq(s.geneticLines.id, input.geneticLineId)).limit(1);
      if (!line) throw new Error("Nieznana linia genetyczna.");
      const code = input.code ?? `RZ/${input.startDate.slice(0, 4)}/${String(Date.now() % 100000).padStart(5, "0")}`;
      const growDays = input.sex === "toms" ? 140 : input.sex === "hens" ? 112 : 126;
      const end = new Date(input.startDate); end.setDate(end.getDate() + growDays);
      const [{ id }] = await db.insert(s.batches).values({
        houseId: input.houseId, geneticLineId: input.geneticLineId,
        code, geneticLine: line.name, sex: input.sex,
        initialCount: input.initialCount, currentCount: input.initialCount,
        startDate: input.startDate, plannedEndDate: end.toISOString().slice(0, 10),
        chickSupplier: input.chickSupplier ?? null, chickPrice: (input.chickPrice ?? 0).toFixed(3),
      }).$returningId();
      await generateSchedule(id, input.startDate, input.sex);
      // program żywieniowy wg norm linii
      const norms = await db.select().from(s.geneticLineNorms).where(eq(s.geneticLineNorms.geneticLineId, input.geneticLineId));
      const cid = (ctx as any).companyId ?? 0;
      if (norms.length && cid) {
        const [existing] = await db.select().from(s.feedPrograms)
          .where(and(eq(s.feedPrograms.companyId, cid), eq(s.feedPrograms.name, `Program — ${line.name}`))).limit(1);
        if (!existing) {
          const [{ id: pid }] = await db.insert(s.feedPrograms).values({
            companyId: cid, name: `Program — ${line.name}`, sex: input.sex,
          }).$returningId();
          const phaseName: Record<string, string> = {
            prestarter: "Prestarter", starter: "Starter", grower1: "Grower I",
            grower2: "Grower II", finisher1: "Finisher I", finisher2: "Finisher II",
          };
          for (const n of norms) {
            await db.insert(s.feedProgramStages).values({
              programId: pid, name: phaseName[n.phaseKey] ?? n.phaseKey,
              dayFrom: n.dayFrom, dayTo: n.dayTo,
              proteinTargetPct: n.proteinPct, energyTargetKcal: n.energyKcal, feedPerBirdG: n.feedPerBirdG,
            });
          }
        }
      }
      return { id, code };
    }),

  /** Zbiorczy zapis obchodu — jeden submit dla wszystkich kurników. */
  save: publicQuery
    .input(z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      entries: z.array(z.object({
        batchId: z.number(),
        mortality: z.number().int().min(0).default(0),
        culls: z.number().int().min(0).default(0),
        waterLiters: z.number().min(0).optional(),
        feedKg: z.number().min(0).optional(),
        tempC: z.number().min(-30).max(60).optional(),
        humidityPct: z.number().min(0).max(100).optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const allowed = new Set(await scopedBatchIds(ctx));
      const db = getDb();
      let saved = 0;
      for (const e of input.entries) {
        if (!allowed.has(e.batchId)) continue; // izolacja — cudze stado pomijane
        const [existing] = await db.select().from(s.dailyLogs)
          .where(and(eq(s.dailyLogs.batchId, e.batchId), eq(s.dailyLogs.day, input.day))).limit(1);
        const values = {
          mortality: e.mortality, culls: e.culls,
          waterLiters: e.waterLiters != null ? String(e.waterLiters) : null,
          feedKg: e.feedKg != null ? String(e.feedKg) : null,
          tempC: e.tempC != null ? String(e.tempC) : null,
          humidityPct: e.humidityPct != null ? String(e.humidityPct) : null,
        };
        if (existing) {
          await db.update(s.dailyLogs).set(values).where(eq(s.dailyLogs.id, existing.id));
        } else {
          await db.insert(s.dailyLogs).values({ batchId: e.batchId, day: input.day, ...values });
        }
        // zużycie paszy trafia też do feed_usages (paliwo KPI/FCR)
        if (e.feedKg && e.feedKg > 0) {
          const [fu] = await db.select().from(s.feedUsages)
            .where(and(eq(s.feedUsages.batchId, e.batchId), eq(s.feedUsages.day, input.day))).limit(1);
          if (fu) await db.update(s.feedUsages).set({ kg: String(e.feedKg) }).where(eq(s.feedUsages.id, fu.id));
          else await db.insert(s.feedUsages).values({ batchId: e.batchId, day: input.day, kg: String(e.feedKg) });
        }
        // padnięcia/wybory → mortalities + aktualizacja stanu stada
        if (e.mortality > 0 || e.culls > 0) {
          await db.insert(s.mortalities).values({
            batchId: e.batchId, day: input.day, count: e.mortality + e.culls,
            cause: e.culls > 0 ? `obchód: padnięte ${e.mortality}, wybrane ${e.culls}` : "obchód: padnięte",
          });
          const [b] = await db.select().from(s.batches).where(eq(s.batches.id, e.batchId));
          if (b) {
            await db.update(s.batches)
              .set({ currentCount: Math.max(0, b.currentCount - e.mortality - e.culls) })
              .where(eq(s.batches.id, e.batchId));
          }
        }
        saved++;
      }
      return { ok: true, saved };
    }),
});
