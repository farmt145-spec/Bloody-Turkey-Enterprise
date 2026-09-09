import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { countryFlag, fmtNum, num } from "@/lib/geo";
import { useState } from "react";

export default function Production() {
  const batches = trpc.farm.production.batches.useQuery();
  const [filter, setFilter] = useState<"all" | "active" | "closed">("active");

  const rows = (batches.data ?? []).filter((b) =>
    filter === "all" ? true : b.batch.status === filter,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produkcja — rzuty</h1>
          <p className="text-sm text-zinc-500">KPI liczone centralnie przez Calculation Engine</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {([["active", "Aktywne"], ["closed", "Zamknięte"], ["all", "Wszystkie"]] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === v ? "bg-red-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Rzut</th>
              <th className="px-4 py-3 text-left">Ferma</th>
              <th className="px-4 py-3 text-left">Linia</th>
              <th className="px-4 py-3 text-right">Wiek (dni)</th>
              <th className="px-4 py-3 text-right">Sztuki</th>
              <th className="px-4 py-3 text-right">Śr. masa</th>
              <th className="px-4 py-3 text-right">ADG</th>
              <th className="px-4 py-3 text-right">FCR</th>
              <th className="px-4 py-3 text-right">Śmiert.</th>
              <th className="px-4 py-3 text-right">EPEF</th>
              <th className="px-4 py-3 text-right">kg/m²</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
            {rows.map((r) => (
              <tr key={r.batch.id} className="hover:bg-zinc-900/70">
                <td className="px-4 py-3">
                  <Link to={`/produkcja/${r.batch.id}`} className="font-mono font-medium text-red-400 hover:underline">
                    {r.batch.code}
                  </Link>
                  <div className="text-[10px] text-zinc-500">
                    {r.batch.sex === "toms" ? "indory" : r.batch.sex === "hens" ? "indyczki" : "mieszany"}
                    {r.batch.status === "closed" && " · zamknięty"}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {r.farm ? `${countryFlag(r.farm.countryCode)} ${r.farm.city}` : "—"}
                  <div className="text-[10px] text-zinc-600">{r.house?.name}</div>
                </td>
                <td className="px-4 py-3 text-zinc-400">{r.batch.geneticLine}</td>
                <td className="px-4 py-3 text-right">{r.ageDays}</td>
                <td className="px-4 py-3 text-right">{fmtNum(r.batch.currentCount)}</td>
                <td className="px-4 py-3 text-right font-medium">{(r.avgWeightG / 1000).toFixed(2)} kg</td>
                <td className="px-4 py-3 text-right">{fmtNum(r.adgG)} g</td>
                <td className={`px-4 py-3 text-right font-medium ${r.fcr < 2.4 ? "text-emerald-400" : r.fcr > 2.7 ? "text-red-400" : ""}`}>
                  {r.fcr.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right ${r.mortalityPct > 4 ? "text-red-400" : ""}`}>{r.mortalityPct.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right">{fmtNum(r.epef)}</td>
                <td className={`px-4 py-3 text-right ${r.densityKgM2 > (r.house ? num(r.house.maxDensityKgM2) : 42) ? "text-amber-400" : ""}`}>
                  {r.densityKgM2.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="bg-zinc-950/50 p-8 text-center text-sm text-zinc-500">Ładowanie lub brak rzutów…</div>
        )}
      </div>
    </div>
  );
}
