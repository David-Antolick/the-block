// Right-column panel on the VDP. Renders the auction status pill, the headline
// current bid, the floor indicator (state-only — never the reserve number, per
// D007), an inline-validated bid input, Place Bid + Buy Now actions, and the
// user's bid history for this lot. The panel is positioning-agnostic: the
// VDP page wraps it in a sticky (desktop) or fixed-bottom (mobile) container.
//
// Bid button gating lives here (per D012): `validateBid` is pure math; the
// auction-status check is presentation, so we short-circuit `handleSubmit`
// when the lot isn't accepting bids and never call `validateBid` on a dead
// lot. Inline preview validation runs on every keystroke so the user sees
// the error before clicking, but the same `validateBid` is the source of
// truth on submit — no second code path can drift.

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Vehicle } from '../types/vehicle';
import {
  BID_INCREMENT,
  displayedCurrentBid,
  floorStatus,
  minNextBid,
  validateBid,
  type ValidationResult,
} from '../lib/bidding';
import { compPriceBand, smartPriceVerdict } from '../lib/comps';
import { VEHICLES } from '../data/vehicles';
import { formatCurrency } from '../lib/format';
import {
  auctionPhase,
  auctionStatus,
  formatCountdown,
  nextTransitionIso,
  type AuctionPhase,
} from '../lib/time';
import { useCountdown } from '../hooks/useCountdown';
import { useBids, useBidsFor, usePlaceBid } from '../state/bid-context';
import SmartPriceBadge from './SmartPriceBadge';

interface Props {
  vehicle: Vehicle;
}

// Mirrors VehicleCard so card and VDP read identically. Closing was promoted
// to a first-class phase in Stretch B (D021).
const PHASE_LABEL: Record<AuctionPhase, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  closing: 'Closing',
  ended: 'Ended',
};

const PHASE_PILL_CLASS: Record<AuctionPhase, string> = {
  upcoming: 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200',
  active: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  closing:
    'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300 animate-pulse',
  ended: 'bg-zinc-200 text-zinc-600 ring-1 ring-inset ring-zinc-300',
};

const COUNTDOWN_LABEL: Partial<Record<AuctionPhase, string>> = {
  upcoming: 'Opens in',
  active: 'Closes in',
  closing: 'Closes in',
};

// Newest first — buyers scanning "your bids" want the most recent at the top.
function compareBidsDesc(a: { placedAt: string }, b: { placedAt: string }): number {
  return b.placedAt.localeCompare(a.placedAt);
}

function formatBidTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function BidPanel({ vehicle }: Props) {
  const userBids = useBidsFor(vehicle.id);
  const bidsByVehicle = useBids();
  const placeBid = usePlaceBid();

  // `auctionStatus` is the engine for the bid-gating decision (Closing is
  // still Active under the hood — bids continue to land in the final 10m).
  // `phase` is the display-layer label that promotes Active → Closing once
  // the lot enters the closing window.
  const status = auctionStatus(vehicle.auction_start);
  const phase = auctionPhase(vehicle.auction_start);
  const isActive = status === 'active';

  // Tick only while the lot has a future transition target. Ended lots get
  // `null` from `nextTransitionIso` and short-circuit the interval via the
  // hook's `enabled` arg.
  const transitionTarget = nextTransitionIso(vehicle.auction_start);
  const msRemaining = useCountdown(transitionTarget, { enabled: status !== 'ended' });
  const countdownLabel = COUNTDOWN_LABEL[phase];
  const current = displayedCurrentBid(vehicle, userBids);
  const minNext = minNextBid(vehicle, userBids);
  const floor = floorStatus(vehicle, userBids);
  const totalBidCount = vehicle.bid_count + userBids.length;
  const buyNow = vehicle.buy_now_price;

  const [input, setInput] = useState('');
  // `submittedError` is the error from the last submit attempt (rendered after
  // a bad click). `previewError` is recomputed as the user types so they see
  // the rejection before clicking. They're separate so a fresh keystroke
  // doesn't immediately wipe a "your bid was rejected" message — the preview
  // takes over once the input changes.
  const [submittedError, setSubmittedError] = useState<string | null>(null);

  const trimmed = input.trim();
  const previewError = useMemo<string | null>(() => {
    if (trimmed === '') return null;
    const amount = Number(trimmed);
    const result = validateBid(amount, vehicle, userBids);
    return result.ok ? null : result.message;
  }, [trimmed, vehicle, userBids]);

  const errorToShow = trimmed === '' ? submittedError : previewError;

  function commit(amount: number): ValidationResult {
    const result = placeBid(vehicle, amount);
    if (result.ok) {
      setInput('');
      setSubmittedError(null);
    } else {
      setSubmittedError(result.message);
    }
    return result;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isActive) return;
    const amount = Number(trimmed);
    commit(amount);
  }

  function handleBuyNow() {
    if (!isActive || buyNow == null) return;
    commit(buyNow);
  }

  const sortedBids = useMemo(() => [...userBids].sort(compareBidsDesc), [userBids]);

  // Same memoization shape as VehicleCard / CompPanel — keyed on the bid map
  // so any bid commit (target or comp) reshapes the verdict in one tick.
  const band = useMemo(
    () => compPriceBand(vehicle, VEHICLES, bidsByVehicle),
    [vehicle, bidsByVehicle],
  );
  const verdict = smartPriceVerdict(current, band);

  const disabledReason = !isActive
    ? status === 'upcoming'
      ? 'Bidding opens when this lot goes Active.'
      : 'Bidding has closed on this lot.'
    : null;

  return (
    <aside
      aria-label="Bid panel"
      className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASE_PILL_CLASS[phase]}`}
          >
            {PHASE_LABEL[phase]}
          </span>
          {countdownLabel && msRemaining != null && (
            <span
              aria-live={phase === 'closing' ? 'polite' : 'off'}
              className={`text-xs tabular-nums ${
                phase === 'closing' ? 'font-semibold text-amber-800' : 'text-zinc-600'
              }`}
            >
              {countdownLabel} {formatCountdown(msRemaining)}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500 tabular-nums">
          {totalBidCount} {totalBidCount === 1 ? 'bid' : 'bids'}
        </span>
      </header>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Current bid</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-semibold tabular-nums text-zinc-900">
            {formatCurrency(current)}
          </p>
          <SmartPriceBadge
            verdict={verdict}
            band={band}
            size="md"
            tooltipId={`smart-price-vdp-${vehicle.id}`}
          />
        </div>
        <p className="mt-1 text-xs">
          {floor === 'met' && <span className="text-emerald-700">Floor Met</span>}
          {floor === 'not_met' && <span className="text-zinc-600">Floor Not Yet Met</span>}
          {floor === 'no_floor' && <span className="text-zinc-500">No Floor</span>}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor="bid-amount" className="text-xs font-medium text-zinc-700">
          Your bid
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="bid-amount"
            type="number"
            inputMode="numeric"
            step={BID_INCREMENT}
            min={minNext}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={String(minNext)}
            disabled={!isActive}
            aria-invalid={errorToShow != null}
            aria-describedby={errorToShow ? 'bid-error' : 'bid-helper'}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
          />
          <button
            type="submit"
            disabled={!isActive || trimmed === '' || previewError != null}
            className="shrink-0 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
          >
            Place Bid
          </button>
        </div>
        {errorToShow ? (
          <p id="bid-error" role="alert" className="text-xs text-red-700">
            {errorToShow}
          </p>
        ) : (
          <p id="bid-helper" className="text-xs text-zinc-500">
            Minimum next bid {formatCurrency(minNext)}
            {buyNow != null && <> · Buy Now {formatCurrency(buyNow)}</>}
          </p>
        )}
      </form>

      {buyNow != null && (
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!isActive}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none"
        >
          Buy Now · {formatCurrency(buyNow)}
        </button>
      )}

      {disabledReason && (
        <p className="text-xs text-zinc-500">{disabledReason}</p>
      )}

      <section aria-labelledby="your-bids-heading">
        <h3 id="your-bids-heading" className="text-sm font-semibold text-zinc-700">
          Your bids on this lot
        </h3>
        {sortedBids.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">No bids yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {sortedBids.map((b) => (
              <li key={b.placedAt} className="flex items-baseline justify-between gap-3">
                <span className="tabular-nums text-zinc-900">{formatCurrency(b.amount)}</span>
                <span className="text-xs text-zinc-500">{formatBidTimestamp(b.placedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
