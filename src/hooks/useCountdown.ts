// Live ms-remaining hook for the VDP countdown + Closing-pill reactivity
// (Stretch B / D021). Sets up a `setInterval` only when there's a target in
// the future, and clears on every dep change + unmount so navigating between
// VDPs doesn't leak timers.
//
// Implementation note (L###): the remaining value is *derived on read* from
// `Date.now()` rather than held in state — the effect only increments a tick
// counter from inside the interval callback. This mirrors the Phase 6 fix
// for `react-hooks/set-state-in-effect` in ImageGallery: don't synchronize
// state inside an effect body when you can compute it at render time. A
// target change naturally recomputes on the next render; no resync needed.
//
// Scope choice (D021): used on the VDP only — the inventory grid evaluates
// `auctionPhase` once per render and accepts that a card sitting on screen
// won't auto-flip from Active → Closing → Ended without a refresh. Per-card
// ticking on the grid was the alternative; rejected on cost (200 timers) vs.
// signal (one card flipping mid-scan isn't load-bearing for the demo).

import { useEffect, useState } from 'react';
import { msUntil } from '../lib/time';

interface Options {
  /** Tick cadence in ms. Default 1000 — buyers feel the per-second tick on the
   *  last-minute countdown. Higher cadence is fine for longer horizons. */
  intervalMs?: number;
  /** Short-circuit the interval when the caller already knows there's nothing
   *  to count toward (e.g. an Ended lot). Avoids paying for a no-op timer. */
  enabled?: boolean;
}

/**
 * Milliseconds remaining until `targetIso`. `null` when disabled or when
 * `targetIso` is null. Clamped to `0` once the target has passed so the
 * pre-cleanup render of a just-expired countdown shows "0s", never a
 * negative number that a downstream formatter has to defend against.
 */
export function useCountdown(
  targetIso: string | null,
  { intervalMs = 1000, enabled = true }: Options = {},
): number | null {
  const active = enabled && targetIso != null;
  // The tick value itself doesn't matter — it's just a re-render signal.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return active ? Math.max(0, msUntil(targetIso!)) : null;
}
