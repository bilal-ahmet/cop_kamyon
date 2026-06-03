'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField, TextareaField, SelectField } from '../fields';
import { createWaypoint, updateWaypoint } from '@/actions/vehicles';
import { primaryBtn, secondaryBtn } from '../formStyles';
import type { Waypoint, Driver } from '@/lib/types';

/** datetime-local input için ISO değeri "YYYY-MM-DDTHH:mm" biçimine indirger. */
function toLocalInput(iso: string | null | undefined): string | undefined {
  return iso ? iso.slice(0, 16) : undefined;
}

/**
 * Durak (waypoint) oluşturma/düzenleme modalı.
 * waypoint verilmezse yeni kayıt; verilirse düzenleme.
 */
export default function WaypointFormModal({
  vehicleId,
  drivers,
  waypoint,
}: {
  vehicleId: number;
  drivers: Driver[];
  waypoint?: Waypoint;
}) {
  const editing = Boolean(waypoint);

  return (
    <Modal
      triggerLabel={editing ? 'Düzenle' : '+ Yeni Durak'}
      triggerClassName={editing ? secondaryBtn : primaryBtn}
      title={editing ? 'Durağı Düzenle' : 'Yeni Durak'}
    >
      {(close) => (
        <ActionForm
          action={editing ? updateWaypoint : createWaypoint}
          submitLabel={editing ? 'Kaydet' : 'Ekle'}
          onSuccess={close}
        >
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          {editing && <input type="hidden" name="id" value={waypoint!.id} />}

          <TextField label="Konum adı" name="location_name" defaultValue={waypoint?.location_name} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Enlem *" name="lat" type="number" step="any" defaultValue={waypoint?.lat} required />
            <TextField label="Boylam *" name="lon" type="number" step="any" defaultValue={waypoint?.lon} required />
          </div>
          <TextField
            label="Varış *"
            name="arrived_at"
            type="datetime-local"
            defaultValue={toLocalInput(waypoint?.arrived_at)}
            required
          />
          <TextField
            label="Ayrılış"
            name="departed_at"
            type="datetime-local"
            defaultValue={toLocalInput(waypoint?.departed_at)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Alınan yük (kg)"
              name="load_received_kg"
              type="number"
              step="0.01"
              defaultValue={waypoint?.load_received_kg}
            />
            <TextField
              label="Bırakılan yük (kg)"
              name="load_delivered_kg"
              type="number"
              step="0.01"
              defaultValue={waypoint?.load_delivered_kg}
            />
          </div>
          <SelectField label="Şoför" name="driver_id" defaultValue={waypoint?.driver_id ?? ''}>
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </SelectField>
          <TextareaField label="Not" name="notes" defaultValue={waypoint?.notes} />
        </ActionForm>
      )}
    </Modal>
  );
}
