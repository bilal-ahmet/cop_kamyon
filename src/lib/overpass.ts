export interface PoiItem {
  id: number;
  lat: number;
  lon: number;
  name: string;
  category:
    | 'school'
    | 'hospital'
    | 'police'
    | 'fuel'
    | 'industrial'
    | 'mosque'
    | 'park'
    | 'pharmacy'
    | 'supermarket'
    | 'bank'
    | 'university'
    | 'fire_station'
    | 'other';
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const AMENITY_MAP: Record<string, PoiItem['category']> = {
  school: 'school',
  hospital: 'hospital',
  clinic: 'hospital',
  police: 'police',
  fuel: 'fuel',
  pharmacy: 'pharmacy',
  bank: 'bank',
  university: 'university',
  college: 'university',
  fire_station: 'fire_station',
};

function detectCategory(tags: Record<string, string>): PoiItem['category'] {
  const amenity = tags['amenity'];
  const landuse = tags['landuse'];
  const manMade = tags['man_made'];
  const leisure = tags['leisure'];
  const shop = tags['shop'];
  const religion = tags['religion'];

  if (amenity === 'place_of_worship' && religion === 'muslim') return 'mosque';
  if (leisure === 'park') return 'park';
  if (shop === 'supermarket') return 'supermarket';
  if (amenity && AMENITY_MAP[amenity]) return AMENITY_MAP[amenity];
  if (landuse === 'industrial' || manMade === 'works') return 'industrial';
  return 'other';
}

export async function fetchNearbyPois(
  lat: number,
  lon: number,
  radiusM = 500,
): Promise<PoiItem[]> {
  const query = `
[out:json][timeout:15];
(
  node["amenity"~"school|hospital|clinic|police|fuel|pharmacy|bank|university|college|fire_station|place_of_worship"](around:${radiusM},${lat},${lon});
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon});
  node["leisure"="park"](around:${radiusM},${lat},${lon});
  node["shop"="supermarket"](around:${radiusM},${lat},${lon});
  node["landuse"="industrial"](around:${radiusM},${lat},${lon});
  node["man_made"="works"](around:${radiusM},${lat},${lon});
  way["amenity"~"school|hospital|university|college|fire_station|place_of_worship"](around:${radiusM},${lat},${lon});
  way["leisure"="park"](around:${radiusM},${lat},${lon});
  way["landuse"="industrial"](around:${radiusM},${lat},${lon});
);
out center;
`.trim();

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Overpass API hatası: ${res.status}`);

  const json = await res.json();
  const elements: Array<{
    id: number;
    type: string;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }> = json.elements ?? [];

  const seen = new Set<number>();
  return elements
    .map((el) => {
      const tags = el.tags ?? {};
      const name = tags['name'] ?? tags['operator'] ?? null;
      if (!name) return null;

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;

      if (seen.has(el.id)) return null;
      seen.add(el.id);

      return {
        id: el.id,
        lat,
        lon,
        name,
        category: detectCategory(tags),
      } satisfies PoiItem;
    })
    .filter((x): x is PoiItem => x !== null);
}
