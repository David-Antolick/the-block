// Provider half of the bid state. Hydrates from localStorage on mount (D003),
// persists on every successful mutation, surfaces validation failures.
//
// `placeBid` reads/writes through `latestRef` rather than closing over
// `bidsByVehicle` — two synchronous calls in the same tick would otherwise
// see the same stale closure and the second commit would clobber the first.
// A functional setter would resolve staleness but re-runs under Strict Mode,
// double-firing writeJSON and validation. See D016.

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
