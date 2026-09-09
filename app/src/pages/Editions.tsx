import { TIERS, getTier, setTier, type Tier } from "@/lib/editions";
import { Check, Lock, Building2, Crown } from "lucide-react";
import { toast } from "sonner";

export default function Editions() {
  const current = getTier();

  const activate = (t: Tier, name: string) => {
    setTier(t);
    toast.success(`Aktywowano wersję ${name}`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Wersje produktu</h1>
        <p className="text-sm text-zinc-500">
          Nie każdy klient potrzebuje AI, Digital Twin czy IoT. Wybierz wersję dopasowaną do skali gospodarstwa —
          interfejs i moduły dopasują się do licencji.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {TIERS.map((t) => {
          const active = current === t.key;
          return (
            <div key={t.key} className={`relative flex flex-col rounded-2xl border p-5 ${
              active ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/40" : "border-zinc-800 bg-zinc-900/60"}`}>
              {active && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Aktywna wersja
                </span>
              )}
              <div className="mb-1 flex items-center gap-2">
                {t.key === "enterprise" ? <Building2 className={`h-5 w-5 ${t.color}`} /> : t.key === "professional" ? <Crown className={`h-5 w-5 ${t.color}`} /> : null}
                <h2 className={`text-lg font-bold ${t.color}`}>{t.name}</h2>
              </div>
              <p className="mb-3 text-xs text-zinc-500">{t.target}</p>
              <div className="mb-4 text-2xl font-bold">
                {t.pricePln > 0 ? <>{t.pricePln.toLocaleString("pl-PL")} zł<span className="text-sm font-normal text-zinc-500">/mies.</span></> : <span className="text-lg">wycena indywidualna</span>}
              </div>
              <ul className="mb-3 flex-1 space-y-1.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-zinc-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
                {t.limitations.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-zinc-500">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" /> {l}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => activate(t.key, t.name)}
                disabled={active}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${
                  active ? "cursor-default bg-zinc-800 text-zinc-500" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}>
                {active ? "Aktywna" : "Aktywuj (demo)"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">
        <span className="font-semibold text-zinc-200">Jak to działa? </span>
        Wybrana wersja filtruje menu i dostępne moduły w całej aplikacji — mały hodowca nie płaci za funkcje,
        których nie potrzebuje, a duże przedsiębiorstwo dostaje pełne narzędzie. Podział pozwala też rozwijać
        produkt etapami: Standard → Advanced → Professional → Enterprise.
      </div>
    </div>
  );
}
