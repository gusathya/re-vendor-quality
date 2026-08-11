'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/sops', label: 'SOPs' },
  { href: '/loads/new', label: 'Upload Load' },
  { href: '/inspections', label: 'Inspections' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const { data: session } = useSession();

  return (
    <>
      <header style={{
        background: 'linear-gradient(135deg, var(--color-navy-deep) 0%, var(--color-navy-primary) 100%)',
        color: 'white',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        height: 60,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: '50%',
            background: 'var(--color-red-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Share Tech, monospace',
            fontWeight: 700, fontSize: 14, color: 'white',
            flexShrink: 0,
          }}>RE</div>
          <div>
            <div style={{ fontFamily: 'Share Tech, monospace', fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>
              Royal Enfield
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Vendor Quality Dashboard
            </div>
          </div>
        </div>
      </header>

      {!isLoginPage && (
        <nav style={{
          background: 'white',
          borderBottom: '1px solid var(--color-card-border)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          height: 46,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--color-navy-primary)' : 'var(--color-nav-link)',
                  background: isActive ? '#eff6ff' : 'transparent',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid var(--color-navy-primary)' : '2px solid transparent',
                  transition: 'all 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Link>
            );
          })}
          {session?.user && (
            <div style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 12,
              borderLeft: '1px solid var(--color-card-border)',
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-heading)', lineHeight: 1.2 }}>
                  {session.user.email}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {(session.user as { role?: string }).role ?? 'user'}
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-card-border)',
                  borderRadius: 6,
                  padding: '5px 14px',
                  fontSize: 12,
                  color: 'var(--color-text-body)',
                  cursor: 'pointer',
                  textTransform: 'none',
                  fontFamily: 'inherit',
                  letterSpacing: 0,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </nav>
      )}

      {children}

      <footer style={{
        borderTop: '3px solid var(--color-navy-primary)',
        padding: '14px 24px',
        marginTop: 40,
        fontSize: 11,
        color: '#9ca3af',
        background: 'white',
        textAlign: 'center',
        letterSpacing: '0.03em',
      }}>
        Royal Enfield Vendor Quality Dashboard &mdash; Powered by Leadership Fractal
      </footer>
    </>
  );
}
