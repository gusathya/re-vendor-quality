import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = { title: 'Royal Enfield Vendor Quality' };

// suppressHydrationWarning on <html> silences the expected data-theme mismatch:
// SSR emits no attribute, the inline script sets it before React hydrates.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)})();`,
        }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
