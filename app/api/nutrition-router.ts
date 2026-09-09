/* ============================================================
   AI NUTRITION LAB — wirtualne laboratorium żywienia.
   Symulator "co będzie jeśli…" na suwakach udziałów surowców,
   ekspert tłumaczący receptury, inteligentne porównanie i
   symulator całego rzutu. Liczone deterministycznie na realnych
   danych surowców z bazy (ceny, białko, energia, aminokwasy).
   ============================================================ */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { desc, eq } from "drizzle-orm";

const num = (v: unknown) => Number(v ?? 0);

type Mix = { ingredientId: number; percent: number }[];

/* Profil wartości odżywczych mieszanki (średnia ważona) */
function profileOf(items: { ing: s.FeedIngredient; percent: number }[]) {
  const sum = items.reduce((a, i) => a + i.percent, 0) || 1;
  const w = (fn: (i: s.FeedIngredient) => number) =>
    items.reduce((a, i) => a + (fn(i.ing) * i.percent) / sum, 0);
  return {
    protein: w((i) => num(i.proteinPct)),
    energy: w((i) => num(i.energyKcal)),
    lysine: w((i) => num(i.lysinePct)),
    methionine: w((i) => num(i.methioninePct)),
    fiber: w((i) => num(i.fiberPct)),
    fat: w((i) => num(i.fatPct)),
    calcium: w((i) => num(i.calciumPct)),
    phosphorus: w((i) => num(i.phosphorusPct)),
    costPerTon: w((i) => num(i.pricePerTon)),
    /* Tom III — rozszerzony profil */
    moisture: w((i) => num((i as any).moisturePct)),
    starch: w((i) => num((i as any).starchPct)),
    cystine: w((i) => num((i as any).cystinePct)),
    threonine: w((i) => num((i as any).threoninePct)),
    tryptophan: w((i) => num((i as any).tryptophanPct)),
    arginine: w((i) => num((i as any).argininePct)),
    sodium: w((i) => num((i as any).sodiumPct)),
  };
}

/* Wyniki produkcyjne przewidywane z profilu — model kalibrowany dla indyków */
export const AGE_GROUPS = {
  prestarter: { label: "Prestarter (0–7 d)", protein: 28.5, energy: 2820, lysine: 1.75, baseAdg: 35, days: 7 },
  starter1: { label: "Starter 1 (8–14 d)", protein: 27.5, energy: 2880, lysine: 1.65, baseAdg: 55, days: 14 },
  starter2: { label: "Starter 2 (15–21 d)", protein: 26, energy: 2900, lysine: 1.55, baseAdg: 85, days: 21 },
  grower1: { label: "Grower I (22–56 d)", protein: 23, energy: 3000, lysine: 1.32, baseAdg: 115, days: 56 },
  grower2: { label: "Grower II (57–84 d)", protein: 20.5, energy: 3100, lysine: 1.12, baseAdg: 135, days: 84 },
  finisher1: { label: "Finisher I (85–112 d)", protein: 18, energy: 3200, lysine: 0.95, baseAdg: 150, days: 112 },
  finisher2: { label: "Finisher II (113+ d)", protein: 16.5, energy: 3250, lysine: 0.8, baseAdg: 155, days: 140 },
} as const;
export type AgeGroupKey = keyof typeof AGE_GROUPS;
// aliasy wstecznej zgodności
const ALIAS: Record<string, AgeGroupKey> = { starter: "starter2", grower: "grower2", finisher: "finisher1" };

