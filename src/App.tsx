// App shell: BrowserRouter + BidProvider + a minimal header + routes.
// React Router v7 (I6). The BidProvider wraps the router so any future route
// can call the bid hooks; the storage hydration in the provider runs once on
// mount, before any page consumes it.

import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { BidProvider } from './state/BidProvider';
import Inventory from './pages/Inventory';
import VehicleDetail from './pages/VehicleDetail';

function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight text-zinc-900">
          The Block
        </Link>
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          OPENLANE buyer prototype
        </span>
      </div>
    </header>
  );
}

function NotFound() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h2 className="text-xl font-semibold tracking-tight">Page not found</h2>
      <p className="mt-1 text-sm text-zinc-600">That route doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block text-sm text-blue-700 underline">
        Back to inventory
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BidProvider>
        <div className="min-h-dvh bg-zinc-50 text-zinc-900">
          <Header />
          <Routes>
            <Route path="/" element={<Inventory />} />
            <Route path="/vehicle/:id" element={<VehicleDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BidProvider>
    </BrowserRouter>
  );
}
