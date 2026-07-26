import Link from 'next/link';
import { getDrivers } from '@/lib/api';
import { formatDate } from '@/lib/format';
import DriverFormModal from '@/components/drivers/DriverFormModal';
import ConfirmButton from '@/components/ConfirmButton';
import { deactivateDriver, activateDriver, deleteDriver } from '@/actions/drivers';
import { dangerBtn, secondaryBtn } from '@/components/formStyles';

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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{d.full_name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {d.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
                  <div>Ehliyet: {d.license_no ?? '—'}</div>
                  <div>Telefon: {d.phone ?? '—'}</div>
                  <div>Doğum: {formatDate(d.birth_date)}</div>
                </dl>
              </div>
              <div className="flex items-center gap-2">
                <DriverFormModal driver={d} />
                {d.is_active ? (
                  <ConfirmButton
                    action={deactivateDriver}
                    hidden={{ id: d.id }}
                    label="Devre dışı"
                    confirmText={`${d.full_name} devre dışı bırakılacak; geçmişi korunur. Emin misiniz?`}
                    className={secondaryBtn}
                  />
                ) : (
                  <ConfirmButton
                    action={activateDriver}
                    hidden={{ id: d.id }}
                    label="Tekrar aktif et"
                    confirmText={`${d.full_name} tekrar aktif edilecek. Onaylıyor musunuz?`}
                    className={secondaryBtn}
                  />
                )}
                <ConfirmButton
                  action={deleteDriver}
                  hidden={{ id: d.id }}
                  label="Sil"
                  confirmText={`${d.full_name} kalıcı olarak silinecek. Emin misiniz?`}
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
