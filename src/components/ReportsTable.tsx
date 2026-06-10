'use client';

import { useEffect, useRef, useState } from 'react';
import type { DailySummary } from '@/lib/types';
import { formatDate } from '@/lib/format';

type ColKey = keyof typeof COLUMN_DEFS;

const COLUMN_DEFS = {
  total_distance_km: { label: 'Mesafe',        unit: 'km',  group: 'genel' },
  waypoint_count:    { label: 'Durak',          unit: null,  group: 'genel' },
  total_load_kg:     { label: 'Toplam Yük',     unit: 'kg',  group: 'genel' },
  avg_speed_kmh:     { label: 'Ort. Hız',       unit: 'km/s',group: 'genel' },
  max_speed_kmh:     { label: 'Maks. Hız',      unit: 'km/s',group: 'genel' },
  avg_load_kg:       { label: 'Ort. Yük',       unit: 'kg',  group: 'genel' },
  telemetry_count:   { label: 'Kayıt',          unit: null,  group: 'genel' },
  avg_temperature_c: { label: 'Ort. Sıcaklık',  unit: '°C',  group: 'sensor' },
  min_temperature_c: { label: 'Min. Sıcaklık',  unit: '°C',  group: 'sensor' },
  max_temperature_c: { label: 'Maks. Sıcaklık', unit: '°C',  group: 'sensor' },
  avg_humidity_pct:  { label: 'Nem',            unit: '%',   group: 'sensor' },
  avg_pressure_hpa:  { label: 'Basınç',         unit: null,  group: 'sensor' },
  motion_count:      { label: 'Hareket',        unit: null,  group: 'sensor' },
  avg_battery_mv:    { label: 'Batarya',        unit: 'mV',  group: 'sensor' },
} as const;

const ALL_KEYS = Object.keys(COLUMN_DEFS) as ColKey[];
const DEFAULT_KEYS: ColKey[] = ['total_distance_km', 'waypoint_count', 'total_load_kg', 'telemetry_count'];
const LS_KEY = 'reports_columns_v1';

function loadSavedKeys(): ColKey[] {
  if (typeof window === 'undefined') return DEFAULT_KEYS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_KEYS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_KEYS;
    const valid = parsed.filter((k): k is ColKey => ALL_KEYS.includes(k as ColKey));
    return valid.length > 0 ? valid : DEFAULT_KEYS;
  } catch {
    return DEFAULT_KEYS;
  }
}

function fmt(value: number | null | undefined, unit: string | null): string {
  if (value == null) return '—';
  return unit ? `${value} ${unit}` : String(value);
}

export default function ReportsTable({
  rows,
}: {
  rows: { date: string; summary: DailySummary | null }[];
}) {
  const [activeKeys, setActiveKeys] = useState<ColKey[]>(DEFAULT_KEYS);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // localStorage'dan yükle (hydration sonrası)
  useEffect(() => {
    setActiveKeys(loadSavedKeys());
  }, []);

  // Panel dışına tıklayınca kapat
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggleKey(key: ColKey) {
    setActiveKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const hasAny = rows.some((r) => r.summary !== null);
  const genel  = ALL_KEYS.filter((k) => COLUMN_DEFS[k].group === 'genel');
  const sensor = ALL_KEYS.filter((k) => COLUMN_DEFS[k].group === 'sensor');

  return (
    <div className="flex flex-col gap-3">
      {/* Başlık satırı */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Son {rows.length} günün özeti</p>

        {/* Sütun seçici */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Sütunlar
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              {activeKeys.length}/{ALL_KEYS.length}
            </span>
            <svg className="h-3 w-3 text-zinc-400" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 8L1 3h10z" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg">
              <GroupLabel>Genel</GroupLabel>
              {genel.map((key) => (
                <CheckRow key={key} colKey={key} active={activeKeys.includes(key)} onToggle={toggleKey} />
              ))}
              <div className="my-1 border-t border-zinc-100" />
              <GroupLabel>Sensör</GroupLabel>
              {sensor.map((key) => (
                <CheckRow key={key} colKey={key} active={activeKeys.includes(key)} onToggle={toggleKey} />
              ))}
            </div>
          )}
        </div>
      </div>

      {!hasAny ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Son {rows.length} gün için hesaplanmış özet yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
                <Th>Tarih</Th>
                {activeKeys.map((key) => (
                  <Th key={key}>{COLUMN_DEFS[key].label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ date, summary }) => (
                <tr key={date} className="border-b border-zinc-100 last:border-0">
                  <Td className="font-medium text-zinc-800">{formatDate(date)}</Td>
                  {summary ? (
                    activeKeys.map((key) => (
                      <Td key={key}>
                        {fmt(summary[key] as number | null, COLUMN_DEFS[key].unit)}
                      </Td>
                    ))
                  ) : (
                    <td colSpan={activeKeys.length} className="px-3 py-2 text-zinc-400">
                      Kayıt yok
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
      {children}
    </p>
  );
}

function CheckRow({
  colKey,
  active,
  onToggle,
}: {
  colKey: ColKey;
  active: boolean;
  onToggle: (k: ColKey) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-50">
      <input
        type="checkbox"
        checked={active}
        onChange={() => onToggle(colKey)}
        className="h-3.5 w-3.5 rounded border-zinc-300 accent-blue-600"
      />
      <span className="text-xs text-zinc-700">{COLUMN_DEFS[colKey].label}</span>
      {COLUMN_DEFS[colKey].unit && (
        <span className="ml-auto text-[10px] text-zinc-400">{COLUMN_DEFS[colKey].unit}</span>
      )}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-zinc-700 ${className}`}>{children}</td>;
}
