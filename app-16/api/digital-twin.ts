/**
 * DIGITAL TWIN — wirtualny model kurnika 3D.
 * Symulacja: wentylacja, temperatura, gęstość, rozmieszczenie karmników.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";

export const digitalTwinRouter = createRouter({
  /** Pobierz model 3D kurnika */
  getModel: publicQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [house] = await db.select().from(s.houses)
        .where(eq(s.houses.id, input.houseId)).limit(1);

      if (!house) throw new Error("Nie znaleziono kurnika");

      // Pobierz aktywny rzut
      const [batch] = await db.select().from(s.batches)
        .where(eq(s.batches.houseId, input.houseId))
        .limit(1);

      // Pobierz ostatnie ważenie
      const [weighing] = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, batch?.id ?? 0))
        .orderBy(s.weighings.weighedAt, "desc")
        .limit(1);

      // Oblicz parametry
      const areaM2 = Number(house.areaM2);
      const birdCount = batch?.currentCount ?? 0;
      const avgWeightKg = weighing ? Number(weighing.avgWeightG) / 1000 : 0;
      const totalWeightKg = birdCount * avgWeightKg;
      const density = areaM2 > 0 ? totalWeightKg / areaM2 : 0;
      const maxDensity = Number(house.maxDensityKgM2 ?? 42);

      // Generuj model 3D
      const model = {
        house: {
          id: house.id,
          name: house.name,
          type: house.houseType,
          dimensions: {
            lengthM: Math.sqrt(areaM2 * 1.5), // przybliżenie
            widthM: Math.sqrt(areaM2 / 1.5),
            heightM: house.houseType === "brooder" ? 2.5 : 3.5,
          },
          areaM2,
          maxDensityKgM2: maxDensity,
        },

        batch: batch ? {
          id: batch.id,
          code: batch.code,
          birdCount,
          avgWeightKg: avgWeightKg.toFixed(2),
          totalWeightKg: totalWeightKg.toFixed(0),
          ageDays: Math.floor((Date.now() - new Date(batch.startDate).getTime()) / 86400000),
          density: density.toFixed(1),
          densityStatus: density > maxDensity ? "overcrowded" : density > maxDensity * 0.9 ? "warning" : "ok",
        } : null,

        // Elementy wyposażenia (generowane)
        equipment: generateEquipment(areaM2, house.houseType),

        // Strefy kurnika
        zones: generateZones(areaM2),

        // Symulacja wentylacji
        ventilation: {
          required: calculateVentilation(totalWeightKg, avgWeightKg),
          recommended: calculateVentilation(totalWeightKg, avgWeightKg) * 1.2,
        },

        // Symulacja oświetlenia
        lighting: {
          requiredLux: batch?.ageDays && batch.ageDays < 7 ? 30 : 10,
          hoursPerDay: batch?.ageDays && batch.ageDays < 7 ? 23 : 16,
        },
      };

      return model;
    }),

  /** Symulacja rozmieszczenia karmników */
  simulateFeeders: publicQuery
    .input(z.object({
      houseId: z.number(),
      feederType: z.enum(["pan", "chain", "tube"]).default("pan"),
      feederCount: z.number().min(1).max(100),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      const [house] = await db.select().from(s.houses)
        .where(eq(s.houses.id, input.houseId)).limit(1);

      if (!house) throw new Error("Nie znaleziono kurnika");

      const areaM2 = Number(house.areaM2);
      const [batch] = await db.select().from(s.batches)
        .where(eq(s.batches.houseId, input.houseId))
        .limit(1);

      const birdCount = batch?.currentCount ?? 0;

      // Pojemność karmnika per typ
      const capacityPerFeeder = {
        pan: 12,    // 12 ptaków per karmnik
        chain: 50,  // 50 ptaków per metr łańcucha
        tube: 16,   // 16 ptaków per rura
      };

      const capacity = capacityPerFeeder[input.feederType] * input.feederCount;
      const coverage = birdCount > 0 ? (capacity / birdCount) * 100 : 0;

      // Optymalna liczba karmników
      const optimalCount = Math.ceil(birdCount / capacityPerFeeder[input.feederType]);

      // Rozmieszczenie w siatce
      const gridSize = Math.ceil(Math.sqrt(input.feederCount));
      const spacing = Math.sqrt(areaM2) / (gridSize + 1);

      const positions = [];
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize && positions.length < input.feederCount; j++) {
          positions.push({
            x: spacing * (i + 1),
            y: spacing * (j + 1),
          });
        }
      }

      return {
        feederType: input.feederType,
        feederCount: input.feederCount,
        birdCount,
        capacity,
        coverage: coverage.toFixed(1),
        isSufficient: capacity >= birdCount,
        optimalCount,
        deficit: Math.max(0, optimalCount - input.feederCount),
        positions,
        recommendation: capacity >= birdCount 
          ? "OK — karmniki wystarczające"
          : `Brakuje ${optimalCount - input.feederCount} karmników — ptaki nie będą miały równomiernego dostępu do paszy`,
      };
    }),

  /** Symulacja wentylacji */
  simulateVentilation: publicQuery
    .input(z.object({
      houseId: z.number(),
      targetTempC: z.number().min(15).max(35).default(22),
      outsideTempC: z.number().min(-20).max(45).default(20),
      outsideHumidityPct: z.number().min(0).max(100).default(60),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      const [house] = await db.select().from(s.houses)
        .where(eq(s.houses.id, input.houseId)).limit(1);

      if (!house) throw new Error("Nie znaleziono kurnika");

      const [batch] = await db.select().from(s.batches)
        .where(eq(s.batches.houseId, input.houseId))
        .limit(1);

      const birdCount = batch?.currentCount ?? 0;
      const [weighing] = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, batch?.id ?? 0))
        .orderBy(s.weighings.weighedAt, "desc")
        .limit(1);

      const avgWeightKg = weighing ? Number(weighing.avgWeightG) / 1000 : 1;
      const totalWeightKg = birdCount * avgWeightKg;

      // Obliczenia wentylacji
      // Minimum: 0.7 m³/h/kg przy 20°C, rośnie przy wyższej temperaturze
      const tempFactor = 1 + Math.max(0, (input.outsideTempC - 20) * 0.05);
      const minVentilation = totalWeightKg * 0.7 * tempFactor;

      // Maksimum dla usuwania ciepła
      const heatProduction = totalWeightKg * 5.5; // W przy 20°C
      const tempDiff = input.targetTempC - input.outsideTempC;
      const maxVentilation = tempDiff > 0 
        ? heatProduction / (1.2 * 1005 * tempDiff) * 3600 // m³/h
        : minVentilation * 3;

      // Wilgotność
      const waterProduction = totalWeightKg * 5.5 / 1000; // kg/h
      const humidityRatioOutside = input.outsideHumidityPct / 100 * 0.015; // kg/kg
      const targetHumidityRatio = 0.70 * 0.015;
      const ventilationForHumidity = waterProduction / (targetHumidityRatio - humidityRatioOutside) / 1.2;

      const requiredVentilation = Math.max(minVentilation, maxVentilation, ventilationForHumidity);

      // Liczba wentylatorów (zakładamy 20,000 m³/h per wentylator)
      const fanCapacity = 20000;
      const fansNeeded = Math.ceil(requiredVentilation / fanCapacity);

      return {
        inputs: {
          birdCount,
          avgWeightKg: avgWeightKg.toFixed(2),
          totalWeightKg: totalWeightKg.toFixed(0),
          targetTempC: input.targetTempC,
          outsideTempC: input.outsideTempC,
        },
        calculations: {
          minVentilation: minVentilation.toFixed(0),
          maxVentilation: maxVentilation.toFixed(0),
          ventilationForHumidity: ventilationForHumidity.toFixed(0),
          requiredVentilation: requiredVentilation.toFixed(0),
        },
        recommendation: {
          fansNeeded,
          fanCapacity,
          totalCapacity: fansNeeded * fanCapacity,
          isSufficient: fansNeeded * fanCapacity >= requiredVentilation,
          airExchangePerHour: (requiredVentilation / Number(house.areaM2) / 3).toFixed(1),
        },
      };
    }),
});

