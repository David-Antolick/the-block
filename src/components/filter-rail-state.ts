// Non-component half of FilterRail: the `FilterState` shape, sensible
// defaults, the filter applier, and the chip enumerator. Split out from
// FilterRail.tsx so the component file keeps React Refresh HMR — same
// `react-refresh/only-export-components` constraint that motivated the
// BidContext split (D016, L001).

import type {
  BodyStyle,
  Drivetrain,
  FuelType,
  TitleStatus,
  Vehicle,
} from '../types/vehicle';
import type { AuctionStatus } from '../lib/time';
import { auctionStatus } from '../lib/time';
import { displayedCurrentBid } from '../lib/bidding';
import type { CompPriceBand, ScoredVerdict } from '../lib/comps';
import { SCORED_VERDICTS, VERDICT_LABEL, compPriceBand, smartPriceVerdict } from '../lib/comps';
import type { BidsByVehicle } from '../state/bid-context';
import { formatCurrency } from '../lib/format';

export interface FilterState {
  search: string;
  makes: readonly string[];
  bodyStyles: readonly BodyStyle[];
  fuelTypes: readonly FuelType[];
  drivetrains: readonly Drivetrain[];
  titleStatuses: readonly TitleStatus[];
  priceMin: number | null;
  priceMax: number | null;
  minConditionGrade: number | null;
  auctionStatuses: readonly AuctionStatus[];
  /** Smart Price verdict allow-list. Empty = no filter (show all, including
   *  lots that have no comp signal). Non-empty narrows to the listed
   *  verdicts; `'unknown'` lots fall out because no scored verdict matches. */
  smartPriceVerdicts: readonly ScoredVerdict[];
}

// Defaults match the trust thesis (CLAUDE.md): salvage hidden until opted in;
// ended hidden so the grid leads with lots a buyer can still act on. Smart
// Price defaults to "no filter" — the badge already signals per-card; the
// filter is for buyers who want to lead with comp-discounted lots.
export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  makes: [],
  bodyStyles: [],
  fuelTypes: [],
  drivetrains: [],
  titleStatuses: ['clean', 'rebuilt'],
  priceMin: null,
  priceMax: null,
  minConditionGrade: null,
  auctionStatuses: ['upcoming', 'active'],
  smartPriceVerdicts: [],
};

export const ALL_TITLE_STATUSES: readonly TitleStatus[] = ['clean', 'rebuilt', 'salvage'];
export const ALL_AUCTION_STATUSES: readonly AuctionStatus[] = ['upcoming', 'active', 'ended'];
export { SCORED_VERDICTS, VERDICT_LABEL };
export type { ScoredVerdict };

/**
 * Apply the filter state to the vehicle list. Headline price (used for the
 * price-range filter) is `displayedCurrentBid(v, bidsByVehicle[v.id])`, which
 * matches what the card itself shows — so the filter and the card never
 * disagree on the number being filtered against.
 *
 * `getBand` (optional) is a memoized comp-band lookup hoisted from the page;
 * when supplied, the Smart Price filter reuses the same cache the inventory
 * grid is reading from, so each vehicle's band is computed at most once per
 * `bidsByVehicle` change. Falls back to a fresh `compPriceBand(...)` call
 * when omitted (test paths, headless usage).
 */
