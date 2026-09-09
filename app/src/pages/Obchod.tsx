import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { ClipboardList, Save, Egg, X } from "lucide-react";
import { parseNumInput } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500";

type Row = {
  batchId: number; code: string; house: string; currentCount: number; dayAge: number;
  geneticLine: string | null; lastWeightG: number | null; suggestedFeedKg: number | null;
  mortality: number; culls: number; waterLiters: number | null; feedKg: number | null;
  tempC: number | null; humidityPct: number | null; hasLog: boolean;
};

function PlacementForm({ onDone }: { onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const utils = trpc.useUtils();
  const housesQ = trpc.obchod.freeHouses.useQuery();
  const linesQ = trpc.genetics.lines.useQuery();
  const [form, setForm] = useState({
    houseId: 0, geneticLineId: 0, sex: "toms" as "toms" | "hens" | "mixed",
    initialCount: "", startDate: today, chickSupplier: "", chickPrice: "",
  });
  const mut = trpc.obchod.placement.useMutation({
    onSuccess: (r) => {
      toast.success(`Wstawiono pisklęta — rzut ${r.code}`);
      utils.obchod.invalidate(); utils.farm.invalidate(); utils.org.invalidate();
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const houses = (housesQ.data ?? []) as any[];
  const lines = linesQ.data ?? [];
  const selHouse = houses.find((h) => h.id === form.houseId);
  const canPlace = selHouse ? (selHouse.available?.[form.sex] ?? false) : false;

  return (
    <form
      className="space-y-3 rounded-xl border border-emerald-700/40 bg-zinc-900 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.houseId) return toast.error("Wybierz kurnik");
        if (!canPlace) return toast.error("Wybrany kurnik nie jest dostępny dla tej płci");
        if (!form.geneticLineId) return toast.error("Wybierz linię genetyczną");
        mut.mutate({
          houseId: form.houseId, geneticLineId: form.geneticLineId, sex: form.sex,
          initialCount: parseNumInput(form.initialCount) ?? 0, startDate: form.startDate,
          chickSupplier: form.chickSupplier || undefined,
          chickPrice: form.chickPrice ? (parseNumInput(form.chickPrice) ?? undefined) : undefined,
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-emerald-300"><Egg className="h-4 w-4" /> Wstawienie piskląt</h2>
        <button type="button" onClick={onDone} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-zinc-400">Kurnik
          <select className={inputCls} value={form.houseId} onChange={(e) => setForm({ ...form, houseId: Number(e.target.value) })}>
            <option value={0}>— wybierz —</option>
            {houses.map((h) => {
              const busy = (h.activeBatches ?? []).length > 0;
              return (
                <option key={h.id} value={h.id}>
                  {h.name}{busy ? ` (w chowie: ${h.activeBatches.map((b: any) => b.code).join(", ")})` : " (wolny)"}
                </option>
              );
            })}
          </select>
          {houses.length === 0 && !housesQ.isLoading && (
            <span className="mt-1 block text-[11px] text-amber-400">Brak kurników — dodaj kurnik w Strukturze.</span>
          )}
          {selHouse && !canPlace && (
            <span className="mt-1 block text-[11px] text-amber-400">
              {form.sex === "mixed"
                ? "Stado mieszane wymaga pustego kurnika."
                : "W tym kurniku jest już stado tej samej płci lub mieszane — wybierz inną płeć (chów mieszany: indory + indyczki) albo inny kurnik."}
            </span>
          )}
          {selHouse && canPlace && (selHouse.activeBatches ?? []).length > 0 && (
            <span className="mt-1 block text-[11px] text-emerald-400">Chów mieszany — dołożysz drugą płeć do tego kurnika.</span>
          )}
        </label>
        <label className="text-xs text-zinc-400">Linia genetyczna
          <select className={inputCls} value={form.geneticLineId} onChange={(e) => setForm({ ...form, geneticLineId: Number(e.target.value) })}>
            <option value={0}>— wybierz —</option>
            {lines.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-400">Płeć
          <select className={inputCls} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as any })}>
            <option value="toms">Koguty</option>
            <option value="hens">Indyczki</option>
            <option value="mixed">Mieszane</option>
          </select>
        </label>
        <label className="text-xs text-zinc-400">Liczba sztuk
          <input type="text" inputMode="numeric" required className={inputCls} value={form.initialCount}
            onChange={(e) => setForm({ ...form, initialCount: e.target.value })} placeholder="np. 12000" />
        </label>
        <label className="text-xs text-zinc-400">Data wstawienia
          <input type="date" className={inputCls} value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </label>
        <label className="text-xs text-zinc-400">Dostawca piskląt (opcj.)
          <input className={inputCls} value={form.chickSupplier}
            onChange={(e) => setForm({ ...form, chickSupplier: e.target.value })} placeholder="Wylęgarnia…" />
        </label>
        <label className="text-xs text-zinc-400">Cena pisklęcia zł/szt (opcj.)
          <input type="text" inputMode="decimal" className={inputCls} value={form.chickPrice}
            onChange={(e) => setForm({ ...form, chickPrice: e.target.value })} placeholder="np. 6.50" />
        </label>
      </div>
      <button disabled={mut.isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
        {mut.isPending ? "Zapisywanie…" : "Wstaw pisklęta"}
      </button>
      <p className="text-xs text-zinc-500">
        System utworzy rzut, harmonogram chowu i program żywieniowy wg norm wybranej linii genetycznej.
      </p>
    </form>
  );
}

export default function Obchod() {
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [showPlacement, setShowPlacement] = useState(false);
  const utils = trpc.useUtils();
  const q = trpc.obchod.day.useQuery({ day });
  const save = trpc.obchod.save.useMutation({
    onSuccess: (r) => { toast.success(`Zapisano obchód — ${r.saved} kurników`); utils.obchod.day.invalidate(); utils.farm.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<number, Partial<Row>>>({});
  useEffect(() => {
    const init: Record<number, Partial<Row>> = {};
    for (const r of q.data?.rows ?? []) init[r.batchId] = { ...r };
    setForm(init);
  }, [q.data]);

  const set = (batchId: number, k: string, v: string) =>
    setForm((f) => ({ ...f, [batchId]: { ...f[batchId], [k]: parseNumInput(v) } }));

  const rows = (q.data?.rows ?? []) as Row[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-6 w-6 text-emerald-400" /> Obchód dnia</h1>
        <p className="text-sm text-zinc-500">Najważniejsze dane ze wszystkich kurników — jeden widok, jeden zapis.</p>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
          className={`${inputCls} ml-auto w-auto`} max={today} />
        <button onClick={() => setShowPlacement((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-emerald-600/50 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-950/40">
          <Egg className="h-4 w-4" /> Wstawienie piskląt
        </button>
      </div>

      {showPlacement && <PlacementForm onDone={() => setShowPlacement(false)} />}

      {q.isLoading && <p className="text-zinc-500">Ładowanie…</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
          Brak aktywnych stad w tym gospodarstwie. Użyj przycisku <b className="text-emerald-300">Wstawienie piskląt</b> powyżej, aby rozpocząć chów.
        </p>
      )}

      {rows.length > 0 && (
        <form onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            day,
            entries: rows.map((r) => {
              const f = form[r.batchId] ?? {};
              return {
                batchId: r.batchId,
                mortality: f.mortality ?? 0, culls: f.culls ?? 0,
                waterLiters: f.waterLiters ?? undefined, feedKg: f.feedKg ?? undefined,
                tempC: f.tempC ?? undefined, humidityPct: f.humidityPct ?? undefined,
              };
            }),
          });
        }}>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Kurnik / stado</th>
                  <th className="px-3 py-2 text-left">Linia</th>
                  <th className="px-3 py-2 text-right">Wiek (dni)</th>
                  <th className="px-3 py-2 text-right">Stan (szt.)</th>
                  <th className="px-3 py-2 text-right">Masa (g)</th>
                  <th className="px-3 py-2 text-right">Suger. pasza (kg)</th>
                  <th className="px-3 py-2 text-right">Padnięte</th>
                  <th className="px-3 py-2 text-right">Wybrane</th>
                  <th className="px-3 py-2 text-right">Pasza (kg)</th>
                  <th className="px-3 py-2 text-right">Woda (l)</th>
                  <th className="px-3 py-2 text-right">Temp. (°C)</th>
                  <th className="px-3 py-2 text-right">Wilg. (%)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.batchId} className={`border-t border-zinc-800 ${r.hasLog ? "bg-emerald-950/10" : ""}`}>
                    <td className="px-3 py-2">
                      <b>{r.house}</b>
                      <span className="ml-2 text-xs text-zinc-500">{r.code}</span>
                      {r.hasLog && <span className="ml-2 rounded border border-emerald-600/40 px-1 text-[10px] text-emerald-400">zapisano</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{r.geneticLine ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.dayAge}</td>
                    <td className="px-3 py-2 text-right">{r.currentCount.toLocaleString("pl-PL")}</td>
                    <td className="px-3 py-2 text-right">{r.lastWeightG != null ? r.lastWeightG.toLocaleString("pl-PL") : "—"}</td>
                    <td className="px-3 py-2 text-right text-emerald-300/80">{r.suggestedFeedKg != null ? r.suggestedFeedKg.toLocaleString("pl-PL") : "—"}</td>
                    {(["mortality", "culls", "feedKg", "waterLiters", "tempC", "humidityPct"] as const).map((k) => (
                      <td key={k} className="px-1 py-1">
                        <input type="text" inputMode="decimal" autoComplete="off"
                          className={`${inputCls} w-20 text-right`}
                          value={form[r.batchId]?.[k] ?? ""}
                          placeholder={k === "feedKg" && r.suggestedFeedKg != null ? String(r.suggestedFeedKg) : k === "mortality" || k === "culls" ? "0" : "—"}
                          onChange={(e) => set(r.batchId, k, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button disabled={save.isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Save className="h-4 w-4" /> Zapisz obchód ({rows.length} kurników)
            </button>
            <p className="text-xs text-zinc-500">Padnięcia i wybrane automatycznie pomniejszą stan stad; pasza zasili FCR i wydania. Sugerowana pasza liczona z norm linii genetycznej.</p>
          </div>
        </form>
      )}
    </div>
  );
}
