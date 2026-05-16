import { describe, it, expect } from 'vitest';
import type { Vehicle, UserBid } from '../types/vehicle';
import {
  COMP_COUNT,
  YEAR_WINDOW,
  compPriceBand,
  findComps,
  smartPriceVerdict,
} from './comps';

// Minimal-fields fixture — comps only reads id/make/model/year/odometer_km/current_bid.
// Cast keeps tests focused on the math, not the dataset shape (mirrors bidding.test.ts).
function makeVehicle(overrides: Partial<Vehicle> & { id: string }): Vehicle {
  return {
    make: 'Mazda',
    model: 'CX-5',
    year: 2022,
    odometer_km: 60_000,
    current_bid: 20_000,
    ...overrides,
  } as Vehicle;
}

function bid(amount: number): UserBid {
  return { amount, placedAt: '2026-05-16T12:00:00Z' };
}

describe('findComps', () => {
  it('excludes the target vehicle by id', () => {
    const target = makeVehicle({ id: 'T' });
    const pool = [target, makeVehicle({ id: 'A' })];
    const comps = findComps(target, pool);
    expect(comps.map((c) => c.id)).toEqual(['A']);
  });

  it('filters by exact make+model match', () => {
    const target = makeVehicle({ id: 'T' });
    const pool = [
      makeVehicle({ id: 'same', make: 'Mazda', model: 'CX-5' }),
      makeVehicle({ id: 'diff-make', make: 'Honda', model: 'CX-5' }),
      makeVehicle({ id: 'diff-model', make: 'Mazda', model: 'CX-30' }),
    ];
    expect(findComps(target, pool).map((c) => c.id)).toEqual(['same']);
  });

  it(`accepts comps within ±${YEAR_WINDOW} year and rejects outside`, () => {
    const target = makeVehicle({ id: 'T', year: 2022 });
    const pool = [
      makeVehicle({ id: 'older-in', year: 2021 }),
      makeVehicle({ id: 'same', year: 2022 }),
      makeVehicle({ id: 'newer-in', year: 2023 }),
      makeVehicle({ id: 'too-old', year: 2020 }),
      makeVehicle({ id: 'too-new', year: 2024 }),
    ];
    const ids = findComps(target, pool).map((c) => c.id);
    expect(ids).toContain('older-in');
    expect(ids).toContain('same');
    expect(ids).toContain('newer-in');
    expect(ids).not.toContain('too-old');
    expect(ids).not.toContain('too-new');
  });

  it('orders by absolute mileage distance from the target (closest first)', () => {
    const target = makeVehicle({ id: 'T', odometer_km: 50_000 });
    const pool = [
      makeVehicle({ id: 'far-low', odometer_km: 10_000 }),
      makeVehicle({ id: 'near-high', odometer_km: 55_000 }),
      makeVehicle({ id: 'near-low', odometer_km: 47_000 }),
      makeVehicle({ id: 'far-high', odometer_km: 200_000 }),
    ];
    expect(findComps(target, pool).map((c) => c.id)).toEqual([
      'near-low', // |47k-50k| = 3k
      'near-high', // |55k-50k| = 5k
      'far-low', // |10k-50k| = 40k
    ]);
  });

  it(`caps the returned set at COMP_COUNT (${COMP_COUNT})`, () => {
    const target = makeVehicle({ id: 'T', odometer_km: 60_000 });
    const pool = Array.from({ length: 10 }, (_, i) =>
      makeVehicle({ id: `c${i}`, odometer_km: 60_000 + i * 1_000 }),
    );
    expect(findComps(target, pool)).toHaveLength(COMP_COUNT);
  });

  it('returns an empty array when nothing matches', () => {
    const target = makeVehicle({ id: 'T', make: 'Mazda', model: 'CX-5' });
    const pool = [makeVehicle({ id: 'A', make: 'Honda', model: 'Civic' })];
    expect(findComps(target, pool)).toEqual([]);
  });
});

describe('compPriceBand', () => {
  it('returns null when there are no comps', () => {
    const target = makeVehicle({ id: 'T', make: 'Tesla', model: 'Model Y' });
    expect(compPriceBand(target, [target], {})).toBeNull();
  });

  it('returns null when every comp price is zero', () => {
    const target = makeVehicle({ id: 'T' });
    const pool = [
      target,
      makeVehicle({ id: 'A', current_bid: 0 }),
      makeVehicle({ id: 'B', current_bid: 0 }),
    ];
    expect(compPriceBand(target, pool, {})).toBeNull();
  });

  it('drops zero-priced comps from the band so low isn’t pinned at 0', () => {
    const target = makeVehicle({ id: 'T', odometer_km: 60_000 });
    const pool = [
      target,
      makeVehicle({ id: 'fresh', odometer_km: 60_500, current_bid: 0 }),
      makeVehicle({ id: 'A', odometer_km: 61_000, current_bid: 18_000 }),
      makeVehicle({ id: 'B', odometer_km: 62_000, current_bid: 22_000 }),
    ];
    const band = compPriceBand(target, pool, {});
    expect(band).not.toBeNull();
    expect(band!.comps.map((c) => c.id)).not.toContain('fresh');
    expect(band!.prices).toEqual([18_000, 22_000]);
    expect(band!.low).toBe(18_000);
    expect(band!.high).toBe(22_000);
  });

  it('computes low/median/high over the displayed current bids', () => {
    const target = makeVehicle({ id: 'T', odometer_km: 60_000 });
    const pool = [
      target,
      makeVehicle({ id: 'A', odometer_km: 61_000, current_bid: 18_000 }),
      makeVehicle({ id: 'B', odometer_km: 62_000, current_bid: 22_000 }),
      makeVehicle({ id: 'C', odometer_km: 63_000, current_bid: 20_000 }),
    ];
    const band = compPriceBand(target, pool, {});
    expect(band).not.toBeNull();
    expect(band!.low).toBe(18_000);
    expect(band!.median).toBe(20_000);
    expect(band!.high).toBe(22_000);
  });

  it('uses displayedCurrentBid so user bids on comps move the band', () => {
    const target = makeVehicle({ id: 'T', odometer_km: 60_000 });
    const pool = [
      target,
      makeVehicle({ id: 'A', odometer_km: 61_000, current_bid: 18_000 }),
      makeVehicle({ id: 'B', odometer_km: 62_000, current_bid: 22_000 }),
      makeVehicle({ id: 'C', odometer_km: 63_000, current_bid: 20_000 }),
    ];
    const band = compPriceBand(target, pool, { B: [bid(25_000)] });
    expect(band!.high).toBe(25_000);
  });
});

describe('smartPriceVerdict', () => {
  const band = {
    comps: [],
    prices: [18_000, 20_000, 22_000],
    low: 18_000,
    median: 20_000,
    high: 22_000,
  } as const;

  it('returns unknown when the band is null', () => {
    expect(smartPriceVerdict(20_000, null)).toBe('unknown');
  });

  it('returns unknown when the candidate price is zero (no activity)', () => {
    expect(smartPriceVerdict(0, band)).toBe('unknown');
  });

  it('returns below for a price strictly under the band low', () => {
    expect(smartPriceVerdict(17_999, band)).toBe('below');
  });

  it('returns fair at the band low boundary (inclusive)', () => {
    expect(smartPriceVerdict(18_000, band)).toBe('fair');
  });

  it('returns fair at the band high boundary (inclusive)', () => {
    expect(smartPriceVerdict(22_000, band)).toBe('fair');
  });

  it('returns above for a price strictly over the band high', () => {
    expect(smartPriceVerdict(22_001, band)).toBe('above');
  });
});
