import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtNum, fmtEur } from "@/lib/geo";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Droplets, Wheat, Zap, ArrowUpDown } from "lucide-react";

const COLS = [
  { key: "code", label: "Rzut", fmt: (v: any) => v },
  { key: "geneticLine", label: "Linia", fmt: (v: any) => v },
  { key: "ageDays", label: "Wiek", fmt: (v: number) => `${v} d` },
  { key: "avgWeightG", label: "Masa", fmt: (v: number) => `${(v / 1000).toFixed(2)} kg` },
  { key: "fcr", label: "FCR", fmt: (v: number) => v.toFixed(2) },
  { key: "adgG", label: "ADG", fmt: (v: number) => `${v.toFixed(0)} g` },
  { key: "mortalityPct", label: "Upadki %", fmt: (v: number) => `${v.toFixed(1)}%` },
  { key: "water14dL", label: "Woda 14d", fmt: (v: number) => `${fmtNum(v)} l` },
  { key: "feed14dKg", label: "Pasza 14d", fmt: (v: number) => `${fmtNum(v)} kg` },
  { key: "costPerKgLive", label: "Koszt kg żywca", fmt: (v: number) => `${(v*4.28).toFixed(2)} zł` },
  { key: "feedCostPerKgGain", label: "Koszt paszy/kg przyr.", fmt: (v: number) => `${(v*4.28).toFixed(2)} zł` },
  { key: "forecastRevenueEur", label: "Prognoza sprzedaży", fmt: (v: number) => fmtEur(v) },
  { key: "forecastProfitEur", label: "Prognoza zysku", fmt: (v: number) => fmtEur(v) },
];

export default function Analytics() {
  const cmp = trpc.analytics.compareBatches.useQuery();
  const series = trpc.analytics.consumptionSeries.useQuery({ days: 30 });
  const energy = trpc.analytics.energySummary.useQuery();
  const [sortKey, setSortKey] = useState<string>("fcr");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const r = [...(cmp.data ?? [])] as any[];
    r.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return dir === "asc" ? c : -c;
    });
    return r;
  }, [cmp.data, sortKey, dir]);

  const chartData = (series.data ?? []).map((d: any) => ({
    day: String(d.day).slice(5), woda: Number(d.water), pasza: Number(d.feed), upadki: Number(d.mortality), temp: Number(d.temp),
  }));

  const kpi = useMemo(() => {
    const r = (cmp.data ?? []) as any[];
    if (!r.length) return null;
    return {
      avgFcr: r.reduce((a, x) => a + x.fcr, 0) / r.length,
      avgAdg: r.reduce((a, x) => a + x.adgG, 0) / r.length,
      profit: r.reduce((a, x) => a + x.forecastProfitEur, 0),
      revenue: r.reduce((a, x) => a + x.forecastRevenueEur, 0),
    };
  }, [cmp.data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Centrum analityczne</h1>
        <p className="text-sm text-zinc-500">Porównanie stad, konwersja, koszty i prognozy — live z bazy produkcyjnej</p>
      </div>

      {/* KPI górne */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Średnie FCR (stada aktywne)", value: kpi ? kpi.avgFcr.toFixed(2) : null, icon: Wheat, color: "text-emerald-400" },
          { label: "Średni ADG", value: kpi ? `${kpi.avgAdg.toFixed(0)} g/d` : null, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Prognoza przychodu", value: kpi ? fmtEur(kpi.revenue) : null, icon: ArrowUpDown, color: "text-zinc-100" },
          { label: "Prognoza zysku", value: kpi ? fmtEur(kpi.profit) : null, icon: TrendingUp, color: kpi && kpi.profit >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">{c.label}<c.icon className={`h-4 w-4 ${c.color}`} /></div>
            {c.value === null ? <Skeleton className="mt-3 h-8 w-24" /> : <div className={`mt-2 text-2xl font-bold ${c.color}`}>{c.value}</div>}
          </div>
        ))}
      </div>

      {/* wykresy zużycia */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Droplets className="h-4 w-4 text-sky-400" /> Zużycie wody i paszy — 30 dni</div>
          {series.isLoading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="woda" stroke="#38bdf8" fill="url(#gw)" isAnimationActive />
                <Area type="monotone" dataKey="pasza" stroke="#10b981" fill="url(#gf)" isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-amber-400" /> Energia i media — koszty</div>
          {energy.isLoading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={(energy.data ?? []).map((e: any) => ({ rodzaj: { power: "Prąd", gas: "Gaz", water: "Woda", fuel: "Paliwo" }[e.kind as string] ?? e.kind, koszt: Number(e.cost), zuzycie: Number(e.consumption) }))}>
                <CartesianGrid stroke="#27272a" />
                <XAxis dataKey="rodzaj" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12 }} />
                <Bar dataKey="koszt" fill="#ef4444" radius={[6, 6, 0, 0]} isAnimationActive name="Koszt EUR" />
                <Bar dataKey="zuzycie" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive name="Zużycie" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* tabela porównawcza */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-3 text-sm font-semibold">Porównanie stad — wszystkie aktywne rzuty</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                {COLS.map((c) => (
                  <th key={c.key} className="cursor-pointer whitespace-nowrap px-3 py-2 hover:text-zinc-300"
                    onClick={() => { if (sortKey === c.key) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(c.key); setDir("asc"); } }}>
                    {c.label}{sortKey === c.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/60">{COLS.map((c) => <td key={c.key} className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>)}</tr>
              ))}
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/40">
                  {COLS.map((c) => (
                    <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${
                      c.key === "fcr" && r.fcr > 2.9 ? "text-red-400" :
                      c.key === "fcr" ? "text-emerald-400" :
                      c.key === "forecastProfitEur" ? (r.forecastProfitEur >= 0 ? "text-emerald-400" : "text-red-400") :
                      "text-zinc-200"}`}>
                      {c.key === "code" ? <a className="text-emerald-400 hover:underline" href={`/produkcja/${r.id}`}>{r.code}</a> : c.fmt(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
