// VDP selling-dealership card. Sticks to dataset fields per CLAUDE.md's
// "never invent dataset fields" rule — no fake ratings, history reports, etc.

import type { Vehicle } from '../types/vehicle';

interface Props {
  vehicle: Vehicle;
}

export default function DealershipCard({ vehicle }: Props) {
  const initials = vehicle.selling_dealership
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section
      aria-labelledby="vdp-dealer-heading"
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2
        id="vdp-dealer-heading"
        className="text-sm font-semibold uppercase tracking-wider text-zinc-500"
      >
        Selling dealership
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700"
        >
          {initials || '—'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">
            {vehicle.selling_dealership}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {vehicle.city}, {vehicle.province}
          </p>
        </div>
      </div>
    </section>
  );
}
