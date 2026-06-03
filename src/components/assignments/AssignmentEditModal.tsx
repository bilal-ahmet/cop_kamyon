'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField, TextareaField } from '../fields';
import { updateAssignment } from '@/actions/assignments';
import { secondaryBtn } from '../formStyles';
import type { VehicleAssignment } from '@/lib/types';

/** Atama düzenleme modalı — serbest bırakma tarihi ve not. */
export default function AssignmentEditModal({ assignment }: { assignment: VehicleAssignment }) {
  return (
    <Modal triggerLabel="Düzenle" triggerClassName={secondaryBtn} title="Atamayı Düzenle">
      {(close) => (
        <ActionForm action={updateAssignment} submitLabel="Kaydet" onSuccess={close}>
          <input type="hidden" name="id" value={assignment.id} />
          <p className="text-sm text-zinc-500">
            {assignment.vehicle_plate ?? `Araç #${assignment.vehicle_id}`} ←{' '}
            {assignment.driver_name ?? `Şoför #${assignment.driver_id}`}
          </p>
          <TextField
            label="Serbest bırakma tarihi"
            name="released_date"
            type="date"
            defaultValue={assignment.released_date ? assignment.released_date.slice(0, 10) : undefined}
          />
          <TextareaField label="Not" name="notes" defaultValue={assignment.notes} />
        </ActionForm>
      )}
    </Modal>
  );
}
