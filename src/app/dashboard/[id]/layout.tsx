import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getVehicleById } from '@/lib/api';
import TabNav from '@/components/TabNav';

export default async function VehicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) notFound();

  // Aracı getirir ve sahipliği doğrular (kullanıcının listesinde yoksa null → 404).
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const subtitle = [vehicle.brand, vehicle.model, vehicle.vehicle_type]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Araçlara dön
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{vehicle.plate}</h1>
        {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
      </div>

      <TabNav vehicleId={vehicleId} />

      <div>{children}</div>
    </div>
  );
}
