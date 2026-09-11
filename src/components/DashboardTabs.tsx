'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Table' },
  { href: '/trends', label: 'Trends' },
  { href: '/hotspots', label: 'Hotspots' },
  { href: '/compare', label: 'Compare' },
  { href: '/capability', label: 'Capability' },
];

export function DashboardTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <nav className="tab-row" style={{ borderBottom: '2px solid var(--color-navy-primary)', gap: 16 }}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={query ? `${tab.href}?${query}` : tab.href}
          style={{ fontWeight: pathname === tab.href ? 700 : 400, padding: '8px 4px' }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
