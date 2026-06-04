import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getVehiclesForUser } from '@/lib/api';
import { getSession } from '@/lib/session';
import VehicleCard from '@/components/VehicleCard';

export default async function UserVehiclesPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const [session, { userId }] = await Promise.all([getSession(), params]);

  if (session?.user.role !== 'admin') redirect('/dashboard');

  const uid = parseInt(userId);
  const vehicles = await getVehiclesForUser(uid);

  const ownerName =
    vehicles[0]?.owner_full_name ?? vehicles[0]?.owner_username ?? `Kullanıcı #${uid}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Kullanıcılara dön
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">
          {ownerName} — Araçlar
        </h1>
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
