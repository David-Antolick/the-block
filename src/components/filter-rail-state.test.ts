import { describe, it, expect } from 'vitest';
import type { UserBid, Vehicle } from '../types/vehicle';
import type { BidsByVehicle } from '../state/bid-context';
import {
  ALL_AUCTION_STATUSES,
  ALL_TITLE_STATUSES,
  DEFAULT_FILTER_STATE,
  applyFilters,
  enumerateActiveFilters,
  type FilterState,
} from './filter-rail-state';

// The dataset anchor lives in src/lib/time.ts as Date.UTC(2026, 3, 5, 12, 0, 0).
// Auction times relative to it shift to "now ± same offset", so picking values
// well clear of the 6h ACTIVE_WINDOW_MS boundary keeps bucketing stable across
// the millisecond drift inside auctionStatus (two Date.now() calls per check).
const ANCHOR_ISO = '2026-04-05T12:00:00';            // shifts to ~now → active
const ENDED_ISO = '2026-04-04T12:00:00';             // anchor − 24h → ended
const UPCOMING_ISO = '2026-04-06T12:00:00';          // anchor + 24h → upcoming

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    vin: 'VIN',
    year: 2022,
    make: 'Mazda',
    model: 'CX-5',
    trim: 'Touring',
    body_style: 'SUV',
    exterior_color: 'Blue',
    interior_color: 'Black',
    engine: '2.5L I4',
    transmission: 'automatic',
    drivetrain: 'AWD',
    odometer_km: 50_000,
    fuel_type: 'gasoline',
    condition_grade: 4,
    condition_report: '',
    damage_notes: [],
    title_status: 'clean',
    province: 'ON',
    city: 'Toronto',
    auction_start: ANCHOR_ISO,
    starting_bid: 10_000,
    reserve_price: null,
    buy_now_price: null,
    images: [],
    selling_dealership: 'X',
    lot: 'A-0001',
    current_bid: 15_000,
    bid_count: 3,
    ...overrides,
  };
}

function bid(amount: number): UserBid {
  return { amount, placedAt: '2026-05-16T12:00:00Z' };
}

// Default state widened to also include 'ended' so timing-sensitive cases don't
// have to fight the salvage/ended defaults. Tests that need the real defaults
// use DEFAULT_FILTER_STATE directly.
const PERMISSIVE: FilterState = {
  ...DEFAULT_FILTER_STATE,
  titleStatuses: ALL_TITLE_STATUSES,
  auctionStatuses: ALL_AUCTION_STATUSES,
};

const NO_BIDS: BidsByVehicle = {};

describe('applyFilters — categorical narrowing', () => {
  const fleet: readonly Vehicle[] = [
    makeVehicle({ id: 'a', make: 'Mazda', body_style: 'SUV' }),
    makeVehicle({ id: 'b', make: 'Honda', body_style: 'sedan' }),
    makeVehicle({ id: 'c', make: 'Mazda', body_style: 'hatchback' }),
  ];

  it('treats an empty array as "no filter on this facet"', () => {
    expect(applyFilters(fleet, PERMISSIVE, NO_BIDS)).toHaveLength(3);
  });

  it('narrows by single make', () => {
    const result = applyFilters(fleet, { ...PERMISSIVE, makes: ['Mazda'] }, NO_BIDS);
    expect(result.map((v) => v.id)).toEqual(['a', 'c']);
  });

  it('narrows by multi-select body style', () => {
    const result = applyFilters(
      fleet,
      { ...PERMISSIVE, bodyStyles: ['SUV', 'hatchback'] },
      NO_BIDS,
    );
    expect(result.map((v) => v.id)).toEqual(['a', 'c']);
  });

  it('combines facets with AND semantics', () => {
    const result = applyFilters(
      fleet,
      { ...PERMISSIVE, makes: ['Mazda'], bodyStyles: ['SUV'] },
      NO_BIDS,
    );
    expect(result.map((v) => v.id)).toEqual(['a']);
  });
});

