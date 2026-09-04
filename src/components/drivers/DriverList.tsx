import { formatDate } from '@/lib/format';
import DriverFormModal from './DriverFormModal';
import ConfirmButton from '../ConfirmButton';
import { deactivateDriver, activateDriver, deleteDriver } from '@/actions/drivers';
import { dangerBtn, secondaryBtn } from '../formStyles';
import type { Driver } from '@/lib/types';

/**
 * Şoför listesi — hem müşterinin kendi sayfasında hem admin'in müşteri çalışma
 * alanında kullanılır. Tek fark actingUserId: verilirse her işlem o müşteri
 * adına yapılır.
 */
export default function DriverList({
  drivers,
  actingUserId,
}: {
  drivers: Driver[];
  actingUserId?: number;
}) {
  if (drivers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        Kayıtlı şoför yok.
      </p>
    );
  }

  // ConfirmButton'a giden ortak gizli alanlar (id her satırda eklenir).
  const acting: Record<string, number> =
    actingUserId != null ? { acting_user_id: actingUserId } : {};

  return (
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
            <DriverFormModal driver={d} actingUserId={actingUserId} />
            {d.is_active ? (
              <ConfirmButton
                action={deactivateDriver}
                hidden={{ id: d.id, ...acting }}
                label="Devre dışı"
                confirmText={`${d.full_name} devre dışı bırakılacak; geçmişi korunur. Emin misiniz?`}
                className={secondaryBtn}
              />
            ) : (
              <ConfirmButton
                action={activateDriver}
                hidden={{ id: d.id, ...acting }}
                label="Tekrar aktif et"
                confirmText={`${d.full_name} tekrar aktif edilecek. Onaylıyor musunuz?`}
                className={secondaryBtn}
              />
            )}
            <ConfirmButton
              action={deleteDriver}
              hidden={{ id: d.id, ...acting }}
              label="Sil"
              confirmText={`${d.full_name} kalıcı olarak silinecek. Emin misiniz?`}
              className={dangerBtn}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
