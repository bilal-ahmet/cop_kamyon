import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleLocation } from '@/lib/api';
import LiveVehicleMap from '@/components/LiveVehicleMap';

// "Konum" sekmesi: canlı harita + anlık konum bilgisi.
export default async function VehicleLocationTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);

  // getVehicles React.cache ile sarmalı; layout'taki çağrıyla aynı sonucu paylaşır.
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const location = await getVehicleLocation(vehicleId);

  return (
    <LiveVehicleMap
      vehicleId={vehicleId}
      plate={vehicle.plate}
      initialLocation={location}
    />
  );
}
