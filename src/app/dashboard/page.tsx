import { getVehicles } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';

export default async function DashboardPage() {
  // apiFetch, token yoksa/401 olursa otomatik /login'e yönlendirir.
  const vehicles = await getVehicles();

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Araçlarım</h1>

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
          Henüz size atanmış bir araç yok.
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
