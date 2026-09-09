import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BookOpen, Scale, Droplets, ExternalLink } from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  prestarter: "Prestarter", starter: "Starter 2", starter1: "Starter 1", starter2: "Starter 2",
  grower1: "Grower I", grower2: "Grower II", finisher1: "Finisher I", finisher2: "Finisher II",
};

type WeekRow = { week: number; targetWeightG: number; dailyGainG: number; feedPerBirdG: number; phase: string };
type Line = {
  id: number; name: string; supplier: string | null;
  phases: any[]; weeks: WeekRow[];
};

export default function Normy() {
  const q = trpc.normy.overview.useQuery();
  const [tab, setTab] = useState<"wagi" | "chow">("wagi");
  const [lineId, setLineId] = useState<number | null>(null);

  if (q.isLoading) return <p className="p-6 text-zinc-500">Ładowanie norm…</p>;
  if (q.error) return <p className="p-6 text-red-400">{q.error.message}</p>;
  const data = q.data!;
  const lines = data.lines as Line[];
  const active = lines.find((l) => l.id === lineId) ?? lines[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6 text-emerald-400" /> Normy chowu</h1>
        <p className="text-sm text-zinc-500">Normy wagowe tygodniowe każdej linii genetycznej, zasady chowu (woda, pasza, przyrost) i źródła wiedzy.</p>
      </div>

      <div className="flex gap-2">
        {([["wagi", "Normy wagowe linii"], ["chow", "Zasady chowu (tydzień po tygodniu)"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === k ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "wagi" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {lines.map((l) => (
              <button key={l.id} onClick={() => setLineId(l.id)}
                className={`rounded-lg px-3 py-1.5 text-sm ${active?.id === l.id ? "bg-emerald-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>
                {l.name}
              </button>
            ))}
          </div>
          {active ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                <b className="text-zinc-200">{active.name}</b>
                {active.supplier ? <> · dostawca: {active.supplier}</> : null}
              </p>
              {active.weeks.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
                  Ta linia nie ma jeszcze uzupełnionych norm fazowych — edytuj je w Struktura → Linie genetyczne.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-right">Tydzień</th>
                        <th className="px-3 py-2 text-right">Masa docelowa (g)</th>
                        <th className="px-3 py-2 text-right">Przyrost dzienny (g)</th>
                        <th className="px-3 py-2 text-right">Pasza / szt. / dzień (g)</th>
                        <th className="px-3 py-2 text-left">Faza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.weeks.map((w) => (
                        <tr key={w.week} className="border-t border-zinc-800">
                          <td className="px-3 py-1.5 text-right font-semibold">{w.week}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-300">{w.targetWeightG.toLocaleString("pl-PL")}</td>
                          <td className="px-3 py-1.5 text-right">{w.dailyGainG}</td>
                          <td className="px-3 py-1.5 text-right">{w.feedPerBirdG}</td>
                          <td className="px-3 py-1.5 text-xs text-zinc-400">{PHASE_LABEL[w.phase] ?? w.phase}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">Brak linii genetycznych w tej firmie.</p>
          )}
        </div>
      )}

      {tab === "chow" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-right">Tydzień</th>
                <th className="px-3 py-2 text-right">Temperatura (°C)</th>
                <th className="px-3 py-2 text-right">Wilgotność (%)</th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3" /> Woda / szt. / dzień (ml)</span></th>
                <th className="px-3 py-2 text-right">Światło (h)</th>
                <th className="px-3 py-2 text-left">Uwagi</th>
              </tr>
            </thead>
            <tbody>
              {data.husbandry.map((h: any) => (
                <tr key={h.week} className="border-t border-zinc-800">
                  <td className="px-3 py-1.5 text-right font-semibold">{h.week}</td>
                  <td className="px-3 py-1.5 text-right">{h.tempC}</td>
                  <td className="px-3 py-1.5 text-right">{h.humidityPct}</td>
                  <td className="px-3 py-1.5 text-right">{h.waterMlPerBird}</td>
                  <td className="px-3 py-1.5 text-right">{h.lightH}</td>
                  <td className="px-3 py-1.5 text-xs text-zinc-400">{h.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200"><Scale className="h-4 w-4 text-emerald-400" /> Źródła wiedzy</h2>
        <ul className="space-y-1 text-sm">
          {data.sources.map((src: any) => (
            <li key={src.url}>
              <a href={src.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                {src.title} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-amber-400/90">{data.disclaimer}</p>
      </div>
    </div>
  );
}
