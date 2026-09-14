/**
 * IoT SCHEMA — czujniki, odczyty, alerty środowiskowe.
 * Dodaj do schema.ts lub importuj osobno.
 */
import { mysqlTable, serial, bigint, varchar, text, timestamp, boolean, mysqlEnum, decimal, int } from "drizzle-orm/mysql-core";

/** Czujniki zainstalowane w kurnikach */
export const sensors = mysqlTable("sensors", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),

  // Typ czujnika
  type: mysqlEnum("type", ["temperature", "humidity", "nh3", "co2", "light", "pressure", "water_flow", "feed_level"]).notNull(),

  // Identyfikacja
  name: varchar("name", { length: 255 }).notNull(),
  serialNumber: varchar("serialNumber", { length: 100 }).notNull().unique(),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),

  // Lokalizacja w kurniku
  positionX: decimal("positionX", { precision: 5, scale: 2 }), // metry od ściany zachodniej
  positionY: decimal("positionY", { precision: 5, scale: 2 }), // metry od ściany północnej
  heightM: decimal("heightM", { precision: 3, scale: 2 }).default("1.5"), // wysokość montażu

  // Konfiguracja
  minThreshold: decimal("minThreshold", { precision: 8, scale: 2 }), // wartość min — poniżej alert
  maxThreshold: decimal("maxThreshold", { precision: 8, scale: 2 }), // wartość max — powyżej alert
  alertEnabled: boolean("alertEnabled").default(true).notNull(),
  alertCooldownMin: int("alertCooldownMin").default(30).notNull(), // minuty między alertami

  // Status
  isActive: boolean("isActive").default(true).notNull(),
  batteryPct: int("batteryPct"), // dla czujników bezprzewodowych
  lastSeenAt: timestamp("lastSeenAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

/** Odczyty z czujników — partycjonowane po miesiącach w produkcji */
export const sensorReadings = mysqlTable("sensorReadings", {
  id: serial("id").primaryKey(),
  sensorId: bigint("sensorId", { mode: "number", unsigned: true }).notNull(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }), // opcjonalnie — który rzut

  // Wartość
  value: decimal("value", { precision: 10, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(), // °C, %, ppm, lux, hPa

  // Jakość sygnału
  signalQuality: int("signalQuality"), // 0-100%
  batteryPct: int("batteryPct"),

  // Timestamp urządzenia (może się różnić od serverTime)
  deviceTime: timestamp("deviceTime").notNull(),
  serverTime: timestamp("serverTime").defaultNow().notNull(),

  // Przetworzone flagi
  isAnomaly: boolean("isAnomaly").default(false).notNull(),
  anomalyScore: decimal("anomalyScore", { precision: 5, scale: 4 }),
});

/** Agregacje godzinowe — dla szybkich wykresów */
export const sensorHourly = mysqlTable("sensorHourly", {
  id: serial("id").primaryKey(),
  sensorId: bigint("sensorId", { mode: "number", unsigned: true }).notNull(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),

  hour: timestamp("hour").notNull(), // zaokrąglone do godziny

  avg: decimal("avg", { precision: 10, scale: 3 }).notNull(),
  min: decimal("min", { precision: 10, scale: 3 }).notNull(),
  max: decimal("max", { precision: 10, scale: 3 }).notNull(),
  stdDev: decimal("stdDev", { precision: 10, scale: 3 }),
  count: int("count").notNull(),

  // Anomalie w tej godzinie
  anomalyCount: int("anomalyCount").default(0).notNull(),
});

/** Alerty środowiskowe */
export const environmentAlerts = mysqlTable("environmentAlerts", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  sensorId: bigint("sensorId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }),

  // Co się stało
  type: mysqlEnum("type", ["threshold_exceeded", "threshold_below", "sensor_offline", "anomaly_detected", "battery_low"]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull().default("warning"),

  // Wartości
  value: decimal("value", { precision: 10, scale: 3 }).notNull(),
  threshold: decimal("threshold", { precision: 10, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),

  // Komunikat
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),

  // Status
  isResolved: boolean("isResolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: bigint("resolvedBy", { mode: "number", unsigned: true }),
  resolution: text("resolution"),

  // Eskalacja
  notificationSent: boolean("notificationSent").default(false).notNull(),
  notificationSentAt: timestamp("notificationSentAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Normy środowiskowe per wiek ptaka */
export const environmentNorms = mysqlTable("environmentNorms", {
  id: serial("id").primaryKey(),
  geneticLineId: bigint("geneticLineId", { mode: "number", unsigned: true }),

  // Zakres wieku
  dayFrom: int("dayFrom").notNull(),
  dayTo: int("dayTo").notNull(),

  // Temperatura
  tempMin: decimal("tempMin", { precision: 4, scale: 1 }).notNull(),
  tempMax: decimal("tempMax", { precision: 4, scale: 1 }).notNull(),
  tempTarget: decimal("tempTarget", { precision: 4, scale: 1 }).notNull(),

  // Wilgotność
  humidityMin: decimal("humidityMin", { precision: 4, scale: 1 }).notNull(),
  humidityMax: decimal("humidityMax", { precision: 4, scale: 1 }).notNull(),
  humidityTarget: decimal("humidityTarget", { precision: 4, scale: 1 }).notNull(),

  // NH3 (amoniak) ppm
  nh3Max: decimal("nh3Max", { precision: 6, scale: 1 }).notNull(),
  nh3Target: decimal("nh3Target", { precision: 6, scale: 1 }).notNull(),

  // CO2 ppm
  co2Max: decimal("co2Max", { precision: 6, scale: 1 }).notNull(),
  co2Target: decimal("co2Target", { precision: 6, scale: 1 }).notNull(),

  // Światło
  lightHours: decimal("lightHours", { precision: 4, scale: 1 }).notNull(), // godziny światła
  lightIntensity: decimal("lightIntensity", { precision: 8, scale: 1 }), // lux

  // Wentylacja
  airExchangeMin: decimal("airExchangeMin", { precision: 6, scale: 2 }), // m³/h/kg

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
