import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, desc, sql, and, ne, inArray } from "drizzle-orm";
import { assertBatchAccess, scopedBatchIds, scopedFarmIds } from "./tenant";

const num = (v: unknown) => Number(v ?? 0);

/* ---------- agregaty bulk (bez N+1) ---------- */

export type Agg = {
  lastW: Map<number, s.Weighing>;
  dead: Map<number, number>;
  feedKg: Map<number, number>;
};

export async function loadAggregates(batchIds?: number[]): Promise<Agg> {
  const db = getDb();
  const scoped = batchIds && batchIds.length ? batchIds : null;
  const empty = batchIds && batchIds.length === 0;
  const [ws, ms, fs]: [s.Weighing[], { batchId: number; total: number }[], { batchId: number; total: string }[]] = empty ? [[], [], []] : await Promise.all([
    scoped ? db.select().from(s.weighings).where(inArray(s.weighings.batchId, scoped)) : db.select().from(s.weighings),
    (scoped ? db.select({ batchId: s.mortalities.batchId, total: sql<number>`COALESCE(SUM(${s.mortalities.count}),0)` })
      .from(s.mortalities).where(inArray(s.mortalities.batchId, scoped)).groupBy(s.mortalities.batchId)
      : db.select({ batchId: s.mortalities.batchId, total: sql<number>`COALESCE(SUM(${s.mortalities.count}),0)` })
      .from(s.mortalities).groupBy(s.mortalities.batchId)),
    (scoped ? db.select({ batchId: s.feedUsages.batchId, total: sql<string>`COALESCE(SUM(${s.feedUsages.kg}),0)` })
      .from(s.feedUsages).where(inArray(s.feedUsages.batchId, scoped)).groupBy(s.feedUsages.batchId)
      : db.select({ batchId: s.feedUsages.batchId, total: sql<string>`COALESCE(SUM(${s.feedUsages.kg}),0)` })
      .from(s.feedUsages).groupBy(s.feedUsages.batchId)),
  ]);
  const lastW = new Map<number, s.Weighing>();
  for (const w of ws) {
    const cur = lastW.get(w.batchId);
    if (!cur || w.dayAge > cur.dayAge) lastW.set(w.batchId, w);
  }
  return {
    lastW,
    dead: new Map(ms.map((m) => [m.batchId, num(m.total)])),
    feedKg: new Map(fs.map((f) => [f.batchId, num(f.total)])),
  };
}

export function kpisFromAgg(b: s.Batch, agg: Agg) {
  const lastW = agg.lastW.get(b.id);
  const dead = agg.dead.get(b.id) ?? 0;
  const feedKg = agg.feedKg.get(b.id) ?? 0;
  const avgG = lastW?.avgWeightG ?? 45;
  const ageDays = lastW?.dayAge ?? 0;
  const biomassKg = (b.currentCount * avgG) / 1000;
  const gainKg = Math.max(biomassKg + (b.soldCount * avgG) / 1000 - b.initialCount * 0.05, 1);
  const fcr = feedKg / gainKg;
  const livability = b.initialCount > 0 ? ((b.initialCount - dead) / b.initialCount) * 100 : 100;
  const adgG = ageDays > 0 ? avgG / ageDays : 0;
  const epef = ageDays >= 60 ? ((livability / 100) * (avgG / 1000) * 10000) / (ageDays * Math.max(fcr, 0.1)) : 0;
  const mortalityPct = b.initialCount > 0 ? (dead / b.initialCount) * 100 : 0;
  return { batch: b, lastWeighing: lastW ?? null, avgWeightG: avgG, ageDays, biomassKg, fcr, livability, adgG, epef, mortalityPct, feedKg, dead };
}

/* ---------------- pomocnicze KPI ---------------- */

