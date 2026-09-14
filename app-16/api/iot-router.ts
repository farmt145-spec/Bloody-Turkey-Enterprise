/**
 * IoT ROUTER — odczyty z czujników, alerty, agregacje.
 * 
 * Endpointy:
 * - ingest — przyjmowanie danych z urządzeń (MQTT/HTTP)
 * - getCurrent — aktualne wartości per kurnik
 * - getHistory — historia odczytów z filtrami
 * - getAlerts — lista alertów
 * - resolveAlert — oznacz alert jako rozwiązany
 * - getNorms — normy środowiskowe per wiek
 * - checkThresholds — sprawdzenie czy wartości są w normie
 */
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import { createRouter, publicQuery, protectedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import * as iot from "../db/schema-iot";

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const iotRouter = createRouter({
  /** Ingest danych z czujnika — wywoływane przez urządzenie lub MQTT bridge */
  ingest: publicQuery
    .input(z.object({
      serialNumber: z.string(),
      value: z.number(),
      unit: z.string().max(20),
      deviceTime: z.string().datetime().optional(),
      batteryPct: z.number().min(0).max(100).optional(),
      signalQuality: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Znajdź czujnik po serial number
      const [sensor] = await db.select().from(iot.sensors)
        .where(eq(iot.sensors.serialNumber, input.serialNumber)).limit(1);

      if (!sensor) {
        throw new Error(`Nie znaleziono czujnika: ${input.serialNumber}`);
      }

      if (!sensor.isActive) {
        throw new Error(`Czujnik nieaktywny: ${input.serialNumber}`);
      }

      // Znajdź aktywny rzut w kurniku
      const [batch] = await db.select().from(s.batches)
        .where(and(
          eq(s.batches.houseId, sensor.houseId),
          eq(s.batches.status, "active")
        ))
        .limit(1);

      // Zapisz odczyt
      const deviceTime = input.deviceTime ? new Date(input.deviceTime) : new Date();
      const [{ id: readingId }] = await db.insert(iot.sensorReadings).values({
        sensorId: sensor.id,
        houseId: sensor.houseId,
        batchId: batch?.id ?? null,
        value: input.value.toFixed(3),
        unit: input.unit,
        deviceTime,
        batteryPct: input.batteryPct ?? null,
        signalQuality: input.signalQuality ?? null,
      }).$returningId();

      // Aktualizuj lastSeenAt czujnika
      await db.update(iot.sensors)
        .set({ lastSeenAt: new Date(), batteryPct: input.batteryPct ?? sensor.batteryPct })
        .where(eq(iot.sensors.id, sensor.id));

      // Sprawdź progi i utwórz alert jeśli potrzeba
      let alertCreated = false;
      if (sensor.alertEnabled && sensor.minThreshold != null && sensor.maxThreshold != null) {
        const val = input.value;
        const min = num(sensor.minThreshold);
        const max = num(sensor.maxThreshold);

        if (val < min || val > max) {
          // Sprawdź cooldown — czy był ostatni alert
          const recentAlert = await db.select().from(iot.environmentAlerts)
            .where(and(
              eq(iot.environmentAlerts.sensorId, sensor.id),
              eq(iot.environmentAlerts.isResolved, false),
              gte(iot.environmentAlerts.createdAt, new Date(Date.now() - sensor.alertCooldownMin * 60000))
            ))
            .limit(1);

          if (recentAlert.length === 0) {
            const type = val < min ? "threshold_below" : "threshold_exceeded";
            const severity = sensor.type === "temperature" || sensor.type === "nh3" ? "critical" : "warning";

            await db.insert(iot.environmentAlerts).values({
              companyId: sensor.companyId,
              farmId: sensor.farmId,
              houseId: sensor.houseId,
              sensorId: sensor.id,
              batchId: batch?.id ?? null,
              type,
              severity,
              value: val.toFixed(3),
              threshold: (val < min ? min : max).toFixed(3),
              unit: input.unit,
              title: `${sensor.name}: ${val.toFixed(1)}${input.unit} ${val < min ? "poniżej" : "powyżej"} normy`,
              message: `Czujnik ${sensor.name} w kurniku ${sensor.houseId} wykrył wartość ${val.toFixed(1)}${input.unit} (norma: ${min}-${max}${input.unit}). ${severity === "critical" ? "WYMAGA NATYCHMIASTOWEJ INTERWENCJI!" : "Wymaga monitorowania."}`,
            });

            alertCreated = true;
          }
        }
      }

      return { ok: true, readingId, alertCreated };
    }),

  /** Aktualne wartości ze wszystkich czujników w kurniku */
  getCurrent: publicQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const sensors = await db.select().from(iot.sensors)
        .where(and(eq(iot.sensors.houseId, input.houseId), eq(iot.sensors.isActive, true)));

      const result = await Promise.all(sensors.map(async (sensor) => {
        const [latest] = await db.select().from(iot.sensorReadings)
          .where(eq(iot.sensorReadings.sensorId, sensor.id))
          .orderBy(desc(iot.sensorReadings.deviceTime))
          .limit(1);

        // Sprawdź czy sensor jest online (ostatni odczyt < 5 min)
        const isOnline = latest && (Date.now() - new Date(latest.serverTime).getTime()) < 5 * 60 * 1000;

        return {
          sensor,
          latest: latest ?? null,
          isOnline,
          status: !isOnline ? "offline" 
            : latest && num(latest.value) < num(sensor.minThreshold ?? 0) ? "below"
            : latest && num(latest.value) > num(sensor.maxThreshold ?? 999) ? "above"
            : "ok",
        };
      }));

      return result;
    }),

  /** Historia odczytów z filtrami */
  getHistory: publicQuery
    .input(z.object({
      sensorId: z.number().optional(),
      houseId: z.number().optional(),
      type: z.enum(["temperature", "humidity", "nh3", "co2", "light", "pressure", "water_flow", "feed_level"]).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().min(1).max(10000).default(500),
      resolution: z.enum(["raw", "hourly", "daily"]).default("raw"),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      if (input.resolution === "hourly") {
        // Agregacje godzinowe
        let query = db.select().from(iot.sensorHourly);
        if (input.sensorId) query = query.where(eq(iot.sensorHourly.sensorId, input.sensorId));
        if (input.houseId) query = query.where(eq(iot.sensorHourly.houseId, input.houseId));
        if (input.from) query = query.where(gte(iot.sensorHourly.hour, new Date(input.from)));
        if (input.to) query = query.where(lte(iot.sensorHourly.hour, new Date(input.to)));

        return await query.orderBy(desc(iot.sensorHourly.hour)).limit(input.limit);
      }

      // Raw readings
      let query = db.select().from(iot.sensorReadings);
      if (input.sensorId) query = query.where(eq(iot.sensorReadings.sensorId, input.sensorId));
      if (input.houseId) query = query.where(eq(iot.sensorReadings.houseId, input.houseId));
      if (input.from) query = query.where(gte(iot.sensorReadings.deviceTime, new Date(input.from)));
      if (input.to) query = query.where(lte(iot.sensorReadings.deviceTime, new Date(input.to)));

      return await query.orderBy(desc(iot.sensorReadings.deviceTime)).limit(input.limit);
    }),

  /** Lista alertów */
  getAlerts: publicQuery
    .input(z.object({
      houseId: z.number().optional(),
      farmId: z.number().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      isResolved: z.boolean().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      let query = db.select().from(iot.environmentAlerts)
        .where(eq(iot.environmentAlerts.companyId, cid));

      if (input.houseId) query = query.where(eq(iot.environmentAlerts.houseId, input.houseId));
      if (input.farmId) query = query.where(eq(iot.environmentAlerts.farmId, input.farmId));
      if (input.severity) query = query.where(eq(iot.environmentAlerts.severity, input.severity));
      if (input.isResolved !== undefined) query = query.where(eq(iot.environmentAlerts.isResolved, input.isResolved));

      return await query.orderBy(desc(iot.environmentAlerts.createdAt)).limit(input.limit);
    }),

  /** Oznacz alert jako rozwiązany */
  resolveAlert: protectedQuery
    .input(z.object({
      alertId: z.number(),
      resolution: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.update(iot.environmentAlerts)
        .set({
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: ctx.user?.id,
          resolution: input.resolution,
        })
        .where(eq(iot.environmentAlerts.id, input.alertId));

      return { ok: true };
    }),

  /** Normy środowiskowe per wiek */
  getNorms: publicQuery
    .input(z.object({
      geneticLineId: z.number().optional(),
      dayAge: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      let query = db.select().from(iot.environmentNorms);
      if (input.geneticLineId) query = query.where(eq(iot.environmentNorms.geneticLineId, input.geneticLineId));
      if (input.dayAge !== undefined) {
        query = query.where(and(
          lte(iot.environmentNorms.dayFrom, input.dayAge),
          gte(iot.environmentNorms.dayTo, input.dayAge)
        ));
      }

      return await query;
    }),

  /** Sprawdź aktualne wartości vs normy */
  checkThresholds: publicQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Pobierz aktywny rzut
      const [batch] = await db.select().from(s.batches)
        .where(and(eq(s.batches.houseId, input.houseId), eq(s.batches.status, "active")))
        .limit(1);

      if (!batch) return { status: "no_active_batch", checks: [] };

      // Oblicz wiek
      const ageDays = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / 86400000);

      // Pobierz normy dla tego wieku
      const [norms] = await db.select().from(iot.environmentNorms)
        .where(and(
          lte(iot.environmentNorms.dayFrom, ageDays),
          gte(iot.environmentNorms.dayTo, ageDays)
        ))
        .limit(1);

      if (!norms) return { status: "no_norms", ageDays, checks: [] };

      // Pobierz aktualne odczyty
      const current = await iotRouter.createCaller({} as any).getCurrent({ houseId: input.houseId });

      const checks = current.map(({ sensor, latest }) => {
        if (!latest) return { sensor: sensor.name, status: "no_data" };

        const val = num(latest.value);
        let norm: { min: number; max: number; target: number } | null = null;

        switch (sensor.type) {
          case "temperature":
            norm = { min: num(norms.tempMin), max: num(norms.tempMax), target: num(norms.tempTarget) };
            break;
          case "humidity":
            norm = { min: num(norms.humidityMin), max: num(norms.humidityMax), target: num(norms.humidityTarget) };
            break;
          case "nh3":
            norm = { min: 0, max: num(norms.nh3Max), target: num(norms.nh3Target) };
            break;
          case "co2":
            norm = { min: 0, max: num(norms.co2Max), target: num(norms.co2Target) };
            break;
        }

        if (!norm) return { sensor: sensor.name, status: "no_norm" };

        const status = val < norm.min ? "below" : val > norm.max ? "above" : "ok";
        const deviation = status === "ok" ? 0 : status === "below" ? val - norm.min : val - norm.max;

        return {
          sensor: sensor.name,
          type: sensor.type,
          value: val,
          unit: latest.unit,
          norm,
          status,
          deviation: deviation.toFixed(2),
          severity: status === "ok" ? "ok" : sensor.type === "temperature" || sensor.type === "nh3" ? "critical" : "warning",
        };
      });

      return { status: "ok", ageDays, checks };
    }),

  /** Statystyki sensorów per kurnik */
  getStats: publicQuery
    .input(z.object({
      houseId: z.number(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      const from = input.from ? new Date(input.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = input.to ? new Date(input.to) : new Date();

      // Agregacje per typ sensora
      const stats = await db.select({
        type: iot.sensors.type,
        avg: sql<string>`AVG(CAST(${iot.sensorReadings.value} AS DECIMAL(10,3)))`,
        min: sql<string>`MIN(CAST(${iot.sensorReadings.value} AS DECIMAL(10,3)))`,
        max: sql<string>`MAX(CAST(${iot.sensorReadings.value} AS DECIMAL(10,3)))`,
        count: sql<number>`COUNT(*)`,
      })
        .from(iot.sensorReadings)
        .innerJoin(iot.sensors, eq(iot.sensorReadings.sensorId, iot.sensors.id))
        .where(and(
          eq(iot.sensors.houseId, input.houseId),
          gte(iot.sensorReadings.deviceTime, from),
          lte(iot.sensorReadings.deviceTime, to)
        ))
        .groupBy(iot.sensors.type);

      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        stats: stats.map(s => ({
          type: s.type,
          avg: num(s.avg).toFixed(2),
          min: num(s.min).toFixed(2),
          max: num(s.max).toFixed(2),
          count: Number(s.count),
        })),
      };
    }),

  /** Dodaj nowy czujnik */
  addSensor: protectedQuery
    .input(z.object({
      houseId: z.number(),
      name: z.string().min(1).max(255),
      type: z.enum(["temperature", "humidity", "nh3", "co2", "light", "pressure", "water_flow", "feed_level"]),
      serialNumber: z.string().min(1).max(100),
      manufacturer: z.string().max(100).optional(),
      model: z.string().max(100).optional(),
      positionX: z.number().optional(),
      positionY: z.number().optional(),
      heightM: z.number().optional(),
      minThreshold: z.number().optional(),
      maxThreshold: z.number().optional(),
      alertEnabled: z.boolean().default(true),
      alertCooldownMin: z.number().min(1).default(30),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Pobierz house dla companyId i farmId
      const [house] = await db.select().from(s.houses)
        .where(eq(s.houses.id, input.houseId)).limit(1);
      if (!house) throw new Error("Nie znaleziono kurnika");

      const [{ id }] = await db.insert(iot.sensors).values({
        houseId: input.houseId,
        farmId: house.farmId,
        companyId: house.companyId ?? ctx.companyId ?? 0,
        type: input.type,
        name: input.name,
        serialNumber: input.serialNumber,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        positionX: input.positionX?.toFixed(2) ?? null,
        positionY: input.positionY?.toFixed(2) ?? null,
        heightM: input.heightM?.toFixed(2) ?? "1.50",
        minThreshold: input.minThreshold?.toFixed(2) ?? null,
        maxThreshold: input.maxThreshold?.toFixed(2) ?? null,
        alertEnabled: input.alertEnabled,
        alertCooldownMin: input.alertCooldownMin,
        isActive: true,
      }).$returningId();

      return { id };
    }),

  /** Edytuj czujnik */
  updateSensor: protectedQuery
    .input(z.object({
      sensorId: z.number(),
      name: z.string().min(1).max(255).optional(),
      type: z.enum(["temperature", "humidity", "nh3", "co2", "light", "pressure", "water_flow", "feed_level"]).optional(),
      serialNumber: z.string().min(1).max(100).optional(),
      manufacturer: z.string().max(100).optional(),
      model: z.string().max(100).optional(),
      positionX: z.number().optional(),
      positionY: z.number().optional(),
      heightM: z.number().optional(),
      minThreshold: z.number().optional(),
      maxThreshold: z.number().optional(),
      alertEnabled: z.boolean().optional(),
      alertCooldownMin: z.number().min(1).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.type !== undefined) updates.type = input.type;
      if (input.serialNumber !== undefined) updates.serialNumber = input.serialNumber;
      if (input.manufacturer !== undefined) updates.manufacturer = input.manufacturer;
      if (input.model !== undefined) updates.model = input.model;
      if (input.positionX !== undefined) updates.positionX = input.positionX.toFixed(2);
      if (input.positionY !== undefined) updates.positionY = input.positionY.toFixed(2);
      if (input.heightM !== undefined) updates.heightM = input.heightM.toFixed(2);
      if (input.minThreshold !== undefined) updates.minThreshold = input.minThreshold.toFixed(2);
      if (input.maxThreshold !== undefined) updates.maxThreshold = input.maxThreshold.toFixed(2);
      if (input.alertEnabled !== undefined) updates.alertEnabled = input.alertEnabled;
      if (input.alertCooldownMin !== undefined) updates.alertCooldownMin = input.alertCooldownMin;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(iot.sensors)
        .set(updates)
        .where(eq(iot.sensors.id, input.sensorId));

      return { ok: true };
    }),

  /** Usuń czujnik */
  deleteSensor: protectedQuery
    .input(z.object({ sensorId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Soft delete — ustaw isActive = false
      await db.update(iot.sensors)
        .set({ isActive: false })
        .where(eq(iot.sensors.id, input.sensorId));

      return { ok: true };
    }),

  /** Test czujnika — wyślij testowy odczyt */
  testSensor: protectedQuery
    .input(z.object({ sensorId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [sensor] = await db.select().from(iot.sensors)
        .where(eq(iot.sensors.id, input.sensorId)).limit(1);
      if (!sensor) throw new Error("Nie znaleziono czujnika");

      // Wygeneruj testowy odczyt w środku zakresu
      const min = sensor.minThreshold ? Number(sensor.minThreshold) : 0;
      const max = sensor.maxThreshold ? Number(sensor.maxThreshold) : 100;
      const testValue = (min + max) / 2;

      await db.insert(iot.sensorReadings).values({
        sensorId: sensor.id,
        houseId: sensor.houseId,
        value: testValue.toFixed(3),
        unit: getDefaultUnit(sensor.type),
        deviceTime: new Date(),
      });

      return { ok: true, testValue };
    }),
});

function getDefaultUnit(sensorType: string): string {
  const units: Record<string, string> = {
    temperature: "°C",
    humidity: "%",
    nh3: "ppm",
    co2: "ppm",
    light: "lux",
    pressure: "hPa",
    water_flow: "L/min",
    feed_level: "%",
  };
  return units[sensorType] ?? "";
}
