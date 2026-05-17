// Pure-math bid logic. No React, no time, no auction-status awareness, no DOM
// (D012). UI callers gate Place Bid on auction status before calling this.

import type { Vehicle, UserBid } from '../types/vehicle';
import { formatCurrency } from './format';

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

/** Highest bid in effect — max of dataset seed and any user bids. */
export function displayedCurrentBid(vehicle: Vehicle, userBids: readonly UserBid[]): number {
  let max = vehicle.current_bid;
  for (const b of userBids) {
    if (b.amount > max) max = b.amount;
  }
  return max;
}

/** Smallest amount that clears the next-bid bar. */
export function minNextBid(vehicle: Vehicle, userBids: readonly UserBid[]): number {
  const displayed = displayedCurrentBid(vehicle, userBids);
  if (displayed <= 0) return vehicle.starting_bid;
  return displayed + BID_INCREMENT;
}

/** Floor (reserve) status. UI never surfaces the reserve number itself (D007). */
export function floorStatus(vehicle: Vehicle, userBids: readonly UserBid[]): FloorStatus {
  if (vehicle.reserve_price == null) return 'no_floor';
  return displayedCurrentBid(vehicle, userBids) >= vehicle.reserve_price ? 'met' : 'not_met';
}

/** Validate a prospective bid. Buy-now ceiling is inclusive (D011). */
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
