import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { fmtNum } from "@/lib/geo";
import { Truck, FileText } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-500";

export default function Transfers() {
  const transfers = trpc.org.transfers.useQuery();
  const batches = trpc.farm.production.batches.useQuery();
  const structure = trpc.org.structure.useQuery();
  const utils = trpc.useUtils();
  const exec = trpc.org.executeTransfer.useMutation({
    onSuccess: () => { utils.org.transfers.invalidate(); utils.farm.production.batches.invalidate(); setShow(false); },
  });

  const [show, setShow] = useState(false);
  const [f, setF] = useState({
    sourceBatchId: 0, targetHouseId: 0, birdCount: 0,
    driver: "", vehicle: "", durationMin: 90, transportMortality: 0,
    signatureFrom: "", signatureTo: "",
  });

  const active = (batches.data ?? []).filter((b) => b.batch.status === "active");
  const allHouses = (structure.data?.companies ?? []).flatMap((c) =>
    c.farms.flatMap((fa) => fa.houses.map((h) => ({ ...h, farmName: fa.name, farmCity: fa.city }))),
  );
  const src = active.find((b) => b.batch.id === f.sourceBatchId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transfer Manager</h1>
          <p className="text-sm text-zinc-500">Przenoszenie i dzielenie stad · dokumenty przekazania · genealogia grup</p>
        </div>
        <button onClick={() => setShow(!show)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500">
          <Truck className="h-4 w-4" /> Nowy transfer
        </button>
      </div>

      {show && (
        <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-5">
          <h3 className="mb-4 font-semibold">Wykonaj transfer stada</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-zinc-500">Rzut źródłowy
              <select className={inputCls} value={f.sourceBatchId} onChange={(e) => setF({ ...f, sourceBatchId: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {active.map((b) => (
                  <option key={b.batch.id} value={b.batch.id}>
                    {b.batch.code} · {b.farm?.city} · {fmtNum(b.batch.currentCount)} szt.
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-500">Obiekt docelowy
              <select className={inputCls} value={f.targetHouseId} onChange={(e) => setF({ ...f, targetHouseId: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {allHouses.map((h) => (
                  <option key={h.id} value={h.id}>{h.farmName} · {h.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-500">Liczba sztuk
              <input type="number" className={inputCls} value={f.birdCount || ""} onChange={(e) => setF({ ...f, birdCount: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-zinc-500">Śmiertelność transportowa
              <input type="number" className={inputCls} value={f.transportMortality} onChange={(e) => setF({ ...f, transportMortality: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-zinc-500">Kierowca
              <input className={inputCls} value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Pojazd
              <input className={inputCls} value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">Czas transportu (min)
              <input type="number" className={inputCls} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-500">Podpis zdającego
                <input className={inputCls} value={f.signatureFrom} onChange={(e) => setF({ ...f, signatureFrom: e.target.value })} />
              </label>
              <label className="text-xs text-zinc-500">Podpis odbierającego
                <input className={inputCls} value={f.signatureTo} onChange={(e) => setF({ ...f, signatureTo: e.target.value })} />
              </label>
            </div>
          </div>
          {src && f.birdCount > 0 && (
            <p className="mt-3 text-xs text-zinc-400">
              Po transferze w źródle zostanie <b>{fmtNum(src.batch.currentCount - f.birdCount - f.transportMortality)}</b> szt.
              Śr. masa wg ostatniego ważenia: <b>{(src.avgWeightG / 1000).toFixed(2)} kg</b> — system zweryfikuje obsadę kg/m² w obiekcie docelowym.
            </p>
          )}
          <button
            disabled={exec.isPending || !f.sourceBatchId || !f.targetHouseId || !f.birdCount}
            onClick={() => exec.mutate({ ...f, driver: f.driver || undefined, vehicle: f.vehicle || undefined, signatureFrom: f.signatureFrom || undefined, signatureTo: f.signatureTo || undefined })}
            className="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
          >
            {exec.isPending ? "Przetwarzanie…" : "Wykonaj transfer (atomowo)"}
          </button>
          {exec.isError && <p className="mt-2 text-xs text-red-400">{exec.error.message}</p>}
        </div>
      )}

      <div className="space-y-2">
        {(transfers.data ?? []).map((t) => (
          <div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <FileText className="h-5 w-5 text-red-400" />
              <span className="font-mono text-sm font-semibold">{t.documentNo}</span>
              <span className="text-xs text-zinc-500">{new Date(t.transferDate).toLocaleString("pl-PL")}</span>
              <span className="ml-auto rounded bg-zinc-800 px-2 py-1 text-xs font-medium">
                {fmtNum(t.birdCount)} szt. {t.avgWeightG ? `· śr. ${(t.avgWeightG / 1000).toFixed(2)} kg` : ""}
              </span>
            </div>
            <div className="mt-2 grid gap-1 text-sm text-zinc-300 sm:grid-cols-2">
              <div>← {t.source}</div>
              <div>→ {t.target}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
              {t.driver && <span>Kierowca: {t.driver}</span>}
              {t.vehicle && <span>Pojazd: {t.vehicle}</span>}
              {t.durationMin && <span>Czas: {t.durationMin} min</span>}
              {t.transportMortality > 0 && <span className="text-amber-400">Śmiertelność transportowa: {t.transportMortality}</span>}
              {t.signatureFrom && <span>Zdał: {t.signatureFrom}</span>}
              {t.signatureTo && <span>Odebrał: {t.signatureTo}</span>}
            </div>
          </div>
        ))}
        {transfers.data?.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-500">
            Brak transferów. Wykonaj pierwszy transfer stada — np. z odchowalni do kurników.
          </div>
        )}
      </div>
    </div>
  );
}
