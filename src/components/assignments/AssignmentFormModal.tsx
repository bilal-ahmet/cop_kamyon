'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField, SelectField, TextareaField } from '../fields';
import { createAssignment } from '@/actions/assignments';
import { primaryBtn } from '../formStyles';
import type { Vehicle, Driver } from '@/lib/types';

/** Sürücü-araç ataması oluşturma modalı. Araç ve aktif şoför listeleri props ile gelir. */
export default function AssignmentFormModal({
  vehicles,
  drivers,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
}) {
  return (
    <Modal triggerLabel="+ Yeni Atama" triggerClassName={primaryBtn} title="Yeni Atama">
      {(close) => (
        <ActionForm action={createAssignment} submitLabel="Ata" onSuccess={close}>
          <SelectField label="Araç *" name="vehicle_id" required>
            <option value="">Seçiniz…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </SelectField>

          <SelectField label="Şoför *" name="driver_id" required>
            <option value="">Seçiniz…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </SelectField>

          <TextField label="Atama tarihi" name="assigned_date" type="date" />
          <TextareaField label="Not" name="notes" />
        </ActionForm>
      )}
    </Modal>
  );
}
