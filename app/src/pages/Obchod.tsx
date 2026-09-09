import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { ClipboardList, Save, Egg, X, Layers, Wifi, WifiOff, CloudUpload } from "lucide-react";
import { parseNumInput } from "@/lib/utils";
import { queueObchod, queueSize, flushQueueNow } from "@/lib/offline";
import { getWorkspace } from "@/lib/workspace";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500";
/* większe pole dotykowe na telefonie */
const mInputCls =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100 outline-none focus:border-emerald-500";

type Row = {
  batchId: number; code: string; house: string; currentCount: number; dayAge: number;
  geneticLine: string | null; lastWeightG: number | null; suggestedFeedKg: number | null;
  mortality: number; culls: number; waterLiters: number | null; feedKg: number | null;
  tempC: number | null; humidityPct: number | null; hasLog: boolean;
};

const LITTER_MATERIALS = ["Słoma pszenna", "Słoma żytnia", "Trociny", "Zrębka słomiana", "Miskant", "Inne"];
type LitterRow = { material: string; balesCount: string; baleKg: string; cost: string };

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
  const [litterForm, setLitterForm] = useState<Record<number, LitterRow>>({});
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [flushing, setFlushing] = useState(false);
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

  /* status połączenia + rozmiar kolejki offline */
  useEffect(() => {
    const syncQueueState = () => queueSize().then(setQueued);
    const onOnline = async () => {
      setOnline(true);
      setFlushing(true);
      const res = await flushQueueNow(postSavedPayload);
      setFlushing(false);
      await syncQueueState();
      if (res.sent > 0) {
        toast.success(`Odesłano ${res.sent} zapisów obchodu z kolejki offline`);
        utils.obchod.day.invalidate(); utils.farm.invalidate();
      }
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    syncQueueState();
    if (navigator.onLine) onOnline();
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const set = (batchId: number, k: string, v: string) =>
    setForm((f) => ({ ...f, [batchId]: { ...f[batchId], [k]: parseNumInput(v) } }));

  const rows = (q.data?.rows ?? []) as Row[];
  const houses = (q.data?.houses ?? []) as { houseId: number; name: string }[];
  const litterToday = (q.data?.litter ?? {}) as Record<string, { material: string; balesCount: number | null; baleKg: number | null; cost: number }>;
  const litterEntries = houses
    .map((h) => ({ houseId: h.houseId, ...(litterForm[h.houseId] ?? { material: "Słoma pszenna", balesCount: "", baleKg: "", cost: "" }) }))
    .filter((l) => (parseNumInput(l.balesCount) ?? 0) > 0 && (parseNumInput(l.baleKg) ?? 0) > 0)
    .map((l) => ({
      houseId: l.houseId, material: l.material,
      balesCount: parseNumInput(l.balesCount)!, baleKg: parseNumInput(l.baleKg)!,
      cost: parseNumInput(l.cost) ?? undefined,
    }));

  const buildPayload = () => ({
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
    litter: litterEntries.length ? litterEntries : undefined,
  });

  const authHeaders = (): Record<string, string> => {
    const w = getWorkspace();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (w) { h["x-company-id"] = String(w.companyId); if (w.farmId > 0) h["x-farm-id"] = String(w.farmId); }
    return h;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-6 w-6 text-emerald-400" /> Obchód dnia</h1>
        <p className="hidden text-sm text-zinc-500 sm:block">Najważniejsze dane ze wszystkich kurników — jeden widok, jeden zapis.</p>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
          className={`${inputCls} ml-auto w-auto`} max={today} />
        <button onClick={() => setShowPlacement((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-emerald-600/50 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-950/40">
          <Egg className="h-4 w-4" /> Wstawienie piskląt
        </button>
      </div>

      {/* Pasek statusu połączenia / kolejki offline */}
      {(!online || queued > 0) && (
        <div className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
          online ? "border-amber-700/50 bg-amber-950/30 text-amber-300" : "border-red-800/60 bg-red-950/30 text-red-300"
        }`}>
          {online ? <CloudUpload className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
          <span className="flex-1">
            {!online && "Brak zasięgu — obchód zapiszesz normalnie, wyśle się automatycznie po powrocie sieci."}
            {online && queued > 0 && (flushing ? "Wysyłanie zapisów z kolejki offline…" : `W kolejce offline czeka ${queued} zapis(ów) — wyślę je teraz.`)}
          </span>
          {online && queued > 0 && !flushing && (
            <button
              onClick={async () => {
                setFlushing(true);
                const res = await flushQueueNow(postSavedPayload);
                setFlushing(false);
                setQueued(await queueSize());
                if (res.sent > 0) { toast.success(`Odesłano ${res.sent} zapisów`); utils.obchod.day.invalidate(); }
                if (res.failed > 0) toast.error(`Nie udało się wysłać ${res.failed} zapisów — spróbuję później`);
              }}
              className="shrink-0 rounded-lg border border-amber-600/60 px-3 py-1.5 text-xs font-semibold hover:bg-amber-950/50">
              Wyślij teraz
            </button>
          )}
        </div>
      )}
      {online && queued === 0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-600"><Wifi className="h-3.5 w-3.5 text-emerald-500" /> Online — dane zapisują się od razu na serwerze.</div>
      )}

      {showPlacement && <PlacementForm onDone={() => setShowPlacement(false)} />}

      {q.isLoading && <p className="text-zinc-500">Ładowanie…</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
          Brak aktywnych stad w tym gospodarstwie. Użyj przycisku <b className="text-emerald-300">Wstawienie piskląt</b> powyżej, aby rozpocząć chów.
        </p>
      )}

      {rows.length > 0 && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          const payload = buildPayload();
          if (!navigator.onLine) {
            await queueObchod(payload, authHeaders());
            setQueued(await queueSize());
            toast.success("Zapisano w telefonie — wyślę automatycznie, gdy wróci zasięg", { icon: "📴" });
            return;
          }
          save.mutate(payload);
        }}>
          {/* ——— Widok mobilny: karty ——— */}
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => {
              const f = form[r.batchId] ?? {};
              const field = (k: keyof Row, label: string, placeholder = "—") => (
                <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}
                  <input type="text" inputMode="decimal" autoComplete="off"
                    className={`${mInputCls} mt-1 text-right`}
                    value={(f as any)[k] ?? ""}
                    placeholder={placeholder}
                    onChange={(e) => set(r.batchId, k as string, e.target.value)} />
                </label>
              );
              return (
                <div key={r.batchId} className={`rounded-2xl border p-4 ${r.hasLog ? "border-emerald-800/50 bg-emerald-950/10" : "border-zinc-800 bg-zinc-900/60"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <b className="text-base">{r.house}</b>
                      <span className="ml-2 text-xs text-zinc-500">{r.code} · {r.dayAge} dni · {r.geneticLine ?? "—"}</span>
                    </div>
                    {r.hasLog && <span className="rounded border border-emerald-600/40 px-1.5 py-0.5 text-[10px] text-emerald-400">zapisano</span>}
                  </div>
                  <div className="mb-3 flex gap-4 text-xs text-zinc-400">
                    <span>Stan: <b className="text-zinc-200">{r.currentCount.toLocaleString("pl-PL")}</b> szt.</span>
                    <span>Masa: <b className="text-zinc-200">{r.lastWeightG != null ? r.lastWeightG.toLocaleString("pl-PL") : "—"}</b> g</span>
                    {r.suggestedFeedKg != null && <span>Suger. pasza: <b className="text-emerald-300">{r.suggestedFeedKg.toLocaleString("pl-PL")}</b> kg</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {field("mortality", "Padnięte", "0")}
                    {field("culls", "Wybrane", "0")}
                    {field("feedKg", "Pasza (kg)", r.suggestedFeedKg != null ? String(r.suggestedFeedKg) : "—")}
                    {field("waterLiters", "Woda (l)")}
                    {field("tempC", "Temp. (°C)")}
                    {field("humidityPct", "Wilgotność (%)")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ——— Widok desktop: tabela ——— */}
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 lg:block">
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

          {/* ŚCIELENIE — bele ściółki per kurnik */}
          {houses.length > 0 && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                <Layers className="h-4 w-4 text-emerald-400" /> Ścielenie (opcjonalnie)
              </h2>
              <p className="mb-3 text-xs text-zinc-500">
                Wpisz tylko tam, gdzie dziś ścielono — podaj liczbę bel i rozmiar beli. Zapis razem z obchodem; koszt trafi do kosztów stada (kategoria „ściółka").
              </p>
              <div className="space-y-3 lg:hidden">
                {houses.map((h) => {
                  const lf = litterForm[h.houseId] ?? { material: "Słoma pszenna", balesCount: "", baleKg: "", cost: "" };
                  const bales = parseNumInput(lf.balesCount) ?? 0;
                  const baleKg = parseNumInput(lf.baleKg) ?? 0;
                  const done = litterToday[String(h.houseId)];
                  const setL = (k: keyof LitterRow, v: string) =>
                    setLitterForm((f) => ({ ...f, [h.houseId]: { ...lf, [k]: v } }));
                  return (
                    <div key={h.houseId} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <b className="text-sm">{h.name}</b>
                        <span className="text-xs text-zinc-500">
                          {done?.balesCount != null ? `zapisano: ${done.balesCount} bel × ${done.baleKg ?? "?"} kg` : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="col-span-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Materiał
                          <select className={`${mInputCls} mt-1`} value={lf.material} onChange={(e) => setL("material", e.target.value)}>
                            {LITTER_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </label>
                        <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Liczba bel
                          <input type="text" inputMode="numeric" autoComplete="off" placeholder="0"
                            className={`${mInputCls} mt-1 text-right`} value={lf.balesCount}
                            onChange={(e) => setL("balesCount", e.target.value)} />
                        </label>
                        <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Rozmiar beli (kg)
                          <input type="text" inputMode="decimal" autoComplete="off" placeholder="np. 250"
                            className={`${mInputCls} mt-1 text-right`} value={lf.baleKg}
                            onChange={(e) => setL("baleKg", e.target.value)} />
                        </label>
                        <div className="col-span-2 flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-sm">
                          <span className="text-zinc-500">Razem:</span>
                          <b className="text-emerald-300">{bales > 0 && baleKg > 0 ? `${(bales * baleKg).toLocaleString("pl-PL")} kg` : "—"}</b>
                        </div>
                        <label className="col-span-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Koszt (zł, opcj.)
                          <input type="text" inputMode="decimal" autoComplete="off" placeholder="—"
                            className={`${mInputCls} mt-1 text-right`} value={lf.cost}
                            onChange={(e) => setL("cost", e.target.value)} />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Kurnik</th>
                      <th className="px-2 py-1 text-left">Materiał</th>
                      <th className="px-2 py-1 text-right">Liczba bel</th>
                      <th className="px-2 py-1 text-right">Rozmiar beli (kg)</th>
                      <th className="px-2 py-1 text-right">Razem (kg)</th>
                      <th className="px-2 py-1 text-right">Koszt (zł, opcj.)</th>
                      <th className="px-2 py-1 text-left">Dziś już zapisano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {houses.map((h) => {
                      const lf = litterForm[h.houseId] ?? { material: "Słoma pszenna", balesCount: "", baleKg: "", cost: "" };
                      const bales = parseNumInput(lf.balesCount) ?? 0;
                      const baleKg = parseNumInput(lf.baleKg) ?? 0;
                      const done = litterToday[String(h.houseId)];
                      const setL = (k: keyof LitterRow, v: string) =>
                        setLitterForm((f) => ({ ...f, [h.houseId]: { ...lf, [k]: v } }));
                      return (
                        <tr key={h.houseId} className="border-t border-zinc-800">
                          <td className="px-2 py-1.5 font-medium">{h.name}</td>
                          <td className="px-2 py-1.5">
                            <select className={`${inputCls} w-40`} value={lf.material} onChange={(e) => setL("material", e.target.value)}>
                              {LITTER_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" inputMode="numeric" autoComplete="off" placeholder="0"
                              className={`${inputCls} w-24 text-right`} value={lf.balesCount}
                              onChange={(e) => setL("balesCount", e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" inputMode="decimal" autoComplete="off" placeholder="np. 250"
                              className={`${inputCls} w-24 text-right`} value={lf.baleKg}
                              onChange={(e) => setL("baleKg", e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5 text-right text-emerald-300/90">
                            {bales > 0 && baleKg > 0 ? `${(bales * baleKg).toLocaleString("pl-PL")} kg` : "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" inputMode="decimal" autoComplete="off" placeholder="—"
                              className={`${inputCls} w-24 text-right`} value={lf.cost}
                              onChange={(e) => setL("cost", e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5 text-xs text-zinc-500">
                            {done?.balesCount != null
                              ? `${done.balesCount} bel × ${done.baleKg ?? "?"} kg (${done.material})`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sticky przycisk zapisu — zawsze pod kciukiem */}
          <div className="sticky bottom-0 z-10 -mx-2 mt-4 border-t border-zinc-800 bg-zinc-950/90 p-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="flex items-center gap-3">
              <button disabled={save.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 disabled:opacity-50 lg:w-auto lg:rounded-lg lg:py-2.5 lg:text-sm lg:shadow-none">
                <Save className="h-5 w-5" /> {save.isPending ? "Zapisywanie…" : online ? `Zapisz obchód (${rows.length} kurników)` : "Zapisz offline — wyślę później"}
              </button>
              <p className="hidden text-xs text-zinc-500 lg:block">Padnięcia i wybrane automatycznie pomniejszą stan stad; pasza zasili FCR i wydania. Sugerowana pasza liczona z norm linii genetycznej.</p>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/* Wysyłka zapisanego payloadu obchodu — używana przy flushu kolejki offline */
async function postSavedPayload(payload: unknown, headers: Record<string, string>): Promise<boolean> {
  try {
    const base = (import.meta as any).env?.VITE_API_URL || "/api/trpc";
    // tRPC v11 — format batch dla pojedynczego wywołania
    const res = await fetch(`${base}/obchod.save`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ "0": { json: payload } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
