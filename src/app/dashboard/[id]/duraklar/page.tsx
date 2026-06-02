import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleWaypoints } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

// "Duraklar" sekmesi: aracın durduğu noktalar ve yük transferleri.
export default async function VehicleWaypointsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const waypoints = await getVehicleWaypoints(vehicleId);

  if (waypoints.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        Bu araç için durak kaydı yok.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {waypoints.map((w) => (
        <li key={w.id} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-zinc-900">
              {w.location_name ?? 'Bilinmeyen konum'}
            </span>
            <span className="text-xs text-zinc-400">
              {Number(w.lat).toFixed(5)}, {Number(w.lon).toFixed(5)}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="Varış" value={formatDateTime(w.arrived_at)} />
            <Field label="Ayrılış" value={formatDateTime(w.departed_at)} />
            <Field
              label="Alınan yük"
              value={w.load_received_kg != null ? `${w.load_received_kg} kg` : '—'}
            />
            <Field
              label="Bırakılan yük"
              value={w.load_delivered_kg != null ? `${w.load_delivered_kg} kg` : '—'}
            />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="text-zinc-800">{value}</dd>
    </div>
  );
}
