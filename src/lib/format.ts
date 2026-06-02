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

// YYYY-MM-DD (backend'in beklediği biçim), Istanbul takvim gününe göre.
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

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

/** Bugünden geriye doğru n günün YYYY-MM-DD listesi (Istanbul takvimi). En yeni gün başta. */
export function lastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(isoDateFmt.format(d));
  }
  return out;
}
