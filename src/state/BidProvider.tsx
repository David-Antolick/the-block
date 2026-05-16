// Provider half of the bid state. Hydrates once from localStorage on mount
// (D003), persists on every successful mutation, and surfaces validation
// failures from `validateBid` (pure-math per D012) without committing.

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Vehicle } from '../types/vehicle';
import { validateBid, type ValidationResult } from '../lib/bidding';
import { readJSON, writeJSON } from '../lib/storage';
import {
  BidContext,
  EMPTY_BIDS,
  type BidContextValue,
  type BidsByVehicle,
} from './bid-context';

const STORAGE_KEY = 'bids:v1';

export function BidProvider({ children }: { children: ReactNode }) {
  const [bidsByVehicle, setBidsByVehicle] = useState<BidsByVehicle>(() =>
    readJSON<BidsByVehicle>(STORAGE_KEY, {}),
  );

  const placeBid = useCallback(
    (vehicle: Vehicle, amount: number): ValidationResult => {
      const existing = bidsByVehicle[vehicle.id] ?? EMPTY_BIDS;
      const result = validateBid(amount, vehicle, existing);
      if (!result.ok) return result;

      const next: BidsByVehicle = {
        ...bidsByVehicle,
        [vehicle.id]: [...existing, { amount, placedAt: new Date().toISOString() }],
      };
      setBidsByVehicle(next);
      writeJSON(STORAGE_KEY, next);
      return result;
    },
    [bidsByVehicle],
  );

  const value = useMemo<BidContextValue>(
    () => ({ bidsByVehicle, placeBid }),
    [bidsByVehicle, placeBid],
  );

  return <BidContext.Provider value={value}>{children}</BidContext.Provider>;
}
