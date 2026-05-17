// VDP page. Two-column on lg+ (gallery / specs / comps + sticky BidPanel);
// stacked below that. Components are positioning-agnostic — layout lives here.

import { Link, useParams } from 'react-router-dom';
import { VEHICLES } from '../data/vehicles';
import ImageGallery from '../components/ImageGallery';
import VehicleTitleBlock from '../components/VehicleTitleBlock';
import TitleBrandBanner from '../components/TitleBrandBanner';
import SpecTable from '../components/SpecTable';
import ConditionSection from '../components/ConditionSection';
import DealershipCard from '../components/DealershipCard';
import BidPanel from '../components/BidPanel';
import CompPanel from '../components/CompPanel';

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const vehicle = VEHICLES.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link to="/" className="text-sm text-blue-700 underline">
          ← Back to inventory
        </Link>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">
          Vehicle not found
        </h2>
        <p className="mt-1 text-sm text-zinc-600">No lot matches id {id}.</p>
      </section>
    );
  }

  const altBase = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link to="/" className="text-sm text-blue-700 underline">
        ← Back to inventory
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ImageGallery images={vehicle.images} altBase={altBase} />
          <VehicleTitleBlock vehicle={vehicle} />
          <TitleBrandBanner status={vehicle.title_status} />
          <SpecTable vehicle={vehicle} />
          <ConditionSection vehicle={vehicle} />
          <CompPanel vehicle={vehicle} />
          <DealershipCard vehicle={vehicle} />
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <BidPanel vehicle={vehicle} />
        </div>
      </div>
    </section>
  );
}
