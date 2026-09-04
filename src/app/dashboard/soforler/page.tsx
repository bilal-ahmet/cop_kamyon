import Link from 'next/link';
import { getDrivers } from '@/lib/api';
import DriverFormModal from '@/components/drivers/DriverFormModal';
import DriverList from '@/components/drivers/DriverList';

export default async function DriversPage() {
  // Pasifler de listelenir; aksi halde devre dışı bırakılan şoför kaybolur
  // ve tekrar aktif edilemezdi.
  const drivers = await getDrivers(true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Araçlara dön
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">Şoförler</h1>
        </div>
        <DriverFormModal />
      </div>

      <DriverList drivers={drivers} />
    </div>
  );
}
