/**
 * DOMAIN DATA — kompletne dane hodowlane dla systemu BTE.
 * Używany przez: ensureIndykpolDemo() oraz seedStarterPack().
 * Zawiera: normy genetyczne, receptury, programy żywieniowe,
 * bibliotekę chorób, leki, dostawców, surowce paszowe.
 */
import { getDb } from "../api/queries/connection";
import * as s from "./schema";
import { eq, and, ne } from "drizzle-orm";

/* ═══════════════════════════════════════════════════════════════
   NORMY GENETYCZNE — 7 faz dla każdej linii
   ═══════════════════════════════════════════════════════════════ */

export const PHASE_KEYS = ["prestarter", "starter1", "starter2", "grower1", "grower2", "finisher1", "finisher2"] as const;

export interface NormPhase {
  phaseKey: typeof PHASE_KEYS[number];
  dayFrom: number; dayTo: number;
  proteinPct: number; energyKcal: number;
  lysinePct: number; methioninePct: number;
  feedPerBirdG: number; targetWeightG: number;
}

export interface GeneticLineDef {
  name: string; supplier: string;
  norms: NormPhase[];
}

export const GENETIC_LINES: GeneticLineDef[] = [
  {
    name: "B.U.T. BIG 6", supplier: "Aviagen Turkeys",
    norms: [
      { phaseKey: "prestarter", dayFrom: 0, dayTo: 7, proteinPct: 28.5, energyKcal: 2820, lysinePct: 1.75, methioninePct: 0.66, feedPerBirdG: 22, targetWeightG: 250 },
      { phaseKey: "starter1", dayFrom: 8, dayTo: 14, proteinPct: 27.5, energyKcal: 2880, lysinePct: 1.65, methioninePct: 0.63, feedPerBirdG: 55, targetWeightG: 500 },
      { phaseKey: "starter2", dayFrom: 15, dayTo: 21, proteinPct: 26.0, energyKcal: 2900, lysinePct: 1.55, methioninePct: 0.60, feedPerBirdG: 110, targetWeightG: 1100 },
      { phaseKey: "grower1", dayFrom: 22, dayTo: 56, proteinPct: 23.0, energyKcal: 2950, lysinePct: 1.32, methioninePct: 0.53, feedPerBirdG: 320, targetWeightG: 5200 },
      { phaseKey: "grower2", dayFrom: 57, dayTo: 84, proteinPct: 20.5, energyKcal: 3020, lysinePct: 1.12, methioninePct: 0.47, feedPerBirdG: 500, targetWeightG: 10800 },
      { phaseKey: "finisher1", dayFrom: 85, dayTo: 112, proteinPct: 18.0, energyKcal: 3080, lysinePct: 0.93, methioninePct: 0.41, feedPerBirdG: 650, targetWeightG: 17000 },
      { phaseKey: "finisher2", dayFrom: 113, dayTo: 140, proteinPct: 16.5, energyKcal: 3120, lysinePct: 0.80, methioninePct: 0.36, feedPerBirdG: 740, targetWeightG: 21000 },
    ],
  },
  {
    name: "B.U.T. 6", supplier: "Aviagen Turkeys",
    norms: [
      { phaseKey: "prestarter", dayFrom: 0, dayTo: 7, proteinPct: 28.5, energyKcal: 2820, lysinePct: 1.75, methioninePct: 0.66, feedPerBirdG: 21, targetWeightG: 240 },
      { phaseKey: "starter1", dayFrom: 8, dayTo: 14, proteinPct: 27.5, energyKcal: 2880, lysinePct: 1.65, methioninePct: 0.63, feedPerBirdG: 52, targetWeightG: 480 },
      { phaseKey: "starter2", dayFrom: 15, dayTo: 21, proteinPct: 26.0, energyKcal: 2900, lysinePct: 1.55, methioninePct: 0.60, feedPerBirdG: 105, targetWeightG: 1050 },
      { phaseKey: "grower1", dayFrom: 22, dayTo: 56, proteinPct: 22.5, energyKcal: 2950, lysinePct: 1.30, methioninePct: 0.52, feedPerBirdG: 300, targetWeightG: 5000 },
      { phaseKey: "grower2", dayFrom: 57, dayTo: 84, proteinPct: 20.0, energyKcal: 3020, lysinePct: 1.10, methioninePct: 0.46, feedPerBirdG: 470, targetWeightG: 10300 },
      { phaseKey: "finisher1", dayFrom: 85, dayTo: 112, proteinPct: 17.5, energyKcal: 3080, lysinePct: 0.90, methioninePct: 0.40, feedPerBirdG: 610, targetWeightG: 16200 },
      { phaseKey: "finisher2", dayFrom: 113, dayTo: 140, proteinPct: 16.0, energyKcal: 3120, lysinePct: 0.78, methioninePct: 0.35, feedPerBirdG: 700, targetWeightG: 19500 },
    ],
  },
  {
    name: "NICHOLAS", supplier: "Aviagen Turkeys",
    norms: [
      { phaseKey: "prestarter", dayFrom: 0, dayTo: 7, proteinPct: 29.0, energyKcal: 2800, lysinePct: 1.77, methioninePct: 0.67, feedPerBirdG: 22, targetWeightG: 245 },
      { phaseKey: "starter1", dayFrom: 8, dayTo: 14, proteinPct: 28.0, energyKcal: 2860, lysinePct: 1.67, methioninePct: 0.64, feedPerBirdG: 54, targetWeightG: 490 },
      { phaseKey: "starter2", dayFrom: 15, dayTo: 21, proteinPct: 26.5, energyKcal: 2880, lysinePct: 1.58, methioninePct: 0.61, feedPerBirdG: 108, targetWeightG: 1080 },
      { phaseKey: "grower1", dayFrom: 22, dayTo: 56, proteinPct: 23.0, energyKcal: 2940, lysinePct: 1.33, methioninePct: 0.54, feedPerBirdG: 310, targetWeightG: 5100 },
      { phaseKey: "grower2", dayFrom: 57, dayTo: 84, proteinPct: 20.5, energyKcal: 3010, lysinePct: 1.13, methioninePct: 0.47, feedPerBirdG: 485, targetWeightG: 10600 },
      { phaseKey: "finisher1", dayFrom: 85, dayTo: 112, proteinPct: 18.0, energyKcal: 3070, lysinePct: 0.94, methioninePct: 0.41, feedPerBirdG: 630, targetWeightG: 16600 },
      { phaseKey: "finisher2", dayFrom: 113, dayTo: 140, proteinPct: 16.5, energyKcal: 3110, lysinePct: 0.81, methioninePct: 0.36, feedPerBirdG: 720, targetWeightG: 20300 },
    ],
  },
  {
    name: "HYBRID CONVERTER", supplier: "Hybrid Turkeys",
    norms: [
      { phaseKey: "prestarter", dayFrom: 0, dayTo: 7, proteinPct: 28.0, energyKcal: 2830, lysinePct: 1.70, methioninePct: 0.64, feedPerBirdG: 21, targetWeightG: 235 },
      { phaseKey: "starter1", dayFrom: 8, dayTo: 14, proteinPct: 27.0, energyKcal: 2880, lysinePct: 1.60, methioninePct: 0.61, feedPerBirdG: 52, targetWeightG: 470 },
      { phaseKey: "starter2", dayFrom: 15, dayTo: 21, proteinPct: 25.5, energyKcal: 2900, lysinePct: 1.50, methioninePct: 0.58, feedPerBirdG: 104, targetWeightG: 1040 },
      { phaseKey: "grower1", dayFrom: 22, dayTo: 56, proteinPct: 22.5, energyKcal: 2950, lysinePct: 1.28, methioninePct: 0.51, feedPerBirdG: 300, targetWeightG: 4950 },
      { phaseKey: "grower2", dayFrom: 57, dayTo: 84, proteinPct: 20.0, energyKcal: 3020, lysinePct: 1.08, methioninePct: 0.45, feedPerBirdG: 465, targetWeightG: 10200 },
      { phaseKey: "finisher1", dayFrom: 85, dayTo: 112, proteinPct: 17.5, energyKcal: 3070, lysinePct: 0.88, methioninePct: 0.39, feedPerBirdG: 600, targetWeightG: 15900 },
      { phaseKey: "finisher2", dayFrom: 113, dayTo: 140, proteinPct: 16.0, energyKcal: 3120, lysinePct: 0.76, methioninePct: 0.34, feedPerBirdG: 680, targetWeightG: 19000 },
    ],
  },
  {
    name: "HYBRID GRADE MAKER", supplier: "Hybrid Turkeys",
    norms: [
      { phaseKey: "prestarter", dayFrom: 0, dayTo: 7, proteinPct: 28.5, energyKcal: 2810, lysinePct: 1.73, methioninePct: 0.65, feedPerBirdG: 22, targetWeightG: 242 },
      { phaseKey: "starter1", dayFrom: 8, dayTo: 14, proteinPct: 27.5, energyKcal: 2870, lysinePct: 1.63, methioninePct: 0.62, feedPerBirdG: 53, targetWeightG: 485 },
      { phaseKey: "starter2", dayFrom: 15, dayTo: 21, proteinPct: 26.0, energyKcal: 2890, lysinePct: 1.54, methioninePct: 0.59, feedPerBirdG: 106, targetWeightG: 1060 },
      { phaseKey: "grower1", dayFrom: 22, dayTo: 56, proteinPct: 23.0, energyKcal: 2945, lysinePct: 1.31, methioninePct: 0.53, feedPerBirdG: 305, targetWeightG: 5050 },
      { phaseKey: "grower2", dayFrom: 57, dayTo: 84, proteinPct: 20.0, energyKcal: 3015, lysinePct: 1.11, methioninePct: 0.46, feedPerBirdG: 475, targetWeightG: 10450 },
      { phaseKey: "finisher1", dayFrom: 85, dayTo: 112, proteinPct: 18.0, energyKcal: 3075, lysinePct: 0.92, methioninePct: 0.40, feedPerBirdG: 620, targetWeightG: 16400 },
      { phaseKey: "finisher2", dayFrom: 113, dayTo: 140, proteinPct: 16.5, energyKcal: 3115, lysinePct: 0.79, methioninePct: 0.35, feedPerBirdG: 710, targetWeightG: 19900 },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   SUROWCE PASZOWE — pełne karty z rozszerzonymi parametrami
   ═══════════════════════════════════════════════════════════════ */

export interface IngredientDef {
  name: string; countryCode: string; pricePerTon: number; currency: string;
  proteinPct: number; energyKcal: number;
  lysinePct: number; methioninePct: number;
  fiberPct: number; fatPct: number;
  calciumPct: number; phosphorusPct: number;
  stockTons: number;
  moisturePct?: number; ashPct?: number; starchPct?: number;
  cystinePct?: number; threoninePct?: number; tryptophanPct?: number;
  argininePct?: number; sodiumPct?: number;
  code?: string; producer?: string;
}

export const FEED_INGREDIENTS: IngredientDef[] = [
  { name: "Pszenica", countryCode: "PL", pricePerTon: 205, currency: "EUR", proteinPct: 12.5, energyKcal: 3150, lysinePct: 0.35, methioninePct: 0.18, fiberPct: 2.5, fatPct: 1.8, calciumPct: 0.05, phosphorusPct: 0.32, stockTons: 420, moisturePct: 13, ashPct: 1.8, starchPct: 60, cystinePct: 0.25, threoninePct: 0.33, tryptophanPct: 0.15, argininePct: 0.62, sodiumPct: 0.02, code: "PSZ-PL-01", producer: "Krajowe zbiory" },
  { name: "Kukurydza", countryCode: "HU", pricePerTon: 198, currency: "EUR", proteinPct: 8.5, energyKcal: 3350, lysinePct: 0.24, methioninePct: 0.18, fiberPct: 2.2, fatPct: 3.9, calciumPct: 0.02, phosphorusPct: 0.27, stockTons: 380, moisturePct: 13.5, ashPct: 1.3, starchPct: 65, cystinePct: 0.2, threoninePct: 0.3, tryptophanPct: 0.07, argininePct: 0.42, sodiumPct: 0.01, code: "KUK-HU-01", producer: "Dunakeszi Agro" },
  { name: "Jęczmień", countryCode: "DE", pricePerTon: 185, currency: "EUR", proteinPct: 11.0, energyKcal: 3000, lysinePct: 0.38, methioninePct: 0.18, fiberPct: 4.5, fatPct: 2.1, calciumPct: 0.06, phosphorusPct: 0.35, stockTons: 250, moisturePct: 13, ashPct: 2.4, starchPct: 52, cystinePct: 0.28, threoninePct: 0.36, tryptophanPct: 0.16, argininePct: 0.55, sodiumPct: 0.03, code: "JEC-DE-01", producer: "BayWa" },
  { name: "Śruta sojowa 48%", countryCode: "NL", pricePerTon: 412, currency: "EUR", proteinPct: 48.0, energyKcal: 2450, lysinePct: 2.9, methioninePct: 0.65, fiberPct: 3.5, fatPct: 1.5, calciumPct: 0.3, phosphorusPct: 0.65, stockTons: 210, moisturePct: 12, ashPct: 6.2, starchPct: 5, cystinePct: 0.72, threoninePct: 1.88, tryptophanPct: 0.65, argininePct: 3.5, sodiumPct: 0.03, code: "SOJ-NL-48", producer: "Cargill NL" },
  { name: "Śruta rzepakowa", countryCode: "PL", pricePerTon: 295, currency: "EUR", proteinPct: 36.0, energyKcal: 2000, lysinePct: 2.0, methioninePct: 0.7, fiberPct: 11.5, fatPct: 2.5, calciumPct: 0.65, phosphorusPct: 1.05, stockTons: 160, moisturePct: 11, ashPct: 7, starchPct: 3, cystinePct: 0.85, threoninePct: 1.6, tryptophanPct: 0.45, argininePct: 2.1, sodiumPct: 0.05, code: "RZE-PL-01", producer: "Kruszwica" },
  { name: "Groszek żółty", countryCode: "FR", pricePerTon: 285, currency: "EUR", proteinPct: 22.5, energyKcal: 3050, lysinePct: 1.6, methioninePct: 0.22, fiberPct: 5.5, fatPct: 1.4, calciumPct: 0.12, phosphorusPct: 0.42, stockTons: 120 },
  { name: "Olej sojowy", countryCode: "NL", pricePerTon: 890, currency: "EUR", proteinPct: 0, energyKcal: 8800, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 99.5, calciumPct: 0, phosphorusPct: 0, stockTons: 80, moisturePct: 0.3, ashPct: 0, starchPct: 0, code: "OLE-NL-01", producer: "Bunge" },
  { name: "L-lizyna 98%", countryCode: "CN", pricePerTon: 1450, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 98.0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 15 },
  { name: "DL-metionina 99%", countryCode: "CN", pricePerTon: 3200, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 99.0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 8 },
  { name: "Wapń węglanowy", countryCode: "PL", pricePerTon: 85, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 38.0, phosphorusPct: 0, stockTons: 120, moisturePct: 0.2, ashPct: 96, code: "WAP-PL-01", producer: "Górażdże" },
  { name: "Premix mineralny 1%", countryCode: "PL", pricePerTon: 2850, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 12.0, phosphorusPct: 6.0, stockTons: 10, moisturePct: 6, ashPct: 60, code: "PRX-DK-01", producer: "DSM Nutritional" },
  { name: "DDGS kukurydziany", countryCode: "PL", pricePerTon: 265, currency: "EUR", proteinPct: 27, energyKcal: 2900, lysinePct: 0.62, methioninePct: 0.52, fiberPct: 8.5, fatPct: 9.0, calciumPct: 0.05, phosphorusPct: 0.75, stockTons: 40, moisturePct: 10, ashPct: 4.5, starchPct: 6, code: "DDG-PL-01", producer: "Bioagra" },
  { name: "Śruta słonecznikowa", countryCode: "UA", pricePerTon: 240, currency: "EUR", proteinPct: 34, energyKcal: 2100, lysinePct: 1.15, methioninePct: 0.7, fiberPct: 18.0, fatPct: 2.0, calciumPct: 0.35, phosphorusPct: 1.0, stockTons: 25 },
  { name: "Otręby pszenne", countryCode: "PL", pricePerTon: 150, currency: "EUR", proteinPct: 15.5, energyKcal: 1750, lysinePct: 0.55, methioninePct: 0.2, fiberPct: 11.0, fatPct: 4.0, calciumPct: 0.12, phosphorusPct: 1.15, stockTons: 60, moisturePct: 13, ashPct: 5.5, starchPct: 18, code: "OTR-PL-01", producer: "Młyny Polskie" },
  { name: "Mączka rybna 65%", countryCode: "DK", pricePerTon: 1350, currency: "EUR", proteinPct: 65, energyKcal: 3100, lysinePct: 4.9, methioninePct: 1.9, fiberPct: 0.5, fatPct: 9.0, calciumPct: 4.5, phosphorusPct: 2.6, stockTons: 8, moisturePct: 9, ashPct: 18, code: "RYB-DK-65", producer: "TripleNine" },
  { name: "Mączka mięsno-kostna", countryCode: "PL", pricePerTon: 520, currency: "EUR", proteinPct: 50, energyKcal: 2400, lysinePct: 2.6, methioninePct: 0.7, fiberPct: 2.0, fatPct: 11.0, calciumPct: 8.5, phosphorusPct: 4.2, stockTons: 15 },
  { name: "Sól jodowana", countryCode: "PL", pricePerTon: 95, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 100 },
  { name: "Soda oczyszczona", countryCode: "PL", pricePerTon: 240, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 40 },
  { name: "Fitaza (enzym)", countryCode: "DK", pricePerTon: 4200, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 5 },
  { name: "Ksylanaza (enzym)", countryCode: "FI", pricePerTon: 3800, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 4 },
  { name: "L-treonina", countryCode: "CN", pricePerTon: 1850, currency: "EUR", proteinPct: 72, energyKcal: 4200, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 7 },
  { name: "L-tryptofan", countryCode: "CN", pricePerTon: 9800, currency: "EUR", proteinPct: 82, energyKcal: 4300, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 2 },
  { name: "Cholina chloride 60%", countryCode: "PL", pricePerTon: 980, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 12 },
  { name: "Witamina E 50%", countryCode: "CH", pricePerTon: 6400, currency: "EUR", proteinPct: 0, energyKcal: 0, lysinePct: 0, methioninePct: 0, fiberPct: 0, fatPct: 0, calciumPct: 0, phosphorusPct: 0, stockTons: 3 },
];

/* ═══════════════════════════════════════════════════════════════
   RECEPTURY — 3 receptury zoptymalizowane per faza
   ═══════════════════════════════════════════════════════════════ */

export interface RecipeDef {
  name: string; ageGroup: string; strategy: "cheapest" | "maxGrowth" | "balanced";
  costPerTon: number; proteinPct: number; energyKcal: number; lysinePct: number;
  explanation: string;
  items: { ingredientName: string; percent: number }[];
}

export const RECIPES: RecipeDef[] = [
  {
    name: "Starter OptiCost", ageGroup: "0–4 tyg.", strategy: "cheapest",
    costPerTon: 348.2, proteinPct: 27.2, energyKcal: 2870, lysinePct: 1.62,
    explanation: "Zwiększono udział śruty rzepakowej (tańsze białko niż soja) oraz dodano L-lizynę — poziom lizyny spadł poniżej normy 1.60% dla 3. tygodnia.",
    items: [
      { ingredientName: "Pszenica", percent: 38 },
      { ingredientName: "Kukurydza", percent: 12 },
      { ingredientName: "Śruta sojowa 48%", percent: 32 },
      { ingredientName: "Śruta rzepakowa", percent: 8 },
      { ingredientName: "Olej sojowy", percent: 4.5 },
      { ingredientName: "L-lizyna 98%", percent: 0.4 },
      { ingredientName: "DL-metionina 99%", percent: 0.35 },
      { ingredientName: "Wapń węglanowy", percent: 1.8 },
      { ingredientName: "Premix mineralny 1%", percent: 2.5 },
    ],
  },
  {
    name: "Grower MaxADG", ageGroup: "5–9 tyg.", strategy: "maxGrowth",
    costPerTon: 372.6, proteinPct: 24.8, energyKcal: 3030, lysinePct: 1.48,
    explanation: "Maksymalizacja przyrostu: podniesiono energię tłuszczem i zwiększono gęstość aminokwasów zgodnie z normą Hybrid Converter dla 7. tygodnia.",
    items: [
      { ingredientName: "Kukurydza", percent: 44 },
      { ingredientName: "Pszenica", percent: 12 },
      { ingredientName: "Śruta sojowa 48%", percent: 30 },
      { ingredientName: "Olej sojowy", percent: 6.5 },
      { ingredientName: "L-lizyna 98%", percent: 0.45 },
      { ingredientName: "DL-metionina 99%", percent: 0.4 },
      { ingredientName: "Wapń węglanowy", percent: 1.7 },
      { ingredientName: "Premix mineralny 1%", percent: 2.5 },
    ],
  },
  {
    name: "Finisher Balanced", ageGroup: "10–15 tyg.", strategy: "balanced",
    costPerTon: 331.4, proteinPct: 20.1, energyKcal: 3180, lysinePct: 1.12,
    explanation: "Kompromis koszt/wynik: część śruty sojowej zastąpiono groszkiem i śrutą rzepakową, relacja lizyna:energia 0.35 g/Mcal. Oszczędność 8.4 EUR/t.",
    items: [
      { ingredientName: "Pszenica", percent: 46 },
      { ingredientName: "Kukurydza", percent: 18 },
      { ingredientName: "Śruta sojowa 48%", percent: 18 },
      { ingredientName: "Śruta rzepakowa", percent: 6 },
      { ingredientName: "Olej sojowy", percent: 6 },
      { ingredientName: "L-lizyna 98%", percent: 0.3 },
      { ingredientName: "DL-metionina 99%", percent: 0.28 },
      { ingredientName: "Wapń węglanowy", percent: 1.6 },
      { ingredientName: "Premix mineralny 1%", percent: 2.5 },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   PROGRAMY ŻYWIENIOWE — standardowe programy dla indorów i indyczek
   ═══════════════════════════════════════════════════════════════ */

export interface FeedProgramDef {
  name: string; sex: "toms" | "hens";
  stages: { name: string; dayFrom: number; dayTo: number; recipeName: string; proteinTargetPct: number; feedPerBirdG: number }[];
}

export const FEED_PROGRAMS: FeedProgramDef[] = [
  {
    name: "Program standardowy — indory (Hybrid)", sex: "toms",
    stages: [
      { name: "Starter", dayFrom: 0, dayTo: 28, recipeName: "Starter OptiCost", proteinTargetPct: 27.5, feedPerBirdG: 60 },
      { name: "Grower I", dayFrom: 29, dayTo: 56, recipeName: "Grower MaxADG", proteinTargetPct: 24.5, feedPerBirdG: 220 },
      { name: "Grower II", dayFrom: 57, dayTo: 77, recipeName: "Grower MaxADG", proteinTargetPct: 22.0, feedPerBirdG: 380 },
      { name: "Finisher I", dayFrom: 78, dayTo: 105, recipeName: "Finisher Balanced", proteinTargetPct: 20.0, feedPerBirdG: 520 },
      { name: "Finisher II", dayFrom: 106, dayTo: 140, recipeName: "Finisher Balanced", proteinTargetPct: 17.5, feedPerBirdG: 620 },
    ],
  },
  {
    name: "Program standardowy — indyczki", sex: "hens",
    stages: [
      { name: "Starter", dayFrom: 0, dayTo: 28, recipeName: "Starter OptiCost", proteinTargetPct: 27.5, feedPerBirdG: 55 },
      { name: "Grower", dayFrom: 29, dayTo: 63, recipeName: "Grower MaxADG", proteinTargetPct: 23.0, feedPerBirdG: 240 },
      { name: "Finisher", dayFrom: 64, dayTo: 112, recipeName: "Finisher Balanced", proteinTargetPct: 18.5, feedPerBirdG: 430 },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   BIBLIOTEKA CHORÓB — słownik chorób indyczych
   ═══════════════════════════════════════════════════════════════ */

export interface DiseaseDef {
  name: string; latinName: string; category: "viral" | "bacterial" | "parasitic" | "metabolic" | "fungal" | "other";
  symptoms: string; diagnosis: string; treatmentProtocol: string; prevention: string;
  severity: "low" | "medium" | "high" | "critical";
}

export const DISEASES: DiseaseDef[] = [
  { name: "Newcastle Disease (ND)", latinName: "Pseudoavian pest", category: "viral", symptoms: "Apatia, zielonkawe odchody, objawy nerwowe, spadek nieśności/przyrostów", diagnosis: "Serologia HI, PCR z krtani", treatmentProtocol: "Szczepienia profilaktyczne; brak leczenia przyczynowego — terapia wspomagająca", prevention: "Program szczepień ND, bioasekuracja, kontrola kontaktu z ptactwem dzikim", severity: "critical" },
  { name: "Ornithobacteriosis (ORT)", latinName: "Ornithobacterium rhinotracheale", category: "bacterial", symptoms: "Kichanie, obrzęk zatok, spadek pobrania paszy, pogorszenie FCR", diagnosis: "Wymaz z krtani PCR, posiew", treatmentProtocol: "Doksycyklina lub amoksycylina wg antybiogramu", prevention: "Wentylacja, niski NH3, kontrola gęstości", severity: "high" },
  { name: "Kokcydioza", latinName: "Eimeria spp.", category: "parasitic", symptoms: "Wodniste odchody, śluz, krew w odchodach, spadek przyrostów", diagnosis: "Badanie kału na oocysty, sekcja jelit", treatmentProtocol: "Toltrazuril w wodzie 2 dni", prevention: "Sucha ściółka, kokcydiostatyki w paszy, rotacja", severity: "high" },
  { name: "Aspergillosis", latinName: "Aspergillus fumigatus", category: "fungal", symptoms: "Duszność, wzrost śmiertelności w odchowie", diagnosis: "Sekcja — grudki w pęcherzach powietrznych, posiew", treatmentProtocol: "Usunięcie źródła pleśni; itrakonazol wspomagająco", prevention: "Jakość ściółki i paszy, kontrola wilgotności", severity: "medium" },
  { name: "Zespół dyspepsji / dysbakterioza", latinName: "—", category: "metabolic", symptoms: "Niestrawiona pasza w odchodach, mokra ściółka, nierównomierność stada", diagnosis: "Ocena kału, analiza receptury", treatmentProtocol: "Probiotyki, kwasy organiczne, korekta paszy", prevention: "Jakość tłuszczu i włókna, higiena pojenia", severity: "medium" },
  { name: "Grypa ptaków (HPAI)", latinName: "Influenza A H5/H7", category: "viral", symptoms: "Nagłe upadki, sinica, krwotoczki, objawy nerwowe", diagnosis: "RT-PCR w PIWet — choroba obowiązkowa", treatmentProtocol: "Brak — utylizacja stada wg procedur PIW", prevention: "Strefa ochronna, monitoring dzikiego ptactwa", severity: "critical" },
  { name: "Borelioza (spirochetosis)", latinName: "Borrelia anserina", category: "bacterial", symptoms: "Wysoka gorączka, zielonkawe odchody, spadek pobrania", diagnosis: "Rozmaz krwi, serologia", treatmentProtocol: "Penicylina lub tetracykliny", prevention: "Kontrola kleszczy i roztoczy", severity: "high" },
  { name: "Pastereloza", latinName: "Pasteurella multocida", category: "bacterial", symptoms: "Nagłe padnięcia, sinica, zapalenie pęcherzy powietrznych", diagnosis: "Posiew z serca/wątroby", treatmentProtocol: "Antybiotyki wg wrażliwości", prevention: "Stres minimalny, wentylacja, szczepienia", severity: "high" },
  { name: "Enteritis nekrotoksyczny", latinName: "Clostridium perfringens", category: "bacterial", symptoms: "Wodniste odchody, śluz, spadek przyrostów, wilgotna ściółka", diagnosis: "Sekcja — nekrozy jelit, toksyna w kału", treatmentProtocol: "Antybiotyki, probiotiki, korekta paszy", prevention: "Jakość paszy, kontrola wilgotności ściółki", severity: "medium" },
  { name: "Niedobór witaminy E / selenu", latinName: "Encephalomalacia", category: "metabolic", symptoms: "Zaburzenia nerwowe, opadanie skrzydeł, niezborność", diagnosis: "Analiza paszy, poziom wit. E w surowicy", treatmentProtocol: "Suplementacja wit. E + Se", prevention: "Premix z wit. E i selenem", severity: "medium" },
];

/* ═══════════════════════════════════════════════════════════════
   LEKI I KARENCJE
   ═══════════════════════════════════════════════════════════════ */

export interface MedicineDef {
  name: string; substance: string; form: string; stockQty: number; unit: string;
  minStock: number; pricePerUnit: number; withdrawalDays: number;
}

export const MEDICINES: MedicineDef[] = [
  { name: "Doksycyklina 50%", substance: "Doksycyklina hyclate", form: "roztwór do picia", stockQty: 5000, unit: "ml", minStock: 1000, pricePerUnit: 0.12, withdrawalDays: 14 },
  { name: "Amoksycylina 15%", substance: "Amoksycylina trihydrate", form: "roztwór do picia", stockQty: 3000, unit: "ml", minStock: 500, pricePerUnit: 0.18, withdrawalDays: 7 },
  { name: "Toltrazuril 2.5%", substance: "Toltrazuril", form: "roztwór do picia", stockQty: 2000, unit: "ml", minStock: 400, pricePerUnit: 0.35, withdrawalDays: 14 },
  { name: "Tiamulina 45%", substance: "Tiamulin hydrogen fumarate", form: "roztwór do picia", stockQty: 1500, unit: "ml", minStock: 300, pricePerUnit: 0.42, withdrawalDays: 7 },
  { name: "Enrofloxacyna 10%", substance: "Enrofloxacin", form: "roztwór do picia", stockQty: 1000, unit: "ml", minStock: 200, pricePerUnit: 0.55, withdrawalDays: 14 },
  { name: "Witamina E + Se", substance: "Alfa-tokoferol + selen", form: "roztwór do injekcji", stockQty: 500, unit: "ml", minStock: 100, pricePerUnit: 0.85, withdrawalDays: 0 },
  { name: "Probiotyk Enterococcus", substance: "Enterococcus faecium", form: "proszek do picia", stockQty: 2000, unit: "g", minStock: 500, pricePerUnit: 0.08, withdrawalDays: 0 },
  { name: "Kwas cytrynowy", substance: "Kwas cytrynowy", form: "proszek do picia", stockQty: 5000, unit: "g", minStock: 1000, pricePerUnit: 0.02, withdrawalDays: 0 },
];

/* ═══════════════════════════════════════════════════════════════
   DOSTAWCY
   ═══════════════════════════════════════════════════════════════ */

export interface SupplierDef {
  name: string; category: "feed" | "chicks" | "medicine" | "equipment" | "other"; countryCode: string;
}

export const SUPPLIERS: SupplierDef[] = [
  { name: "Wipasz S.A.", category: "feed", countryCode: "PL" },
  { name: "Cargill Polska", category: "feed", countryCode: "PL" },
  { name: "De Heus", category: "feed", countryCode: "NL" },
  { name: "Grelavi S.A.", category: "chicks", countryCode: "FR" },
  { name: "Aviagen Turkeys", category: "chicks", countryCode: "GB" },
  { name: "Hybrid Turkeys", category: "chicks", countryCode: "CA" },
  { name: "Ceva Santé Animale", category: "medicine", countryCode: "FR" },
  { name: "Zoetis Polska", category: "medicine", countryCode: "PL" },
  { name: "Big Dutchman", category: "equipment", countryCode: "DE" },
  { name: "Sano Polska", category: "equipment", countryCode: "PL" },
];

/* ═══════════════════════════════════════════════════════════════
   FUNKCJE SEEDUJĄCE
   ═══════════════════════════════════════════════════════════════ */

/** Sprawdza czy firma ma już dane domenowe (linie genetyczne z normami) */
export async function hasDomainData(companyId: number): Promise<boolean> {
  const db = getDb();
  const lines = await db.select().from(s.geneticLines)
    .where(and(eq(s.geneticLines.companyId, companyId), ne(s.geneticLines.status, "archived")));
  return lines.length > 0;
}

/** Seeduje wszystkie dane domenowe dla firmy — idempotentny */
export async function seedDomainData(companyId: number): Promise<void> {
  const db = getDb();

  if (await hasDomainData(companyId)) {
    console.log(`Firma ${companyId} ma już dane domenowe — pomijam.`);
    return;
  }

  console.log(`Seeduję dane domenowe dla firmy ${companyId}...`);

  // 1. Linie genetyczne + normy
  const lineIdMap = new Map<string, number>();
  for (const line of GENETIC_LINES) {
    const [{ id }] = await db.insert(s.geneticLines).values({
      companyId, name: line.name, supplier: line.supplier,
      notes: "Linia startowa z normami otwartymi — edytuj wg zaleceń dostawcy",
    }).$returningId();
    lineIdMap.set(line.name, id);

    for (const norm of line.norms) {
      await db.insert(s.geneticLineNorms).values({
        geneticLineId: id, phaseKey: norm.phaseKey,
        dayFrom: norm.dayFrom, dayTo: norm.dayTo,
        proteinPct: norm.proteinPct.toFixed(2), energyKcal: norm.energyKcal,
        lysinePct: norm.lysinePct.toFixed(3), methioninePct: norm.methioninePct.toFixed(3),
        feedPerBirdG: norm.feedPerBirdG, targetWeightG: norm.targetWeightG,
      });
    }
  }
  console.log(`  ✓ ${GENETIC_LINES.length} linii genetycznych z normami`);

  // 2. Surowce paszowe
  const ingIdMap = new Map<string, number>();
  for (const ing of FEED_INGREDIENTS) {
    const [{ id }] = await db.insert(s.feedIngredients).values({
      companyId, name: ing.name, countryCode: ing.countryCode,
      pricePerTon: ing.pricePerTon.toFixed(2), currency: ing.currency,
      proteinPct: ing.proteinPct.toFixed(2), energyKcal: ing.energyKcal,
      lysinePct: ing.lysinePct.toFixed(3), methioninePct: ing.methioninePct.toFixed(3),
      fiberPct: ing.fiberPct.toFixed(2), fatPct: ing.fatPct.toFixed(2),
      calciumPct: ing.calciumPct.toFixed(2), phosphorusPct: ing.phosphorusPct.toFixed(2),
      stockTons: ing.stockTons.toFixed(2),
      ...(ing.moisturePct ? { moisturePct: ing.moisturePct.toFixed(2) } : {}),
      ...(ing.ashPct ? { ashPct: ing.ashPct.toFixed(2) } : {}),
      ...(ing.starchPct ? { starchPct: ing.starchPct.toFixed(2) } : {}),
      ...(ing.cystinePct ? { cystinePct: ing.cystinePct.toFixed(3) } : {}),
      ...(ing.threoninePct ? { threoninePct: ing.threoninePct.toFixed(3) } : {}),
      ...(ing.tryptophanPct ? { tryptophanPct: ing.tryptophanPct.toFixed(3) } : {}),
      ...(ing.argininePct ? { argininePct: ing.argininePct.toFixed(3) } : {}),
      ...(ing.sodiumPct ? { sodiumPct: ing.sodiumPct.toFixed(3) } : {}),
    }).$returningId();
    ingIdMap.set(ing.name, id);
  }
  console.log(`  ✓ ${FEED_INGREDIENTS.length} surowców paszowych`);

  // 3. Receptury
  const recipeIdMap = new Map<string, number>();
  for (const r of RECIPES) {
    const [{ id }] = await db.insert(s.recipes).values({
      companyId, name: r.name, ageGroup: r.ageGroup, strategy: r.strategy,
      costPerTon: r.costPerTon.toFixed(2), proteinPct: r.proteinPct.toFixed(2),
      energyKcal: r.energyKcal, lysinePct: r.lysinePct.toFixed(3),
      explanation: r.explanation,
    }).$returningId();
    recipeIdMap.set(r.name, id);

    for (const item of r.items) {
      const ingId = ingIdMap.get(item.ingredientName);
      if (ingId) {
        await db.insert(s.recipeItems).values({
          recipeId: id, ingredientId: ingId, percent: item.percent.toFixed(2),
        });
      }
    }
  }
  console.log(`  ✓ ${RECIPES.length} receptur`);

  // 4. Programy żywieniowe
  for (const prog of FEED_PROGRAMS) {
    const [{ id: progId }] = await db.insert(s.feedPrograms).values({
      companyId, name: prog.name, sex: prog.sex,
    }).$returningId();

    for (const stage of prog.stages) {
      const recipeId = recipeIdMap.get(stage.recipeName);
      await db.insert(s.feedProgramStages).values({
        programId: progId, name: stage.name,
        dayFrom: stage.dayFrom, dayTo: stage.dayTo,
        recipeId: recipeId ?? null,
        proteinTargetPct: stage.proteinTargetPct.toFixed(2),
        feedPerBirdG: stage.feedPerBirdG,
      });
    }
  }
  console.log(`  ✓ ${FEED_PROGRAMS.length} programów żywieniowych`);

  // 5. Biblioteka chorób (globalna — bez companyId)
  const existingDiseases = await db.select().from(s.diseases);
  if (existingDiseases.length === 0) {
    for (const d of DISEASES) {
      await db.insert(s.diseases).values(d);
    }
    console.log(`  ✓ ${DISEASES.length} chorób w bibliotece`);
  }

  // 6. Leki
  for (const m of MEDICINES) {
    await db.insert(s.medicines).values({
      companyId, name: m.name, substance: m.substance, form: m.form,
      stockQty: m.stockQty.toFixed(2), unit: m.unit,
      minStock: m.minStock.toFixed(2), pricePerUnit: m.pricePerUnit.toFixed(2),
    });
  }
  console.log(`  ✓ ${MEDICINES.length} leków`);

  // 7. Dostawcy
  for (const sup of SUPPLIERS) {
    await db.insert(s.suppliers).values({
      companyId, name: sup.name, category: sup.category, countryCode: sup.countryCode,
    });
  }
  console.log(`  ✓ ${SUPPLIERS.length} dostawców`);

  console.log(`Dane domenowe dla firmy ${companyId} gotowe.`);
}
