'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { StopLocation, StopLocationKind } from '@/lib/types';
import { type ActionState, numOrNull } from './_shared';

const KINDS: StopLocationKind[] = ['stop', 'start', 'end'];

/** Form alanlarından durak lokasyonu gövdesi oluşturur. */
function stopLocationBody(formData: FormData) {
  const rawKind = String(formData.get('kind') ?? '');
  return {
    name: String(formData.get('name') ?? '').trim(),
    lat: numOrNull(formData.get('lat')),
    lon: numOrNull(formData.get('lon')),
    radius_m: numOrNull(formData.get('radius_m')) ?? 5,
    kind: (KINDS as string[]).includes(rawKind) ? (rawKind as StopLocationKind) : 'stop',
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
  revalidatePath(`/dashboard/${vehicleId}`); // harita gidiş/dönüş ayrımı için kind'e bağlı
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
  revalidatePath(`/dashboard/${vehicleId}`); // harita gidiş/dönüş ayrımı için kind'e bağlı
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
  revalidatePath(`/dashboard/${vehicleId}`); // harita gidiş/dönüş ayrımı için kind'e bağlı
  return { ok: true };
}
