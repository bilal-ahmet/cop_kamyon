'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { StopLocation, TrackPoint, RouteLeg } from '@/lib/types';
import type { PoiItem } from '@/lib/overpass';
import {
  buildPlaybackTrack,
  chaikinSmooth,
  nearestPoint,
  playbackFrameAt,
} from '@/lib/geo';
import { formatTime } from '@/lib/format';

// Gidiş mavi, dönüş turuncu — LiveVehicleMap'teki lejant ile aynı renkler.
const LEG_COLOR: Record<RouteLeg, string> = { out: '#2563eb', return: '#f59e0b' };
const LEG_LABEL: Record<RouteLeg, string> = { out: 'Gidiş güzergahı', return: 'Dönüş güzergahı' };

// Cihaz ~5 sn'de bir veri gönderir; marker (ve kamera) iki konum arasında bu sürede kayar,
// böylece araç bir sonraki veri gelene kadar durmadan hareket ediyormuş gibi görünür.
const POSITION_ANIM_MS = 5000;

// Geçmiş rota oynatma: 1x hızda tüm güzergah ~30 sn sürer (rota uzunluğundan
// bağımsız, öngörülebilir bir izleme süresi). Geçilen yol mor çizilir; altındaki
// mavi/turuncu ham güzergahtan net ayrışır.
const PLAYBACK_BASE_MS = 30_000;
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;
const PLAYBACK_COLOR = '#7c3aed';

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
            'fill-extrusion-color': '#ddd5c4', // beautifyBasemap bina paletiyle uyumlu
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

/**
 * "Google paleti" dokunuşu: soluk varsayılan renkleri doygunlaştırır, POI ikonlarını
 * çok daha erken zoom'da ve daha büyük gösterir. Katmanlar id/source-layer
 * heuristiğiyle bulunur — hem MapTiler streets-v2 ("Industrial", "Water", "Building"...)
 * hem OpenFreeMap Bright ("landuse-industrial", "water", "building"...) kimlikleriyle eşleşir.
 */
function beautifyBasemap(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    const id = layer.id;
    const lid = id.toLowerCase();
    const sl = 'source-layer' in layer ? (layer['source-layer'] as string) : '';
    try {
      if (layer.type === 'fill') {
        if (sl === 'building') {
          // Binalar belirgin: sıcak gri + koyu kontur
          map.setPaintProperty(id, 'fill-color', '#e3dccd');
          map.setPaintProperty(id, 'fill-outline-color', '#cec4b1');
        } else if (lid.includes('water') && !lid.includes('intermittent')) {
          map.setPaintProperty(id, 'fill-color', '#9bd0f5');
        } else if (lid.includes('wood') || lid.includes('forest')) {
          map.setPaintProperty(id, 'fill-color', '#a3d693');
        } else if (lid.includes('park') || lid.includes('grass') || lid.includes('meadow')) {
          map.setPaintProperty(id, 'fill-color', '#b8e39f');
        } else if (lid.includes('industrial') || lid.includes('railway')) {
          // Sanayi alanları ayrışsın: açık lavanta-gri
          map.setPaintProperty(id, 'fill-color', '#e4e0ee');
        } else if (lid.includes('commercial') || lid.includes('retail')) {
          map.setPaintProperty(id, 'fill-color', '#f6e7d8');
        } else if (lid.includes('residential') || lid.includes('suburb')) {
          map.setPaintProperty(id, 'fill-color', '#efece5');
        } else if (lid.includes('hospital')) {
          map.setPaintProperty(id, 'fill-color', '#f8e0e0');
        } else if (lid.includes('school') || lid.includes('education') || lid.includes('university')) {
          map.setPaintProperty(id, 'fill-color', '#f1ead3');
        } else if (lid.includes('cemetery')) {
          map.setPaintProperty(id, 'fill-color', '#cfe0c8');
        }
      } else if (layer.type === 'symbol' && sl === 'poi') {
        // POI ikonları Google gibi erken (z13+) ve biraz büyük görünsün
        const mz = layer.minzoom;
        if (typeof mz === 'number' && mz > 13) {
          map.setLayerZoomRange(id, 13, layer.maxzoom ?? 24);
        }
        const icon = map.getLayoutProperty(id, 'icon-size');
        if (typeof icon === 'number') {
          map.setLayoutProperty(id, 'icon-size', Math.min(icon * 1.25, 2));
        } else if (icon == null) {
          map.setLayoutProperty(id, 'icon-size', 1.15);
        }
      }
    } catch {
      // tek katman hatası tümünü bozmasın
    }
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
  addRouteArrowImage(map); // setStyle görselleri de sildiği için stil anahtarından bağımsız
  const m = map as EnhancedMap;
  if (m.__copEnhancedStyle !== styleKey) {
    m.__copEnhancedStyle = styleKey;
    enrichLabels(map);
    beautifyBasemap(map);
    addExtraLayers(map);
    syncTerrain(map, is3d);
  }
}

