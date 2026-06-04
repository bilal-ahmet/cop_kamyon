import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleStopLocations } from '@/lib/api';
import StopLocationFormModal from '@/components/stopLocations/StopLocationFormModal';
import ConfirmButton from '@/components/ConfirmButton';
import { deactivateStopLocation } from '@/actions/stopLocations';
import { dangerBtn, secondaryBtn } from '@/components/formStyles';

// "Lokasyonlar" sekmesi: otomatik geofencing için önceden tanımlı durak noktaları.
// Kamyon bu noktaların yarıçapına girdiğinde waypoint kaydı otomatik oluşur.
export default async function VehicleStopLocationsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const stopLocations = await getVehicleStopLocations(vehicleId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-700 font-medium">Otomatik Durak Tespiti</p>
          <p className="text-sm text-zinc-500 mt-0.5">
            Kamyon bir lokasyonun yarıçapına girdiğinde varış, ayrıldığında ayrılış
            zamanı <strong>otomatik</strong> kaydedilir.
          </p>
        </div>
        <StopLocationFormModal vehicleId={vehicleId} />
      </div>

      {stopLocations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Tanımlı durak lokasyonu yok. Eklemek için yukarıdaki butonu kullanın.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stopLocations.map((sl) => (
            <li key={sl.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{sl.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sl.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {sl.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
                    <div>
                      Koordinat: {Number(sl.lat).toFixed(5)},{' '}
                      {Number(sl.lon).toFixed(5)}
                    </div>
                    <div>Yarıçap: {sl.radius_m} m</div>
                  </dl>
                </div>
                <div className="flex items-center gap-2">
                  {sl.is_active && (
                    <Link
                      href={`/dashboard/${vehicleId}?focus_lat=${sl.lat}&focus_lon=${sl.lon}`}
                      className={secondaryBtn}
                    >
                      Haritada görüntüle
                    </Link>
                  )}
                  <StopLocationFormModal vehicleId={vehicleId} stopLocation={sl} />
                  {sl.is_active && (
                    <ConfirmButton
                      action={deactivateStopLocation}
                      hidden={{ id: sl.id, vehicle_id: vehicleId }}
                      label="Devre dışı"
                      confirmText={`"${sl.name}" lokasyonunu devre dışı bırakmak istediğinize emin misiniz?`}
                      className={dangerBtn}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