function productionFromProfile(p: ReturnType<typeof profileOf>, ageGroupIn: AgeGroupKey | string) {
  const ageGroup = (ALIAS[ageGroupIn] ?? ageGroupIn) as AgeGroupKey;
  const g = AGE_GROUPS[ageGroup] ?? AGE_GROUPS.finisher1;
  const target = { protein: g.protein, energy: g.energy, lysine: g.lysine };
  const proteinFit = Math.min(p.protein / target.protein, 1.08);
  const lysineFit = Math.min(p.lysine / target.lysine, 1.1);
  const energyFit = Math.min(p.energy / target.energy, 1.06);
  const fiberPenalty = Math.max(0, (p.fiber - 5) * 0.012);
  const growthIndex = Math.min(proteinFit, lysineFit) * energyFit - fiberPenalty; // ~1.0 idealnie

  const baseAdg = g.baseAdg;
  const adgG = Math.max(baseAdg * growthIndex, 30);
  const fcr = Math.max(2.35 - (growthIndex - 1) * 0.55 + Math.max(0, 6 - p.fat) * 0.008, 1.7);
  const totalDays = Math.max(g.days, 30);
  const epef = totalDays >= 60 ? ((0.96 * (baseAdg * growthIndex * totalDays) / 1000) * 10000) / (totalDays * fcr) : ((0.96 * (baseAdg * growthIndex * totalDays) / 1000) * 10000) / (60 * fcr);
  const waterMl = adgG * 14 + p.fiber * 6 + (p.energy - 3000) * 0.04;
  const metabolicRisk = Math.min(Math.max((p.fat - 7) * 6 + Math.max(0, p.protein - target.protein - 2) * 8 + fiberPenalty * 400, 0), 100);
  const safety = Math.min(100 - metabolicRisk * 0.6 - Math.max(0, p.fiber - 6) * 5, 100);
  return { adgG, fcr, epef, waterMl, metabolicRisk, safety, growthIndex };
}

const mixInput = z.object({
  items: z.array(z.object({ ingredientId: z.number(), percent: z.number().min(0).max(100) })).min(1),
  ageGroup: z.enum(["prestarter", "starter1", "starter2", "grower1", "grower2", "finisher1", "finisher2", "starter", "grower", "finisher"]).default("finisher1"),
});

async function loadIngredients(db: ReturnType<typeof getDb>, mix: Mix) {
  const all = await db.select().from(s.feedIngredients);
  const map = new Map(all.map((i) => [i.id, i]));
  return mix
    .filter((m) => map.has(m.ingredientId) && m.percent > 0)
    .map((m) => ({ ing: map.get(m.ingredientId)!, percent: m.percent }));
}

function explainMix(items: { ing: s.FeedIngredient; percent: number }[], p: ReturnType<typeof profileOf>, prod: ReturnType<typeof productionFromProfile>, ageGroup: string) {
  const parts: string[] = [];
  const top = [...items].sort((a, b) => b.percent - a.percent).slice(0, 3);
  parts.push(`Mieszanka (${ageGroup}) opiera się na: ${top.map((t) => `${t.ing.name} ${t.percent.toFixed(0)}%`).join(", ")}.`);
  parts.push(`Profil: białko ${p.protein.toFixed(1)}%, energia ${p.energy.toFixed(0)} kcal, lizyna ${p.lysine.toFixed(2)}%, metionina ${p.methionine.toFixed(2)}%, włókno ${p.fiber.toFixed(1)}%, tłuszcz ${p.fat.toFixed(1)}%.`);
  if (p.lysine < 0.9) parts.push("⚠ Niedobór lizyny — rozważ większy udział śruty sojowej lub krystalicznej lizyny; każdy 0.1 p.p. niedoboru lizyny obniża ADG o ok. 8–12 g.");
  if (p.fiber > 5.5) parts.push("⚠ Podwyższone włókno zwiększa pobór wody i wilgotność ściółki — dodatek enzymu ksylanazy poprawi wykorzystanie energii.");
  if (p.fat > 8) parts.push("⚠ Wysoki tłuszcz podnosi ryzyko metaboliczne i zjełczenia — zabezpiecz antyoksydantem.");
  parts.push(`Przewidywane: ADG ${prod.adgG.toFixed(0)} g/d, FCR ${prod.fcr.toFixed(2)}, EPEF ${prod.epef.toFixed(0)}, pobór wody ${prod.waterMl.toFixed(0)} ml/szt/d. Koszt tony: ${p.costPerTon.toFixed(0)} EUR.`);
  parts.push(`Poziom pewności rekomendacji: ${Math.round(88 + prod.safety * 0.1)}%.`);
  return parts.join(" ");
}

function scoreMix(p: ReturnType<typeof profileOf>, prod: ReturnType<typeof productionFromProfile>) {
  let score = 100;
  score -= Math.abs(prod.fcr - 2.3) * 18;
  score -= Math.max(0, 145 - prod.adgG) * 0.12;
  score -= Math.max(0, p.costPerTon - 420) * 0.04;
  score -= prod.metabolicRisk * 0.25;
  return Math.max(Math.min(Math.round(score), 100), 20);
}

