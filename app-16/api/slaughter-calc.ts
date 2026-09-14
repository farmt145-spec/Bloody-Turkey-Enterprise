/**
 * KALKULACJE UBOJU — osobny moduł obliczeniowy (bez UI).
 * Wydajność, rozliczenia, pełna ekonomika partii ubojowej, plan vs rzeczywistość,
 * PEŁNY ŁAŃCUCH KOSZTÓW od pisklaka do kg tuszki.
 * Wszystkie funkcje czyste — testowalne jednostkowo.
 */

/** Wydajność uboju [%] = masa tuszek / masa żywa × 100. Zwraca 0 przy braku masy żywa. */
export function computeYieldPct(carcassWeightKg: number, liveWeightKg: number): number {
  if (liveWeightKg <= 0) return 0;
  return Number(((carcassWeightKg / liveWeightKg) * 100).toFixed(2));
}

/** Kwoty rozliczenia: brutto = masa tuszek × cena; netto = brutto + premie − potrącenia. */
export function computeSettlement(input: {
  carcassWeightKg: number;
  pricePerKg: number;
  bonuses?: number;
  deductions?: number;
}): { grossAmount: number; netAmount: number } {
  const gross = input.carcassWeightKg * input.pricePerKg;
  const net = gross + (input.bonuses ?? 0) - (input.deductions ?? 0);
  return { grossAmount: Number(gross.toFixed(2)), netAmount: Number(net.toFixed(2)) };
}

/** Kod partii ubojowej: UB-RRRR-NNNNNN (numeracja roczna). */
export function nextSlaughterCode(year: number, seq: number): string {
  return `UB-${year}-${String(seq).padStart(6, "0")}`;
}

/** Plan vs rzeczywistość. */
export function planVsReality(input: {
  plannedDate: string; plannedCount: number; targetAvgWeightKg: number | null;
  actualCount: number | null; liveWeightKg: number | null; carcassWeightKg: number | null;
  yieldPct: number | null; slaughteredAt: Date | null;
}) {
  const avgLiveKg = input.actualCount && input.liveWeightKg && input.actualCount > 0
    ? input.liveWeightKg / input.actualCount : null;
  return {
    countDiff: input.actualCount != null ? input.actualCount - input.plannedCount : null,
    countPct: input.plannedCount > 0 && input.actualCount != null
      ? Number(((input.actualCount / input.plannedCount) * 100).toFixed(1)) : null,
    avgLiveWeightKg: avgLiveKg != null ? Number(avgLiveKg.toFixed(3)) : null,
    weightTargetDiff: input.targetAvgWeightKg != null && avgLiveKg != null
      ? Number((avgLiveKg - input.targetAvgWeightKg).toFixed(3)) : null,
    yieldPct: input.yieldPct,
    daysVsPlan: input.slaughteredAt
      ? Math.round((input.slaughteredAt.getTime() - new Date(input.plannedDate).getTime()) / 86400000)
      : null,
  };
}

