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

/** Bugünden geriye doğru n günün YYYY-MM-DD listesi (Istanbul takvimi). En yeni gün başta. */
export function lastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(isoDateFmt.format(d));
  }
  return out;
}
