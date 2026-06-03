import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleTelemetry } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

// "Telemetri" sekmesi: sensörlerden gelen ham kayıtların son listesi.
// Sensör mühendisi, gönderdiği verinin backend'e ulaşıp ulaşmadığını buradan doğrular.
export default async function VehicleTelemetryTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const records = await getVehicleTelemetry(vehicleId, { limit: 100 });

  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        Bu araç için telemetri kaydı yok. Sensör henüz veri göndermemiş olabilir.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Zaman</th>
            <th className="px-3 py-2">Konum</th>
            <th className="px-3 py-2">Yük (kg)</th>
            <th className="px-3 py-2">Fix</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {records.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 text-zinc-800">
                {formatDateTime(r.recorded_at)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">
                {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
              </td>
              <td className="px-3 py-2 text-zinc-700">{r.load_kg ?? '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.fix_valid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {r.fix_valid ? 'Geçerli' : 'Geçersiz'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
