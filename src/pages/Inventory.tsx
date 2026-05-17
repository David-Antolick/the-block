// Inventory grid page. Owns filter + sort + mobile-drawer state (D018).
// Default filters hide salvage + ended (D017); both surface as removable chips.

import { useMemo, useState } from 'react';
import VehicleCard from '../components/VehicleCard';
import FilterRail from '../components/FilterRail';
import {
  DEFAULT_FILTER_STATE,
  applyFilters,
  enumerateActiveFilters,
  type FilterState,
} from '../components/filter-rail-state';
import { VEHICLES } from '../data/vehicles';
import { useBids } from '../state/bid-context';
import { displayedCurrentBid } from '../lib/bidding';
import type { CompPriceBand } from '../lib/comps';
import { compPriceBand } from '../lib/comps';
import { ACTIVE_WINDOW_MS, shiftAuctionStart } from '../lib/time';
import type { Vehicle } from '../types/vehicle';
import type { BidsByVehicle } from '../state/bid-context';

type SortKey =
  | 'ending_soonest'
  | 'year_newest'
  | 'price_low'
  | 'price_high'
  | 'mileage_low'
  | 'condition_high';

const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: 'ending_soonest', label: 'Ending soonest' },
  { value: 'year_newest', label: 'Year: newest' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'mileage_low', label: 'Mileage: lowest' },
  { value: 'condition_high', label: 'Condition: highest' },
];

function closeTimeMs(vehicle: Vehicle): number {
  return new Date(shiftAuctionStart(vehicle.auction_start)).getTime() + ACTIVE_WINDOW_MS;
}

function sortVehicles(
  vehicles: readonly Vehicle[],
  key: SortKey,
  bidsByVehicle: BidsByVehicle,
): readonly Vehicle[] {
  const copy = [...vehicles];

  switch (key) {
    case 'ending_soonest': {
      // Closeable lots ascend by close; already-ended lots fall to the bottom
      // ordered most-recently-ended first.
      const now = Date.now();
      return copy.sort((a, b) => {
        const ca = closeTimeMs(a);
        const cb = closeTimeMs(b);
        const aActive = ca > now;
        const bActive = cb > now;
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return aActive ? ca - cb : cb - ca;
      });
    }
    case 'year_newest':
      return copy.sort((a, b) => b.year - a.year);
    case 'price_low':
      return copy.sort(
        (a, b) =>
          displayedCurrentBid(a, bidsByVehicle[a.id] ?? []) -
          displayedCurrentBid(b, bidsByVehicle[b.id] ?? []),
      );
    case 'price_high':
      return copy.sort(
        (a, b) =>
          displayedCurrentBid(b, bidsByVehicle[b.id] ?? []) -
          displayedCurrentBid(a, bidsByVehicle[a.id] ?? []),
      );
    case 'mileage_low':
      return copy.sort((a, b) => a.odometer_km - b.odometer_km);
    case 'condition_high':
      return copy.sort((a, b) => b.condition_grade - a.condition_grade);
  }
}

export default function Inventory() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [sortKey, setSortKey] = useState<SortKey>('ending_soonest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const bidsByVehicle = useBids();

  // Precompute the band map only when the Smart Price filter needs it for
  // every vehicle — otherwise each rendered card computes its own.
  const smartFilterActive = filters.smartPriceVerdicts.length > 0;
  const bandsById = useMemo(() => {
    if (!smartFilterActive) return null;
    const map = new Map<string, CompPriceBand | null>();
    for (const v of VEHICLES) {
      map.set(v.id, compPriceBand(v, VEHICLES, bidsByVehicle));
    }
    return map;
  }, [bidsByVehicle, smartFilterActive]);

  const filteredSorted = useMemo(
    () =>
      sortVehicles(
        applyFilters(
          VEHICLES,
          filters,
          bidsByVehicle,
          bandsById ? (v) => bandsById.get(v.id) ?? null : undefined,
        ),
        sortKey,
        bidsByVehicle,
      ),
    [filters, sortKey, bidsByVehicle, bandsById],
  );

  const chips = useMemo(() => enumerateActiveFilters(filters), [filters]);

  function resetFilters() {
    setFilters(DEFAULT_FILTER_STATE);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Inventory</h2>
          <p className="text-sm text-zinc-600">
            {filteredSorted.length} of {VEHICLES.length} lots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 lg:hidden"
          >
            Filters{chips.length > 0 && ` (${chips.length})`}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600">Sort</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => setFilters(chip.clear(filters))}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
              >
                <span>{chip.label}</span>
                <span aria-hidden="true" className="text-zinc-400">
                  ×
                </span>
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-blue-700 underline hover:text-blue-900"
            >
              Reset all
            </button>
          </li>
        </ul>
      )}

      <div className="flex gap-6">
        <FilterRail
          vehicles={VEHICLES}
          value={filters}
          onChange={setFilters}
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
        />

        <div className="min-w-0 flex-1">
          {filteredSorted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
              <p className="text-sm font-medium text-zinc-700">No lots match these filters.</p>
              <p className="mt-1 text-sm text-zinc-500">
                Try clearing a filter or widening the price range.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSorted.map((v) => (
                <li key={v.id}>
                  <VehicleCard
                    vehicle={v}
                    band={bandsById ? (bandsById.get(v.id) ?? null) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
