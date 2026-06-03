'use client';

import Modal from '../Modal';
import ActionForm from '../ActionForm';
import { TextField } from '../fields';
import { updateProfile } from '@/actions/users';
import { secondaryBtn } from '../formStyles';
import type { UserProfile } from '@/lib/types';

/** Oturum sahibinin profil düzenleme modalı (e-posta, ad soyad, şifre). */
export default function ProfileModal({ user }: { user: UserProfile }) {
  return (
    <Modal triggerLabel="Profilim" triggerClassName={secondaryBtn} title="Profilim">
      {(close) => (
        <ActionForm action={updateProfile} submitLabel="Kaydet" onSuccess={close}>
          <p className="text-sm text-zinc-500">
            Kullanıcı adı: <span className="font-medium text-zinc-700">{user.username}</span>
          </p>
          <TextField label="E-posta" name="email" type="email" defaultValue={user.email} />
          <TextField label="Ad soyad" name="full_name" defaultValue={user.full_name} />
          <TextField
            label="Yeni şifre (boş bırakılırsa değişmez)"
            name="password"
            type="password"
          />
        </ActionForm>
      )}
    </Modal>
  );
}
