import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession, deleteSession } from './session';
import { normalizeLocation } from './normalize';
import type { Vehicle, VehicleLocation, DailySummary, Waypoint } from './types';

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
  | { ok: true; token: string; user: { id: number; username: string; full_name: string } }
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

  if (res.status === 401 || res.status === 403) {
    // Token süresi dolmuş/geçersiz: oturumu temizle ve giriş ekranına gönder.
    await deleteSession();
    redirect('/login');
  }

  if (res.status === 404 && opts.allow404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Backend hatası (${res.status}) — ${path}`);
  }

  return res.json() as Promise<T>;
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
