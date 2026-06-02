// Backend yanıtlarına birebir uyan TypeScript tipleri.
// Kaynak: cop_kamyonu_backend controller'ları + veritabanı şeması.

/** Sisteme giriş yapan kullanıcı (login yanıtındaki "user" alanı). */
export interface User {
  id: number;
  username: string;
  full_name: string;
}

/** httpOnly cookie içinde sakladığımız oturum. */
export interface Session {
  token: string;
  user: User;
}

/** Bir araç (GET /vehicles satırı). */
export interface Vehicle {
  id: number;
  user_id: number;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string | null;
  capacity_kg: number | null;
  is_active: boolean;
  created_at: string;
}

/** Aracın son konumu (GET /vehicles/:id/location). — Aşama 2 */
export interface VehicleLocation {
  lat: number;
  lon: number;
  cog_deg: number | null;
  speed_kmh: number | null;
  speed_knots: number | null;
  load_kg: number | null;
  recorded_at: string;
  fix_valid: boolean;
}

/** Günlük özet (GET /vehicles/:id/summary). — Aşama 2 */
export interface DailySummary {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  summary_date: string;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  total_distance_km: number | null;
  waypoint_count: number | null;
  total_load_kg: number | null;
  avg_load_kg: number | null;
  telemetry_count: number | null;
}

/** Durak/waypoint (GET /vehicles/:id/waypoints). — Aşama 2 */
export interface Waypoint {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  location_name: string | null;
  lat: number;
  lon: number;
  load_received_kg: number | null;
  load_delivered_kg: number | null;
  arrived_at: string;
  departed_at: string | null;
}
