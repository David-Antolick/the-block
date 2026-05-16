// Pure-math bid logic. No React, no time, no auction-status awareness, no DOM.
// Per D012, every check here is over `(amount, vehicle, userBids)` only —
// callers (UI) are responsible for gating Place-Bid on auction status, etc.

import type { Vehicle, UserBid } from '../types/vehicle';
import { formatCurrency } from './format';

/** Minimum dollar step between consecutive valid bids. */
export const BID_INCREMENT = 100;

export type BidRejectionReason =
  | 'not_a_number'
  | 'not_an_integer'
  | 'not_positive'
  | 'below_min'
  | 'above_buy_now';

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: BidRejectionReason; message: string };

export type FloorStatus = 'met' | 'not_met' | 'no_floor';

/**
 * Highest bid currently in effect: the larger of the seeded dataset bid and any
 * user-placed bid stack. Returns 0 only if the dataset itself has no current_bid
 * and the user hasn't bid (shouldn't happen for the curated dataset).
 */
export function displayedCurrentBid(vehicle: Vehicle, userBids: readonly UserBid[]): number {
  let max = vehicle.current_bid;
  for (const b of userBids) {
    if (b.amount > max) max = b.amount;
  }
  return max;
}

/**
 * Smallest amount that would clear the next-bid bar. Equal to starting_bid for
 * a lot with no activity, otherwise displayed-current + BID_INCREMENT.
 */
export function minNextBid(vehicle: Vehicle, userBids: readonly UserBid[]): number {
  const displayed = displayedCurrentBid(vehicle, userBids);
  if (displayed <= 0) return vehicle.starting_bid;
  return displayed + BID_INCREMENT;
}

/**
 * Three-state floor (reserve) status. Returns 'no_floor' if the lot has no
 * reserve_price set — per OPENLANE convention, the UI never reveals the floor
 * number itself, only whether it's been cleared. Named without an `is` prefix
 * because the return is a union, not a boolean (an `isX` name would invite
 * truthy-checks that are wrong for two of the three states).
 */
export function floorStatus(vehicle: Vehicle, userBids: readonly UserBid[]): FloorStatus {
  if (vehicle.reserve_price == null) return 'no_floor';
  return displayedCurrentBid(vehicle, userBids) >= vehicle.reserve_price ? 'met' : 'not_met';
}

/**
 * Validate a prospective bid amount against the dataset + user bid stack.
 * Returns ok:true or a typed rejection with a user-presentable message. Bid
 * amounts must be positive integers; the upper bound (buy_now_price) is
 * inclusive (D011).
 */
export function validateBid(
  amount: number,
  vehicle: Vehicle,
  userBids: readonly UserBid[],
): ValidationResult {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { ok: false, reason: 'not_a_number', message: 'Enter a bid amount.' };
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, reason: 'not_an_integer', message: 'Bid must be a whole dollar amount.' };
  }
  if (amount <= 0) {
    return { ok: false, reason: 'not_positive', message: 'Bid must be greater than zero.' };
  }

  const min = minNextBid(vehicle, userBids);
  if (amount < min) {
    return {
      ok: false,
      reason: 'below_min',
      message: `Minimum next bid is ${formatCurrency(min)}.`,
    };
  }

  if (vehicle.buy_now_price != null && amount > vehicle.buy_now_price) {
    return {
      ok: false,
      reason: 'above_buy_now',
      message: `Bid cannot exceed the Buy Now price of ${formatCurrency(vehicle.buy_now_price)}.`,
    };
  }

  return { ok: true };
}
