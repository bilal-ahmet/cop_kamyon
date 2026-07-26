'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField, SelectField, TextareaField } from '../fields';
import { createAssignment } from '@/actions/assignments';
import { primaryBtn } from '../formStyles';
import { lastNDates } from '@/lib/format';
import type { Vehicle, Driver } from '@/lib/types';

/** Şoför-araç tanımı oluşturma modalı. Araç ve aktif şoför listeleri props ile gelir. */
export default function AssignmentFormModal({
  vehicles,
  drivers,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
}) {
  const today = lastNDates(1)[0];

  return (
    <Modal triggerLabel="+ Yeni Tanım" triggerClassName={primaryBtn} title="Yeni Şoför-Araç Tanımı">
      {(close) => (
        <ActionForm action={createAssignment} submitLabel="Tanımla" onSuccess={close}>
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

          {/* Gelecek tarih engellenir: sonlandırma released_date >= assigned_date kısıtına takılır */}
          <TextField label="Tanım tarihi" name="assigned_date" type="date" max={today} />
          <TextareaField label="Not" name="notes" />
        </ActionForm>
      )}
    </Modal>
  );
}
