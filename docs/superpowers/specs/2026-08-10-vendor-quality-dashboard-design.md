# Vendor Quality Dashboard — Design Spec

**Date:** 2026-08-10
**Status:** Approved by user, pending implementation plan
**Project:** SOP-driven quality analytics for Royal Enfield plating/heat-treatment vendors, first vendor: Unique Platers (barrel zinc-iron plating with trivalent passivation)

## 1. Goal

A vendor uploads their SOP (process limits). The app turns that into a structured set of parameters with min/max limits. The vendor then uploads real-time shop-floor load reports; the app scores each reading against the SOP limits and surfaces analytics so the vendor can see where their process is drifting or failing and take corrective action.

Built fresh, independent of the earlier Cursor-built prototype at `Vendor Quality/re-vendor-quality` (explicitly discarded). Local-first for now; designed for a clean move to `leadership-fractal.com` later.

## 2. Source data (already provided, drives the schema)

- **SOP:** `Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx` — single sheet "Process Chart", header at row 4, 41 process steps (rows 5–108, some split into sub-rows e.g. 20A/20B). Limits live as free text across `Specification Limits`, `Control Limits`, and `Impurities` columns, in inconsistent formats (`50–70°C`, `89 Sec`, `Zn 8–15 gm/lit`, dual limits combined via `/`). No clean numeric schema exists in the source file.
- **Load report:** `Clients/Unique Platers/Uploads/OK LoadReport_2025-08-18_003 (1) - Copy.xls` — legacy `.xls`, 5 sheets. `LoadReport` sheet is primary: metadata block (rows 1–14: load no., in/out time, part, weight) + station table (header row 16, units row 17, 23 station records rows 18–40, `END OF REPORT` sentinel at row 41). Only Temperature, Dip Time, and (for 2 of 23 stations) Act. Current are populated — concentration/pH/specific gravity are lab/manual checks and never appear here. `Alarm`, `Event`, `Data` (high-frequency current), and `GraphPlot` sheets exist but are out of MVP scope (see §8).
- **Station naming mismatch:** SOP `Station No` and load-report `Station No` are two independent numbering schemes and do not align. Station *names* are close but not identical (e.g. SOP "Hot Water Rinsing" vs. load-report "Hot Water Rinse", SOP "Anodic Cleaning" vs. "Alkaline Anodic Cleaning"). Matching must be alias-based, not exact/ID-based.

## 3. Scope decisions

| Decision | Choice |
|---|---|
| MVP scope | Built specifically around Unique Platers' chrome/zinc plating process, not a generalized multi-process parser |
| SOP parsing | Regex-first extraction pre-fills an editable review screen; nothing scores real data until a human confirms (Option A of 3 considered — see §6) |
| Analytics scope | Both automated (load-report) fields AND manually-logged lab-check fields (concentration, pH, specific gravity) |
| Tech stack | Next.js (App Router, TypeScript) + SQLite (`better-sqlite3`) + Auth.js credentials login — same shape as the discarded prototype, rebuilt clean |
| User roles | Vendor login (own data only) + admin login (Leadership Fractal, can see/manage all vendors) |
| Multi-vendor | Data model is vendor-scoped from day one, even though only one vendor exists today |
| Load-report scope | Only the `LoadReport` sheet (23 station records: Temp/Dip Time/Current). Alarm/Event/Data sheets deferred (§8) |
| Upload flow | Manual upload via web form, single file at a time |
| Manual check timing | Independent timeline (own timestamp, not tied to a specific load) — matches how the SOP actually schedules lab checks (by frequency/shift, not by load) |
| Dashboard layout | KPI strip (fixed) + tabbed sections below, not a single scrolling page |
| Analytics widgets | Trend/drift charts, station/parameter hotspot ranking, load-to-load comparison, process capability/consistency score — all four, one per tab |

## 4. Data model

| Table | Purpose |
|---|---|
| `users` | login, role (`admin` \| `vendor`), linked to a vendor for vendor-role users |
| `vendors` | one row today (Unique Platers), ready for more later |
| `sop_documents` | one row per uploaded SOP file; status `draft` → `active` → `superseded`; only one `active` per vendor+process at a time |
| `sop_parameters` | parsed/reviewed rows: station name, parameter name, min, max, unit, raw source text (kept for traceability), linked to `sop_documents` |
| `station_aliases` | maps a load-report `Station Name` string → an `sop_parameters` station, confirmed during SOP review, reused on every future upload for that vendor |
| `load_reports` | one row per uploaded load report: load no., part, weight, in/out time, uploader; raw file kept on disk, DB indexes it |
| `load_readings` | one row per station-parameter reading in a load, linked to the `sop_parameters` row it was scored against (nullable — unmatched stations still get a row, just unscored, flagged "no SOP mapping"), with computed pass/fail |
| `manual_checks` | independent timeline: timestamp, `sop_parameters` reference, value, entered-by, computed pass/fail |
| `dashboard_prefs` | saved filter/widget config per user |

Uploaded files live on disk under `Clients/<vendor>/SOP/` and `Clients/<vendor>/Uploads/` (matching the layout already in use); the DB indexes them, it doesn't store file contents.

## 5. SOP parsing → review → activation pipeline

