'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Next/Turbopack statik görsel import'u ortama göre string URL ya da { src } nesnesi
// döndürebilir. URL çözülemezse (undefined) CDN'e düşeriz; böylece ikon her durumda gelir.
const CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
const assetUrl = (m: unknown, fallbackFile: string): string => {
  const u = typeof m === 'string' ? m : (m as { src?: string } | null)?.src;
  return u || CDN + fallbackFile;
};

// Varsayılan Leaflet marker ikonu bundler altında kırılır; açık ikon tanımlıyoruz.
const vehicleIcon = L.icon({
  iconRetinaUrl: assetUrl(markerIcon2x, 'marker-icon-2x.png'),
  iconUrl: assetUrl(markerIcon, 'marker-icon.png'),
  shadowUrl: assetUrl(markerShadow, 'marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Konum değiştikçe (polling) haritayı yeni noktaya kaydırır. */
function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon]);
  }, [lat, lon, map]);
  return null;
}

export default function MapView({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label?: string;
}) {
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
      <Marker position={[lat, lon]} icon={vehicleIcon}>
        {label && <Popup>{label}</Popup>}
      </Marker>
      <Recenter lat={lat} lon={lon} />
    </MapContainer>
  );
}
