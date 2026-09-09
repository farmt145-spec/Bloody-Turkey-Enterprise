/* Seed uzupełniający — dodatkowe surowce paszowe (idempotentny) */
import { getDb } from "../api/queries/connection";
import * as s from "./schema";

const NEW: [string, string, number, number, number, number, number, number, number, number, number, number][] = [
  // name, cc, priceEUR/t, protein, energy, lysine, methionine, fiber, fat, Ca, P, stockT
  ["DDGS kukurydziany", "PL", 265, 27, 2900, 0.62, 0.52, 8.5, 9.0, 0.05, 0.75, 40],
  ["Śruta słonecznikowa", "UA", 240, 34, 2100, 1.15, 0.7, 18.0, 2.0, 0.35, 1.0, 25],
  ["Otręby pszenne", "PL", 150, 15.5, 1750, 0.55, 0.2, 11.0, 4.0, 0.12, 1.15, 60],
  ["Mączka rybna 65%", "DK", 1350, 65, 3100, 4.9, 1.9, 0.5, 9.0, 4.5, 2.6, 8],
  ["Mączka mięsno-kostna", "PL", 520, 50, 2400, 2.6, 0.7, 2.0, 11.0, 8.5, 4.2, 15],
  ["Sól jodowana", "PL", 95, 0, 0, 0, 0, 0, 0, 0, 0, 100],
  ["Soda oczyszczona", "PL", 240, 0, 0, 0, 0, 0, 0, 0, 0, 40],
  ["Fitaza (enzym)", "DK", 4200, 0, 0, 0, 0, 0, 0, 0, 0, 5],
  ["Ksylanaza (enzym)", "FI", 3800, 0, 0, 0, 0, 0, 0, 0, 0, 4],
  ["Kwasek cytrynowy", "PL", 1100, 0, 0, 0, 0, 0, 0, 0, 0, 10],
  ["Zaprawa kokcydiostatyczna", "PL", 5200, 0, 0, 0, 0, 0, 0, 0, 0, 6],
  ["L-treonina", "CN", 1850, 72, 4200, 0, 0, 0, 0, 0, 0, 7],
  ["L-tryptofan", "CN", 9800, 82, 4300, 0, 0, 0, 0, 0, 0, 2],
  ["Cholina chloride 60%", "PL", 980, 0, 0, 0, 0, 0, 0, 0, 0, 12],
  ["Witamina E 50%", "CH", 6400, 0, 0, 0, 0, 0, 0, 0, 0, 3],
];

async function main() {
  const db = getDb();
  const existing = new Set((await db.select().from(s.feedIngredients)).map((i) => i.name));
  let added = 0;
  for (const [name, cc, price, protein, energy, lys, met, fiber, fat, ca, p, stock] of NEW) {
    if (existing.has(name)) continue;
    await db.insert(s.feedIngredients).values({
      companyId: 1, name, countryCode: cc, pricePerTon: String(price),
      proteinPct: String(protein), energyKcal: energy, lysinePct: String(lys),
      methioninePct: String(met), fiberPct: String(fiber), fatPct: String(fat),
      calciumPct: String(ca), phosphorusPct: String(p), stockTons: String(stock),
    });
    added++;
  }
  console.log(`Dodano ${added} nowych surowców (razem ${existing.size + added}).`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
