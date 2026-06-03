'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { StopLocation } from '@/lib/types';
import { type ActionState, strOrNull, numOrNull } from './_shared';

/** Form alanlarından durak lokasyonu gövdesi oluşturur. */
function stopLocationBody(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    lat: numOrNull(formData.get('lat')),
    lon: numOrNull(formData.get('lon')),
    radius_m: numOrNull(formData.get('radius_m')) ?? 5,
  };
}

/** Yeni durak lokasyonu oluşturur (POST /stop-locations). */
export async function createStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const vehicleId = Number(formData.get('vehicle_id'));
  const body = stopLocationBody(formData);
  if (!body.name || body.lat == null || body.lon == null) {
    return { error: 'İsim, enlem ve boylam zorunludur.' };
  }

  const res = await apiMutate<StopLocation>('/stop-locations', 'POST', {
    vehicle_id: vehicleId,
    ...body,
  });
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicleId}/lokasyonlar`);
  return { ok: true };
}

/** Durak lokasyonunu günceller (PUT /stop-locations/:id). */
export async function updateStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicleId = Number(formData.get('vehicle_id'));
  const body = stopLocationBody(formData);
  if (!body.name || body.lat == null || body.lon == null) {
    return { error: 'İsim, enlem ve boylam zorunludur.' };
  }

  const res = await apiMutate<StopLocation>(`/stop-locations/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicleId}/lokasyonlar`);
  return { ok: true };
}

/** Durak lokasyonunu devre dışı bırakır (DELETE /stop-locations/:id). */
export async function deactivateStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicleId = Number(formData.get('vehicle_id'));

  const res = await apiMutate(`/stop-locations/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicleId}/lokasyonlar`);
  return { ok: true };
}
