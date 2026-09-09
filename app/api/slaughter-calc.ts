/**
 * KALKULACJE UBOJU — osobny moduł obliczeniowy (bez UI).
 * Wydajność, rozliczenia, pełna ekonomika partii ubojowej, plan vs rzeczywistość.
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

/** Pełna ekonomika partii ubojowej (waluta rozliczenia — z rozliczenia, domyślnie PLN). */
export function computeEconomics(input: {
  initialCount: number;
  chickPrice: number;          // za sztukę
  feedKg: number;              // zużycie paszy w cyklu
  feedPricePerTon: number;
  transportCost: number;
  otherCosts?: number;         // np. medycyna, energia — opcjonalnie
  revenueNet: number | null;   // z rozliczenia
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
