// Coğrafi hesaplar — mesafe, güzergah uzunluğu ve gidiş/dönüş ayrımı.
// Formül backend'deki telemetryController.haversineMeters ile birebir aynıdır.

import type { StopLocation, TrackPoint, RouteLeg } from './types';

const EARTH_R = 6_371_000; // metre
const RAD = Math.PI / 180;

/** İki GPS noktası arasındaki mesafe (metre). */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ardışık noktaların toplam uzunluğu (km). */
export function pathLengthKm(points: TrackPoint[]): number {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    meters += haversineMeters(a.lat, a.lon, b.lat, b.lon);
  }
  return meters / 1000;
}

/**
 * Gidiş/dönüş mesafelerini tek geçişte hesaplar (km).
 *
 * Her parça (segment) bittiği noktanın bacağına yazılır; böylece bacak geçişindeki
 * parça da bir yere sayılır ve `out + return === total` eşitliği bozulmaz.
 */
export function legLengthsKm(points: TrackPoint[]): {
  out: number;
  return: number;
  total: number;
} {
  let out = 0;
  let ret = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const m = haversineMeters(a.lat, a.lon, b.lat, b.lon);
    if (b.leg === 'return') ret += m;
    else out += m;
  }
  return { out: out / 1000, return: ret / 1000, total: (out + ret) / 1000 };
}

/** Bir lokasyon listesinden ilk aktif `kind` kaydını döndürür. */
export function findStopByKind(
  stopLocations: StopLocation[] | undefined,
  kind: StopLocation['kind'],
): StopLocation | null {
  return stopLocations?.find((sl) => sl.is_active && sl.kind === kind) ?? null;
}

/**
 * Her noktaya gidiş/dönüş etiketi atar.
 *
 * Kural: araç bitiş lokasyonunun yarıçapına girip **son kez** oradan ayrıldıktan
 * sonraki tüm noktalar dönüş rotasıdır. Bitiş lokasyonu tanımlı değilse ya da
 * araç oraya hiç uğramadıysa tüm iz gidiş sayılır.
 */
export function splitLegs(
  points: TrackPoint[],
  endLoc: StopLocation | null,
): TrackPoint[] {
  if (points.length === 0) return [];
  if (!endLoc) return points.map((p) => ({ ...p, leg: 'out' as RouteLeg }));

  const endLat = Number(endLoc.lat);
  const endLon = Number(endLoc.lon);
  const radius = Number(endLoc.radius_m) || 5;

  let lastInside = -1;
  for (let i = 0; i < points.length; i++) {
    if (haversineMeters(points[i].lat, points[i].lon, endLat, endLon) <= radius) {
      lastInside = i;
    }
  }

  if (lastInside === -1) return points.map((p) => ({ ...p, leg: 'out' as RouteLeg }));

  return points.map((p, i) => ({
    ...p,
    leg: (i < lastInside ? 'out' : 'return') as RouteLeg,
  }));
}

/** İz üzerinde verilen koordinata en yakın noktayı bulur (hover ipucu için). */
export function nearestPoint(
  points: TrackPoint[],
  lat: number,
  lon: number,
): TrackPoint | null {
  let best: TrackPoint | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    // Karekök almadan düzlem yaklaşımı: sadece sıralama için kullanılıyor.
    const dLat = p.lat - lat;
    const dLon = (p.lon - lon) * Math.cos(lat * RAD);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}
