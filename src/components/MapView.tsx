'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Map, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  useMap,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { StopLocation } from '@/lib/types';
import type { PoiItem } from '@/lib/overpass';

// Basemap seçimi: MapTiler anahtarı varsa Google'a en yakın hazır stil (Streets v2),
// yoksa ücretsiz/anahtarsız OpenFreeMap Bright. Anahtar .env.local'da NEXT_PUBLIC_MAPTILER_KEY.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/bright';
// Uydu görünümü (etiketli hibrit) — yalnızca MapTiler anahtarıyla kullanılabilir.
const HYBRID_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
  : null;

/**
 * Vektör tile'da zaten var olan etiketleri stil seviyesinde açar (Google Maps'e yaklaşma).
 * Harita 'load' olduktan sonra tüm metin (symbol+text-field) katmanları üzerinde çalışır:
 *   1) minzoom düşür  → sokak/POI isimleri daha erken zoom'da görünür (14 → 12 gibi)
 *   2) text-size büyüt + beyaz halo → okunabilirlik ciddi artar
 *   3) text-padding azalt → çakışma eleme gevşer, aynı anda daha çok isim
 *   4) çizgi etiketlerinde symbol-spacing kısalt → sokak isimleri daha sık tekrar eder
 */
function enrichLabels(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    const id = layer.id;
    try {
      if (map.getLayoutProperty(id, 'text-field') == null) continue;

      // 1) Etiketler daha erken görünsün (yalnızca geç açılan katmanlar)
      const mz = layer.minzoom;
      if (typeof mz === 'number' && mz >= 12) {
        map.setLayerZoomRange(id, mz - 2, layer.maxzoom ?? 24);
      }

      // 2) Yazıyı biraz büyüt (sayı ya da zoom-ifadesi olabilir)
      const size = map.getLayoutProperty(id, 'text-size');
      if (typeof size === 'number') {
        map.setLayoutProperty(id, 'text-size', size * 1.12);
      } else if (Array.isArray(size)) {
        map.setLayoutProperty(id, 'text-size', ['*', size, 1.12]);
      }

      // 2b) Okunabilirlik için güçlü beyaz halo
      map.setPaintProperty(id, 'text-halo-color', '#ffffff');
      map.setPaintProperty(id, 'text-halo-width', 1.5);
      map.setPaintProperty(id, 'text-halo-blur', 0.4);

      // 3) Çakışma payını azalt → daha çok etiket sığar
      map.setLayoutProperty(id, 'text-padding', 1);

      // 4) Sokak (çizgi) etiketleri daha sık tekrarlansın
      const placement = map.getLayoutProperty(id, 'symbol-placement');
      if (placement === 'line' || placement === 'line-center') {
        map.setLayoutProperty(id, 'symbol-spacing', 180);
      }
    } catch {
      // tek bir katman hata verirse döngüyü bozma
    }
  }
}

/**
 * Tile şemasında (OpenMapTiles) hazır olup stilin çizmediği katmanları ekler:
 *   - Kapı/bina numaraları (housenumber) — Google'daki gibi zoom 17+'da küçük gri numaralar
 *   - 3D binalar (fill-extrusion + render_height) — 3D düğmesiyle eğim verince yükselir
 * Hem OpenFreeMap hem MapTiler stilinde çalışır; katman zaten varsa dokunmaz.
 */
