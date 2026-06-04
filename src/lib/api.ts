import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession, deleteSession } from './session';
import { normalizeLocation, normalizeTelemetry } from './normalize';
import type {
  Vehicle,
  VehicleLocation,
  DailySummary,
  Waypoint,
  Sensor,
  Driver,
  VehicleAssignment,
  TelemetryRecord,
  UserProfile,
  StopLocation,
} from './types';

const BACKEND_URL = process.env.BACKEND_URL;

if (!BACKEND_URL) {
  // Geliştirme sırasında eksik yapılandırmayı erken yakalamak için.
  throw new Error('BACKEND_URL ortam değişkeni tanımlı değil (.env.local).');
}

/**
 * Token GEREKTİRMEYEN login isteği. Backend { token, user } veya hata mesajı döner.
 * Hata fırlatmaz; { ok, ... } şeklinde sonuç döndürür ki Server Action mesajı gösterebilsin.
 */
export async function loginRequest(
  username: string,
  password: string,
): Promise<
  | { ok: true; token: string; user: { id: number; username: string; full_name: string; role: string } }
  | { ok: false; error: string }
> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Sunucuya ulaşılamadı. Backend çalışıyor mu?' };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, error: data?.error ?? 'Giriş başarısız' };
  }

  return { ok: true, token: data.token, user: data.user };
}

/**
 * Oturumdaki token ile backend'e kimlik doğrulamalı istek atan ortak yardımcı.
 * 401/403 durumunda oturumu temizler ve login'e yönlendirir.
 * `allow404: true` verilirse 404'te hata fırlatmaz, null döner.
 */
