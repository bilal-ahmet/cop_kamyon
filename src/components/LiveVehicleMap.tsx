'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { VehicleLocation, StopLocation } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

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

  useEffect(() => {
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
          if (data) setLocation(data);
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
  }, [vehicleId]);

  const activeStops = stopLocations.filter((sl) => sl.is_active);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="h-[600px] w-full">
        {location ? (
          <MapView
            lat={location.lat}
            lon={location.lon}
            label={plate}
            stopLocations={stopLocations}
            focusPoint={focusedStop}
            vehicleId={vehicleId}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            Henüz konum verisi yok. Araçtan ilk sinyal bekleniyor…
          </div>
        )}
      </div>

      {/* Araç konum bilgileri */}
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
            <Field label="Son kayıt" value={formatDateTime(location.recorded_at)} />
          </>
        ) : (
          <span className="text-zinc-500">Veri bekleniyor</span>
        )}

        {activeStops.length > 0 && (
          <button
            onClick={() => setFocusedStop(null)}
            disabled={focusedStop === null}
            className={`ml-auto rounded-md border px-3 py-1 text-xs transition-colors ${
              focusedStop
                ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                : 'border-zinc-200 text-zinc-400 cursor-default'
            }`}
          >
            Araca dön
          </button>
        )}
      </div>

      {/* Durak listesi — haritada göster */}
      {activeStops.length > 0 && (
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800">{value}</span>
    </span>
  );
}
