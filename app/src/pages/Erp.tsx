import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ERP_MODULES, type FieldDef, type ModuleDef } from "@/lib/erp-modules";
import { toast } from "sonner";
import {
  Plus, Search, ChevronUp, ChevronDown, Archive, Pencil, Boxes, ChevronLeft, ChevronRight, Upload,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- generyczna tabela CRUD dla modułu ERP ---------- */
function ModuleTable({ mod, openNew }: { mod: ModuleDef; openNew: boolean }) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Record<string, any> | null>(openNew ? {} : null);

  const api = (trpc.erp as any)[mod.key];
  const q = api.list.useQuery({ page, pageSize: 20, search: search || undefined, sortBy, sortDir });
  const create = api.create.useMutation({
    onSuccess: () => { toast.success("Rekord dodany"); setEditing(null); utils.erp.invalidate(); },
    onError: (e: any) => toast.error(`Błąd: ${e.message}`),
  });
  const update = api.update.useMutation({
    onSuccess: () => { toast.success("Zapisano zmiany"); setEditing(null); utils.erp.invalidate(); },
    onError: (e: any) => toast.error(`Błąd: ${e.message}`),
  });
  const remove = api.remove.useMutation({
    onSuccess: () => { toast.success("Rekord zarchiwizowany"); utils.erp.invalidate(); },
    onError: (e: any) => toast.error(`Błąd: ${e.message}`),
  });

  const listFields = mod.fields.filter((f) => f.list);
  const rows: Record<string, any>[] = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(Math.ceil(total / 20), 1);

  const toggleSort = (name: string) => {
    if (sortBy === name) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(name); setSortDir("asc"); }
  };

  const save = (data: Record<string, any>) => {
    if (data.id) update.mutate({ id: data.id, data });
    else create.mutate({ data });
  };

  const fmtCell = (f: FieldDef, v: any) => {
    if (v === null || v === undefined || v === "") return "—";
    if (f.type === "bool") return v ? "✓" : "✗";
    if (f.type === "select") return f.options?.find((o) => o.value === v)?.label ?? v;
    return String(v);
  };

  return (
    <div>
      {/* pasek narzędzi */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Szukaj…"
            className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <span className="text-xs text-zinc-500">{total} rekordów</span>
        <button
          onClick={() => setEditing({})}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" /> Dodaj
        </button>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
              {listFields.map((f) => (
                <th key={f.name} className="cursor-pointer px-4 py-3 hover:text-zinc-300" onClick={() => toggleSort(f.name)}>
                  <span className="inline-flex items-center gap-1">
                    {f.label}
                    {sortBy === f.name && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/60">
                  {listFields.map((f) => (<td key={f.name} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>))}
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                </tr>
              ))}
            {!q.isLoading && rows.length === 0 && (
              <tr><td colSpan={listFields.length + 1} className="px-4 py-10 text-center text-zinc-500">
                <Boxes className="mx-auto mb-2 h-8 w-8 text-zinc-700" />Brak rekordów — dodaj pierwszy.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/40">
                {listFields.map((f) => (<td key={f.name} className="px-4 py-3 text-zinc-200">{fmtCell(f, r[f.name])}</td>))}
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(r)} className="mr-2 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400" title="Edytuj"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove.mutate({ id: r.id })} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400" title="Archiwizuj"><Archive className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* paginacja */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-zinc-700 p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-zinc-400">Strona {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-zinc-700 p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {/* formularz */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "Edytuj rekord" : "Nowy rekord"} — {mod.label}</h3>
            <RecordForm mod={mod} initial={editing} onSave={save} onCancel={() => setEditing(null)} busy={create.isPending || update.isPending} />
            {mod.key === "documents" && (
              <FileUpload
                onUploaded={(url, name) => toast.success(`Wgrano plik: ${name}`, { description: "Link zapisany w schowku — wklej go w pole Link formularza." }) && navigator.clipboard?.writeText(url)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordForm({ mod, initial, onSave, onCancel, busy }: {
  mod: ModuleDef; initial: Record<string, any>;
  onSave: (d: Record<string, any>) => void; onCancel: () => void; busy: boolean;
}) {
  const [form, setForm] = useState<Record<string, any>>(() => {
    const f: Record<string, any> = { ...initial };
    for (const fd of mod.fields) if (fd.type === "date" && f[fd.name]) f[fd.name] = String(f[fd.name]).slice(0, 10);
    return f;
  });
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, any> = {};
    for (const fd of mod.fields) {
      let v = form[fd.name];
      if (v === "" || v === undefined) continue;
      if (fd.type === "number") v = Number(v);
      data[fd.name] = v;
    }
    onSave({ ...(initial.id ? { id: initial.id } : {}), ...data });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {mod.fields.map((f) => (
        <div key={f.name}>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
          {f.type === "select" ? (
            <select value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} required={f.required}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500">
              <option value="">— wybierz —</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <textarea value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          ) : f.type === "bool" ? (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={!!form[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Tak
            </label>
          ) : (
            <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} step={f.type === "number" ? "any" : undefined}
              value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} required={f.required}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Anuluj</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
          {busy ? "Zapisywanie…" : "Zapisz"}
        </button>
      </div>
    </form>
  );
}

/* ---------- wgrywanie plików ---------- */
function FileUpload({ onUploaded }: { onUploaded: (url: string, name: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Błąd uploadu");
      setDone(json.url);
      onUploaded(json.url, json.name);
    } catch (e: any) {
      toast.error(`Upload nieudany: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
        <Upload className="h-6 w-6 text-emerald-500" />
        {busy ? "Wgrywanie…" : "Kliknij, aby wgrać plik (PDF, JPG, PNG)"}
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv" className="hidden" disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {done && (
        <a href={done} target="_blank" className="mt-2 block truncate text-center text-xs text-emerald-400 hover:underline">{done}</a>
      )}
    </div>
  );
}

/* ---------- strona modułów ERP ---------- */
export default function Erp() {
  const { module } = useParams();
  const [sp] = useSearchParams();
  const mod = useMemo(() => ERP_MODULES.find((m) => m.key === module) ?? ERP_MODULES[0], [module]);
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      {/* menu modułów */}
      <div className="mb-6 flex flex-wrap gap-2">
        {ERP_MODULES.map((m) => (
          <Link key={m.key} to={`/erp/${m.key}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              m.key === mod.key
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}>
            {m.label}
          </Link>
        ))}
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{mod.label}</h1>
        <p className="text-sm text-zinc-500">{mod.description}</p>
      </div>
      <ModuleTable key={mod.key} mod={mod} openNew={sp.get("new") === "1"} />
    </div>
  );
}