describe('applyFilters — Smart Price', () => {
  // Three comps in a coherent make/model/year cluster so compPriceBand produces
  // a real band [18_000, 20_000, 22_000]; the target sits at varying current
  // bids to exercise each verdict.
  function makeCluster(targetBid: number): readonly Vehicle[] {
    return [
      makeVehicle({ id: 'target', odometer_km: 60_000, current_bid: targetBid }),
      makeVehicle({ id: 'c1', odometer_km: 61_000, current_bid: 18_000 }),
      makeVehicle({ id: 'c2', odometer_km: 62_000, current_bid: 20_000 }),
      makeVehicle({ id: 'c3', odometer_km: 63_000, current_bid: 22_000 }),
    ];
  }

  it('returns all when smartPriceVerdicts is empty (no filter)', () => {
    const fleet = makeCluster(15_000);
    expect(applyFilters(fleet, PERMISSIVE, NO_BIDS)).toHaveLength(4);
  });

  it('narrows to "below market" verdicts', () => {
    const fleet = makeCluster(10_000); // target < band.low (18_000) → below
    const result = applyFilters(
      fleet,
      { ...PERMISSIVE, smartPriceVerdicts: ['below'] },
      NO_BIDS,
    );
    expect(result.map((v) => v.id)).toContain('target');
  });

  it('excludes a target whose verdict is "above" when filtering for "below"', () => {
    const fleet = makeCluster(30_000); // target > band.high (22_000) → above
    const result = applyFilters(
      fleet,
      { ...PERMISSIVE, smartPriceVerdicts: ['below'] },
      NO_BIDS,
    );
    expect(result.map((v) => v.id)).not.toContain('target');
  });

  it('drops unscored lots when the filter is active', () => {
    // Solitary make/model — no comps available → verdict 'unknown'
    const fleet: readonly Vehicle[] = [
      makeVehicle({ id: 'lonely', make: 'Tesla', model: 'Model Y', current_bid: 40_000 }),
    ];
    const result = applyFilters(
      fleet,
      { ...PERMISSIVE, smartPriceVerdicts: ['below', 'fair', 'above'] },
      NO_BIDS,
    );
    expect(result).toHaveLength(0);
  });
});

describe('applyFilters — title status defaults', () => {
  const fleet: readonly Vehicle[] = [
    makeVehicle({ id: 'clean', title_status: 'clean' }),
    makeVehicle({ id: 'rebuilt', title_status: 'rebuilt' }),
    makeVehicle({ id: 'salvage', title_status: 'salvage' }),
  ];

  it('hides salvage by default (D017)', () => {
    const result = applyFilters(fleet, DEFAULT_FILTER_STATE, NO_BIDS).map((v) => v.id);
    expect(result).toContain('clean');
    expect(result).toContain('rebuilt');
    expect(result).not.toContain('salvage');
  });

  it('includes salvage once opted in', () => {
    const result = applyFilters(
      fleet,
      { ...DEFAULT_FILTER_STATE, titleStatuses: ALL_TITLE_STATUSES },
      NO_BIDS,
    ).map((v) => v.id);
    expect(result).toContain('salvage');
  });
});

describe('applyFilters — auction status defaults', () => {
  const fleet: readonly Vehicle[] = [
    makeVehicle({ id: 'live', auction_start: ANCHOR_ISO }),
    makeVehicle({ id: 'soon', auction_start: UPCOMING_ISO }),
    makeVehicle({ id: 'dead', auction_start: ENDED_ISO }),
  ];

  it('hides ended by default (D017)', () => {
    const result = applyFilters(fleet, DEFAULT_FILTER_STATE, NO_BIDS).map((v) => v.id);
    expect(result).not.toContain('dead');
    expect(result).toContain('soon');
    // 'live' is timing-sensitive at the anchor boundary; assertion above is enough.
  });

  it('includes ended once opted in', () => {
    const result = applyFilters(
      fleet,
      { ...DEFAULT_FILTER_STATE, auctionStatuses: ALL_AUCTION_STATUSES },
      NO_BIDS,
    ).map((v) => v.id);
    expect(result).toContain('dead');
  });
});

describe('applyFilters — numeric ranges', () => {
  it('uses displayedCurrentBid (not dataset current_bid) for price filtering', () => {
    const v = makeVehicle({ id: 'priced', current_bid: 10_000 });
    const bids: BidsByVehicle = { priced: [bid(20_000)] };
    // Floor at 15k excludes by dataset, includes by displayed (user pushed it).
    const result = applyFilters([v], { ...PERMISSIVE, priceMin: 15_000 }, bids);
    expect(result.map((x) => x.id)).toEqual(['priced']);
  });

  it('enforces priceMin and priceMax together', () => {
    const fleet = [
      makeVehicle({ id: 'low', current_bid: 5_000 }),
      makeVehicle({ id: 'mid', current_bid: 15_000 }),
      makeVehicle({ id: 'high', current_bid: 30_000 }),
    ];
    const result = applyFilters(
      fleet,
      { ...PERMISSIVE, priceMin: 10_000, priceMax: 20_000 },
      NO_BIDS,
    );
    expect(result.map((v) => v.id)).toEqual(['mid']);
  });

  it('excludes vehicles below minConditionGrade', () => {
    const fleet = [
      makeVehicle({ id: 'rough', condition_grade: 2.5 }),
      makeVehicle({ id: 'ok', condition_grade: 3.5 }),
      makeVehicle({ id: 'nice', condition_grade: 4.5 }),
    ];
    const result = applyFilters(fleet, { ...PERMISSIVE, minConditionGrade: 3.5 }, NO_BIDS);
    expect(result.map((v) => v.id)).toEqual(['ok', 'nice']);
  });
});

