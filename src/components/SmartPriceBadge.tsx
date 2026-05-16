// Smart Price verdict pill — the visible answer to "am I about to overpay?"
// for a single lot, comparing its displayed bid against the comp band from
// `comps.ts`. Reused on the inventory card and the VDP headline.
//
// The pill is intentionally compact; the tooltip carries the comp-set
// explanation (low / median / high + count) so a curious buyer can verify
// the verdict without leaving the page. `role="tooltip"` + `aria-describedby`
// keeps the explanation reachable for keyboard users when the badge sits as
// a standalone interactive element (VDP). Inside a card `<Link>`, the badge
// is decorative — `interactive={false}` drops the tab stop and focus-ring so
// the parent link owns keyboard navigation (Enter on the card opens the VDP,
// where the same band is rendered as a full panel).
//
// `'unknown'` verdicts render nothing. A grey "No comps" pill would add noise
// to every long-tail lot without conveying signal; absence of badge reads as
// absence of comp data more honestly.

import type { CompPriceBand, ScoredVerdict, SmartPriceVerdict } from '../lib/comps';
import { VERDICT_LABEL } from '../lib/comps';
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
  /** When false, the badge is decorative inside a parent interactive element
   *  (the card Link). Suppresses tab stop, cursor-help, and focus-ring; the
   *  tooltip still surfaces on hover for mouse users, and the parent handles
   *  keyboard activation. Defaults to true (standalone use, e.g. BidPanel). */
  interactive?: boolean;
}

// Colors track the trust thesis: green rewards a good deal, red warns the
// buyer off overpaying, blue is neutral-positive. Unknown verdicts don't
// render so they don't earn an entry here.
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
  // No band ⇒ no signal ⇒ no pill. Keeps the row uncluttered on long-tail
  // lots and avoids the awkward "No comps" copy that doesn't help the buyer.
  if (verdict === 'unknown' || band === null) return null;

  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  const description = describeBand(band);

  // Interactive variant gets its own tab stop + focus-ring + help cursor and
  // surfaces the tooltip on focus. Decorative variant trusts the parent link.
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
