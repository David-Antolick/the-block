// Smart Price verdict pill — the visible answer to "am I about to overpay?"
// for a single lot, comparing its displayed bid against the comp band from
// `comps.ts`. Reused on the inventory card and the VDP headline.
//
// The pill is intentionally compact; the tooltip carries the comp-set
// explanation (low / median / high + count) so a curious buyer can verify
// the verdict without leaving the page. `role="tooltip"` + `aria-describedby`
// keeps the explanation reachable for keyboard users — hover-only would fail
// the M7 accessibility floor.

import type { CompPriceBand, SmartPriceVerdict } from '../lib/comps';
import { formatCurrency } from '../lib/format';

interface Props {
  verdict: SmartPriceVerdict;
  band: CompPriceBand | null;
  /** Density variant. Card uses the compact pill; VDP gets a roomier version
   *  to balance the headline current-bid type scale. */
  size?: 'sm' | 'md';
  /** Stable id for the tooltip element — needed so multiple badges on the
   *  same page (card grid + VDP) don't collide on `aria-describedby`. */
  tooltipId: string;
}

const VERDICT_LABEL: Record<SmartPriceVerdict, string> = {
  below: 'Below market',
  fair: 'Fair price',
  above: 'Above market',
  unknown: 'No comps',
};

// Colors track the trust thesis: green rewards a good deal, red warns the
// buyer off overpaying, blue is neutral-positive, gray is "we can't tell."
// Ring + bg + text are all set inline so the pill stays legible against any
// card background.
const VERDICT_CLASS: Record<SmartPriceVerdict, string> = {
  below: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  fair: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200',
  above: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200',
  unknown: 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-300',
};

function describeBand(band: CompPriceBand | null): string {
  if (band === null) {
    return 'Not enough recent comps to score this lot.';
  }
  const { comps, low, median, high } = band;
  const count = `${comps.length} comp${comps.length === 1 ? '' : 's'}`;
  return `${count} · Low ${formatCurrency(low)} · Median ${formatCurrency(median)} · High ${formatCurrency(high)}`;
}

export default function SmartPriceBadge({ verdict, band, size = 'sm', tooltipId }: Props) {
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  const description = describeBand(band);

  return (
    <span className="relative inline-flex">
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        aria-label={`Smart Price: ${VERDICT_LABEL[verdict]}. ${description}`}
        className={`peer inline-flex cursor-help select-none items-center gap-1 rounded-full font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${padding} ${VERDICT_CLASS[verdict]}`}
      >
        <span aria-hidden="true" className="text-[10px] uppercase tracking-wider opacity-70">
          Smart
        </span>
        {VERDICT_LABEL[verdict]}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden w-max max-w-[16rem] rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-normal text-zinc-50 shadow-lg peer-hover:block peer-focus:block"
      >
        {description}
      </span>
    </span>
  );
}
