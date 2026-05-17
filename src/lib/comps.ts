// Smart Price comps — pure functions (mirrors bidding.ts discipline, D012).
// Design micro-decisions in D020; trust-thesis context in CLAUDE.md / D008.

import type { Vehicle, UserBid } from '../types/vehicle';
import { displayedCurrentBid } from './bidding';

export const YEAR_WINDOW = 1;
export const COMP_COUNT = 3;

export type SmartPriceVerdict = 'below' | 'fair' | 'above' | 'unknown';
export type ScoredVerdict = Exclude<SmartPriceVerdict, 'unknown'>;
export const SCORED_VERDICTS: readonly ScoredVerdict[] = ['below', 'fair', 'above'];

export const VERDICT_LABEL: Record<ScoredVerdict, string> = {
  below: 'Below market',
  fair: 'Fair price',
  above: 'Above market',
};

export interface CompPriceBand {
  readonly comps: readonly Vehicle[];
  readonly prices: readonly number[];
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

/** Three closest comps by mileage. Same make+model, year ±YEAR_WINDOW, excludes target. */
export function findComps(target: Vehicle, pool: readonly Vehicle[]): readonly Vehicle[] {
  const candidates: Vehicle[] = [];
  for (const v of pool) {
    if (v.id === target.id) continue;
    if (v.make !== target.make) continue;
    if (v.model !== target.model) continue;
    if (Math.abs(v.year - target.year) > YEAR_WINDOW) continue;
    candidates.push(v);
  }
  candidates.sort(
    (a, b) =>
      Math.abs(a.odometer_km - target.odometer_km) -
      Math.abs(b.odometer_km - target.odometer_km),
  );
  return candidates.slice(0, COMP_COUNT);
}

/**
 * Price band over the comps. Drops zero-priced (unbid) comps so `low` isn't
 * pinned at 0 — see D020 (an unbid comp is the seller's *asking* price, not
 * what the market's *clearing at*). Returns `null` when no priced comps
 * survive. Median has a slight upper bias on even n (acceptable per I3).
 */
export function compPriceBand(
  target: Vehicle,
  pool: readonly Vehicle[],
  bidsByVehicle: Readonly<Record<string, readonly UserBid[]>>,
): CompPriceBand | null {
  const candidates = findComps(target, pool);
  const priced: Array<{ comp: Vehicle; price: number }> = [];
  for (const comp of candidates) {
    const price = displayedCurrentBid(comp, bidsByVehicle[comp.id] ?? []);
    if (price > 0) priced.push({ comp, price });
  }
  if (priced.length === 0) return null;

  const comps = priced.map((p) => p.comp);
  const prices = priced.map((p) => p.price);
  const sorted = [...prices].sort((a, b) => a - b);
  const low = sorted[0] ?? 0;
  const high = sorted[sorted.length - 1] ?? 0;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  return { comps, prices, low, median, high };
}

/** Bucket a price against the band. Boundaries inclusive (D020). */
export function smartPriceVerdict(
  price: number,
  band: CompPriceBand | null,
): SmartPriceVerdict {
  if (band === null) return 'unknown';
  if (!Number.isFinite(price) || price <= 0) return 'unknown';
  if (price < band.low) return 'below';
  if (price > band.high) return 'above';
  return 'fair';
}
