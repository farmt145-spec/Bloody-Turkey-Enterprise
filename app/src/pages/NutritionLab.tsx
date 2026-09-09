import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtEur } from "@/lib/geo";
import { FlaskConical, Info, Scale, Droplets, Wheat, TrendingUp, ShieldCheck, AlertTriangle, BrainCircuit, Bird, Coins } from "lucide-react";

const num = (v: unknown) => Number(v ?? 0);

type AgeGroup = "prestarter" | "starter" | "grower1" | "grower2" | "finisher1" | "finisher2";
const GROUPS: { key: AgeGroup; label: string }[] = [
  { key: "prestarter", label: "Prestarter 0–14 d" },
  { key: "starter", label: "Starter 15–28 d" },
  { key: "grower1", label: "Grower I 29–56 d" },
  { key: "grower2", label: "Grower II 57–84 d" },
  { key: "finisher1", label: "Finisher I 85–112 d" },
  { key: "finisher2", label: "Finisher II 113+ d" },
];

export default function NutritionLab() {
  const ings = trpc.nutrition.ingredients.useQuery();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("finisher1");
  const [shares, setShares] = useState<Record<number, number>>({});
  const [showWhy, setShowWhy] = useState(false);
  const [birds, setBirds] = useState(10000);
  const [days, setDays] = useState(140);

  const items = useMemo(
    () => Object.entries(shares).map(([id, percent]) => ({ ingredientId: Number(id), percent })).filter((x) => x.percent > 0),
    [shares],
  );

  const sim = trpc.nutrition.simulate.useQuery(
    { items: items.length ? items : [{ ingredientId: 1, percent: 100 }], ageGroup },
    { enabled: !!ings.data },
  );
  const batchSim = trpc.nutrition.batchSimulation.useQuery(
    { items: items.length ? items : [{ ingredientId: 1, percent: 100 }], ageGroup, birds, days },
    { enabled: !!ings.data && items.length > 0 },
  );

  const list = ings.data ?? [];
  const total = items.reduce((a, i) => a + i.percent, 0);
  const p = sim.data?.profile;
  const prod = sim.data?.production;

  const setShare = (id: number, v: number) => setShares((s) => ({ ...s, [id]: v }));

  const kpis = p && prod ? [
    { label: "FCR", value: prod.fcr.toFixed(2), icon: Wheat, bad: prod.fcr > 2.6 },
    { label: "ADG", value: `${prod.adgG.toFixed(0)} g/d`, icon: TrendingUp, bad: prod.adgG < 110 },
    { label: "EPEF", value: prod.epef.toFixed(0), icon: Scale, bad: prod.epef < 300 },
    { label: "Koszt tony", value: fmtEur(p.costPerTon), icon: Coins, bad: p.costPerTon * 4.28 > 1930 },
    { label: "Koszt kg żywca", value: `${(num(sim.data?.costPerKgLive)*4.28).toFixed(2)} zł`, icon: Bird, bad: num(sim.data?.costPerKgLive) > 1.2 },
    { label: "Pobór wody", value: `${prod.waterMl.toFixed(0)} ml`, icon: Droplets, bad: false },
    { label: "Ryzyko metaboliczne", value: `${prod.metabolicRisk.toFixed(0)}/100`, icon: AlertTriangle, bad: prod.metabolicRisk > 25 },
    { label: "Bezpieczeństwo", value: `${prod.safety.toFixed(0)}/100`, icon: ShieldCheck, bad: prod.safety < 70 },
  ] : [];

  const bs = batchSim.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Nutrition Lab — wirtualne laboratorium żywienia</h1>
          <p className="text-sm text-zinc-500">Przesuń suwaki udziałów surowców — FCR, ADG, EPEF, koszty i ryzyka przeliczają się natychmiast.</p>
        </div>
      </div>

      {/* grupa wiekowa */}
      <div className="flex gap-2">
        {GROUPS.map((g) => (
          <button key={g.key} onClick={() => setAgeGroup(g.key)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${ageGroup === g.key ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
            {g.label}
          </button>
        ))}
        <button
          onClick={() => {
            const byName = Object.fromEntries(list.map((i) => [i.name, i.id]));
            const preset: [string, number][] = [["Pszenica", 42], ["Śruta sojowa 48%", 28], ["Kukurydza", 16], ["Olej sojowy", 3.5], ["Premiks witaminowo-mineralny", 5], ["Węglan wapnia", 2.5], ["Fosforan monowapniowy", 1.5], ["L-lizyna HCl", 1], ["DL-metionina", 0.5]];
            const next: Record<number, number> = {};
            for (const [n, v] of preset) if (byName[n]) next[byName[n]] = v;
            setShares(next);
          }}
          className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20">
          Załaduj typową recepturę
        </button>
        <div className={`ml-auto rounded-lg px-3 py-2 text-sm font-bold ${Math.abs(total - 100) < 0.5 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
          Suma: {total.toFixed(0)}%
        </div>
      </div>

      {sim.data?.warnings.map((w, i) => (
        <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-400">{w}</div>
      ))}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* suwaki */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Udziały surowców</h2>
          {ings.isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          {list.map((ing) => {
            const v = shares[ing.id] ?? 0;
            return (
              <div key={ing.id} className={`rounded-xl border p-4 transition-colors ${v > 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/60"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{ing.name}</div>
                    <div className="text-xs text-zinc-500">{num(ing.proteinPct).toFixed(0)}% białka · {ing.energyKcal} kcal · {fmtEur(num(ing.pricePerTon))}/t</div>
                  </div>
                  <span className={`text-lg font-bold ${v > 0 ? "text-emerald-400" : "text-zinc-600"}`}>{v.toFixed(0)}%</span>
                </div>
                <Slider value={[v]} max={80} step={1} onValueChange={([x]) => setShare(ing.id, x)} />
              </div>
            );
          })}
        </div>

        {/* wyniki */}
        <div className="space-y-6 lg:col-span-3">
          {/* KPI live */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Wyniki — aktualizacja na żywo</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(sim.isLoading ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
                kpis.map((k) => (
                  <div key={k.label} className={`rounded-xl border p-3 ${k.bad ? "border-red-500/30 bg-red-500/5" : "border-zinc-800 bg-zinc-900/60"}`}>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">{k.label}<k.icon className={`h-3.5 w-3.5 ${k.bad ? "text-red-400" : "text-emerald-400"}`} /></div>
                    <div className={`mt-1 text-lg font-bold ${k.bad ? "text-red-400" : ""}`}>{k.value}</div>
                  </div>
                )))}
            </div>
          </div>

          {/* profil */}
          {p && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Profil mieszanki</h2>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                {[["Białko", `${p.protein.toFixed(1)}%`], ["Energia", `${p.energy.toFixed(0)} kcal`], ["Lizyna", `${p.lysine.toFixed(2)}%`], ["Metionina", `${p.methionine.toFixed(2)}%`], ["Włókno", `${p.fiber.toFixed(1)}%`], ["Tłuszcz", `${p.fat.toFixed(1)}%`], ["Wapń", `${p.calcium.toFixed(2)}%`], ["Fosfor", `${p.phosphorus.toFixed(2)}%`]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-zinc-950/60 px-3 py-2"><span className="text-zinc-500">{l}: </span><span className="font-semibold">{v}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* AI tłumaczy */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><BrainCircuit className="h-4 w-4" /> AI tłumaczy decyzję</h2>
              <button onClick={() => setShowWhy(!showWhy)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
                <Info className="h-3.5 w-3.5" /> {showWhy ? "Ukryj" : "Dlaczego?"}
              </button>
            </div>
            {showWhy && (
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{sim.data?.explanation}</p>
            )}
          </div>

          {/* symulator rzutu */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Symulator całego rzutu</h2>
              <label className="flex items-center gap-2 text-xs text-zinc-400">sztuki
                <input type="number" value={birds} onChange={(e) => setBirds(Number(e.target.value) || 0)} className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">dni chowu
                <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value) || 0)} className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm" />
              </label>
            </div>
            {!items.length ? <p className="text-sm text-zinc-500">Ustaw suwaki, aby zasymulować rzut.</p> : batchSim.isLoading ? <Skeleton className="h-24 w-full" /> : bs && (
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                {[
                  ["Masa końcowa", `${bs.finalWeightKg.toFixed(1)} kg`],
                  ["Śmiertelność", `${bs.mortalityPct.toFixed(1)}%`],
                  ["Zużycie paszy", `${bs.feedTons.toFixed(0)} t`],
                  ["Zużycie wody", `${bs.waterTons.toFixed(0)} m³`],
                  ["Koszt paszy", fmtEur(bs.feedCostEur)],
                  ["Koszt kg żywca", `${(bs.costPerKgLive*4.28).toFixed(2)} zł`],
                  ["Przychód", fmtEur(bs.revenueEur)],
                  ["Marża brutto", fmtEur(bs.grossMarginEur)],
                  ["Emisja NH₃", `${bs.ammoniaTons.toFixed(1)} kg`],
                  ["Pewność prognozy", `${bs.certaintyPct}%`],
                ].map(([l, v]) => (
                  <div key={l} className={`rounded-lg px-3 py-2 ${l === "Marża brutto" ? (bs.grossMarginEur >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400") : "bg-zinc-950/60"}`}>
                    <span className="text-zinc-500">{l}: </span><span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
