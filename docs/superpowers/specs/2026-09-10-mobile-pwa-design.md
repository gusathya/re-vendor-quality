# Mobile + PWA Design — Royal Enfield Vendor Quality

**Date:** 2026-09-10  
**Status:** Approved  
**Approach:** Responsive shell + lightweight PWA (install / home screen; online data)

## Goals & scope

**In**
- Phone-usable dashboard / analytics and SOP browsing (desk review priority)
- Bottom tab navigation on small screens
- PWA install to home screen (`display: standalone`)
- Online-only data (no offline SOP/batch cache)

**Out (v1)**
- Offline data / sync
- App Store / Play Store native builds
- Desktop visual redesign
- Deep floor-ops mobile polish (upload / log check remain reachable)

## Navigation & layout

- Breakpoint: **768px**
- **Phone:** bottom tab bar from the signed-in role’s primary destinations (up to four)
  - Vendor: Dashboard · My Batches · SOPs · Monthly Report
  - Customer: Batch Review · SOPs · Analytics
  - Admin: Admin Dashboard · RE Portal · SOPs · Upload Batch (Settings in overflow)
- Secondary actions (extra links, Sign out, Install) in a compact header overflow menu
- **Desktop:** existing top nav unchanged; no bottom bar
- Single-column content stack; tables keep `.table-wrap` horizontal scroll
- KPI / form grids collapse to one column on phone

## PWA install

- Web app manifest (name, icons 192/512, theme navy `#1B2A4A`, background white, `standalone`)
- Service worker caches **app shell only**; API and live data require network
- Optional “Install app” control when `beforeinstallprompt` fires (Chromium); iOS uses Share → Add to Home Screen
- Works on HTTPS and localhost

## Architecture

| Area | Change |
|---|---|
| `AppShell` | Bottom tabs + header overflow on phone; hide desktop nav under breakpoint |
| `globals.css` | Safe-area insets, bottom bar clearance, stacked grids |
| PWA | `src/app/manifest.ts`, icons under `public/brand/`, `public/sw.js`, client registration |
| Auth / DB | Unchanged |

## Success checks

- ~375px: login, dashboard, SOP list/detail usable without full-page horizontal scroll
- Bottom tabs on phone; desktop top nav preserved
- Installable on Chromium; iOS Add to Home Screen opens standalone
- Offline: shell may load; data actions need network
- Demo logins and desktop layout remain working
