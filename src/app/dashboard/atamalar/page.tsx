import Link from 'next/link';
import { getAssignments, getVehicles, getDrivers } from '@/lib/api';
import AssignmentFormModal from '@/components/assignments/AssignmentFormModal';
import AssignmentList from '@/components/assignments/AssignmentList';

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
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">Şoför-Araç Tanımlama</h1>
        </div>
        <AssignmentFormModal vehicles={vehicles} drivers={drivers} />
      </div>

      <AssignmentList assignments={assignments} />
    </div>
  );
}
