import { describe, it, expect } from "vitest";
import { computeYieldPct, computeSettlement, nextSlaughterCode, planVsReality, computeEconomics } from "./slaughter-calc";

describe("slaughter-calc", () => {
  it("wydajność = tuszki/żywiec ×100, bezpieczna przy zerze", () => {
    expect(computeYieldPct(7800, 10000)).toBe(78);
    expect(computeYieldPct(100, 0)).toBe(0);
    expect(computeYieldPct(0, 5000)).toBe(0);
  });

  it("rozliczenie: brutto + premie − potrącenia", () => {
    const r = computeSettlement({ carcassWeightKg: 10000, pricePerKg: 7.45, bonuses: 500, deductions: 250 });
    expect(r.grossAmount).toBe(74500);
    expect(r.netAmount).toBe(74750);
  });

  it("kod partii UB-RRRR-NNNNNN", () => {
    expect(nextSlaughterCode(2026, 7)).toBe("UB-2026-000007");
    expect(nextSlaughterCode(2026, 123456)).toBe("UB-2026-123456");
  });

  it("plan vs rzeczywistość", () => {
    const p = planVsReality({
      plannedDate: "2026-09-01", plannedCount: 10000, targetAvgWeightKg: 12.5,
      actualCount: 9800, liveWeightKg: 122500, carcassWeightKg: 95000,
      yieldPct: 77.55, slaughteredAt: new Date("2026-09-03"),
    });
    expect(p.countDiff).toBe(-200);
    expect(p.countPct).toBe(98);
    expect(p.avgLiveWeightKg).toBe(12.5);
    expect(p.weightTargetDiff).toBe(0);
    expect(p.daysVsPlan).toBe(2);
  });

  it("ekonomika partii: koszty, marża, ROI", () => {
    const e = computeEconomics({
      initialCount: 10000, chickPrice: 6.5, feedKg: 350000, feedPricePerTon: 1800,
      transportCost: 8000, revenueNet: 800000, liveWeightKg: 122500,
    });
    expect(e.chickCost).toBe(65000);
    expect(e.feedCost).toBe(630000);
    expect(e.totalCost).toBe(703000);
    expect(e.margin).toBe(97000);
    expect(e.roiPct).toBeCloseTo(13.8, 1);
    expect(e.costPerKgLive).toBeCloseTo(5.74, 2);
  });

  it("ekonomika bez rozliczenia: brak marży i ROI", () => {
    const e = computeEconomics({
      initialCount: 100, chickPrice: 6, feedKg: 1000, feedPricePerTon: 1800,
      transportCost: 0, revenueNet: null, liveWeightKg: null,
    });
    expect(e.margin).toBeNull();
    expect(e.roiPct).toBeNull();
    expect(e.costPerKgLive).toBeNull();
  });
});
