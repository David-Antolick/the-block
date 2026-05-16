// Inventory grid card. Per CLAUDE.md: title-brand badge prominent in the top
// corner (red for salvage, amber for rebuilt, hidden for clean); headline price
// uses `displayedCurrentBid(vehicle, userBidsForThisVehicle)` routed through
// `formatCurrency()`; floor copy is "Floor Met" / "Floor Not Yet Met" only —
// never the reserve number; auction-status pill via `auctionStatus()` labelled
// "Upcoming" / "Active" / "Ended"; whole card is a `<Link>` to the VDP. The
// SmartPriceBadge bottom-right of the price block carries the Phase 7 verdict.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '../types/vehicle';
import { displayedCurrentBid, floorStatus } from '../lib/bidding';
import { compPriceBand, smartPriceVerdict } from '../lib/comps';
import { VEHICLES } from '../data/vehicles';
import { formatCurrency, formatOdometer } from '../lib/format';
import { auctionStatus, type AuctionStatus } from '../lib/time';
import { useBids, useBidsFor } from '../state/bid-context';
import SmartPriceBadge from './SmartPriceBadge';

interface Props {
  vehicle: Vehicle;
}

// Pill copy is OPENLANE's lifecycle vocabulary (D007). Per CLAUDE.md, "Closing"
// is reserved for Stretch B and not surfaced here yet.
const STATUS_LABEL: Record<AuctionStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  ended: 'Ended',
};

const STATUS_PILL_CLASS: Record<AuctionStatus, string> = {
  upcoming: 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200',
  active: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  ended: 'bg-zinc-200 text-zinc-600 ring-1 ring-inset ring-zinc-300',
};

function TitleBrandBadge({ status }: { status: Vehicle['title_status'] }) {
  if (status === 'clean') return null;
  const isSalvage = status === 'salvage';
  return (
    <span
      className={
        isSalvage
          ? 'absolute left-2 top-2 z-10 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow'
          : 'absolute left-2 top-2 z-10 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow'
      }
    >
      {isSalvage ? 'Salvage title' : 'Rebuilt title'}
    </span>
  );
}

export default function VehicleCard({ vehicle }: Props) {
  const userBids = useBidsFor(vehicle.id);
  const bidsByVehicle = useBids();
  const headline = displayedCurrentBid(vehicle, userBids);
  const status = auctionStatus(vehicle.auction_start);
  const floor = floorStatus(vehicle, userBids);
  const heroImage = vehicle.images[0];
  const heroAlt = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  // Comp band runs across all 200 lots × 3 lookups per render. Memo-keyed on
  // the bid map so user bids on the target or any comp shift the verdict;
  // unrelated bid mutations re-use the cached band per D016's frozen-empty
  // reference convention.
  const band = useMemo(
    () => compPriceBand(vehicle, VEHICLES, bidsByVehicle),
    [vehicle, bidsByVehicle],
  );
  const verdict = smartPriceVerdict(headline, band);

  return (
    <Link
      to={`/vehicle/${vehicle.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
        <TitleBrandBadge status={vehicle.title_status} />
        <span
          className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
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
          />
        </div>
      </div>
    </Link>
  );
}
