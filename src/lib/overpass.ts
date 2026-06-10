export interface PoiItem {
  id: number;
  lat: number;
  lon: number;
  name: string;
  category: 'school' | 'hospital' | 'police' | 'fuel' | 'industrial' | 'other';
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const CATEGORY_MAP: Record<string, PoiItem['category']> = {
  school: 'school',
  hospital: 'hospital',
  police: 'police',
  fuel: 'fuel',
  industrial: 'industrial',
  works: 'industrial',
};

function detectCategory(tags: Record<string, string>): PoiItem['category'] {
  const amenity = tags['amenity'];
  const landuse = tags['landuse'];
  const manMade = tags['man_made'];
  return (
    CATEGORY_MAP[amenity] ??
    CATEGORY_MAP[landuse] ??
    CATEGORY_MAP[manMade] ??
    'other'
  );
}

export async function fetchNearbyPois(
  lat: number,
  lon: number,
  radiusM = 500,
): Promise<PoiItem[]> {
  const query = `
[out:json][timeout:10];
(
  node["amenity"~"school|hospital|police|fuel"](around:${radiusM},${lat},${lon});
  node["landuse"="industrial"](around:${radiusM},${lat},${lon});
  node["man_made"="works"](around:${radiusM},${lat},${lon});
  way["amenity"~"school|hospital"](around:${radiusM},${lat},${lon});
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

  return elements
    .map((el) => {
      const tags = el.tags ?? {};
      const name = tags['name'] ?? tags['operator'] ?? null;
      if (!name) return null;

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;

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
