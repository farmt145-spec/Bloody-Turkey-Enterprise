import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { setWorkspace } from "@/lib/workspace";
import { Bird, Building2, Plus, MapPin, Home } from "lucide-react";
import { toast } from "sonner";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500";

type Company = {
  id: number; name: string; isDemo: boolean; address: string | null; contact: string | null;
  farms: { id: number; name: string; city: string; isDemo: boolean; housesCount: number }[];
};

export default function FarmSelect() {
  const nav = useNavigate();
  const utils = trpc.useUtils();
  const q = trpc.workspace.companies.useQuery();
  const create = trpc.workspace.createCompany.useMutation({
    onSuccess: async (r) => {
      toast.success("Firma utworzona — czyste środowisko gotowe");
      setWorkspace({ companyId: r.companyId, farmId: r.farmId, companyName: form.name, farmName: "Gospodarstwo 1", isDemo: false });
      await utils.invalidate();
      nav("/");
    },
    onError: (e) => toast.error(e.message),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", nip: "", contact: "", declaredHouses: 0, useDemoTemplate: false });

  const companies = (q.data ?? []) as unknown as Company[];
  const demos = companies.filter((c) => c.isDemo);
  const own = companies.filter((c) => !c.isDemo);

  const pick = (c: Company, f: Company["farms"][number]) => {
    setWorkspace({ companyId: c.id, farmId: f.id, companyName: c.name, farmName: f.name, isDemo: c.isDemo });
    nav("/");
  };

  const pickAll = (c: Company) => {
    setWorkspace({ companyId: c.id, farmId: 0, companyName: c.name, farmName: "wszystkie fermy", isDemo: c.isDemo });
    nav("/");
  };

  const CompanyCard = ({ c, demo }: { c: Company; demo?: boolean }) => (
    <div className={`rounded-xl border p-4 ${demo ? "border-zinc-800 bg-zinc-900 hover:border-amber-500/60" : "border-emerald-700/40 bg-zinc-900 hover:border-emerald-500"} transition`}>
      <div className="flex items-center gap-2 font-semibold">
        <Building2 className={`h-4 w-4 ${demo ? "text-amber-400" : "text-emerald-400"}`} />{c.name}
        {(demo || c.isDemo) && <span className="ml-auto rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">DEMO · DANE TESTOWE</span>}
      </div>
      <div className="mt-2 space-y-1">
        {c.farms.map((f) => (
          <button key={f.id} onClick={() => pick(c, f)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800">
            <MapPin className="h-3 w-3" />{f.name}{f.city ? ` · ${f.city}` : ""}
            <span className="ml-auto flex items-center gap-1"><Home className="h-3 w-3" />{f.housesCount}</span>
          </button>
        ))}
        {c.farms.length > 1 && (
          <button onClick={() => pickAll(c)}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-2 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-950/60">
            WEJDŹ: CAŁA FIRMA ({c.farms.length} ferm)
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20 text-red-500">
            <Bird className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">BLOODY TURKEY <span className="text-emerald-400">ENTERPRISE</span></h1>
          <p className="mt-1 text-sm text-zinc-500">Wybierz gospodarstwo, aby rozpocząć pracę — bez logowania</p>
        </div>

        {own.length > 0 && (
          <>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Twoje firmy</h2>
            <div className="mb-8 grid gap-3 sm:grid-cols-2">
              {own.map((c) => <CompanyCard key={c.id} c={c} />)}
            </div>
          </>
        )}

        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Gospodarstwa demonstracyjne</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {demos.map((c) => <CompanyCard key={c.id} c={c} demo />)}

          <button onClick={() => setFormOpen(!formOpen)}
            className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-700/60 bg-emerald-950/20 p-4 font-semibold text-emerald-400 transition hover:bg-emerald-950/40">
            <Plus className="h-5 w-5" /> DODAJ WŁASNĄ FIRMĘ
          </button>
        </div>

        {formOpen && (
          <form
            className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          >
            <h3 className="font-semibold">Nowa firma</h3>
            <input className={inputCls} placeholder="Nazwa firmy *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            <input className={inputCls} placeholder="Adres" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="NIP (opcjonalnie)" value={form.nip}
                onChange={(e) => setForm({ ...form, nip: e.target.value })} />
              <input className={inputCls} placeholder="Kontakt (tel./e-mail)" value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <label className="block text-xs text-zinc-500">
              Liczba kurników
              <input type="number" min={0} max={500} className={`${inputCls} mt-1`} value={form.declaredHouses}
                onChange={(e) => setForm({ ...form, declaredHouses: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={form.useDemoTemplate}
                onChange={(e) => setForm({ ...form, useDemoTemplate: e.target.checked })} />
              Utwórz na podstawie szablonu DEMO (2 przykładowe kurniki, bez danych testowych)
            </label>
            <button disabled={create.isPending}
              className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              {create.isPending ? "Tworzenie…" : "Utwórz firmę i wejdź do systemu"}
            </button>
          </form>
        )}

        {q.isLoading && <p className="mt-6 text-center text-sm text-zinc-500">Ładowanie gospodarstw…</p>}
        {q.error && <p className="mt-6 text-center text-sm text-red-400">Błąd połączenia z serwerem: {q.error.message}</p>}
      </div>
    </div>
  );
}
