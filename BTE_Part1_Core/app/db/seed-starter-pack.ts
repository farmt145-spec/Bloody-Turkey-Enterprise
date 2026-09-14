/**
 * STARTER PACK — pełne dane startowe dla nowo utworzonej firmy.
 * Używa seedDomainData() + dodaje przykładowy rzut z historią.
 */
import { getDb } from "../api/queries/connection";
import * as s from "./schema";
import { eq, and } from "drizzle-orm";
import { generateSchedule } from "../api/org-router";
import { seedDomainData } from "./seed-domain-data";

let seed = 99;
function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
const ri = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const rf = (min: number, max: number) => min + rnd() * (max - min);

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }

export async function seedStarterPack(companyId: number, farmId: number): Promise<void> {
  const db = getDb();
  console.log(`Starter pack dla companyId=${companyId}, farmId=${farmId}`);

  // 1. Pełne dane domenowe (normy, receptury, programy, choroby, leki, dostawcy)
  await seedDomainData(companyId);

  // 2. Przykładowy rzut na pierwszym kurniku
  const [house] = await db.select().from(s.houses)
    .where(and(eq(s.houses.farmId, farmId))).limit(1);

  if (!house) {
    console.log("Brak kurników — pomijam rzut demo.");
    return;
  }

  // Pobierz dane domenowe
  const lines = await db.select().from(s.geneticLines)
    .where(and(eq(s.geneticLines.companyId, companyId)));
  const recipes = await db.select().from(s.recipes)
    .where(eq(s.recipes.companyId, companyId));

  const today = new Date();
  const startDate = daysAgo(35);
  const initial = 5000;
  const dead = ri(30, 80);
  const current = initial - dead;

  const [{ id: batchId }] = await db.insert(s.batches).values({
    houseId: house.id, geneticLineId: lines[0]?.id ?? null,
    code: `RZ/${today.getFullYear()}/001`,
    geneticLine: lines[0]?.name ?? "B.U.T. BIG 6", sex: "toms",
    chickSupplier: "Wylęgarnia piskląt", chickPrice: "1.500",
    startDate: dateStr(startDate),
    plannedEndDate: dateStr(daysAgo(35 - 140)),
    initialCount: initial, currentCount: current, soldCount: 0,
    status: "active",
  }).$returningId();

  // Harmonogram
  await generateSchedule(batchId, dateStr(startDate), "toms");

  // Ważenia (5, 14, 21, 28, 35 dzień)
  const weights = [120, 450, 900, 1600, 2400];
  const days = [5, 14, 21, 28, 35];
  for (let i = 0; i < weights.length; i++) {
    const dayAge = days[i];
    const avgG = weights[i] + ri(-30, 30);
    await db.insert(s.weighings).values({
      batchId, weighedAt: daysAgo(35 - dayAge), dayAge,
      sampleSize: 50, avgWeightG: avgG,
      medianG: avgG + ri(-20, 20), stdDevG: Math.round(avgG * 0.1),
      minG: avgG - Math.round(avgG * 0.2), maxG: avgG + Math.round(avgG * 0.25),
      cv: "10.00", operator: "System",
    });
  }

  // Padnięcia
  let remaining = dead;
  for (let day = 1; day <= 35 && remaining > 0; day += ri(2, 5)) {
    const c = Math.min(remaining, ri(1, 5));
    remaining -= c;
    await db.insert(s.mortalities).values({
      batchId, day: dateStr(daysAgo(35 - day)), count: c,
      cause: "podbieranie",
    });
  }

  // Zużycie paszy
  for (let day = 7; day <= 35; day += 7) {
    const recipeIdx = Math.min(Math.floor(day / 15), recipes.length - 1);
    await db.insert(s.feedUsages).values({
      batchId, day: dateStr(daysAgo(35 - day)),
      kg: (current * 0.15 * day * rf(0.9, 1.1)).toFixed(1),
      recipeId: recipes[recipeIdx]?.id ?? null,
    });
  }

  // Koszty startowe
  await db.insert(s.costs).values({ batchId, category: "chicks", amount: (initial * 1.5).toFixed(2), currency: "PLN", day: dateStr(startDate) });
  await db.insert(s.costs).values({ batchId, category: "feed", amount: (current * 0.15 * 35 * 1.4).toFixed(2), currency: "PLN", day: dateStr(daysAgo(3)) });
  await db.insert(s.costs).values({ batchId, category: "energy", amount: "4500.00", currency: "PLN", day: dateStr(daysAgo(10)) });
  await db.insert(s.costs).values({ batchId, category: "litter", amount: "1800.00", currency: "PLN", day: dateStr(startDate) });

  // Szczepienia
  await db.insert(s.vaccinations).values({
    batchId, day: dateStr(daysAgo(28)), vaccine: "ND — La Sota", method: "aerozol/woda", done: true,
  });
  await db.insert(s.vaccinations).values({
    batchId, day: dateStr(daysAgo(21)), vaccine: "TRT / aMPV", method: "aerozol", done: true,
  });

  console.log("Starter pack gotowy.");
}