function generateEquipment(areaM2: number, houseType: string) {
  const equipment = [];

  // Karmniki
  const feederCount = Math.ceil(areaM2 / 50);
  for (let i = 0; i < feederCount; i++) {
    equipment.push({
      type: "feeder",
      id: `feeder-${i}`,
      position: { x: (i % 5) * 3 + 2, y: Math.floor(i / 5) * 4 + 2 },
    });
  }

  // Poidła
  const drinkerCount = Math.ceil(areaM2 / 80);
  for (let i = 0; i < drinkerCount; i++) {
    equipment.push({
      type: "drinker",
      id: `drinker-${i}`,
      position: { x: (i % 4) * 4 + 1, y: Math.floor(i / 4) * 5 + 1 },
    });
  }

  // Wentylatory
  const fanCount = Math.ceil(areaM2 / 200);
  for (let i = 0; i < fanCount; i++) {
    equipment.push({
      type: "fan",
      id: `fan-${i}`,
      position: { x: areaM2 / 10 - 1, y: i * 3 + 1.5 },
    });
  }

  // Ogrzewanie (brooder)
  if (houseType === "brooder") {
    const heaterCount = Math.ceil(areaM2 / 100);
    for (let i = 0; i < heaterCount; i++) {
      equipment.push({
        type: "heater",
        id: `heater-${i}`,
        position: { x: (i % 3) * 5 + 2.5, y: Math.floor(i / 3) * 6 + 3 },
      });
    }
  }

  return equipment;
}

function generateZones(areaM2: number) {
  // Podział na strefy: karmienie, pojenie, odpoczynek
  const zones = [];
  const zoneCount = 3;
  const zoneWidth = Math.sqrt(areaM2) / zoneCount;

  for (let i = 0; i < zoneCount; i++) {
    zones.push({
      id: `zone-${i}`,
      name: ["Strefa karmienia", "Strefa pojenia", "Strefa odpoczynku"][i],
      bounds: {
        x: i * zoneWidth,
        y: 0,
        width: zoneWidth,
        height: Math.sqrt(areaM2),
      },
    });
  }

  return zones;
}

function calculateVentilation(totalWeightKg: number, avgWeightKg: number): number {
  // Minimum 0.7 m³/h/kg, więcej dla cięższych ptaków
  const baseRate = 0.7;
  const weightFactor = 1 + Math.max(0, (avgWeightKg - 1) * 0.1);
  return totalWeightKg * baseRate * weightFactor;
}
