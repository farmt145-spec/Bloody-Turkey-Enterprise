/**
 * MQTT BRIDGE — łączy się z brokerem MQTT i zapisuje odczyty do bazy.
 * Uruchamiane jako osobny proces lub w tle serwera.
 * 
 * Tematy MQTT:
 *   bte/{companyId}/{farmId}/{houseId}/{sensorType}/{serialNumber} → wartość
 *   bte/{companyId}/{farmId}/{houseId}/{sensorType}/{serialNumber}/json → {value, unit, battery}
 */
import mqtt from "mqtt";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import * as iot from "../db/schema-iot";
import { eq, and } from "drizzle-orm";

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

export function startMqttBridge() {
  const client = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log(`[MQTT] Połączono z ${MQTT_BROKER}`);
    // Subskrybuj wszystkie tematy BTE
    client.subscribe("bte/+/+/+/+/+", { qos: 1 });
    client.subscribe("bte/+/+/+/+/+/json", { qos: 1 });
  });

  client.on("message", async (topic, message) => {
    try {
      // Parsuj temat: bte/{companyId}/{farmId}/{houseId}/{sensorType}/{serialNumber}
      const parts = topic.split("/");
      if (parts.length < 6 || parts[0] !== "bte") return;

      const [, companyId, farmId, houseId, sensorType, serialNumber] = parts;
      const isJson = parts[6] === "json";

      // Parsuj wiadomość
      let value: number;
      let unit: string;
      let batteryPct: number | undefined;

      if (isJson) {
        const data = JSON.parse(message.toString());
        value = Number(data.value);
        unit = data.unit ?? getDefaultUnit(sensorType);
        batteryPct = data.battery;
      } else {
        value = Number(message.toString());
        unit = getDefaultUnit(sensorType);
      }

      if (!Number.isFinite(value)) return;

      // Znajdź czujnik
      const db = getDb();
      const [sensor] = await db.select().from(iot.sensors)
        .where(eq(iot.sensors.serialNumber, serialNumber)).limit(1);

      if (!sensor) {
        console.warn(`[MQTT] Nieznany czujnik: ${serialNumber}`);
        return;
      }

      // Znajdź aktywny rzut
      const [batch] = await db.select().from(s.batches)
        .where(and(
          eq(s.batches.houseId, sensor.houseId),
          eq(s.batches.status, "active")
        ))
        .limit(1);

      // Zapisz odczyt
      await db.insert(iot.sensorReadings).values({
        sensorId: sensor.id,
        houseId: sensor.houseId,
        batchId: batch?.id ?? null,
        value: value.toFixed(3),
        unit,
        deviceTime: new Date(),
        batteryPct: batteryPct ?? null,
      });

      // Aktualizuj lastSeenAt
      await db.update(iot.sensors)
        .set({ lastSeenAt: new Date(), batteryPct: batteryPct ?? sensor.batteryPct })
        .where(eq(iot.sensors.id, sensor.id));

      // Sprawdź progi
      await checkThresholds(sensor, value, unit);

    } catch (e) {
      console.error("[MQTT] Błąd przetwarzania:", e);
    }
  });

  client.on("error", (e) => {
    console.error("[MQTT] Błąd połączenia:", e.message);
  });

  return client;
}

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

async function checkThresholds(sensor: any, value: number, unit: string) {
  if (!sensor.alertEnabled || sensor.minThreshold == null || sensor.maxThreshold == null) return;

  const min = Number(sensor.minThreshold);
  const max = Number(sensor.maxThreshold);

  if (value >= min && value <= max) return;

  const db = getDb();

  // Sprawdź cooldown
  const recentAlert = await db.select().from(iot.environmentAlerts)
    .where(and(
      eq(iot.environmentAlerts.sensorId, sensor.id),
      eq(iot.environmentAlerts.isResolved, false)
    ))
    .limit(1);

  if (recentAlert.length > 0) {
    const lastAlert = recentAlert[0];
    const cooldownMs = (sensor.alertCooldownMin ?? 30) * 60000;
    if (Date.now() - new Date(lastAlert.createdAt).getTime() < cooldownMs) return;
  }

  const type = value < min ? "threshold_below" : "threshold_exceeded";
  const severity = sensor.type === "temperature" || sensor.type === "nh3" ? "critical" : "warning";

  await db.insert(iot.environmentAlerts).values({
    companyId: sensor.companyId,
    farmId: sensor.farmId,
    houseId: sensor.houseId,
    sensorId: sensor.id,
    type,
    severity,
    value: value.toFixed(3),
    threshold: (value < min ? min : max).toFixed(3),
    unit,
    title: `${sensor.name}: ${value.toFixed(1)}${unit} ${value < min ? "poniżej" : "powyżej"} normy`,
    message: `Wartość ${value.toFixed(1)}${unit} poza zakresem ${min}-${max}${unit}.`,
  });

  // TODO: wysłać powiadomienie push/email
  console.log(`[ALERT] ${sensor.name}: ${value}${unit} (norma: ${min}-${max}${unit})`);
}
