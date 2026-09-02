import Link from 'next/link';
import { getNotifications } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  CAUSE_LABELS,
  CAUSE_STYLES,
  CONFIDENCE_LABELS,
  SEVERITY_STYLES,
  TYPE_FILTERS,
  TYPE_LABELS,
  relativeTime,
} from '@/lib/notifications';
import { markAllNotificationsRead, markNotificationRead } from '@/actions/notifications';
import NotificationActions from '@/components/notifications/NotificationActions';
import { secondaryBtn } from '@/components/formStyles';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; unread?: string }>;
}) {
  const sp = await searchParams;
  const unreadOnly = sp.unread === '1';

  // null = bildirimler okunamadı (uç yok ya da sunucu hata verdi). Boş dizi = bildirim yok.
  const notifications = await getNotifications({
    type: sp.type || undefined,
    unreadOnly,
    limit: 100,
  });

  if (notifications === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-zinc-900">Bildirimler</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Bildirimler şu anda okunamıyor. En sık sebebi, backend kodunun dağıtılmış ama
          veritabanı migrasyonunun çalıştırılmamış olmasıdır — bu durumda bildirim tabloları
          henüz yoktur. <code className="rounded bg-amber-100 px-1">/api/health</code> adresindeki{' '}
          <code className="rounded bg-amber-100 px-1">migrationsApplied</code> alanını kontrol edin;
          <code className="rounded bg-amber-100 px-1">false</code> ise sunucuda{' '}
          <code className="rounded bg-amber-100 px-1">npm run migrate</code> çalıştırılmalı.
        </p>
      </div>
    );
  }

  const okunmamisVar = notifications.some((n) => !n.is_read);

  /** Filtre bağlantısı — seçili olmayan parametreleri URL'e taşımaz. */
  const filterHref = (type: string, unread: boolean) => {
    const qs = new URLSearchParams();
    if (type) qs.set('type', type);
    if (unread) qs.set('unread', '1');
    const s = qs.toString();
    return s ? `/dashboard/bildirimler?${s}` : '/dashboard/bildirimler';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Bildirimler</h1>
        {okunmamisVar && (
          <NotificationActions
            action={markAllNotificationsRead}
            label="Tümünü okundu işaretle"
            className={secondaryBtn}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((f) => {
          const active = (sp.type ?? '') === f.value;
          return (
            <Link
              key={f.value || 'all'}
              href={filterHref(f.value, unreadOnly)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {f.label}
            </Link>
          );
        })}

        <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden="true" />

        <Link
          href={filterHref(sp.type ?? '', !unreadOnly)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            unreadOnly
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Yalnızca okunmamışlar
        </Link>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          {unreadOnly || sp.type
            ? 'Bu filtreye uyan bildirim yok.'
            : 'Henüz bildirim yok. Bir araçtan veri gelmemeye başlarsa burada görünür.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border border-l-4 border-zinc-200 p-4 ${
                SEVERITY_STYLES[n.severity] ?? 'border-l-zinc-300'
              } ${n.is_read ? 'bg-white' : 'bg-amber-50/40'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.is_read && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                        aria-label="Okunmadı"
                      />
                    )}
                    <h2 className="font-medium text-zinc-900">{n.title}</h2>
                  </div>

                  {n.message && <p className="mt-1 text-sm text-zinc-600">{n.message}</p>}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>

                    {n.probable_cause && (
                      <span
                        className={`rounded border px-2 py-0.5 text-xs ${
                          CAUSE_STYLES[n.probable_cause] ?? CAUSE_STYLES.unknown
                        }`}
                        // Sebep bir tahmindir; güven seviyesi olmadan gösterilmez.
                        title="Sebep, mevcut verilerden çıkarılan bir tahmindir."
                      >
                        {CAUSE_LABELS[n.probable_cause]}
                        {n.cause_confidence && ` · ${CONFIDENCE_LABELS[n.cause_confidence]}`}
                      </span>
                    )}

                    {n.vehicle_id && n.plate && (
                      <Link
                        href={`/dashboard/${n.vehicle_id}`}
                        className="text-xs font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
                      >
                        {n.plate}
                      </Link>
                    )}
                  </div>

                  {n.metadata?.evidence && n.metadata.evidence.length > 0 && (
                    <p className="mt-2 font-mono text-[11px] text-zinc-400">
                      dayanak: {n.metadata.evidence.join(' · ')}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <time
                    dateTime={n.created_at}
                    title={formatDateTime(n.created_at)}
                    className="text-xs text-zinc-500"
                  >
                    {relativeTime(n.created_at)}
                  </time>

                  {!n.is_read && (
                    <NotificationActions
                      action={markNotificationRead}
                      hidden={{ id: n.id }}
                      label="Okundu"
                      className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