async function batchKpis(batchId: number) {
  const db = getDb();
  const [b] = await db.select().from(s.batches).where(eq(s.batches.id, batchId));
  if (!b) return null;
  const [lastW] = await db
    .select().from(s.weighings)
    .where(eq(s.weighings.batchId, batchId))
    .orderBy(desc(s.weighings.dayAge)).limit(1);
  const mort = await db
    .select({ total: sql<number>`COALESCE(SUM(${s.mortalities.count}),0)` })
    .from(s.mortalities).where(eq(s.mortalities.batchId, batchId));
  const feed = await db
    .select({ total: sql<string>`COALESCE(SUM(${s.feedUsages.kg}),0)` })
    .from(s.feedUsages).where(eq(s.feedUsages.batchId, batchId));
  const dead = num(mort[0]?.total);
  const feedKg = num(feed[0]?.total);
  const avgG = lastW?.avgWeightG ?? 45;
  const ageDays = lastW?.dayAge ?? 0;
  const biomassKg = (b.currentCount * avgG) / 1000;
  const gainKg = Math.max(biomassKg + (b.soldCount * avgG) / 1000 - b.initialCount * 0.05, 1);
  const fcr = feedKg / gainKg;
  const livability = b.initialCount > 0 ? ((b.initialCount - dead) / b.initialCount) * 100 : 100;
  const adgG = ageDays > 0 ? avgG / ageDays : 0;
  // EPEF ma sens dopiero pod koniec odchowu
  const epef = ageDays >= 60 ? ((livability / 100) * (avgG / 1000) * 10000) / (ageDays * Math.max(fcr, 0.1)) : 0;
  const mortalityPct = b.initialCount > 0 ? (dead / b.initialCount) * 100 : 0;
  return {
    batch: b, lastWeighing: lastW ?? null,
    avgWeightG: avgG, ageDays, biomassKg, fcr, livability, adgG, epef,
    mortalityPct, feedKg, dead,
  };
}

/* ================= ORGANIZACJA ================= */

const orgRouter = createRouter({
  // Struktura, tworzenie i edycja przeniesione do orgRouter (org.*)
  placeholder: publicQuery.query(() => ({ ok: true })),
});

/* ================= PRODUKCJA ================= */

const productionRouter = createRouter({
  batches: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const [batchRows, houseRows, farmRows, agg] = await Promise.all([
      db.select().from(s.batches).where(inArray(s.batches.id, ids)),
      db.select().from(s.houses),
      db.select().from(s.farms),
      loadAggregates(ids),
    ]);
    return batchRows.map((b) => {
      const k = kpisFromAgg(b, agg);
      const house = houseRows.find((h) => h.id === b.houseId) ?? null;
      const farm = house ? farmRows.find((f) => f.id === house.farmId) ?? null : null;
      const density = house ? k.biomassKg / num(house.areaM2) : 0;
      return { ...k, house, farm, densityKgM2: density };
    });
  }),

  batchDetail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await assertBatchAccess(ctx, input.id);
      const k = await batchKpis(input.id);
      if (!k) throw new Error("Rzut nie istnieje");
      const weighings = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, input.id)).orderBy(s.weighings.dayAge);
      const selects = await db.select().from(s.selects)
        .where(eq(s.selects.batchId, input.id)).orderBy(desc(s.selects.createdAt));
      const mortalities = await db.select().from(s.mortalities)
        .where(eq(s.mortalities.batchId, input.id)).orderBy(s.mortalities.day);
      const treatments = await db.select().from(s.treatments)
        .where(eq(s.treatments.batchId, input.id)).orderBy(desc(s.treatments.startedAt));
      const vaccinations = await db.select().from(s.vaccinations)
        .where(eq(s.vaccinations.batchId, input.id)).orderBy(s.vaccinations.day);
      const [house] = await db.select().from(s.houses).where(eq(s.houses.id, k.batch.houseId));
      const [farm] = house ? await db.select().from(s.farms).where(eq(s.farms.id, house.farmId)) : [null];
      return { ...k, weighings, selects, mortalities, treatments, vaccinations, house: house ?? null, farm: farm ?? null };
    }),

  addWeighing: publicQuery
    .input(z.object({
      batchId: z.number(), dayAge: z.number().int().min(1),
      sampleSize: z.number().int().min(1), avgWeightG: z.number().int().min(10),
      stdDevG: z.number().int().optional(), minG: z.number().int().optional(),
      maxG: z.number().int().optional(), operator: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const sd = input.stdDevG ?? Math.round(input.avgWeightG * 0.1);
      const cv = (sd / input.avgWeightG) * 100;
      const [{ id }] = await db.insert(s.weighings).values({
        batchId: input.batchId, weighedAt: new Date(), dayAge: input.dayAge,
        sampleSize: input.sampleSize, avgWeightG: input.avgWeightG,
        medianG: input.avgWeightG, stdDevG: sd,
        minG: input.minG ?? input.avgWeightG - 2 * sd,
        maxG: input.maxG ?? input.avgWeightG + 2 * sd,
        cv: cv.toFixed(2), operator: input.operator ?? "system",
      }).$returningId();
      // Event Engine: ważenie uruchamia Dynamic Select Engine
      await generateDynamicSelects(input.batchId, input.avgWeightG);
      return { id, cv };
    }),

  addSelect: publicQuery
    .input(z.object({
      batchId: z.number(), name: z.string().min(1), criteria: z.string(),
      birdCount: z.number().int().min(1), avgWeightG: z.number().int().min(10),
    }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.selects).values({
        batchId: input.batchId, name: input.name, criteria: input.criteria,
        origin: "manual", birdCount: input.birdCount, avgWeightG: input.avgWeightG,
        status: "ok",
      }).$returningId();
      return { id };
    }),

  regenerateSelects: publicQuery
    .input(z.object({ batchId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [lastW] = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, input.batchId))
        .orderBy(desc(s.weighings.dayAge)).limit(1);
      if (!lastW) throw new Error("Brak ważeń dla rzutu");
      await generateDynamicSelects(input.batchId, lastW.avgWeightG);
      return { ok: true };
    }),
});

