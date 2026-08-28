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
// Geçmiş izi "video" gibi oynatmak için noktaları **mesafe** eksenine oturtur.

/** Yol ekseni üzerine dizilmiş iz — `playbackFrameAt` ile örneklenir. */
export interface PlaybackTrack {
  /** Chaikin ile yumuşatılmış noktalar — haritada çizilen çizginin ta kendisi. */
  points: TrackPoint[];
  /** points[i]'ye kadar biriken yol (metre); offsets[0] her zaman 0. */
  offsets: number[];
  /** Toplam yol (metre). */
  total: number;
}

/**
 * Chaikin köşe kesmeyi iz noktalarına uygular; her yeni nokta, türediği iki
 * komşudan kendisine daha yakın olanın zaman/hız/bacak bilgisini devralır.
 *
 * `chaikinSmooth` ile aynı geometriyi üretir, farkı meta veriyi korumasıdır —
 * oynatma imleci tam olarak ekranda çizilen çizgi üzerinde ilerleyebilsin diye.
 */
export function chaikinSmoothTrack(points: TrackPoint[], iterations = 2): TrackPoint[] {
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (pts.length < 3) return pts;
    const out: TrackPoint[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      out.push({ ...a, lat: a.lat * 0.75 + b.lat * 0.25, lon: a.lon * 0.75 + b.lon * 0.25 });
      out.push({ ...b, lat: a.lat * 0.25 + b.lat * 0.75, lon: a.lon * 0.25 + b.lon * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/**
 * Oynatma eksenini kat edilen yoldan kurar (zamandan değil).
 *
 * Bilerek sabit hız: araç gerçekte durduğunda animasyon da dursaydı, uzun
 * bekleme ve rölanti kayıtları oynatmayı sürekli takılıyormuş gibi gösterirdi.
 * Mesafe ekseninde ardışık aynı konumlar sıfır uzunlukta kalır, yani duruşlar
 * kendiliğinden atlanır ve imleç baştan sona kesintisiz akar.
 *
 * Noktalar önce yumuşatılır: imleç hem çizilen çizgiyi birebir takip eder hem de
 * köşelerde sıçramadan, kademeli döner.
 */
export function buildPlaybackTrack(points: TrackPoint[]): PlaybackTrack {
  const smooth = chaikinSmoothTrack(points);
  const offsets = new Array<number>(smooth.length).fill(0);
  let acc = 0;
  for (let i = 1; i < smooth.length; i++) {
    const a = smooth[i - 1];
    const b = smooth[i];
    acc += haversineMeters(a.lat, a.lon, b.lat, b.lon);
    offsets[i] = acc;
  }
  // Tüm noktalar aynı yerdeyse (araç hiç kıpırdamamış) mesafe ekseni çöker;
  // oynatma yine de baştan sona ilerlesin diye eşit aralığa düşülür.
  if (acc === 0 && smooth.length > 1) {
    for (let i = 0; i < smooth.length; i++) offsets[i] = i;
    acc = smooth.length - 1;
  }
  return { points: smooth, offsets, total: acc };
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
  /** Yön hiç hesaplanamadıysa null (tüm noktalar üst üste) — imleç düz durur. */
  heading: number | null;
  /**
   * Tamamen geçilmiş son noktanın indeksi — `track.points` dizisine göredir,
   * geçilen iz dilimi `track.points.slice(0, index + 1)` olur.
   */
  index: number;
  /** O ana en yakın nokta — saat/hız etiketleri için. */
  point: TrackPoint;
}

/** `d` metre yol kat edilmişken araç durumunu ara değerleyerek verir. */
export function playbackFrameAt(track: PlaybackTrack, d: number): PlaybackFrame | null {
  const { points, offsets, total } = track;
  if (points.length === 0) return null;
  const first = points[0];
  if (points.length === 1) {
    return { lat: first.lat, lon: first.lon, heading: null, index: 0, point: first };
  }

  const clamped = Math.min(Math.max(d, 0), total);
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
