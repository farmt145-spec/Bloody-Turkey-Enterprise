import { trpc } from "@/providers/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { countryFlag, fmtNum, num } from "@/lib/geo";
import { Container, Database } from "lucide-react";


function LotsSection() {
  const lots = trpc.gap.lots.lots.useQuery();
  const scan = trpc.gap.lots.scanAlerts.useMutation({ onSuccess: (r) => toast.success(`Wygenerowano ${r.alertsCreated} alertów ważności`) });
  const [trace, setTrace] = useState<string | null>(null);
  const traceQ = trpc.gap.lots.traceability.useQuery({ lotNumber: trace ?? "" }, { enabled: !!trace });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Partie magazynowe (FIFO/FEFO) + traceability</h2>
        <button onClick={() => scan.mutate()} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20">
          Skanuj alerty ważności
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500">
            <th className="py-2">Partia</th><th>Produkt</th><th>Stan</th><th>Przyjęcie</th><th>Ważność</th><th></th>
          </tr></thead>
          <tbody>
            {(lots.data ?? []).map((l) => {
              const expired = l.expiryDate && l.expiryDate < today;
              const soon = l.expiryDate && !expired && l.expiryDate < new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
              return (
                <tr key={l.id} className="border-b border-zinc-800/60">
                  <td className="py-2 font-mono text-xs">{l.lotNumber}</td>
                  <td>{l.product}</td>
                  <td>{Number(l.qty).toLocaleString("pl-PL")} {l.unit}</td>
                  <td>{l.receivedDate}</td>
                  <td className={expired ? "text-red-400 font-bold" : soon ? "text-amber-400" : ""}>{l.expiryDate ?? "—"}</td>
                  <td><button onClick={() => setTrace(l.lotNumber)} className="text-xs text-emerald-400 hover:underline">Śledź</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {trace && traceQ.data && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Traceability: {trace}</span>
            <button onClick={() => setTrace(null)} className="text-xs text-zinc-500 hover:text-zinc-300">zamknij</button>
          </div>
          <div className="space-y-1 text-xs text-zinc-300">
            {traceQ.data.movements.map((m) => (
              <div key={m.id} className="flex gap-3">
                <span className="text-zinc-500">{m.day}</span>
                <span className={m.kind === "in" ? "text-emerald-400" : "text-red-400"}>{m.kind === "in" ? "+" : "−"}{Number(m.qty).toLocaleString("pl-PL")}</span>
                <span>{m.reference}{m.batchId ? ` · rzut #${m.batchId}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Warehouse() {
  const q = trpc.org.warehouseOverview.useQuery();
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Magazyn — Warehouse Engine</h1>
        <p className="text-sm text-zinc-500">Silosy i magazyny na fermach · powiązanie z recepturami</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <Database className="h-4 w-4 text-red-400" /> Silosy ({d?.silos.length ?? 0})
          </h2>
          <div className="space-y-2">
            {(d?.silos ?? []).map((sl) => {
              const fill = num(sl.currentTons) / Math.max(num(sl.capacityTons), 0.1);
              return (
                <div key={sl.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{sl.name}</span>
                    <span className="text-xs text-zinc-500">
                      {sl.farm ? `${countryFlag(sl.farm.countryCode)} ${sl.farm.city}` : ""}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${fill > 0.85 ? "bg-red-500" : fill > 0.5 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(fill * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-zinc-400">
                    <span>{fmtNum(num(sl.currentTons), 1)} / {fmtNum(num(sl.capacityTons))} t</span>
                    <span>{sl.recipe ? sl.recipe.name : "pusty / bez receptury"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <Container className="h-4 w-4 text-red-400" /> Magazyny ({d?.warehouses.length ?? 0})
          </h2>
          <div className="space-y-2">
            {(d?.warehouses ?? []).map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
                <span className="font-medium">{w.name}</span>
                <span className="text-xs text-zinc-500">
                  {w.farm ? `${countryFlag(w.farm.countryCode)} ${w.farm.city}` : ""} · pojemność {fmtNum(num(w.capacityTons))} t
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <LotsSection />
    </div>
  );
}
