import { describe, it, expect, vi } from 'vitest';
import {
  ACTIVE_WINDOW_MS,
  CLOSING_WINDOW_MS,
  auctionPhase,
  auctionStatus,
  formatCountdown,
  msUntil,
  nextTransitionIso,
  shiftAuctionStart,
} from './time';

// Anchor matches DATASET_ANCHOR_MS in time.ts. Hardcoded here so the test
// would catch an accidental anchor edit on the source side.
const ANCHOR = '2026-04-05T12:00:00.000Z';

describe('shiftAuctionStart', () => {
  it('preserves relative order between two timestamps', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    const earlier = '2026-04-04T08:00:00Z';
    const later = '2026-04-06T18:30:00Z';
    const shiftedEarlier = new Date(shiftAuctionStart(earlier, now)).getTime();
    const shiftedLater = new Date(shiftAuctionStart(later, now)).getTime();
    expect(shiftedEarlier).toBeLessThan(shiftedLater);
    // And the delta between the two is unchanged by the shift.
    expect(shiftedLater - shiftedEarlier).toBe(
      new Date(later).getTime() - new Date(earlier).getTime(),
    );
  });
});

describe('auctionStatus', () => {
  it('returns upcoming when the shifted start is in the future', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    // Two hours after the anchor → shifted start is two hours after `now`.
    const iso = '2026-04-05T14:00:00Z';
    expect(auctionStatus(iso, now)).toBe('upcoming');
  });

  it('returns active at the start boundary and just inside the window', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    // Exactly at the anchor → shifted start === now.
    expect(auctionStatus(ANCHOR, now)).toBe('active');
    // 1 ms before the close of the active window → still active.
    const justBeforeEnd = new Date(
      new Date(ANCHOR).getTime() - (ACTIVE_WINDOW_MS - 1),
    ).toISOString();
    expect(auctionStatus(justBeforeEnd, now)).toBe('active');
  });

  it('returns ended at and past the active-window boundary', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    // Dataset iso such that shifted start is exactly ACTIVE_WINDOW_MS before now.
    const exactlyAtEnd = new Date(new Date(ANCHOR).getTime() - ACTIVE_WINDOW_MS).toISOString();
    expect(auctionStatus(exactlyAtEnd, now)).toBe('ended');
    // And well past.
    const longAgo = '2026-04-01T00:00:00Z';
    expect(auctionStatus(longAgo, now)).toBe('ended');
  });
});

describe('msUntil', () => {
  it('is positive for future timestamps and negative for past ones', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    expect(msUntil('2026-05-16T12:00:10Z', now)).toBe(10_000);
    expect(msUntil('2026-05-16T11:59:50Z', now)).toBe(-10_000);
  });
});

// Dataset timestamps are unzoned (e.g. "2026-04-05T19:00:00"). They must
// parse as UTC to align with DATASET_ANCHOR_MS — if they were left to
// default-parse as local, shift output and status buckets would drift by the
// viewer's timezone offset. This block only exercises the bug under a
// non-UTC timezone; `vite.config.ts` pins `TZ=America/Toronto` for the
// vitest process so this regression actually fires on UTC CI runners too.
describe('parseDatasetIso convention (D014)', () => {
  const now = new Date('2026-05-16T12:00:00Z');
  const bare = '2026-04-05T19:00:00';
  const zoned = '2026-04-05T19:00:00Z';

  it('test environment is non-UTC (guards the regression itself)', () => {
    // If the vitest TZ pin in vite.config.ts gets removed and CI runs under
    // UTC, bare and zoned parse to the same epoch ms and the parity
    // assertions below pass vacuously. Failing here is louder than that.
    expect(new Date(bare).getTime()).not.toBe(new Date(zoned).getTime());
  });

  it('shiftAuctionStart produces identical output for bare vs Z-suffixed', () => {
    expect(shiftAuctionStart(bare, now)).toBe(shiftAuctionStart(zoned, now));
  });

  it('auctionStatus produces identical buckets for bare vs Z-suffixed', () => {
    expect(auctionStatus(bare, now)).toBe(auctionStatus(zoned, now));
  });
});

describe('nextTransitionIso', () => {
  it('targets the shifted start for an upcoming lot', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    const iso = '2026-04-05T14:00:00Z'; // 2h after anchor → 2h after now
    const target = nextTransitionIso(iso, now);
    expect(target).toBe(shiftAuctionStart(iso, now));
    expect(msUntil(target!, now)).toBe(2 * 60 * 60 * 1000);
  });

  it('targets shiftedStart + window for an active lot', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    // Active right at the anchor (shifted start === now)
    const iso = '2026-04-05T12:00:00Z';
    const target = nextTransitionIso(iso, now);
    expect(msUntil(target!, now)).toBe(ACTIVE_WINDOW_MS);
  });

  it('returns null for an ended lot', () => {
    const now = new Date('2026-05-16T12:00:00Z');
    expect(nextTransitionIso('2026-04-01T00:00:00Z', now)).toBeNull();
  });
});

