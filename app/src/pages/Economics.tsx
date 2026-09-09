import { trpc } from "@/providers/trpc";
import { fmtEur, fmtEur2, fmtNum } from "@/lib/geo";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const CAT_LABELS: Record<string, string> = {
  chicks: "Pisklęta", feed: "Pasza", vet: "Weterynaria", energy: "Energia",
  litter: "Ściółka", labor: "Robocizna", transport: "Transport", other: "Inne",
};
const COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ec4899", "#6366f1", "#71717a"];

export default function Economics() {
  const pnl = trpc.farm.economics.batchPnl.useQuery();
  const rows = pnl.data ?? [];

  const totalCosts = rows.reduce((a, r) => a + r.totalCosts, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const totalMargin = totalRevenue - totalCosts;

  const byCat: Record<string, number> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.costsByCategory)) {
      byCat[k] = (byCat[k] ?? 0) + v;
    }
  }
  const pieData = Object.entries(byCat).map(([k, v]) => ({ name: CAT_LABELS[k] ?? k, value: Math.round(v) }));

  const closed = rows.filter((r) => r.batch.status === "closed");
  const barData = closed.map((r) => ({
    code: r.batch.code.split("/").slice(1).join("/"),
    koszty: Math.round(r.totalCosts), przychód: Math.round(r.revenue),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ekonomia produkcji</h1>
        <p className="text-sm text-zinc-500">PnL per rzut · koszt produkcji kg · marże · wartości w PLN (przeliczane z EUR po 4,28)</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Koszty ogółem</div>
          <div className="mt-1 text-2xl font-bold">{fmtEur(totalCosts)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Przychody (sprzedaże)</div>
          <div className="mt-1 text-2xl font-bold">{fmtEur(totalRevenue)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${totalMargin >= 0 ? "border-emerald-900/50 bg-emerald-950/20" : "border-red-900/50 bg-red-950/20"}`}>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Marża (zamknięte + aktywne)</div>
          <div className={`mt-1 text-2xl font-bold ${totalMargin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmtEur(totalMargin)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">Struktura kosztów</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} formatter={(v) => fmtEur(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">Zamknięte rzuty: koszty vs przychód</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid stroke="#27272a" />
              <XAxis dataKey="code" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} formatter={(v) => fmtEur(Number(v))} />
              <Legend />
              <Bar dataKey="koszty" fill="#f59e0b" />
              <Bar dataKey="przychód" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Rzut</th>
              <th className="px-4 py-3 text-right">Pisklęta</th>
              <th className="px-4 py-3 text-right">Pasza</th>
              <th className="px-4 py-3 text-right">Pozostałe</th>
              <th className="px-4 py-3 text-right">Koszty</th>
              <th className="px-4 py-3 text-right">Przychód</th>
              <th className="px-4 py-3 text-right">Marża</th>
              <th className="px-4 py-3 text-right">Koszt/kg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
            {rows.map((r) => {
              const other = r.totalCosts - (r.costsByCategory.chicks ?? 0) - (r.costsByCategory.feed ?? 0);
              return (
                <tr key={r.batch.id} className="hover:bg-zinc-900/70">
                  <td className="px-4 py-2.5 font-mono">{r.batch.code}
                    {r.batch.status === "active" && <span className="ml-2 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] text-emerald-400">W CHOWIE</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{fmtEur(r.costsByCategory.chicks ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{fmtEur(r.costsByCategory.feed ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{fmtEur(other)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtEur(r.totalCosts)}</td>
                  <td className="px-4 py-2.5 text-right">{r.revenue > 0 ? fmtEur(r.revenue) : "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.revenue > 0 ? fmtEur(r.margin) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{r.costPerKg > 0 ? fmtEur2(r.costPerKg) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">Ładowanie…</div>}
        <div className="bg-zinc-900 px-4 py-2 text-right text-xs text-zinc-500">
          Biomasa aktywna: {fmtNum(rows.reduce((a, r) => a + r.biomassKg, 0) / 1000, 0)} t
        </div>
      </div>
    </div>
  );
}
