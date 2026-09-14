import { useState } from "react";
import { trpc } from "@/providers/trpc";

/**
 * FINANCE DASHBOARD — panel finansowy.
 * 
 * Sekcje:
 * - KPI: przychody, koszty, marża, cash flow
 * - P&L — rachunek zysków i strat
 * - Cash flow
 * - Aging — przeterminowane faktury
 * - Budżet vs rzeczywistość
 * - Koszty per rzut
 */
export default function FinanceDashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = cały rok
  const [activeTab, setActiveTab] = useState<"pl" | "cashflow" | "aging" | "budget" | "batches">("pl");

  // P&L
  const { data: pl } = trpc.finance.getProfitLoss.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Cash flow
  const { data: cashflow } = trpc.finance.getCashFlow.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Aging
  const { data: aging } = trpc.finance.getAging.useQuery({});

  // Budżet
  const { data: budget } = trpc.finance.getBudget.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const fmt = (n: number | string | null | undefined) => {
    if (n == null) return "—";
    const num = typeof n === "string" ? parseFloat(n) : n;
    return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
  };

  const fmtPct = (n: number | string | null | undefined) => {
    if (n == null) return "—";
    const num = typeof n === "string" ? parseFloat(n) : n;
    return num.toFixed(1) + "%";
  };

  const categoryLabels: Record<string, string> = {
    feed: "Pasza",
    chicks: "Pisklęta",
    medicine: "Leki",
    equipment: "Wyposażenie",
    energy: "Energia",
    labor: "Robocizna",
    transport: "Transport",
    veterinary: "Weterynaria",
    insurance: "Ubezpieczenie",
    tax: "Podatki",
    other: "Inne",
    revenue: "Przychody",
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Panel finansowy</h1>
          <p className="mt-2 text-zinc-400">
            Przychody, koszty, marża, cash flow, budżetowanie
          </p>
        </div>

        {/* Filtry okresu */}
        <div className="mb-6 flex gap-4">
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            <option value={0}>Cały rok</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleDateString('pl-PL', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        {/* KPI Cards */}
        {pl && (
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Przychody</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400">
                {fmt(pl.summary.totalRevenue)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Koszty</div>
              <div className="mt-1 text-2xl font-bold text-red-400">
                {fmt(pl.summary.totalCosts)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Zysk brutto</div>
              <div className={`mt-1 text-2xl font-bold ${
                parseFloat(pl.summary.grossProfit) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}>
                {fmt(pl.summary.grossProfit)}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Marża brutto</div>
              <div className={`mt-1 text-2xl font-bold ${
                parseFloat(pl.summary.grossMarginPct) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}>
                {fmtPct(pl.summary.grossMarginPct)}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-zinc-800">
          {([
            ["pl", "P&L"],
            ["cashflow", "Cash Flow"],
            ["aging", "Aging"],
            ["budget", "Budżet"],
            ["batches", "Koszty rzutów"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === key
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* P&L Tab */}
        {activeTab === "pl" && pl && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Przychody */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-lg font-semibold text-emerald-400">Przychody</h3>
              <div className="space-y-2">
                {pl.revenues.map((r: any) => (
                  <div key={r.category} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{categoryLabels[r.category] ?? r.category}</span>
                    <span className="text-zinc-200">{fmt(r.amount)}</span>
                  </div>
                ))}
                {pl.revenues.length === 0 && (
                  <div className="text-zinc-500 text-sm">Brak przychodów w tym okresie</div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between font-bold">
                <span className="text-zinc-300">Razem</span>
                <span className="text-emerald-400">{fmt(pl.summary.totalRevenue)}</span>
              </div>
            </div>

            {/* Koszty */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-lg font-semibold text-red-400">Koszty</h3>
              <div className="space-y-2">
                {pl.costs.map((c: any) => (
                  <div key={c.category} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{categoryLabels[c.category] ?? c.category}</span>
                    <span className="text-zinc-200">{fmt(c.amount)}</span>
                  </div>
                ))}
                {pl.costs.length === 0 && (
                  <div className="text-zinc-500 text-sm">Brak kosztów w tym okresie</div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between font-bold">
                <span className="text-zinc-300">Razem</span>
                <span className="text-red-400">{fmt(pl.summary.totalCosts)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow Tab */}
        {activeTab === "cashflow" && cashflow && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-6 text-lg font-semibold text-zinc-200">Przepływ środków</h3>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Inflows */}
              <div>
                <h4 className="mb-3 text-sm font-medium text-emerald-400">Wpływy</h4>
                <div className="space-y-2">
                  {cashflow.inflows.map((i: any) => (
                    <div key={i.category} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{categoryLabels[i.category] ?? i.category}</span>
                      <span className="text-emerald-400">+{fmt(i.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between font-bold">
                  <span className="text-zinc-300">Razem wpływy</span>
                  <span className="text-emerald-400">{fmt(cashflow.summary.totalInflow)}</span>
                </div>
              </div>

              {/* Outflows */}
              <div>
                <h4 className="mb-3 text-sm font-medium text-red-400">Wydatki</h4>
                <div className="space-y-2">
                  {cashflow.outflows.map((o: any) => (
                    <div key={o.category} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{categoryLabels[o.category] ?? o.category}</span>
                      <span className="text-red-400">-{fmt(o.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between font-bold">
                  <span className="text-zinc-300">Razem wydatki</span>
                  <span className="text-red-400">{fmt(cashflow.summary.totalOutflow)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-800 flex justify-between text-xl font-bold">
              <span className="text-zinc-200">Net cash flow</span>
              <span className={parseFloat(cashflow.summary.netCashFlow) >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmt(cashflow.summary.netCashFlow)}
              </span>
            </div>
          </div>
        )}

        {/* Aging Tab */}
        {activeTab === "aging" && aging && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-6 text-lg font-semibold text-zinc-200">
              Aging należności (na dzień {aging.asOfDate})
            </h3>

            <div className="space-y-4">
              {aging.buckets.map((bucket: any) => (
                <div key={bucket.key} className="flex items-center gap-4">
                  <div className="w-48 text-sm text-zinc-400">{bucket.label}</div>
                  <div className="flex-1">
                    <div className="h-6 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          bucket.key === "current" ? "bg-emerald-500" :
                          bucket.key === "d1_30" ? "bg-amber-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${parseFloat(bucket.pctOfTotal)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right text-zinc-200">{fmt(bucket.amount)}</div>
                  <div className="w-16 text-right text-zinc-500 text-sm">{bucket.count} szt.</div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-800 grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-zinc-500">Całkowite należności</div>
                <div className="text-xl font-bold text-zinc-100">{fmt(aging.summary.totalOutstanding)}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Przeterminowane</div>
                <div className="text-xl font-bold text-red-400">{fmt(aging.summary.totalOverdue)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Tab */}
        {activeTab === "budget" && budget && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-6 text-lg font-semibold text-zinc-200">Budżet vs Rzeczywistość</h3>

            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Kategoria</th>
                  <th className="px-4 py-3 text-right">Planowane</th>
                  <th className="px-4 py-3 text-right">Rzeczywiste</th>
                  <th className="px-4 py-3 text-right">Różnica</th>
                  <th className="px-4 py-3 text-right">Wykonanie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {budget.budgets.map((b: any) => {
                  const planned = parseFloat(b.plannedAmount);
                  const actual = parseFloat(b.actualAmount);
                  const variance = parseFloat(b.variance);
                  const pct = planned > 0 ? (actual / planned * 100) : 0;

                  return (
                    <tr key={b.id}>
                      <td className="px-4 py-3 text-zinc-300">
                        {categoryLabels[b.category] ?? b.category}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-200">{fmt(b.plannedAmount)}</td>
                      <td className="px-4 py-3 text-right text-zinc-200">{fmt(b.actualAmount)}</td>
                      <td className={`px-4 py-3 text-right ${variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {variance >= 0 ? "+" : ""}{fmt(b.variance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs ${
                          pct <= 90 ? "bg-emerald-900/50 text-emerald-300" :
                          pct <= 110 ? "bg-amber-900/50 text-amber-300" :
                          "bg-red-900/50 text-red-300"
                        }`}>
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Batches Tab */}
        {activeTab === "batches" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-6 text-lg font-semibold text-zinc-200">Koszty per rzut</h3>
            <p className="text-zinc-500 text-sm">
              Wybierz rzut z listy aby zobaczyć szczegóły kosztów
            </p>
            {/* TODO: lista rzutów z wyszukiwaniem */}
          </div>
        )}
      </div>
    </div>
  );
}
