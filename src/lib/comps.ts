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

/** Verdicts that actually carry signal — `'unknown'` is the "nothing to say"
 *  case and never renders or filters on. */
export type ScoredVerdict = Exclude<SmartPriceVerdict, 'unknown'>;

export const SCORED_VERDICTS: readonly ScoredVerdict[] = ['below', 'fair', 'above'];

/** Display labels for scored verdicts. Co-located with the verdict type so the
 *  badge and the filter rail can't drift on copy. */
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
 * **Zero-priced comps are dropped from the band** — a lot that's just been
 * listed (no bids yet) seeds `current_bid` at 0 and tells us nothing about
 * what the market clears at. Including them would pin `low` at 0 and turn
 * "fair" into "anywhere between zero and the highest comp," which is
 * useless signal. Floors would tighten the band but D007 forbids surfacing
 * the reserve number, so we'd be reading from data the UI can't show.
 *
 * Returns `null` when no comps remain after the zero-price filter. The
 * surfaced `comps` array also reflects the filter so the VDP comp panel
 * doesn't render a mini-card with a "$0" price next to a real one.
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
