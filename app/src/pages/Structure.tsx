import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { COUNTRIES, countryFlag, countryName, fmtNum, num } from "@/lib/geo";
import { Plus, Warehouse, Home as HomeIcon, Bird, ChevronDown, ChevronRight, Pencil, Archive, Dna } from "lucide-react";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-500";

type FormState =
  | { kind: "farm"; companyId: number }
  | { kind: "house"; farmId: number }
  | { kind: "batch"; houseId: number }
  | { kind: "editFarm"; id: number; name: string; city: string; capacity: number }
  | { kind: "editHouse"; id: number; name: string; areaM2: number }
  | { kind: "line"; companyId: number }
  | null;

export default function Structure() {
  const structure = trpc.org.structure.useQuery();
  const companies = trpc.org.companies.useQuery();
  const utils = trpc.useUtils();
  const inv = () => utils.org.structure.invalidate();
  const createFarm = trpc.org.createFarm.useMutation({ onSuccess: inv });
  const updateFarm = trpc.org.updateFarm.useMutation({ onSuccess: inv });
  const archiveFarm = trpc.org.archiveFarm.useMutation({ onSuccess: inv });
  const createHouse = trpc.org.createHouse.useMutation({ onSuccess: inv });
  const updateHouse = trpc.org.updateHouse.useMutation({ onSuccess: inv });
  const archiveHouse = trpc.org.archiveHouse.useMutation({ onSuccess: inv });
  const createBatch = trpc.org.createBatch.useMutation({
    onSuccess: () => { inv(); toast.success("Rzut utworzony — harmonogram wygenerowany"); },
    onError: (e) => toast.error(e.message),
  });
  const createCompany = trpc.org.createCompany.useMutation({ onSuccess: () => utils.org.invalidate() });
  const createLine = trpc.org.createGeneticLine.useMutation({ onSuccess: inv });

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>(null);
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const activeCompanyId = companyId ?? companies.data?.[0]?.id ?? 0;
  const company = (structure.data?.companies ?? []).find((c) => c.id === activeCompanyId);

  const [farmForm, setFarmForm] = useState({ name: "", countryCode: "PL", city: "", lat: 52, lng: 19, capacity: 50000 });
  const [houseForm, setHouseForm] = useState({ name: "", houseType: "finisher" as "brooder" | "finisher", areaM2: 1800, sectorCount: 0 });
  const [batchForm, setBatchForm] = useState({
    code: "", geneticLine: "BUT Big 6", sex: "toms" as "toms" | "hens" | "mixed",
    initialCount: 10000, startDate: new Date().toISOString().slice(0, 10), chickSupplier: "", chickPrice: 1.6,
  });
  const [companyForm, setCompanyForm] = useState({ name: "", countryCode: "PL" });
  const [lineForm, setLineForm] = useState({ name: "", supplier: "" });
  const [showNewCompany, setShowNewCompany] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Struktura produkcji</h1>
          <p className="text-sm text-zinc-500">Multi-company · firma → fermy → obiekty → sektory → rzuty</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            value={activeCompanyId}
            onChange={(e) => setCompanyId(Number(e.target.value))}
          >
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{countryFlag(c.countryCode)} {c.name}</option>
            ))}
          </select>
          <button onClick={() => setShowNewCompany(!showNewCompany)} className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
            <Plus className="h-4 w-4" /> Firma
          </button>
          <button
            onClick={() => setForm({ kind: "farm", companyId: activeCompanyId })}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500"
          >
            <Plus className="h-4 w-4" /> Ferma
          </button>
        </div>
      </div>

      {showNewCompany && (
        <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-5">
          <h3 className="mb-3 font-semibold">Nowa organizacja (tenant)</h3>
          <div className="flex flex-wrap gap-3">
            <input className={`${inputCls} max-w-xs`} placeholder="Nazwa firmy" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
            <select className={`${inputCls} w-48`} value={companyForm.countryCode} onChange={(e) => setCompanyForm({ ...companyForm, countryCode: e.target.value })}>
              {Object.entries(COUNTRIES).map(([c, m]) => <option key={c} value={c}>{m.flag} {m.name}</option>)}
            </select>
            <button
              disabled={createCompany.isPending || !companyForm.name}
              onClick={() => { createCompany.mutate({ ...companyForm, baseCurrency: "EUR" }); setShowNewCompany(false); }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
            >Utwórz</button>
          </div>
        </div>
      )}

      {form?.kind === "farm" && (
        <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-5">
          <h3 className="mb-4 font-semibold">Dodaj fermę</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Field label="Nazwa"><input className={inputCls} value={farmForm.name} onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })} /></Field>
            <Field label="Kraj">
              <select className={inputCls} value={farmForm.countryCode} onChange={(e) => setFarmForm({ ...farmForm, countryCode: e.target.value })}>
                {Object.entries(COUNTRIES).map(([c, m]) => <option key={c} value={c}>{m.flag} {m.name}</option>)}
              </select>
            </Field>
            <Field label="Miasto"><input className={inputCls} value={farmForm.city} onChange={(e) => setFarmForm({ ...farmForm, city: e.target.value })} /></Field>
            <Field label="Lat"><input type="number" step="0.001" className={inputCls} value={farmForm.lat} onChange={(e) => setFarmForm({ ...farmForm, lat: Number(e.target.value) })} /></Field>
            <Field label="Lng"><input type="number" step="0.001" className={inputCls} value={farmForm.lng} onChange={(e) => setFarmForm({ ...farmForm, lng: Number(e.target.value) })} /></Field>
            <Field label="Pojemność (szt.)"><input type="number" className={inputCls} value={farmForm.capacity} onChange={(e) => setFarmForm({ ...farmForm, capacity: Number(e.target.value) })} /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              disabled={createFarm.isPending}
              onClick={() => { createFarm.mutate({ ...farmForm, companyId: activeCompanyId }); setForm(null); }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
            >Zapisz fermę</button>
            <button onClick={() => setForm(null)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">Anuluj</button>
          </div>
        </div>
      )}

      {/* Linie genetyczne firmy */}
      {company && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              <Dna className="h-4 w-4" /> Linie genetyczne — {company.name}
            </h3>
            <button onClick={() => setForm({ kind: "line", companyId: company.id })} className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
              <Plus className="h-3 w-3" /> Dodaj linię
            </button>
          </div>
          {form?.kind === "line" && (
            <div className="mb-3 flex flex-wrap gap-2">
              <input className={`${inputCls} max-w-xs`} placeholder="Nazwa linii" value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })} />
              <input className={`${inputCls} max-w-xs`} placeholder="Dostawca" value={lineForm.supplier} onChange={(e) => setLineForm({ ...lineForm, supplier: e.target.value })} />
              <button
                onClick={() => { createLine.mutate({ companyId: company.id, name: lineForm.name, supplier: lineForm.supplier }); setForm(null); setLineForm({ name: "", supplier: "" }); }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm hover:bg-red-500"
              >Zapisz</button>
            </div>
          )}
          <GeneticLinesList />
        </div>
      )}

      <div className="space-y-3">
        {(company?.farms ?? []).map((f) => (
          <div key={f.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60">
            <div className="flex w-full items-center gap-3 px-5 py-4">
              <button onClick={() => toggle(`f${f.id}`)} className="flex flex-1 items-center gap-3 text-left">
                {open[`f${f.id}`] ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                <Warehouse className="h-5 w-5 text-red-400" />
                <div className="flex-1">
                  <span className="font-semibold">{countryFlag(f.countryCode)} {f.name}</span>
                  <span className="ml-2 text-sm text-zinc-500">{f.city}, {countryName(f.countryCode)}</span>
                </div>
                <span className="hidden text-xs text-zinc-500 sm:inline">pojemność {fmtNum(f.capacity)} szt. · {f.houses.length} obiektów</span>
              </button>
              <button onClick={() => setForm({ kind: "editFarm", id: f.id, name: f.name, city: f.city, capacity: f.capacity })} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" title="Edytuj">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => { if (confirm(`Archiwizować fermę ${f.name}?`)) archiveFarm.mutate({ id: f.id }); }} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400" title="Archiwizuj">
                <Archive className="h-4 w-4" />
              </button>
            </div>

            {form?.kind === "editFarm" && form.id === f.id && (
              <div className="border-t border-zinc-800 px-5 py-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Nazwa"><input className={`${inputCls} w-56`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label="Miasto"><input className={`${inputCls} w-40`} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                  <Field label="Pojemność"><input type="number" className={`${inputCls} w-32`} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></Field>
                  <button onClick={() => { updateFarm.mutate({ id: f.id, name: form.name, city: form.city, capacity: form.capacity }); setForm(null); }} className="rounded-lg bg-red-600 px-3 py-2 text-sm hover:bg-red-500">Zapisz</button>
                  <button onClick={() => setForm(null)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">Anuluj</button>
                </div>
              </div>
            )}

            {open[`f${f.id}`] && (
              <div className="space-y-2 border-t border-zinc-800 px-5 py-4">
                {f.houses.map((h) => (
                  <div key={h.id} className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <HomeIcon className="h-4 w-4 text-zinc-400" />
                        {h.name}
                        <span className="text-xs text-zinc-500">
                          {h.houseType === "brooder" ? "odchowalnia" : "kurnik"} · {fmtNum(num(h.areaM2))} m² · max {num(h.maxDensityKgM2)} kg/m²
                        </span>
                        {h.sectors.length > 0 && (
                          <span className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {h.sectors.length} sektorów
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setForm({ kind: "batch", houseId: h.id })} className="flex items-center gap-1 rounded-md bg-zinc-700/60 px-2.5 py-1.5 text-xs hover:bg-zinc-700">
                          <Plus className="h-3 w-3" /> Przyjęcie piskląt
                        </button>
                        <button onClick={() => setForm({ kind: "editHouse", id: h.id, name: h.name, areaM2: num(h.areaM2) })} className="rounded p-1.5 text-zinc-500 hover:text-zinc-200"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm(`Archiwizować ${h.name}?`)) archiveHouse.mutate({ id: h.id }); }} className="rounded p-1.5 text-zinc-500 hover:text-red-400"><Archive className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    {form?.kind === "editHouse" && form.id === h.id && (
                      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
                        <Field label="Nazwa"><input className={`${inputCls} w-48`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                        <Field label="Powierzchnia m²"><input type="number" className={`${inputCls} w-32`} value={form.areaM2} onChange={(e) => setForm({ ...form, areaM2: Number(e.target.value) })} /></Field>
                        <button onClick={() => { updateHouse.mutate({ id: h.id, name: form.name, areaM2: form.areaM2 }); setForm(null); }} className="rounded-lg bg-red-600 px-3 py-2 text-sm hover:bg-red-500">Zapisz</button>
                        <button onClick={() => setForm(null)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">Anuluj</button>
                      </div>
                    )}
                    {form?.kind === "batch" && form.houseId === h.id && (
                      <div className="mt-3 rounded-lg border border-red-900/40 bg-zinc-900 p-4">
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                          <Field label="Kod rzutu"><input className={inputCls} placeholder="RZ/2026/041" value={batchForm.code} onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })} /></Field>
                          <Field label="Linia genetyczna">
                            <select className={inputCls} value={batchForm.geneticLine} onChange={(e) => setBatchForm({ ...batchForm, geneticLine: e.target.value })}>
                              {["BUT Big 6", "Hybrid Converter", "Aviagen Nicholas 700", "Hendrix XL"].map((l) => <option key={l}>{l}</option>)}
                            </select>
                          </Field>
                          <Field label="Płeć">
                            <select className={inputCls} value={batchForm.sex} onChange={(e) => setBatchForm({ ...batchForm, sex: e.target.value as "toms" | "hens" | "mixed" })}>
                              <option value="toms">Indory</option><option value="hens">Indyczki</option><option value="mixed">Mieszany</option>
                            </select>
                          </Field>
                          <Field label="Liczba piskląt"><input type="number" className={inputCls} value={batchForm.initialCount} onChange={(e) => setBatchForm({ ...batchForm, initialCount: Number(e.target.value) })} /></Field>
                          <Field label="Data przyjęcia"><input type="date" className={inputCls} value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} /></Field>
                          <Field label="Dostawca"><input className={inputCls} value={batchForm.chickSupplier} onChange={(e) => setBatchForm({ ...batchForm, chickSupplier: e.target.value })} /></Field>
                          <Field label="Cena pisklęcia (EUR)"><input type="number" step="0.01" className={inputCls} value={batchForm.chickPrice} onChange={(e) => setBatchForm({ ...batchForm, chickPrice: Number(e.target.value) })} /></Field>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            disabled={createBatch.isPending}
                            onClick={() => {
                              if (batchForm.code.trim().length < 3) { toast.error("Kod rzutu musi mieć min. 3 znaki (np. RZ/2026/041)"); return; }
                              if (batchForm.initialCount < 1) { toast.error("Podaj liczbę piskląt"); return; }
                              createBatch.mutate({ houseId: h.id, ...batchForm }); setForm(null);
                            }}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                          >Utwórz rzut + pełny harmonogram (Workflow Engine)</button>
                          <button onClick={() => setForm(null)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">Anuluj</button>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 space-y-1">
                      {h.batches.map((b) => (
                        <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-900/70 px-3 py-2 text-xs">
                          <Bird className={`h-3.5 w-3.5 ${b.status === "active" ? "text-emerald-400" : "text-zinc-600"}`} />
                          <span className="font-mono font-medium">{b.code}</span>
                          <span className="text-zinc-400">{b.geneticLine}</span>
                          <span className="ml-auto text-zinc-400">
                            {b.status === "active" ? `${fmtNum(b.currentCount)} szt.` : `zamknięty · sprzedano ${fmtNum(b.soldCount)}`}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${b.status === "active" ? "bg-emerald-950 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                            {b.status === "active" ? "AKTYWNY" : "ZAMKNIĘTY"}
                          </span>
                        </div>
                      ))}
                      {h.batches.length === 0 && <div className="text-xs text-zinc-600">Brak rzutów — przyjmij pisklęta.</div>}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setForm({ kind: "house", farmId: f.id })}
                  className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500"
                >
                  <Plus className="h-3 w-3" /> Dodaj obiekt
                </button>
                {form?.kind === "house" && form.farmId === f.id && (
                  <div className="rounded-lg border border-red-900/40 bg-zinc-900 p-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <Field label="Nazwa"><input className={inputCls} value={houseForm.name} onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })} /></Field>
                      <Field label="Typ">
                        <select className={inputCls} value={houseForm.houseType} onChange={(e) => setHouseForm({ ...houseForm, houseType: e.target.value as "brooder" | "finisher" })}>
                          <option value="brooder">Odchowalnia</option><option value="finisher">Kurnik</option>
                        </select>
                      </Field>
                      <Field label="Powierzchnia (m²)"><input type="number" className={inputCls} value={houseForm.areaM2} onChange={(e) => setHouseForm({ ...houseForm, areaM2: Number(e.target.value) })} /></Field>
                      <Field label="Liczba sektorów"><input type="number" min={0} max={8} className={inputCls} value={houseForm.sectorCount} onChange={(e) => setHouseForm({ ...houseForm, sectorCount: Number(e.target.value) })} /></Field>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={createHouse.isPending}
                        onClick={() => { createHouse.mutate({ farmId: f.id, ...houseForm }); setForm(null); }}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                      >Zapisz obiekt</button>
                      <button onClick={() => setForm(null)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">Anuluj</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  prestarter: "Prestarter", starter: "Starter", grower1: "Grower I",
  grower2: "Grower II", finisher1: "Finisher I", finisher2: "Finisher II",
};

function GeneticLinesList() {
  const lines = trpc.genetics.lines.useQuery();
  const utils = trpc.useUtils();
  const archive = trpc.genetics.archiveLine.useMutation({
    onSuccess: () => { utils.genetics.lines.invalidate(); toast.success("Linia zarchiwizowana"); },
  });
  const [editId, setEditId] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {(lines.data ?? []).map((l) => (
        <div key={l.id} className="rounded-lg bg-zinc-800/60 p-3">
          <div className="flex items-center gap-2 text-sm">
            <b>{l.name}</b>
            {l.supplier && <span className="text-xs text-zinc-500">· {l.supplier}</span>}
            <span className="text-xs text-zinc-500">· normy: {l.norms.length} faz</span>
            <button onClick={() => setEditId(editId === l.id ? null : l.id)}
              className="ml-auto rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600">
              {editId === l.id ? "Zamknij" : "Normy żywieniowe"}
            </button>
            <button onClick={() => { if (confirm(`Archiwizować linię ${l.name}?`)) archive.mutate({ id: l.id }); }}
              className="rounded p-1 text-zinc-500 hover:text-red-400" title="Archiwizuj">
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
          {editId === l.id && <NormEditor line={l} />}
        </div>
      ))}
      {lines.data?.length === 0 && <span className="text-xs text-zinc-600">Brak zdefiniowanych linii.</span>}
    </div>
  );
}

type NormRow = {
  phaseKey: string; dayFrom: number; dayTo: number; proteinPct: number; energyKcal: number;
  lysinePct: number; methioninePct: number; feedPerBirdG: number; targetWeightG: number;
};

function NormEditor({ line }: { line: any }) {
  const utils = trpc.useUtils();
  const save = trpc.genetics.updateNorms.useMutation({
    onSuccess: () => { utils.genetics.lines.invalidate(); toast.success("Normy zapisane"); },
    onError: (e) => toast.error(e.message),
  });
  const [rows, setRows] = useState<NormRow[]>(() =>
    (line.norms ?? []).map((n: any) => ({
      phaseKey: n.phaseKey, dayFrom: n.dayFrom, dayTo: n.dayTo,
      proteinPct: Number(n.proteinPct), energyKcal: n.energyKcal,
      lysinePct: Number(n.lysinePct), methioninePct: Number(n.methioninePct),
      feedPerBirdG: n.feedPerBirdG, targetWeightG: n.targetWeightG,
    })),
  );
  const setCell = (i: number, k: keyof NormRow, v: string) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: k === "phaseKey" ? v : Number(v) } : x)));
  const cls = "w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-xs text-right";
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-zinc-500">
          <tr>
            <th className="px-1 py-1 text-left">Faza</th><th className="px-1">dni od–do</th>
            <th className="px-1">Białko %</th><th className="px-1">Energia kcal</th>
            <th className="px-1">Lizyna %</th><th className="px-1">Metionina %</th>
            <th className="px-1">Pasza g/szt/d</th><th className="px-1">Cel masy g</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n, i) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className="px-1 py-1 font-medium">{PHASE_LABEL[n.phaseKey] ?? n.phaseKey}</td>
              <td className="px-1 text-zinc-500">{n.dayFrom}–{n.dayTo}</td>
              <td className="px-1"><input className={cls} value={n.proteinPct} step="0.01" type="number" onChange={(e) => setCell(i, "proteinPct", e.target.value)} /></td>
              <td className="px-1"><input className={cls} value={n.energyKcal} type="number" onChange={(e) => setCell(i, "energyKcal", e.target.value)} /></td>
              <td className="px-1"><input className={cls} value={n.lysinePct} step="0.01" type="number" onChange={(e) => setCell(i, "lysinePct", e.target.value)} /></td>
              <td className="px-1"><input className={cls} value={n.methioninePct} step="0.01" type="number" onChange={(e) => setCell(i, "methioninePct", e.target.value)} /></td>
              <td className="px-1"><input className={cls} value={n.feedPerBirdG} type="number" onChange={(e) => setCell(i, "feedPerBirdG", e.target.value)} /></td>
              <td className="px-1"><input className={cls} value={n.targetWeightG} type="number" onChange={(e) => setCell(i, "targetWeightG", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => save.mutate({ geneticLineId: line.id, norms: rows.map((r) => ({ ...r, phaseKey: r.phaseKey as any })) })}
        disabled={save.isPending}
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
        Zapisz normy
      </button>
    </div>
  );
}
