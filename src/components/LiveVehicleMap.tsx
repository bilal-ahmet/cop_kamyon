'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { VehicleLocation, StopLocation, TrackPoint, RouteLeg } from '@/lib/types';
import { formatDateTime, formatKm, istanbulIso, lastNDates } from '@/lib/format';
import { findStopByKind, legLengthsKm, pathLengthKm, splitLegs } from '@/lib/geo';
import TimeField from './TimeField';

const TRAIL_MAX = 600;

/** Telemetri satırından iz noktası (NUMERIC alanlar string gelebilir). */
type TelemetryRow = { lat: number; lon: number; recorded_at: string; speed_kmh?: number | null };

function toTrackPoint(r: TelemetryRow): TrackPoint {
  return {
    lat: Number(r.lat),
    lon: Number(r.lon),
    t: r.recorded_at,
    speed: r.speed_kmh == null ? null : Number(r.speed_kmh),
  };
}

// Leaflet 'window' kullandığı için harita yalnızca istemcide yüklenir (ssr: false).
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
      Harita yükleniyor…
    </div>
  ),
});

const POLL_MS = 3_000;

export default function LiveVehicleMap({
  vehicleId,
  plate,
  initialLocation,
  stopLocations = [],
  initialFocusPoint = null,
}: {
  vehicleId: number;
  plate: string;
  initialLocation: VehicleLocation | null;
  stopLocations?: StopLocation[];
  initialFocusPoint?: [number, number] | null;
}) {
  const [location, setLocation] = useState<VehicleLocation | null>(initialLocation);
  const [stale, setStale] = useState(false);
  const [focusedStop, setFocusedStop] = useState<[number, number] | null>(initialFocusPoint);
  const [trail, setTrail] = useState<TrackPoint[]>([]);
  const [showTrail, setShowTrail] = useState(true);
  const lastTrailPoint = useRef<string | null>(null);

  // Mod ve geçmiş filtresi
  const [mode, setMode] = useState<'live' | 'history'>('live');
  const today = lastNDates(1)[0];
  const [histDate, setHistDate] = useState(today);
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [histTrail, setHistTrail] = useState<TrackPoint[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  // Güzergah filtresi: tümü / yalnızca gidiş / yalnızca dönüş
  const [legFilter, setLegFilter] = useState<'all' | RouteLeg>('all');

  // Bugünün telemetri geçmişini ilk yüklemede çek (canlı iz başlangıcı)
  useEffect(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: new Date().toISOString(),
      fix_valid: 'true',
      limit: '500',
    });
    fetch(`/api/vehicles/${vehicleId}/telemetry?${params}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TelemetryRow[]) => {
        // DESC geldiği için kronolojik sıraya çevir
        const pts = rows.map(toTrackPoint).reverse();
        setTrail(pts);
        const last = pts[pts.length - 1];
        if (last) lastTrailPoint.current = `${last.lat},${last.lon}`;
      })
      .catch(() => {});
  }, [vehicleId]);

  // Canlı konum polling — yalnızca canlı modda çalışır
  useEffect(() => {
    if (mode === 'history') return;
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/vehicles/${vehicleId}/location`, {
          cache: 'no-store',
        });
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          if (active) setStale(true);
          return;
        }
        const data: VehicleLocation | null = await res.json();
        if (active) {
          setStale(false);
          if (data) {
            setLocation(data);
            const key = `${data.lat},${data.lon}`;
            if (key !== lastTrailPoint.current) {
              lastTrailPoint.current = key;
              setTrail((prev) => {
                const next: TrackPoint[] = [
                  ...prev,
                  {
                    lat: Number(data.lat),
                    lon: Number(data.lon),
                    t: data.recorded_at,
                    speed: data.speed_kmh == null ? null : Number(data.speed_kmh),
                  },
                ];
                return next.length > TRAIL_MAX ? next.slice(next.length - TRAIL_MAX) : next;
              });
            }
          }
        }
      } catch {
        if (active) setStale(true);
      }
    }

    const timer = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [vehicleId, mode]);

  async function loadHistory() {
    if (!histDate) {
      setHistError('Lütfen bir tarih seçin.');
      return;
    }
    setHistLoading(true);
    setHistError(null);
    const params = new URLSearchParams({
      from: istanbulIso(histDate, histFrom || '00:00'),
      to: istanbulIso(histDate, histTo || '23:59', true),
      fix_valid: 'true',
      limit: '1000',
    });
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/telemetry?${params}`, {
        cache: 'no-store',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setHistError('Veri alınamadı.');
        return;
      }
      const rows: TelemetryRow[] = await res.json();
      const pts = rows.map(toTrackPoint).reverse();
      setHistTrail(pts);
      setMode('history');
      if (pts.length === 0) setHistError('Seçilen aralıkta konum verisi yok.');
    } catch {
      setHistError('Bağlantı hatası.');
    } finally {
      setHistLoading(false);
    }
  }

  const isHistory = mode === 'history';
  const activeStops = stopLocations.filter((sl) => sl.is_active);

  // Başlangıç/bitiş konumları — gidiş/dönüş ayrımı bitiş konumundan türetilir.
  const startLoc = findStopByKind(stopLocations, 'start');
  const endLoc = findStopByKind(stopLocations, 'end');
  const anchors = [startLoc, endLoc].filter((sl): sl is StopLocation => sl !== null);

  // Geçmiş iz → gidiş/dönüş etiketli noktalar, ardından filtre.
  const legTrail = useMemo(() => splitLegs(histTrail, endLoc), [histTrail, endLoc]);
  const hasReturn = legTrail.some((p) => p.leg === 'return');
  const shownTrail = useMemo(
    () => (legFilter === 'all' ? legTrail : legTrail.filter((p) => p.leg === legFilter)),
    [legTrail, legFilter],
  );

  // Gidilen mesafeler
  const dist = useMemo(() => legLengthsKm(legTrail), [legTrail]);
  const liveKm = useMemo(() => pathLengthKm(trail), [trail]);

  // Harita merkezi: geçmiş modda rotanın ilk noktası, yoksa canlı konum
  const center: [number, number] | null =
    isHistory && shownTrail.length > 0
      ? [shownTrail[0].lat, shownTrail[0].lon]
      : location
        ? [location.lat, location.lon]
        : null;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {/* Mod + filtre çubuğu */}
      <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        {/* Canlı / Geçmiş segmenti */}
        <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs">
          <button
            onClick={() => setMode('live')}
            className={`rounded px-3 py-1 transition-colors ${
              !isHistory ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Canlı
          </button>
          <button
            onClick={() => setMode('history')}
            className={`rounded px-3 py-1 transition-colors ${
              isHistory ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Geçmiş
          </button>
        </div>

        {isHistory && (
          <>
            <LabeledDate label="Tarih" value={histDate} max={today} onChange={setHistDate} />
            <TimeField label="Başlangıç" value={histFrom} onChange={setHistFrom} />
            <TimeField label="Bitiş" value={histTo} onChange={setHistTo} />
            <button
              onClick={loadHistory}
              disabled={histLoading}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {histLoading ? 'Yükleniyor…' : 'Göster'}
            </button>

            {/* Güzergah filtresi — yalnızca dönüş rotası tespit edildiyse anlamlı */}
            {hasReturn && (
              <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs">
                {(
                  [
                    ['all', 'Tümü'],
                    ['out', 'Gidiş'],
                    ['return', 'Dönüş'],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    onClick={() => setLegFilter(value)}
                    className={`rounded px-3 py-1 transition-colors ${
                      legFilter === value ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}

            {histError && <span className="text-xs text-amber-600">{histError}</span>}
            {!histError && histTrail.length > 0 && (
              <span className="text-xs text-zinc-500">
                {shownTrail.length} konum noktası · {formatKm(dist.total)}
                {hasReturn && ` (gidiş ${formatKm(dist.out)} · dönüş ${formatKm(dist.return)})`}
              </span>
            )}
          </>
        )}
      </div>

      <div className="h-[600px] w-full">
        {center ? (
          <MapView
            lat={center[0]}
            lon={center[1]}
            label={plate}
            stopLocations={isHistory ? [] : stopLocations}
            routeAnchors={isHistory ? anchors : []}
            focusPoint={isHistory ? null : focusedStop}
            vehicleId={vehicleId}
            trackPoints={isHistory ? shownTrail : showTrail ? trail : undefined}
            mode={mode}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            {isHistory
              ? 'Tarih seçip "Göster"e basın.'
              : 'Henüz konum verisi yok. Araçtan ilk sinyal bekleniyor…'}
          </div>
        )}
      </div>

      {/* Alt bilgi çubuğu — canlı modda araç durumu */}
      {!isHistory && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-zinc-200 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                stale ? 'bg-amber-500' : 'bg-green-500'
              }`}
            />
            <span className="text-zinc-500">{stale ? 'Bağlantı sorunu' : 'Canlı'}</span>
          </span>

          {location ? (
            <>
              <Field label="Enlem" value={location.lat.toFixed(6)} />
              <Field label="Boylam" value={location.lon.toFixed(6)} />
              <Field
                label="Yük"
                value={location.load_kg != null ? `${location.load_kg} kg` : '—'}
              />
              <Field label="Bugün gidilen" value={formatKm(liveKm)} />
              <Field label="Son kayıt" value={formatDateTime(location.recorded_at)} />
            </>
          ) : (
            <span className="text-zinc-500">Veri bekleniyor</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowTrail((v) => !v)}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                showTrail
                  ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {showTrail ? 'İzi Gizle' : 'İzi Göster'}
            </button>

            {activeStops.length > 0 && (
              <button
                onClick={() => setFocusedStop(null)}
                disabled={focusedStop === null}
                className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                  focusedStop
                    ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                    : 'border-zinc-200 text-zinc-400 cursor-default'
                }`}
              >
                Araca dön
              </button>
            )}
          </div>
        </div>
      )}

      {/* Geçmiş modda rota açıklaması */}
      {isHistory && histTrail.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-green-600 shadow" />
            İz başlangıcı
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-red-600 shadow" />
            İz bitişi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-blue-600" />
            Gidiş güzergahı {formatKm(dist.out)}
          </span>
          {hasReturn && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 bg-amber-500" />
              Dönüş güzergahı {formatKm(dist.return)}
            </span>
          )}
          <span className="text-zinc-400">
            ▲ oklar gidiş yönünü gösterir · izin üzerine gelince saat bilgisi çıkar
          </span>
          {!endLoc && (
            <span className="text-amber-600">
              Dönüş rotasını ayırmak için Lokasyonlar sekmesinden bir “Bitiş konumu” tanımlayın.
            </span>
          )}
        </div>
      )}

      {/* Durak listesi — yalnızca canlı modda */}
      {!isHistory && activeStops.length > 0 && (
        <div className="border-t border-zinc-200 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Duraklar
          </p>
          <ul className="flex flex-col gap-1">
            {activeStops.map((sl) => (
              <li key={sl.id}>
                <button
                  onClick={() => setFocusedStop([Number(sl.lat), Number(sl.lon)])}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full bg-orange-400" />
                  <span className="font-medium text-zinc-800">{sl.name}</span>
                  <span className="ml-auto text-xs text-zinc-400">{sl.radius_m} m</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LabeledDate({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 focus:border-blue-400 focus:outline-none"
      />
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800">{value}</span>
    </span>
  );
}
