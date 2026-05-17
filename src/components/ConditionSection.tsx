// VDP condition section. Empty damage_notes surfaces as "No reported damage"
// — visible-absence beats invisible-absence for a trust-thesis app.

import type { Vehicle } from '../types/vehicle';

interface Props {
  vehicle: Vehicle;
}

function gradeBucket(grade: number): {
  label: string;
  className: string;
} {
  if (grade >= 4) {
    return {
      label: 'Excellent',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    };
  }
  if (grade >= 3) {
    return {
      label: 'Average',
      className: 'bg-amber-50 text-amber-800 ring-amber-200',
    };
  }
  return {
    label: 'Rough',
    className: 'bg-red-50 text-red-800 ring-red-200',
  };
}

export default function ConditionSection({ vehicle }: Props) {
  const bucket = gradeBucket(vehicle.condition_grade);

  return (
    <section aria-labelledby="vdp-condition-heading" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="vdp-condition-heading"
          className="text-sm font-semibold uppercase tracking-wider text-zinc-500"
        >
          Condition
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${bucket.className}`}
        >
          <span className="tabular-nums">{vehicle.condition_grade.toFixed(1)}</span>
          <span aria-hidden="true">·</span>
          <span>{bucket.label}</span>
        </span>
      </div>

      {vehicle.condition_report && (
        <p className="text-sm leading-relaxed text-zinc-700">
          {vehicle.condition_report}
        </p>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Damage notes
        </h3>
        {vehicle.damage_notes.length === 0 ? (
          <p className="mt-1.5 text-sm text-zinc-500">No reported damage.</p>
        ) : (
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {vehicle.damage_notes.map((note, i) => (
              <li key={`${i}-${note}`}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
