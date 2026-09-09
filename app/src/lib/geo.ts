export const COUNTRIES: Record<string, { name: string; currency: string; flag: string }> = {
  PL: { name: "Polska", currency: "PLN", flag: "🇵🇱" },
  DE: { name: "Niemcy", currency: "EUR", flag: "🇩🇪" },
  FR: { name: "Francja", currency: "EUR", flag: "🇫🇷" },
  ES: { name: "Hiszpania", currency: "EUR", flag: "🇪🇸" },
  IT: { name: "Włochy", currency: "EUR", flag: "🇮🇹" },
  NL: { name: "Holandia", currency: "EUR", flag: "🇳🇱" },
  HU: { name: "Węgry", currency: "HUF", flag: "🇭🇺" },
  GB: { name: "Wlk. Brytania", currency: "GBP", flag: "🇬🇧" },
  DK: { name: "Dania", currency: "DKK", flag: "🇩🇰" },
  CZ: { name: "Czechy", currency: "CZK", flag: "🇨🇿" },
};

export const countryName = (code: string) => COUNTRIES[code]?.name ?? code;
export const countryFlag = (code: string) => COUNTRIES[code]?.flag ?? "🏳️";

export function fmtNum(n: number, digits = 0) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}
export function fmtKg(n: number) {
  return `${fmtNum(n, 2)} kg`;
}
export function fmtTons(n: number) {
  return `${fmtNum(n, 1)} t`;
}
export const EUR_PLN = 4.28;
export function fmtEur(n: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n * EUR_PLN);
}
export function fmtEur2(n: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n * EUR_PLN);
}
export function fmtPln(n: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);
}
export const num = (v: unknown): number => Number(v ?? 0);
