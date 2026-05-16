// Phase 4 stub. Replaced in Phase 6 by the full VDP (gallery + specs + bid panel).
// Renders enough of the vehicle to verify the router param + BidContext wiring,
// including a minimal place-bid form so M4 can exercise the persistence path.

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { VEHICLES } from '../data/vehicles';
import { useBidsFor, usePlaceBid } from '../state/bid-context';
import { formatCurrency } from '../lib/format';
import { displayedCurrentBid, minNextBid } from '../lib/bidding';

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const vehicle = VEHICLES.find((v) => v.id === id);
  const userBids = useBidsFor(id ?? '');
  const placeBid = usePlaceBid();

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="text-xl font-semibold tracking-tight">Vehicle not found</h2>
        <p className="mt-1 text-sm text-zinc-600">No lot matches id {id}.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-700 underline">
          Back to inventory
        </Link>
      </section>
    );
  }

  const current = displayedCurrentBid(vehicle, userBids);
  const next = minNextBid(vehicle, userBids);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(input);
    const result = placeBid(vehicle!, amount);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setInput('');
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/" className="text-sm text-blue-700 underline">
        ← Back to inventory
      </Link>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
      </h2>
      <p className="text-sm text-zinc-600">
        Lot {vehicle.lot} · {vehicle.city}, {vehicle.province}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500">Current bid</dt>
        <dd>{formatCurrency(current)}</dd>
        <dt className="text-zinc-500">Min next bid</dt>
        <dd>{formatCurrency(next)}</dd>
        <dt className="text-zinc-500">Buy Now</dt>
        <dd>{vehicle.buy_now_price == null ? '—' : formatCurrency(vehicle.buy_now_price)}</dd>
      </dl>

      <form onSubmit={handleSubmit} className="mt-6 flex items-end gap-3">
        <label className="block text-sm">
          <span className="block text-zinc-700">Place a bid</span>
          <input
            type="number"
            step="1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="mt-1 w-40 rounded-md border border-zinc-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
        >
          Submit
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <h3 className="mt-8 text-sm font-semibold text-zinc-700">Your bids on this lot</h3>
      {userBids.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">No bids yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {userBids.map((b) => (
            <li key={b.placedAt}>
              {formatCurrency(b.amount)} <span className="text-zinc-500">· {b.placedAt}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
