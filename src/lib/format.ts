// Tarih/saat biçimlendirme — zaman dilimi Europe/Istanbul (+03:00) olarak sabit.
// (Sunucu saat dilimi UTC olabilir; kullanıcıya hep Istanbul saatini gösteriyoruz.)

const TZ = 'Europe/Istanbul';

const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  dateStyle: 'short',
  timeStyle: 'short',
});

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  dateStyle: 'medium',
});

// Yalnızca saat — 24 saatlik, AM/PM yok (tarayıcı diline bakılmaksızın).
const timeFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// YYYY-MM-DD (backend'in beklediği biçim), Istanbul takvim gününe göre.
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

const kmFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

/** ISO zaman damgasını "gg.aa.yyyy ss:dd" gibi gösterir. Geçersizse "—". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

/** ISO/tarih dizesini sadece tarih olarak gösterir. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

/** ISO zaman damgasını yalnızca saat olarak gösterir: "14:32:07". Geçersizse "—". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : timeFmt.format(d);
}

/** Kilometreyi "12,4 km" biçiminde gösterir. */
export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—';
  return `${kmFmt.format(km)} km`;
}

/** Saniyeyi "2 gün 3 sa", "1 sa 18 dk", "35 dk" veya "45 sn" biçiminde gösterir. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d} gün`);
  if (h) parts.push(`${h} sa`);
  if (m) parts.push(`${m} dk`);
  // Bir dakikadan kısa kesintilerde saniye göster (aksi halde boş string kalırdı).
  if (!parts.length) parts.push(`${total} sn`);
  return parts.join(' ');
}

/**
 * "YYYY-MM-DD" + "HH:MM" → ISO zaman damgası (Istanbul +03:00 sabit).
 * `endOfMinute` true ise saniye 59 alınır (aralık sonu için).
 */
export function istanbulIso(date: string, time: string, endOfMinute = false): string {
  return new Date(`${date}T${time}:${endOfMinute ? '59' : '00'}+03:00`).toISOString();
}

/** Bugünden geriye doğru n günün YYYY-MM-DD listesi (Istanbul takvimi). En yeni gün başta. */
export function lastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(isoDateFmt.format(d));
  }
  return out;
}
