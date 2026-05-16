// Phase 4 stub. Replaced wholesale in Phase 5 by the real grid + filter rail.
// Right now it just lists vehicles as links so the router can be smoke-tested
// and a human can click through to a VDP.

import { Link } from 'react-router-dom';
import { VEHICLES } from '../data/vehicles';

export default function Inventory() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="text-xl font-semibold tracking-tight">Inventory</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {VEHICLES.length} lots in the dataset. Phase 5 will replace this stub with the
        filterable grid.
      </p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {VEHICLES.slice(0, 20).map((v) => (
          <li key={v.id}>
            <Link
              to={`/vehicle/${v.id}`}
              className="block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-400"
            >
              <span className="font-medium">
                {v.year} {v.make} {v.model}
              </span>
              <span className="ml-2 text-zinc-500">lot {v.lot}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
