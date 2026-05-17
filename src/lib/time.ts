// Auction time helpers — see D006 for the full design (shift, persist, window).
// The frozen-baseline trap caught in Phase 8 is L002.

import { readJSON, writeJSON } from './storage';

// Center of the dataset's time cluster, UTC (D014 — bare ISOs must align).
const DATASET_ANCHOR_MS = Date.UTC(2026, 3, 5, 12, 0, 0);

const SESSION_ANCHOR_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_ANCHOR_KEY = 'session-anchor:v1';

interface PersistedSessionAnchor {
  capturedAt: number;
}

// Reads (or writes) the session-anchor baseline. L002: the shift offset must
// be frozen — recomputing against fresh Date.now() per call collapses
// msUntil(shiftedStart) to a constant and the countdown never ticks.
function resolveSessionAnchor(): number {
  const now = Date.now();
  const stored = readJSON<PersistedSessionAnchor | null>(SESSION_ANCHOR_KEY, null);
  if (
    stored != null &&
    typeof stored.capturedAt === 'number' &&
    Number.isFinite(stored.capturedAt) &&
    now - stored.capturedAt < SESSION_ANCHOR_TTL_MS &&
    stored.capturedAt <= now
  ) {
    return stored.capturedAt;
  }
  writeJSON<PersistedSessionAnchor>(SESSION_ANCHOR_KEY, { capturedAt: now });
  return now;
}

const SESSION_NOW_MS = resolveSessionAnchor();

/** How long a lot is "Active" after its shifted start. 24h per D006. */
export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Tail of the Active window labeled "Closing" (D021). */
export const CLOSING_WINDOW_MS = 10 * 60 * 1000;

export type AuctionStatus = 'upcoming' | 'active' | 'ended';
/** AuctionStatus widened with the Closing display sub-state (D021). */
export type AuctionPhase = AuctionStatus | 'closing';

// Trailing `Z` or numeric offset — any ES-spec timezone designator.
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;

// Bare ISOs as UTC (D014).
function parseDatasetIso(iso: string): number {
  return new Date(HAS_TIMEZONE.test(iso) ? iso : iso + 'Z').getTime();
}

function nowMs(now?: Date): number {
  return (now ?? new Date()).getTime();
}

// Production: frozen SESSION_NOW_MS. Tests pass `now` for per-call override.
function shiftBaselineMs(now?: Date): number {
  return now ? now.getTime() : SESSION_NOW_MS;
}

/** Shift a dataset `auction_start` into the current time frame. */
export function shiftAuctionStart(iso: string, now?: Date): string {
  const offset = shiftBaselineMs(now) - DATASET_ANCHOR_MS;
  const shifted = parseDatasetIso(iso) + offset;
  return new Date(shifted).toISOString();
}

/** Three-state bucket. Boundaries: inclusive at start, exclusive at end. */
export function auctionStatus(iso: string, now?: Date): AuctionStatus {
  const t = nowMs(now);
  const shiftedStart = parseDatasetIso(shiftAuctionStart(iso, now));
  if (shiftedStart > t) return 'upcoming';
  if (t < shiftedStart + ACTIVE_WINDOW_MS) return 'active';
  return 'ended';
}

/** Ms from `now` to `iso`. Positive = future. Bare ISOs are UTC (D014). */
export function msUntil(iso: string, now?: Date): number {
  return parseDatasetIso(iso) - nowMs(now);
}

/** Shifted ISO at which the lot next transitions. `null` for Ended. */
export function nextTransitionIso(iso: string, now?: Date): string | null {
  const shiftedStartIso = shiftAuctionStart(iso, now);
  const status = auctionStatus(iso, now);
  if (status === 'upcoming') return shiftedStartIso;
  if (status === 'active') {
    return new Date(parseDatasetIso(shiftedStartIso) + ACTIVE_WINDOW_MS).toISOString();
  }
  return null;
}

/** Display-layer phase — promotes Active → Closing in the last CLOSING_WINDOW_MS. */
export function auctionPhase(iso: string, now?: Date): AuctionPhase {
  const status = auctionStatus(iso, now);
  if (status !== 'active') return status;
  const endIso = nextTransitionIso(iso, now);
  if (endIso == null) return status;
  return msUntil(endIso, now) <= CLOSING_WINDOW_MS ? 'closing' : 'active';
}

/**
 * Tiered countdown format. ≥1d → "Nd Hh Mm"; ≥1h → "Hh Mm"; else "Mm SSs".
 * Non-positive inputs render "0s" so a stale tick never shows nonsense.
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
