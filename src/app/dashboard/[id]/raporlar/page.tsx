import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleSummary } from '@/lib/api';
import { formatDate, lastNDates } from '@/lib/format';
import type { DailySummary } from '@/lib/types';

const DAYS = 7;

// "Raporlar" sekmesi: son 7 günün günlük özetleri (her gün backend'den paralel çekilir).
export default async function VehicleReportsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const dates = lastNDates(DAYS);
  const rows = await Promise.all(
    dates.map(async (date) => ({
      date,
      summary: await getVehicleSummary(vehicleId, date),
    })),
  );

  const hasAny = rows.some((r) => r.summary !== null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">Son {DAYS} günün özeti</p>

      {!hasAny ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Son {DAYS} gün için hesaplanmış özet yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
                <Th>Tarih</Th>
                <Th>Mesafe</Th>
                <Th>Durak</Th>
                <Th>Toplam yük</Th>
                <Th>Telemetri</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ date, summary }) => (
                <tr key={date} className="border-b border-zinc-100 last:border-0">
                  <Td className="font-medium text-zinc-800">{formatDate(date)}</Td>
                  {summary ? (
                    <SummaryRow summary={summary} />
                  ) : (
                    <td colSpan={4} className="px-3 py-2 text-zinc-500">
                      Kayıt yok
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ summary }: { summary: DailySummary }) {
  return (
    <>
      <Td>{unit(summary.total_distance_km, 'km')}</Td>
      <Td>{summary.waypoint_count ?? '—'}</Td>
      <Td>{unit(summary.total_load_kg, 'kg')}</Td>
      <Td>{summary.telemetry_count ?? '—'}</Td>
    </>
  );
}

function unit(value: number | null, u: string): string {
  return value == null ? '—' : `${value} ${u}`;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 text-zinc-700 ${className}`}>{children}</td>;
}
