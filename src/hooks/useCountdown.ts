// Live ms-remaining hook for the VDP countdown (D021). ms is derived on read
// from Date.now() rather than held in state — the effect only increments a
// tick counter from inside the interval callback, same shape as
// ImageGallery's safeIndex (avoids `react-hooks/set-state-in-effect`).

import { useEffect, useState } from 'react';
import { msUntil } from '../lib/time';

interface Options {
  intervalMs?: number;
  /** Short-circuits the interval when there's nothing to count toward. */
  enabled?: boolean;
}

export function useCountdown(
  targetIso: string | null,
  { intervalMs = 1000, enabled = true }: Options = {},
): number | null {
  const active = enabled && targetIso != null;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return active ? Math.max(0, msUntil(targetIso!)) : null;
}
