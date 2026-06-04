import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleLocation, getVehicleStopLocations } from '@/lib/api';
import LiveVehicleMap from '@/components/LiveVehicleMap';

// "Konum" sekmesi: canlı harita + anlık konum bilgisi + durak ikonları.
export default async function VehicleLocationTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus_lat?: string; focus_lon?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const [location, stopLocations] = await Promise.all([
    getVehicleLocation(vehicleId),
    getVehicleStopLocations(vehicleId),
  ]);

  const initialFocusPoint: [number, number] | null =
    sp.focus_lat && sp.focus_lon
      ? [parseFloat(sp.focus_lat), parseFloat(sp.focus_lon)]
      : null;

  return (
    <LiveVehicleMap
      vehicleId={vehicleId}
      plate={vehicle.plate}
      initialLocation={location}
      stopLocations={stopLocations}
      initialFocusPoint={initialFocusPoint}
    />
  );
}
