'use client';

import { useEffect, useState } from 'react';
import Map, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  useMap,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StopLocation } from '@/lib/types';
import type { PoiItem } from '@/lib/overpass';

// Ücretsiz, anahtarsız vektör basemap — sanayi alanları/yer isimleri her zoom'da keskin.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Leaflet [lat, lon] kullanır; MapLibre [lng, lat] bekler. Tek yerden çeviririz.
const toLngLat = (p: [number, number]): [number, number] => [p[1], p[0]];

const POI_EMOJI: Record<PoiItem['category'], string> = {
  school: '🏫',
  hospital: '🏥',
  police: '🚔',
  fuel: '⛽',
  industrial: '🏭',
  mosque: '🕌',
  park: '🌳',
  pharmacy: '💊',
  supermarket: '🛒',
  bank: '🏦',
  university: '🎓',
  fire_station: '🚒',
  restaurant: '🍽️',
  cafe: '☕',
  fast_food: '🍔',
  atm: '💳',
  hotel: '🏨',
  bakery: '🥖',
  post_office: '📮',
  bus_stop: '🚌',
  other: '📍',
};

/** Merkez + metre yarıçaptan yaklaşık daire çokgeni (MapLibre'de metrik daire primitifi yok). */
function metersCircle(
  lat: number,
  lon: number,
  radiusM: number,
  points = 64,
): [number, number][] {
  const coords: [number, number][] = [];
  const latR = (radiusM / 6_378_137) * (180 / Math.PI);
  const lonR = latR / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([lon + lonR * Math.cos(theta), lat + latR * Math.sin(theta)]);
  }
  return coords;
}

type PopupInfo = { lng: number; lat: number; title: string; subtitle?: string };

/** Araç polling'inde haritayı yeni konuma kaydırır. Durak odaklanıldığında duraklar. */
function Recenter({ lat, lon, paused }: { lat: number; lon: number; paused: boolean }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || paused) return;
    map.easeTo({ center: [lon, lat], duration: 800 });
  }, [lat, lon, paused, map]);
  return null;
}

/** Durak seçilince harita o noktaya uçar. */
function FlyToPoint({ point }: { point: [number, number] | null | undefined }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || !point) return;
    map.flyTo({ center: toLngLat(point), zoom: 17 });
  }, [point, map]);
  return null;
}

/** Geçmiş rota gösterilince haritayı tüm rotayı kapsayacak şekilde ayarlar. */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || positions.length === 0) return;
    if (positions.length === 1) {
      map.easeTo({ center: toLngLat(positions[0]), zoom: 16 });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lat, lon] of positions) {
      minLng = Math.min(minLng, lon);
      maxLng = Math.max(maxLng, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 48, duration: 800 },
    );
  }, [positions, map]);
  return null;
}

