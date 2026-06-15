'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { StopLocation } from '@/lib/types';
import type { PoiItem } from '@/lib/overpass';

const CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
const assetUrl = (m: unknown, fallbackFile: string): string => {
  const u = typeof m === 'string' ? m : (m as { src?: string } | null)?.src;
  return u || CDN + fallbackFile;
};

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

function makePoiMarkerIcon(category: PoiItem['category'], name: string) {
  const emoji = POI_EMOJI[category];
  const label = name.length > 16 ? name.slice(0, 15) + '…' : name;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">${emoji}</div>
      <div style="background:white;color:#1f2937;font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.3);white-space:nowrap">${label}</div>
    </div>`,
    className: '',
    iconSize: [80, 38],
    iconAnchor: [40, 19],
    popupAnchor: [0, -20],
  });
}

// Araç için mavi ikon (Leaflet varsayılanı)
const vehicleIcon = L.icon({
  iconRetinaUrl: assetUrl(markerIcon2x, 'marker-icon-2x.png'),
  iconUrl: assetUrl(markerIcon, 'marker-icon.png'),
  shadowUrl: assetUrl(markerShadow, 'marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Durak noktası için turuncu yuvarlak ikon
const stopIcon = L.divIcon({
  html: '<div style="background:#f97316;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

// Geçmiş rota için başlangıç (yeşil) / bitiş (kırmızı) ikonları
const makeEndpointIcon = (color: string) =>
  L.divIcon({
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
const startIcon = makeEndpointIcon('#16a34a');
const endIcon = makeEndpointIcon('#dc2626');

/** Araç polling'inde haritayı yeni konuma kaydırır. Durak odaklanıldığında duraklar. */
function Recenter({ lat, lon, paused }: { lat: number; lon: number; paused: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!paused) map.setView([lat, lon]);
  }, [lat, lon, paused, map]);
  return null;
}

/** Durak seçilince harita o noktaya uçar. */
function FlyToPoint({ point }: { point: [number, number] | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo(point, 17);
  }, [point, map]);
  return null;
}

/** Geçmiş rota gösterilince haritayı tüm rotayı kapsayacak şekilde ayarlar. */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 16);
    } else {
      map.fitBounds(positions, { padding: [40, 40] });
    }
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
  const isHistory = mode === 'history';

  useEffect(() => {
    // POI'ler yalnızca canlı modda — geçmiş rotada haritayı kalabalıklaştırmasın.
    if (isHistory || vehicleId == null) return;
    let cancelled = false;
    fetch(`/api/vehicles/${vehicleId}/nearby?lat=${lat}&lon=${lon}&radius=1000`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: PoiItem[]) => { if (!cancelled) setPois(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [vehicleId, lat, lon, isHistory]);

  // Geçmiş modda rota kronolojik sırada gelir: ilk nokta başlangıç, son nokta bitiş.
  const route = trailPositions ?? [];
  const startPt = isHistory && route.length > 0 ? route[0] : null;
  const endPt = isHistory && route.length > 0 ? route[route.length - 1] : null;

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={15}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Araç rota izi */}
      {route.length > 1 && (
        <Polyline
          positions={route}
          pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.7 }}
        />
      )}

      {/* Canlı mod: araç markeri */}
      {!isHistory && (
        <Marker position={[lat, lon]} icon={vehicleIcon}>
          {label && <Popup>{label}</Popup>}
        </Marker>
      )}

      {/* Geçmiş mod: başlangıç ve bitiş işaretçileri */}
      {startPt && (
        <Marker position={startPt} icon={startIcon}>
          <Popup>Başlangıç</Popup>
        </Marker>
      )}
      {endPt && (
        <Marker position={endPt} icon={endIcon}>
          <Popup>Bitiş</Popup>
        </Marker>
      )}

      {/* Durak ikonları ve geofence yarıçap çemberleri */}
      {stopLocations?.filter((sl) => sl.is_active).map((sl) => (
        <span key={sl.id}>
          <Circle
            center={[Number(sl.lat), Number(sl.lon)]}
            radius={sl.radius_m}
            pathOptions={{
              color: '#f97316',
              fillColor: '#f97316',
              fillOpacity: 0.12,
              dashArray: '5 4',
            }}
          />
          <Marker position={[Number(sl.lat), Number(sl.lon)]} icon={stopIcon}>
            <Popup>
              <strong>{sl.name}</strong>
              <br />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Yarıçap: {sl.radius_m} m
              </span>
            </Popup>
          </Marker>
        </span>
      ))}

      {/* Yakın çevre POI marker'ları */}
      {pois.map((poi) => (
        <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={makePoiMarkerIcon(poi.category, poi.name)}>
          <Popup>
            <strong>{poi.name}</strong>
          </Popup>
        </Marker>
      ))}

      {/* Canlı modda araç takibi; geçmiş modda rotaya sığdır */}
      {isHistory ? (
        <FitBounds positions={route} />
      ) : (
        <>
          <Recenter lat={lat} lon={lon} paused={focusPoint != null} />
          <FlyToPoint point={focusPoint} />
        </>
      )}
    </MapContainer>
  );
}
