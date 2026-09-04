import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getVehicleById } from '@/lib/api';
import { getSession } from '@/lib/session';
import TabNav from '@/components/TabNav';
import VehicleFormModal from '@/components/vehicles/VehicleFormModal';
import ConfirmButton from '@/components/ConfirmButton';
import { deleteVehicle } from '@/actions/vehicles';
import { dangerBtn } from '@/components/formStyles';

export default async function VehicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([getSession(), params]);
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) notFound();

  // Aracı getirir ve sahipliği doğrular (kullanıcının listesinde yoksa null → 404).
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  // Admin bir müşterinin aracına bakıyorsa geri linki ve düzenleme/silme
  // işlemleri o müşterinin çalışma alanına bağlanır. Hedef, aracın kendi
  // user_id'sinden okunur — ayrıca taşınan bir durum yok.
  const actingUserId = session?.user.role === 'admin' ? vehicle.user_id : undefined;
  const backHref = actingUserId ? `/dashboard/users/${actingUserId}` : '/dashboard';
  const ownerName = vehicle.owner_full_name ?? vehicle.owner_username;

  const subtitle = [vehicle.brand, vehicle.model, vehicle.vehicle_type]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← {actingUserId && ownerName ? `${ownerName} araçlarına dön` : 'Araçlara dön'}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{vehicle.plate}</h1>
            {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <VehicleFormModal vehicle={vehicle} actingUserId={actingUserId} />
            <ConfirmButton
              action={deleteVehicle}
              hidden={
                actingUserId
                  ? { id: vehicle.id, acting_user_id: actingUserId }
                  : { id: vehicle.id }
              }
              label="Sil"
              confirmText={`${vehicle.plate} aracını devre dışı bırakmak istediğinize emin misiniz?`}
              className={dangerBtn}
            />
          </div>
        </div>
      </div>

      <TabNav vehicleId={vehicleId} />

      <div>{children}</div>
    </div>
  );
}
