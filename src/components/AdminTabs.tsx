'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'failures',  label: 'Failure Map' },
  { key: 'timeline',  label: 'Timeline' },
  { key: 'vendors',   label: 'Vendors' },
];

export function AdminTabs() {
  const searchParams = useSearchParams();
  const active = searchParams.get('tab') ?? 'overview';

  return (
    <nav className="tab-row" style={{ borderBottom: '2px solid var(--color-red-accent)', marginBottom: 24 }}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/admin?tab=${tab.key}`}
            className={isActive ? 'active' : undefined}
            style={{
              padding: '8px 18px',
              fontSize: 12,
              fontFamily: 'Share Tech, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--color-red-accent)' : 'var(--color-nav-link)',
              background: isActive ? '#fff1f2' : 'transparent',
              borderBottom: isActive ? '2px solid var(--color-red-accent)' : '2px solid transparent',
              marginBottom: -2,
              textDecoration: 'none',
              borderRadius: '6px 6px 0 0',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
