'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField } from '../fields';
import { createStopLocation, updateStopLocation } from '@/actions/stopLocations';
import { primaryBtn, secondaryBtn } from '../formStyles';
import type { StopLocation } from '@/lib/types';

/** Durak lokasyonu oluşturma/düzenleme modalı. */
export default function StopLocationFormModal({
  vehicleId,
  stopLocation,
}: {
  vehicleId: number;
  stopLocation?: StopLocation;
}) {
  const editing = Boolean(stopLocation);

  return (
    <Modal
      triggerLabel={editing ? 'Düzenle' : '+ Yeni Lokasyon'}
      triggerClassName={editing ? secondaryBtn : primaryBtn}
      title={editing ? 'Lokasyonu Düzenle' : 'Yeni Durak Lokasyonu'}
    >
      {(close) => (
        <ActionForm
          action={editing ? updateStopLocation : createStopLocation}
          submitLabel={editing ? 'Kaydet' : 'Ekle'}
          onSuccess={close}
        >
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          {editing && <input type="hidden" name="id" value={stopLocation!.id} />}

          <TextField
            label="Lokasyon adı *"
            name="name"
            defaultValue={stopLocation?.name}
            required
            placeholder="Örn: Atatürk Cad. No:12 önü"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Enlem *"
              name="lat"
              type="number"
              step="any"
              defaultValue={stopLocation?.lat}
              required
              placeholder="41.01234"
            />
            <TextField
              label="Boylam *"
              name="lon"
              type="number"
              step="any"
              defaultValue={stopLocation?.lon}
              required
              placeholder="29.01234"
            />
          </div>
          <TextField
            label="Yarıçap (metre)"
            name="radius_m"
            type="number"
            defaultValue={stopLocation?.radius_m ?? 5}
            placeholder="5"
          />
          <p className="text-xs text-zinc-500">
            Kamyon bu yarıçap içine girdiğinde varış otomatik kaydedilir.
          </p>
        </ActionForm>
      )}
    </Modal>
  );
}
