/* Rejestr wersji produktu — licencje Bloody Turkey Enterprise */
export type Tier = "standard" | "advanced" | "professional" | "enterprise";

export type TierDef = {
  key: Tier;
  name: string;
  color: string;        // klasa tailwind dla akcentu
  badge: string;
  target: string;
  pricePln: number;     // miesięcznie, orientacyjnie
  features: string[];
  limitations: string[];
  /* ścieżki dostępne w tej wersji (prefiksy) */
  routes: string[];
};

const BASE_ROUTES = ["/", "/struktura", "/produkcja", "/obchod", "/transfery", "/harmonogram", "/zywienie", "/normy", "/magazyn", "/zdrowie", "/ekonomia", "/erp", "/erd", "/wersje", "/integracje", "/ubojnia"];
const ADVANCED_EXTRA = ["/analityka", "/laboratorium-zywienia", "/ai"];
const PRO_EXTRA = ["/centrum-decyzji"];

export const TIERS: TierDef[] = [
  {
    key: "standard",
    name: "Standard",
    color: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    target: "Małe i średnie gospodarstwa — prosty start",
    pricePln: 299,
    features: [
      "Dashboard Basic", "Stada i produkcja", "Żywienie i receptury", "Leczenie",
      "Magazyn", "Zakupy i sprzedaż", "Dokumenty", "Kalendarz i zadania",
      "Powiadomienia", "Raporty podstawowe",
    ],
    limitations: ["do 5 użytkowników", "jedna ferma", "brak AI", "brak IoT", "brak analiz predykcyjnych"],
    routes: BASE_ROUTES,
  },
  {
    key: "advanced",
    name: "Advanced",
    color: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    target: "Średnie i duże fermy — pełna analiza, AI wspomagające",
    pricePln: 899,
    features: [
      "Wszystko ze Standard", "AI Nutrition + AI Feed Advisor", "AI Health / AI Production",
      "Porównanie stad i ranking hal", "Analiza FCR, ADG, śmiertelności, receptur",
      "Silosy, partie, FIFO/FEFO", "Pełna ekonomika: ROI, marża, rentowność",
      "ERP: kontrahenci, faktury, zamówienia", "Role i uprawnienia użytkowników", "Logi audytowe",
    ],
    limitations: ["brak Digital Twin", "brak integracji IoT", "brak API Enterprise"],
    routes: [...BASE_ROUTES, ...ADVANCED_EXTRA],
  },
  {
    key: "professional",
    name: "Professional",
    color: "text-red-400",
    badge: "bg-red-500/15 text-red-400 border-red-500/40",
    target: "Flagowa wersja dla dużych ferm — pełna inteligencja",
    pricePln: 2490,
    features: [
      "Wszystko z Advanced", "AI Command Center — codzienny raport AI", "Digital Twin — cyfrowa kopia fermy",
      "IoT: komputery hali, wagi, silosy, czujniki, kamery", "Laboratory Intelligence",
      "Global Intelligence — ceny zbóż, energii, pogoda, waluty", "AI Weterynarz — analiza objawów",
      "AI Nutrition Intelligence — zamienniki i optymalizacja", "Executive Dashboard",
    ],
    limitations: ["jedna organizacja", "brak dedykowanego wdrożenia"],
    routes: [...BASE_ROUTES, ...ADVANCED_EXTRA, ...PRO_EXTRA],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    color: "text-zinc-100",
    badge: "bg-zinc-500/20 text-zinc-100 border-zinc-400/40",
    target: "Integratorzy i duzi producenci — wiele lokalizacji",
    pricePln: 0, // wycena indywidualna
    features: [
      "Wszystko z Professional", "Zarządzanie wieloma fermami i lokalizacjami",
      "Centralne centrum operacyjne", "Własne API Enterprise — integracje ERP/księgowość/wagi",
      "Raportowanie korporacyjne", "Konfiguracja pod klienta",
      "Wysoka dostępność, kopie zapasowe, monitoring", "Dedykowane wdrożenie i szkolenia",
    ],
    limitations: [],
    routes: [...BASE_ROUTES, ...ADVANCED_EXTRA, ...PRO_EXTRA],
  },
];

const TIER_KEY = "bt_tier";

export function getTier(): Tier {
  if (typeof window === "undefined") return "professional";
  return (localStorage.getItem(TIER_KEY) as Tier) ?? "professional";
}
export function setTier(t: Tier) {
  localStorage.setItem(TIER_KEY, t);
  window.location.reload();
}
export function tierDef(t?: Tier): TierDef {
  return TIERS.find((x) => x.key === (t ?? getTier())) ?? TIERS[2];
}
export function routeAllowed(pathname: string, t?: Tier): boolean {
  const def = tierDef(t);
  return def.routes.some((r) => (r === "/" ? pathname === "/" : pathname.startsWith(r)));
}
