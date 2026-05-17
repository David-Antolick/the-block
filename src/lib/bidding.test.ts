import { describe, it, expect } from 'vitest';
import type { Vehicle, UserBid } from '../types/vehicle';
import {
  BID_INCREMENT,
  displayedCurrentBid,
  floorStatus,
  minNextBid,
  validateBid,
} from './bidding';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'test-id',
    starting_bid: 10_000,
    current_bid: 12_000,
    reserve_price: 15_000,
    buy_now_price: null,
    ...overrides,
  } as Vehicle;
}

function bid(amount: number): UserBid {
  return { amount, placedAt: '2026-05-16T12:00:00' };
}

describe('displayedCurrentBid', () => {
  it('returns dataset current_bid when no user bids exist', () => {
    expect(displayedCurrentBid(makeVehicle(), [])).toBe(12_000);
  });

  it('returns max user bid when it exceeds dataset current_bid', () => {
    expect(displayedCurrentBid(makeVehicle(), [bid(12_500), bid(13_000)])).toBe(13_000);
  });

  it('returns dataset current_bid when user bids are all below it', () => {
    // Shouldn't happen via validateBid, but the function should still pick the max.
    expect(displayedCurrentBid(makeVehicle(), [bid(11_000)])).toBe(12_000);
  });
});

describe('minNextBid', () => {
  it('returns starting_bid when there is no activity yet', () => {
    const v = makeVehicle({ current_bid: 0, starting_bid: 5_000 });
    expect(minNextBid(v, [])).toBe(5_000);
  });

  it('returns displayed + BID_INCREMENT when bidding is underway', () => {
    expect(minNextBid(makeVehicle(), [])).toBe(12_000 + BID_INCREMENT);
  });

  it('uses the user bid stack to compute the next step', () => {
    expect(minNextBid(makeVehicle(), [bid(12_500)])).toBe(12_500 + BID_INCREMENT);
  });
});

describe('floorStatus', () => {
  it('returns no_floor when reserve_price is null', () => {
    expect(floorStatus(makeVehicle({ reserve_price: null }), [])).toBe('no_floor');
  });

  it('returns not_met when displayed bid is below reserve', () => {
    expect(floorStatus(makeVehicle({ current_bid: 12_000, reserve_price: 15_000 }), [])).toBe(
      'not_met',
    );
  });

  it('returns met when displayed bid equals reserve (boundary)', () => {
    expect(floorStatus(makeVehicle({ current_bid: 15_000, reserve_price: 15_000 }), [])).toBe(
      'met',
    );
  });

  it('returns met when a user bid pushes displayed past reserve', () => {
    const v = makeVehicle({ current_bid: 14_000, reserve_price: 15_000 });
    expect(floorStatus(v, [bid(15_500)])).toBe('met');
  });
});

describe('validateBid', () => {
  it('rejects NaN', () => {
    const r = validateBid(NaN, makeVehicle(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_a_number');
  });

  it('rejects Infinity', () => {
    const r = validateBid(Infinity, makeVehicle(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_a_number');
  });

  it('rejects non-integer amounts (e.g. 12_500.5)', () => {
    const r = validateBid(12_500.5, makeVehicle(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_an_integer');
  });

  it('rejects zero', () => {
    const r = validateBid(0, makeVehicle(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_positive');
  });

  it('rejects negative amounts', () => {
    const r = validateBid(-100, makeVehicle(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_positive');
  });

  it('rejects amounts below minNextBid', () => {
    const v = makeVehicle();
    const r = validateBid(minNextBid(v, []) - 1, v, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('below_min');
  });

  it('accepts exactly the minimum next bid (lower boundary)', () => {
    const v = makeVehicle();
    expect(validateBid(minNextBid(v, []), v, []).ok).toBe(true);
  });

  it('accepts the starting bid as the first valid amount on a fresh lot', () => {
    const v = makeVehicle({ current_bid: 0, starting_bid: 5_000 });
    expect(validateBid(5_000, v, []).ok).toBe(true);
  });

  it('rejects below-starting_bid on a fresh lot', () => {
    const v = makeVehicle({ current_bid: 0, starting_bid: 5_000 });
    const r = validateBid(4_999, v, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('below_min');
  });

  it('accepts a bid exactly equal to buy_now_price (D011 inclusive ceiling)', () => {
    const v = makeVehicle({ buy_now_price: 20_000 });
    expect(validateBid(20_000, v, []).ok).toBe(true);
  });

  it('rejects a bid one dollar above buy_now_price', () => {
    const v = makeVehicle({ buy_now_price: 20_000 });
    const r = validateBid(20_001, v, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('above_buy_now');
  });

  it('permits arbitrarily high bids when buy_now_price is null', () => {
    const v = makeVehicle({ buy_now_price: null });
    expect(validateBid(1_000_000, v, []).ok).toBe(true);
  });

  it('uses the user bid stack to raise the minimum on subsequent bids', () => {
    const v = makeVehicle();
    const stack: UserBid[] = [bid(13_000)];
    const r = validateBid(13_000 + BID_INCREMENT - 1, v, stack);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('below_min');
  });

  it('returns ok for a typical valid mid-range bid', () => {
    expect(validateBid(13_500, makeVehicle(), []).ok).toBe(true);
  });
});