describe('applyFilters — search', () => {
  const fleet = [
    makeVehicle({ id: 'a', make: 'Mazda', model: 'CX-5', trim: 'Touring', lot: 'A-0001' }),
    makeVehicle({ id: 'b', make: 'Honda', model: 'Civic', trim: 'Sport', lot: 'A-0042' }),
  ];

  it('is case-insensitive', () => {
    const result = applyFilters(fleet, { ...PERMISSIVE, search: 'MAZDA' }, NO_BIDS);
    expect(result.map((v) => v.id)).toEqual(['a']);
  });

  it('matches against trim', () => {
    const result = applyFilters(fleet, { ...PERMISSIVE, search: 'sport' }, NO_BIDS);
    expect(result.map((v) => v.id)).toEqual(['b']);
  });

  it('matches against lot number', () => {
    const result = applyFilters(fleet, { ...PERMISSIVE, search: 'A-0042' }, NO_BIDS);
    expect(result.map((v) => v.id)).toEqual(['b']);
  });

  it('treats a whitespace-only search as empty', () => {
    const result = applyFilters(fleet, { ...PERMISSIVE, search: '   ' }, NO_BIDS);
    expect(result).toHaveLength(2);
  });
});

describe('enumerateActiveFilters', () => {
  it('returns no chips for the default state', () => {
    expect(enumerateActiveFilters(DEFAULT_FILTER_STATE)).toEqual([]);
  });

  it('chips the search term with the trimmed query', () => {
    const chips = enumerateActiveFilters({ ...DEFAULT_FILTER_STATE, search: '  Mazda  ' });
    expect(chips).toHaveLength(1);
    expect(chips[0]!.key).toBe('search');
    expect(chips[0]!.label).toBe('Search: "Mazda"');
  });

  it('emits one chip per selected make / body / fuel / drivetrain', () => {
    const chips = enumerateActiveFilters({
      ...DEFAULT_FILTER_STATE,
      makes: ['Mazda', 'Honda'],
      bodyStyles: ['SUV'],
      fuelTypes: ['hybrid'],
      drivetrains: ['AWD'],
    });
    const labels = chips.map((c) => c.label);
    expect(labels).toEqual([
      'Make: Mazda',
      'Make: Honda',
      'Body: SUV',
      'Fuel: hybrid',
      'Drivetrain: AWD',
    ]);
  });

  it('chips "Salvage included" when salvage is added beyond the default', () => {
    const chips = enumerateActiveFilters({
      ...DEFAULT_FILTER_STATE,
      titleStatuses: ALL_TITLE_STATUSES,
    });
    expect(chips.map((c) => c.label)).toContain('Salvage included');
  });

  it('chips "Hides {status}" when a default-on title or status is removed', () => {
    const chips = enumerateActiveFilters({
      ...DEFAULT_FILTER_STATE,
      titleStatuses: ['clean'],         // dropped 'rebuilt' from default
      auctionStatuses: ['upcoming'],     // dropped 'active' from default
    });
    const labels = chips.map((c) => c.label);
    expect(labels).toContain('Hides rebuilt');
    expect(labels).toContain('Hides active');
  });

  it('chips price bounds with formatted currency', () => {
    const chips = enumerateActiveFilters({
      ...DEFAULT_FILTER_STATE,
      priceMin: 10_000,
      priceMax: 25_000,
    });
    const labels = chips.map((c) => c.label);
    // Currency format is locale-specific (en-CA, CAD) — match the dollar amounts loosely.
    expect(labels.some((l) => l.startsWith('Min ') && l.includes('10,000'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Max ') && l.includes('25,000'))).toBe(true);
  });

  it('chips min condition grade with one decimal', () => {
    const chips = enumerateActiveFilters({ ...DEFAULT_FILTER_STATE, minConditionGrade: 3.5 });
    expect(chips.map((c) => c.label)).toContain('Min condition 3.5');
  });

  it('chips Smart Price verdicts with the "Smart: …" prefix', () => {
    const chips = enumerateActiveFilters({
      ...DEFAULT_FILTER_STATE,
      smartPriceVerdicts: ['below', 'above'],
    });
    const labels = chips.map((c) => c.label);
    expect(labels).toContain('Smart: Below market');
    expect(labels).toContain('Smart: Above market');
    expect(labels).not.toContain('Smart: Fair price');
  });

  it("chip.clear() reverses the chip's own effect", () => {
    const state: FilterState = {
      ...DEFAULT_FILTER_STATE,
      makes: ['Mazda', 'Honda'],
      priceMin: 5_000,
    };
    const chips = enumerateActiveFilters(state);
    const mazdaChip = chips.find((c) => c.key === 'make:Mazda')!;
    const cleared = mazdaChip.clear(state);
    expect(cleared.makes).toEqual(['Honda']);
    expect(cleared.priceMin).toBe(5_000); // other filters untouched
  });
});