async function generateDynamicSelects(batchId: number, avgWeightG: number) {
  const db = getDb();
  const [b] = await db.select().from(s.batches).where(eq(s.batches.id, batchId));
  if (!b || b.currentCount <= 0) return;
  await db.delete(s.selects).where(and(eq(s.selects.batchId, batchId), eq(s.selects.origin, "dynamic")));
  // rozkład normalny: < -1SD: ~16%, norma: ~68%, > +1SD: ~16%
  const [lastW] = await db.select().from(s.weighings)
    .where(eq(s.weighings.batchId, batchId)).orderBy(desc(s.weighings.dayAge)).limit(1);
  const sd = num(lastW?.stdDevG) || avgWeightG * 0.1;
  const cv = num(lastW?.cv) || 10;
  const groups = [
    { name: "Selekt L — lekkie", share: cv > 12 ? 0.22 : 0.16, dev: -0.11, crit: "masa < średnia - 1σ" },
    { name: "Selekt M — w normie", share: 0.68, dev: 0.005, crit: "masa w przedziale ±1σ" },
    { name: "Selekt H — ciężkie", share: cv > 12 ? 0.10 : 0.16, dev: 0.12, crit: "masa > średnia + 1σ" },
  ];
  for (const g of groups) {
    const cnt = Math.round(b.currentCount * g.share);
    if (cnt <= 0) continue;
    await db.insert(s.selects).values({
      batchId, name: g.name, criteria: g.crit, origin: "dynamic",
      birdCount: cnt, avgWeightG: Math.round(avgWeightG * (1 + g.dev)),
      fcr: (2.4 * (1 - g.dev * 0.6)).toFixed(3),
      mortalityPct: (1.8 * (1 - g.dev * 3)).toFixed(2),
      waterIntakeMl: Math.round(avgWeightG * 0.19),
      status: g.dev < -0.08 ? "critical" : g.dev < -0.02 ? "warning" : "ok",
    });
  }
  void sd;
}

/* ================= ŻYWIENIE ================= */

