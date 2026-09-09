import { useMemo, lazy, Suspense } from "react";
import { trpc } from "@/providers/trpc";
import { fmtNum, fmtTons, countryFlag, countryName } from "@/lib/geo";
import { Bird, Scale, Gauge, Skull, TrendingUp, Warehouse, Globe2, AlertTriangle, Flame } from "lucide-react";
import { Link } from "react-router";

/* Mapa ładowana leniwie — brak paczki nie wywraca całego dashboardu */
const FarmMap = lazy(() => import("@/components/FarmMap"));

function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: any; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className={`h-4 w-4 ${accent ? "text-red-400" : ""}`} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-zinc-50">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const kpis = trpc.farm.dashboard.kpis.useQuery();
  const mapData = trpc.farm.dashboard.mapData.useQuery();
  const alerts = trpc.farm.dashboard.alerts.useQuery();

  const maxBirds = useMemo(
    () => Math.max(1, ...(mapData.data ?? []).map((f) => f.activeBirds)),
    [mapData.data],
  );

  const k = kpis.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard operacyjny</h1>
        <p className="text-sm text-zinc-500">
          Bloody Turkey Group S.A. — {k?.countriesCount ?? "…"} krajów · {k?.farmsCount ?? "…"} ferm · czas rzeczywisty
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Bird} label="Ptaki w chowie" value={k ? fmtNum(k.activeBirds) : "…"} sub={`${k?.activeBatches ?? "…"} aktywnych rzutów`} accent />
        <KpiCard icon={Scale} label="Biomasa" value={k ? fmtTons(k.biomassTons) : "…"} sub="cała grupa, EUR" />
        <KpiCard icon={Gauge} label="FCR (ważone)" value={k ? k.avgFcr.toFixed(2) : "…"} sub="kg paszy / kg przyrostu" />
        <KpiCard icon={Skull} label="Śmiertelność" value={k ? `${k.avgMortality.toFixed(2)}%` : "…"} sub="średnia z rzutów" />
        <KpiCard icon={TrendingUp} label="EPEF / PEI" value={k ? fmtNum(k.avgEpef) : "…"} sub="indeks efektywności" />
        <KpiCard icon={Warehouse} label="Fermy" value={k ? String(k.farmsCount) : "…"} sub={`${k?.countriesCount ?? "…"} krajów Europy`} />
        <KpiCard icon={Globe2} label="Zasięg" value={k ? `${k.countriesCount}` : "…"} sub="kraje UE + UK" accent />
        <KpiCard icon={Flame} label="Alerty" value={alerts.data ? String(alerts.data.length) : "…"} sub="wymagają uwagi" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Mapa ferm — Europa
          </h2>
          <div className="relative">
            <Suspense fallback={<div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">Ładowanie mapy…</div>}>
              <FarmMap farms={mapData.data ?? []} maxBirds={maxBirds} />
            </Suspense>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(mapData.data ?? []).map((f) => (
              <div key={f.id} className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs">
                <span className="mr-1">{countryFlag(f.countryCode)}</span>
                <span className="font-medium">{f.city}</span>
                <span className="ml-1 text-zinc-500">({countryName(f.countryCode)})</span>
                <div className="mt-0.5 text-zinc-400">
                  {fmtNum(f.activeBirds)} szt. · {fmtTons(f.biomassTons)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Centrum alertów
          </h2>
          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {(alerts.data ?? []).map((a, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm ${
                  a.type === "critical"
                    ? "border-red-900/60 bg-red-950/40"
                    : a.type === "warning"
                      ? "border-amber-900/60 bg-amber-950/30"
                      : "border-zinc-800 bg-zinc-900/60"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle
                    className={`h-4 w-4 ${a.type === "critical" ? "text-red-400" : "text-amber-400"}`}
                  />
                  {a.title}
                </div>
                <p className="mt-1 text-xs text-zinc-400">{a.detail}</p>
              </div>
            ))}
            {alerts.data?.length === 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
                Brak aktywnych alertów. Wszystkie parametry w normie.
              </div>
            )}
          </div>
          <Link
            to="/obchod"
            className="block rounded-lg bg-emerald-600/15 px-4 py-3 text-center text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/25"
          >
            📋 Obchód dnia — zapisz padnięcia, paszę i wodę →
          </Link>
          <Link
            to="/produkcja"
            className="block rounded-lg bg-red-600/15 px-4 py-3 text-center text-sm font-medium text-red-400 transition-colors hover:bg-red-600/25"
          >
            Przejdź do produkcji →
          </Link>
        </div>
      </div>
    </div>
  );
}
