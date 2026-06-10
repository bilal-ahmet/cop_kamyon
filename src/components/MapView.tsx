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

export default function MapView({
  lat,
  lon,
  label,
  stopLocations,
  focusPoint,
  vehicleId,
  trailPositions,
}: {
  lat: number;
  lon: number;
  label?: string;
  stopLocations?: StopLocation[];
  focusPoint?: [number, number] | null;
  vehicleId?: number;
  trailPositions?: [number, number][];
}) {
  const [pois, setPois] = useState<PoiItem[]>([]);

  useEffect(() => {
    if (vehicleId == null) return;
    let cancelled = false;
    fetch(`/api/vehicles/${vehicleId}/nearby?lat=${lat}&lon=${lon}&radius=1000`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: PoiItem[]) => { if (!cancelled) setPois(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [vehicleId, lat, lon]);

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
      {trailPositions && trailPositions.length > 1 && (
        <Polyline
          positions={trailPositions}
          pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.7 }}
        />
      )}

      {/* Araç markeri */}
      <Marker position={[lat, lon]} icon={vehicleIcon}>
        {label && <Popup>{label}</Popup>}
      </Marker>

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

<Recenter lat={lat} lon={lon} paused={focusPoint != null} />
      <FlyToPoint point={focusPoint} />
    </MapContainer>
  );
}
