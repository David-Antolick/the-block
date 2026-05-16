// Non-component half of the bid state: the context object, the hooks, and
// the shared types. Split out from BidProvider.tsx so the provider file can
// keep React Refresh HMR (`react-refresh/only-export-components`).
//
// Persistence and the placeBid action live in BidProvider.tsx — this file is
// just the read surface that pages consume.

import { createContext, useContext } from 'react';
import type { UserBid, Vehicle } from '../types/vehicle';
import type { ValidationResult } from '../lib/bidding';

// Reused for vehicles with no bids so `useBidsFor` returns a referentially
// stable empty array — prevents downstream `useMemo`/`useEffect` deps from
// thrashing when an unrelated vehicle's bids change. Exported so the
// provider's commit path can use the same reference (avoiding two parallel
// frozen empties).
export const EMPTY_BIDS: readonly UserBid[] = Object.freeze([]);

export type BidsByVehicle = Readonly<Record<string, readonly UserBid[]>>;

export interface BidContextValue {
  bidsByVehicle: BidsByVehicle;
  placeBid: (vehicle: Vehicle, amount: number) => ValidationResult;
}

export const BidContext = createContext<BidContextValue | null>(null);

function useBidContext(): BidContextValue {
  const ctx = useContext(BidContext);
  if (ctx === null) {
    throw new Error('useBids/useBidsFor/usePlaceBid must be used inside <BidProvider>.');
  }
  return ctx;
}

/** Full map of user bids keyed by vehicle id. */
export function useBids(): BidsByVehicle {
  return useBidContext().bidsByVehicle;
}

/** User bids for a single vehicle, or a stable empty array if none. */
export function useBidsFor(vehicleId: string): readonly UserBid[] {
  return useBidContext().bidsByVehicle[vehicleId] ?? EMPTY_BIDS;
}

/**
 * Returns a `placeBid(vehicle, amount)` action. The action revalidates against
 * current state at commit time, so a stale UI preview can't push through an
 * invalid bid; callers should still call `validateBid` for inline feedback.
 */
export function usePlaceBid(): BidContextValue['placeBid'] {
  return useBidContext().placeBid;
}
