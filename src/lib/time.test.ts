import { describe, it, expect } from 'vitest';
import { ACTIVE_WINDOW_MS, auctionStatus, msUntil, shiftAuctionStart } from './time';

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
