import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtNum, fmtPln, EUR_PLN } from "@/lib/geo";
import {
  BrainCircuit, Factory, Stethoscope, Globe, Radio, Trophy, AlertTriangle, ShieldAlert,
  Info, Thermometer, Droplets, Wind, Gauge, ArrowUpDown,
} from "lucide-react";

const num = (v: unknown) => Number(v ?? 0);
const SEV = {
  critical: { icon: ShieldAlert, badge: "bg-red-500/15 text-red-400 border-red-500/40", label: "PILNE" },
  warning: { icon: AlertTriangle, badge: "bg-amber-500/15 text-amber-400 border-amber-500/40", label: "UWAGA" },
  info: { icon: Info, badge: "bg-zinc-700/40 text-zinc-300 border-zinc-700", label: "INFO" },
} as const;

export default function CommandCenter() {
  const report = trpc.command.dailyReport.useQuery();
  const twinBatches = trpc.farm.production.batches.useQuery();
  const genome = trpc.command.nutritionGenome.useQuery();
  const signals = trpc.command.globalSignals.useQuery();
  const iot = trpc.command.iotLive.useQuery(undefined, { refetchInterval: 15000 });

  const [batchId, setBatchId] = useState<number | null>(null);
  const [tempDelta, setTempDelta] = useState(0);
  const [ventDelta, setVentDelta] = useState(0);
  const [densDelta, setDensDelta] = useState(0);
  const [symptoms, setSymptoms] = useState("");
  const [vetQuery, setVetQuery] = useState<string | null>(null);

  const batches = useMemo(() => (twinBatches.data ?? []) as any[], [twinBatches.data]);
  const selBatch = batchId ?? (batches[0]?.batch?.id ?? batches[0]?.id ?? null);
  const twin = trpc.command.digitalTwin.useQuery(
    { batchId: selBatch ?? 0, tempDeltaC: tempDelta, ventilationDeltaPct: ventDelta, densityDeltaPct: densDelta },
    { enabled: !!selBatch },
  );
  const vet = trpc.command.vetDiagnose.useQuery({ symptoms: vetQuery ?? "" }, { enabled: !!vetQuery });

  const ex = report.data?.executive;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600/20 text-red-500">
          <BrainCircuit className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Centrum Decyzji — AI Command Center</h1>
          <p className="text-sm text-zinc-500">Codzienny raport AI: co wymaga uwagi, jakie ryzyka, co zrobiłby kierownik fermy — na podstawie danych z systemu.</p>
        </div>
      </div>

      {/* 🎯 Executive Center */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Wynik grupy (przychody − koszty)", value: ex ? fmtPln(ex.profitEur) : null, icon: Trophy, color: ex && ex.profitEur >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Ptaki w chowie", value: ex ? fmtNum(ex.totalBirds) : null, icon: ArrowUpDown, color: "text-zinc-100" },
          { label: "Biomasa", value: ex ? `${fmtNum(ex.biomassT, 0)} t` : null, icon: Gauge, color: "text-zinc-100" },
          { label: "Sprawy pilne dziś", value: ex ? String(ex.criticalCount) : null, icon: ShieldAlert, color: "text-red-400" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">{c.label}<c.icon className={`h-4 w-4 ${c.color}`} /></div>
            {c.value === null ? <Skeleton className="mt-2 h-8 w-24" /> : <div className={`mt-2 text-xl font-bold ${c.color}`}>{c.value}</div>}
          </div>
        ))}
      </div>

      {ex && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">Najlepsze hale (EPEF)</div>
            {ex.bestHalls.map((h) => <div key={h.code} className="flex justify-between text-sm py-0.5"><span className="text-zinc-300">{h.code}</span><span className="font-bold text-emerald-400">{h.epef.toFixed(0)}</span></div>)}
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400">Hale zagrożone (FCR)</div>
            {ex.worstHalls.map((h) => <div key={h.code} className="flex justify-between text-sm py-0.5"><span className="text-zinc-300">{h.code}</span><span className="font-bold text-red-400">{h.fcr.toFixed(2)}</span></div>)}
          </div>
        </div>
      )}

      {/* 🧠 Priorytety dnia */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Co dziś wymaga uwagi — priorytety z uzasadnieniem</h2>
        <div className="space-y-3">
          {report.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          {report.data?.priorities.map((p, i) => {
            const S = SEV[p.severity];
            return (
              <div key={i} className={`rounded-xl border p-4 ${p.severity === "critical" ? "border-red-500/40 bg-red-500/5" : p.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800 bg-zinc-950/40"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${S.badge}`}><S.icon className="h-3 w-3" /> {S.label}</span>
                  <span className="font-semibold">{p.title}</span>
                </div>
                <p className="mt-1.5 text-sm text-zinc-400"><span className="font-medium text-zinc-300">Dlaczego: </span>{p.why}</p>
                <p className="mt-1 text-sm"><span className="font-medium text-emerald-400">Działanie: </span><span className="text-zinc-300">{p.action}</span></p>
              </div>
            );
          })}
          {report.data && report.data.priorities.length === 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center text-emerald-400">Brak pilnych spraw — wszystkie wskaźniki w normie.</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 🏭 Digital Twin */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400"><Factory className="h-4 w-4 text-sky-400" /> Digital Twin — symuluj zanim zrobisz</h2>
          <p className="mb-4 text-xs text-zinc-500">Wybierz stado i zmień warunki — system pokazuje przewidywane skutki.</p>
          <select value={selBatch ?? ""} onChange={(e) => setBatchId(Number(e.target.value))}
            className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
            {batches.map((b: any) => {
              const bb = b.batch ?? b;
              return <option key={bb.id} value={bb.id}>{bb.code} — {bb.geneticLine ?? bb.geneticLineName ?? ""}</option>;
            })}
          </select>
          {[
            { label: `Temperatura: ${tempDelta > 0 ? "+" : ""}${tempDelta}°C`, v: tempDelta, set: setTempDelta, min: -6, max: 6 },
            { label: `Wentylacja: ${ventDelta > 0 ? "+" : ""}${ventDelta}%`, v: ventDelta, set: setVentDelta, min: -40, max: 40 },
            { label: `Gęstość obsady: ${densDelta > 0 ? "+" : ""}${densDelta}%`, v: densDelta, set: setDensDelta, min: -25, max: 25 },
          ].map((sld) => (
            <div key={sld.label} className="mb-4">
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-zinc-400">{sld.label.split(":")[0]}</span><span className="font-bold text-sky-400">{sld.label.split(": ")[1]}</span></div>
              <Slider value={[sld.v]} min={sld.min} max={sld.max} step={1} onValueChange={([x]) => sld.set(x)} />
            </div>
          ))}
          {twin.isLoading ? <Skeleton className="h-28 w-full" /> : twin.data && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["FCR", `${twin.data.base.fcr.toFixed(2)} → ${twin.data.predicted.fcr.toFixed(2)}`, twin.data.predicted.fcr > twin.data.base.fcr],
                  ["ADG", `${twin.data.base.adgG.toFixed(0)} → ${twin.data.predicted.adgG.toFixed(0)} g/d`, twin.data.predicted.adgG < twin.data.base.adgG],
                  ["Ryzyko mokrej ściółki", `${twin.data.predicted.litterWetRiskPct.toFixed(0)}%`, twin.data.predicted.litterWetRiskPct > 45],
                  ["Δ śmiertelności", `+${twin.data.predicted.mortalityDeltaPct.toFixed(1)} p.p.`, twin.data.predicted.mortalityDeltaPct > 1],
                  ["Δ masy końcowej", `${(twin.data.predicted.finalWeightDeltaG).toFixed(0)} g`, twin.data.predicted.finalWeightDeltaG < 0],
                  ["Δ kosztu na rzut", `${fmtNum(twin.data.predicted.costDeltaEurTotal * EUR_PLN)} zł`, twin.data.predicted.costDeltaEurTotal > 0],
                ].map(([l, v, bad]) => (
                  <div key={l as string} className={`rounded-lg px-3 py-2 ${bad ? "bg-red-500/10 text-red-400" : "bg-zinc-950/60 text-zinc-200"}`}>
                    <span className="text-zinc-500">{l}: </span><span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <p className="rounded-lg bg-sky-500/10 p-3 text-xs leading-relaxed text-sky-300">{twin.data.summary}</p>
            </div>
          )}
        </div>

        {/* 🤖 AI Weterynarz */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400"><Stethoscope className="h-4 w-4 text-red-400" /> AI Weterynarz</h2>
          <p className="mb-4 text-xs text-zinc-500">Opisz objawy — AI wskaże możliwe przyczyny, prawdopodobieństwo, badania i działania.</p>
          <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={3}
            placeholder="np. Ptaki siedzą, pobranie paszy spadło, temperatura 31°C…"
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          <button onClick={() => setVetQuery(symptoms)} disabled={symptoms.length < 3}
            className="mb-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40">
            Zdiagnozuj
          </button>
          {vet.isLoading && <Skeleton className="h-28 w-full" />}
          {vet.data && (
            <div className="space-y-3">
              {vet.data.diagnoses.map((d, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{d.name}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${d.probability >= 70 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{d.probability}%</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-400"><span className="font-semibold text-zinc-300">Badania: </span>{d.tests.join(" · ")}</div>
                  <div className="mt-1 text-xs"><span className="font-semibold text-emerald-400">Działania: </span><span className="text-zinc-300">{d.actions.join(" · ")}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 🌍 Global Intelligence */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400"><Globe className="h-4 w-4 text-emerald-400" /> Global Intelligence — sygnały zakupowe</h2>
          <div className="space-y-2">
            {signals.data?.signals.map((sg, i) => (
              <div key={i} className={`rounded-lg border px-3 py-2 text-sm ${
                sg!.signal === "buy" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                : sg!.signal === "avoid" ? "border-red-500/30 bg-red-500/5 text-red-300"
                : "border-zinc-800 bg-zinc-950/40 text-zinc-400"}`}>
                <span className="mr-2 font-bold uppercase">{sg!.signal === "buy" ? "KUP" : sg!.signal === "avoid" ? "STOP" : "OK"}</span>{sg!.detail}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-zinc-600">{signals.data?.note}</p>
        </div>

        {/* 🧬 Nutrition Genome */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400"><Trophy className="h-4 w-4 text-amber-400" /> Nutrition Genome — receptury vs realny FCR</h2>
          {genome.data?.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500"><th className="py-2">Receptura</th><th>Rzuty</th><th>Śr. FCR realny</th><th>Najlepszy</th></tr></thead>
              <tbody>
                {genome.data.map((g, i) => (
                  <tr key={g.recipeId} className="border-b border-zinc-800/60">
                    <td className="py-2">{i === 0 && <span className="mr-1 text-amber-400">★</span>}{g.name}</td>
                    <td>{g.batchesServed}</td>
                    <td className={g.avgRealFcr < 2.4 ? "text-emerald-400 font-bold" : ""}>{g.avgRealFcr.toFixed(2)}</td>
                    <td>{g.bestFcr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-zinc-500">Za mało danych o wydaniach paszy — system uczy się wraz z kolejnymi rzutami.</p>}
        </div>
      </div>

      {/* 📡 IoT Live */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400"><Radio className="h-4 w-4 text-emerald-400 animate-pulse" /> IoT Live — czujniki hal i silosów (odświeżanie 15 s)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(iot.data ?? []).map((h) => (
            <div key={h.houseId} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{h.name}</span>
                <span className="text-[10px] text-zinc-600">{h.farm}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-xs">
                <div className={`rounded bg-zinc-900 py-1.5 ${num(h.tempC) > 28 ? "text-red-400" : "text-zinc-300"}`}><Thermometer className="mx-auto mb-0.5 h-3 w-3 text-zinc-500" />{h.tempC?.toFixed(0) ?? "—"}°C</div>
                <div className={`rounded bg-zinc-900 py-1.5 ${num(h.ammoniaPpm) > 20 ? "text-red-400" : "text-zinc-300"}`}><Wind className="mx-auto mb-0.5 h-3 w-3 text-zinc-500" />{h.ammoniaPpm?.toFixed(0) ?? "—"} ppm</div>
                <div className="rounded bg-zinc-900 py-1.5 text-zinc-300"><Droplets className="mx-auto mb-0.5 h-3 w-3 text-zinc-500" />{h.humidityPct?.toFixed(0) ?? "—"}%</div>
              </div>
              {h.siloPct !== null && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-zinc-500"><span>Silos</span><span className={h.siloPct < 20 ? "text-red-400 font-bold" : ""}>{h.siloPct.toFixed(0)}%</span></div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-zinc-800"><div className={`h-full rounded-full ${h.siloPct < 20 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(h.siloPct, 100)}%` }} /></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
