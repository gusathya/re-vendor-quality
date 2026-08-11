'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Outer page chrome (header/nav/footer) applied to EVERY route via src/app/layout.tsx.
// Distinct from DashboardShell (Task 21), which only wraps the 5 dashboard tab pages with
// the KPI strip + tab nav. Nesting is: AppShell > DashboardShell > tab content.
//
// The nav links are hidden on /login: middleware (src/middleware.ts) redirects any
// unauthenticated request for every other route back to /login, so showing "Dashboard /
// SOPs / Upload Load / Inspections" links before sign-in would just bounce the user right
// back where they started. The header/footer branding still renders on /login for a
// consistent look; only the (currently non-functional, pre-auth) nav row is suppressed.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <>
      <header style={{ background: 'var(--color-navy-primary)', color: 'var(--color-white)', padding: '8px 16px' }}>
        Royal Enfield Vendor Quality
      </header>
      {!isLoginPage && (
        <nav style={{ background: 'var(--color-white)', borderBottom: '1px solid #ddd', padding: '8px 16px', display: 'flex', gap: 16 }}>
          <Link href="/">Dashboard</Link>
          <Link href="/sops">SOPs</Link>
          <Link href="/loads/new">Upload Load</Link>
          <Link href="/inspections">Inspections</Link>
        </nav>
      )}
      {children}
      <footer style={{ borderTop: '2px solid var(--color-navy-primary)', padding: '16px', marginTop: 32, fontSize: 12 }}>
        Royal Enfield Vendor Quality — local build
      </footer>
    </>
  );
}
