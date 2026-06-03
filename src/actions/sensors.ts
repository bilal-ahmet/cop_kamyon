'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { Sensor } from '@/lib/types';
import { type ActionState, strOrNull } from './_shared';

/** Sensör kayıt eder (POST /sensors). vehicle_id ve serial_number zorunlu. */
export async function createSensor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const vehicle_id = Number(formData.get('vehicle_id'));
  const serial_number = String(formData.get('serial_number') ?? '').trim();
  if (!vehicle_id || !serial_number) {
    return { error: 'Araç ve seri numarası zorunludur.' };
  }

  const body = {
    vehicle_id,
    serial_number,
    firmware_version: strOrNull(formData.get('firmware_version')),
    notes: strOrNull(formData.get('notes')),
  };

  const res = await apiMutate<Sensor>('/sensors', 'POST', body);
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicle_id}/sensorler`);
  return { ok: true };
}

/** Sensörü günceller (PUT /sensors/:id). */
export async function updateSensor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicle_id = Number(formData.get('vehicle_id'));
  const serial_number = String(formData.get('serial_number') ?? '').trim();
  if (!serial_number) return { error: 'Seri numarası zorunludur.' };

  const body = {
    serial_number,
    firmware_version: strOrNull(formData.get('firmware_version')),
    is_active: formData.get('is_active') === 'on',
    notes: strOrNull(formData.get('notes')),
  };

  const res = await apiMutate<Sensor>(`/sensors/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicle_id}/sensorler`);
  return { ok: true };
}

/** Sensörü devre dışı bırakır (DELETE /sensors/:id). */
export async function deactivateSensor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicle_id = Number(formData.get('vehicle_id'));

  const res = await apiMutate(`/sensors/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicle_id}/sensorler`);
  return { ok: true };
}
