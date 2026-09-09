import { trpc } from "@/providers/trpc";
import { BrainCircuit, Wheat, HeartPulse, Scale, Thermometer, Coins, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const AREA = {
  nutrition: { label: "AI Nutrition", icon: Wheat, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  veterinary: { label: "AI Veterinary", icon: HeartPulse, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  production: { label: "AI Production", icon: Scale, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30" },
  climate: { label: "Klimat / IoT", icon: Thermometer, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  economics: { label: "Ekonomia", icon: Coins, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" },
} as const;

const SEV = {
  critical: { icon: ShieldAlert, cls: "border-red-500/40 bg-red-500/5", badge: "bg-red-500/15 text-red-400", label: "KRYTYCZNE" },
  warning: { icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/5", badge: "bg-amber-500/15 text-amber-400", label: "OSTRZEŻENIE" },
  info: { icon: Info, cls: "border-zinc-700 bg-zinc-900/60", badge: "bg-zinc-700/40 text-zinc-300", label: "INFO" },
} as const;

type Advice = {
  area: keyof typeof AREA;
  severity: keyof typeof SEV;
  title: string;
  detail: string;
  recommendation: string;
  batchCode?: string;
};

export default function AiAdvisor() {
  const q = trpc.ai.advise.useQuery();
  const items = (q.data ?? []) as Advice[];
  const counts = {
    critical: items.filter((i) => i.severity === "critical").length,
    warning: items.filter((i) => i.severity === "warning").length,
    info: items.filter((i) => i.severity === "info").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <BrainCircuit className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Advisor</h1>
          <p className="text-sm text-zinc-500">
            Silnik ekspercki analizuje historię produkcji, żywienie, leczenie, klimat, wyniki laboratoryjne,
            FCR, ADG, koszty i śmiertelność — i generuje rekomendacje operacyjne.
          </p>
        </div>
      </div>

      {/* podsumowanie */}
      <div className="grid grid-cols-3 gap-4">
        {(["critical", "warning", "info"] as const).map((sev) => (
          <div key={sev} className={`rounded-2xl border p-4 ${SEV[sev].cls}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              {(() => { const I = SEV[sev].icon; return <I className="h-4 w-4" />; })()}
              {SEV[sev].label}
            </div>
            {q.isLoading ? <Skeleton className="mt-2 h-8 w-12" /> : <div className="mt-1 text-3xl font-bold">{counts[sev]}</div>}
          </div>
        ))}
      </div>

      {/* lista rekomendacji */}
      <div className="space-y-3">
        {q.isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        {!q.isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center text-emerald-400">
            Brak aktywnych zaleceń — wszystkie wskaźniki w normie.
          </div>
        )}
        {items.map((a, i) => {
          const A = AREA[a.area];
          const S = SEV[a.severity];
          return (
            <div key={i} className={`rounded-2xl border p-5 ${S.cls}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${A.bg} ${A.color}`}>
                  <A.icon className="h-3.5 w-3.5" /> {A.label}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${S.badge}`}>{S.label}</span>
                {a.batchCode && <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-mono text-zinc-300">{a.batchCode}</span>}
              </div>
              <h3 className="mt-3 text-base font-bold">{a.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{a.detail}</p>
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
                <span className="font-semibold text-emerald-400">Rekomendacja: </span>
                <span className="text-zinc-300">{a.recommendation}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
