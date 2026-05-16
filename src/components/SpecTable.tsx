// VDP spec table. Renders the static vehicle attributes that don't change
// during the auction — VIN, drivetrain, engine, etc. Built as a `<dl>` (rather
// than a `<table>`) because each spec is a single labeled value, not a row in
// tabular data, and screen readers announce dt/dd pairs without column-header
// overhead. Two-column on desktop; single-column on mobile.

import type { Vehicle } from '../types/vehicle';
import { formatOdometer } from '../lib/format';

interface Props {
  vehicle: Vehicle;
}

interface Row {
  label: string;
  value: string;
}

function buildRows(vehicle: Vehicle): Row[] {
  return [
    { label: 'VIN', value: vehicle.vin },
    { label: 'Year', value: String(vehicle.year) },
    { label: 'Make', value: vehicle.make },
    { label: 'Model', value: vehicle.model },
    { label: 'Trim', value: vehicle.trim },
    { label: 'Body style', value: vehicle.body_style },
    { label: 'Odometer', value: formatOdometer(vehicle.odometer_km) },
    { label: 'Engine', value: vehicle.engine },
    { label: 'Transmission', value: vehicle.transmission },
    { label: 'Drivetrain', value: vehicle.drivetrain },
    { label: 'Fuel type', value: vehicle.fuel_type },
    { label: 'Exterior color', value: vehicle.exterior_color },
    { label: 'Interior color', value: vehicle.interior_color },
    { label: 'Location', value: `${vehicle.city}, ${vehicle.province}` },
  ];
}

export default function SpecTable({ vehicle }: Props) {
  const rows = buildRows(vehicle);
  return (
    <section aria-labelledby="vdp-spec-heading">
      <h2
        id="vdp-spec-heading"
        className="text-sm font-semibold uppercase tracking-wider text-zinc-500"
      >
        Specifications
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-4 border-b border-zinc-100 py-1.5 text-sm"
          >
            <dt className="text-zinc-500">{row.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-zinc-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
