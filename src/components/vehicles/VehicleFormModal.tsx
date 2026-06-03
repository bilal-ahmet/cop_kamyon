'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField } from '../fields';
import { createVehicle, updateVehicle } from '@/actions/vehicles';
import { primaryBtn, secondaryBtn } from '../formStyles';
import type { Vehicle } from '@/lib/types';

/** Araç oluşturma/düzenleme modalı. vehicle verilirse düzenleme modunda çalışır. */
export default function VehicleFormModal({ vehicle }: { vehicle?: Vehicle }) {
  const editing = Boolean(vehicle);

  return (
    <Modal
      triggerLabel={editing ? 'Düzenle' : '+ Yeni Araç'}
      triggerClassName={editing ? secondaryBtn : primaryBtn}
      title={editing ? 'Aracı Düzenle' : 'Yeni Araç'}
    >
      {(close) => (
        <ActionForm
          action={editing ? updateVehicle : createVehicle}
          submitLabel={editing ? 'Kaydet' : 'Oluştur'}
          onSuccess={close}
        >
          {editing && <input type="hidden" name="id" value={vehicle!.id} />}
          <TextField label="Plaka *" name="plate" defaultValue={vehicle?.plate} required />
          <TextField label="Marka" name="brand" defaultValue={vehicle?.brand} />
          <TextField label="Model" name="model" defaultValue={vehicle?.model} />
          <TextField label="Yıl" name="year" type="number" defaultValue={vehicle?.year} />
          <TextField label="Araç tipi" name="vehicle_type" defaultValue={vehicle?.vehicle_type} />
          <TextField
            label="Kapasite (kg)"
            name="capacity_kg"
            type="number"
            step="0.01"
            defaultValue={vehicle?.capacity_kg}
          />
        </ActionForm>
      )}
    </Modal>
  );
}
