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

/**
 * How long after `auction_start` a lot is considered "Active". Picked at 6h
 * (per I2 in the build plan) so the inventory has enough live lots to feel
 * alive without making "Ended" a rarity. Tune in Phase 9 if the mix is off.
 */
export const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

export type AuctionStatus = 'upcoming' | 'active' | 'ended';

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

/**
 * Shift a dataset `auction_start` ISO string into the current time frame.
 * The offset `(now - DATASET_ANCHOR)` is the same for every timestamp, so
 * relative ordering between lots is preserved exactly.
 */
export function shiftAuctionStart(iso: string, now?: Date): string {
  const offset = nowMs(now) - DATASET_ANCHOR_MS;
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
