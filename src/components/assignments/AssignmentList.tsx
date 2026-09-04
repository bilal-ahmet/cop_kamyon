import { formatDate } from '@/lib/format';
import AssignmentEditModal from './AssignmentEditModal';
import ConfirmButton from '../ConfirmButton';
import { endAssignment, reopenAssignment, deleteAssignment } from '@/actions/assignments';
import { dangerBtn, secondaryBtn } from '../formStyles';
import type { VehicleAssignment } from '@/lib/types';

/**
 * Şoför-araç tanım listesi — hem müşterinin kendi sayfasında hem admin'in
 * müşteri çalışma alanında kullanılır. actingUserId verilirse işlemler o
 * müşteri adına yapılır (tazeleme de o çalışma alanına gider).
 */
export default function AssignmentList({
  assignments,
  actingUserId,
}: {
  assignments: VehicleAssignment[];
  actingUserId?: number;
}) {
  if (assignments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        Şoför-araç tanımı yok.
      </p>
    );
  }

  const acting: Record<string, number> =
    actingUserId != null ? { acting_user_id: actingUserId } : {};

  return (
    <ul className="flex flex-col gap-3">
      {assignments.map((a) => {
        const active = a.released_date === null;
        const driver = a.driver_name ?? `Şoför #${a.driver_id}`;
        const plate = a.vehicle_plate ?? `Araç #${a.vehicle_id}`;

        return (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">{driver}</span>
                <span className="text-zinc-400">→</span>
                <span className="font-mono text-zinc-700">{plate}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {active ? 'Aktif' : 'Sonlandı'}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {formatDate(a.assigned_date)}
                {a.released_date && ` → ${formatDate(a.released_date)}`}
                {a.notes && ` · ${a.notes}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AssignmentEditModal assignment={a} actingUserId={actingUserId} />
              {active ? (
                <ConfirmButton
                  action={endAssignment}
                  hidden={{ id: a.id, ...acting }}
                  label="Sonlandır"
                  confirmText={`${driver} → ${plate} tanımı sonlandırılacak. Emin misiniz?`}
                  className={secondaryBtn}
                />
              ) : (
                <ConfirmButton
                  action={reopenAssignment}
                  hidden={{ id: a.id, ...acting }}
                  label="Tekrar aktif et"
                  confirmText={`${driver} → ${plate} tanımı tekrar aktif edilecek. Onaylıyor musunuz?`}
                  className={secondaryBtn}
                />
              )}
              <ConfirmButton
                action={deleteAssignment}
                hidden={{ id: a.id, ...acting }}
                label="Sil"
                confirmText={`${driver} — ${plate} tanımı kalıcı olarak silinecek. Emin misiniz?`}
                className={dangerBtn}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
