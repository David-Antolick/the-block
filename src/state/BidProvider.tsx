// Provider half of the bid state. Hydrates once from localStorage on mount
// (D003), persists on every successful mutation, and surfaces validation
// failures from `validateBid` (pure-math per D012) without committing.
//
// `placeBid` reads and writes through `latestRef` rather than closing over
// `bidsByVehicle` directly. Two synchronous calls in the same render tick
// would otherwise both see the same stale closure and the second commit
// would overwrite the first. A functional setter (`setBidsByVehicle(prev =>
// ...)`) would resolve the staleness but re-runs in React Strict Mode, which
// would double-fire writeJSON and validation. See D019.

import { useCallback, useMemo, useRef, useState } from 'react';
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

  // Mirrors `bidsByVehicle` synchronously so two `placeBid` calls in the same
  // tick both see the prior commit. Updated inline alongside `setBidsByVehicle`
  // so the next read inside `placeBid` reflects the new state without waiting
  // for React's commit.
  const latestRef = useRef<BidsByVehicle>(bidsByVehicle);

  const placeBid = useCallback(
    (vehicle: Vehicle, amount: number): ValidationResult => {
      const current = latestRef.current;
      const existing = current[vehicle.id] ?? EMPTY_BIDS;
      const result = validateBid(amount, vehicle, existing);
      if (!result.ok) return result;

      const next: BidsByVehicle = {
        ...current,
        [vehicle.id]: [...existing, { amount, placedAt: new Date().toISOString() }],
      };
      latestRef.current = next;
      setBidsByVehicle(next);
      writeJSON(STORAGE_KEY, next);
      return result;
    },
    [],
  );

  const value = useMemo<BidContextValue>(
    () => ({ bidsByVehicle, placeBid }),
    [bidsByVehicle, placeBid],
  );

  return <BidContext.Provider value={value}>{children}</BidContext.Provider>;
}
