// Phase 8 (Stretch B) BidPanel surfaces: pill flip at the Closing boundary,
// countdown label + tiered format, aria-live polite only when Closing.
//
// Fake timers + vi.setSystemTime + an inverted-shift helper give a
// deterministic wall-clock that's independent of when time.ts captured
// SESSION_NOW_MS. The inversion probes the offset via shiftAuctionStart
// (anchor round-trips to SESSION_NOW_MS exactly).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import type { Vehicle } from '../types/vehicle';
import { BidProvider } from '../state/BidProvider';
import { ACTIVE_WINDOW_MS, shiftAuctionStart } from '../lib/time';
import BidPanel from './BidPanel';

const DATASET_ANCHOR_MS = Date.UTC(2026, 3, 5, 12, 0, 0);
const SESSION_NOW_MS = new Date(
  shiftAuctionStart(new Date(DATASET_ANCHOR_MS).toISOString()),
).getTime();
const SHIFT_OFFSET = SESSION_NOW_MS - DATASET_ANCHOR_MS;

// Inverts the production shift so a fixture vehicle's shifted start lands
// at a chosen wall-clock moment.
function isoForShiftedStart(shiftedStartMs: number): string {
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
    // 11 minutes remaining — 1 minute past the 10-minute Closing threshold.
    const vehicle = makeActiveVehicle(11 * 60_000, { id: 'flip-vehicle' });
    renderPanel(vehicle);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Closing')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText('Closing')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders "Opens in" / "Closes in" with the tiered format', () => {
    // ≥1h drops seconds.
    const upcoming = makeUpcomingVehicle(65 * 60_000, { id: 'opens-vehicle' });
    const { unmount } = renderPanel(upcoming);
    expect(screen.getByText('Opens in 1h 5m')).toBeInTheDocument();
    unmount();

    // <1h shows zero-padded seconds.
    const closing = makeActiveVehicle(3 * 60_000 + 42_000, { id: 'closes-vehicle' });
    renderPanel(closing);
    expect(screen.getByText('Closes in 3m 42s')).toBeInTheDocument();
  });

  it('aria-live is polite only when the lot is in the Closing window', () => {
    const active = makeActiveVehicle(30 * 60_000, { id: 'active-aria' });
    const { unmount } = renderPanel(active);
    expect(screen.getByText(/^Closes in /)).toHaveAttribute('aria-live', 'off');
    unmount();

    const closing = makeActiveVehicle(5 * 60_000, { id: 'closing-aria' });
    renderPanel(closing);
    expect(screen.getByText(/^Closes in /)).toHaveAttribute('aria-live', 'polite');
  });
});
