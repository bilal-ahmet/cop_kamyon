'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiMutate } from '@/lib/api';
import type { Vehicle } from '@/lib/types';
import { type ActionState, strOrNull, numOrNull } from './_shared';

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

/** Yeni araç oluşturur (POST /vehicles). */
export async function createVehicle(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const body = vehicleBody(formData);
  if (!body.plate) return { error: 'Plaka zorunludur.' };

  const res = await apiMutate<Vehicle>('/vehicles', 'POST', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard');
  return { ok: true };
}

/** Aracı günceller (PUT /vehicles/:id). */
export async function updateVehicle(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  const body = vehicleBody(formData);
  if (!body.plate) return { error: 'Plaka zorunludur.' };

  const res = await apiMutate<Vehicle>(`/vehicles/${id}`, 'PUT', body);
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/${id}`);
  return { ok: true };
}

/** Aracı devre dışı bırakır (DELETE /vehicles/:id) ve dashboard'a döner. */
export async function deleteVehicle(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));

  const res = await apiMutate(`/vehicles/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidatePath('/dashboard');
  redirect('/dashboard');
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
