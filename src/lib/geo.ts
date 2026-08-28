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

/**
 * Chaikin köşe kesme: kırık çizgiyi köşeleri yuvarlayarak yumuşatır.
 * Her iterasyon segmentleri 1/4–3/4 noktalarıyla böler; uç noktalar korunur.
 * Birimden bağımsızdır — [lng, lat] veya [lat, lon] fark etmez.
 */
export function chaikinSmooth(
  coords: [number, number][],
  iterations = 2,
): [number, number][] {
  let pts = coords;
  for (let iter = 0; iter < iterations; iter++) {
    if (pts.length < 3) return pts;
    const out: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      out.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
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

// ─── Rota oynatma (playback) ────────────────────────────────────────────────
// Geçmiş izi "video" gibi oynatmak için noktaları sanal bir zaman eksenine oturtur.

/** İki nokta arasındaki sanal süre bu değeri aşamaz (saniye). */
const MAX_GAP_S = 30;

/** Zaman eksenine oturtulmuş iz — `playbackFrameAt` ile örneklenir. */
export interface PlaybackTrack {
  points: TrackPoint[];
  /** points[i]'ye kadar biriken sanal süre (saniye); offsets[0] her zaman 0. */
  offsets: number[];
  /** Toplam sanal süre (saniye). */
  total: number;
}

/**
 * Noktaların zaman damgalarından sanal zaman ekseni kurar.
 *
 * Gerçek süreler kullanılır (araç yavaşken animasyon da yavaşlar), ancak uzun
 * duraklamalar `MAX_GAP_S` ile kırpılır; yoksa 40 dakika bekleyen bir kamyon
 * oynatmanın yarısını hareketsiz geçirirdi. Zaman damgaları kullanılamazsa
 * noktalar eşit aralıklı varsayılır.
 */
export function buildPlaybackTrack(points: TrackPoint[]): PlaybackTrack {
  const offsets = new Array<number>(points.length).fill(0);
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (Date.parse(points[i].t) - Date.parse(points[i - 1].t)) / 1000;
    acc += Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_GAP_S) : 1;
    offsets[i] = acc;
  }
  if (acc === 0 && points.length > 1) {
    for (let i = 0; i < points.length; i++) offsets[i] = i;
    acc = points.length - 1;
  }
  return { points, offsets, total: acc };
}

/** Kuzey = 0°, saat yönünde artan gidiş yönü (kısa mesafede düzlem yaklaşımı). */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number | null {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * RAD);
  if (dLat === 0 && dLon === 0) return null; // araç duruyor — çağıran son yönü korur
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

/** Oynatmanın tek bir anı: araç konumu, yönü ve o ana kadar geçilen nokta sayısı. */
export interface PlaybackFrame {
  lat: number;
  lon: number;
  /** Araç duruyorsa null — çağıran önceki yönü korumalı. */
  heading: number | null;
  /** Tamamen geçilmiş son noktanın indeksi (geçilen iz dilimi = slice(0, index + 1)). */
  index: number;
  /** O ana en yakın ham nokta — saat/hız etiketleri için. */
  point: TrackPoint;
}

/** Sanal zaman `vt` (saniye) anındaki araç durumunu ara değerleyerek verir. */
export function playbackFrameAt(track: PlaybackTrack, vt: number): PlaybackFrame | null {
  const { points, offsets, total } = track;
  if (points.length === 0) return null;
  const first = points[0];
  if (points.length === 1) {
    return { lat: first.lat, lon: first.lon, heading: null, index: 0, point: first };
  }

  const clamped = Math.min(Math.max(vt, 0), total);
  // offsets artan sıradadır: offsets[i] <= clamped olan en büyük i.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= clamped) lo = mid;
    else hi = mid - 1;
  }
  const i = Math.min(lo, points.length - 2);
  const a = points[i];
  const b = points[i + 1];
  const span = offsets[i + 1] - offsets[i];
  const f = span > 0 ? (clamped - offsets[i]) / span : 0;

  // Araç duruyorken (a === b) yön hesaplanamaz; imleç kuzeye dönmesin diye
  // geriye doğru ilk anlamlı parçanın yönü kullanılır.
  let heading: number | null = null;
  for (let j = i; j >= 0 && heading === null; j--) {
    const from = points[j];
    const to = points[j + 1];
    heading = bearingDeg(from.lat, from.lon, to.lat, to.lon);
  }

  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lon: a.lon + (b.lon - a.lon) * f,
    heading,
    index: i,
    point: f < 0.5 ? a : b,
  };
}
