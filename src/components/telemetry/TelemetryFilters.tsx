'use client';

import { useState } from 'react';
import TimeField from '../TimeField';
import { lastNDates } from '@/lib/format';

/**
 * Telemetri filtre çubuğu — düz bir GET formu.
 * Filtreler URL'de tutulduğu için sayfa sunucuda render edilir, link paylaşılabilir
 * ve geri tuşu çalışır. Saat alanları 24 saatlik özel bileşendir (AM/PM yok).
 *
 * "Kesinti (dk)" doluyken sayfa kesinti moduna geçer: ardışık iki kayıt arasındaki
 * süre bu değeri aşan yerler listelenir. O modda fix filtresi hesaba katılmaz.
 */
export default function TelemetryFilters({
  date,
  from,
  to,
  fix,
  gap,
}: {
  date: string;
  from: string;
  to: string;
  fix: string;
  gap: string;
}) {
  const [fromTime, setFromTime] = useState(from);
  const [toTime, setToTime] = useState(to);
  const [gapValue, setGapValue] = useState(gap);
  const today = lastNDates(1)[0];
  const gapMode = Number(gapValue) >= 1;

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
    >
      {/* Filtre değişince ilk sayfaya dön */}
      <input type="hidden" name="page" value="1" />

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Tarih</span>
        <input
          type="date"
          name="date"
          defaultValue={date}
          max={today}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 focus:border-blue-400 focus:outline-none"
        />
      </label>

      <TimeField label="Başlangıç" name="from" value={fromTime} onChange={setFromTime} />
      <TimeField label="Bitiş" name="to" value={toTime} onChange={setToTime} />

      {/* Kesinti modunda fix filtresi backend'de uygulanmaz; alan soluklaştırılır ama
          değeri formda kalır ki mod kapatılınca seçim kaybolmasın. */}
      <label className={`flex flex-col gap-1 ${gapMode ? 'opacity-40' : ''}`}>
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Fix</span>
        <select
          name="fix"
          defaultValue={fix}
          aria-disabled={gapMode}
          title={gapMode ? 'Kesinti modunda fix filtresi uygulanmaz' : undefined}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 focus:border-blue-400 focus:outline-none"
        >
          <option value="">Tümü</option>
          <option value="valid">Geçerli</option>
          <option value="invalid">Geçersiz</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
          Kesinti (dk)
        </span>
        <input
          type="number"
          name="gap"
          min={1}
          max={10080}
          step={1}
          placeholder="—"
          value={gapValue}
          onChange={(e) => setGapValue(e.target.value)}
          title="Girilen dakikayı aşan veri boşluklarını listeler"
          className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 focus:border-blue-400 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
      >
        Filtrele
      </button>

      {(date || from || to || fix || gap) && (
        <a
          href="?"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-white"
        >
          Temizle
        </a>
      )}
    </form>
  );
}
