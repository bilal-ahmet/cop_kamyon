import { getAssignments, getVehiclesForUser, getDrivers } from '@/lib/api';
import AssignmentFormModal from '@/components/assignments/AssignmentFormModal';
import AssignmentList from '@/components/assignments/AssignmentList';

/**
 * Müşteri çalışma alanı → Şoför-Araç Tanımlama.
 * Araç ve şoför listeleri de bu müşteriyle sınırlı; admin yanlışlıkla başka bir
 * müşterinin şoförünü bu araca tanımlayamaz.
 */
export default async function CustomerAssignmentsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const id = Number(userId);

  const [assignments, vehicles, drivers] = await Promise.all([
    getAssignments({ userId: id }),
    getVehiclesForUser(id),
    getDrivers(false, id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Şoför-Araç Tanımlama</h2>
        <AssignmentFormModal vehicles={vehicles} drivers={drivers} actingUserId={id} />
      </div>

      <AssignmentList assignments={assignments} actingUserId={id} />
    </div>
  );
}
