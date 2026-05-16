// Smart Price comps. Embeds the "am I about to overpay?" answer that
// OPENLANE's public UI defers to a separate paid product (autoniq). The thesis
// — and the reason the badge lands on every card, not just the VDP — is
// captured in CLAUDE.md and D008.
//
// Pure functions only (mirrors the bidding.ts discipline in D012): nothing
// here depends on React, time, the DOM, or the bid context. Inputs are
// (target, pool, bidsByVehicle); outputs are plain data. Callers memoize
// where it matters.

import type { Vehicle, UserBid } from '../types/vehicle';
import { displayedCurrentBid } from './bidding';

/** Year tolerance on either side of the target year — `target.year ± YEAR_WINDOW`. */
export const YEAR_WINDOW = 1;

/** Cap on the number of comps returned. Three is small enough that the band stays
 * narrow and the panel renders cleanly; large enough that one outlier doesn't
 * dominate. See I3 in PLAN.md for the median simplification this cap allows. */
export const COMP_COUNT = 3;

export type SmartPriceVerdict = 'below' | 'fair' | 'above' | 'unknown';

export interface CompPriceBand {
  readonly comps: readonly Vehicle[];
  readonly prices: readonly number[];
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

/**
 * Three closest comparable lots for a target vehicle. Same make + model, year
 * within ±YEAR_WINDOW, target excluded by id. Ordered by absolute mileage
 * distance from the target (closest first) and truncated to COMP_COUNT.
 *
 * Ties on mileage distance fall to insertion order — deterministic across
 * renders because `pool` is the readonly dataset.
 */
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
 * Price band over `findComps(target, pool)`, using each comp's
 * `displayedCurrentBid(...)` so user-placed bids on comps move the band the
 * way they'd move any real-world price signal.
 *
 * Returns `null` when there are no comps, or when every comp's price is zero
 * (a lot of just-listed lots seed `current_bid` at 0 — a band of zeros isn't
 * a useful signal and would mark every priced lot as "above").
 *
 * Median is `prices[floor(n/2)]` after sorting — exact for odd n, slightly
 * biased toward the higher value for even n (I3 in PLAN.md). Acceptable
 * because n ≤ COMP_COUNT (3) and the median is tooltip copy only; the
 * verdict logic uses `low` and `high`.
 */
export function compPriceBand(
  target: Vehicle,
  pool: readonly Vehicle[],
  bidsByVehicle: Readonly<Record<string, readonly UserBid[]>>,
): CompPriceBand | null {
  const comps = findComps(target, pool);
  if (comps.length === 0) return null;

  const prices = comps.map((c) => displayedCurrentBid(c, bidsByVehicle[c.id] ?? []));
  const sorted = [...prices].sort((a, b) => a - b);
  const high = sorted[sorted.length - 1] ?? 0;
  if (high <= 0) return null;

  const low = sorted[0] ?? 0;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  return { comps, prices, low, median, high };
}

/**
 * Bucket a candidate price against a comp band. `null` band → `unknown`;
 * otherwise strictly below `low` → `below`, strictly above `high` → `above`,
 * inclusive between → `fair`. The inclusive boundaries match the buyer's
 * mental model: "matching the cheapest comp" reads as fair, not overpriced.
 */
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