describe('auctionPhase', () => {
  const now = new Date('2026-05-16T12:00:00Z');
  const anchorIso = '2026-04-05T12:00:00Z';
  const anchorMs = new Date(anchorIso).getTime();

  it('passes upcoming/ended through unchanged', () => {
    expect(auctionPhase('2026-04-05T14:00:00Z', now)).toBe('upcoming');
    expect(auctionPhase('2026-04-01T00:00:00Z', now)).toBe('ended');
  });

  it('reports active when remaining window is comfortably above the closing threshold', () => {
    // Lot with ~ACTIVE_WINDOW_MS remaining → not yet closing.
    expect(auctionPhase(anchorIso, now)).toBe('active');
  });

  it('promotes to closing inside the CLOSING_WINDOW_MS tail and at the boundary', () => {
    // Iso such that shifted end == now + (CLOSING_WINDOW_MS - 1ms) → closing.
    const justInsideClosing = new Date(
      anchorMs - ACTIVE_WINDOW_MS + (CLOSING_WINDOW_MS - 1),
    ).toISOString();
    expect(auctionPhase(justInsideClosing, now)).toBe('closing');

    // Exactly at the threshold (msUntil === CLOSING_WINDOW_MS) is still closing
    // — the boundary is inclusive so the pill flips one ms before, not one ms
    // after, the threshold.
    const exactlyAtThreshold = new Date(
      anchorMs - ACTIVE_WINDOW_MS + CLOSING_WINDOW_MS,
    ).toISOString();
    expect(auctionPhase(exactlyAtThreshold, now)).toBe('closing');
  });
});

describe('formatCountdown', () => {
  it('caps at "0s" for non-positive durations', () => {
    expect(formatCountdown(0)).toBe('0s');
    expect(formatCountdown(-5000)).toBe('0s');
  });

  it('formats <1h as "Mm SSs" with a zero-padded seconds field', () => {
    expect(formatCountdown(3 * 60_000 + 42_000)).toBe('3m 42s');
    expect(formatCountdown(3 * 60_000 + 5_000)).toBe('3m 05s');
  });

  it('drops seconds for ≥1h durations', () => {
    // 4h 12m 30s → "4h 12m"
    expect(formatCountdown(4 * 3600_000 + 12 * 60_000 + 30_000)).toBe('4h 12m');
  });

  it('formats ≥1d as "Nd Hh Mm"', () => {
    // 2d 4h 12m 7s → "2d 4h 12m"
    expect(
      formatCountdown(2 * 86400_000 + 4 * 3600_000 + 12 * 60_000 + 7_000),
    ).toBe('2d 4h 12m');
  });
});

// Regression block for the Phase 8 countdown bug: `shiftAuctionStart` used
// to compute its offset against a fresh `Date.now()` per call, which made
// the shifted target drift forward in lockstep with the wall clock — every
// `msUntil(shiftedStart)` came back as a constant and the VDP countdown
// looked frozen. The fix freezes the shift baseline at module load
// (SESSION_NOW_MS); tests still pass `now` explicitly and exercise the
// override path. These tests exercise the *no-`now`* path, since the bug
// only manifested there.
describe('shift baseline is frozen at module load (countdown regression)', () => {
  it('shiftAuctionStart() with no `now` is stable as the wall clock advances', () => {
    const iso = '2026-04-05T13:00:00Z';
    vi.useFakeTimers();
    try {
      const first = shiftAuctionStart(iso);
      vi.advanceTimersByTime(60 * 60_000);
      const second = shiftAuctionStart(iso);
      expect(second).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('msUntil(nextTransitionIso()) decreases by elapsed wall-clock', () => {
    // Anchor + 3d guarantees `upcoming` status regardless of where
    // SESSION_NOW_MS landed at test-file load; the lot won't tick into
    // active inside the 60s of fake-clock advance.
    const iso = '2026-04-08T12:00:00Z';
    vi.useFakeTimers();
    try {
      const target = nextTransitionIso(iso);
      expect(target).not.toBeNull();
      const before = msUntil(target!);
      vi.advanceTimersByTime(60_000);
      const after = msUntil(target!);
      expect(after).toBe(before - 60_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
