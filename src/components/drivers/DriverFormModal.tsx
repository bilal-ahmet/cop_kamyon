'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField } from '../fields';
import { createDriver, updateDriver } from '@/actions/drivers';
import { primaryBtn, secondaryBtn } from '../formStyles';
import type { Driver } from '@/lib/types';

/** Sürücü ekleme/düzenleme modalı. */
export default function DriverFormModal({ driver }: { driver?: Driver }) {
  const editing = Boolean(driver);

  return (
    <Modal
      triggerLabel={editing ? 'Düzenle' : '+ Yeni Şoför'}
      triggerClassName={editing ? secondaryBtn : primaryBtn}
      title={editing ? 'Şoförü Düzenle' : 'Yeni Şoför'}
    >
      {(close) => (
        <ActionForm
          action={editing ? updateDriver : createDriver}
          submitLabel={editing ? 'Kaydet' : 'Ekle'}
          onSuccess={close}
        >
          {editing && <input type="hidden" name="id" value={driver!.id} />}
          <TextField label="Ad soyad *" name="full_name" defaultValue={driver?.full_name} required />
          <TextField label="Ehliyet no" name="license_no" defaultValue={driver?.license_no} />
          <TextField label="Telefon" name="phone" defaultValue={driver?.phone} />
          <TextField
            label="Doğum tarihi"
            name="birth_date"
            type="date"
            defaultValue={driver?.birth_date ? driver.birth_date.slice(0, 10) : undefined}
          />
        </ActionForm>
      )}
    </Modal>
  );
}
