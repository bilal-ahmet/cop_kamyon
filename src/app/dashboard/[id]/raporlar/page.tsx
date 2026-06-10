import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleSummary } from '@/lib/api';
import { lastNDates } from '@/lib/format';
import ReportsTable from '@/components/ReportsTable';

const DAYS = 7;

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

  return <ReportsTable rows={rows} />;
}
