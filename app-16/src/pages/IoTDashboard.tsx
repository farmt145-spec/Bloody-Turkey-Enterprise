import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";

/**
 * IoT DASHBOARD — monitoring środowiska kurnika w czasie rzeczywistym.
 * Pokazuje: temperatura, wilgotność, NH3, CO2, statusy czujników, alerty.
 */
export default function IoTDashboard() {
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);

  // Pobierz listę kurników z aktywnymi rzutami
  const { data: houses } = trpc.farm.houses.useQuery(
    { farmId: 0 }, // TODO: pobrać farmId z kontekstu
    { enabled: false }
  );

  // Aktualne wartości
  const { data: current, refetch: refetchCurrent } = trpc.iot.getCurrent.useQuery(
    { houseId: selectedHouseId! },
    { enabled: selectedHouseId != null, refetchInterval: autoRefresh ? 30000 : false }
  );

  // Alerty
  const { data: alerts } = trpc.iot.getAlerts.useQuery(
    { houseId: selectedHouseId ?? undefined, isResolved: false },
    { enabled: selectedHouseId != null }
  );

  // Sprawdzenie progów
  const { data: thresholdCheck } = trpc.iot.checkThresholds.useQuery(
    { houseId: selectedHouseId! },
    { enabled: selectedHouseId != null, refetchInterval: autoRefresh ? 60000 : false }
  );

  // Historia (ostatnie 24h)
  const { data: history } = trpc.iot.getHistory.useQuery(
    { 
      houseId: selectedHouseId!, 
      from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      resolution: "hourly",
      limit: 500
    },
    { enabled: selectedHouseId != null }
  );

  const resolveAlert = trpc.iot.resolveAlert.useMutation();

  const fmt = (n: number | string | null | undefined, suffix = "") => {
    if (n == null) return "—";
    const num = typeof n === "string" ? parseFloat(n) : n;
    return `${num.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "text-emerald-400 bg-emerald-900/30 border-emerald-700";
      case "warning": return "text-amber-400 bg-amber-900/30 border-amber-700";
      case "critical": return "text-red-400 bg-red-900/30 border-red-700";
      case "offline": return "text-zinc-500 bg-zinc-800/50 border-zinc-700";
      default: return "text-zinc-400 bg-zinc-800 border-zinc-700";
    }
  };

  const getSensorIcon = (type: string) => {
    const icons: Record<string, string> = {
      temperature: "🌡️",
      humidity: "💧",
      nh3: "⚠️",
      co2: "🫁",
      light: "💡",
      pressure: "📊",
      water_flow: "🚰",
      feed_level: "🌾",
    };
    return icons[type] ?? "📡";
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Monitoring środowiska</h1>
            <p className="mt-2 text-zinc-400">
              Czujniki IoT w kurnikach — temperatura, wilgotność, NH3, CO2
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
              Auto-odświeżanie (30s)
            </label>

            <button
              onClick={() => refetchCurrent()}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              🔄 Odśwież
            </button>
          </div>
        </div>

        {/* Wybór kurnika */}
        <div className="mb-6">
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={selectedHouseId ?? ""}
            onChange={(e) => setSelectedHouseId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Wybierz kurnik…</option>
            {/* TODO: mapowanie kurników */}
          </select>
        </div>

        {/* Alerty */}
        {alerts && alerts.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-red-300">
                ⚠️ Aktywne alerty ({alerts.length})
              </h3>
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                {showAlerts ? "Ukryj" : "Pokaż"}
              </button>
            </div>

            {showAlerts && (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between rounded-lg bg-red-900/30 p-3">
                    <div>
                      <div className="font-medium text-red-200">{alert.title}</div>
                      <div className="text-sm text-red-400">{alert.message}</div>
                      <div className="text-xs text-red-500 mt-1">
                        {new Date(alert.createdAt).toLocaleString('pl-PL')}
                      </div>
                    </div>
                    <button
                      onClick={() => resolveAlert.mutate({ alertId: alert.id, resolution: "Rozwiązano" })}
                      className="rounded-lg border border-red-700 px-3 py-1 text-xs text-red-300 hover:bg-red-800"
                    >
                      Rozwiąż
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aktualne wartości */}
        {current && (
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {current.map(({ sensor, latest, isOnline, status }) => (
              <div
                key={sensor.id}
                className={`rounded-xl border p-4 ${getStatusColor(status)}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{getSensorIcon(sensor.type)}</span>
                  <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-zinc-600"}`} />
                </div>

                <div className="mt-3 text-sm text-zinc-400">{sensor.name}</div>

                <div className="mt-1 text-3xl font-bold">
                  {latest ? fmt(latest.value, latest.unit) : "—"}
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  {sensor.type}
                  {sensor.minThreshold && sensor.maxThreshold && (
                    <span className="ml-2">
                      (norma: {fmt(sensor.minThreshold)}–{fmt(sensor.maxThreshold)})
                    </span>
                  )}
                </div>

                {sensor.batteryPct != null && (
                  <div className="mt-2 text-xs text-zinc-500">
                    🔋 {sensor.batteryPct}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status progów */}
        {thresholdCheck && thresholdCheck.checks.length > 0 && (
          <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">
              Status vs normy (wiek: {thresholdCheck.ageDays} dni)
            </h3>

            <div className="space-y-2">
              {thresholdCheck.checks.map((check: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-zinc-800 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getSensorIcon(check.type)}</span>
                    <span className="text-zinc-300">{check.sensor}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-zinc-400">
                      {fmt(check.value, check.unit)}
                    </span>
                    <span className="text-zinc-500 text-sm">
                      norma: {fmt(check.norm?.min)}–{fmt(check.norm?.max)}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      check.status === "ok" ? "bg-emerald-900/50 text-emerald-300" :
                      check.severity === "critical" ? "bg-red-900/50 text-red-300" :
                      "bg-amber-900/50 text-amber-300"
                    }`}>
                      {check.status === "ok" ? "OK" : 
                       check.status === "below" ? "ZA NISKO" :
                       check.status === "above" ? "ZA WYSOKO" : check.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wykres historii */}
        {history && history.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">
              Historia (ostatnie 24h)
            </h3>

            {/* TODO: wykres liniowy z Recharts lub Chart.js */}
            <div className="text-zinc-500 text-sm">
              Wykres historii — wymaga integracji z biblioteką wykresów
            </div>
          </div>
        )}

        {/* Pusty stan */}
        {!current && selectedHouseId && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <div className="text-4xl mb-4">📡</div>
            <div className="text-zinc-500">Brak czujników w tym kurniku</div>
            <div className="text-zinc-600 text-sm mt-2">
              Dodaj czujniki w ustawieniach kurnika
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