1. **Upload** — SOP `.xlsx` uploaded (admin or vendor). Stored as `sop_documents` row, status `draft`.
2. **Regex extraction** — parser skips to the real header row (row 4), walks all 41 process steps, and runs pattern matchers against Specification/Control Limits/Impurities text for: `N–N unit`, `N unit minimum`, `X N–N unit` (chemical-symbol-prefixed), and `/`-combined dual-limit cells. Each match becomes a draft `sop_parameters` row (station, parameter, min, max, unit, raw source text retained). Anything not confidently parsed is still inserted with blanks + raw text, flagged `needs review` — never silently dropped.
3. **Review screen** — editable table of every draft parameter: fix min/max/unit, split/merge rows, discard non-numeric rows (e.g. "Approved Transporter"). Also where `station_aliases` get set — pre-seeded with the known SOP↔load-report name pairs found during inspection, editable/extendable.
4. **Activate** — reviewer confirms. `sop_documents` flips to `active`; any prior active SOP for that vendor+process flips to `superseded`. Only `active` SOP parameters are ever used to score real data.

## 6. Load report parsing → scoring

1. **Upload** — vendor uploads `.xls`. Parser reads the metadata block (handling the Excel serial-date vs. duration-fraction distinction — `Load In/Out Time` are absolute datetimes, `Total Time`/`Dip Time` are durations), then the station table starting at row 16 (skipping the units sub-row at 17), stopping at `END OF REPORT`.
2. **Match** — each station row's `Station Name` looked up in `station_aliases` for the vendor's active SOP. Matched → each populated field (Temperature, Dip Time, Act. Current) becomes a `load_readings` row scored against that parameter's min/max. Unmatched → still stored, marked "no SOP mapping" in the UI (visible, not lost) so the alias table can be extended.
3. **Duplicate guard** — a load number that already exists for the vendor is rejected with a message pointing at the existing record.

**SOP parsing option considered and chosen:** Option A (regex-first, deterministic, offline, backed by mandatory human review) was chosen over Option B (LLM-assisted extraction — more robust to novel phrasing but adds an external API dependency, cost, and non-determinism, at odds with "local for now") and Option C (no auto-parse, fully manual entry — wastes the effort of having a real SOP file). Regex only needs to get close; the review step is the safety net.

## 7. Manual check entry

A form scoped to the vendor's active SOP: pick a parameter (the ones with no load-report source — concentration, pH, specific gravity, etc.), enter a value, timestamp defaults to now. Saved to `manual_checks`, scored against the same `sop_parameters` limit, shown on the dashboard on its own timeline alongside load-report readings for the same parameter.

## 8. Dashboard

**Fixed top strip (all tabs):** KPI cards — pass rate, loads in range, out-of-limit count — plus filters (date range, parameter, result: all/pass/fail).

**Tabs:**
- **Table** — merged automated + manual readings, sortable, out-of-limit rows visually flagged (red-tinted row, not just a badge), unmapped stations badged separately. Click a load number → full station-by-station drill-in (all 23 stations, matched or not).
- **Trends** — parameter picker + line chart across loads in range, SOP min/max drawn as a shaded band, out-of-band points marked. Defaults to worst-performing parameter.
- **Hotspots** — two ranked lists over the filtered range: stations by fail count, parameters by fail count.
- **Compare** — pick two loads, station readings side by side, differences highlighted.
- **Capability** — per parameter, distance-from-limit view (Cpk-style): surfaces stations that technically pass but run close to the edge, not just pass/fail.

All tabs read the same filtered dataset (`load_readings` + `manual_checks` joined against `sop_parameters`) — switching tabs is a different lens on the same numbers, filter state persists across tabs.

Two dashboard scopes: vendor users see only their own vendor; admin can switch vendors via a picker (today, just Unique Platers).

**Deferred (not MVP):** Alarm/Event log ingestion, high-frequency `Data` sheet (5-second current time series), `GraphPlot` sheet. Add later as a drill-down once the core loop (SOP → limits → load report → scored analytics) is proven.

## 9. Visual design system

Source: `design-spec.md` (already in the project root), reused as-is:

- **Palette:** navy primary (`#1B2A4A`) for header/hero/footer structure, red accent (`#BF1E2E`) for CTAs/active states only (never large fills), white/light-gray alternating section bands.
- **Type:** Share Tech (uppercase, tracked) for headings, Mulish for body.
- **Layout:** ~1080px max content width, two-tier header (navy utility bar + white sticky nav), sharp-cornered flat components (no border radius, no heavy shadows), red vertical accent bar before section titles.
- **Sitemap** (reconciled with the functional design above):
  - `/` — dashboard (KPI strip + Table/Trends/Hotspots/Compare/Capability tabs)
  - `/sops`, `/sops/new`, `/sops/[id]` — SOP library, upload+parse+review flow, SOP detail
  - `/loads/new` — load report upload
  - `/inspections`, `/inspections/new` — manual check log and entry form

## 10. Error handling

- Parser can't recognize file structure (wrong sheet layout, corrupted file) → upload rejected with a specific message, nothing partially committed.
- Load-report upload attempted with no active SOP → blocked with a prompt to finish SOP review first.
- Unmatched station → never dropped silently, stored and flagged.
- Duplicate load number → rejected, points at existing record.
- Draft SOP edits never affect already-scored historical readings; re-scoring only applies to new uploads against whatever SOP is active at upload time (keeps history honest even if limits are corrected later).

## 11. Testing

- **Parser unit tests** using the two real files provided as fixtures — golden-output tests asserting exact parameter/limit extraction and the exact 23 station readings, so regex changes can't silently break real-data parsing.
- **Scoring engine unit tests** — known limits + readings, assert pass/fail boundaries including inclusive/exclusive edges (e.g. exactly 70 gm/lit).
- **Manual browser smoke test** — log in as vendor, upload the real SOP, review/activate it, upload the real load report, confirm the dashboard shows the expected pass/fail split across all five tabs.