const ROUTE_ARROW = 'cop-route-arrow';

/**
 * İz üzerindeki yön okunu canvas'tan üretip haritaya kaydeder (harici dosya yok).
 *
 * Ok SAĞA bakar: symbol-placement:'line' ikonun +x eksenini çizginin gidiş
 * yönüne hizalar (OSM stillerindeki "oneway" ok sprite'ları gibi). Noktalar
 * kronolojik sırada olduğundan oklar hareket yönünü gösterir.
 */
function addRouteArrowImage(map: MapLibreMap) {
  if (map.hasImage(ROUTE_ARROW)) return;
  const S = 40; // 2x pixelRatio ile 20 CSS px — çizgi üzerinde rahat okunur
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Koyu daire zemin: ok, altındaki mavi/turuncu çizgiden net ayrışsın.
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(23, 37, 84, .92)'; // koyu lacivert
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.stroke();

  // Beyaz ok — sağa bakar (symbol-placement:'line' +x'i gidiş yönüne hizalar).
  const cx = S / 2 + 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 8.5, S / 2); // uç
  ctx.lineTo(cx - 6, S / 2 - 8);
  ctx.lineTo(cx - 2.5, S / 2);
  ctx.lineTo(cx - 6, S / 2 + 8);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const { data, width, height } = ctx.getImageData(0, 0, S, S);
  map.addImage(ROUTE_ARROW, { width, height, data: new Uint8ClampedArray(data) }, { pixelRatio: 2 });
}

// Leaflet [lat, lon] kullanır; MapLibre [lng, lat] bekler. Tek yerden çeviririz.
const toLngLat = (p: TrackPoint): [number, number] => [p.lon, p.lat];

/**
 * Ardışık aynı bacağa ait noktaları tek LineString'de toplar. Bacak değişiminde
 * çizginin kopmaması için sınır noktası her iki parçaya da eklenir.
 */
function legFeatures(points: TrackPoint[]): GeoJSON.Feature<GeoJSON.LineString>[] {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  let current: TrackPoint[] = [];
  let currentLeg: RouteLeg = points[0]?.leg ?? 'out';

  const flush = () => {
    if (current.length > 1) {
      features.push({
        type: 'Feature',
        properties: { leg: currentLeg },
        // Chaikin yumuşatma yalnızca görsel geometriye uygulanır; hover ipucu ve
        // km hesapları ham noktalarla çalışmaya devam eder.
        geometry: { type: 'LineString', coordinates: chaikinSmooth(current.map(toLngLat)) },
      });
    }
  };

  for (const p of points) {
    const leg = p.leg ?? 'out';
    if (leg !== currentLeg && current.length > 0) {
      current.push(p); // sınır noktası: iki parça birleşik görünsün
      flush();
      current = [p];
      currentLeg = leg;
    } else {
      current.push(p);
    }
  }
  flush();
  return features;
}

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
    // Marker'la aynı sürede kayar; kamera araçtan önde gitmez.
    map.easeTo({ center: [lon, lat], duration: POSITION_ANIM_MS });
  }, [lat, lon, paused, map]);
  return null;
}

/** Durak seçilince harita o noktaya uçar. */
function FlyToPoint({ point }: { point: [number, number] | null | undefined }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || !point) return;
    map.flyTo({ center: [point[1], point[0]], zoom: 17 });
  }, [point, map]);
  return null;
}

