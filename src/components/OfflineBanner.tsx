'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Bağlantı varken güvenlik amaçlı seyrek doğrulama (olay kaçarsa yakalar). */
const ONLINE_CHECK_MS = 120_000;

/** Bağlantı yokken dönüşü hızlı fark etmek için sık kontrol. */
const OFFLINE_CHECK_MS = 15_000;

/** Şeritteki süre sayacının tazelenme aralığı. */
const TICK_MS = 30_000;

/** Bağlantı yokken uyarının tekrarlanma aralığı — istenen davranış: 5 dakikada bir. */
const REALERT_MS = 5 * 60_000;

/** Tek bir hatayı kesinti sanmamak için gereken üst üste başarısız kontrol sayısı. */
const FAILURE_LIMIT = 2;

type Durum = {
  offline: boolean;
  /** Kesintinin başlangıcı (ms). Bağlantı varken null. */
  since: number | null;
  /** Kaçıncı uyarı — 5 dakikada bir artar. */
  alerts: number;
  /** Kesintinin süresi (dakika); sayaç tarafından güncellenir, render sırasında hesaplanmaz. */
  dakika: number;
};

const BAGLI: Durum = { offline: false, since: null, alerts: 1, dakika: 0 };

/**
 * Panelin KENDİ internet bağlantısı kesildiğinde uyarı şeridi.
 *
 * Araçtan veri gelmemesi backend'de işlenir ve kalıcı bildirime dönüşür; ama kullanıcının
 * kendi bağlantısı koptuğunda backend'e ulaşılamadığı için bunu yalnızca tarayıcı bilebilir.
 * Bu yüzden buradaki uyarı yereldir: veritabanına yazılmaz, sekme kapanınca kaybolur.
 *
 * `navigator.onLine` tek başına güvenilmez (Wi-Fi'ye bağlı ama internet yok durumunu
 * kaçırır), bu yüzden karar gerçek bir isteğin sonucuna göre verilir.
 */
export default function OfflineBanner() {
  const [durum, setDurum] = useState<Durum>(BAGLI);
  // Geçişi (bağlı ↔ kopuk) state'i okumadan bilmek için: kontrol fonksiyonu her
  // interval'de yeniden kurulmasın diye bağımlılık listesinde state tutmuyoruz.
  const offlineRef = useRef(false);
  const failures = useRef(0);
  const router = useRouter();

  const kopukIsaretle = useCallback(() => {
    failures.current = FAILURE_LIMIT;
    if (offlineRef.current) return;
    offlineRef.current = true;
    setDurum({ offline: true, since: Date.now(), alerts: 1, dakika: 0 });
  }, []);

  const bagliIsaretle = useCallback(() => {
    failures.current = 0;
    if (!offlineRef.current) return;
    offlineRef.current = false;
    setDurum(BAGLI);
    router.refresh(); // kesinti boyunca eskiyen sunucu bileşenleri yenilensin
  }, [router]);

  const kontrolEt = useCallback(async () => {
    // Tarayıcı "bağlantı yok" diyorsa istek atmaya gerek yok; bu yön güvenilirdir.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      kopukIsaretle();
      return;
    }

    try {
      const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
      // 502 = sunucumuz backend'e ulaşamadı; 401 oturum sorunudur, bağlantı sorunu değil.
      if (res.status === 502) throw new Error('backend');
      bagliIsaretle();
    } catch {
      failures.current += 1;
      if (failures.current >= FAILURE_LIMIT) kopukIsaretle();
    }
  }, [kopukIsaretle, bagliIsaretle]);

  // Tarayıcı olayları: anında tepki verir, istek harcamaz.
  useEffect(() => {
    const cevrimici = () => {
      failures.current = 0;
      kontrolEt();
    };
    window.addEventListener('offline', kopukIsaretle);
    window.addEventListener('online', cevrimici);
    return () => {
      window.removeEventListener('offline', kopukIsaretle);
      window.removeEventListener('online', cevrimici);
    };
  }, [kontrolEt, kopukIsaretle]);

  // Doğrulama kontrolü — bağlantı yokken sık, varken seyrek.
  useEffect(() => {
    const id = setInterval(kontrolEt, durum.offline ? OFFLINE_CHECK_MS : ONLINE_CHECK_MS);
    return () => clearInterval(id);
  }, [kontrolEt, durum.offline]);

  // Süre sayacı + 5 dakikada bir tekrar uyarı.
  useEffect(() => {
    if (!durum.offline) return;

    const sayac = setInterval(() => {
      const simdi = Date.now();
      setDurum((d) =>
        d.since ? { ...d, dakika: Math.floor((simdi - d.since) / 60_000) } : d
      );
    }, TICK_MS);

    const uyari = setInterval(() => {
      setDurum((d) => ({ ...d, alerts: d.alerts + 1 }));
    }, REALERT_MS);

    return () => {
      clearInterval(sayac);
      clearInterval(uyari);
    };
  }, [durum.offline]);

  if (!durum.offline) return null;

  return (
    <div
      role="alert"
      // Her tekrar uyarısında key değişir: ekran okuyucular yeniden seslendirir,
      // görsel olarak da şerit kısa bir vurguyla yeniden dikkat çeker.
      key={durum.alerts}
      aria-live="assertive"
      className="animate-pulse border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 motion-reduce:animate-none"
    >
      <span className="font-medium">İnternet bağlantısı yok</span>
      {' — '}
      {durum.dakika < 1
        ? 'veriler güncellenmiyor.'
        : `${durum.dakika} dakikadır veriler güncellenmiyor.`}
      {durum.alerts > 1 && <span className="ml-1 text-amber-700">({durum.alerts}. uyarı)</span>}
    </div>
  );
}
