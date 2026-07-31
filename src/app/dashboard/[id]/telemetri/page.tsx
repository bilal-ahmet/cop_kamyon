import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVehicleById, getVehicleTelemetry } from '@/lib/api';
import { formatDateTime, istanbulIso } from '@/lib/format';
import TelemetryFilters from '@/components/telemetry/TelemetryFilters';

const PAGE_SIZE = 20;

// "Telemetri" sekmesi: sensörlerden gelen ham kayıtlar — zaman filtresi + sayfalama.
// Filtreler URL'de tutulur (searchParams), böylece sayfa sunucuda render edilir.
export default async function VehicleTelemetryTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const vehicleId = Number(id);

  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) notFound();

  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? '';
  const date = one('date');
  const from = one('from');
  const to = one('to');
  const fix = one('fix');
  const page = Math.max(1, Number(one('page')) || 1);

  // Tarih verilmediyse zaman filtresi uygulanmaz; verildiyse o günün seçili aralığı.
  const range = date
    ? { from: istanbulIso(date, from || '00:00'), to: istanbulIso(date, to || '23:59', true) }
    : {};

  // PAGE_SIZE + 1 çekip sonraki sayfa olup olmadığını anlıyoruz (COUNT sorgusu yok).
  const rows = await getVehicleTelemetry(vehicleId, {
    ...range,
    fixValid: fix === 'valid' ? true : fix === 'invalid' ? false : undefined,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });

  const hasNext = rows.length > PAGE_SIZE;
  const records = rows.slice(0, PAGE_SIZE);
  const filtered = Boolean(date || fix);

  /** Mevcut filtreleri koruyarak sayfa bağlantısı üretir. */
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (date) qs.set('date', date);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (fix) qs.set('fix', fix);
    if (p > 1) qs.set('page', String(p));
    const q = qs.toString();
    return q ? `?${q}` : '?';
  };

  const firstIndex = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="flex flex-col gap-4">
      <TelemetryFilters date={date} from={from} to={to} fix={fix} />

      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          {filtered
            ? 'Seçilen aralıkta telemetri kaydı yok. Filtreyi genişletmeyi deneyin.'
            : page > 1
              ? 'Bu sayfada kayıt yok. Önceki sayfaya dönün.'
              : 'Bu araç için telemetri kaydı yok. Sensör henüz veri göndermemiş olabilir.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Zaman</th>
                  <th className="px-3 py-2">Konum</th>
                  <th className="px-3 py-2">Yükseklik</th>
                  <th className="px-3 py-2">Hız</th>
                  <th className="px-3 py-2">Yük (kg)</th>
                  <th className="px-3 py-2">Uydu</th>
                  <th className="px-3 py-2">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {records.map((r, i) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-xs tabular-nums text-zinc-400">
                      {firstIndex + i}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-800">
                      {formatDateTime(r.recorded_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-600">
                      {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">
                      {r.altitude_m != null ? `${Math.round(r.altitude_m)} m` : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">
                      {r.speed_kmh != null ? `${Math.round(r.speed_kmh)} km/s` : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{r.load_kg ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700">{r.satellites ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.fix_valid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {r.fix_valid
                          ? r.fix_type != null
                            ? `${r.fix_type}D Fix`
                            : 'Geçerli'
                          : 'Geçersiz'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {firstIndex}–{firstIndex + records.length - 1}. kayıt · Sayfa {page}
            </span>
            <div className="flex items-center gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page === 1}>
                ← Önceki
              </PageLink>
              <PageLink href={pageHref(page + 1)} disabled={!hasNext}>
                Sonraki →
              </PageLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Sayfalama bağlantısı; devre dışıysa tıklanamaz span olarak çizilir. */
function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base = 'rounded-md border px-3 py-1.5 text-xs transition-colors';
  if (disabled) {
    return (
      <span aria-disabled className={`${base} cursor-default border-zinc-200 text-zinc-300`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} className={`${base} border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
      {children}
    </Link>
  );
}
