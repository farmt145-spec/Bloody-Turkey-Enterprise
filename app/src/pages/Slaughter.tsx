import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  Factory, Plus, Truck, Scale, Scissors, ListChecks, Coins, ArrowLeft,
  Link2, BarChart3, CalendarClock, FlaskConical,
} from "lucide-react";

const cardCls = "rounded-xl border border-zinc-800 bg-zinc-900 p-4";
const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500";
const btnCls = "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50";
const STATUS_LABEL: Record<string, string> = {
  created: "Utworzona", transport: "Transport", reception: "Przyjęcie",
  slaughtered: "Ubigano", settled: "Rozliczona", closed: "Zamknięta",
  planned: "Planowany", confirmed: "Potwierdzony", inProgress: "W realizacji",
  completed: "Zrealizowany", cancelled: "Anulowany",
};
const num = (v: unknown) => Number(v ?? 0);
const fmt = (v: number, d = 2) => v.toLocaleString("pl-PL", { maximumFractionDigits: d });

/* ---------- planowanie ---------- */
function PlanForm({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const batchesQ = trpc.farm.production.batches.useQuery();
  const create = trpc.slaughter.createPlan.useMutation({
    onSuccess: () => { toast.success("Plan uboju zapisany"); utils.slaughter.invalidate(); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  const [f, setF] = useState({ batchId: 0, plannedDate: "", plannedCount: 0, targetAvgWeightKg: "", notes: "" });
  const active = (batchesQ.data ?? []).filter((b: any) => b.batch.status === "active");
  return (
    <form className={`${cardCls} space-y-3`} onSubmit={(e) => {
      e.preventDefault();
      create.mutate({ batchId: f.batchId, plannedDate: f.plannedDate, plannedCount: f.plannedCount,
        targetAvgWeightKg: f.targetAvgWeightKg ? Number(f.targetAvgWeightKg) : undefined, notes: f.notes || undefined });
    }}>
      <h3 className="font-semibold">Nowy plan uboju</h3>
      <select className={inputCls} value={f.batchId} onChange={(e) => {
        const b = active.find((x: any) => x.batch.id === Number(e.target.value));
        setF({ ...f, batchId: Number(e.target.value), plannedCount: b?.batch.currentCount ?? 0 });
      }} required>
        <option value={0}>— wybierz stado —</option>
        {active.map((b: any) => (
          <option key={b.batch.id} value={b.batch.id}>
            {b.batch.code} · {b.batch.geneticLine} · {b.batch.currentCount} szt. ({b.house?.name ?? "?"})
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-zinc-500">Data uboju
          <input type="date" className={`${inputCls} mt-1`} value={f.plannedDate}
            onChange={(e) => setF({ ...f, plannedDate: e.target.value })} required /></label>
        <label className="text-xs text-zinc-500">Planowane sztuki
          <input type="number" className={`${inputCls} mt-1`} value={f.plannedCount}
            onChange={(e) => setF({ ...f, plannedCount: Number(e.target.value) })} required min={1} /></label>
        <label className="text-xs text-zinc-500">Docelowa masa (kg)
          <input type="number" step="0.01" className={`${inputCls} mt-1`} value={f.targetAvgWeightKg}
            onChange={(e) => setF({ ...f, targetAvgWeightKg: e.target.value })} /></label>
      </div>
      <input className={inputCls} placeholder="Uwagi" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <button className={btnCls} disabled={create.isPending || !f.batchId}>Zapisz plan</button>
    </form>
  );
}

/* ---------- szczegóły partii: klikalny łańcuch FERMA→UBOJNIA ---------- */
function BatchDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.slaughter.detail.useQuery({ id });
  const dict = trpc.slaughter.classDict.useQuery();
  const inv = () => utils.slaughter.invalidate();

  const addTransport = trpc.slaughter.addTransport.useMutation({ onSuccess: () => { toast.success("Transport zapisany"); inv(); }, onError: (e) => toast.error(e.message) });
  const addReception = trpc.slaughter.addReception.useMutation({ onSuccess: () => { toast.success("Przyjęcie zapisane"); inv(); }, onError: (e) => toast.error(e.message) });
  const addResult = trpc.slaughter.addResult.useMutation({ onSuccess: (r) => { toast.success(`Wynik zapisany — wydajność ${r.yieldPct}%`); inv(); }, onError: (e) => toast.error(e.message) });
  const setClass = trpc.slaughter.setClassification.useMutation({ onSuccess: () => { toast.success("Klasyfikacja zapisana"); inv(); }, onError: (e) => toast.error(e.message) });
  const addSettlement = trpc.slaughter.addSettlement.useMutation({ onSuccess: (r) => { toast.success(`Rozliczenie: netto ${fmt(r.netAmount)}`); inv(); }, onError: (e) => toast.error(e.message) });

  const [t, setT] = useState({ vehiclePlate: "", driverName: "", loadedCount: 0, distanceKm: "", transportCost: 0, deadInTransport: 0 });
  const [r, setR] = useState({ receivedCount: 0, deadOnArrival: 0, rejectedCount: 0, liveWeightKg: 0 });
  const [w, setW] = useState({ carcassCount: 0, carcassWeightKg: 0, wasteKg: 0, byproductsKg: 0 });
  const [cls, setCls] = useState<Record<string, { count: number; weightKg: number }>>({});
  const [settle, setSettle] = useState({ pricePerKg: 0, bonuses: 0, deductions: 0, documentNumber: "" });

  if (q.isLoading) return <p className="text-zinc-500">Ładowanie…</p>;
  const d = q.data;
  if (!d) return <p className="text-red-400">Nie znaleziono partii.</p>;
  const sb = d.slaughterBatch;

  const steps = [
    { key: "farm", label: "FERMA", done: true, icon: Factory, info: `${d.farm?.name ?? "—"} · ${d.house?.name ?? "—"}` },
    { key: "batch", label: "STADO", done: true, icon: Scale, info: `${d.batch?.code ?? "—"} · ${d.batch?.geneticLine ?? ""}` },
    { key: "plan", label: "PLAN UBOJU", done: !!d.plan, icon: CalendarClock, info: d.plan ? `${d.plan.plannedDate} · ${d.plan.plannedCount} szt.` : "bez planu" },
    { key: "transport", label: "TRANSPORT", done: d.transports.length > 0, icon: Truck, info: d.transports.length ? `${d.transports.reduce((a, x) => a + x.loadedCount, 0)} szt. załadowano` : "—" },
    { key: "reception", label: "PRZYJĘCIE", done: !!d.reception, icon: ListChecks, info: d.reception ? `${d.reception.receivedCount} szt. · ${fmt(num(d.reception.liveWeightKg), 0)} kg` : "—" },
    { key: "result", label: "WYNIKI", done: !!d.result, icon: Scissors, info: d.result ? `${fmt(num(d.result.carcassWeightKg), 0)} kg · wyd. ${d.result.yieldPct}%` : "—" },
    { key: "class", label: "KLASYFIKACJA", done: d.classification.length > 0, icon: BarChart3, info: d.classification.length ? `${d.classification.length} klas` : "—" },
    { key: "settle", label: "ROZLICZENIE", done: !!d.settlement, icon: Coins, info: d.settlement ? `${fmt(num(d.settlement.netAmount))} ${d.settlement.currency}` : "—" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800"><ArrowLeft className="h-4 w-4" /></button>
        <h2 className="text-xl font-bold">{sb.code}</h2>
        {sb.isDemo && <span className="rounded border border-amber-500/40 px-2 py-0.5 text-xs font-bold text-amber-400">DEMO · DANE TESTOWE</span>}
        <span className="rounded border border-emerald-500/40 px-2 py-0.5 text-xs font-bold text-emerald-400">{STATUS_LABEL[sb.status]}</span>
      </div>

      {/* klikalny łańcuch */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {steps.map((s2) => (
          <div key={s2.key} className={`rounded-xl border p-3 text-center ${s2.done ? "border-emerald-600/50 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900"}`}>
            <s2.icon className={`mx-auto mb-1 h-5 w-5 ${s2.done ? "text-emerald-400" : "text-zinc-600"}`} />
            <div className="text-[10px] font-bold tracking-wide">{s2.label}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500">{s2.info}</div>
          </div>
        ))}
      </div>

      {/* plan vs rzeczywistość */}
      {d.planVsReality && (
        <div className={cardCls}>
          <h3 className="mb-2 font-semibold">Plan vs rzeczywistość</h3>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            <div>Sztuki: <b>{d.plan?.plannedCount} → {d.reception?.receivedCount ?? "—"}</b> ({d.planVsReality.countPct ?? "—"}%)</div>
            <div>Śr. masa żywa: <b>{d.planVsReality.avgLiveWeightKg ?? "—"} kg</b></div>
            <div>Cel vs masa: <b>{d.planVsReality.weightTargetDiff != null ? `${d.planVsReality.weightTargetDiff > 0 ? "+" : ""}${d.planVsReality.weightTargetDiff} kg` : "—"}</b></div>
            <div>Wydajność: <b>{d.planVsReality.yieldPct ?? "—"}%</b></div>
            <div>Termin: <b>{d.planVsReality.daysVsPlan != null ? `${d.planVsReality.daysVsPlan > 0 ? "+" : ""}${d.planVsReality.daysVsPlan} dni` : "—"}</b></div>
          </div>
        </div>
      )}

      {/* ekonomika */}
      {d.economics && (
        <div className={cardCls}>
          <h3 className="mb-2 font-semibold">Ekonomika partii (PLN)</h3>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>Pisklęta: <b>{fmt(d.economics.chickCost, 0)}</b></div>
            <div>Pasza (est. {fmt(d.avgFeedPricePerTon, 0)}/t): <b>{fmt(d.economics.feedCost, 0)}</b></div>
            <div>Transport: <b>{fmt(d.economics.transportCost, 0)}</b></div>
            <div>Koszt razem: <b>{fmt(d.economics.totalCost, 0)}</b></div>
            <div>Przychód netto: <b>{d.economics.revenueNet != null ? fmt(d.economics.revenueNet, 0) : "—"}</b></div>
            <div>Marża: <b className={(d.economics.margin ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>{d.economics.margin != null ? fmt(d.economics.margin, 0) : "—"}</b></div>
            <div>ROI: <b>{d.economics.roiPct != null ? `${d.economics.roiPct}%` : "—"}</b></div>
            <div>Koszt/kg żywa: <b>{d.economics.costPerKgLive ?? "—"}</b></div>
          </div>
        </div>
      )}

      {/* formularze etapów */}
      <div className="grid gap-4 lg:grid-cols-2">
        {!d.transports.length && (
          <form className={`${cardCls} space-y-2`} onSubmit={(e) => { e.preventDefault(); addTransport.mutate({ slaughterBatchId: id, ...t, distanceKm: t.distanceKm ? Number(t.distanceKm) : undefined }); }}>
            <h3 className="font-semibold"><Truck className="mr-1 inline h-4 w-4" />Transport</h3>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Rejestracja pojazdu" value={t.vehiclePlate} onChange={(e) => setT({ ...t, vehiclePlate: e.target.value })} />
              <input className={inputCls} placeholder="Kierowca" value={t.driverName} onChange={(e) => setT({ ...t, driverName: e.target.value })} />
              <input type="number" className={inputCls} placeholder="Załadowane sztuki *" value={t.loadedCount || ""} onChange={(e) => setT({ ...t, loadedCount: Number(e.target.value) })} required />
              <input type="number" className={inputCls} placeholder="Dystans km" value={t.distanceKm} onChange={(e) => setT({ ...t, distanceKm: e.target.value })} />
              <input type="number" step="0.01" className={inputCls} placeholder="Koszt transportu" value={t.transportCost || ""} onChange={(e) => setT({ ...t, transportCost: Number(e.target.value) })} />
              <input type="number" className={inputCls} placeholder="Padłe w transporcie" value={t.deadInTransport || ""} onChange={(e) => setT({ ...t, deadInTransport: Number(e.target.value) })} />
            </div>
            <button className={btnCls} disabled={addTransport.isPending}>Zapisz transport</button>
          </form>
        )}

        {d.transports.length > 0 && !d.reception && (
          <form className={`${cardCls} space-y-2`} onSubmit={(e) => { e.preventDefault(); addReception.mutate({ slaughterBatchId: id, ...r }); }}>
            <h3 className="font-semibold"><ListChecks className="mr-1 inline h-4 w-4" />Przyjęcie na ubojni</h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className={inputCls} placeholder="Przyjęte sztuki *" value={r.receivedCount || ""} onChange={(e) => setR({ ...r, receivedCount: Number(e.target.value) })} required />
              <input type="number" step="0.01" className={inputCls} placeholder="Masa żywa kg *" value={r.liveWeightKg || ""} onChange={(e) => setR({ ...r, liveWeightKg: Number(e.target.value) })} required />
              <input type="number" className={inputCls} placeholder="DOA (padłe)" value={r.deadOnArrival || ""} onChange={(e) => setR({ ...r, deadOnArrival: Number(e.target.value) })} />
              <input type="number" className={inputCls} placeholder="Odrzucone" value={r.rejectedCount || ""} onChange={(e) => setR({ ...r, rejectedCount: Number(e.target.value) })} />
            </div>
            <button className={btnCls} disabled={addReception.isPending}>Zapisz przyjęcie</button>
          </form>
        )}

        {d.reception && !d.result && (
          <form className={`${cardCls} space-y-2`} onSubmit={(e) => { e.preventDefault(); addResult.mutate({ slaughterBatchId: id, ...w }); }}>
            <h3 className="font-semibold"><Scissors className="mr-1 inline h-4 w-4" />Wynik uboju</h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className={inputCls} placeholder="Liczba tuszek *" value={w.carcassCount || ""} onChange={(e) => setW({ ...w, carcassCount: Number(e.target.value) })} required />
              <input type="number" step="0.01" className={inputCls} placeholder="Masa tuszek kg *" value={w.carcassWeightKg || ""} onChange={(e) => setW({ ...w, carcassWeightKg: Number(e.target.value) })} required />
              <input type="number" step="0.01" className={inputCls} placeholder="Odpady kg" value={w.wasteKg || ""} onChange={(e) => setW({ ...w, wasteKg: Number(e.target.value) })} />
              <input type="number" step="0.01" className={inputCls} placeholder="Produkty uboczne kg" value={w.byproductsKg || ""} onChange={(e) => setW({ ...w, byproductsKg: Number(e.target.value) })} />
            </div>
            <p className="text-xs text-zinc-500">Wydajność zostanie policzona automatycznie: masa tuszek / masa żywa × 100.</p>
            <button className={btnCls} disabled={addResult.isPending}>Zapisz wynik</button>
          </form>
        )}

        {d.result && !d.classification.length && (
          <form className={`${cardCls} space-y-2`} onSubmit={(e) => {
            e.preventDefault();
            const rows = Object.entries(cls).filter(([, v]) => v.count > 0).map(([classCode, v]) => ({ classCode, ...v }));
            if (!rows.length) return toast.error("Uzupełnij co najmniej jedną klasę");
            setClass.mutate({ slaughterBatchId: id, rows });
          }}>
            <h3 className="font-semibold">Klasyfikacja tuszek (wg własnego słownika)</h3>
            {(dict.data ?? []).length === 0 && <p className="text-xs text-amber-400">Brak klas w słowniku — dodaj je w zakładce „Klasy (słownik)". System nie narzuca norm zakładowych.</p>}
            {(dict.data ?? []).map((c) => (
              <div key={c.code} className="grid grid-cols-3 items-center gap-2 text-sm">
                <span className="font-semibold">{c.code} <span className="font-normal text-zinc-500">{c.label}</span></span>
                <input type="number" className={inputCls} placeholder="sztuki"
                  value={cls[c.code]?.count || ""} onChange={(e) => setCls({ ...cls, [c.code]: { count: Number(e.target.value), weightKg: cls[c.code]?.weightKg ?? 0 } })} />
                <input type="number" step="0.01" className={inputCls} placeholder="kg"
                  value={cls[c.code]?.weightKg || ""} onChange={(e) => setCls({ ...cls, [c.code]: { count: cls[c.code]?.count ?? 0, weightKg: Number(e.target.value) } })} />
              </div>
            ))}
            <button className={btnCls} disabled={setClass.isPending || !(dict.data ?? []).length}>Zapisz klasyfikację</button>
          </form>
        )}

        {d.result && !d.settlement && (
          <form className={`${cardCls} space-y-2`} onSubmit={(e) => { e.preventDefault(); addSettlement.mutate({ slaughterBatchId: id, ...settle, documentNumber: settle.documentNumber || undefined }); }}>
            <h3 className="font-semibold"><Coins className="mr-1 inline h-4 w-4" />Rozliczenie</h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.001" className={inputCls} placeholder="Cena za kg *" value={settle.pricePerKg || ""} onChange={(e) => setSettle({ ...settle, pricePerKg: Number(e.target.value) })} required />
              <input className={inputCls} placeholder="Nr dokumentu" value={settle.documentNumber} onChange={(e) => setSettle({ ...settle, documentNumber: e.target.value })} />
              <input type="number" step="0.01" className={inputCls} placeholder="Premie" value={settle.bonuses || ""} onChange={(e) => setSettle({ ...settle, bonuses: Number(e.target.value) })} />
              <input type="number" step="0.01" className={inputCls} placeholder="Potrącenia" value={settle.deductions || ""} onChange={(e) => setSettle({ ...settle, deductions: Number(e.target.value) })} />
            </div>
            <p className="text-xs text-zinc-500">Kwoty liczone automatycznie: brutto = masa tuszek × cena; netto = brutto + premie − potrącenia.</p>
            <button className={btnCls} disabled={addSettlement.isPending}>Zapisz rozliczenie</button>
          </form>
        )}
      </div>

      {/* historia zdarzeń */}
      <div className={cardCls}>
        <h3 className="mb-2 font-semibold">Historia zdarzeń</h3>
        <ul className="space-y-1 text-sm">
          {d.events.map((ev) => (
            <li key={ev.id} className="flex gap-2 text-zinc-400">
              <span className="text-zinc-600">{new Date(ev.createdAt).toLocaleString("pl-PL")}</span>
              <span className="rounded border border-zinc-700 px-1 text-[10px] uppercase">{ev.eventType}</span>
              <span className="text-zinc-300">{ev.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- słownik klas ---------- */
function ClassDict() {
  const utils = trpc.useUtils();
  const q = trpc.slaughter.classDict.useQuery();
  const add = trpc.slaughter.addClassDictEntry.useMutation({ onSuccess: () => { toast.success("Klasa dodana"); utils.slaughter.classDict.invalidate(); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.slaughter.removeClassDictEntry.useMutation({ onSuccess: () => utils.slaughter.classDict.invalidate() });
  const [f, setF] = useState({ code: "", label: "", sortOrder: 0 });
  return (
    <div className={cardCls}>
      <h3 className="mb-1 font-semibold">Słownik klas konfekcyjnych</h3>
      <p className="mb-3 text-xs text-zinc-500">Klasy definiujesz samodzielnie — system nie narzuca norm prawnych ani zakładowych.</p>
      <form className="mb-3 grid grid-cols-4 gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(f); setF({ code: "", label: "", sortOrder: 0 }); }}>
        <input className={inputCls} placeholder="Kod *" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
        <input className={`${inputCls} col-span-2`} placeholder="Nazwa *" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} required />
        <button className={btnCls}>Dodaj</button>
      </form>
      <ul className="space-y-1 text-sm">
        {(q.data ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <b>{c.code}</b> — {c.label}
            {c.companyId == null && <span className="text-xs text-zinc-600">(globalna)</span>}
            {c.companyId != null && <button className="ml-auto text-xs text-red-400 hover:underline" onClick={() => remove.mutate({ id: c.id })}>usuń</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- strona główna modułu ---------- */
export default function Slaughter() {
  const [tab, setTab] = useState<"dashboard" | "partie" | "plany" | "analityka" | "slownik" | "identyfikowalnosc">("dashboard");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState(false);
  const [trace, setTrace] = useState("");
  const utils = trpc.useUtils();

  const dash = trpc.slaughter.dashboard.useQuery();
  const list = trpc.slaughter.list.useQuery();
  const plans = trpc.slaughter.plans.useQuery();
  const analytics = trpc.slaughter.analytics.useQuery(undefined, { enabled: tab === "analityka" });
  const traceQ = trpc.slaughter.traceability.useQuery({ code: trace }, { enabled: tab === "identyfikowalnosc" && trace.length >= 4 });

  const createBatch = trpc.slaughter.createBatch.useMutation({
    onSuccess: (r) => { toast.success(`Utworzono partię ${r.code}`); utils.slaughter.invalidate(); setDetailId(r.id); setTab("partie"); },
    onError: (e) => toast.error(e.message),
  });
  const demoFlow = trpc.slaughter.demoScenario.useMutation({
    onSuccess: (r) => { toast.success(`Utworzono partię DEMO ${r.code} z pełnym przepływem`); utils.slaughter.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (detailId != null) return <BatchDetail id={detailId} onBack={() => setDetailId(null)} />;

  const TABS = [
    ["dashboard", "Dashboard"], ["partie", "Partie ubojowe"], ["plany", "Plany uboju"],
    ["analityka", "Analityka"], ["slownik", "Klasy (słownik)"], ["identyfikowalnosc", "Identyfikowalność"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Factory className="h-6 w-6 text-emerald-400" /> Ubojnia</h1>
        <span className="text-xs text-zinc-500">Łańcuch FERMA → UBOJNIA · przygotowane punkty integracji z systemem zakładu (bez połączenia produkcyjnego)</span>
        <button onClick={() => demoFlow.mutate()} disabled={demoFlow.isPending}
          className="ml-auto flex items-center gap-1 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-950/30">
          <FlaskConical className="h-3.5 w-3.5" /> Generuj pełny przykład DEMO
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-emerald-600/20 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800"}`}>{l}</button>
        ))}
      </div>

      {tab === "dashboard" && dash.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {[
              ["Partie ubojowe", dash.data.totalSlaughterBatches],
              ["Plany w toku", dash.data.plannedUpcoming],
              ["Żywiec (kg)", fmt(dash.data.liveWeightKg, 0)],
              ["Tuszki (kg)", fmt(dash.data.carcassWeightKg, 0)],
              ["Śr. wydajność", `${dash.data.avgYieldPct}%`],
              ["Przychód netto", `${fmt(dash.data.revenueNet, 0)} PLN`],
              ["DOA łącznie", dash.data.deadOnArrival],
            ].map(([l, v]) => (
              <div key={String(l)} className={cardCls}><div className="text-xs text-zinc-500">{l}</div><div className="mt-1 text-lg font-bold">{v}</div></div>
            ))}
          </div>
          {dash.data.alerts.length > 0 && (
            <div className={cardCls}>
              <h3 className="mb-2 font-semibold">Alerty</h3>
              {dash.data.alerts.map((a, i) => (
                <div key={i} className={`text-sm ${a.type === "warning" ? "text-amber-400" : "text-zinc-400"}`}>• {a.message}</div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "partie" && (
        <div className="space-y-3">
          <button onClick={() => setPlanForm(!planForm)} className={btnCls}><Plus className="mr-1 inline h-4 w-4" />Nowy plan uboju</button>
          {planForm && <PlanForm onDone={() => setPlanForm(false)} />}
          {(list.data ?? []).length === 0 && <p className="text-sm text-zinc-500">Brak partii ubojowych — utwórz plan uboju, a potem partię z planu.</p>}
          {(list.data ?? []).map((sb) => (
            <button key={sb.id} onClick={() => setDetailId(sb.id)} className={`${cardCls} block w-full text-left hover:border-emerald-600/50`}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{sb.code}</b>
                {sb.isDemo && <span className="rounded border border-amber-500/40 px-1.5 text-[10px] font-bold text-amber-400">DEMO</span>}
                <span className="text-sm text-zinc-400">{sb.batch?.code} · {sb.batch?.geneticLine} · {sb.batch?.sex === "toms" ? "indory" : sb.batch?.sex === "hens" ? "indyczki" : "mieszane"}</span>
                <span className="ml-auto rounded border border-zinc-700 px-1.5 text-xs">{STATUS_LABEL[sb.status]}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {sb.result ? `Tuszki ${fmt(num(sb.result.carcassWeightKg), 0)} kg · wydajność ${sb.result.yieldPct}%` : "wynik: —"}
                {sb.settlement ? ` · netto ${fmt(num(sb.settlement.netAmount), 0)} ${sb.settlement.currency}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "plany" && (
        <div className="space-y-3">
          <button onClick={() => setPlanForm(!planForm)} className={btnCls}><Plus className="mr-1 inline h-4 w-4" />Nowy plan uboju</button>
          {planForm && <PlanForm onDone={() => setPlanForm(false)} />}
          {(plans.data ?? []).map((p) => (
            <div key={p.id} className={`${cardCls} flex flex-wrap items-center gap-3`}>
              <div>
                <b>{p.plannedDate}</b> · stado {p.batch?.code ?? p.batchId} · {p.plannedCount} szt.
                {p.targetAvgWeightKg && <span className="text-zinc-500"> · cel {p.targetAvgWeightKg} kg</span>}
                <span className="ml-2 rounded border border-zinc-700 px-1.5 text-xs">{STATUS_LABEL[p.status]}</span>
              </div>
              {(p.status === "planned" || p.status === "confirmed") && (
                <button className={`${btnCls} ml-auto`} disabled={createBatch.isPending}
                  onClick={() => createBatch.mutate({ planId: p.id, batchId: p.batchId })}>
                  Utwórz partię ubojową
                </button>
              )}
            </div>
          ))}
          {(plans.data ?? []).length === 0 && <p className="text-sm text-zinc-500">Brak planów.</p>}
        </div>
      )}

      {tab === "analityka" && analytics.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={cardCls}>
            <h3 className="mb-2 font-semibold">Porównanie linii genetycznych</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-zinc-500"><th>Genetyka</th><th>Partii</th><th>Śr. wydajność</th><th>Przychód netto</th></tr></thead>
              <tbody>
                {analytics.data.byGenetics.map((g) => (
                  <tr key={g.geneticLine} className="border-t border-zinc-800"><td className="py-1.5">{g.geneticLine}</td><td>{g.batches}</td><td>{g.avgYieldPct}%</td><td>{fmt(g.revenueNet, 0)} PLN</td></tr>
                ))}
              </tbody>
            </table>
            {analytics.data.byGenetics.length === 0 && <p className="text-sm text-zinc-500">Brak danych.</p>}
          </div>
          <div className={cardCls}>
            <h3 className="mb-2 font-semibold">Porównanie płci</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-zinc-500"><th>Płeć</th><th>Partii</th><th>Śr. wydajność</th></tr></thead>
              <tbody>
                {analytics.data.bySex.map((g) => (
                  <tr key={g.sex} className="border-t border-zinc-800">
                    <td className="py-1.5">{g.sex === "toms" ? "indory" : g.sex === "hens" ? "indyczki" : "mieszane"}</td>
                    <td>{g.batches}</td><td>{g.avgYieldPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-500">
              <Link2 className="mr-1 inline h-3 w-3" />Powiązanie z żywieniem: wydajność i przychody analizuj względem receptur w zakładce Żywienie → Receptury (feedback pętli żywienia).
            </p>
          </div>
        </div>
      )}

      {tab === "slownik" && <ClassDict />}

      {tab === "identyfikowalnosc" && (
        <div className={cardCls}>
          <h3 className="mb-2 font-semibold">Identyfikowalność — wyszukiwanie w obie strony</h3>
          <input className={`${inputCls} mb-3`} placeholder="Wpisz kod partii ubojowej, np. UB-2026-000001"
            value={trace} onChange={(e) => setTrace(e.target.value)} />
          {(traceQ.data ?? []).map((chain) => (
            <div key={chain.slaughterBatch.id} className="mb-3 rounded-lg border border-zinc-800 p-3 text-sm">
              <b>{chain.slaughterBatch.code}</b> ← stado <b>{chain.batch?.code}</b> ({chain.batch?.geneticLine}) ← kurnik {chain.house?.name} ← ferma {chain.farm?.name}
              <div className="mt-1 text-xs text-zinc-500">
                Plan: {chain.plan?.plannedDate ?? "—"} · Transportów: {chain.transports.length} ·
                Przyjęcie: {chain.reception ? `${chain.reception.receivedCount} szt.` : "—"} ·
                Wynik: {chain.result ? `${chain.result.yieldPct}%` : "—"} ·
                Rozliczenie: {chain.settlement ? `${fmt(num(chain.settlement.netAmount))} ${chain.settlement.currency}` : "—"}
              </div>
            </div>
          ))}
          {trace.length >= 4 && (traceQ.data ?? []).length === 0 && <p className="text-sm text-zinc-500">Brak wyników dla „{trace}".</p>}
        </div>
      )}
    </div>
  );
}
