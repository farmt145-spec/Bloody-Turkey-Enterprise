import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { setWorkspace } from "@/lib/workspace";
import { Bird, Building2, MapPin, Home } from "lucide-react";

type Company = {
  id: number; name: string; isDemo: boolean; address: string | null; contact: string | null;
  farms: { id: number; name: string; city: string; isDemo: boolean; housesCount: number }[];
};

export default function FarmSelect() {
  const nav = useNavigate();
  const q = trpc.workspace.companies.useQuery();

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
          <p className="mt-1 text-sm text-zinc-500">Wybierz swoją firmę lub środowisko demonstracyjne Indykpol</p>
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
        </div>

        {q.isLoading && <p className="mt-6 text-center text-sm text-zinc-500">Ładowanie gospodarstw…</p>}
        {q.error && <p className="mt-6 text-center text-sm text-red-400">Błąd połączenia z serwerem: {q.error.message}</p>}
      </div>
    </div>
  );
}
