import Link from 'next/link';
import { getVehicles } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';
import VehicleFormModal from '@/components/vehicles/VehicleFormModal';
import { secondaryBtn } from '@/components/formStyles';

export default async function DashboardPage() {
  // apiFetch, token yoksa/401 olursa otomatik /login'e yönlendirir.
  const vehicles = await getVehicles();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Araçlarım</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/soforler" className={secondaryBtn}>
            Şoförler
          </Link>
          <Link href="/dashboard/atamalar" className={secondaryBtn}>
            Atamalar
          </Link>
          <Link href="/dashboard/kullanicilar" className={secondaryBtn}>
            Kullanıcılar
          </Link>
          <VehicleFormModal />
        </div>
      </div>

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
