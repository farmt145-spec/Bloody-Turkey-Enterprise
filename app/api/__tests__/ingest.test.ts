import { describe, it, expect } from 'vitest';

const RANGES: Record<string, [number, number]> = {
  tempC: [-40, 80],
  humidityPct: [0, 100],
  co2Ppm: [0, 20000],
  ammoniaPpm: [0, 500],
};

function checkRanges(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    const v = obj[f];
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) return `Pole ${f} musi być liczbą`;
    const [lo, hi] = RANGES[f] ?? [-Infinity, Infinity];
    if (n < lo || n > hi) return `Pole ${f} poza zakresem`;
  }
  return null;
}

describe('ingest validation', () => {
  it('valid climate data', () => {
    expect(checkRanges({ tempC: 21.5 }, ['tempC'])).toBeNull();
  });
  it('rejects out of range', () => {
    expect(checkRanges({ tempC: 150 }, ['tempC'])).toBeTruthy();
  });
});
