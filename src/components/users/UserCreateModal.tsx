'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField } from '../fields';
import { createUser } from '@/actions/users';
import { primaryBtn } from '../formStyles';

/** Yeni kullanıcı (yönetici/izleyici) oluşturma modalı. */
export default function UserCreateModal() {
  return (
    <Modal triggerLabel="+ Yeni Kullanıcı" triggerClassName={primaryBtn} title="Yeni Kullanıcı">
      {(close) => (
        <ActionForm action={createUser} submitLabel="Oluştur" onSuccess={close}>
          <TextField label="Kullanıcı adı *" name="username" required />
          <TextField label="E-posta *" name="email" type="email" required />
          <TextField label="Şifre *" name="password" type="password" required />
          <TextField label="Ad soyad" name="full_name" />
        </ActionForm>
      )}
    </Modal>
  );
}
