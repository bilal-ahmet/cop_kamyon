import Link from 'next/link';
import type { Vehicle } from '@/lib/types';

export default function VehicleCard({
  vehicle,
  showOwner = false,
}: {
  vehicle: Vehicle;
  showOwner?: boolean;
}) {
  const subtitle = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

  return (
    <Link
      href={`/dashboard/${vehicle.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold text-zinc-900">{vehicle.plate}</span>
        {vehicle.year && <span className="text-sm text-zinc-500">{vehicle.year}</span>}
      </div>

      {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {vehicle.vehicle_type && (
          <div>
            <dt className="text-zinc-500">Tip</dt>
            <dd className="text-zinc-700">{vehicle.vehicle_type}</dd>
          </div>
        )}
        {vehicle.capacity_kg != null && (
          <div>
            <dt className="text-zinc-500">Kapasite</dt>
            <dd className="text-zinc-700">{vehicle.capacity_kg} kg</dd>
          </div>
        )}
        {showOwner && vehicle.owner_username && (
          <div className="col-span-2">
            <dt className="text-zinc-500">Müşteri</dt>
            <dd className="text-zinc-700">
              {vehicle.owner_full_name ?? vehicle.owner_username}
            </dd>
          </div>
        )}
      </dl>
    </Link>
  );
}
