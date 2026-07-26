'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { StopLocation, StopLocationKind } from '@/lib/types';
import { parseCoordinate, isValidLat, isValidLon } from '@/lib/coords';
import { type ActionState, numOrNull } from './_shared';

const KINDS: StopLocationKind[] = ['stop', 'start', 'end'];

/**
 * Form alanlarından durak lokasyonu gövdesi oluşturur.
 * Koordinatlar hem ondalık hem DMS ("40°47'17.8\"K") kabul eder — bkz. lib/coords.
 */
function stopLocationBody(formData: FormData) {
  const rawKind = String(formData.get('kind') ?? '');
  return {
    name: String(formData.get('name') ?? '').trim(),
    lat: parseCoordinate(String(formData.get('lat') ?? '')),
    lon: parseCoordinate(String(formData.get('lon') ?? '')),
    radius_m: numOrNull(formData.get('radius_m')) ?? 5,
    kind: (KINDS as string[]).includes(rawKind) ? (rawKind as StopLocationKind) : 'stop',
  };
}

/** Lokasyon değişikliği hem listeyi hem haritayı etkiler (harita gidiş/dönüş ayrımı kind'e bağlı). */
function revalidateStopLocation(vehicleId: number) {
  revalidatePath(`/dashboard/${vehicleId}/lokasyonlar`);
  revalidatePath(`/dashboard/${vehicleId}`);
}

/** Ortak doğrulama; hata varsa mesaj, yoksa null döner. */
function validateBody(body: ReturnType<typeof stopLocationBody>): string | null {
  if (!body.name) return 'Lokasyon adı zorunludur.';
  if (!isValidLat(body.lat)) {
    return 'Enlem anlaşılamadı. Örnek: 40.788278 veya 40°47\'17.8"K (-90 ile 90 arası).';
  }
  if (!isValidLon(body.lon)) {
    return 'Boylam anlaşılamadı. Örnek: 29.025 veya 29°01\'30"D (-180 ile 180 arası).';
  }
  return null;
}

/** Yeni durak lokasyonu oluşturur (POST /stop-locations). */
export async function createStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const vehicleId = Number(formData.get('vehicle_id'));
  const body = stopLocationBody(formData);
  const invalid = validateBody(body);
  if (invalid) return { error: invalid };

  const res = await apiMutate<StopLocation>('/stop-locations', 'POST', {
    vehicle_id: vehicleId,
    ...body,
  });
  if (!res.ok) return { error: res.error };

  revalidateStopLocation(vehicleId);
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
  const invalid = validateBody(body);
  if (invalid) return { error: invalid };

  const res = await apiMutate<StopLocation>(`/stop-locations/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidateStopLocation(vehicleId);
  return { ok: true };
}

/** Durak lokasyonunu devre dışı bırakır (POST /stop-locations/:id/deactivate). Kayıt durur. */
export async function deactivateStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicleId = Number(formData.get('vehicle_id'));
  if (!id) return { error: 'Geçersiz lokasyon.' };

  const res = await apiMutate(`/stop-locations/${id}/deactivate`, 'POST');
  if (!res.ok) return { error: res.error };

  revalidateStopLocation(vehicleId);
  return { ok: true };
}

/** Pasif lokasyonu tekrar aktif eder (PUT /stop-locations/:id { is_active: true }). */
export async function activateStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicleId = Number(formData.get('vehicle_id'));
  if (!id) return { error: 'Geçersiz lokasyon.' };

  const res = await apiMutate<StopLocation>(`/stop-locations/${id}`, 'PUT', { is_active: true });
  if (!res.ok) return { error: res.error };

  revalidateStopLocation(vehicleId);
  return { ok: true };
}

/** Durak lokasyonunu kalıcı olarak siler (DELETE /stop-locations/:id). */
export async function deleteStopLocation(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const vehicleId = Number(formData.get('vehicle_id'));
  if (!id) return { error: 'Geçersiz lokasyon.' };

  const res = await apiMutate(`/stop-locations/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidateStopLocation(vehicleId);
  revalidatePath(`/dashboard/${vehicleId}/duraklar`); // bağlı ziyaret kayıtlarının bağı koptu
  return { ok: true };
}
