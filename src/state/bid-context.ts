// Non-component half of the bid state — context, hooks, types. Split from
// BidProvider.tsx for HMR (D016, L001).

import { createContext, useContext } from 'react';
import type { UserBid, Vehicle } from '../types/vehicle';
import type { ValidationResult } from '../lib/bidding';

// Shared frozen empty so useBidsFor returns a referentially stable array —
// prevents downstream useMemo/useEffect deps from thrashing.
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

export function useBids(): BidsByVehicle {
  return useBidContext().bidsByVehicle;
}

export function useBidsFor(vehicleId: string): readonly UserBid[] {
  return useBidContext().bidsByVehicle[vehicleId] ?? EMPTY_BIDS;
}

export function usePlaceBid(): BidContextValue['placeBid'] {
  return useBidContext().placeBid;
}