export default function MapView({
  lat,
  lon,
  label,
  stopLocations,
  focusPoint,
  vehicleId,
  trailPositions,
  mode = 'live',
}: {
  lat: number;
  lon: number;
  label?: string;
  stopLocations?: StopLocation[];
  focusPoint?: [number, number] | null;
  vehicleId?: number;
  trailPositions?: [number, number][];
  mode?: 'live' | 'history';
}) {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const isHistory = mode === 'history';

  useEffect(() => {
    // POI'ler yalnızca canlı modda — geçmiş rotada haritayı kalabalıklaştırmasın.
    if (isHistory || vehicleId == null) return;
    let cancelled = false;
    fetch(`/api/vehicles/${vehicleId}/nearby?lat=${lat}&lon=${lon}&radius=1000`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PoiItem[]) => { if (!cancelled) setPois(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [vehicleId, lat, lon, isHistory]);

  // Geçmiş modda rota kronolojik sırada gelir: ilk nokta başlangıç, son nokta bitiş.
  const route = trailPositions ?? [];
  const startPt = isHistory && route.length > 0 ? route[0] : null;
  const endPt = isHistory && route.length > 0 ? route[route.length - 1] : null;

  const activeStops = stopLocations?.filter((sl) => sl.is_active) ?? [];

  // Rota polyline'ı (GeoJSON LineString, [lng, lat] sırasında)
  const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: route.map(toLngLat) },
  };

  // Tüm aktif durakların geofence çemberleri tek FeatureCollection'da
  const geofenceFC: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: 'FeatureCollection',
    features: activeStops.map((sl) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [metersCircle(Number(sl.lat), Number(sl.lon), sl.radius_m)],
      },
    })),
  };

  return (
    <Map
      initialViewState={{ longitude: lon, latitude: lat, zoom: 15 }}
      mapStyle={MAP_STYLE}
      style={{ width: '100%', height: '100%' }}
      dragRotate={false}
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* Durak geofence yarıçap çemberleri */}
      {activeStops.length > 0 && (
        <Source id="geofences" type="geojson" data={geofenceFC}>
          <Layer
            id="geofence-fill"
            type="fill"
            paint={{ 'fill-color': '#f97316', 'fill-opacity': 0.12 }}
          />
          <Layer
            id="geofence-line"
            type="line"
            paint={{ 'line-color': '#f97316', 'line-width': 1.5, 'line-dasharray': [2, 2] }}
          />
        </Source>
      )}

      {/* Araç rota izi */}
      {route.length > 1 && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#2563eb', 'line-width': 3, 'line-opacity': 0.7 }}
          />
        </Source>
      )}

      {/* Canlı mod: araç markeri */}
      {!isHistory && (
        <Marker
          longitude={lon}
          latitude={lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            if (label) setPopup({ lng: lon, lat, title: label });
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%',
              background: '#2563eb', border: '3px solid white',
              boxShadow: '0 1px 5px rgba(0,0,0,.5)', fontSize: 15, cursor: 'pointer',
            }}
          >
            🚛
          </div>
        </Marker>
      )}

      {/* Geçmiş mod: başlangıç (yeşil) ve bitiş (kırmızı) işaretçileri */}
      {startPt && (
        <Marker
          longitude={startPt[1]}
          latitude={startPt[0]}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopup({ lng: startPt[1], lat: startPt[0], title: 'Başlangıç' });
          }}
        >
          <EndpointDot color="#16a34a" />
        </Marker>
      )}
      {endPt && (
        <Marker
          longitude={endPt[1]}
          latitude={endPt[0]}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopup({ lng: endPt[1], lat: endPt[0], title: 'Bitiş' });
          }}
        >
          <EndpointDot color="#dc2626" />
        </Marker>
      )}

      {/* Durak markerları */}
      {activeStops.map((sl) => {
        const sLat = Number(sl.lat), sLon = Number(sl.lon);
        return (
          <Marker
            key={sl.id}
            longitude={sLon}
            latitude={sLat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopup({ lng: sLon, lat: sLat, title: sl.name, subtitle: `Yarıçap: ${sl.radius_m} m` });
            }}
          >
            <div
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: '#f97316', border: '2px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,.45)', cursor: 'pointer',
              }}
            />
          </Marker>
        );
      })}

      {/* Yakın çevre POI markerları — emoji + isim etiketi (her zoom'da keskin) */}
      {!isHistory && pois.map((poi) => {
        const chip = poi.name.length > 16 ? poi.name.slice(0, 15) + '…' : poi.name;
        return (
          <Marker
            key={poi.id}
            longitude={poi.lon}
            latitude={poi.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopup({ lng: poi.lon, lat: poi.lat, title: poi.name });
            }}
          >
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 16, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}>
                {POI_EMOJI[poi.category]}
              </div>
              <div
                style={{
                  background: 'white', color: '#1f2937', fontSize: 9, fontWeight: 600,
                  padding: '1px 5px', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </div>
            </div>
          </Marker>
        );
      })}

      {/* Ortak popup */}
      {popup && (
        <Popup
          longitude={popup.lng}
          latitude={popup.lat}
          anchor="bottom"
          offset={16}
          onClose={() => setPopup(null)}
          closeButton
          closeOnClick={false}
        >
          <strong>{popup.title}</strong>
          {popup.subtitle && (
            <>
              <br />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{popup.subtitle}</span>
            </>
          )}
        </Popup>
      )}

      {/* Canlı modda araç takibi; geçmiş modda rotaya sığdır */}
      {isHistory ? (
        <FitBounds positions={route} />
      ) : (
        <>
          <Recenter lat={lat} lon={lon} paused={focusPoint != null} />
          <FlyToPoint point={focusPoint} />
        </>
      )}
    </Map>
  );
}

function EndpointDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 16, height: 16, borderRadius: '50%',
        background: color, border: '3px solid white',
        boxShadow: '0 1px 5px rgba(0,0,0,.5)', cursor: 'pointer',
      }}
    />
  );
}