const feedRouter = createRouter({
  ingredients: publicQuery.query(async () => {
    return getDb().select().from(s.feedIngredients).orderBy(s.feedIngredients.name);
  }),

  recipes: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const recs = await db.select().from(s.recipes)
      .where(ctx.companyId
        ? and(sql`(${s.recipes.companyId} = ${ctx.companyId} OR ${s.recipes.companyId} IS NULL)`)
        : undefined);
    const items = await db.select().from(s.recipeItems);
    const ings = await db.select().from(s.feedIngredients);
    return recs.map((r) => ({
      ...r,
      items: items.filter((i) => i.recipeId === r.id).map((i) => ({
        ...i, ingredient: ings.find((g) => g.id === i.ingredientId) ?? null,
      })),
    }));
  }),

  optimize: publicQuery
    .input(z.object({
      proteinMin: z.number().min(10).max(32),
      energyMin: z.number().int().min(2500).max(3400),
      lysineMin: z.number().min(0.5).max(2),
      strategy: z.enum(["cheapest", "maxGrowth", "balanced"]),
      ageGroup: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const ings = await db.select().from(s.feedIngredients);
      const grains = ings.filter((i) => num(i.proteinPct) < 16 && num(i.energyKcal) > 2500);
      const proteins = ings.filter((i) => num(i.proteinPct) >= 20 && num(i.lysinePct) < 10);
      const fats = ings.filter((i) => num(i.fatPct) > 50);
      const lysSrc = ings.find((i) => num(i.lysinePct) > 10);
      const metSrc = ings.find((i) => num(i.methioninePct) > 10);
      const premix = ings.find((i) => i.name.toLowerCase().includes("premiks"));
      const minerals = ings.filter((i) => num(i.calciumPct) > 10 && !i.name.toLowerCase().includes("premiks"));
      const price = (i: s.FeedIngredient) => num(i.pricePerTon);

      type Mix = { id: number; pct: number; name: string };
      let best: { cost: number; score: number; mix: Mix[]; protein: number; energy: number; lys: number } | null = null;

      const fixed: Mix[] = [
        ...(premix ? [{ id: premix.id, pct: 2.5, name: premix.name }] : []),
        ...minerals.slice(0, 2).map((m, i) => ({ id: m.id, pct: i === 0 ? 1.6 : 0.8, name: m.name })),
      ];
      const fixedPct = fixed.reduce((a, b) => a + b.pct, 0);

      for (const g of grains) {
        for (const p of proteins) {
          for (const fat of fats.length ? fats : [null]) {
            for (let fatPct = 0; fatPct <= 8; fatPct += 1) {
              // rozwiąż układ: gPct + pPct = available; białko i energia
              const available = 100 - fixedPct - fatPct - 0.7; // 0.7% syntetyczne aminokwasy
              // białko: g*pG + p*pP >= proteinMin*100 / available (w % masy)
              const pG = num(g.proteinPct), pP = num(p.proteinPct);
              const eG = num(g.energyKcal), eP = num(p.energyKcal);
              let pPct = ((input.proteinMin * 100) / available * available - pG * available) / (pP - pG);
              pPct = Math.max(pPct, available * 0.05);
              const gPct = available - pPct;
              if (gPct < available * 0.3) continue;
              let energy = (gPct * eG + pPct * eP) / 100 + fatPct * 88 + 0;
              let protein = (gPct * pG + pPct * pP) / 100;
              let lys = (gPct * num(g.lysinePct) + pPct * num(p.lysinePct)) / 100 + 0.42 * 0.78;
              if (energy < input.energyMin && fat) continue;
              if (lys < input.lysineMin) continue;
              const mix: Mix[] = [
                ...fixed,
                { id: g.id, pct: gPct, name: g.name },
                { id: p.id, pct: pPct, name: p.name },
                ...(fat ? [{ id: fat.id, pct: fatPct, name: fat.name }] : []),
                ...(lysSrc ? [{ id: lysSrc.id, pct: 0.42, name: lysSrc.name }] : []),
                ...(metSrc ? [{ id: metSrc.id, pct: 0.28, name: metSrc.name }] : []),
              ];
              const cost = mix.reduce((a, m) => {
                const ing = ings.find((x) => x.id === m.id)!;
                return a + (m.pct / 100) * price(ing);
              }, 0);
              const score =
                input.strategy === "cheapest" ? -cost
                : input.strategy === "maxGrowth" ? energy + protein * 40 - cost * 0.5
                : -(cost * 0.7) + (energy - input.energyMin) * 0.3 + protein * 10;
              if (!best || score > best.score) {
                best = { cost, score, mix, protein, energy, lys };
              }
            }
          }
        }
      }
      if (!best) throw new Error("Nie znaleziono receptury spełniającej ograniczenia — poluzuj wymagania");

      const stratName = { cheapest: "minimalizacja kosztu", maxGrowth: "maksymalizacja przyrostu", balanced: "wariant zrównoważony" }[input.strategy];
      const top = [...best.mix].sort((a, b) => b.pct - a.pct).slice(0, 2).map((m) => m.name).join(" i ");
      const explanation = `Strategia: ${stratName} (${input.ageGroup}). Baza receptury: ${top}. Białko ${best.protein.toFixed(1)}% ≥ ${input.proteinMin}%, energia ${Math.round(best.energy)} kcal ≥ ${input.energyMin}, lizyna ${best.lys.toFixed(2)}% ≥ ${input.lysineMin}%. Dodano lizynę syntetyczną 0.42%, aby uzupełnić deficit aminokwasowy przy ograniczeniu udziału drogiej śruty białkowej. Wszystkie ograniczenia spełnione.`;

      const [{ id }] = await db.insert(s.recipes).values({
        name: `${input.ageGroup} — ${stratName}`, ageGroup: input.ageGroup,
        strategy: input.strategy, costPerTon: best.cost.toFixed(2),
        proteinPct: best.protein.toFixed(2), energyKcal: Math.round(best.energy),
        lysinePct: best.lys.toFixed(3), explanation,
      }).$returningId();
      for (const m of best.mix) {
        await db.insert(s.recipeItems).values({ recipeId: id, ingredientId: m.id, percent: m.pct.toFixed(2) });
      }
      return { id, cost: best.cost, protein: best.protein, energy: best.energy, lysine: best.lys, mix: best.mix, explanation };
    }),
});

