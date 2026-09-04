import { getDrivers } from '@/lib/api';
import DriverFormModal from '@/components/drivers/DriverFormModal';
import DriverList from '@/components/drivers/DriverList';

/** Müşteri çalışma alanı → Şoförler. Eklenen şoför bu müşteriye ait olur. */
export default async function CustomerDriversPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const id = Number(userId);
  // Pasifler de listelenir; aksi halde devre dışı bırakılan şoför kaybolur.
  const drivers = await getDrivers(true, id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Şoförler</h2>
        <DriverFormModal actingUserId={id} />
      </div>

      <DriverList drivers={drivers} actingUserId={id} />
    </div>
  );
}
