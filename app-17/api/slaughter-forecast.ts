/**
 * SLAUGHTER FORECAST — prognoza optymalnego terminu uboju.
 * 
 * Model: regresja wielomianowa na danych historycznych + normy genetyczne.
 * Wejście: wiek, średnia waga, FCR, linia genetyczna, normy.
 * Wyjście: przewidywana waga w przyszłości, optymalny termin uboju, marża.
 */
import { z } from "zod";
import { eq, and, gte } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";

export const slaughterForecastRouter = createRouter({
  /** Prognoza wagi dla rzutu */
  forecastWeight: publicQuery
    .input(z.object({
      batchId: z.number(),
      forecastDays: z.number().min(1).max(60).default(30),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      // Pobierz rzut
      const [batch] = await db.select().from(s.batches)
        .where(eq(s.batches.id, input.batchId)).limit(1);
      if (!batch) throw new Error("Nie znaleziono rzutu");

      // Pobierz historię ważeń
      const weighings = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, input.batchId))
        .orderBy(s.weighings.dayAge);

      if (weighings.length < 3) {
        return { error: "Za mało danych — potrzebne min. 3 ważenia" };
      }

      // Przygotuj dane do regresji
      const points = weighings.map(w => ({
        x: w.dayAge,
        y: Number(w.avgWeightG) / 1000, // kg
      }));

      // Dopasuj krzywą wzrostu (model Gompertza)
      const params = fitGompertz(points);

      // Pobierz normy dla linii genetycznej
      const [line] = await db.select().from(s.geneticLines)
        .where(eq(s.geneticLines.id, batch.geneticLineId ?? 0)).limit(1);

      const targetWeight = batch.sex === "toms" ? 21 : 11.5; // kg

      // Oblicz prognozę na kolejne dni
      const forecast = [];
      const currentAge = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / 86400000);

      for (let day = 0; day <= input.forecastDays; day++) {
        const age = currentAge + day;
        const predictedWeight = gompertz(age, params);
        const dailyGain = gompertz(age + 1, params) - predictedWeight;

        // Sprawdź czy osiągnieł target
        const isTargetReached = predictedWeight >= targetWeight;

        forecast.push({
          day: day,
          date: new Date(Date.now() + day * 86400000).toISOString().slice(0, 10),
          ageDays: age,
          predictedWeightKg: predictedWeight.toFixed(3),
          dailyGainG: (dailyGain * 1000).toFixed(0),
          isTargetReached,
          daysToTarget: isTargetReached ? 0 : null,
        });
      }

      // Znajdź dzień osiągnięcia targetu
      const targetDay = forecast.find(f => f.isTargetReached);
      const daysToTarget = targetDay ? targetDay.day : null;

      // Oblicz FCR prognozowane
      const [latestWeighing] = weighings.slice(-1);
      const currentWeight = Number(latestWeighing.avgWeightG) / 1000;
      const currentFcr = estimateFcr(currentAge, batch.sex);

      // Koszt utrzymania per dzień (pasza + energia)
      const dailyFeedCost = batch.currentCount * currentFcr * 0.15 * 1.4; // szt × FCR × przyrost kg × cena paszy
      const dailyEnergyCost = 200; // PLN/dzień dla kurnika

      // Marża prognozowana
      const pricePerKg = 6.5; // PLN/kg żywca — TODO: pobrać z rynku
      const currentValue = batch.currentCount * currentWeight * pricePerKg;
      const targetValue = batch.currentCount * targetWeight * pricePerKg;
      const additionalCost = daysToTarget ? (dailyFeedCost + dailyEnergyCost) * daysToTarget : 0;
      const additionalRevenue = targetValue - currentValue;
      const marginalProfit = additionalRevenue - additionalCost;

      return {
        batch: {
          id: batch.id,
          code: batch.code,
          geneticLine: batch.geneticLine,
          sex: batch.sex,
          currentAge,
          currentCount: batch.currentCount,
          currentWeightKg: currentWeight.toFixed(2),
        },
        params: {
          targetWeightKg: targetWeight,
          currentFcr: currentFcr.toFixed(2),
          gompertzA: params.A.toFixed(2),
          gompertzB: params.B.toFixed(4),
          gompertzC: params.C.toFixed(4),
        },
        forecast,
        recommendation: {
          daysToTarget,
          targetDate: daysToTarget != null 
            ? new Date(Date.now() + daysToTarget * 86400000).toISOString().slice(0, 10)
            : null,
          optimalSlaughterDate: daysToTarget != null
            ? new Date(Date.now() + daysToTarget * 86400000).toISOString().slice(0, 10)
            : null,
          marginalProfit: marginalProfit.toFixed(0),
          recommendation: marginalProfit > 0
            ? `Czekaj ${daysToTarget} dni — dodatkowy zysk ${marginalProfit.toFixed(0)} PLN`
            : `Ubijaj teraz — dalszy chów przynosi stratę ${Math.abs(marginalProfit).toFixed(0)} PLN`,
          confidence: weighings.length >= 7 ? "high" : weighings.length >= 5 ? "medium" : "low",
        },
      };
    }),

  /** Porównanie wielu rzutów — który ubijać pierwszy */
  compareBatches: publicQuery
    .input(z.object({
      batchIds: z.array(z.number()).min(2).max(20),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      const results = await Promise.all(
        input.batchIds.map(async (batchId) => {
          const [batch] = await db.select().from(s.batches)
            .where(eq(s.batches.id, batchId)).limit(1);
          if (!batch) return null;

          const weighings = await db.select().from(s.weighings)
            .where(eq(s.weighings.batchId, batchId))
            .orderBy(s.weighings.dayAge);

          if (weighings.length < 3) return null;

          const points = weighings.map(w => ({
            x: w.dayAge,
            y: Number(w.avgWeightG) / 1000,
          }));

          const params = fitGompertz(points);
          const currentAge = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / 86400000);
          const currentWeight = gompertz(currentAge, params);
          const targetWeight = batch.sex === "toms" ? 21 : 11.5;

          // Znajdź dzień targetu
          let daysToTarget = null;
          for (let day = 0; day <= 60; day++) {
            if (gompertz(currentAge + day, params) >= targetWeight) {
              daysToTarget = day;
              break;
            }
          }

          return {
            batchId,
            code: batch.code,
            geneticLine: batch.geneticLine,
            sex: batch.sex,
            currentAge,
            currentWeightKg: currentWeight.toFixed(2),
            targetWeightKg: targetWeight,
            daysToTarget,
            priority: daysToTarget != null && daysToTarget <= 7 ? "high" :
                      daysToTarget != null && daysToTarget <= 14 ? "medium" : "low",
          };
        })
      );

      // Sortuj po priorytecie
      const valid = results.filter(Boolean) as any[];
      valid.sort((a, b) => {
        if (a.daysToTarget == null) return 1;
        if (b.daysToTarget == null) return -1;
        return a.daysToTarget - b.daysToTarget;
      });

      return {
        batches: valid,
        recommendation: valid.length > 0 
          ? `Ubijaj najpierw: ${valid[0].code} (za ${valid[0].daysToTarget ?? "?"} dni)`
          : "Brak wystarczających danych",
      };
    }),

  /** Trend FCR — czy efektywność się poprawia */
  getFcrTrend: publicQuery
    .input(z.object({
      batchId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      const weighings = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, input.batchId))
        .orderBy(s.weighings.dayAge);

      const feedUsages = await db.select().from(s.feedUsages)
        .where(eq(s.feedUsages.batchId, input.batchId))
        .orderBy(s.feedUsages.day);

      // Oblicz FCR per okres między ważeniami
      const fcrHistory = [];
      for (let i = 1; i < weighings.length; i++) {
        const prev = weighings[i - 1];
        const curr = weighings[i];

        const daysDiff = curr.dayAge - prev.dayAge;
        const weightGainG = Number(curr.avgWeightG) - Number(prev.avgWeightG);

        // Znajdź zużycie paszy w tym okresie
        const periodFeed = feedUsages.filter(f => {
          const feedDay = Math.floor((new Date(f.day).getTime() - new Date(weighings[0].weighedAt).getTime()) / 86400000);
          return feedDay >= prev.dayAge && feedDay < curr.dayAge;
        });

        const feedKg = periodFeed.reduce((a, f) => a + Number(f.kg), 0);

        if (weightGainG > 0 && feedKg > 0) {
          // FCR = kg paszy / kg przyrostu
          const weightGainKg = weightGainG / 1000;
          const fcr = feedKg / weightGainKg;

          fcrHistory.push({
            periodDays: `${prev.dayAge}-${curr.dayAge}`,
            daysDiff,
            weightGainG,
            feedKg: feedKg.toFixed(0),
            fcr: fcr.toFixed(2),
          });
        }
      }

      // Trend
      const fcrValues = fcrHistory.map(f => Number(f.fcr));
      const trend = fcrValues.length >= 2 
        ? fcrValues[fcrValues.length - 1] - fcrValues[0]
        : 0;

      return {
        history: fcrHistory,
        currentFcr: fcrValues.length > 0 ? fcrValues[fcrValues.length - 1] : null,
        avgFcr: fcrValues.length > 0 
          ? fcrValues.reduce((a, b) => a + b, 0) / fcrValues.length 
          : null,
        trend: trend.toFixed(2),
        trendDirection: trend < -0.1 ? "improving" : trend > 0.1 ? "worsening" : "stable",
      };
    }),
});

