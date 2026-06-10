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
    | 'restaurant'
    | 'cafe'
    | 'fast_food'
    | 'atm'
    | 'hotel'
    | 'bakery'
    | 'post_office'
    | 'bus_stop'
    | 'other';
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export const CATEGORY_LABEL: Record<PoiItem['category'], string> = {
  school: 'Okul',
  hospital: 'Hastane',
  police: 'Polis',
  fuel: 'Akaryakıt',
  industrial: 'Sanayi',
  mosque: 'Cami',
  park: 'Park',
  pharmacy: 'Eczane',
  supermarket: 'Market',
  bank: 'Banka',
  university: 'Üniversite',
  fire_station: 'İtfaiye',
  restaurant: 'Restoran',
  cafe: 'Kafe',
  fast_food: 'Fast Food',
  atm: 'ATM',
  hotel: 'Otel',
  bakery: 'Fırın',
  post_office: 'PTT',
  bus_stop: 'Durak',
  other: 'Yer',
};

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
  restaurant: 'restaurant',
  cafe: 'cafe',
  fast_food: 'fast_food',
  atm: 'atm',
  post_office: 'post_office',
};

function detectCategory(tags: Record<string, string>): PoiItem['category'] {
  const amenity = tags['amenity'];
  const landuse = tags['landuse'];
  const manMade = tags['man_made'];
  const leisure = tags['leisure'];
  const shop = tags['shop'];
  const tourism = tags['tourism'];
  const highway = tags['highway'];
  const religion = tags['religion'];

  if (amenity === 'place_of_worship' && religion === 'muslim') return 'mosque';
  if (leisure === 'park') return 'park';
  if (shop === 'supermarket') return 'supermarket';
  if (shop === 'bakery') return 'bakery';
  if (tourism === 'hotel' || tourism === 'motel') return 'hotel';
  if (highway === 'bus_stop') return 'bus_stop';
  if (amenity && AMENITY_MAP[amenity]) return AMENITY_MAP[amenity];
  if (landuse === 'industrial' || manMade === 'works') return 'industrial';
  return 'other';
}

export async function fetchNearbyPois(
  lat: number,
  lon: number,
  radiusM = 1000,
): Promise<PoiItem[]> {
  const query = `
[out:json][timeout:20];
(
  node["amenity"~"school|hospital|clinic|police|fuel|pharmacy|bank|university|college|fire_station|place_of_worship|restaurant|cafe|fast_food|atm|post_office"](around:${radiusM},${lat},${lon});
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon});
  node["leisure"="park"](around:${radiusM},${lat},${lon});
  node["shop"~"supermarket|bakery"](around:${radiusM},${lat},${lon});
  node["tourism"~"hotel|motel"](around:${radiusM},${lat},${lon});
  node["highway"="bus_stop"](around:${radiusM},${lat},${lon});
  node["landuse"="industrial"](around:${radiusM},${lat},${lon});
  node["man_made"="works"](around:${radiusM},${lat},${lon});
  way["amenity"~"school|hospital|university|college|fire_station|place_of_worship|restaurant"](around:${radiusM},${lat},${lon});
  way["leisure"="park"](around:${radiusM},${lat},${lon});
  way["landuse"="industrial"](around:${radiusM},${lat},${lon});
  way["tourism"~"hotel|motel"](around:${radiusM},${lat},${lon});
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
      const category = detectCategory(tags);
      const name = tags['name'] ?? tags['operator'] ?? tags['brand'] ?? CATEGORY_LABEL[category];

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;

      if (seen.has(el.id)) return null;
      seen.add(el.id);

      return { id: el.id, lat, lon, name, category } satisfies PoiItem;
    })
    .filter((x): x is PoiItem => x !== null);
}
