'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Admin'in müşteri çalışma alanı sekmeleri.
 * Hedef kullanıcı URL'de taşınır (gizli oturum durumu yok): adres çubuğuna
 * bakan admin kimin adına çalıştığını her zaman görür.
 */
export default function CustomerTabNav({ userId }: { userId: number }) {
  const pathname = usePathname();
  const base = `/dashboard/users/${userId}`;

  const tabs = [
    { href: base, label: 'Araçlar' },
    { href: `${base}/soforler`, label: 'Şoförler' },
    { href: `${base}/atamalar`, label: 'Şoför-Araç Tanımlama' },
  ];

  return (
    <nav className="flex gap-1 border-b border-zinc-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
