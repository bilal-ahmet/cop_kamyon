// Bildirim sebep/güven etiketleri ve renkleri — hem zil hem bildirim listesi kullanır.
// Sunucuya özel bir şey içermez; istemci bileşenlerinden de import edilebilir.

import type { NotificationCause, NotificationConfidence, NotificationType } from './types';

/**
 * Sebep etiketleri. Bunlar TAHMİNDİR: backend "veri gelmiyor"u görür, sebebini
 * mevcut ipuçlarından çıkarır. Bu yüzden etiketler hep güven seviyesiyle gösterilir.
 */
export const CAUSE_LABELS: Record<NotificationCause, string> = {
  connectivity: 'Bağlantı',
  power: 'Güç / batarya',
  sensor_config: 'Sensör ayarı',
  system_outage: 'Sistem geneli',
  parked: 'Park halinde',
  unknown: 'Bilinmiyor',
};

export const CONFIDENCE_LABELS: Record<NotificationConfidence, string> = {
  low: 'düşük güven',
  medium: 'orta güven',
  high: 'yüksek güven',
  confirmed: 'doğrulandı',
};

export const CAUSE_STYLES: Record<NotificationCause, string> = {
  connectivity: 'bg-amber-50 text-amber-800 border-amber-200',
  power: 'bg-orange-50 text-orange-800 border-orange-200',
  sensor_config: 'bg-violet-50 text-violet-800 border-violet-200',
  system_outage: 'bg-red-50 text-red-800 border-red-200',
  parked: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  unknown: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export const SEVERITY_STYLES: Record<string, string> = {
  info: 'border-l-zinc-300',
  warning: 'border-l-amber-400',
  critical: 'border-l-red-500',
};

export const TYPE_LABELS: Record<NotificationType, string> = {
  vehicle_data_stale: 'Veri gelmiyor',
  vehicle_data_resumed: 'Veri geri geldi',
  system_outage: 'Sistem geneli kesinti',
  system_recovered: 'Sistem normale döndü',
};

/** Bildirim listesi filtresi için tür seçenekleri. */
export const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'vehicle_data_stale', label: 'Veri gelmiyor' },
  { value: 'vehicle_data_resumed', label: 'Veri geri geldi' },
  { value: 'system_outage', label: 'Sistem geneli' },
];

/** "3 dakika önce", "2 saat önce" gibi göreli zaman. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs)) return '—';

  const dk = Math.floor(diffMs / 60_000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dakika önce`;

  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} saat önce`;

  const gun = Math.floor(sa / 24);
  return gun === 1 ? 'dün' : `${gun} gün önce`;
}