async function apiFetch<T>(
  path: string,
  opts: { allow404?: boolean } = {},
): Promise<T | null> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });

  if (res.status === 401) {
    // Token süresi dolmuş/geçersiz: oturumu temizle ve giriş ekranına gönder.
    await deleteSession();
    redirect('/login');
  }

  if (res.status === 403) {
    throw new Error('Bu kaynağa erişim yetkiniz yok (403).');
  }

  if (res.status === 404 && opts.allow404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Backend hatası (${res.status}) — ${path}`);
  }

  return res.json() as Promise<T>;
}

/** Mutasyon (POST/PUT/DELETE) sonucu. Hata fırlatmaz; Server Action mesaj gösterebilsin diye { ok } döner. */
export type MutateResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Kimlik doğrulamalı yazma isteği (POST/PUT/DELETE).
 * - Token yoksa / 401 / 403 → oturumu temizler ve login'e yönlendirir (apiFetch ile aynı davranış).
 * - 400/404/409 gibi iş kuralı hatalarında { ok: false, error } döner (forma gösterilir).
 */
export async function apiMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<MutateResult<T>> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Sunucuya ulaşılamadı. Backend çalışıyor mu?' };
  }

  if (res.status === 401) {
    await deleteSession();
    redirect('/login');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: (data as { error?: string })?.error ?? `İşlem başarısız (${res.status})`,
    };
  }

  return { ok: true, data: data as T };
}

/**
 * Giriş yapan kullanıcının araçları.
 * React.cache ile sarmalı: aynı istek (request) içinde tekrar çağrılınca backend'e
 * yeniden gidilmez (layout + sayfalar aynı sonucu paylaşır).
 */
export const getVehicles = cache(async (): Promise<Vehicle[]> => {
  return (await apiFetch<Vehicle[]>('/vehicles')) ?? [];
});

/** Tek bir aracı id ile getirir (kullanıcının araç listesinden). Sahiplik de böylece doğrulanır. */
export async function getVehicleById(id: number): Promise<Vehicle | null> {
  const vehicles = await getVehicles();
  return vehicles.find((v) => v.id === id) ?? null;
}

/** Aracın son konumu. Henüz telemetri yoksa (404) null döner. NUMERIC alanlar number'a çevrilir. */
export async function getVehicleLocation(id: number): Promise<VehicleLocation | null> {
  const raw = await apiFetch<Record<string, unknown>>(`/vehicles/${id}/location`, {
    allow404: true,
  });
  return raw ? normalizeLocation(raw) : null;
}

/** Aracın günlük özeti. Backend özet bulamazsa { message } döndürür; o durumda null döneriz. */
export async function getVehicleSummary(
  id: number,
  date?: string,
): Promise<DailySummary | null> {
  const qs = date ? `?date=${date}` : '';
  const data = await apiFetch<DailySummary | { message: string }>(
    `/vehicles/${id}/summary${qs}`,
  );
  // Özet yoksa backend { message: '...' } döndürür (summary_date alanı olmaz).
  if (!data || !('summary_date' in data)) {
    return null;
  }
  return data;
}

/** Aracın durakları (waypoints). — Aşama 3'te sayfaya bağlanacak. */
export async function getVehicleWaypoints(id: number): Promise<Waypoint[]> {
  return (await apiFetch<Waypoint[]>(`/vehicles/${id}/waypoints`)) ?? [];
}

/**
 * Aracın ham telemetri geçmişi (GET /vehicles/:id/telemetry).
 * Opsiyonel filtreler: from/to (ISO tarih), limit (1-1000), fixValid.
 * NUMERIC alanlar number'a çevrilerek döner.
 */
export async function getVehicleTelemetry(
  id: number,
  params: { from?: string; to?: string; limit?: number; fixValid?: boolean } = {},
): Promise<TelemetryRecord[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.fixValid != null) qs.set('fix_valid', String(params.fixValid));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const rows = (await apiFetch<Record<string, unknown>[]>(`/vehicles/${id}/telemetry${suffix}`)) ?? [];
  return rows.map(normalizeTelemetry);
}

/** Araca takılı sensörler (GET /vehicles/:id/sensors). Aktif + pasif tümü gelir. */
export async function getVehicleSensors(id: number): Promise<Sensor[]> {
  return (await apiFetch<Sensor[]>(`/vehicles/${id}/sensors`)) ?? [];
}

/** Tek bir sensör (GET /sensors/:id). Erişim yoksa backend 403 döner → login'e gider. */
export async function getSensor(id: number): Promise<Sensor | null> {
  return apiFetch<Sensor>(`/sensors/${id}`, { allow404: true });
}

/** Sürücüler (GET /drivers). includeInactive=true ise pasifler de gelir. */
export async function getDrivers(includeInactive = false): Promise<Driver[]> {
  const suffix = includeInactive ? '?include_inactive=true' : '';
  return (await apiFetch<Driver[]>(`/drivers${suffix}`)) ?? [];
}

/** Tek bir sürücü (GET /drivers/:id). */
export async function getDriver(id: number): Promise<Driver | null> {
  return apiFetch<Driver>(`/drivers/${id}`, { allow404: true });
}

/**
 * Sürücü-araç atamaları (GET /assignments).
 * Filtreler: vehicleId, driverId, activeOnly (released_date IS NULL).
 */
export async function getAssignments(
  params: { vehicleId?: number; driverId?: number; activeOnly?: boolean } = {},
): Promise<VehicleAssignment[]> {
  const qs = new URLSearchParams();
  if (params.vehicleId != null) qs.set('vehicle_id', String(params.vehicleId));
  if (params.driverId != null) qs.set('driver_id', String(params.driverId));
  if (params.activeOnly) qs.set('active_only', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return (await apiFetch<VehicleAssignment[]>(`/assignments${suffix}`)) ?? [];
}

/** Araca tanımlı durak lokasyonları (GET /vehicles/:id/stop-locations). */
export async function getVehicleStopLocations(id: number): Promise<StopLocation[]> {
  return (await apiFetch<StopLocation[]>(`/vehicles/${id}/stop-locations`)) ?? [];
}

/** Oturum sahibinin profili (GET /users/me). */
export async function getCurrentUser(): Promise<UserProfile | null> {
  return apiFetch<UserProfile>('/users/me');
}

/** Tüm kullanıcılar (GET /users). Admin-only. Opsiyonel search ile username/full_name filtrelenir. */
export async function getUsers(search?: string): Promise<UserProfile[]> {
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return (await apiFetch<UserProfile[]>(`/users${qs}`)) ?? [];
}

/** Belirli bir kullanıcının araçları (GET /vehicles?user_id=). Admin-only. */
export async function getVehiclesForUser(userId: number): Promise<Vehicle[]> {
  return (await apiFetch<Vehicle[]>(`/vehicles?user_id=${userId}`)) ?? [];
}
