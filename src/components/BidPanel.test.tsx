// Component coverage for the three Phase 8 (Stretch B) surfaces that landed
// on BidPanel without unit coverage at the time:
//   1. Pill flip from Active → Closing at the CLOSING_WINDOW_MS boundary
//   2. Countdown label + tiered format ("Opens in 1h 5m", "Closes in 3m 42s")
//   3. `aria-live="polite"` only when the lot is in the Closing window
//
// Approach: fake timers + a `vi.setSystemTime` baseline so the wall-clock
// position is deterministic, plus an `auction_start` constructor that
// inverts the production shift so a vehicle ends up at a chosen wall-clock
// moment regardless of what `SESSION_NOW_MS` happened to capture at module
// load. The inversion probes the shift offset via `shiftAuctionStart(anchor)`
// — that round-trip is exactly `SESSION_NOW_MS`, no need to export it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import type { Vehicle } from '../types/vehicle';
import { BidProvider } from '../state/BidProvider';
import { ACTIVE_WINDOW_MS, shiftAuctionStart } from '../lib/time';
import BidPanel from './BidPanel';

const DATASET_ANCHOR_MS = Date.UTC(2026, 3, 5, 12, 0, 0);
// `shiftAuctionStart(anchor)` round-trips to `anchor + (SESSION_NOW_MS -
// anchor)` = SESSION_NOW_MS exactly. Probing this way keeps the test
// independent of when the time.ts module happened to load.
const SESSION_NOW_MS = new Date(
  shiftAuctionStart(new Date(DATASET_ANCHOR_MS).toISOString()),
).getTime();
const SHIFT_OFFSET = SESSION_NOW_MS - DATASET_ANCHOR_MS;

function isoForShiftedStart(shiftedStartMs: number): string {
  // Inverts the production shift: parse(iso) = shiftedStartMs - SHIFT_OFFSET.
  return new Date(shiftedStartMs - SHIFT_OFFSET).toISOString();
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'test-vehicle',
    vin: '1HGCM82633A123456',
    year: 2022,
    make: 'Test',
    model: 'Model',
    trim: 'Base',
    body_style: 'sedan',
    exterior_color: 'black',
    interior_color: 'black',
    engine: '2.0L I4',
    transmission: 'automatic',
    drivetrain: 'FWD',
    odometer_km: 50000,
    fuel_type: 'gasoline',
    condition_grade: 4.0,
    condition_report: '',
    damage_notes: [],
    title_status: 'clean',
    province: 'ON',
    city: 'Toronto',
    auction_start: new Date(DATASET_ANCHOR_MS).toISOString(),
    starting_bid: 5000,
    reserve_price: null,
    buy_now_price: null,
    images: [],
    selling_dealership: 'Test Dealer',
    lot: 'LOT-001',
    current_bid: 10000,
    bid_count: 2,
    ...overrides,
  };
}

function makeUpcomingVehicle(msUntilStart: number, overrides: Partial<Vehicle> = {}): Vehicle {
  return makeVehicle({
    auction_start: isoForShiftedStart(Date.now() + msUntilStart),
    ...overrides,
  });
}

function makeActiveVehicle(msRemainingInWindow: number, overrides: Partial<Vehicle> = {}): Vehicle {
  const shiftedStart = Date.now() + msRemainingInWindow - ACTIVE_WINDOW_MS;
  return makeVehicle({
    auction_start: isoForShiftedStart(shiftedStart),
    ...overrides,
  });
}

function renderPanel(vehicle: Vehicle) {
  return render(
    <BidProvider>
      <BidPanel vehicle={vehicle} />
    </BidProvider>,
  );
}

describe('BidPanel — Phase 8 surfaces', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SESSION_NOW_MS));
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('flips the pill from Active to Closing when the remaining window crosses the threshold', () => {
    // 11 minutes remaining — 1 minute past the 10-minute closing threshold.
    const vehicle = makeActiveVehicle(11 * 60_000, { id: 'flip-vehicle' });
    renderPanel(vehicle);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Closing')).not.toBeInTheDocument();

    // Advance the wall clock by 61s (one second past the boundary). The
    // countdown's interval callback fires, triggering re-renders, and
    // `auctionPhase` recomputes against the mocked Date.now().
    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText('Closing')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders "Opens in" / "Closes in" with the tiered format', () => {
    // ≥1h horizon drops seconds → "1h 5m".
    const upcoming = makeUpcomingVehicle(65 * 60_000, { id: 'opens-vehicle' });
    const { unmount } = renderPanel(upcoming);
    expect(screen.getByText('Opens in 1h 5m')).toBeInTheDocument();
    unmount();

    // <1h horizon shows zero-padded seconds → "3m 42s".
    const closing = makeActiveVehicle(3 * 60_000 + 42_000, { id: 'closes-vehicle' });
    renderPanel(closing);
    expect(screen.getByText('Closes in 3m 42s')).toBeInTheDocument();
  });

  it('aria-live is polite only when the lot is in the Closing window', () => {
    // Active but not closing — 30m remaining is well above the threshold.
    const active = makeActiveVehicle(30 * 60_000, { id: 'active-aria' });
    const { unmount } = renderPanel(active);
    expect(screen.getByText(/^Closes in /)).toHaveAttribute('aria-live', 'off');
    unmount();

    // Inside the closing window — 5m remaining. Same "Closes in" label, but
    // the announcement intent flips.
    const closing = makeActiveVehicle(5 * 60_000, { id: 'closing-aria' });
    renderPanel(closing);
    expect(screen.getByText(/^Closes in /)).toHaveAttribute('aria-live', 'polite');
  });
});
