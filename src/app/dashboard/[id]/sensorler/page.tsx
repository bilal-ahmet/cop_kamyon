import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleSensors } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import SensorFormModal from '@/components/sensors/SensorFormModal';
import ConfirmButton from '@/components/ConfirmButton';
import { deactivateSensor } from '@/actions/sensors';
import { dangerBtn } from '@/components/formStyles';

// "Sensörler" sekmesi: araca takılı IoT/GPS sensörlerinin yönetimi.
export default async function VehicleSensorsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const sensors = await getVehicleSensors(vehicleId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Sensör kaydedildiğinde, cihaz <code className="text-zinc-700">serial_number</code> ile
          telemetri gönderebilir.
        </p>
        <SensorFormModal vehicleId={vehicleId} />
      </div>

      {sensors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Bu araçta kayıtlı sensör yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sensors.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-zinc-900">{s.serial_number}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {s.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600">
                    <div>Firmware: {s.firmware_version ?? '—'}</div>
                    <div>Takılma: {formatDateTime(s.installed_at)}</div>
                    {s.notes && <div className="col-span-2">Not: {s.notes}</div>}
                  </dl>
                </div>
                <div className="flex items-center gap-2">
                  <SensorFormModal vehicleId={vehicleId} sensor={s} />
                  {s.is_active && (
                    <ConfirmButton
                      action={deactivateSensor}
                      hidden={{ id: s.id, vehicle_id: vehicleId }}
                      label="Devre dışı"
                      confirmText={`${s.serial_number} sensörünü devre dışı bırakmak istediğinize emin misiniz?`}
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
