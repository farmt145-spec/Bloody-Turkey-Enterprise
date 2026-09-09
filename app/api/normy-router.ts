/**
 * NORMY CHOWU — tygodniowe normy wagowe i żywieniowe każdej linii genetycznej
 * + bazowe zasady chowu (temperatura, wilgotność, woda) + źródła wiedzy.
 * Normy wagowe liczone z fazowych norm linii (cel masy / długość fazy).
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { requireCompanyId } from "./tenant";

/* Bazowe zasady chowu indyków — wartości otwarte, ogólne (do weryfikacji wg dostawcy linii). */
const HUSBANDRY_BY_WEEK = [
  { week: 1, tempC: "34–36", humidityPct: "60–70", waterMlPerBird: "35–70", lightH: "23–24", notes: "Podgrzewanie, stały dostęp do wody i paszy" },
  { week: 2, tempC: "31–34", humidityPct: "60–70", waterMlPerBird: "70–120", lightH: "20–22", notes: "Stopniowe obniżanie temperatury" },
  { week: 3, tempC: "28–31", humidityPct: "60–65", waterMlPerBird: "120–180", lightH: "18–20", notes: "Kontrola ściółki" },
  { week: 4, tempC: "25–28", humidityPct: "60–65", waterMlPerBird: "180–250", lightH: "16–18", notes: "Wentylacja minimum" },
  { week: 5, tempC: "23–25", humidityPct: "55–65", waterMlPerBird: "250–320", lightH: "16", notes: "" },
  { week: 6, tempC: "21–23", humidityPct: "55–65", waterMlPerBird: "320–400", lightH: "16", notes: "" },
  { week: 7, tempC: "20–22", humidityPct: "55–65", waterMlPerBird: "400–470", lightH: "14–16", notes: "" },
  { week: 8, tempC: "19–21", humidityPct: "55–65", waterMlPerBird: "470–540", lightH: "14", notes: "" },
  { week: 9, tempC: "18–20", humidityPct: "55–65", waterMlPerBird: "540–610", lightH: "14", notes: "" },
  { week: 10, tempC: "18–20", humidityPct: "55–65", waterMlPerBird: "610–680", lightH: "14", notes: "" },
  { week: 11, tempC: "18–19", humidityPct: "55–65", waterMlPerBird: "680–740", lightH: "14", notes: "" },
  { week: 12, tempC: "18–19", humidityPct: "55–65", waterMlPerBird: "740–800", lightH: "14", notes: "" },
  { week: 13, tempC: "17–19", humidityPct: "55–65", waterMlPerBird: "800–860", lightH: "14", notes: "" },
  { week: 14, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "860–920", lightH: "14", notes: "" },
  { week: 15, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "920–980", lightH: "14", notes: "" },
  { week: 16, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "980–1040", lightH: "14", notes: "" },
  { week: 17, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "1040–1100", lightH: "14", notes: "" },
  { week: 18, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "1100–1160", lightH: "14", notes: "" },
  { week: 19, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "1160–1220", lightH: "14", notes: "" },
  { week: 20, tempC: "17–18", humidityPct: "55–65", waterMlPerBird: "1220–1280", lightH: "14", notes: "" },
];

export const normyRouter = createRouter({
  /** Pełny widok norm: wszystkie linie firmy, tygodniowe normy wagowe, zasady chowu, źródła. */
  overview: publicQuery.query(async ({ ctx }) => {
    const cid = requireCompanyId(ctx);
    const db = getDb();
    const lines = await db.select().from(s.geneticLines)
      .where(and(eq(s.geneticLines.companyId, cid), ne(s.geneticLines.status, "archived")));
    const lineIds = lines.map((l) => l.id);
    const norms = lineIds.length
      ? await db.select().from(s.geneticLineNorms)
          .where(sql`${s.geneticLineNorms.geneticLineId} IN (${sql.join(lineIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    const byLine = lines.map((l) => {
      const ln = norms.filter((n) => n.geneticLineId === l.id).sort((a, b) => a.dayFrom - b.dayFrom);
      // tygodniowe normy wagowe: interpolacja liniowa w obrębie fazy
      const weeks: { week: number; targetWeightG: number; dailyGainG: number; feedPerBirdG: number; phase: string }[] = [];
      let prevW = 0;
      for (const ph of ln) {
        const wStart = Math.floor(ph.dayFrom / 7) + 1;
        const wEnd = Math.ceil(ph.dayTo / 7);
        const gainPerDay = (ph.targetWeightG - prevW) / Math.max(1, ph.dayTo - ph.dayFrom);
        for (let w = wStart; w <= wEnd && w <= 20; w++) {
          const dayEnd = Math.min(w * 7, ph.dayTo);
          const weight = Math.round(prevW + gainPerDay * (dayEnd - ph.dayFrom));
          if (!weeks.find((x) => x.week === w)) {
            weeks.push({ week: w, targetWeightG: weight, dailyGainG: Math.round(gainPerDay), feedPerBirdG: ph.feedPerBirdG, phase: ph.phaseKey });
          }
        }
        prevW = ph.targetWeightG;
      }
      return { id: l.id, name: l.name, supplier: l.supplier, phases: ln, weeks };
    });

    return {
      lines: byLine,
      husbandry: HUSBANDRY_BY_WEEK,
      sources: [
        { title: "Aviagen Turkeys — Commercial Management Guidelines (B.U.T.)", url: "https://www.aviagenturkeys.com" },
        { title: "Hybrid Turkeys — Management Guidelines", url: "https://www.hybridturkeys.com" },
        { title: "NRC — Nutrient Requirements of Poultry (9th ed.)", url: "https://nap.nationalacademies.org" },
        { title: "Wydawnictwa hodowlane — normy żywienia drobiu (PIB)", url: "https://www.gov.pl/web/izpib" },
      ],
      disclaimer: "Normy są wartościami otwartymi/roboczymi systemu — zweryfikuj z aktualnymi zaleceniami dostawcy linii genetycznej.",
    };
  }),
});
