import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Royal Enfield Vendor Quality",
  description:
    "SOP-driven quality analytics for Royal Enfield plating and heat treatment vendors.",
  applicationName: "RE Quality",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RE Quality",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/brand/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/pwa-icon-192.png", sizes: "192x192" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1B2A4A",
};

// suppressHydrationWarning on <html> silences the expected data-theme mismatch:
// SSR emits no attribute, the inline script sets it before React hydrates.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
