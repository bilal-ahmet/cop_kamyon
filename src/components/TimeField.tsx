'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 24 saatlik saat seçici ("HH:MM").
 *
 * Native <input type="time"> saat biçimini sayfa dilinden değil **tarayıcı arayüz
 * dilinden** alır; İngilizce bir tarayıcıda AM/PM gösterir. Ayrıca native <datalist>
 * açılır listesi çok uzayıp ekrandan taşabiliyordu. Bu bileşen kendi listesini
 * çizer: sabit yükseklikli, kaydırılabilir ve konteynerin içinde kalır.
 *
 * Hem elle yazılabilir (rakamlar otomatik "HH:MM" olur) hem listeden seçilebilir.
 */

const STEP_MIN = 15;
const OPTIONS = Array.from({ length: (24 * 60) / STEP_MIN }, (_, i) => {
  const h = Math.floor((i * STEP_MIN) / 60);
  const m = (i * STEP_MIN) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/** Serbest girişi "HH:MM"e normalize eder; boşsa '' döner. */
function normalize(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  const h = Math.min(23, Number(digits.slice(0, 2).padEnd(2, '0')));
  const m = Math.min(59, Number(digits.slice(2, 4).padEnd(2, '0')));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimeField({
  label,
  value,
  onChange,
  placeholder = '--:--',
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Verilirse normalize edilmiş "HH:MM" değeri gizli alanla forma gönderilir. */
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Dışarıdan gelen değer değişince (ör. sıfırlama) taslağı eşitle.
  // Effect yerine render sırasında düzeltme — React'in önerdiği desen, fazladan render yok.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  // Dışarı tıklayınca kapat ve yazılanı normalize et.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        onChange(normalize(draft));
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, draft, onChange]);

  // Açılınca seçili saati listede görünür yap.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [open]);

  function commit(v: string) {
    const n = normalize(v);
    setDraft(n);
    onChange(n);
    setOpen(false);
  }

  // Yazarken rakamları biçimlendir: "143" → "14:3"
  function handleType(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setDraft(digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`);
  }

  return (
    <div ref={boxRef} className="relative flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>

      {/* Form gönderiminde yarım yazılmış metin değil, normalize edilmiş değer gider. */}
      {name && <input type="hidden" name={name} value={normalize(draft)} />}

      <div className="flex items-center">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          placeholder={placeholder}
          maxLength={5}
          onFocus={() => setOpen(true)}
          onChange={(e) => handleType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
            if (e.key === 'Escape') { setDraft(value); setOpen(false); }
          }}
          className="w-[4.5rem] rounded-l-md border border-r-0 border-zinc-300 bg-white px-2 py-1 text-xs tabular-nums text-zinc-800 focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          aria-label={`${label} saatini listeden seç`}
          onClick={() => setOpen((v) => !v)}
          className="rounded-r-md border border-zinc-300 bg-white px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-zinc-50"
        >
          ▾
        </button>
        {draft && (
          <button
            type="button"
            aria-label={`${label} saatini temizle`}
            onClick={() => commit('')}
            className="ml-1 text-xs text-zinc-400 hover:text-zinc-700"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 z-50 mt-1 max-h-48 w-[6.5rem] overflow-y-auto overscroll-contain rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {OPTIONS.map((t) => {
            const selected = t === normalize(draft);
            return (
              <li key={t}>
                <button
                  type="button"
                  data-selected={selected}
                  onClick={() => commit(t)}
                  className={`block w-full px-3 py-1 text-left text-xs tabular-nums transition-colors ${
                    selected ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
