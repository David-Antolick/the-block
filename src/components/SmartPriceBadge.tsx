// Smart Price verdict pill (D020). Reused on the inventory card (decorative,
// parent link owns keyboard focus) and the VDP (interactive, tab-reachable
// with a tooltip). `unknown` verdicts render nothing — absence reads more
// honestly than a "no comps" pill.

import type { CompPriceBand, ScoredVerdict, SmartPriceVerdict } from '../lib/comps';
import { VERDICT_LABEL } from '../lib/comps';
import { formatCurrency } from '../lib/format';

interface Props {
  verdict: SmartPriceVerdict;
  band: CompPriceBand | null;
  size?: 'sm' | 'md';
  /** Stable id for tooltip — multiple badges on a page need unique ids. */
  tooltipId: string;
  /** False inside a parent interactive element (the card Link). Drops tab stop. */
  interactive?: boolean;
}

const VERDICT_CLASS: Record<ScoredVerdict, string> = {
  below: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  fair: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200',
  above: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200',
};

function describeBand(band: CompPriceBand): string {
  const { comps, low, median, high } = band;
  const count = `${comps.length} comp${comps.length === 1 ? '' : 's'}`;
  return `${count} · Low ${formatCurrency(low)} · Median ${formatCurrency(median)} · High ${formatCurrency(high)}`;
}

export default function SmartPriceBadge({
  verdict,
  band,
  size = 'sm',
  tooltipId,
  interactive = true,
}: Props) {
  if (verdict === 'unknown' || band === null) return null;

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  const description = describeBand(band);

  const interactiveClasses = interactive
    ? 'cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500'
    : '';
  const tooltipFocusClass = interactive ? 'peer-focus:block' : '';

  return (
    <span className="relative inline-flex shrink-0">
      <span
        {...(interactive ? { tabIndex: 0 } : {})}
        aria-describedby={tooltipId}
        aria-label={`Smart Price: ${VERDICT_LABEL[verdict]}. ${description}`}
        className={`peer inline-flex select-none items-center gap-1 whitespace-nowrap rounded-full font-medium ${interactiveClasses} ${padding} ${VERDICT_CLASS[verdict]}`}
      >
        <span aria-hidden="true" className="text-[10px] uppercase tracking-wider opacity-70">
          Smart
        </span>
        {VERDICT_LABEL[verdict]}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-normal text-zinc-50 shadow-lg peer-hover:block ${tooltipFocusClass}`}
      >
        {description}
      </span>
    </span>
  );
}