export function applyFilters(
  vehicles: readonly Vehicle[],
  state: FilterState,
  bidsByVehicle: BidsByVehicle,
  getBand?: (v: Vehicle) => CompPriceBand | null,
): readonly Vehicle[] {
  const search = state.search.trim().toLowerCase();

  return vehicles.filter((v) => {
    if (state.makes.length > 0 && !state.makes.includes(v.make)) return false;
    if (state.bodyStyles.length > 0 && !state.bodyStyles.includes(v.body_style)) return false;
    if (state.fuelTypes.length > 0 && !state.fuelTypes.includes(v.fuel_type)) return false;
    if (state.drivetrains.length > 0 && !state.drivetrains.includes(v.drivetrain)) return false;
    if (!state.titleStatuses.includes(v.title_status)) return false;

    if (state.minConditionGrade != null && v.condition_grade < state.minConditionGrade) {
      return false;
    }

    const status = auctionStatus(v.auction_start);
    if (!state.auctionStatuses.includes(status)) return false;

    const price = displayedCurrentBid(v, bidsByVehicle[v.id] ?? []);
    if (state.priceMin != null && price < state.priceMin) return false;
    if (state.priceMax != null && price > state.priceMax) return false;

    if (search) {
      const haystack = `${v.make} ${v.model} ${v.trim} ${v.lot}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    // Smart Price filter runs last because it's the most expensive (O(pool)
    // per vehicle inside compPriceBand). Skipping it when nothing's selected
    // keeps the default-view cost flat. Pool is the full `vehicles` arg so
    // the verdict reflects the whole market, not just the currently-visible
    // slice — filtering shouldn't move the comp band.
    if (state.smartPriceVerdicts.length > 0) {
      const band = getBand ? getBand(v) : compPriceBand(v, vehicles, bidsByVehicle);
      const verdict = smartPriceVerdict(price, band);
      if (verdict === 'unknown') return false;
      if (!state.smartPriceVerdicts.includes(verdict)) return false;
    }

    return true;
  });
}

export interface ActiveFilterChip {
  /** Stable identity for React keys. */
  key: string;
  /** User-facing label, e.g. "Make: Mazda" or "Min $10,000". */
  label: string;
  /** Returns a new FilterState with this chip cleared. Page wires to onChange. */
  clear: (current: FilterState) => FilterState;
}

/**
 * Enumerate every filter currently narrowing the result set, including the
 * "default" omissions (salvage hidden, ended hidden) so users can see and
 * undo them. Order is stable: search first, then categorical multi-selects in
 * declaration order, then numeric ranges.
 */
export function enumerateActiveFilters(state: FilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.search.trim()) {
    chips.push({
      key: 'search',
      label: `Search: "${state.search.trim()}"`,
      clear: (c) => ({ ...c, search: '' }),
    });
  }

  for (const make of state.makes) {
    chips.push({
      key: `make:${make}`,
      label: `Make: ${make}`,
      clear: (c) => ({ ...c, makes: c.makes.filter((m) => m !== make) }),
    });
  }
  for (const body of state.bodyStyles) {
    chips.push({
      key: `body:${body}`,
      label: `Body: ${body}`,
      clear: (c) => ({ ...c, bodyStyles: c.bodyStyles.filter((b) => b !== body) }),
    });
  }
  for (const fuel of state.fuelTypes) {
    chips.push({
      key: `fuel:${fuel}`,
      label: `Fuel: ${fuel}`,
      clear: (c) => ({ ...c, fuelTypes: c.fuelTypes.filter((f) => f !== fuel) }),
    });
  }
  for (const drive of state.drivetrains) {
    chips.push({
      key: `drive:${drive}`,
      label: `Drivetrain: ${drive}`,
      clear: (c) => ({ ...c, drivetrains: c.drivetrains.filter((d) => d !== drive) }),
    });
  }

  for (const v of state.smartPriceVerdicts) {
    chips.push({
      key: `smart:${v}`,
      label: `Smart: ${VERDICT_LABEL[v]}`,
      clear: (c) => ({
        ...c,
        smartPriceVerdicts: c.smartPriceVerdicts.filter((s) => s !== v),
      }),
    });
  }

  // Title-status: only chip when it deviates from the default. We surface
  // both "Salvage included" (added to default) and "Hides rebuilt" (removed
  // from default) so users can always see why a lot might be missing.
  for (const ts of ALL_TITLE_STATUSES) {
    const inDefault = DEFAULT_FILTER_STATE.titleStatuses.includes(ts);
    const inState = state.titleStatuses.includes(ts);
    if (inDefault && !inState) {
      chips.push({
        key: `title-hide:${ts}`,
        label: `Hides ${ts}`,
        clear: (c) => ({ ...c, titleStatuses: [...c.titleStatuses, ts] }),
      });
    } else if (!inDefault && inState) {
      chips.push({
        key: `title-show:${ts}`,
        label: ts === 'salvage' ? 'Salvage included' : `${ts} included`,
        clear: (c) => ({
          ...c,
          titleStatuses: c.titleStatuses.filter((t) => t !== ts),
        }),
      });
    }
  }

  for (const as of ALL_AUCTION_STATUSES) {
    const inDefault = DEFAULT_FILTER_STATE.auctionStatuses.includes(as);
    const inState = state.auctionStatuses.includes(as);
    if (inDefault && !inState) {
      chips.push({
        key: `status-hide:${as}`,
        label: `Hides ${as}`,
        clear: (c) => ({ ...c, auctionStatuses: [...c.auctionStatuses, as] }),
      });
    } else if (!inDefault && inState) {
      chips.push({
        key: `status-show:${as}`,
        label: as === 'ended' ? 'Ended included' : `${as} included`,
        clear: (c) => ({
          ...c,
          auctionStatuses: c.auctionStatuses.filter((s) => s !== as),
        }),
      });
    }
  }

  if (state.priceMin != null) {
    const min = state.priceMin;
    chips.push({
      key: 'price-min',
      label: `Min ${formatCurrency(min)}`,
      clear: (c) => ({ ...c, priceMin: null }),
    });
  }
  if (state.priceMax != null) {
    const max = state.priceMax;
    chips.push({
      key: 'price-max',
      label: `Max ${formatCurrency(max)}`,
      clear: (c) => ({ ...c, priceMax: null }),
    });
  }
  if (state.minConditionGrade != null) {
    const g = state.minConditionGrade;
    chips.push({
      key: 'min-cond',
      label: `Min condition ${g.toFixed(1)}`,
      clear: (c) => ({ ...c, minConditionGrade: null }),
    });
  }

  return chips;
}
