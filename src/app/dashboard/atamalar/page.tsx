import Link from 'next/link';
import { getAssignments, getVehicles, getDrivers } from '@/lib/api';
import { formatDate } from '@/lib/format';
import AssignmentFormModal from '@/components/assignments/AssignmentFormModal';
import AssignmentEditModal from '@/components/assignments/AssignmentEditModal';
import ConfirmButton from '@/components/ConfirmButton';
import { endAssignment } from '@/actions/assignments';
import { dangerBtn } from '@/components/formStyles';

// Atama yönetimi: sürücü-araç atamalarını listele, oluştur, sonlandır.
export default async function AssignmentsPage() {
  const [assignments, vehicles, drivers] = await Promise.all([
    getAssignments(),
    getVehicles(),
    getDrivers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Araçlara dön
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">Atamalar</h1>
        </div>
        <AssignmentFormModal vehicles={vehicles} drivers={drivers} />
      </div>

      {assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Atama kaydı yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {assignments.map((a) => {
            const active = a.released_date === null;
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {a.vehicle_plate ?? `Araç #${a.vehicle_id}`}
                    </span>
                    <span className="text-zinc-400">←</span>
                    <span className="text-zinc-700">
                      {a.driver_name ?? `Şoför #${a.driver_id}`}
                    </span>
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
                  <AssignmentEditModal assignment={a} />
                  {active && (
                    <ConfirmButton
                      action={endAssignment}
                      hidden={{ id: a.id }}
                      label="Sonlandır"
                      confirmText="Bu atamayı sonlandırmak istediğinize emin misiniz?"
                      className={dangerBtn}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
