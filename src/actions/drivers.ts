'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { Driver } from '@/lib/types';
import { type ActionState, strOrNull } from './_shared';

/** Form alanlarından sürücü gövdesi oluşturur. */
function driverBody(formData: FormData) {
  return {
    full_name: String(formData.get('full_name') ?? '').trim(),
    license_no: strOrNull(formData.get('license_no')),
    phone: strOrNull(formData.get('phone')),
    birth_date: strOrNull(formData.get('birth_date')),
  };
}

/** Yeni sürücü ekler (POST /drivers). */
export async function createDriver(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const body = driverBody(formData);
  if (!body.full_name) return { error: 'Ad soyad zorunludur.' };

  const res = await apiMutate<Driver>('/drivers', 'POST', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/soforler');
  return { ok: true };
}

/** Sürücüyü günceller (PUT /drivers/:id). */
export async function updateDriver(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const body = driverBody(formData);
  if (!body.full_name) return { error: 'Ad soyad zorunludur.' };

  const res = await apiMutate<Driver>(`/drivers/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/soforler');
  return { ok: true };
}

/** Sürücüyü devre dışı bırakır (DELETE /drivers/:id). */
export async function deactivateDriver(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));

  const res = await apiMutate(`/drivers/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/soforler');
  return { ok: true };
}
