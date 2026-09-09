import { trpc } from "@/providers/trpc";
import { fmtEur, num } from "@/lib/geo";
import { useState } from "react";
import { ShieldAlert, Syringe, Plus } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-500";


function LibraryAndWithdrawals() {
  const diseases = trpc.gap.healthIntel.diseases.useQuery();
  const withdrawals = trpc.gap.healthIntel.withdrawals.useQuery();
  const cat: Record<string, string> = { viral: "Wirusowa", bacterial: "Bakteryjna", parasitic: "Pasożytnicza", metabolic: "Metaboliczna", fungal: "Grzybicza", other: "Inna" };
  const sevCls: Record<string, string> = { low: "text-zinc-400", medium: "text-amber-400", high: "text-orange-400", critical: "text-red-400" };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Biblioteka chorób (disease library)</h2>
        <div className="space-y-2">
          {(diseases.data ?? []).map((d) => (
            <details key={d.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                <span className={sevCls[d.severity]}>●</span> {d.name}
                <span className="ml-2 text-xs font-normal text-zinc-500">{cat[d.category]}</span>
              </summary>
              <div className="mt-2 space-y-1 text-xs text-zinc-400">
                <p><span className="font-semibold text-zinc-300">Objawy: </span>{d.symptoms}</p>
                <p><span className="font-semibold text-zinc-300">Diagnostyka: </span>{d.diagnosis}</p>
                <p><span className="font-semibold text-emerald-400">Leczenie: </span>{d.treatmentProtocol}</p>
                <p><span className="font-semibold text-sky-400">Zapobieganie: </span>{d.prevention}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Okresy karencji — bezpieczna sprzedaż</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500"><th className="py-2">Lek</th><th>Start</th><th>Karencja</th><th>Bezpieczna od</th><th></th></tr></thead>
          <tbody>
            {(withdrawals.data ?? []).map((w) => {
              const safe = w.safeFrom <= today;
              return (
                <tr key={w.id} className="border-b border-zinc-800/60">
                  <td className="py-2">{w.medicine}</td><td>{w.startDay}</td><td>{w.withdrawalDays} d</td>
                  <td className={safe ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{w.safeFrom}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${safe ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{safe ? "OK" : "KARENCJA"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Health() {
  const treatments = trpc.farm.health.treatments.useQuery();
  const vaccinations = trpc.farm.health.vaccinations.useQuery();
  const batches = trpc.farm.production.batches.useQuery();
  const utils = trpc.useUtils();
  const add = trpc.farm.health.addTreatment.useMutation({
    onSuccess: () => utils.farm.health.treatments.invalidate(),
  });
  const markVax = trpc.farm.health.markVaccinationDone.useMutation({
    onSuccess: () => utils.farm.health.vaccinations.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({
    batchId: 0, startedAt: new Date().toISOString().slice(0, 10), product: "",
    activeSubstance: "", dose: "", reason: "", withdrawalDays: 7, vet: "", cost: 0,
  });

  const active = (batches.data ?? []).filter((b) => b.batch.status === "active");
  const activeWithdrawals = (treatments.data ?? []).filter((t) => t.withdrawalDaysLeft > 0);
  const upcoming = (vaccinations.data ?? []).filter((v) => !v.done).slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Zdrowie — Health Intelligence</h1>
          <p className="text-sm text-zinc-500">Leczenie, karencje (rozporządzenie UE 37/2010) i kalendarz szczepień</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500">
          <Plus className="h-4 w-4" /> Rejestruj leczenie
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <label className="text-xs text-zinc-500">Rzut
              <select className={inputCls} value={f.batchId} onChange={(e) => setF({ ...f, batchId: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {active.map((b) => <option key={b.batch.id} value={b.batch.id}>{b.batch.code} ({b.farm?.city})</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-500">Data rozpoczęcia
              <input type="date" className={inputCls} value={f.startedAt} onChange={(e) => setF({ ...f, startedAt: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Preparat
              <input className={inputCls} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Substancja czynna
              <input className={inputCls} value={f.activeSubstance} onChange={(e) => setF({ ...f, activeSubstance: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Dawka
              <input className={inputCls} placeholder="10 mg/kg m.c." value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Karencja (dni)
              <input type="number" className={inputCls} value={f.withdrawalDays} onChange={(e) => setF({ ...f, withdrawalDays: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-zinc-500">Wskazanie
              <input className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Lekarz / koszt (EUR)
              <div className="flex gap-2">
                <input className={inputCls} value={f.vet} onChange={(e) => setF({ ...f, vet: e.target.value })} />
                <input type="number" className={`${inputCls} w-28`} value={f.cost} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} />
              </div>
            </label>
          </div>
          <button
            disabled={add.isPending || !f.batchId || !f.product}
            onClick={() => { add.mutate({ ...f, batchId: f.batchId, reason: f.reason || undefined, vet: f.vet || undefined }); setShowForm(false); }}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
          >Zapisz (utworzy też koszt weterynaryjny)</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <ShieldAlert className="h-4 w-4 text-amber-400" /> Aktywne karencje ({activeWithdrawals.length})
          </h2>
          {activeWithdrawals.map((t) => (
            <div key={t.id} className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.product} <span className="font-mono text-xs text-zinc-500">({t.batchCode})</span></span>
                <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs font-bold text-amber-300">
                  {t.withdrawalDaysLeft} dni do końca
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {t.activeSubstance} · {t.dose} · ubój możliwy od {t.withdrawalEnd.toISOString().slice(0, 10)}
              </div>
            </div>
          ))}
          {activeWithdrawals.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
              Brak aktywnych karencji — wszystkie stada dopuszczone do uboju.
            </div>
          )}

          <h2 className="pt-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Pełna historia leczenia ({treatments.data?.length ?? 0})
          </h2>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {(treatments.data ?? []).map((t) => (
              <div key={t.id} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{t.product} <span className="font-mono text-xs text-zinc-500">({t.batchCode})</span></span>
                  <span className="text-xs text-zinc-500">{fmtEur(num(t.cost))}</span>
                </div>
                <div className="text-xs text-zinc-400">{t.startedAt} · {t.activeSubstance} · {t.reason ?? "—"} · {t.vet ?? ""}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <Syringe className="h-4 w-4 text-red-400" /> Nadchodzące szczepienia
          </h2>
          <div className="space-y-1.5">
            {upcoming.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm">
                <span className="font-mono text-xs text-zinc-500">{v.batchCode}</span>
                <span className="text-zinc-400">{v.day}</span>
                <span className="flex-1">{v.vaccine}</span>
                <button onClick={() => markVax.mutate({ id: v.id })} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
                  Wykonane
                </button>
              </div>
            ))}
            {upcoming.length === 0 && <div className="text-sm text-zinc-600">Brak zaplanowanych szczepień.</div>}
          </div>
        </div>
      </div>
      <LibraryAndWithdrawals />
    </div>
  );
}
