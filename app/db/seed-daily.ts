import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { eq, and } from "drizzle-orm";

let s = 7;
function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }
const rf = (min: number, max: number) => min + rnd() * (max - min);
const ri = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));

async function main() {
  const db = getDb();
  const today = new Date();
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  console.log("Czyszczenie dzienników...");
  await db.delete(schema.dailyLogs);
  await db.delete(schema.feedDeliveries);
  await db.delete(schema.feedProgramStages);
  await db.delete(schema.feedPrograms);

  const active = await db.select().from(schema.batches).where(eq(schema.batches.status, "active"));
  const recipes = await db.select().from(schema.recipes);
  const silos = await db.select().from(schema.silos);
  const companies = await db.select().from(schema.companies);

  console.log(`Dzienniki dla ${active.length} rzutów (ostatnie 14 dni)...`);
  for (const b of active) {
    const start = new Date(b.startDate);
    const ageDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    const days = Math.min(14, Math.max(0, ageDays));
    const w = await db.select().from(schema.weighings)
      .where(eq(schema.weighings.batchId, b.id));
    const lastW = w.sort((a, b2) => b2.dayAge - a.dayAge)[0];
    const avgG = lastW?.avgWeightG ?? 1000;

    for (let back = days; back >= 1; back--) {
      const d = new Date(today); d.setDate(d.getDate() - back);
      const birds = b.currentCount;
      const feedPerBirdG = avgG * rf(0.075, 0.095);
      const waterPerBirdMl = feedPerBirdG * rf(1.7, 2.1);
      await db.insert(schema.dailyLogs).values({
        batchId: b.id, day: dateStr(d),
        mortality: rnd() < 0.75 ? ri(0, Math.max(2, Math.round(birds * 0.0006))) : 0,
        culls: rnd() < 0.2 ? ri(1, 4) : 0,
        waterLiters: ((birds * waterPerBirdMl) / 1000 * rf(0.95, 1.05)).toFixed(1),
        feedKg: ((birds * feedPerBirdG) / 1000 * rf(0.95, 1.05)).toFixed(1),
        tempC: rf(18, 24).toFixed(1),
        humidityPct: rf(55, 75).toFixed(1),
        ammoniaPpm: rf(3, 18).toFixed(1),
      });
    }
  }

  console.log("Programy żywienia...");
  const programDefs = [
    {
      name: "Program standardowy — indory (Hybrid)", sex: "toms" as const,
      stages: [
        { name: "Starter", dayFrom: 0, dayTo: 28, recipeIdx: 0, protein: 27.5, feedG: 60 },
        { name: "Grower I", dayFrom: 29, dayTo: 56, recipeIdx: 1, protein: 24.5, feedG: 220 },
        { name: "Grower II", dayFrom: 57, dayTo: 77, recipeIdx: 1, protein: 22.0, feedG: 380 },
        { name: "Finisher I", dayFrom: 78, dayTo: 105, recipeIdx: 2, protein: 20.0, feedG: 520 },
        { name: "Finisher II", dayFrom: 106, dayTo: 140, recipeIdx: 2, protein: 17.5, feedG: 620 },
      ],
    },
    {
      name: "Program standardowy — indyczki", sex: "hens" as const,
      stages: [
        { name: "Starter", dayFrom: 0, dayTo: 28, recipeIdx: 0, protein: 27.5, feedG: 55 },
        { name: "Grower", dayFrom: 29, dayTo: 63, recipeIdx: 1, protein: 23.0, feedG: 240 },
        { name: "Finisher", dayFrom: 64, dayTo: 112, recipeIdx: 2, protein: 18.5, feedG: 430 },
      ],
    },
  ];
  for (const pd of programDefs) {
    const [{ id: pid }] = await db.insert(schema.feedPrograms)
      .values({ companyId: companies[0].id, name: pd.name, sex: pd.sex }).$returningId();
    for (const st of pd.stages) {
      await db.insert(schema.feedProgramStages).values({
        programId: pid, name: st.name, dayFrom: st.dayFrom, dayTo: st.dayTo,
        recipeId: recipes[st.recipeIdx]?.id ?? null,
        proteinTargetPct: st.protein.toFixed(2), feedPerBirdG: st.feedG,
      });
    }
  }

  console.log("Wydania paszy z silosów...");
  for (const sl of silos) {
    // rzuty na tej samej fermie co silos
    const houses = await db.select().from(schema.houses).where(eq(schema.houses.farmId, sl.farmId));
    const houseIds = new Set(houses.map((h) => h.id));
    const farmBatches = active.filter((b) => houseIds.has(b.houseId));
    for (const b of farmBatches.slice(0, 2)) {
      const kg = Math.min(ri(3000, 9000), Math.round(Number(sl.currentTons) * 800));
      if (kg <= 0) continue;
      const d = new Date(today); d.setDate(d.getDate() - ri(0, 5));
      await db.insert(schema.feedDeliveries).values({
        siloId: sl.id, batchId: b.id, day: dateStr(d), kg: kg.toFixed(1),
        recipeId: sl.recipeId ?? recipes[0]?.id,
      });
      await db.update(schema.silos)
        .set({ currentTons: Math.max(0.5, Number(sl.currentTons) - kg / 1000).toFixed(2) })
        .where(eq(schema.silos.id, sl.id));
    }
  }

  console.log("Gotowe.");
  process.exit(0);
}

main();
