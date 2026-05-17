// Inventory grid card. Title-brand badge top-left (D021); headline price via
// formatCurrency; floor copy is state-only, never the reserve number (D007).

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '../types/vehicle';
import { displayedCurrentBid, floorStatus } from '../lib/bidding';
import type { CompPriceBand } from '../lib/comps';
import { compPriceBand, smartPriceVerdict } from '../lib/comps';
import { VEHICLES } from '../data/vehicles';
import { formatCurrency, formatOdometer } from '../lib/format';
import { auctionPhase, type AuctionPhase } from '../lib/time';
import { useBids, useBidsFor } from '../state/bid-context';
import SmartPriceBadge from './SmartPriceBadge';

interface Props {
  vehicle: Vehicle;
  /** Comp band. `null` = no signal; `undefined` = no precompute, card computes its own. */
  band?: CompPriceBand | null | undefined;
}

const PHASE_LABEL: Record<AuctionPhase, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  closing: 'Closing',
  ended: 'Ended',
};

const PHASE_PILL_CLASS: Record<AuctionPhase, string> = {
  upcoming: 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200',
  active: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  closing:
    'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300 animate-pulse',
  ended: 'bg-zinc-200 text-zinc-600 ring-1 ring-inset ring-zinc-300',
};

function TitleBrandBadge({ status }: { status: Vehicle['title_status'] }) {
  if (status === 'clean') return null;
  const isSalvage = status === 'salvage';
  return (
    <span
      role="note"
      aria-label={`${isSalvage ? 'Salvage' : 'Rebuilt'} title brand`}
      className={
        isSalvage
          ? 'absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow'
          : 'absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow'
      }
    >
      <span
        aria-hidden="true"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/25 text-[10px] font-bold leading-none"
      >
        !
      </span>
      {isSalvage ? 'Salvage title' : 'Rebuilt title'}
    </span>
  );
}

export default function VehicleCard({ vehicle, band: providedBand }: Props) {
  const userBids = useBidsFor(vehicle.id);
  const bidsByVehicle = useBids();
  const headline = displayedCurrentBid(vehicle, userBids);
  const phase = auctionPhase(vehicle.auction_start);
  const floor = floorStatus(vehicle, userBids);
  const heroImage = vehicle.images[0];
  const heroAlt = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  // Lazy fallback when the page hasn't precomputed (filter-off path).
  const fallbackBand = useMemo(
    () =>
      providedBand !== undefined ? null : compPriceBand(vehicle, VEHICLES, bidsByVehicle),
    [providedBand, vehicle, bidsByVehicle],
  );
  const band = providedBand !== undefined ? providedBand : fallbackBand;
  const verdict = smartPriceVerdict(headline, band);

  return (
    <Link
      to={`/vehicle/${vehicle.id}`}
      className="group flex h-full flex-col rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-zinc-100">
        <TitleBrandBadge status={vehicle.title_status} />
        <span
          className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_PILL_CLASS[phase]}`}
        >
          {PHASE_LABEL[phase]}
        </span>
        {heroImage ? (
          <img
            src={heroImage}
            alt={heroAlt}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-zinc-900">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <p className="truncate text-xs text-zinc-500">
              {vehicle.trim} · Lot {vehicle.lot}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-700">
            Cond {vehicle.condition_grade.toFixed(1)}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600">
          <div className="flex gap-1">
            <dt className="text-zinc-400">Odo</dt>
            <dd className="truncate tabular-nums text-zinc-700">
              {formatOdometer(vehicle.odometer_km)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-zinc-400">Body</dt>
            <dd className="truncate text-zinc-700">{vehicle.body_style}</dd>
          </div>
          <div className="col-span-2 flex gap-1">
            <dt className="text-zinc-400">Loc</dt>
            <dd className="truncate text-zinc-700">
              {vehicle.city}, {vehicle.province}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Current bid</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-900">
              {formatCurrency(headline)}
            </p>
            <p className="text-[11px] text-zinc-500">
              {vehicle.bid_count} {vehicle.bid_count === 1 ? 'bid' : 'bids'}
              {floor === 'met' && (
                <>
                  {' '}
                  · <span className="text-emerald-700">Floor Met</span>
                </>
              )}
              {floor === 'not_met' && (
                <>
                  {' '}
                  · <span className="text-zinc-600">Floor Not Yet Met</span>
                </>
              )}
            </p>
          </div>
          <SmartPriceBadge
            verdict={verdict}
            band={band}
            tooltipId={`smart-price-${vehicle.id}`}
            interactive={false}
          />
        </div>
      </div>
    </Link>
  );
}
