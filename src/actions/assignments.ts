'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { VehicleAssignment } from '@/lib/types';
import { type ActionState, strOrNull } from './_shared';

/** Sürücüyü araca atar (POST /assignments). */
export async function createAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
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

  const res = await apiMutate<VehicleAssignment>('/assignments', 'POST', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/atamalar');
  return { ok: true };
}

/** Atamayı günceller (PUT /assignments/:id) — released_date / notes. */
export async function updateAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const body = {
    released_date: strOrNull(formData.get('released_date')),
    notes: strOrNull(formData.get('notes')),
  };

  const res = await apiMutate<VehicleAssignment>(`/assignments/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/atamalar');
  return { ok: true };
}

/** Atamayı sonlandırır (DELETE /assignments/:id → released_date = bugün). */
export async function endAssignment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));

  const res = await apiMutate(`/assignments/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard/atamalar');
  return { ok: true };
}
