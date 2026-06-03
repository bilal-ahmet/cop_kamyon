'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { VehicleLocation } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

// Leaflet 'window' kullandığı için harita yalnızca istemcide yüklenir (ssr: false).
// ssr: false bir Client Component içinde olmalı (Next 16 kuralı).
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
}: {
  vehicleId: number;
  plate: string;
  initialLocation: VehicleLocation | null;
}) {
  const [location, setLocation] = useState<VehicleLocation | null>(initialLocation);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/vehicles/${vehicleId}/location`, {
          cache: 'no-store',
        });
        if (res.status === 401) {
          // Oturum düştü → giriş ekranına.
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

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="h-96 w-full">
        {location ? (
          <MapView lat={location.lat} lon={location.lon} label={plate} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            Henüz konum verisi yok. Araçtan ilk sinyal bekleniyor…
          </div>
        )}
      </div>

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
      </div>
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
