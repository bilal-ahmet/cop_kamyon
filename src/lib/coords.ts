// Koordinat girişi ayrıştırma — ondalık derece VE derece/dakika/saniye (DMS).
//
// Desteklenen biçimler (hepsi aynı noktayı verir):
//   40.788278            → ondalık
//   40,788278            → ondalık (Türkçe virgül)
//   40°47'17.8"N         → DMS + yarıküre
//   40° 47' 17,8" K      → DMS, Türkçe yarıküre (K/G/D/B)
//   40 47 17.8           → boşluklu DMS
//   40°47.297'           → derece + ondalık dakika
//   -40°47'17.8"         → negatif derece

/** Yarıküre harfleri: negatif yöne bakanlar (Güney / Batı). */
const NEGATIVE_HEMI = new Set(['S', 'W', 'G', 'B']);
/** Tüm geçerli yarıküre harfleri (İngilizce N/S/E/W + Türkçe K/G/D/B). */
const HEMI = /[NSEWKGDB]/i;

/**
 * Serbest biçimli koordinat metnini ondalık dereceye çevirir.
 * Ayrıştırılamazsa `null` döner (çağıran hata mesajı gösterir).
 */
export function parseCoordinate(input: string | null | undefined): number | null {
  if (input == null) return null;

  // Ondalık ayıracı olarak virgülü noktaya çevir, baş/son boşlukları at.
  const raw = String(input).trim().replace(/,/g, '.');
  if (raw === '') return null;

  // Yarıküre harfi (başta veya sonda olabilir)
  const hemiMatch = raw.match(HEMI);
  const hemi = hemiMatch ? hemiMatch[0].toUpperCase() : null;

  // Harfleri ve işareti ayıkladıktan sonra kalan sayısal parçalar
  const negativeSign = /^\s*-/.test(raw);
  const parts = raw
    .replace(HEMI, ' ')
    .replace(/[°'"´’″:]/g, ' ')
    .replace(/-/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '')
    .map(Number);

  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length > 3) return null;

  const [deg, min = 0, sec = 0] = parts;
  // Dakika/saniye 60'ı aşamaz; aşıyorsa kullanıcı yanlış biçim girmiştir.
  if (min < 0 || min >= 60 || sec < 0 || sec >= 60) return null;

  let value = Math.abs(deg) + min / 60 + sec / 3600;
  if (negativeSign || (hemi && NEGATIVE_HEMI.has(hemi))) value = -value;

  return value;
}

/** Enlem geçerli mi (-90..90)? */
export function isValidLat(v: number | null): v is number {
  return v != null && Number.isFinite(v) && v >= -90 && v <= 90;
}

/** Boylam geçerli mi (-180..180)? */
export function isValidLon(v: number | null): v is number {
  return v != null && Number.isFinite(v) && v >= -180 && v <= 180;
}

/** Ondalık dereceyi okunur DMS metnine çevirir: 40.788278 → 40°47'17.8"K */
export function toDms(value: number, axis: 'lat' | 'lon'): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  const hemi = axis === 'lat' ? (neg ? 'G' : 'K') : neg ? 'B' : 'D';
  return `${deg}°${String(min).padStart(2, '0')}'${sec.toFixed(1)}"${hemi}`;
}
