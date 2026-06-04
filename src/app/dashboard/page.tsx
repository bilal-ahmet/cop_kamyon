import Link from 'next/link';
import { Suspense } from 'react';
import { getVehicles, getUsers } from '@/lib/api';
import { getSession } from '@/lib/session';
import VehicleCard from '@/components/VehicleCard';
import VehicleFormModal from '@/components/vehicles/VehicleFormModal';
import UserCard from '@/components/UserCard';
import UserSearchInput from '@/components/UserSearchInput';
import UserCreateModal from '@/components/users/UserCreateModal';
import { secondaryBtn } from '@/components/formStyles';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const isAdmin = session?.user.role === 'admin';

  // Admin: kullanıcı listesi görünümü
  if (isAdmin) {
    const users = await getUsers(sp.search);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">Kullanıcılar</h1>
          <UserCreateModal />
        </div>

        <Suspense fallback={null}>
          <UserSearchInput />
        </Suspense>

        {users.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            {sp.search ? `"${sp.search}" için sonuç bulunamadı.` : 'Henüz kayıtlı kullanıcı yok.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Müşteri: araç listesi + şoför/atama linkleri
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
          <VehicleFormModal />
        </div>
      </div>

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
          Henüz kayıtlı araç yok.
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