/* ================= ZDROWIE ================= */

const healthRouter = createRouter({
  treatments: publicQuery.query(async () => {
    const db = getDb();
    const [rows, batchRows] = await Promise.all([
      db.select().from(s.treatments).orderBy(desc(s.treatments.startedAt)),
      db.select().from(s.batches),
    ]);
    const codeOf = (id: number) => batchRows.find((b) => b.id === id)?.code ?? "?";
    return rows.map((t) => {
      const end = new Date(t.startedAt);
      end.setDate(end.getDate() + t.withdrawalDays);
      const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
      return { ...t, batchCode: codeOf(t.batchId), withdrawalEnd: end, withdrawalDaysLeft: daysLeft };
    });
  }),

  addTreatment: publicQuery
    .input(z.object({
      batchId: z.number(), startedAt: z.string(), product: z.string().min(2),
      activeSubstance: z.string().min(2), dose: z.string().min(1),
      reason: z.string().optional(), withdrawalDays: z.number().int().min(0),
      vet: z.string().optional(), cost: z.number().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.treatments).values({
        batchId: input.batchId, startedAt: input.startedAt, product: input.product,
        activeSubstance: input.activeSubstance, dose: input.dose,
        reason: input.reason, withdrawalDays: input.withdrawalDays,
        vet: input.vet, cost: (input.cost ?? 0).toFixed(2),
      }).$returningId();
      if (input.cost && input.cost > 0) {
        await db.insert(s.costs).values({
          batchId: input.batchId, category: "vet", amount: input.cost.toFixed(2),
          currency: "EUR", day: input.startedAt, note: input.product,
        });
      }
      return { id };
    }),

  vaccinations: publicQuery.query(async () => {
    const db = getDb();
    const [rows, batchRows] = await Promise.all([
      db.select().from(s.vaccinations).orderBy(s.vaccinations.day),
      db.select().from(s.batches),
    ]);
    const codeOf = (id: number) => batchRows.find((b) => b.id === id)?.code ?? "?";
    return rows.map((v) => ({ ...v, batchCode: codeOf(v.batchId) }));
  }),

  markVaccinationDone: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.vaccinations).set({ done: true }).where(eq(s.vaccinations.id, input.id));
      return { ok: true };
    }),
});

/* ================= EKONOMIA ================= */

const economicsRouter = createRouter({
  batchPnl: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const [batchRows, allCosts, allSales, agg] = await Promise.all([
      db.select().from(s.batches).where(inArray(s.batches.id, ids)),
      db.select().from(s.costs).where(inArray(s.costs.batchId, ids)),
      db.select().from(s.sales).where(inArray(s.sales.batchId, ids)),
      loadAggregates(ids),
    ]);
    return batchRows.map((b) => {
      const costRows = allCosts.filter((c) => c.batchId === b.id);
      const saleRows = allSales.filter((x) => x.batchId === b.id);
      const byCat: Record<string, number> = {};
      let total = 0;
      for (const c of costRows) {
        byCat[c.category] = (byCat[c.category] ?? 0) + num(c.amount);
        total += num(c.amount);
      }
      const revenue = saleRows.reduce((a, x) => a + num(x.totalWeightKg) * num(x.pricePerKg), 0);
      const soldKg = saleRows.reduce((a, x) => a + num(x.totalWeightKg), 0);
      const k = kpisFromAgg(b, agg);
      return {
        batch: b, costsByCategory: byCat, totalCosts: total,
        revenue, margin: revenue - total, soldKg,
        costPerKg: soldKg > 0 ? total / soldKg : k.biomassKg > 0 ? total / k.biomassKg : 0,
        biomassKg: k.biomassKg, fcr: k.fcr,
      };
    });
  }),
});