/** Geçmiş rota gösterilince haritayı tüm rotayı kapsayacak şekilde ayarlar. */
function FitBounds({ positions }: { positions: TrackPoint[] }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || positions.length === 0) return;
    if (positions.length === 1) {
      map.easeTo({ center: toLngLat(positions[0]), zoom: 16 });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const { lat, lon } of positions) {
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
  trackPoints,
  routeAnchors,
  mode = 'live',
}: {
  lat: number;
  lon: number;
  label?: string;
  stopLocations?: StopLocation[];
  focusPoint?: [number, number] | null;
  vehicleId?: number;
  /** Çizilecek iz — kronolojik sırada, her nokta zaman damgası ve bacak bilgisi taşır. */
  trackPoints?: TrackPoint[];
  /** Geçmiş modda da gösterilen başlangıç/bitiş lokasyonları. */
  routeAnchors?: StopLocation[];
  mode?: 'live' | 'history';
}) {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  // İz üzerinde fare ile gezinirken gösterilen saat ipucu (tıklama popup'ından ayrı).
  const [hover, setHover] = useState<PopupInfo | null>(null);
  const isHistory = mode === 'history';

  const mapRef = useRef<MapRef>(null);
  const [is3d, setIs3d] = useState(false);
  // Rota oynatma başladığında ham güzergah geri plana çekilir (aşağıdaki paint).
  const [playbackOn, setPlaybackOn] = useState(false);
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
    cancelAnimationFrame(rafId.current);
    const step = (now: number) => {
      const t = Math.min((now - start) / POSITION_ANIM_MS, 1);
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
  const route = trackPoints ?? [];
  const startPt = isHistory && route.length > 0 ? route[0] : null;
  const endPt = isHistory && route.length > 0 ? route[route.length - 1] : null;

  const activeStops = stopLocations?.filter((sl) => sl.is_active) ?? [];
  const anchors = routeAnchors ?? [];

  // Rota: her bacak (gidiş/dönüş) ayrı LineString — renk `leg` özelliğinden gelir.
  const routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: legFeatures(route),
  };

  // Geofence çemberleri: aktif duraklar + (geçmiş modda) başlangıç/bitiş lokasyonları
  const circleStops = [...activeStops, ...anchors];
  const geofenceFC: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: 'FeatureCollection',
    features: circleStops.map((sl) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [metersCircle(Number(sl.lat), Number(sl.lon), sl.radius_m)],
      },
    })),
  };

  // İz üzerinde gezinme: en yakın noktanın saatini/hızını ipucu olarak göster.
  function handleTrackHover(e: MapLayerMouseEvent) {
    // interactiveLayerIds sayesinde e.features yalnızca iz üzerindeyken dolu gelir.
    if (!e.features?.length) {
      if (hover) setHover(null);
      return;
    }
    const p = nearestPoint(route, e.lngLat.lat, e.lngLat.lng);
    if (!p) return;
    // Aynı noktadaysak state'i tazeleme — her fare hareketinde render olmasın.
    if (hover && hover.lng === p.lon && hover.lat === p.lat) return;
    const parts = [LEG_LABEL[p.leg ?? 'out']];
    if (p.speed != null) parts.push(`${Math.round(Number(p.speed))} km/s`);
    setHover({ lng: p.lon, lat: p.lat, title: formatTime(p.t), subtitle: parts.join(' · ') });
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: lon, latitude: lat, zoom: 15 }}
      mapStyle={activeStyle}
      style={{ width: '100%', height: '100%' }}
      dragRotate={false}
      attributionControl={{ compact: true }}
      interactiveLayerIds={route.length > 1 ? ['route-hit'] : undefined}
      cursor={hover ? 'pointer' : undefined}
      onLoad={(e) => applyEnhancements(e.target as unknown as MapLibreMap, activeStyle, is3d)}
      onStyleData={(e) => applyEnhancements(e.target as unknown as MapLibreMap, activeStyle, is3d)}
      onMouseMove={handleTrackHover}
      onMouseOut={() => setHover(null)}
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

      {/* Araç rota izi — gidiş mavi, dönüş turuncu; üzerinde gidiş yönü okları */}
      {route.length > 1 && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['match', ['get', 'leg'], 'return', LEG_COLOR.return, LEG_COLOR.out],
              'line-width': 4,
              // Oynatma sırasında mor "geçilen yol" izi öne çıksın.
              'line-opacity': playbackOn ? 0.28 : 0.75,
            }}
          />
          {/* Yön okları: symbol-placement 'line' ikonu çizginin gidiş yönüne döndürür.
              Noktalar kronolojik sırada olduğu için oklar hareket yönünü gösterir. */}
          <Layer
            id="route-arrows"
            type="symbol"
            layout={{
              'symbol-placement': 'line',
              // Zoom arttıkça oklar sıklaşır; uzaklaşınca haritayı boğmaz.
              'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 10, 110, 15, 80, 18, 55],
              'icon-image': ROUTE_ARROW,
              'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 15, 0.95, 18, 1.15],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-padding': 0,
            }}
            paint={{ 'icon-opacity': playbackOn ? 0.35 : 1 }}
          />
          {/* Görünmez geniş vuruş katmanı — ize fareyle isabet etmeyi kolaylaştırır */}
          <Layer
            id="route-hit"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#000000', 'line-width': 18, 'line-opacity': 0 }}
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
          <TruckIcon heading={heading} />
        </Marker>
      )}

      {/* Geçmiş mod: izin ilk (yeşil) ve son (kırmızı) noktası */}
      {startPt && (
        <Marker
          longitude={startPt.lon}
          latitude={startPt.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopup({
              lng: startPt.lon,
              lat: startPt.lat,
              title: 'İz başlangıcı',
              subtitle: formatTime(startPt.t),
            });
          }}
        >
          <EndpointDot color="#16a34a" />
        </Marker>
      )}
      {endPt && (
        <Marker
          longitude={endPt.lon}
          latitude={endPt.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopup({
              lng: endPt.lon,
              lat: endPt.lat,
              title: 'İz bitişi',
              subtitle: formatTime(endPt.t),
            });
          }}
        >
          <EndpointDot color="#dc2626" />
        </Marker>
      )}

      {/* Tanımlı başlangıç/bitiş lokasyonları — geçmiş modda da görünür */}
      {anchors.map((sl) => {
        const sLat = Number(sl.lat), sLon = Number(sl.lon);
        const isStart = sl.kind === 'start';
        return (
          <Marker
            key={`anchor-${sl.id}`}
            longitude={sLon}
            latitude={sLat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopup({
                lng: sLon,
                lat: sLat,
                title: sl.name,
                subtitle: `${isStart ? 'Başlangıç konumu' : 'Bitiş konumu'} · ${sl.radius_m} m`,
              });
            }}
          >
            <div style={{ position: 'relative', width: 22, height: 22, cursor: 'pointer' }}>
              {/* Başlangıç/bitiş noktaları haritada nabız gibi atarak dikkat çeker */}
              <span
                className="cop-pulse-ring"
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: isStart ? '#059669' : '#dc2626', pointerEvents: 'none',
                }}
              />
              <span
                style={{
                  position: 'absolute', inset: 0, boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', fontSize: 11,
                  background: isStart ? '#059669' : '#dc2626',
                  border: '3px solid white', color: 'white', fontWeight: 700,
                  boxShadow: '0 1px 5px rgba(0,0,0,.5)',
                }}
              >
                {isStart ? 'B' : 'V'}
              </span>
            </div>
          </Marker>
        );
      })}

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

      {/* İz üzerinde gezinme ipucu — saat bilgisi (kapatma düğmesi yok, fare ile takip eder) */}
      {hover && (
        <Popup
          longitude={hover.lng}
          latitude={hover.lat}
          anchor="bottom"
          offset={12}
          closeButton={false}
          closeOnClick={false}
          onClose={() => setHover(null)}
        >
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{hover.title}</strong>
          {hover.subtitle && (
            <>
              <br />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{hover.subtitle}</span>
            </>
          )}
        </Popup>
      )}

      {/* Geçmiş modda güzergah oynatıcı (kamyon animasyonu + kumanda çubuğu).
          key: yeni bir gün/filtre yüklendiğinde oynatma baştan başlasın. */}
      {isHistory && route.length > 1 && (
        <RoutePlayback
          key={`${route.length}-${route[0].t}-${route[route.length - 1].t}`}
          points={route}
          onActiveChange={setPlaybackOn}
        />
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

/**
 * Nabız atan nokta imleci — geçmiş modda güzergahın başlangıç/bitiş uçlarını
 * belirginleştirir. Halka animasyonu globals.css'teki `cop-pulse` ile çalışır
 * ("hareketi azalt" tercihi açıksa kendiliğinden kapanır).
 */
function EndpointDot({ color, pulse = true }: { color: string; pulse?: boolean }) {
  return (
    <div style={{ position: 'relative', width: 16, height: 16, cursor: 'pointer' }}>
      {pulse && (
        <span
          className="cop-pulse-ring"
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: color, pointerEvents: 'none',
          }}
        />
      )}
      <span
        style={{
          position: 'absolute', inset: 0, boxSizing: 'border-box',
          borderRadius: '50%', background: color, border: '3px solid white',
          boxShadow: '0 1px 5px rgba(0,0,0,.5)',
        }}
      />
    </div>
  );
}

