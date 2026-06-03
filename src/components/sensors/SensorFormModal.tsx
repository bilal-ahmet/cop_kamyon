'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField, TextareaField, CheckboxField } from '../fields';
import { createSensor, updateSensor } from '@/actions/sensors';
import { primaryBtn, secondaryBtn } from '../formStyles';
import type { Sensor } from '@/lib/types';

/**
 * Sensör kayıt/düzenleme modalı.
 * sensor verilmezse yeni kayıt (vehicleId gerekli); verilirse düzenleme.
 */
export default function SensorFormModal({
  vehicleId,
  sensor,
}: {
  vehicleId: number;
  sensor?: Sensor;
}) {
  const editing = Boolean(sensor);

  return (
    <Modal
      triggerLabel={editing ? 'Düzenle' : '+ Sensör Ekle'}
      triggerClassName={editing ? secondaryBtn : primaryBtn}
      title={editing ? 'Sensörü Düzenle' : 'Yeni Sensör'}
    >
      {(close) => (
        <ActionForm
          action={editing ? updateSensor : createSensor}
          submitLabel={editing ? 'Kaydet' : 'Kayıt Et'}
          onSuccess={close}
        >
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          {editing && <input type="hidden" name="id" value={sensor!.id} />}

          <TextField
            label="Seri numarası *"
            name="serial_number"
            defaultValue={sensor?.serial_number}
            required
            placeholder="SN-..."
          />
          <TextField
            label="Firmware sürümü"
            name="firmware_version"
            defaultValue={sensor?.firmware_version}
          />
          <TextareaField label="Not" name="notes" defaultValue={sensor?.notes} />
          {editing && (
            <CheckboxField label="Aktif" name="is_active" defaultChecked={sensor!.is_active} />
          )}
        </ActionForm>
      )}
    </Modal>
  );
}
