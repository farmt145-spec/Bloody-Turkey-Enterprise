import "dotenv/config";
import { getDb } from "../api/queries/connection";
import * as s from "./schema";
import { eq } from "drizzle-orm";

/* Tom III — rozszerzone parametry fizykochemiczne surowców (wartości tablicowe) */
const EXT: Record<string, any> = {
  "Pszenica": { moisturePct: "13", ashPct: "1.8", starchPct: "60", cystinePct: "0.25", threoninePct: "0.33", tryptophanPct: "0.15", argininePct: "0.62", sodiumPct: "0.02", code: "PSZ-PL-01", producer: "Krajowe zbiory" },
  "Kukurydza": { moisturePct: "13.5", ashPct: "1.3", starchPct: "65", cystinePct: "0.2", threoninePct: "0.3", tryptophanPct: "0.07", argininePct: "0.42", sodiumPct: "0.01", code: "KUK-HU-01", producer: "Dunakeszi Agro" },
  "Śruta sojowa 48%": { moisturePct: "12", ashPct: "6.2", starchPct: "5", cystinePct: "0.72", threoninePct: "1.88", tryptophanPct: "0.65", argininePct: "3.5", sodiumPct: "0.03", code: "SOJ-NL-48", producer: "Cargill NL" },
  "Śruta rzepakowa": { moisturePct: "11", ashPct: "7", starchPct: "3", cystinePct: "0.85", threoninePct: "1.6", tryptophanPct: "0.45", argininePct: "2.1", sodiumPct: "0.05", code: "RZE-PL-01", producer: "Kruszwica" },
  "Tłuszcz drobiowy": { moisturePct: "0.5", ashPct: "0", starchPct: "0", cystinePct: "0", threoninePct: "0", tryptophanPct: "0", argininePct: "0", sodiumPct: "0", code: "TLO-DE-01", producer: "SARIA Bio" },
  "Premiks witaminowo-mineralny": { moisturePct: "6", ashPct: "60", starchPct: "0", cystinePct: "0", threoninePct: "0", tryptophanPct: "0", argininePct: "0", sodiumPct: "8", code: "PRX-DK-01", producer: "DSM Nutritional" },
  "Węglan wapnia": { moisturePct: "0.2", ashPct: "96", starchPct: "0", cystinePct: "0", threoninePct: "0", tryptophanPct: "0", argininePct: "0", sodiumPct: "0.05", code: "WAP-PL-01", producer: "Górażdże" },
  "Jęczmień": { moisturePct: "13", ashPct: "2.4", starchPct: "52", cystinePct: "0.28", threoninePct: "0.36", tryptophanPct: "0.16", argininePct: "0.55", sodiumPct: "0.03", code: "JEC-DE-01", producer: "BayWa" },
  "DDGS kukurydziany": { moisturePct: "10", ashPct: "4.5", starchPct: "6", cystinePct: "0.5", threoninePct: "1.0", tryptophanPct: "0.2", argininePct: "1.1", sodiumPct: "0.3", code: "DDG-PL-01", producer: "Bioagra" },
  "Olej sojowy": { moisturePct: "0.3", ashPct: "0", starchPct: "0", cystinePct: "0", threoninePct: "0", tryptophanPct: "0", argininePct: "0", sodiumPct: "0", code: "OLE-NL-01", producer: "Bunge" },
  "Mączka rybna 65%": { moisturePct: "9", ashPct: "18", starchPct: "0", cystinePct: "0.6", threoninePct: "2.7", tryptophanPct: "0.7", argininePct: "3.8", sodiumPct: "0.8", code: "RYB-DK-65", producer: "TripleNine" },
  "Otręby pszenne": { moisturePct: "13", ashPct: "5.5", starchPct: "18", cystinePct: "0.35", threoninePct: "0.5", tryptophanPct: "0.25", argininePct: "0.95", sodiumPct: "0.05", code: "OTR-PL-01", producer: "Młyny Polskie" },
};
async function main() {
  const db = getDb();
  const ings = await db.select().from(s.feedIngredients);
  let updated = 0, fallback = 0;
  for (const i of ings) {
    const ext = EXT[i.name];
    if (ext) {
      await db.update(s.feedIngredients).set(ext).where(eq(s.feedIngredients.id, i.id));
      updated++;
    } else {
      // wartości szacunkowe: wilgotność standard, aminokwasy proporcjonalnie do białka
      const p = Number(i.proteinPct);
      await db.update(s.feedIngredients).set({
        moisturePct: i.name.toLowerCase().includes("olej") || i.name.toLowerCase().includes("tłuszcz") ? "0.5" : "12",
        cystinePct: (p * 0.016).toFixed(2), threoninePct: (p * 0.036).toFixed(2),
        tryptophanPct: (p * 0.012).toFixed(2), argininePct: (p * 0.07).toFixed(2),
        starchPct: i.energyKcal > 3000 && p < 16 ? "55" : "2",
      } as any).where(eq(s.feedIngredients.id, i.id));
      fallback++;
    }
  }
  console.log(`OK: ${updated} dokładnych kart + ${fallback} szacunkowych`);
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
