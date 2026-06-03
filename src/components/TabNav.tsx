'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TabNav({ vehicleId }: { vehicleId: number }) {
  const pathname = usePathname();
  const base = `/dashboard/${vehicleId}`;

  const tabs = [
    { href: base, label: 'Konum' },
    { href: `${base}/duraklar`, label: 'Duraklar' },
    { href: `${base}/raporlar`, label: 'Raporlar' },
    { href: `${base}/telemetri`, label: 'Telemetri' },
    { href: `${base}/sensorler`, label: 'Sensörler' },
    { href: `${base}/lokasyonlar`, label: 'Lokasyonlar' },
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
