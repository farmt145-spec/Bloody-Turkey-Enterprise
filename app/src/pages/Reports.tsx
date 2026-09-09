import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { FileText, Printer, AlertTriangle, Layers, CalendarDays } from "lucide-react";

const num = (v: unknown) => Number(v ?? 0);

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

const PRESETS = [
  { label: "Ostatnie 7 dni", days: 7 },
  { label: "Ostatnie 14 dni", days: 14 },
  { label: "Ostatnie 30 dni", days: 30 },
];

export default function Reports() {
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const q = trpc.reports.weekly.useQuery({ from, to });
  const d = q.data;

  const sexLabel: Record<string, string> = { toms: "Koguty", hens: "Indyczki", mixed: "Mieszane" };
  const statusLabel: Record<string, string> = { active: "aktywny", closed: "zamknięty", planned: "planowany" };

  const subtitle = useMemo(() => {
    const farms = d?.farms ?? [];
    return farms.length ? farms.join(", ") : "";
  }, [d]);

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Nagłówek + wybór zakresu (nie drukuje się sterowanie) */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="h-6 w-6 text-emerald-400" /> Raporty</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.days}
              onClick={() => { setFrom(daysAgoISO(p.days)); setTo(todayISO()); }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                from === daysAgoISO(p.days) && to === todayISO()
                  ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                  : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              }`}>
              {p.label}
            </button>
          ))}
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" />
          <span className="text-zinc-500">–</span>
          <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" />
          <button onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            <Printer className="h-4 w-4" /> Drukuj / PDF
          </button>
        </div>
      </div>

      {/* Nagłówek wydruku */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-black">Bloody Turkey Enterprise — Raport produkcyjny</h1>
        <p className="text-sm text-zinc-700">{subtitle} · okres {from} – {to} · wygenerowano {todayISO()}</p>
      </div>

      {q.isLoading && <p className="text-zinc-500">Liczenie raportu…</p>}
      {q.error && <p className="text-red-400">{q.error.message}</p>}

      {d && d.totals && (
        <>
          {/* Podsumowanie fermy */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Sztuki w chowie", value: d.totals.birds.toLocaleString("pl-PL") },
              { label: "Upadki w okresie", value: d.totals.dead.toLocaleString("pl-PL") },
              { label: "Zużyta pasza", value: `${(d.totals.feedKg / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} t` },
              { label: "Śr. FCR", value: d.totals.avgFcr > 0 ? d.totals.avgFcr.toFixed(2) : "—" },
              { label: "Przeżywalność", value: `${d.totals.avgLivability.toFixed(1)}%` },
              { label: "Śr. EPEF", value: d.totals.avgEpef > 0 ? d.totals.avgEpef.toFixed(0) : "—" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 print:border-zinc-300 print:bg-white">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 print:text-zinc-600">{k.label}</p>
                <p className="mt-1 text-xl font-bold print:text-black">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Tabela stad */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800 print:border-zinc-300">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500 print:bg-zinc-100 print:text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left">Kurnik / stado</th>
                  <th className="px-3 py-2 text-left">Linia</th>
                  <th className="px-3 py-2 text-right">Wiek</th>
                  <th className="px-3 py-2 text-right">Stan</th>
                  <th className="px-3 py-2 text-right">Upadki</th>
                  <th className="px-3 py-2 text-right">Upadki %</th>
                  <th className="px-3 py-2 text-right">Pasza (kg)</th>
                  <th className="px-3 py-2 text-right">Masa (g)</th>
                  <th className="px-3 py-2 text-right">FCR</th>
                  <th className="px-3 py-2 text-right">EPEF</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.batchId} className="border-t border-zinc-800 print:border-zinc-200">
                    <td className="px-3 py-2">
                      <b>{r.house}</b> <span className="text-xs text-zinc-500">{r.code}</span>
                      <span className="ml-2 rounded border border-zinc-700 px-1 text-[10px] text-zinc-500 print:text-zinc-600">
                        {sexLabel[r.sex] ?? r.sex} · {statusLabel[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400 print:text-zinc-700">{r.geneticLine}</td>
                    <td className="px-3 py-2 text-right">{r.ageDays} d</td>
                    <td className="px-3 py-2 text-right">{r.currentCount.toLocaleString("pl-PL")}</td>
                    <td className={`px-3 py-2 text-right ${r.deadInPeriod > 0 ? "text-amber-400 print:text-black" : ""}`}>{r.deadInPeriod}</td>
                    <td className="px-3 py-2 text-right">{r.mortalityPct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{r.feedKg > 0 ? r.feedKg.toLocaleString("pl-PL", { maximumFractionDigits: 0 }) : "—"}</td>
                    <td className="px-3 py-2 text-right">{r.avgWeightG > 0 ? r.avgWeightG.toLocaleString("pl-PL") : "—"}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${r.fcr > 0 && r.fcr < 2.5 ? "text-emerald-400" : r.fcr > 3 ? "text-red-400" : ""} print:text-black`}>
                      {r.fcr > 0 ? r.fcr.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.epef > 0 ? r.epef.toFixed(0) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 print:block">
            {/* Alarmy IoT */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 print:mt-4 print:border-zinc-300 print:bg-white">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 print:text-zinc-700">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Alarmy klimatu w okresie ({d.alerts.length})
              </h2>
              {d.alerts.length === 0 && <p className="text-sm text-zinc-500 print:text-zinc-600">Brak przekroczeń — amoniak i temperatura w normie.</p>}
              {d.alerts.length > 0 && (
                <div className="max-h-64 space-y-1 overflow-y-auto text-sm print:max-h-none print:overflow-visible">
                  {d.alerts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-zinc-800/60 py-1 print:border-zinc-200">
                      <span><b>{a.house}</b> — {a.what}: <b className="text-amber-400 print:text-black">{a.value}</b></span>
                      <span className="text-xs text-zinc-500 print:text-zinc-600">{a.ts}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ścielenie */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 print:mt-4 print:border-zinc-300 print:bg-white">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 print:text-zinc-700">
                <Layers className="h-4 w-4 text-emerald-400" /> Ścielenie w okresie ({d.litter.length})
              </h2>
              {d.litter.length === 0 && <p className="text-sm text-zinc-500 print:text-zinc-600">Brak zapisów ścielenia w tym okresie.</p>}
              {d.litter.length > 0 && (
                <div className="max-h-64 space-y-1 overflow-y-auto text-sm print:max-h-none print:overflow-visible">
                  {d.litter.map((l, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-zinc-800/60 py-1 print:border-zinc-200">
                      <span>
                        <b>{l.house}</b> — {l.material}
                        {l.balesCount != null && <span>: {l.balesCount} bel × {l.baleKg ?? "?"} kg</span>}
                        {l.cost > 0 && <span className="text-zinc-500 print:text-zinc-600"> ({l.cost.toFixed(0)} zł)</span>}
                      </span>
                      <span className="text-xs text-zinc-500 print:text-zinc-600">{l.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-zinc-600 print:text-zinc-600">
            <CalendarDays className="h-3.5 w-3.5" /> Dni z zapisanym obchodem w okresie: {d.totals.daysWithLogs}.
            Wskazówka: użyj przycisku „Drukuj / PDF" i wybierz „Zapisz jako PDF", żeby wysłać raport dalej.
          </p>
        </>
      )}

      {d && !d.totals && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
          Brak stad w wybranym gospodarstwie — raport jest pusty.
        </p>
      )}
    </div>
  );
}
