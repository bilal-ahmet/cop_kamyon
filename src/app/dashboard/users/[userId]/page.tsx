import { getVehiclesForUser } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';
import VehicleFormModal from '@/components/vehicles/VehicleFormModal';

/** Müşteri çalışma alanı → Araçlar. Yeni araç bu müşterinin adına açılır. */
export default async function CustomerVehiclesPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const id = Number(userId);
  const vehicles = await getVehiclesForUser(id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Araçlar</h2>
        <VehicleFormModal actingUserId={id} />
      </div>

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Bu kullanıcıya ait kayıtlı araç yok.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}