function addExtraLayers(map: MapLibreMap) {
  const style = map.getStyle();
  const layers = style.layers ?? [];
  // Vektör kaynağın adı stile göre değişir (openmaptiles / maptiler_planet...) — dinamik bul.
  const vectorSource = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];
  if (!vectorSource) return;

  const hasSourceLayer = (sl: string) =>
    layers.some((l) => 'source-layer' in l && l['source-layer'] === sl);
  // Etiketler binaların üstünde kalsın diye ilk sembol katmanının altına ekle.
  const firstSymbolId = layers.find((l) => l.type === 'symbol')?.id;

  try {
    // 3D binalar (stilde fill-extrusion yoksa)
    if (!layers.some((l) => l.type === 'fill-extrusion')) {
      map.addLayer(
        {
          id: 'cop-buildings-3d',
          type: 'fill-extrusion',
          source: vectorSource,
          'source-layer': 'building',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#dcd9d4',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.75,
          },
        },
        firstSymbolId,
      );
    }
  } catch {
    // 3D katmanı eklenemezse harita 2D çalışmaya devam eder
  }

  try {
    // Kapı/bina numaraları (stil housenumber çizmiyorsa)
    if (!hasSourceLayer('housenumber')) {
      map.addLayer({
        id: 'cop-housenumbers',
        type: 'symbol',
        source: vectorSource,
        'source-layer': 'housenumber',
        minzoom: 17,
        layout: {
          'text-field': ['get', 'housenumber'],
          'text-size': 10,
          'text-padding': 2,
        },
        paint: {
          'text-color': '#8a8a8a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
      });
    }
  } catch {
    // veri yoksa katman boş kalır, sorun değil
  }
}

/** MapTiler arazi verisiyle 3B modda araziyi kabartır; anahtar yoksa sessizce atlanır. */
function syncTerrain(map: MapLibreMap, on: boolean) {
  if (!MAPTILER_KEY) return;
  try {
    if (on) {
      if (!map.getSource('cop-terrain')) {
        map.addSource('cop-terrain', {
          type: 'raster-dem',
          url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
        });
      }
      map.setTerrain({ source: 'cop-terrain', exaggeration: 1.2 });
    } else {
      map.setTerrain(null);
    }
  } catch {
    // arazi açılamazsa harita düz çalışmaya devam eder
  }
}

type EnhancedMap = MapLibreMap & { __copEnhancedStyle?: string };

/**
 * Zenginleştirmeleri idempotent uygular. Harita↔Uydu geçişinde setStyle tüm eklenen
 * katmanları/kaynakları sildiği için 'styledata' olayında yeniden çağrılır; aynı stil
 * için ikinci kez çalışmasın diye stil anahtarıyla işaretlenir (text-size ×1.12
 * birikmesin). Terrain durumu her çağrıda mevcut 3B durumuna eşitlenir.
 */
function applyEnhancements(map: MapLibreMap, styleKey: string, is3d: boolean) {
  const m = map as EnhancedMap;
  if (m.__copEnhancedStyle !== styleKey) {
    m.__copEnhancedStyle = styleKey;
    enrichLabels(map);
    addExtraLayers(map);
    syncTerrain(map, is3d);
  }
}

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

