// Phase 9a coverage for the inventory-card invariants the trust thesis hangs
// on (CLAUDE.md):
//   1. Salvage title brand surfaces a prominent corner badge with role="note".
//      The card-grid scan is the first surface a buyer hits — losing the
//      visible salvage signal would defeat the whole "title-brand prominence"
//      half of the thesis (D008).
//   2. Headline current bid routes through `formatCurrency()` rather than an
//      inline `${value}` interpolation. Asserts the locale/currency choke
//      point (CLAUDE.md's centralized-formatting invariant) hasn't been
//      bypassed for the most-rendered price on the site.
//   3. User-placed bids stack on top of dataset `current_bid` via
//      `displayedCurrentBid` — confirms the card listens to BidContext, not
//      just the static seed.

import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Vehicle } from '../types/vehicle';
import { BidProvider } from '../state/BidProvider';
import { usePlaceBid } from '../state/bid-context';
import { formatCurrency } from '../lib/format';
import VehicleCard from './VehicleCard';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'card-test',
    vin: '1HGCM82633A123456',
    year: 2022,
    make: 'Mazda',
    model: 'CX-5',
    trim: 'Touring',
    body_style: 'SUV',
    exterior_color: 'Blue',
    interior_color: 'Black',
    engine: '2.5L I4',
    transmission: 'automatic',
    drivetrain: 'AWD',
    odometer_km: 50_000,
    fuel_type: 'gasoline',
    condition_grade: 4,
    condition_report: '',
    damage_notes: [],
    title_status: 'clean',
    province: 'ON',
    city: 'Toronto',
    auction_start: '2026-04-05T12:00:00Z',
    starting_bid: 10_000,
    reserve_price: null,
    buy_now_price: null,
    images: ['https://example.test/img.jpg'],
    selling_dealership: 'Test Dealer',
    lot: 'A-0001',
    current_bid: 15_000,
    bid_count: 3,
    ...overrides,
  };
}

function renderCard(vehicle: Vehicle) {
  return render(
    <MemoryRouter>
      <BidProvider>
        <VehicleCard vehicle={vehicle} />
      </BidProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('VehicleCard — title-brand prominence', () => {
  it('renders a "Salvage title" badge for salvage lots', () => {
    renderCard(makeVehicle({ title_status: 'salvage' }));
    const badge = screen.getByRole('note', { name: /salvage title/i });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/Salvage title/i);
  });

  it('renders a "Rebuilt title" badge for rebuilt lots', () => {
    renderCard(makeVehicle({ title_status: 'rebuilt' }));
    expect(screen.getByRole('note', { name: /rebuilt title/i })).toBeInTheDocument();
  });

  it('renders no title-brand badge for clean lots', () => {
    renderCard(makeVehicle({ title_status: 'clean' }));
    // Phase pill also uses role="note" via aria-label nowhere; querying by the
    // brand-specific accessible name is the precise check.
    expect(screen.queryByRole('note', { name: /(salvage|rebuilt) title/i })).toBeNull();
  });
});

describe('VehicleCard — currency invariant', () => {
  it('headline current bid is rendered via formatCurrency (single choke-point)', () => {
    const vehicle = makeVehicle({ current_bid: 21_000 });
    renderCard(vehicle);
    // Asserting the *exact* output of formatCurrency (locale-formatted CAD)
    // catches any future inline ${value} interpolation that drops the locale
    // or sneaks a stray "$" into the card.
    expect(screen.getByText(formatCurrency(21_000))).toBeInTheDocument();
  });

  it('reflects displayedCurrentBid when a user bid exceeds the dataset seed', () => {
    const vehicle = makeVehicle({ id: 'stacked', current_bid: 15_000 });

    function Harness() {
      const placeBid = usePlaceBid();
      return (
        <>
          <button
            onClick={() => placeBid(vehicle, 17_500)}
            type="button"
          >
            seed-bid
          </button>
          <VehicleCard vehicle={vehicle} />
        </>
      );
    }

    render(
      <MemoryRouter>
        <BidProvider>
          <Harness />
        </BidProvider>
      </MemoryRouter>,
    );

    // Pre-bid: card shows the dataset seed.
    expect(screen.getByText(formatCurrency(15_000))).toBeInTheDocument();
    act(() => {
      screen.getByText('seed-bid').click();
    });
    // Post-bid: card listens to BidContext and headline reflects the user bid.
    expect(screen.getByText(formatCurrency(17_500))).toBeInTheDocument();
    expect(screen.queryByText(formatCurrency(15_000))).toBeNull();
  });
});