/** Podstawowa ekonomika partii ubojowej. */
export function computeEconomics(input: {
  initialCount: number;
  chickPrice: number;
  feedKg: number;
  feedPricePerTon: number;
  transportCost: number;
  otherCosts?: number;
  revenueNet: number | null;
  liveWeightKg: number | null;
}) {
  const chickCost = input.initialCount * input.chickPrice;
  const feedCost = (input.feedKg / 1000) * input.feedPricePerTon;
  const otherCosts = input.otherCosts ?? 0;
  const totalCost = chickCost + feedCost + input.transportCost + otherCosts;
  const revenue = input.revenueNet ?? 0;
  const margin = revenue - totalCost;
  const roiPct = totalCost > 0 && input.revenueNet != null ? (margin / totalCost) * 100 : null;
  const costPerKgLive = input.liveWeightKg && input.liveWeightKg > 0 ? totalCost / input.liveWeightKg : null;
  return {
    chickCost: Number(chickCost.toFixed(2)),
    feedCost: Number(feedCost.toFixed(2)),
    transportCost: Number(input.transportCost.toFixed(2)),
    otherCosts: Number(otherCosts.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    revenueNet: input.revenueNet,
    margin: input.revenueNet != null ? Number(margin.toFixed(2)) : null,
    roiPct: roiPct != null ? Number(roiPct.toFixed(1)) : null,
    costPerKgLive: costPerKgLive != null ? Number(costPerKgLive.toFixed(2)) : null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   PEŁNY ŁAŃCUCH KOSZTÓW — od pisklaka do kg tuszki
   ═══════════════════════════════════════════════════════════════ */

export interface CostBreakdownItem {
  category: string;
  label: string;
  amount: number;
  percentOfTotal: number;
  costPerKgLive: number;
  costPerKgCarcass: number;
}

export interface FullCostChain {
  // Dane wejściowe
  initialCount: number;
  currentCount: number;
  soldCount: number;
  deadCount: number;
  chickPrice: number;
  liveWeightKg: number;
  carcassWeightKg: number;
  yieldPct: number;

  // Koszty szczegółowe
  costs: {
    chicks: number;
    feed: number;
    vet: number;
    energy: number;
    litter: number;
    labor: number;
    transport: number;
    slaughter: number;    // koszt uboju (opłata zakładu)
    other: number;
    total: number;
  };

  // Rozbicie per kategoria
  breakdown: CostBreakdownItem[];

  // Wskaźniki końcowe
  costPerKgLive: number;
  costPerKgCarcass: number;
  costPerBird: number;
  revenueNet: number | null;
  margin: number | null;
  marginPct: number | null;

  // Porównanie z normą/wartością rynkową
  pricePerKgLive: number | null;
  pricePerKgCarcass: number | null;

  // FCR i efektywność
  fcr: number | null;
  epef: number | null;  // European Production Efficiency Factor

  // Waluta
  currency: string;
}

/**
 * Oblicza PEŁNY łańcuch kosztów od pisklaka do kg tuszki.
 * 
 * @param input - dane rzutu, koszty, wynik uboju
 * @returns FullCostChain - kompletny rozbiór kosztów
 */
export function computeFullCostChain(input: {
  // Dane rzutu
  initialCount: number;
  currentCount: number;
  soldCount: number;
  chickPrice: number;

  // Zużycie paszy
  feedKg: number;
  feedPricePerTon: number;

  // Koszty z tabeli costs (per rzut)
  costsByCategory: Record<string, number>;

  // Koszt uboju (opłata zakładu ubojczego)
  slaughterFee: number;

  // Transport
  transportCost: number;

  // Wynik uboju
  liveWeightKg: number;
  carcassWeightKg: number;

  // Rozliczenie
  revenueNet: number | null;
  currency: string;
}): FullCostChain {
  const deadCount = input.initialCount - input.currentCount - input.soldCount;

  // Koszty szczegółowe
  const chickCost = input.initialCount * input.chickPrice;
  const feedCost = (input.feedKg / 1000) * input.feedPricePerTon;
  const vetCost = input.costsByCategory['vet'] ?? 0;
  const energyCost = input.costsByCategory['energy'] ?? 0;
  const litterCost = input.costsByCategory['litter'] ?? 0;
  const laborCost = input.costsByCategory['labor'] ?? 0;
  const otherCost = input.costsByCategory['other'] ?? 0;

  const totalCost = chickCost + feedCost + vetCost + energyCost + litterCost + 
                    laborCost + otherCost + input.slaughterFee + input.transportCost;

  // Wydajność
  const yieldPct = input.liveWeightKg > 0 
    ? (input.carcassWeightKg / input.liveWeightKg) * 100 
    : 0;

  // Koszty per kg
  const costPerKgLive = input.liveWeightKg > 0 ? totalCost / input.liveWeightKg : 0;
  const costPerKgCarcass = input.carcassWeightKg > 0 ? totalCost / input.carcassWeightKg : 0;
  const costPerBird = input.initialCount > 0 ? totalCost / input.initialCount : 0;

  // Rozbicie per kategoria
  const categories = [
    { category: 'chicks', label: 'Pisklęta', amount: chickCost },
    { category: 'feed', label: 'Pasza', amount: feedCost },
    { category: 'vet', label: 'Weterynaria', amount: vetCost },
    { category: 'energy', label: 'Energia', amount: energyCost },
    { category: 'litter', label: 'Ściółka', amount: litterCost },
    { category: 'labor', label: 'Robocizna', amount: laborCost },
    { category: 'transport', label: 'Transport', amount: input.transportCost },
    { category: 'slaughter', label: 'Ubój', amount: input.slaughterFee },
    { category: 'other', label: 'Inne', amount: otherCost },
  ];

  const breakdown: CostBreakdownItem[] = categories.map(c => ({
    category: c.category,
    label: c.label,
    amount: Number(c.amount.toFixed(2)),
    percentOfTotal: totalCost > 0 ? Number(((c.amount / totalCost) * 100).toFixed(1)) : 0,
    costPerKgLive: input.liveWeightKg > 0 ? Number((c.amount / input.liveWeightKg).toFixed(3)) : 0,
    costPerKgCarcass: input.carcassWeightKg > 0 ? Number((c.amount / input.carcassWeightKg).toFixed(3)) : 0,
  }));

  // Przychód i marża
  const revenue = input.revenueNet ?? 0;
  const margin = input.revenueNet != null ? revenue - totalCost : null;
  const marginPct = totalCost > 0 && input.revenueNet != null ? (margin! / totalCost) * 100 : null;

  // Ceny per kg
  const pricePerKgLive = input.revenueNet != null && input.liveWeightKg > 0 
    ? revenue / input.liveWeightKg : null;
  const pricePerKgCarcass = input.revenueNet != null && input.carcassWeightKg > 0 
    ? revenue / input.carcassWeightKg : null;

  // FCR (Feed Conversion Ratio)
  const fcr = input.liveWeightKg > 0 && input.feedKg > 0 
    ? input.feedKg / input.liveWeightKg : null;

  // EPEF (European Production Efficiency Factor)
  // EPEF = (Waga żywa kg × Wydajność %) / (Wiek × FCR) × 100
  const ageDays = 140; // TODO: obliczyć z dat rzutu
  const epef = fcr && input.liveWeightKg > 0 && yieldPct > 0 && ageDays > 0
    ? ((input.liveWeightKg / 1000) * yieldPct) / (ageDays * fcr) * 100
    : null;

  return {
    initialCount: input.initialCount,
    currentCount: input.currentCount,
    soldCount: input.soldCount,
    deadCount,
    chickPrice: input.chickPrice,
    liveWeightKg: input.liveWeightKg,
    carcassWeightKg: input.carcassWeightKg,
    yieldPct: Number(yieldPct.toFixed(2)),
    costs: {
      chicks: Number(chickCost.toFixed(2)),
      feed: Number(feedCost.toFixed(2)),
      vet: Number(vetCost.toFixed(2)),
      energy: Number(energyCost.toFixed(2)),
      litter: Number(litterCost.toFixed(2)),
      labor: Number(laborCost.toFixed(2)),
      transport: Number(input.transportCost.toFixed(2)),
      slaughter: Number(input.slaughterFee.toFixed(2)),
      other: Number(otherCost.toFixed(2)),
      total: Number(totalCost.toFixed(2)),
    },
    breakdown,
    costPerKgLive: Number(costPerKgLive.toFixed(2)),
    costPerKgCarcass: Number(costPerKgCarcass.toFixed(2)),
    costPerBird: Number(costPerBird.toFixed(2)),
    revenueNet: input.revenueNet,
    margin: margin != null ? Number(margin.toFixed(2)) : null,
    marginPct: marginPct != null ? Number(marginPct.toFixed(1)) : null,
    pricePerKgLive: pricePerKgLive != null ? Number(pricePerKgLive.toFixed(2)) : null,
    pricePerKgCarcass: pricePerKgCarcass != null ? Number(pricePerKgCarcass.toFixed(2)) : null,
    fcr: fcr != null ? Number(fcr.toFixed(2)) : null,
    epef: epef != null ? Number(epef.toFixed(1)) : null,
    currency: input.currency,
  };
}

/**
 * Porównanie kosztów między partiami ubojowymi.
 */
export function compareCostChains(chains: FullCostChain[]): {
  avgCostPerKgLive: number;
  avgCostPerKgCarcass: number;
  avgYieldPct: number;
  avgFcr: number | null;
  bestCostPerKgCarcass: { value: number; index: number } | null;
  worstCostPerKgCarcass: { value: number; index: number } | null;
} {
  if (chains.length === 0) {
    return {
      avgCostPerKgLive: 0,
      avgCostPerKgCarcass: 0,
      avgYieldPct: 0,
      avgFcr: null,
      bestCostPerKgCarcass: null,
      worstCostPerKgCarcass: null,
    };
  }

  const avgCostPerKgLive = chains.reduce((a, c) => a + c.costPerKgLive, 0) / chains.length;
  const avgCostPerKgCarcass = chains.reduce((a, c) => a + c.costPerKgCarcass, 0) / chains.length;
  const avgYieldPct = chains.reduce((a, c) => a + c.yieldPct, 0) / chains.length;

  const fcrValues = chains.filter(c => c.fcr != null).map(c => c.fcr!);
  const avgFcr = fcrValues.length > 0 
    ? fcrValues.reduce((a, b) => a + b, 0) / fcrValues.length 
    : null;

  let bestIdx = 0, worstIdx = 0;
  chains.forEach((c, i) => {
    if (c.costPerKgCarcass < chains[bestIdx].costPerKgCarcass) bestIdx = i;
    if (c.costPerKgCarcass > chains[worstIdx].costPerKgCarcass) worstIdx = i;
  });

  return {
    avgCostPerKgLive: Number(avgCostPerKgLive.toFixed(2)),
    avgCostPerKgCarcass: Number(avgCostPerKgCarcass.toFixed(2)),
    avgYieldPct: Number(avgYieldPct.toFixed(2)),
    avgFcr: avgFcr != null ? Number(avgFcr.toFixed(2)) : null,
    bestCostPerKgCarcass: { value: chains[bestIdx].costPerKgCarcass, index: bestIdx },
    worstCostPerKgCarcass: { value: chains[worstIdx].costPerKgCarcass, index: worstIdx },
  };
}
