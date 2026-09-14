import { useState } from "react";
import { trpc } from "@/providers/trpc";

/**
 * SENSOR CONFIG — konfiguracja czujników IoT w kurnikach.
 * 
 * Funkcje:
 * - Dodawanie/edycja/usuwanie czujników
 * - Kalibracja (min/max threshold)
 * - Test połączenia
 * - Podgląd baterii i jakości sygnału
 */
export default function SensorConfig() {
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [editingSensor, setEditingSensor] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Formularz nowego czujnika
  const [form, setForm] = useState({
    name: "",
    type: "temperature" as "temperature" | "humidity" | "nh3" | "co2" | "light" | "pressure" | "water_flow" | "feed_level",
    serialNumber: "",
    manufacturer: "",
    model: "",
    positionX: "0",
    positionY: "0",
    heightM: "1.5",
    minThreshold: "",
    maxThreshold: "",
    alertEnabled: true,
    alertCooldownMin: 30,
  });

  // Pobierz czujniki dla kurnika
  const { data: sensors, refetch } = trpc.iot.getCurrent.useQuery(
    { houseId: selectedHouseId! },
    { enabled: selectedHouseId != null }
  );

  // Mutacje
  const addSensor = trpc.iot.addSensor.useMutation({
    onSuccess: () => {
      refetch();
      setShowAddForm(false);
      setForm({
        name: "",
        type: "temperature",
        serialNumber: "",
        manufacturer: "",
        model: "",
        positionX: "0",
        positionY: "0",
        heightM: "1.5",
        minThreshold: "",
        maxThreshold: "",
        alertEnabled: true,
        alertCooldownMin: 30,
      });
    },
  });

  const updateSensor = trpc.iot.updateSensor.useMutation({
    onSuccess: () => {
      refetch();
      setEditingSensor(null);
    },
  });

  const deleteSensor = trpc.iot.deleteSensor.useMutation({
    onSuccess: () => refetch(),
  });

  const testSensor = trpc.iot.testSensor.useMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingSensor) {
      updateSensor.mutate({
        sensorId: editingSensor.sensor.id,
        ...form,
        minThreshold: form.minThreshold ? Number(form.minThreshold) : undefined,
        maxThreshold: form.maxThreshold ? Number(form.maxThreshold) : undefined,
      });
    } else {
      addSensor.mutate({
        houseId: selectedHouseId!,
        ...form,
        minThreshold: form.minThreshold ? Number(form.minThreshold) : undefined,
        maxThreshold: form.maxThreshold ? Number(form.maxThreshold) : undefined,
      });
    }
  };

  const sensorTypes = [
    { value: "temperature", label: "🌡️ Temperatura", unit: "°C" },
    { value: "humidity", label: "💧 Wilgotność", unit: "%" },
    { value: "nh3", label: "⚠️ Amoniak (NH3)", unit: "ppm" },
    { value: "co2", label: "🫁 CO2", unit: "ppm" },
    { value: "light", label: "💡 Światło", unit: "lux" },
    { value: "pressure", label: "📊 Ciśnienie", unit: "hPa" },
    { value: "water_flow", label: "🚰 Przepływ wody", unit: "L/min" },
    { value: "feed_level", label: "🌾 Poziom paszy", unit: "%" },
  ];

  const getTypeLabel = (type: string) => 
    sensorTypes.find(t => t.value === type)?.label ?? type;

  const getTypeUnit = (type: string) => 
    sensorTypes.find(t => t.value === type)?.unit ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Konfiguracja czujników</h1>
          <p className="mt-2 text-zinc-400">
            Dodaj i skonfiguruj czujniki IoT w kurnikach
          </p>
        </div>

        {/* Wybór kurnika */}
        <div className="mb-6">
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={selectedHouseId ?? ""}
            onChange={(e) => setSelectedHouseId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Wybierz kurnik...</option>
            {/* TODO: lista kurników */}
          </select>
        </div>

        {/* Lista czujników */}
        {sensors && sensors.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-200">
                Czujniki ({sensors.length})
              </h2>
              <button
                onClick={() => setShowAddForm(true)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
              >
                + Dodaj czujnik
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sensors.map(({ sensor, latest, isOnline, status }) => (
                <div
                  key={sensor.id}
                  className={`rounded-xl border p-4 ${
                    status === "ok" ? "border-zinc-700 bg-zinc-900" :
                    status === "warning" ? "border-amber-700 bg-amber-900/20" :
                    status === "critical" ? "border-red-700 bg-red-900/20" :
                    "border-zinc-800 bg-zinc-900/50"
                  }`}
                >
                  {/* Nagłówek */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-zinc-200">{sensor.name}</div>
                      <div className="text-sm text-zinc-500">{getTypeLabel(sensor.type)}</div>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${
                      isOnline ? "bg-emerald-400" : "bg-zinc-600"
                    }`} />
                  </div>

                  {/* Wartość */}
                  <div className="mt-4 text-3xl font-bold text-zinc-100">
                    {latest ? `${Number(latest.value).toFixed(1)}${getTypeUnit(sensor.type)}` : "—"}
                  </div>

                  {/* Szczegóły */}
                  <div className="mt-4 space-y-2 text-sm text-zinc-400">
                    <div className="flex justify-between">
                      <span>S/N:</span>
                      <span className="font-mono text-zinc-300">{sensor.serialNumber}</span>
                    </div>

                    {sensor.manufacturer && (
                      <div className="flex justify-between">
                        <span>Producent:</span>
                        <span className="text-zinc-300">{sensor.manufacturer}</span>
                      </div>
                    )}

                    {sensor.minThreshold && sensor.maxThreshold && (
                      <div className="flex justify-between">
                        <span>Norma:</span>
                        <span className="text-zinc-300">
                          {Number(sensor.minThreshold)}–{Number(sensor.maxThreshold)}{getTypeUnit(sensor.type)}
                        </span>
                      </div>
                    )}

                    {sensor.batteryPct != null && (
                      <div className="flex justify-between">
                        <span>Bateria:</span>
                        <span className={sensor.batteryPct < 20 ? "text-red-400" : "text-zinc-300"}>
                          {sensor.batteryPct}%
                        </span>
                      </div>
                    )}

                    {sensor.lastSeenAt && (
                      <div className="flex justify-between">
                        <span>Ostatnio widziany:</span>
                        <span className="text-zinc-300">
                          {new Date(sensor.lastSeenAt).toLocaleTimeString('pl-PL')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Akcje */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        setEditingSensor({ sensor });
                        setForm({
                          name: sensor.name,
                          type: sensor.type,
                          serialNumber: sensor.serialNumber,
                          manufacturer: sensor.manufacturer ?? "",
                          model: sensor.model ?? "",
                          positionX: sensor.positionX ?? "0",
                          positionY: sensor.positionY ?? "0",
                          heightM: sensor.heightM ?? "1.5",
                          minThreshold: sensor.minThreshold ?? "",
                          maxThreshold: sensor.maxThreshold ?? "",
                          alertEnabled: sensor.alertEnabled,
                          alertCooldownMin: sensor.alertCooldownMin ?? 30,
                        });
                      }}
                      className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                    >
                      Edytuj
                    </button>

                    <button
                      onClick={() => testSensor.mutate({ sensorId: sensor.id })}
                      disabled={testSensor.isPending}
                      className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                    >
                      {testSensor.isPending ? "..." : "Test"}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm("Usunąć czujnik?")) {
                          deleteSensor.mutate({ sensorId: sensor.id });
                        }
                      }}
                      className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pusty stan */}
        {sensors && sensors.length === 0 && !showAddForm && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <div className="text-4xl mb-4">📡</div>
            <div className="text-zinc-500 mb-4">Brak czujników w tym kurniku</div>
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-500"
            >
              + Dodaj pierwszy czujnik
            </button>
          </div>
        )}

        {/* Formularz dodawania/edycji */}
        {(showAddForm || editingSensor) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
              <h3 className="mb-6 text-xl font-bold text-zinc-100">
                {editingSensor ? "Edytuj czujnik" : "Dodaj nowy czujnik"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Nazwa */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Nazwa *</label>
                    <input
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="np. Temperatura środek"
                      required
                    />
                  </div>

                  {/* Typ */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Typ *</label>
                    <select
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    >
                      {sensorTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Numer seryjny *</label>
                    <input
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 font-mono"
                      value={form.serialNumber}
                      onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                      placeholder="np. TH-2024-00123"
                      required
                    />
                  </div>

                  {/* Producent */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Producent</label>
                    <input
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.manufacturer}
                      onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                      placeholder="np. Sensirion"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Model</label>
                    <input
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="np. SHT31"
                    />
                  </div>

                  {/* Pozycja X */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Pozycja X (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.positionX}
                      onChange={(e) => setForm({ ...form, positionX: e.target.value })}
                    />
                  </div>

                  {/* Pozycja Y */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Pozycja Y (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.positionY}
                      onChange={(e) => setForm({ ...form, positionY: e.target.value })}
                    />
                  </div>

                  {/* Wysokość */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Wysokość montażu (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                      value={form.heightM}
                      onChange={(e) => setForm({ ...form, heightM: e.target.value })}
                    />
                  </div>
                </div>

                {/* Progi alertów */}
                <div className="border-t border-zinc-700 pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-zinc-300">Progi alertów</h4>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Min</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                        value={form.minThreshold}
                        onChange={(e) => setForm({ ...form, minThreshold: e.target.value })}
                        placeholder={getTypeUnit(form.type)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Max</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                        value={form.maxThreshold}
                        onChange={(e) => setForm({ ...form, maxThreshold: e.target.value })}
                        placeholder={getTypeUnit(form.type)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Cooldown (min)</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                        value={form.alertCooldownMin}
                        onChange={(e) => setForm({ ...form, alertCooldownMin: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={form.alertEnabled}
                      onChange={(e) => setForm({ ...form, alertEnabled: e.target.checked })}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
                    />
                    Włącz alerty dla tego czujnika
                  </label>
                </div>

                {/* Przyciski */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={addSensor.isPending || updateSensor.isPending}
                    className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {addSensor.isPending || updateSensor.isPending
                      ? "Zapisywanie..."
                      : editingSensor ? "Zapisz zmiany" : "Dodaj czujnik"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingSensor(null);
                    }}
                    className="rounded-lg border border-zinc-700 px-6 py-2.5 text-zinc-400 hover:bg-zinc-800"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
