import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parsuje liczbę z pola formularza — akceptuje kropkę i przecinek (iPhone/Android: "10,5").
 * Zwraca null dla pustego/niepoprawnego wpisu.
 */
export function parseNumInput(v: string): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
