import { useState } from "react";
import { trpc } from "@/providers/trpc";

/**
 * SLAUGHTER COST CHAIN — pełny łańcuch kosztów od pisklaka do kg tuszki.
 * Pokazuje: koszty per kategoria, koszt/kg żywca, koszt/kg tuszki, FCR, EPEF, marżę.
 */
export default function SlaughterCostChain() {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [filterGeneticLine, setFilterGeneticLine] = useState("");
  const [filterSex, setFilterSex] = useState<"toms" | "hens" | "">("");

  // Pobierz wszystkie partie ubojowe firmy
  const { data: overview, isLoading } = trpc.slaughterCostChain.getCompanyCostOverview.useQuery({
    geneticLine: filterGeneticLine || undefined,
    sex: (filterSex || undefined) as "toms" | "hens" | undefined,
  });


  // Eksport CSV
  const exportCsv = trpc.slaughterReports.exportCsv.useQuery(
    { slaughterBatchIds: overview?.batchInfo.map(b => b.id) ?? [] },
    { enabled: false }
  );

  // Eksport JSON
  const exportJson = trpc.slaughterReports.exportJson.useQuery(
    { slaughterBatchIds: overview?.batchInfo.map(b => b.id) ?? [] },
    { enabled: false }
  );

  // Trend kosztów
  const { data: trend } = trpc.slaughterReports.getCostTrend.useQuery({ months: 12 });

  const handleExportCsv = async () => {
    if (!overview) return;
    const result = await exportCsv.refetch();
    if (result.data) {
      const blob = new Blob(['\ufeff' + result.data.content], { type: result.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportJson = async () => {
    if (!overview) return;
    const result = await exportJson.refetch();
    if (result.data) {
      const blob = new Blob([result.data.content], { type: result.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Pobierz szczegóły wybranej partii
  const { data: detail } = trpc.slaughterCostChain.getCostChain.useQuery(
    { slaughterBatchId: selectedBatchId! },
    { enabled: selectedBatchId != null }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Ładowanie danych uboju...</div>
      </div>
    );
  }

  const fmt = (n: number | null | undefined, suffix = "") => 
    n != null ? `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}` : "—";

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Łańcuch kosztów uboju</h1>
          <p className="mt-2 text-zinc-400">
            Pełny koszt produkcji od pisklaka do kg tuszki — pasza, weterynaria, transport, ubój
          </p>
        </div>

        {/* Filtry */}
        <div className="mb-6 flex gap-4">
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={filterGeneticLine}
            onChange={(e) => setFilterGeneticLine(e.target.value)}
          >
            <option value="">Wszystkie linie</option>
            <option value="B.U.T. BIG 6">B.U.T. BIG 6</option>
            <option value="B.U.T. 6">B.U.T. 6</option>
            <option value="NICHOLAS">NICHOLAS</option>
            <option value="HYBRID CONVERTER">HYBRID CONVERTER</option>
            <option value="HYBRID GRADE MAKER">HYBRID GRADE MAKER</option>
          </select>

          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={filterSex}
            onChange={(e) => setFilterSex(e.target.value as "toms" | "hens" | "")}
          >
            <option value="">Indory + indyczki</option>
            <option value="toms">Indory</option>
            <option value="hens">Indyczki</option>
          </select>
        </div>


        {/* Przyciski eksportu */}
        {overview && overview.chains.length > 0 && (
          <div className="mb-6 flex gap-3">
            <button
              onClick={handleExportCsv}
              className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-900/50"
            >
              📥 Eksport CSV
            </button>
            <button
              onClick={handleExportJson}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              📥 Eksport JSON
            </button>
          </div>
        )}

        {/* Wykres trendu kosztów */}
        {trend && trend.trend.length > 0 && (
          <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">
              Trend kosztów (ostatnie {trend.summary.months} miesięcy)
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-xs text-zinc-500">Śr. koszt/kg żywca</div>
                <div className="text-lg font-bold text-emerald-400">
                  {fmt(trend.summary.avgCostPerKgLive, " zł")}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-xs text-zinc-500">Śr. koszt/kg tuszki</div>
                <div className="text-lg font-bold text-amber-400">
                  {fmt(trend.summary.avgCostPerKgCarcass, " zł")}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-xs text-zinc-500">Śr. wydajność</div>
                <div className="text-lg font-bold text-zinc-100">
                  {fmt(trend.summary.avgYieldPct, "%")}
                </div>
              </div>
            </div>

            {/* Prosty wykres słupkowy */}
            <div className="space-y-2">
              {trend.trend.map((m) => (
                <div key={m.month} className="flex items-center gap-4">
                  <div className="w-20 text-sm text-zinc-400">{m.month}</div>
                  <div className="flex-1 flex gap-1">
                    <div 
                      className="h-6 rounded-l bg-emerald-500/70"
                      style={{ width: `${(m.avgCostPerKgLive / Math.max(...trend.trend.map(t => t.avgCostPerKgLive))) * 50}%` }}
                      title={`Koszt/kg żywca: ${fmt(m.avgCostPerKgLive, " zł")}`}
                    />
                    <div 
                      className="h-6 rounded-r bg-amber-500/70"
                      style={{ width: `${(m.avgCostPerKgCarcass / Math.max(...trend.trend.map(t => t.avgCostPerKgCarcass))) * 50}%` }}
                      title={`Koszt/kg tuszki: ${fmt(m.avgCostPerKgCarcass, " zł")}`}
                    />
                  </div>
                  <div className="w-24 text-right text-sm text-zinc-300">
                    {m.batches} partii
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-6 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-emerald-500/70" />
                <span>Koszt/kg żywca</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-amber-500/70" />
                <span>Koszt/kg tuszki</span>
              </div>
            </div>
          </div>
        )}

        {/* Podsumowanie */}
        {overview && (
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Partie ubojowe</div>
              <div className="mt-1 text-2xl font-bold text-zinc-100">{overview.summary.totalBatches}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Śr. koszt/kg żywca</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400">
                {fmt(overview.summary.avgCostPerKgLive, " zł")}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Śr. koszt/kg tuszki</div>
              <div className="mt-1 text-2xl font-bold text-amber-400">
                {fmt(overview.summary.avgCostPerKgCarcass, " zł")}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Śr. wydajność</div>
              <div className="mt-1 text-2xl font-bold text-zinc-100">
                {fmt(overview.summary.avgYieldPct, "%")}
              </div>
            </div>
          </div>
        )}

        {/* Tabela partii */}
        {overview && overview.chains.length > 0 && (
          <div className="mb-8 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Linia</th>
                  <th className="px-4 py-3">Płeć</th>
                  <th className="px-4 py-3 text-right">Koszt/kg żywca</th>
                  <th className="px-4 py-3 text-right">Koszt/kg tuszki</th>
                  <th className="px-4 py-3 text-right">Wydajność</th>
                  <th className="px-4 py-3 text-right">FCR</th>
                  <th className="px-4 py-3 text-right">Marża</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {overview.chains.map((chain, idx) => {
                  const info = overview.batchInfo[idx];
                  return (
                    <tr 
                      key={idx} 
                      className={`bg-zinc-900/50 hover:bg-zinc-800/50 cursor-pointer ${
                        selectedBatchId === info.id ? 'bg-emerald-900/20' : ''
                      }`}
                      onClick={() => setSelectedBatchId(info.id)}
                    >
                      <td className="px-4 py-3 font-mono text-zinc-300">{info.code}</td>
                      <td className="px-4 py-3 text-zinc-400">{info.geneticLine}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {info.sex === 'toms' ? 'Indor' : 'Indyczka'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-200">
                        {fmt(chain.costPerKgLive, " zł")}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-400 font-medium">
                        {fmt(chain.costPerKgCarcass, " zł")}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-200">
                        {fmt(chain.yieldPct, "%")}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-200">
                        {fmt(chain.fcr)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        (chain.margin ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {fmt(chain.margin, " zł")}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs text-emerald-400 hover:text-emerald-300">
                          Szczegóły →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Szczegóły wybranej partii */}
        {detail && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-6 text-xl font-bold text-zinc-100">
              Szczegóły: {detail.slaughterBatch.code}
            </h2>

            {/* KPI */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">Koszt całkowity</div>
                <div className="mt-1 text-xl font-bold text-zinc-100">
                  {fmt(detail.costChain.costs.total, " zł")}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">Koszt/kg żywca</div>
                <div className="mt-1 text-xl font-bold text-emerald-400">
                  {fmt(detail.costChain.costPerKgLive, " zł")}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">Koszt/kg tuszki</div>
                <div className="mt-1 text-xl font-bold text-amber-400">
                  {fmt(detail.costChain.costPerKgCarcass, " zł")}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">Przychód netto</div>
                <div className="mt-1 text-xl font-bold text-zinc-100">
                  {fmt(detail.costChain.revenueNet, " zł")}
                </div>
              </div>
            </div>

            {/* Rozbicie kosztów */}
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">Rozbicie kosztów</h3>
            <div className="mb-6 space-y-2">
              {detail.costChain.breakdown.map((item) => (
                <div key={item.category} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-zinc-400">{item.label}</div>
                  <div className="flex-1">
                    <div className="h-4 rounded-full bg-zinc-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${item.percentOfTotal}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm text-zinc-300">
                    {fmt(item.amount, " zł")}
                  </div>
                  <div className="w-16 text-right text-xs text-zinc-500">
                    {item.percentOfTotal}%
                  </div>
                  <div className="w-28 text-right text-xs text-zinc-500">
                    {fmt(item.costPerKgCarcass, " zł/kg")}
                  </div>
                </div>
              ))}
            </div>

            {/* Dodatkowe wskaźniki */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">FCR</div>
                <div className="mt-1 text-lg font-bold text-zinc-100">
                  {fmt(detail.costChain.fcr)}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">EPEF</div>
                <div className="mt-1 text-lg font-bold text-zinc-100">
                  {fmt(detail.costChain.epef)}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">Wydajność</div>
                <div className="mt-1 text-lg font-bold text-zinc-100">
                  {fmt(detail.costChain.yieldPct, "%")}
                </div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4">
                <div className="text-xs text-zinc-500">Marża %</div>
                <div className={`mt-1 text-lg font-bold ${
                  (detail.costChain.marginPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {fmt(detail.costChain.marginPct, "%")}
                </div>
              </div>
            </div>

            {/* Dane wejściowe */}
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
              <div>
                <span className="text-zinc-500">Pisklęta: </span>
                <span className="text-zinc-300">{detail.costChain.initialCount} szt.</span>
              </div>
              <div>
                <span className="text-zinc-500">Sprzedane: </span>
                <span className="text-zinc-300">{detail.costChain.soldCount} szt.</span>
              </div>
              <div>
                <span className="text-zinc-500">Padłe: </span>
                <span className="text-zinc-300">{detail.costChain.deadCount} szt.</span>
              </div>
              <div>
                <span className="text-zinc-500">Masa żywa: </span>
                <span className="text-zinc-300">{fmt(detail.costChain.liveWeightKg, " kg")}</span>
              </div>
              <div>
                <span className="text-zinc-500">Masa tuszek: </span>
                <span className="text-zinc-300">{fmt(detail.costChain.carcassWeightKg, " kg")}</span>
              </div>
              <div>
                <span className="text-zinc-500">Cena pisklęcia: </span>
                <span className="text-zinc-300">{fmt(detail.costChain.chickPrice, " zł")}</span>
              </div>
            </div>
          </div>
        )}

        {/* Pusty stan */}
        {overview && overview.chains.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <div className="text-zinc-500">Brak danych uboju dla wybranych filtrów</div>
          </div>
        )}
      </div>
    </div>
  );
}
