// Auction time helpers. Per D006, the dataset's `auction_start` timestamps
// cluster around April 2026 — every lot would look "Ended" against today's
// clock without normalization. We shift each timestamp by `now - DATASET_ANCHOR`
// so the demo has a believable mix of upcoming / active / ended lots.
//
// Status labels use the same lowercase-union convention as `FloorStatus` in
// bidding.ts so consumers can `switch` on a known set of strings.

// Anchor at the center of the dataset's time-cluster (per D006). Anchored in
// UTC explicitly (see D014) so the shift offset is the same in every timezone.
const DATASET_ANCHOR_MS = Date.UTC(2026, 3, 5, 12, 0, 0);

// Captured once at module load. The shift is a *one-time* anchor adjustment
// — picking the dataset's distribution-of-times against today's wall clock,
// then letting real time naturally advance from that baseline. (L###:
// computing the offset against a fresh `Date.now()` per-call defeats the
// shift — the target moves forward in lockstep with the wall clock, so
// `msUntil(shiftedStart) === parse(iso) - anchor` becomes constant and
// `auctionStatus` / countdowns never advance. Tests pass `now` explicitly
// so they exercise the override path, which is still per-call.)
const SESSION_NOW_MS = Date.now();

/**
 * How long after `auction_start` a lot is considered "Active". Picked at 6h
 * (per I2 in the build plan) so the inventory has enough live lots to feel
 * alive without making "Ended" a rarity. Tune in Phase 9 if the mix is off.
 */
export const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Tail of the Active window during which the lot is re-labelled "Closing"
 * (Stretch B / D021). Mirrors OPENLANE's lifecycle vocabulary (D007) — the
 * last few minutes are visibly distinct from the rest of the Active window.
 */
export const CLOSING_WINDOW_MS = 10 * 60 * 1000;

export type AuctionStatus = 'upcoming' | 'active' | 'ended';
/**
 * `AuctionStatus` widened with the Closing sub-state. The state machine
 * progression is `upcoming → active → closing → ended`. `auctionStatus`
 * stays on the three-state union (it's the engine for filter/sort math and
 * shouldn't get a fourth bucket that changes by the minute); `auctionPhase`
 * is the consumer-facing variant that adds Closing as a display state.
 */
export type AuctionPhase = AuctionStatus | 'closing';

// Matches a trailing `Z` or a numeric `+HH:MM` / `-HHMM` offset — anything
// the ES spec recognizes as a timezone designator on an ISO 8601 string.
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parse a dataset ISO into epoch ms, treating bare (unzoned) strings as UTC
 * so they align with `DATASET_ANCHOR_MS` (D014). Dataset values like
 * `"2026-04-05T19:00:00"` would otherwise parse as local time per the ES
 * spec, making the shift output and `auctionStatus` buckets vary by viewer
 * timezone. Already-zoned inputs (Z-suffixed or `±HH:MM`) pass through.
 */
function parseDatasetIso(iso: string): number {
  return new Date(HAS_TIMEZONE.test(iso) ? iso : iso + 'Z').getTime();
}

function nowMs(now?: Date): number {
  return (now ?? new Date()).getTime();
}

// Production callers (no explicit `now`) use the session baseline so the
// shift target is stable across renders; tests that pass `now` get the
// per-call behavior they wrote against.
function shiftBaselineMs(now?: Date): number {
  return now ? now.getTime() : SESSION_NOW_MS;
}

/**
 * Shift a dataset `auction_start` ISO string into the current time frame.
 * The offset `(baseline - DATASET_ANCHOR)` is the same for every timestamp,
 * so relative ordering between lots is preserved exactly. In production the
 * baseline is frozen at module load (SESSION_NOW_MS) so the shifted target
 * is a fixed wall-clock moment that countdowns can tick toward.
 */
export function shiftAuctionStart(iso: string, now?: Date): string {
  const offset = shiftBaselineMs(now) - DATASET_ANCHOR_MS;
  const shifted = parseDatasetIso(iso) + offset;
  return new Date(shifted).toISOString();
}

/**
 * Bucket a dataset `auction_start` into one of three demo-visible states.
 * Boundaries: a lot at exactly its (shifted) start time is 'active'; a lot
 * at exactly `start + ACTIVE_WINDOW_MS` is 'ended'.
 */
export function auctionStatus(iso: string, now?: Date): AuctionStatus {
  const t = nowMs(now);
  const shiftedStart = parseDatasetIso(shiftAuctionStart(iso, now));
  if (shiftedStart > t) return 'upcoming';
  if (t < shiftedStart + ACTIVE_WINDOW_MS) return 'active';
  return 'ended';
}

/**
 * Milliseconds from `now` to the given ISO timestamp. Positive when `iso`
 * is in the future, negative when in the past. Generic helper — callers can
 * pass any target time (e.g. a shifted start, or `shiftedStart + window` for
 * "ms until close" countdowns). Bare ISOs are treated as UTC (D014).
 */
export function msUntil(iso: string, now?: Date): number {
  return parseDatasetIso(iso) - nowMs(now);
}

/**
 * The shifted ISO timestamp at which the lot transitions to its next state
 * (Upcoming → Active at shifted start; Active → Ended at shifted start +
 * window). Returns `null` for lots that have already Ended.
 *
 * Single source of truth for the "what should the countdown count toward?"
 * question — `useCountdown` and `auctionPhase` both ride on this.
 */
export function nextTransitionIso(iso: string, now?: Date): string | null {
  const shiftedStartIso = shiftAuctionStart(iso, now);
  const status = auctionStatus(iso, now);
  if (status === 'upcoming') return shiftedStartIso;
  if (status === 'active') {
    return new Date(parseDatasetIso(shiftedStartIso) + ACTIVE_WINDOW_MS).toISOString();
  }
  return null;
}

/**
 * Display-layer phase that promotes an Active lot to "Closing" once its
 * remaining window dips below `CLOSING_WINDOW_MS`. Pure derivation from
 * `auctionStatus` + the time-to-end target; callers don't need to reach into
 * the window constants themselves.
 */
export function auctionPhase(iso: string, now?: Date): AuctionPhase {
  const status = auctionStatus(iso, now);
  if (status !== 'active') return status;
  const endIso = nextTransitionIso(iso, now);
  if (endIso == null) return status;
  return msUntil(endIso, now) <= CLOSING_WINDOW_MS ? 'closing' : 'active';
}

/**
 * Format a ms duration as a coarse countdown. Three tiers so the string
 * fits the time scale without dragging seconds into a multi-day countdown:
 *   ≥ 1d → "2d 4h 12m"   (no seconds — too noisy at this scale)
 *   ≥ 1h → "4h 12m"      (minute resolution is plenty when an hour out)
 *   else → "3m 42s"      (seconds visible — buyers care in the last minutes)
 * Negative / zero inputs return "0s" so a stale tick never shows nonsense.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
