// VDP comp panel — companion to the SmartPriceBadge that surfaces *which*
// comps fed the verdict and what their current bids are. Lets the buyer
// click through to any comp's VDP to verify the comparison for themselves.
//
// Memoization is intentional (PLAN.md Phase 7): `compPriceBand` walks the
// 200-lot pool, and the panel re-renders whenever the bid map changes. The
// memo key is `bidsByVehicle` itself so any user bid on the target *or* on
// a comp invalidates the cached band — `findComps` doesn't depend on bids,
// but the band's low/median/high do, and consistency beats a tighter key.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '../types/vehicle';
import { displayedCurrentBid } from '../lib/bidding';
import { compPriceBand } from '../lib/comps';
import { formatCurrency, formatOdometer } from '../lib/format';
import { VEHICLES } from '../data/vehicles';
import { useBids } from '../state/bid-context';

interface Props {
  vehicle: Vehicle;
}

export default function CompPanel({ vehicle }: Props) {
  const bidsByVehicle = useBids();
  const band = useMemo(
    () => compPriceBand(vehicle, VEHICLES, bidsByVehicle),
    [vehicle, bidsByVehicle],
  );

  return (
    <section
      aria-labelledby="comp-panel-heading"
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="comp-panel-heading" className="text-base font-semibold text-zinc-900">
          Comparable lots
        </h2>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">
          Same make/model · year ±1
        </p>
      </header>

      {band === null ? (
        <p className="mt-3 text-sm text-zinc-600">
          No recent comps with active pricing for this make, model, and year range.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">Low</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
                {formatCurrency(band.low)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">Median</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
                {formatCurrency(band.median)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">High</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
                {formatCurrency(band.high)}
              </dd>
            </div>
          </dl>

          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {band.comps.map((comp) => {
              const price = displayedCurrentBid(comp, bidsByVehicle[comp.id] ?? []);
              return (
                <li key={comp.id}>
                  <Link
                    to={`/vehicle/${comp.id}`}
                    className="flex h-full flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs transition hover:border-zinc-400 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="truncate font-medium text-zinc-900">
                      {comp.year} {comp.make} {comp.model}
                    </span>
                    <span className="truncate text-zinc-500">
                      {formatOdometer(comp.odometer_km)} · Lot {comp.lot}
                    </span>
                    <span className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                      {formatCurrency(price)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[11px] text-zinc-500">
            Median over {band.comps.length} comp{band.comps.length === 1 ? '' : 's'}; for
            small sample sizes it skews toward the higher value.
          </p>
        </>
      )}
    </section>
  );
}
