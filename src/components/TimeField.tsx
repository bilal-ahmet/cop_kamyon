'use client';

import { useId } from 'react';

/**
 * 24 saatlik saat girişi ("HH:MM").
 *
 * Native <input type="time"> saat biçimini sayfa dilinden değil **tarayıcı arayüz
 * dilinden** alır; İngilizce bir tarayıcıda AM/PM gösterir. Bu alan metin girişi
 * olduğu için her koşulda 24 saatlik kalır.
 */
export default function TimeField({
  label,
  value,
  onChange,
  placeholder = '00:00',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const listId = useId();

  // Yazarken: sadece rakamları al, 2 haneden sonra ":" ekle, saat/dakikayı sınırla.
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length === 0) return onChange('');
    if (digits.length <= 2) return onChange(digits);
    onChange(`${digits.slice(0, 2)}:${digits.slice(2)}`);
  }

  // Odak çıkışında tamamla ve geçerli aralığa çek ("9" → "09:00", "99:99" → "23:59").
  function handleBlur() {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return onChange('');
    const h = Math.min(23, Number(digits.slice(0, 2).padEnd(2, '0')));
    const m = Math.min(59, Number(digits.slice(2).padEnd(2, '0')));
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        list={listId}
        value={value}
        placeholder={placeholder}
        maxLength={5}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="w-[5.5rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs tabular-nums text-zinc-800 focus:border-blue-400 focus:outline-none"
      />
      <datalist id={listId}>
        {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </label>
  );
}
