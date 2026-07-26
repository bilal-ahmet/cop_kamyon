'use client';

import { useState } from 'react';
import { inputCls } from '../formStyles';
import { parseCoordinate, isValidLat, isValidLon, toDms } from '@/lib/coords';

/**
 * Koordinat girişi — hem ondalık derece hem DMS kabul eder.
 * Yazdıkça altında çözümlenen değeri gösterir; biçim yanlışsa uyarır.
 * Ham metni sunucuya gönderir, ayrıştırma server action'da tekrarlanır.
 */
export default function CoordinateField({
  label,
  name,
  axis,
  defaultValue,
}: {
  label: string;
  name: string;
  axis: 'lat' | 'lon';
  defaultValue?: number | string | null;
}) {
  const [text, setText] = useState(defaultValue == null ? '' : String(defaultValue));

  const parsed = parseCoordinate(text);
  const valid = axis === 'lat' ? isValidLat(parsed) : isValidLon(parsed);
  const showHint = text.trim() !== '';

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        name={name}
        type="text"
        inputMode="text"
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={axis === 'lat' ? "40.788278 veya 40°47'17.8\"K" : "29.025 veya 29°01'30\"D"}
        className={inputCls}
      />
      {showHint && (
        <span className={`text-xs ${valid ? 'text-zinc-500' : 'text-red-600'}`}>
          {valid
            ? `${parsed!.toFixed(6)}  ·  ${toDms(parsed!, axis)}`
            : `Anlaşılamadı. Örnek: 40.788278 veya 40°47'17.8"K`}
        </span>
      )}
    </label>
  );
}