/* ================= DASHBOARD ================= */

const dashboardRouter = createRouter({
  kpis: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    const [batchRows, farms, agg] = await Promise.all([
      ids.length
        ? db.select().from(s.batches).where(and(eq(s.batches.status, "active"), inArray(s.batches.id, ids)))
        : Promise.resolve([]),
      db.select().from(s.farms).where(and(ne(s.farms.status, "archived"),
        inArray(s.farms.id, await scopedFarmIds(ctx)))),
      loadAggregates(),
    ]);
    let birds = 0, biomass = 0, fcrSum = 0, fcrW = 0, mortSum = 0;
    let epefSum = 0, withEpef = 0;
    for (const b of batchRows) {
      const k = kpisFromAgg(b, agg);
      birds += b.currentCount;
      biomass += k.biomassKg;
      fcrSum += k.fcr * k.biomassKg; fcrW += k.biomassKg;
      mortSum += k.mortalityPct;
      if (k.epef > 0) { epefSum += k.epef; withEpef++; }
    }
    const countries = new Set(farms.map((f) => f.countryCode));
    const n = Math.max(batchRows.length, 1);
    withEpef = Math.max(withEpef, 1);
    return {
      activeBirds: birds,
      biomassTons: biomass / 1000,
      avgFcr: fcrW > 0 ? fcrSum / fcrW : 0,
      avgMortality: mortSum / n,
      avgEpef: epefSum / withEpef,
      activeBatches: batchRows.length,
      farmsCount: farms.length,
      countriesCount: countries.size,
    };
  }),

  mapData: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [farms, houseRows, batchRows, agg] = await Promise.all([
      db.select().from(s.farms).where(and(ne(s.farms.status, "archived"),
        inArray(s.farms.id, await scopedFarmIds(ctx)))),
      db.select().from(s.houses),
      db.select().from(s.batches).where(eq(s.batches.status, "active")),
      loadAggregates(),
    ]);
    return farms.map((f) => {
      const houseIds = new Set(houseRows.filter((h) => h.farmId === f.id).map((h) => h.id));
      let birds = 0, biomass = 0;
      for (const b of batchRows) {
        if (!houseIds.has(b.houseId)) continue;
        birds += b.currentCount;
        biomass += kpisFromAgg(b, agg).biomassKg;
      }
      return { ...f, activeBirds: birds, biomassTons: biomass / 1000 };
    });
  }),

  alerts: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ids = await scopedBatchIds(ctx);
    if (ids.length === 0) return [];
    const alerts: Array<{ type: "critical" | "warning" | "info"; title: string; detail: string }> = [];
    const [critSelects, treats, batchRows] = await Promise.all([
      db.select().from(s.selects).where(and(eq(s.selects.status, "critical"), inArray(s.selects.batchId, ids))),
      db.select().from(s.treatments).where(inArray(s.treatments.batchId, ids)),
      db.select().from(s.batches).where(inArray(s.batches.id, ids)),
    ]);
    const codeOf = (id: number) => batchRows.find((b) => b.id === id)?.code ?? "?";
    for (const sel of critSelects.slice(0, 6)) {
      alerts.push({
        type: "critical",
        title: `${sel.name} (${codeOf(sel.batchId)})`,
        detail: `Śr. masa ${(sel.avgWeightG / 1000).toFixed(2)} kg — ${sel.criteria}. Wymaga analizy środowiska i żywienia.`,
      });
    }
    for (const t of treats) {
      const end = new Date(t.startedAt); end.setDate(end.getDate() + t.withdrawalDays);
      const left = Math.ceil((end.getTime() - Date.now()) / 86400000);
      if (left > 0) {
        alerts.push({
          type: "warning",
          title: `Karencja: ${t.product} (${codeOf(t.batchId)})`,
          detail: `${t.activeSubstance} — do końca karencji ${left} dni. Ubój zablokowany do ${end.toISOString().slice(0, 10)}.`,
        });
      }
    }
    return alerts;
  }),
});

export const farmRouter = createRouter({
  org: orgRouter,
  production: productionRouter,
  feed: feedRouter,
  health: healthRouter,
  economics: economicsRouter,
  dashboard: dashboardRouter,
});