/**
 * Yönüne dönen kamyon imleci — canlı takip ve geçmiş rota oynatmada ortaktır.
 *
 * Oynatmada konum ve yön her karede değiştiği için `smooth` kapatılır; yoksa
 * CSS geçişi imleci kendi hareketinin gerisinde bırakır.
 */
function TruckIcon({
  heading,
  color = '#2563eb',
  smooth = true,
}: {
  heading: number | null;
  color?: string;
  smooth?: boolean;
}) {
  const spin = smooth ? 'transform .6s ease' : 'none';
  return (
    <div
      style={{
        position: 'relative', width: 38, height: 38,
        transform: `rotate(${heading ?? 0}deg)`,
        transition: spin,
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
            borderBottom: `10px solid ${color}`,
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.3))',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute', inset: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
          background: color, border: '3px solid white',
          boxShadow: '0 1px 5px rgba(0,0,0,.5)', fontSize: 15,
        }}
      >
        {/* Kapsayıcı yöne dönerken emoji dik kalsın */}
        <span
          style={{
            display: 'inline-block',
            transform: `rotate(${-(heading ?? 0)}deg)`,
            transition: spin,
          }}
        >
          🚛
        </span>
      </div>
    </div>
  );
}

/** Kumanda çubuğundaki yuvarlak düğme. */
function PlayerButton({
  onClick,
  title,
  active = false,
  disabled = false,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, flexShrink: 0,
        borderRadius: '50%', border: 'none',
        background: active ? '#ede9fe' : 'transparent',
        color: disabled ? '#d4d4d8' : active ? PLAYBACK_COLOR : '#3f3f46',
        fontSize: 12, lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Geçmiş güzergahı "video" gibi oynatır: kamyon imleci rotayı baştan sona kat
 * ederken geçtiği yol mor çizgiyle üzerine boyanır.
 *
 * Kare başına state güncellendiği için bilerek ayrı bir bileşendir — böylece
 * MapView (rota GeoJSON'u, geofence çemberleri, POI markerları) 60 fps yeniden
 * render edilmez.
 */
function RoutePlayback({
  points,
  onActiveChange,
}: {
  points: TrackPoint[];
  onActiveChange: (active: boolean) => void;
}) {
  const { current: mapRef } = useMap();
  const map = mapRef?.getMap() as unknown as MapLibreMap | undefined;
  const track = useMemo(() => buildPlaybackTrack(points), [points]);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [speed, setSpeed] = useState<number>(1);
  const [follow, setFollow] = useState(false);
  // rAF döngüsü state güncellemesini beklemeden ilerleyebilsin diye ayna ref.
  const progressRef = useRef(0);

  function seek(p: number) {
    progressRef.current = p;
    setProgress(p);
  }

  // Oynatma döngüsü. Hız değişince yeniden kurulur ve kaldığı yerden devam eder.
  useEffect(() => {
    if (!playing) return;
    const durationMs = PLAYBACK_BASE_MS / speed;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const next = Math.min(progressRef.current + (now - last) / durationMs, 1);
      last = now;
      progressRef.current = next;
      setProgress(next);
      if (next < 1) raf = requestAnimationFrame(step);
      else setPlaying(false); // sona gelindi
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  // Oynatma başlayınca alttaki ham güzergah soluklaşsın (boyama MapView'da).
  const active = playing || progress > 0;
  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  const frame = playbackFrameAt(track, progress * track.total);
  const frameLng = frame?.lon;
  const frameLat = frame?.lat;

  // Takip modu: kamera her karede araca kilitlenir. Programatik bir geçiş
  // (easeTo) sürerken araya girilmez, yoksa geçiş iptal olur.
  useEffect(() => {
    if (!map || !follow || frameLng == null || frameLat == null) return;
    if (map.isEasing()) return;
    map.setCenter([frameLng, frameLat]);
  }, [map, follow, frameLng, frameLat]);

  function togglePlay() {
    if (!playing && progressRef.current >= 1) seek(0); // sondayken baştan başlat
    setPlaying((v) => !v);
  }

  function toggleFollow() {
    const next = !follow;
    setFollow(next);
    if (next && map && frame) {
      map.easeTo({
        center: [frame.lon, frame.lat],
        zoom: Math.max(map.getZoom(), 16),
        duration: 500,
      });
    }
  }

  function cycleSpeed() {
    const i = PLAYBACK_SPEEDS.indexOf(speed as (typeof PLAYBACK_SPEEDS)[number]);
    setSpeed(PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.length]);
  }

  // Geçilen güzergah: tamamlanan noktalar + ara değerlenmiş anlık konum.
  // Ham rotayla aynı görünsün diye o da Chaikin ile yumuşatılır.
  const traveled: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: frame
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: chaikinSmooth([
                ...points.slice(0, frame.index + 1).map(toLngLat),
                [frame.lon, frame.lat],
              ]),
            },
          },
        ]
      : [],
  };

  return (
    <>
      {/* Geçilen yol — ham güzergahın üstünde parlak mor iz */}
      <Source id="playback-trail" type="geojson" data={traveled}>
        <Layer
          id="playback-trail-glow"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': PLAYBACK_COLOR,
            'line-width': 13,
            'line-opacity': 0.2,
            'line-blur': 6,
          }}
        />
        <Layer
          id="playback-trail-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': PLAYBACK_COLOR, 'line-width': 5 }}
        />
      </Source>

      {/* Oynatılan andaki kamyon */}
      {frame && (
        <Marker longitude={frame.lon} latitude={frame.lat} anchor="center">
          <TruckIcon heading={frame.heading} color={PLAYBACK_COLOR} smooth={false} />
        </Marker>
      )}

      {/* Kumanda çubuğu — harita konteynerinin altına sabitlenir */}
      <div
        style={{
          position: 'absolute', left: 10, right: 10, bottom: 28, zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 560, margin: '0 auto',
          padding: '6px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,.96)',
          boxShadow: '0 2px 10px rgba(0,0,0,.22)',
          fontSize: 11, color: '#3f3f46',
        }}
      >
        <PlayerButton
          onClick={togglePlay}
          title={playing ? 'Duraklat' : 'Güzergahı oynat'}
          active={playing}
        >
          {playing ? '❚❚' : '▶'}
        </PlayerButton>
        <PlayerButton
          onClick={() => {
            setPlaying(false);
            seek(0);
          }}
          title="Başa sar"
          disabled={!active}
        >
          ↺
        </PlayerButton>

        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          aria-label="Güzergah ilerlemesi"
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          style={{ flex: 1, minWidth: 60, accentColor: PLAYBACK_COLOR, cursor: 'pointer' }}
        />

        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {frame ? formatTime(frame.point.t) : '—'}
        </span>
        {frame?.point.speed != null && (
          <span style={{ color: '#71717a', whiteSpace: 'nowrap' }}>
            {Math.round(Number(frame.point.speed))} km/s
          </span>
        )}

        <button
          type="button"
          title="Oynatma hızı"
          onClick={cycleSpeed}
          style={{
            flexShrink: 0, padding: '2px 7px', borderRadius: 999,
            border: '1px solid #e4e4e7', background: 'white',
            fontSize: 11, fontWeight: 600, color: '#3f3f46', cursor: 'pointer',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {speed}×
        </button>
        <PlayerButton
          onClick={toggleFollow}
          title={follow ? 'Kamera takibini bırak' : 'Kamerayı araca kilitle'}
          active={follow}
        >
          ◎
        </PlayerButton>
      </div>
    </>
  );
}
