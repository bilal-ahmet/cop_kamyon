import type { VehicleLocation } from './types';

/**
 * PostgreSQL NUMERIC sütunları pg tarafından STRING olarak döner.
 * Bu yardımcılar, gelen ham değerleri güvenle sayıya çevirir.
 */
export function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Backend'den gelen ham konum nesnesini sayısal alanları number'a çevirerek normalize eder. */
export function normalizeLocation(raw: Record<string, unknown>): VehicleLocation {
  return {
    lat: toNum(raw.lat) ?? 0,
    lon: toNum(raw.lon) ?? 0,
    cog_deg: toNum(raw.cog_deg),
    speed_kmh: toNum(raw.speed_kmh),
    speed_knots: toNum(raw.speed_knots),
    load_kg: toNum(raw.load_kg),
    recorded_at: String(raw.recorded_at),
    fix_valid: Boolean(raw.fix_valid),
  };
}
