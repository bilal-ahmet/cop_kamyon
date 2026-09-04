'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { VehicleAssignment } from '@/lib/types';
import { type ActionState, strOrNull, actingUserFrom } from './_shared';

/**
 * Tanım listesi hem Şoför-Araç Tanımlama sayfasında hem şoför sayfasında etkili.
 * Admin bir müşteri adına çalışıyorsa o müşterinin çalışma alanı da tazelenir.
 */
function revalidateAssignment(actingUserId?: number) {
  revalidatePath('/dashboard/atamalar');
  if (actingUserId) {
    revalidatePath(`/dashboard/users/${actingUserId}/atamalar`);
  }
}

/** Sürücüyü araca atar (POST /assignments). */
export async function createAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const vehicle_id = Number(formData.get('vehicle_id'));
  const driver_id = Number(formData.get('driver_id'));
  if (!vehicle_id || !driver_id) {
    return { error: 'Araç ve sürücü seçimi zorunludur.' };
  }

  const body = {
    vehicle_id,
    driver_id,
    assigned_date: strOrNull(formData.get('assigned_date')),
    notes: strOrNull(formData.get('notes')),
  };

  const res = await apiMutate<VehicleAssignment>('/assignments', 'POST', body, { actingUserId });
  if (!res.ok) return { error: res.error };

  revalidateAssignment(actingUserId);
  return { ok: true };
}

/** Atamayı günceller (PUT /assignments/:id) — released_date / notes. */
export async function updateAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const id = Number(formData.get('id'));
  const body = {
    released_date: strOrNull(formData.get('released_date')),
    notes: strOrNull(formData.get('notes')),
  };

  const res = await apiMutate<VehicleAssignment>(`/assignments/${id}`, 'PUT', body, {
    actingUserId,
  });
  if (!res.ok) return { error: res.error };

  revalidateAssignment(actingUserId);
  return { ok: true };
}

/** Tanımı sonlandırır (POST /assignments/:id/end → released_date = bugün). */
export async function endAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Geçersiz kayıt.' };

  const res = await apiMutate<VehicleAssignment>(`/assignments/${id}/end`, 'POST', undefined, {
    actingUserId,
  });
  if (!res.ok) return { error: res.error };

  revalidateAssignment(actingUserId);
  return { ok: true };
}

/**
 * Sonlanmış tanımı tekrar aktif eder (PUT /assignments/:id { released_date: null }).
 * Araçta başka bir aktif tanım varsa backend 409 ile engeller.
 */
export async function reopenAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Geçersiz kayıt.' };

  const res = await apiMutate<VehicleAssignment>(
    `/assignments/${id}`,
    'PUT',
    { released_date: null },
    { actingUserId },
  );
  if (!res.ok) return { error: res.error };

  revalidateAssignment(actingUserId);
  return { ok: true };
}

/** Tanımı kalıcı olarak siler (DELETE /assignments/:id). */
export async function deleteAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Geçersiz kayıt.' };

  const res = await apiMutate(`/assignments/${id}`, 'DELETE', undefined, { actingUserId });
  if (!res.ok) return { error: res.error };

  revalidateAssignment(actingUserId);
  return { ok: true };
}
