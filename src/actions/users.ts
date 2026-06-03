'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { UserProfile } from '@/lib/types';
import { type ActionState, strOrNull } from './_shared';

/** Oturum sahibinin profilini günceller (PUT /users/me). Şifre boşsa değiştirilmez. */
export async function updateProfile(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const body: Record<string, string> = {};
  const email = strOrNull(formData.get('email'));
  const full_name = strOrNull(formData.get('full_name'));
  const password = strOrNull(formData.get('password'));

  if (email !== null) body.email = email;
  if (full_name !== null) body.full_name = full_name;
  if (password !== null) body.password = password;

  if (Object.keys(body).length === 0) {
    return { error: 'Güncellenecek alan yok.' };
  }

  const res = await apiMutate<UserProfile>('/users/me', 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/profil');
  return { ok: true };
}

/** Yeni kullanıcı oluşturur (POST /users). */
export async function createUser(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const username = String(formData.get('username') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!username || !email || !password) {
    return { error: 'Kullanıcı adı, e-posta ve şifre zorunludur.' };
  }

  const body = {
    username,
    email,
    password,
    full_name: strOrNull(formData.get('full_name')),
  };

  const res = await apiMutate<UserProfile>('/users', 'POST', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/kullanicilar');
  return { ok: true };
}