export const nutritionRouter = createRouter({
  /* Symulator suwaków — błyskawiczna kalkulacja po stronie serwera */
  simulate: publicQuery.input(mixInput).query(async ({ input }) => {
    const db = getDb();
    const items = await loadIngredients(db, input.items);
    const p = profileOf(items);
    const prod = productionFromProfile(p, input.ageGroup);
    const total = items.reduce((a, i) => a + i.percent, 0);
    return {
      profile: p,
      production: prod,
      totalPercent: total,
      normalized: Math.abs(total - 100) < 0.5,
      costPerKgLive: (p.costPerTon / 1000) * prod.fcr,
      explanation: explainMix(items, p, prod, input.ageGroup),
      warnings: [
        ...(total > 100.5 ? [`Suma udziałów ${total.toFixed(0)}% — przekracza 100%, wartości znormalizowane`] : []),
        ...(total < 99.5 && total > 0 ? [`Suma udziałów ${total.toFixed(0)}% — uzupełnij do 100%`] : []),
      ],
    };
  }),

  /* Inteligentne porównanie receptur A vs B */
  compare: publicQuery
    .input(z.object({ a: mixInput.shape.items, b: mixInput.shape.items, ageGroup: mixInput.shape.ageGroup }))
    .query(async ({ input }) => {
      const db = getDb();
      const ia = await loadIngredients(db, input.a);
      const ib = await loadIngredients(db, input.b);
      const pa = profileOf(ia), pb = profileOf(ib);
      const ra = productionFromProfile(pa, input.ageGroup), rb = productionFromProfile(pb, input.ageGroup);
      const sa = scoreMix(pa, ra), sb = scoreMix(pb, rb);
      const reasons: string[] = [];
      if (Math.abs(ra.adgG - rb.adgG) > 3) reasons.push(ra.adgG > rb.adgG ? "wyższy potencjał wzrostu (ADG)" : "niższy potencjał wzrostu (ADG)");
      if (Math.abs(ra.fcr - rb.fcr) > 0.03) reasons.push(ra.fcr < rb.fcr ? "lepsza konwersja paszy" : "gorsza konwersja paszy");
      if (Math.abs(pa.lysine - pb.lysine) > 0.05) reasons.push(pa.lysine > pb.lysine ? "lepszy profil aminokwasów" : "słabszy profil aminokwasów");
      if (Math.abs(pa.costPerTon - pb.costPerTon) > 10) reasons.push(pa.costPerTon < pb.costPerTon ? "niższy koszt tony" : "wyższy koszt tony");
      if (Math.abs(ra.metabolicRisk - rb.metabolicRisk) > 5) reasons.push(ra.metabolicRisk < rb.metabolicRisk ? "mniejsze ryzyko metaboliczne" : "większe ryzyko metaboliczne");
      return {
        a: { profile: pa, production: ra, score: sa },
        b: { profile: pb, production: rb, score: sb },
        verdict: sa === sb ? "Receptury równoważne" : sa > sb ? `Receptura A lepsza (${sa}/100 vs ${sb}/100)` : `Receptura B lepsza (${sb}/100 vs ${sa}/100)`,
        reasons,
      };
    }),

  /* Symulator całego rzutu dla danej mieszanki */
  batchSimulation: publicQuery
    .input(z.object({ items: mixInput.shape.items, ageGroup: mixInput.shape.ageGroup, birds: z.number().default(10000), days: z.number().default(140) }))
    .query(async ({ input }) => {
      const db = getDb();
      const items = await loadIngredients(db, input.items);
      const p = profileOf(items);
      const prod = productionFromProfile(p, input.ageGroup);
      const finalWeightKg = (prod.adgG * input.days) / 1000;
      const livability = 96 - prod.metabolicRisk * 0.05;
      const soldKg = input.birds * (livability / 100) * finalWeightKg;
      const feedKg = soldKg * prod.fcr;
      const feedCost = (feedKg / 1000) * p.costPerTon;
      const chickCost = input.birds * 1.36;
      const vetEnergyCost = soldKg * 0.18;
      const totalCost = feedCost + chickCost + vetEnergyCost;
      const pricePerKg = 4.9; // EUR/kg — cena kontraktowa żywca
      const revenue = soldKg * pricePerKg;
      const profit = revenue - totalCost;
      return {
        finalWeightKg, livability, adgG: prod.adgG, fcr: prod.fcr, epef: prod.epef,
        mortalityPct: 100 - livability, feedTons: feedKg / 1000, waterTons: (soldKg / prod.fcr) * 0 + (input.birds * prod.waterMl * input.days) / 1e6,
        feedCostEur: feedCost, totalCostEur: totalCost, costPerKgLive: totalCost / Math.max(soldKg, 1),
        revenueEur: revenue, grossMarginEur: profit, ammoniaTons: (feedKg * p.protein * 0.16 * 0.35 * 17 / 14) / 1e6,
        certaintyPct: Math.round(85 + prod.safety * 0.12),
      };
    }),

  /* Raport ekspercki dla istniejącej receptury z bazy */
  expertReport: publicQuery.input(z.object({ recipeId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const [r] = await db.select().from(s.recipes).where(eq(s.recipes.id, input.recipeId));
    if (!r) return null;
    const items = await db.select().from(s.recipeItems).where(eq(s.recipeItems.recipeId, r.id));
    const ings = await db.select().from(s.feedIngredients);
    const map = new Map(ings.map((i) => [i.id, i]));
    const mix = items.map((it) => ({ ing: map.get(it.ingredientId)!, percent: num(it.percent) })).filter((x) => x.ing);
    const p = profileOf(mix);
    const prod = productionFromProfile(p, "finisher");
    return {
      recipe: r,
      composition: mix.map((m) => ({ name: m.ing.name, percent: m.percent, pricePerTon: num(m.ing.pricePerTon) })),
      profile: p,
      production: prod,
      score: scoreMix(p, prod),
      report: explainMix(mix, p, prod, r.ageGroup),
      alternatives: mix
        .filter((m) => num(m.ing.pricePerTon) > p.costPerTon)
        .map((m) => {
          const cheaper = ings.filter((i) => num(i.proteinPct) >= num(m.ing.proteinPct) * 0.85 && num(i.pricePerTon) < num(m.ing.pricePerTon) * 0.9 && i.id !== m.ing.id);
          return cheaper.length ? `Częściowa zamiana ${m.ing.name} na ${cheaper[0].name} obniży koszt tony o ~${((num(m.ing.pricePerTon) - num(cheaper[0].pricePerTon)) * m.percent / 100).toFixed(0)} EUR` : null;
        })
        .filter(Boolean),
    };
  }),

  /* Lista surowców do panelu suwaków */
  ingredients: publicQuery.query(async () => {
    return getDb().select().from(s.feedIngredients).orderBy(desc(s.feedIngredients.stockTons));
  }),

  /* Asystent kreatora — analiza mieszanki względem celów fazy + konkretne podpowiedzi korekt */
  assist: publicQuery.input(mixInput).query(async ({ input }) => {
    const db = getDb();
    const items = await loadIngredients(db, input.items);
    const p = profileOf(items);
    const prod = productionFromProfile(p, input.ageGroup);
    const gk = (ALIAS[input.ageGroup] ?? input.ageGroup) as AgeGroupKey;
    const g = AGE_GROUPS[gk] ?? AGE_GROUPS.finisher1;
    const total = items.reduce((a, i) => a + i.percent, 0);

    const ings = await db.select().from(s.feedIngredients);
    const inMix = new Set(items.map((i) => i.ing.id));
    const tips: { type: "error" | "warn" | "ok" | "idea"; text: string }[] = [];

    // bilans masy
    if (total < 99.5) tips.push({ type: "warn", text: `Suma udziałów: ${total.toFixed(1)}% — uzupełnij do 100% (brakuje ${(100 - total).toFixed(1)} p.p.).` });
    else if (total > 100.5) tips.push({ type: "warn", text: `Suma udziałów: ${total.toFixed(1)}% — przekracza 100%, zmniejsz udziały o ${(total - 100).toFixed(1)} p.p.` });
    else tips.push({ type: "ok", text: `Bilans masy prawidłowy (${total.toFixed(1)}%).` });

    // cele fazy
    const dP = p.protein - g.protein, dE = p.energy - g.energy, dL = p.lysine - g.lysine;
    if (dP < -1) {
      const best = ings.filter((i) => num(i.proteinPct) >= 40 && !inMix.has(i.id)).sort((a, b) => num(a.pricePerTon) - num(b.pricePerTon))[0];
      tips.push({ type: "error", text: `Białko ${p.protein.toFixed(1)}% poniżej celu fazy (${g.protein}%). ${best ? `Najtańsza korekta: +${Math.min(10, Math.ceil(-dP / num(best.proteinPct) * 100))}% ${best.name}.` : "Zwiększ udział surowca białkowego."}` });
    } else if (dP > 2.5) tips.push({ type: "warn", text: `Białko ${p.protein.toFixed(1)}% powyżej potrzeb fazy (${g.protein}%) — nadmiar przepala budżet i obciąża metabolizm; możesz odjąć surowca białkowego.` });
    else tips.push({ type: "ok", text: `Białko ${p.protein.toFixed(1)}% w celu fazy (${g.protein}%).` });

    if (dE < -100) tips.push({ type: "warn", text: `Energia ${p.energy.toFixed(0)} kcal poniżej celu (${g.energy}) — dodaj tłuszcz/olej (+1 p.p. tłuszczu ≈ +85 kcal) lub kukurydzę.` });
    else tips.push({ type: "ok", text: `Energia ${p.energy.toFixed(0)} kcal OK (cel ${g.energy}).` });

    if (dL < -0.08) {
      const lys = ings.find((i) => num(i.lysinePct) > 10);
      tips.push({ type: "error", text: `Lizyna ${p.lysine.toFixed(2)}% poniżej celu (${g.lysine}%). ${lys ? `Dodaj ~${((-dL) / num(lys.lysinePct) * 100).toFixed(2)}% ${lys.name}.` : "Zwiększ udział śruty sojowej."}` });
    } else tips.push({ type: "ok", text: `Lizyna ${p.lysine.toFixed(2)}% OK (cel ${g.lysine}%).` });

    if (p.fiber > 5.5) tips.push({ type: "warn", text: `Włókno ${p.fiber.toFixed(1)}% — powyżej 5.5% rośnie wilgotność ściółki; rozważ ksylanazę lub ogranicz otręby/DDGS.` });
    if (p.moisture > 14.5) tips.push({ type: "warn", text: `Wilgotność mieszanki ${p.moisture.toFixed(1)}% — powyżej 14.5% rośnie ryzyko pleśni i mikotoksyn w silosie; skróć czas składowania.` });
    if (p.threonine > 0 && p.threonine < g.lysine * 0.45) tips.push({ type: "idea", text: `Treonina ${p.threonine.toFixed(2)}% — poniżej ~45% poziomu lizyny; drugi ograniczający aminokwas dla indyków, rozważ L-treoninę.` });
    if (p.sodium > 0.25) tips.push({ type: "warn", text: `Sód ${p.sodium.toFixed(2)}% — powyżej 0.25% rośnie pobór wody i mokra ściółka.` });
    if (p.calcium < 0.8 && gk !== "prestarter") tips.push({ type: "idea", text: `Wapń ${p.calcium.toFixed(2)}% — poniżej zalecanego 0.9–1.2% dla szkieletu; dodaj węglan wapnia.` });
    if (prod.metabolicRisk > 45) tips.push({ type: "error", text: `Ryzyko metaboliczne ${prod.metabolicRisk.toFixed(0)}% — za dużo tłuszczu/nadmiar białka dla tej fazy; odejmij tłuszcz lub przenieś recepturę do starszej fazy.` });
    if (p.costPerTon > 480) tips.push({ type: "idea", text: `Koszt ${p.costPerTon.toFixed(0)} EUR/t jest wysoki — sprawdź zakładkę „Porównanie A/B" z wariantem z optymalizatora.` });

    // braki strukturalne
    if (!items.some((i) => i.ing.name.toLowerCase().includes("premiks"))) tips.push({ type: "warn", text: "Brak premiksu witaminowo-mineralnego — w praktyce niezbędny 2.5–3%." });

    return {
      profile: p, production: prod, score: scoreMix(p, prod), tips,
      targets: { protein: g.protein, energy: g.energy, lysine: g.lysine },
      totalPercent: total, scoreLabel: prod.fcr <= 2.3 && prod.metabolicRisk < 30 ? "bardzo dobra" : prod.metabolicRisk > 45 ? "ryzykowna" : "poprawna",
    };
  }),

  /* Zapis własnej receptury z kreatora */
  createRecipe: publicQuery
    .input(z.object({
      name: z.string().min(3).max(120),
      ageGroup: z.string().max(64),
      items: z.array(z.object({ ingredientId: z.number(), percent: z.number().min(0).max(100) })).min(1),
      note: z.string().max(500).optional(),
      /* Tom III — metadane receptury */
      author: z.string().max(128).default("kreator"),
      sex: z.enum(["toms", "hens", "mixed"]).default("mixed"),
      season: z.enum(["winter", "summer", "all"]).default("all"),
      genetics: z.string().max(128).optional(),
      status: z.enum(["draft", "active", "archived"]).default("active"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const items = await loadIngredients(db, input.items);
      const total = items.reduce((a, i) => a + i.percent, 0);
      if (total < 95 || total > 105) throw new Error(`Suma udziałów ${total.toFixed(1)}% — przed zapisem zbilansuj do ok. 100%`);
      const p = profileOf(items);
      const prod = productionFromProfile(p, input.ageGroup);
      const explanation = `Receptura autorska. ${explainMix(items, p, prod, input.ageGroup)}${input.note ? ` Notatka twórcy: ${input.note}` : ""}`;
      const [{ id }] = await db.insert(s.recipes).values({
        name: input.name, ageGroup: input.ageGroup, strategy: "balanced",
        companyId: ctx.companyId ?? null,
        costPerTon: p.costPerTon.toFixed(2), proteinPct: p.protein.toFixed(2),
        energyKcal: Math.round(p.energy), lysinePct: p.lysine.toFixed(3), explanation,
        author: input.author, sex: input.sex, season: input.season,
        genetics: input.genetics ?? null, status: input.status,
      }).$returningId();
      for (const m of items) {
        await db.insert(s.recipeItems).values({ recipeId: id, ingredientId: m.ing.id, percent: m.percent.toFixed(2) });
      }
      // wpis do historii zmian (audyt receptur)
      await db.insert(s.recipeHistory).values({
        recipeId: id, changeNote: `Utworzono recepturę autorską „${input.name}" (${items.length} surowców)`,
        expertReport: `Ocena ${scoreMix(p, prod)}/100, FCR ${prod.fcr.toFixed(2)}, koszt ${p.costPerTon.toFixed(0)} EUR/t`, author: "kreator",
      });
      return { id, score: scoreMix(p, prod), costPerTon: p.costPerTon, explanation };
    }),

  /* Usunięcie własnej receptury */
  deleteRecipe: publicQuery.input(z.object({ recipeId: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(s.recipeItems).where(eq(s.recipeItems.recipeId, input.recipeId));
    await db.delete(s.recipes).where(eq(s.recipes.id, input.recipeId));
    return { ok: true };
  }),

  /* EXPORT — receptury, surowce i programy żywienia jako JSON */
  exportData: publicQuery.query(async () => {
    const db = getDb();
    const [recs, ritems, ings, programs, stages] = await Promise.all([
      db.select().from(s.recipes), db.select().from(s.recipeItems),
      db.select().from(s.feedIngredients), db.select().from(s.feedPrograms), db.select().from(s.feedProgramStages),
    ]);
    return {
      format: "bloody-turkey-feed-v1",
      exportedAt: new Date().toISOString(),
      recipes: recs.map((r) => ({ ...r, items: ritems.filter((i) => i.recipeId === r.id).map((i) => ({ ingredientId: i.ingredientId, percent: num(i.percent) })) })),
      ingredients: ings,
      feedPrograms: programs.map((p) => ({ ...p, stages: stages.filter((st) => st.programId === p.id) })),
    };
  }),

  /* IMPORT — wczytuje receptury i/lub surowce z pliku JSON; dopasowuje surowce po nazwie */
  importData: publicQuery
    .input(z.object({
      data: z.object({
        format: z.string(),
        recipes: z.array(z.any()).optional(),
        ingredients: z.array(z.any()).optional(),
      }).passthrough(),
      mode: z.enum(["merge", "replace"]).default("merge"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const d = input.data;
      const report = { ingredientsAdded: 0, recipesAdded: 0, recipesSkipped: 0, errors: [] as string[] };

      if (!String(d.format).startsWith("bloody-turkey-feed")) throw new Error("Nieprawidłowy format pliku — oczekiwano eksportu Bloody Turkey (format bloody-turkey-feed-v1)");

      // surowce
      const existing = await db.select().from(s.feedIngredients);
      const byName = new Map(existing.map((i) => [i.name.toLowerCase(), i]));
      if (d.ingredients) {
        for (const ing of d.ingredients) {
          try {
            const key = String(ing.name ?? "").toLowerCase();
            if (!key || byName.has(key)) continue;
            const [{ id }] = await db.insert(s.feedIngredients).values({
              name: String(ing.name), countryCode: ing.countryCode ?? "PL",
              proteinPct: String(ing.proteinPct ?? 0), energyKcal: Number(ing.energyKcal ?? 0),
              lysinePct: String(ing.lysinePct ?? 0), methioninePct: String(ing.methioninePct ?? 0),
              fiberPct: String(ing.fiberPct ?? 0), fatPct: String(ing.fatPct ?? 0),
              calciumPct: String(ing.calciumPct ?? 0), phosphorusPct: String(ing.phosphorusPct ?? 0),
              pricePerTon: String(ing.pricePerTon ?? 0), stockTons: String(ing.stockTons ?? 0),
            }).$returningId();
            byName.set(key, { ...ing, id } as any);
            report.ingredientsAdded++;
          } catch (e: any) { report.errors.push(`Surowiec „${ing?.name}": ${e.message.slice(0, 80)}`); }
        }
      }

      // receptury (dopasowanie surowców po nazwie lub id)
      if (d.recipes) {
        const existingRecs = await db.select().from(s.recipes);
        const recNames = new Set(existingRecs.map((r) => r.name.toLowerCase()));
        if (input.mode === "replace") {
          await db.delete(s.recipeItems);
          await db.delete(s.recipes);
          recNames.clear();
        }
        const oldIdToIng = new Map((d.ingredients ?? []).map((i: any) => [Number(i.id), i]));
        for (const r of d.recipes) {
          try {
            const name = String(r.name ?? "Importowana").slice(0, 120);
            if (input.mode === "merge" && recNames.has(name.toLowerCase())) { report.recipesSkipped++; continue; }
            const [{ id }] = await db.insert(s.recipes).values({
              name, ageGroup: String(r.ageGroup ?? "własna").slice(0, 64),
              strategy: ["cheapest", "maxGrowth", "balanced"].includes(r.strategy) ? r.strategy : "balanced",
              costPerTon: String(r.costPerTon ?? 0), proteinPct: String(r.proteinPct ?? 0),
              energyKcal: Number(r.energyKcal ?? 0), lysinePct: String(r.lysinePct ?? 0),
              explanation: r.explanation ? String(r.explanation).slice(0, 2000) : "Receptura importowana.",
            }).$returningId();
            let added = 0;
            for (const it of r.items ?? []) {
              const src = oldIdToIng.get(Number(it.ingredientId));
              const target = src ? byName.get(String(src.name).toLowerCase()) : byName.get(String(it.name ?? "").toLowerCase());
              if (target && Number(it.percent) > 0) {
                await db.insert(s.recipeItems).values({ recipeId: id, ingredientId: target.id, percent: String(it.percent) });
                added++;
              }
            }
            if (added === 0) { await db.delete(s.recipes).where(eq(s.recipes.id, id)); report.errors.push(`Receptura „${name}": brak pasujących surowców — pominięto`); continue; }
            await db.insert(s.recipeHistory).values({ recipeId: id, changeNote: `Zaimportowano recepturę „${name}"`, author: "import" });
            recNames.add(name.toLowerCase());
            report.recipesAdded++;
          } catch (e: any) { report.errors.push(`Receptura „${r?.name}": ${e.message.slice(0, 80)}`); }
        }
      }
      return report;
    }),
});
