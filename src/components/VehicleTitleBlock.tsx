// VDP title block — H1 with year/make/model/trim, sub-line with lot + location.
// Kept narrow on purpose: the bid headline lives in the right column (BidPanel),
// the title-brand banner sits below this block as its own component, and the
// stat-strip details (mileage, condition, fuel) are in the spec table further
// down the page. This component is purely the page heading.

import type { Vehicle } from '../types/vehicle';

interface Props {
  vehicle: Vehicle;
}

export default function VehicleTitleBlock({ vehicle }: Props) {
  return (
    <header>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Lot {vehicle.lot}
      </p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-3xl">
        {vehicle.year} {vehicle.make} {vehicle.model}
      </h1>
      <p className="mt-1 text-base text-zinc-600">
        {vehicle.trim}
        <span className="mx-2 text-zinc-300" aria-hidden="true">
          ·
        </span>
        {vehicle.city}, {vehicle.province}
      </p>
    </header>
  );
}
