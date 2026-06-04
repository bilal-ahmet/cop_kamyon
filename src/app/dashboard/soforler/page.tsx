import Link from 'next/link';
import { getDrivers } from '@/lib/api';
import { formatDate } from '@/lib/format';
import DriverFormModal from '@/components/drivers/DriverFormModal';
import ConfirmButton from '@/components/ConfirmButton';
import { deactivateDriver } from '@/actions/drivers';
import { dangerBtn } from '@/components/formStyles';

export default async function DriversPage() {
  const drivers = await getDrivers();

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

      {drivers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Kayıtlı şoför yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {drivers.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div>
                <span className="font-medium text-zinc-900">{d.full_name}</span>
                <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
                  <div>Ehliyet: {d.license_no ?? '—'}</div>
                  <div>Telefon: {d.phone ?? '—'}</div>
                  <div>Doğum: {formatDate(d.birth_date)}</div>
                </dl>
              </div>
              <div className="flex items-center gap-2">
                <DriverFormModal driver={d} />
                <ConfirmButton
                  action={deactivateDriver}
                  hidden={{ id: d.id }}
                  label="Devre dışı"
                  confirmText={`${d.full_name} şoförünü devre dışı bırakmak istediğinize emin misiniz?`}
                  className={dangerBtn}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