/** Harita üstü küçük kare düğme (sağ üstte NavigationControl'ün altına dizilir). */
function MapButton({
  top,
  active,
  title,
  onClick,
  children,
}: {
  top: number;
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        position: 'absolute', top, right: 10, zIndex: 1,
        width: 29, height: 29, borderRadius: 4,
        background: 'white', border: '2px solid rgba(0,0,0,.1)',
        boxShadow: '0 1px 4px rgba(0,0,0,.15)',
        fontSize: 12, fontWeight: 700, color: active ? '#2563eb' : '#374151',
        cursor: 'pointer', lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

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

  const mapRef = useRef<MapRef>(null);
  const [is3d, setIs3d] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const activeStyle = satellite && HYBRID_STYLE ? HYBRID_STYLE : MAP_STYLE;

  function toggle3d() {
    const m = mapRef.current?.getMap() as unknown as MapLibreMap | undefined;
    if (!m) return;
    const next = !is3d;
    setIs3d(next);
    m.easeTo({ pitch: next ? 55 : 0, duration: 600 });
    syncTerrain(m, next);
  }

  // Canlı araç animasyonu: yeni konum gelince marker ışınlanmak yerine yumuşakça
  // kayar; gidiş yönü hesaplanıp ikon o yöne döndürülür.
  const [animPos, setAnimPos] = useState<[number, number]>([lon, lat]); // [lng, lat]
  const [heading, setHeading] = useState<number | null>(null);
  const animFrom = useRef<[number, number]>([lon, lat]);
  const rafId = useRef(0);
  useEffect(() => {
    const [fromLng, fromLat] = animFrom.current;
    const dLng = lon - fromLng;
    const dLat = lat - fromLat;
    if (dLng === 0 && dLat === 0) return;
    // Gidiş yönü (kısa mesafede düzlem yaklaşımı yeterli; 0° = kuzey)
    setHeading((Math.atan2(dLng * Math.cos((lat * Math.PI) / 180), dLat) * 180) / Math.PI);
    // Büyük sıçramada (ilk konum / veri kopması, ~500 m+) animasyonsuz geç
    if (Math.hypot(dLng, dLat) > 0.005) {
      animFrom.current = [lon, lat];
      setAnimPos([lon, lat]);
      return;
    }
    const start = performance.now();
    const DUR = 2200; // POLL_MS'ten biraz kısa: sonraki konum gelmeden tamamlanır
    cancelAnimationFrame(rafId.current);
    const step = (now: number) => {
      const t = Math.min((now - start) / DUR, 1);
      const cur: [number, number] = [fromLng + dLng * t, fromLat + dLat * t];
      animFrom.current = cur;
      setAnimPos(cur);
      if (t < 1) rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId.current);
  }, [lat, lon]);

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
      ref={mapRef}
      initialViewState={{ longitude: lon, latitude: lat, zoom: 15 }}
      mapStyle={activeStyle}
      style={{ width: '100%', height: '100%' }}
      dragRotate={false}
      attributionControl={{ compact: true }}
      onLoad={(e) => applyEnhancements(e.target as unknown as MapLibreMap, activeStyle, is3d)}
      onStyleData={(e) => applyEnhancements(e.target as unknown as MapLibreMap, activeStyle, is3d)}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <MapButton
        top={84}
        active={is3d}
        title={is3d ? '2B görünüme dön' : '3B görünüm (binalar + arazi)'}
        onClick={toggle3d}
      >
        {is3d ? '2B' : '3B'}
      </MapButton>
      {HYBRID_STYLE && (
        <MapButton
          top={121}
          active={satellite}
          title={satellite ? 'Harita görünümüne dön' : 'Uydu görünümü'}
          onClick={() => setSatellite((v) => !v)}
        >
          {satellite ? '🗺️' : '🛰️'}
        </MapButton>
      )}

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

      {/* Canlı mod: araç markeri — konumlar arası yumuşak kayar, yön oku gidiş yönünü gösterir */}
      {!isHistory && (
        <Marker
          longitude={animPos[0]}
          latitude={animPos[1]}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            if (label) setPopup({ lng: animPos[0], lat: animPos[1], title: label });
          }}
        >
          <div
            style={{
              position: 'relative', width: 38, height: 38,
              transform: `rotate(${heading ?? 0}deg)`,
              transition: 'transform .6s ease',
              cursor: 'pointer',
            }}
          >
            {/* Yön oku (ilk konum gelene dek gizli) */}
            {heading != null && (
              <div
                style={{
                  position: 'absolute', top: -6, left: '50%', marginLeft: -7,
                  width: 0, height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderBottom: '10px solid #2563eb',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.3))',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute', inset: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: '#2563eb', border: '3px solid white',
                boxShadow: '0 1px 5px rgba(0,0,0,.5)', fontSize: 15,
              }}
            >
              {/* Kapsayıcı yöne dönerken emoji dik kalsın */}
              <span
                style={{
                  display: 'inline-block',
                  transform: `rotate(${-(heading ?? 0)}deg)`,
                  transition: 'transform .6s ease',
                }}
              >
                🚛
              </span>
            </div>
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
