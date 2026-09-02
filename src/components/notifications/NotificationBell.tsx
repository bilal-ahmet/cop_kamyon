'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const POLL_MS = 60_000;

/**
 * Başlıktaki zil: okunmamış bildirim sayısını gösterir ve bildirim sayfasına götürür.
 *
 * Sayaç, sunucudan gelen `initialCount` ile başlar (ilk boyamada rozet doğru görünür),
 * sonra kendi başına yoklar. Yoklama başarısız olursa sayaç son bilinen değerde kalır —
 * bağlantı uyarısı OfflineBanner'ın işi, zil sessizce eskimiş değeri gösterir.
 */
export default function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [sonSunucuSayisi, setSonSunucuSayisi] = useState(initialCount);
  const pathname = usePathname();

  // Sunucudan yeni bir sayı geldiğinde (ör. "tümünü okundu işaretle" sonrası router.refresh)
  // rozeti hemen ona eşitle. Bu, prop değişimini render sırasında yakalamanın React'in
  // önerdiği yolu — effect içinde setState çağırmak gereksiz bir tur render'a yol açardı.
  if (sonSunucuSayisi !== initialCount) {
    setSonSunucuSayisi(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    let iptal = false;

    const oku = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!iptal) setCount(Number(data?.count) || 0);
      } catch {
        // Ağ yok — son bilinen sayı korunur.
      }
    };

    const id = setInterval(oku, POLL_MS);
    oku();
    return () => {
      iptal = true;
      clearInterval(id);
    };
    // Sayfa değişince hemen tazelensin (ör. "tümünü okundu işaretle" sonrası).
  }, [pathname]);

  return (
    <Link
      href="/dashboard/bildirimler"
      aria-label={count > 0 ? `Bildirimler (${count} okunmamış)` : 'Bildirimler'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
