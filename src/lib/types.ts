// Backend yanıtlarına birebir uyan TypeScript tipleri.
// Kaynak: cop_kamyonu_backend controller'ları + veritabanı şeması.

/** Sisteme giriş yapan kullanıcı (login yanıtındaki "user" alanı). */
export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
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
  owner_username?: string;
  owner_full_name?: string | null;
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
  stop_location_id: number | null;
  location_name: string | null;
  lat: number;
  lon: number;
  load_received_kg: number | null;
  load_delivered_kg: number | null;
  arrived_at: string;
  departed_at: string | null;
  notes: string | null;
}

/** IoT/GPS sensör cihazı (GET /sensors/:id, GET /vehicles/:id/sensors). */
export interface Sensor {
  id: number;
  vehicle_id: number;
  serial_number: string;
  firmware_version: string | null;
  is_active: boolean;
  installed_at: string;
  notes: string | null;
}

/** Sürücü (GET /drivers). */
export interface Driver {
  id: number;
  full_name: string;
  license_no: string | null;
  phone: string | null;
  birth_date: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Sürücü-araç ataması (GET /assignments).
 * Liste/detay sorgularında backend JOIN ile driver_name ve vehicle_plate de döndürür.
 */
export interface VehicleAssignment {
  id: number;
  vehicle_id: number;
  driver_id: number;
  assigned_date: string;
  released_date: string | null;
  notes: string | null;
  created_at: string;
  driver_name?: string;
  vehicle_plate?: string;
}

/** Ham telemetri kaydı (GET /vehicles/:id/telemetry). NUMERIC alanlar normalize edilir. */
export interface TelemetryRecord {
  id: number;
  sensor_id: number;
  vehicle_id: number;
  lat: number;
  lon: number;
  cog_deg: number | null;
  fix_valid: boolean;
  speed_kmh: number | null;
  speed_knots: number | null;
  load_kg: number | null;
  recorded_at: string;
  received_at: string;
}

/** Araç için önceden tanımlı çöp toplama noktası (geofencing referansı). */
export interface StopLocation {
  id: number;
  vehicle_id: number;
  name: string;
  lat: number;
  lon: number;
  radius_m: number;
  is_active: boolean;
  created_at: string;
}

/** Oturum sahibinin tam profili (GET /users/me, GET /users satırı). */
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}