/* ═══════════════════════════════════════════════════════════════
   MODEL GOMPERTZA — krzywa wzrostu ptaków
   W(t) = A × exp(-B × exp(-C × t))
   ═══════════════════════════════════════════════════════════════ */

interface GompertzParams {
  A: number; // asymptota — waga dorosła
  B: number; // parametr przesunięcia
  C: number; // parametr wzrostu
}

function gompertz(t: number, params: GompertzParams): number {
  return params.A * Math.exp(-params.B * Math.exp(-params.C * t));
}

function fitGompertz(points: { x: number; y: number }[]): GompertzParams {
  // Inicjalizacja
  const maxY = Math.max(...points.map(p => p.y));
  let A = maxY * 1.2; // asymptota nieco powyżej max
  let B = 3;
  let C = 0.03;

  // Prosta optymalizacja gradientowa
  const learningRate = 0.0001;
  const iterations = 1000;

  for (let iter = 0; iter < iterations; iter++) {
    let dA = 0, dB = 0, dC = 0;
    let error = 0;

    for (const p of points) {
      const pred = gompertz(p.x, { A, B, C });
      const diff = pred - p.y;
      error += diff * diff;

      // Pochodne cząstkowe
      const exp1 = Math.exp(-B * Math.exp(-C * p.x));
      const exp2 = Math.exp(-C * p.x);

      dA += 2 * diff * exp1;
      dB += 2 * diff * A * exp1 * (-exp2);
      dC += 2 * diff * A * exp1 * B * exp2 * p.x;
    }

    A -= learningRate * dA;
    B -= learningRate * dB;
    C -= learningRate * dC;

    // Ograniczenia
    A = Math.max(A, maxY);
    B = Math.max(B, 0.1);
    C = Math.max(C, 0.001);
  }

  return { A, B, C };
}

function estimateFcr(ageDays: number, sex: string): number {
  // FCR rośnie z wiekiem — indory mają wyższe FCR niż indyczki
  const baseFcr = sex === "toms" ? 2.0 : 1.9;
  const ageFactor = 1 + Math.max(0, (ageDays - 28) * 0.005);
  return baseFcr * ageFactor;
}
