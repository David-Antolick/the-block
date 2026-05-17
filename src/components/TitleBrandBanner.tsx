// Full-width VDP banner under the title block. Returns null for clean titles.
// Card-grid counterpart is the corner badge in VehicleCard.tsx.

import type { Vehicle } from '../types/vehicle';

interface Props {
  status: Vehicle['title_status'];
}

export default function TitleBrandBanner({ status }: Props) {
  if (status === 'clean') return null;

  const isSalvage = status === 'salvage';
  const heading = isSalvage ? 'Salvage title' : 'Rebuilt title';
  const body = isSalvage
    ? 'This vehicle carries a salvage title brand. Inspect carefully and review the damage notes before bidding.'
    : 'This vehicle carries a rebuilt title brand. It was previously salvaged and has been restored to roadworthy condition.';
  const wrapperClass = isSalvage
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-amber-300 bg-amber-50 text-amber-900';
  const iconClass = isSalvage ? 'bg-red-600' : 'bg-amber-500';

  return (
    <div
      role="note"
      aria-label={`${heading} warning`}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${wrapperClass}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${iconClass}`}
      >
        !
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{heading}</p>
        <p className="mt-0.5 text-sm leading-snug">{body}</p>
      </div>
    </div>
  );
}
