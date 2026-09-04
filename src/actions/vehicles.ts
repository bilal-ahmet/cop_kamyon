'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate } from '@/lib/api';
import type { Vehicle } from '@/lib/types';
import { type ActionState, strOrNull, numOrNull, actingUserFrom } from './_shared';

/** Form alanlarından araç gövdesi (body) oluşturur. */
function vehicleBody(formData: FormData) {
  return {
    plate: String(formData.get('plate') ?? '').trim(),
    brand: strOrNull(formData.get('brand')),
    model: strOrNull(formData.get('model')),
    year: numOrNull(formData.get('year')),
    vehicle_type: strOrNull(formData.get('vehicle_type')),
    capacity_kg: numOrNull(formData.get('capacity_kg')),
  };
}

/**
 * Araç listesi hem panelde hem admin'in müşteri çalışma alanında görünür.
 */
function revalidateVehicleList(actingUserId?: number) {
  revalidatePath('/dashboard');
  if (actingUserId) revalidatePath(`/dashboard/users/${actingUserId}`);
}

/** Yeni araç oluşturur (POST /vehicles). Admin çalışma alanındaysa araç o müşteriye ait olur. */
export async function createVehicle(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const body = vehicleBody(formData);
  if (!body.plate) return { error: 'Plaka zorunludur.' };

  const res = await apiMutate<Vehicle>('/vehicles', 'POST', body, { actingUserId });
  if (!res.ok) return { error: res.error };

  revalidateVehicleList(actingUserId);
  return { ok: true };
}

/** Aracı günceller (PUT /vehicles/:id). */
export async function updateVehicle(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const id = Number(formData.get('id'));
  const body = vehicleBody(formData);
  if (!body.plate) return { error: 'Plaka zorunludur.' };

  const res = await apiMutate<Vehicle>(`/vehicles/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidateVehicleList(actingUserId);
  revalidatePath(`/dashboard/${id}`);
  return { ok: true };
}

/**
 * Aracı devre dışı bırakır (DELETE /vehicles/:id) ve araç listesine döner.
 * Admin bir müşterinin aracını sildiyse o müşterinin araç listesine döner —
 * yoksa kullanıcı listesine düşerdi.
 */
export async function deleteVehicle(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actingUserId = actingUserFrom(formData);
  const id = Number(formData.get('id'));

  const res = await apiMutate(`/vehicles/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidateVehicleList(actingUserId);
  redirect(actingUserId ? `/dashboard/users/${actingUserId}` : '/dashboard');
}

/** Form alanlarından durak (waypoint) gövdesi oluşturur. */
function waypointBody(formData: FormData) {
  return {
    location_name: strOrNull(formData.get('location_name')),
    lat: numOrNull(formData.get('lat')),
    lon: numOrNull(formData.get('lon')),
    arrived_at: strOrNull(formData.get('arrived_at')),
    departed_at: strOrNull(formData.get('departed_at')),
    load_received_kg: numOrNull(formData.get('load_received_kg')),
    load_delivered_kg: numOrNull(formData.get('load_delivered_kg')),
    driver_id: numOrNull(formData.get('driver_id')),
    notes: strOrNull(formData.get('notes')),
  };
}

/** Araca yeni durak ekler (POST /vehicles/:id/waypoints). */
export async function createWaypoint(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const vehicleId = Number(formData.get('vehicle_id'));
  const body = waypointBody(formData);
  if (body.lat == null || body.lon == null || !body.arrived_at) {
    return { error: 'Konum (enlem/boylam) ve varış zamanı zorunludur.' };
  }

  const res = await apiMutate(`/vehicles/${vehicleId}/waypoints`, 'POST', body);
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicleId}/duraklar`);
  return { ok: true };
}

/** Durağı günceller (PUT /vehicles/:id/waypoints/:waypointId). */
export async function updateWaypoint(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const vehicleId = Number(formData.get('vehicle_id'));
  const waypointId = Number(formData.get('id'));
  const body = waypointBody(formData);
  if (body.lat == null || body.lon == null || !body.arrived_at) {
    return { error: 'Konum (enlem/boylam) ve varış zamanı zorunludur.' };
  }

  const res = await apiMutate(`/vehicles/${vehicleId}/waypoints/${waypointId}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicleId}/duraklar`);
  return { ok: true };
}

/** Durağı siler (DELETE /vehicles/:id/waypoints/:waypointId). */
export async function deleteWaypoint(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const vehicleId = Number(formData.get('vehicle_id'));
  const waypointId = Number(formData.get('id'));

  const res = await apiMutate(`/vehicles/${vehicleId}/waypoints/${waypointId}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidatePath(`/dashboard/${vehicleId}/duraklar`);
  return { ok: true };
}
