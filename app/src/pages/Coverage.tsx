import { Link } from "react-router";
import { Check, ArrowDownUp, Plus, Clock } from "lucide-react";

type Row = { module: string; where: string; note?: string };
const EXISTS: Row[] = [
  { module: "Organizacja (firmy, fermy, kurniki, sektory)", where: "Struktura" },
  { module: "Produkcja (rzuty, dzienniki, ważenia, transfery)", where: "Produkcja, Transfery" },
  { module: "Żywienie (receptury, programy, surowce, optymalizator)", where: "Żywienie, AI Nutrition Lab" },
  { module: "Zdrowie (leczenie, szczepienia)", where: "Zdrowie" },
  { module: "Magazyn (magazyny, silosy)", where: "Magazyn" },
  { module: "Ekonomia (koszty, sprzedaż, PnL)", where: "Ekonomia" },
  { module: "ERP (dostawcy, zamówienia, faktury, kontrakty, leki, laboratorium, energia, utrzymanie, bioasekuracja, dokumenty, zadania, wylęgarnia)", where: "Moduły ERP" },
  { module: "AI Advisor (regułowy silnik ekspercki)", where: "AI Advisor" },
  { module: "Centrum analityczne + prognozy", where: "Analityka" },
  { module: "Audit Trail + historia zmian", where: "globalnie" },
  { module: "Powiadomienia + wiadomości", where: "topbar / ERP" },
  { module: "Multi-company (multi-tenant)", where: "Struktura" },
  { module: "Wersje produktu (Standard/Advanced/Professional/Enterprise)", where: "Wersje produktu" },
];
const ADDED: Row[] = [
  { module: "Biblioteka chorób (disease library)", where: "Zdrowie → Biblioteka chorób", note: "z dokumentacji: /diseases" },
  { module: "Nekropsja (sekcje kontrolne)", where: "API gap.healthIntel", note: "/necropsy" },
  { module: "Karencje leków + bezpieczna data sprzedaży", where: "Zdrowie → Okresy karencji", note: "/withdrawals + calculate" },
  { module: "Partie magazynowe (loty) FIFO/FEFO + traceability", where: "Magazyn → Partie magazynowe", note: "/warehouse/lots, /movements, /traceability" },
  { module: "Skan alertów ważności partii", where: "Magazyn → Skanuj alerty", note: "/alerts/scan" },
  { module: "Scenariusze ekonomiczne (co-jeśli)", where: "API gap.economicsIntel", note: "/economics/scenarios" },
  { module: "Benchmarki przeliczane na danych grupy", where: "API gap.economicsIntel", note: "/benchmarks/recalculate" },
  { module: "Historia zmian receptur + raporty eksperckie", where: "API gap.feedIntel", note: "/feed/recipe-history" },
  { module: "Dokładność prognoz (forecast accuracy)", where: "API gap.feedIntel", note: "/forecasts/analyze-accuracy" },
  { module: "Rejestr integracji między modułami", where: "API gap.integrations", note: "apps/api /integrations" },
  { module: "Generyczny rejestr encji dynamicznych", where: "API gap.entities", note: "/v1/entities" },
];
const MERGED: Row[] = [
  { module: "Żywienie eksperckie (karty składników, Dlaczego?, porównania)", where: "AI Nutrition Lab", note: "połączone z istniejącym symulatorem suwaków" },
  { module: "AI weterynaryjne", where: "Centrum Decyzji → AI Weterynarz", note: "scalone z biblioteką chorób" },
  { module: "Digital Twin", where: "Centrum Decyzji", note: "scalone z danymi IoT hal" },
  { module: "Executive Dashboard", where: "Centrum Decyzji → Executive Center" },
  { module: "IoT (telemetria, alarmy, silosy)", where: "Centrum Decyzji → IoT Live + Dzienniki" },
];
const TODO: Row[] = [
  { module: "Live feedy rynkowe (MATIF, NBP, pogoda)", where: "Global Intelligence", note: "obecnie benchmarki statyczne" },
  { module: "Kamery IoT (podgląd wideo)", where: "IoT", note: "wymaga infrastruktury klienta" },
  { module: "Eksport PDF/Excel raportów", where: "Raporty", note: "kolejny etap" },
  { module: "Aplikacja mobilna", where: "API Enterprise", note: "endpointy gotowe" },
  { module: "Profile użytkownika-eksperta (samouczenie)", where: "Nutrition Genome", note: "częściowo — realny FCR już działa" },
];

function Section({ title, icon: Icon, rows, cls }: { title: string; icon: any; rows: Row[]; cls: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider"><Icon className="h-4 w-4" /> {title} ({rows.length})</h2>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.module} className="rounded-lg bg-zinc-950/40 px-3 py-2">
            <div className="font-medium text-zinc-200">{r.module}</div>
            <div className="text-xs text-zinc-500">{r.where}{r.note ? ` · ${r.note}` : ""}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Coverage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Raport pokrycia architektury</h1>
        <p className="text-sm text-zinc-500">
          Porównanie dokumentacji architektury (2026-08-06) z obecnym systemem — bez duplikatów, jedna spójna architektura.
          Nawigacja: <Link to="/" className="text-emerald-400 hover:underline">Dashboard</Link>.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Moduły już istniejące" icon={Check} rows={EXISTS} cls="border-emerald-500/30 bg-emerald-500/5 text-emerald-300" />
        <Section title="Dodane w tej iteracji" icon={Plus} rows={ADDED} cls="border-sky-500/30 bg-sky-500/5 text-sky-300" />
        <Section title="Scalone (lepsza wersja)" icon={ArrowDownUp} rows={MERGED} cls="border-violet-500/30 bg-violet-500/5 text-violet-300" />
        <Section title="Wymagają dalszej implementacji" icon={Clock} rows={TODO} cls="border-amber-500/30 bg-amber-500/5 text-amber-300" />
      </div>
    </div>
  );
}
