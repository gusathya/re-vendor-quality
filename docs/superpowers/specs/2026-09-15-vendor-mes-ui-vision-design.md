# Vendor MES — UI vision (Administration + shell)

Date: 2026-09-15  
Repo: `re-vendor-quality` (sandbox branch; grow this Next.js app)  
Status: draft for review  
Sources: paint-line Administration contract (`2026-09-14-administration-page-design.md`), `vendor-app-spec.md` (MES features, minus OEM), this brainstorm  

This spec locks the **product** and the **first build: UI-UX vision**. Postgres, real tenancy, and working ERP modules come in later specs.

---

## Intent

Exceedoo builds a **hosted Manufacturing Execution System** for small and mid-size vendors in six specializations. Royal Enfield may **recommend** the product. RE **cannot log in** and cannot see vendor data.

The first build is a **clickable UI** so the vision is visible: Exceedoo navy/red shell, Administration (companies + people), and empty frames for the other modules. Data on screen is mock. No PostgreSQL cutover in this slice.

---

## Locked product (later builds honour this)

| Knob | Decision |
|---|---|
| Who runs it day to day | Vendor shop floor only |
| RE | Recommend only. No login, no portal, no compare-vendors, no criticality/relationship-owner/OEM watchlist |
| Tenancy | Hosted: many companies in one install. Isolated by `company_id`. Companies cannot see each other |
| Platform root | Seeded user. Types company + specialization; **Save = live** (no pending queue). Then creates that company’s people. Cannot be removed; login cannot be renamed |
| Company identity | Name + **one** specialization enum (six values below) |
| People | Name, login, email, password, company. **Permission ticks** (any mix): Production, Planning, Purchase, Inventory, Dispatch, Reports, Administration |
| Company admin | Has Administration tick. Manages **only** that company’s people |
| Passwords | Hashed (keep current bcrypt). People table does **not** show plaintext. Empty password on edit = keep existing |
| Database (later) | PostgreSQL. Not SQLite. `company_id` on every row |
| System of record | This app owns parts, customer orders, POs, stock, dispatch (no other ERP in v1) |
| Execution unit | One **serialized part**. Steps **depend on specialization** |
| SOP | One SOP per **part number**; every serial of that part opens it. Contents = **routing + process parameters + QC** from the category template |
| Drawings (later) | On the part number, version history; operator opens SOP + drawing |
| Category templates | From `vendor-app-spec.md` (Casting, Forging, Sheet Metal, Electrical Proprietary, Mechanical Proprietary, Non-Metallic). Seventh category = config, not code |
| Full MES (later) | Production, Planning, Purchase, Inventory, Dispatch, Order management, Reports — as in that markdown, scoped to **one company**, not cross-vendor scorecards |

### Specializations

`casting_machining`, `electrical_proprietary`, `forging_machining`, `mechanical_proprietary`, `non_metallic`, `sheet_metal_fabrication`  
Labels: Casting & Machining, Electrical Proprietary, Forging & Machining, Mechanical Proprietary, Non-Metallic, Sheet Metal & Fabrication.

---

## This slice — UI vision

**In**

- Keep **Exceedoo navy / red** tokens, Mulish, Share Tech, existing cards, compact buttons, mobile bottom tabs. Do not port paint-line gold/dark. Do not treat the palette as Royal Enfield chrome.
- Replace `/admin` analytics (KPI strip, failure map, timeline, vendor cards) with **Administration**.
- App shell nav for MES modules. Hide RE Portal / customer analytics. **This slice shows every MES item** so the IA is clickable; hiding nav by permission ticks is later.
- Administration: two stacked cards, quiet page — **Companies** then **People**. No KPI chips, no helper paragraphs.
- Placeholder routes for Production, Planning, Purchase, Inventory, Dispatch, Reports — title + short “coming next” body so the IA is real.
- Mock companies and people in the client (or a local fixture). Create/edit/remove update the mock list only.
- Phone and laptop: existing responsive shell (page padding, bottom tabs, overflow menu).

**Out of this slice**

- PostgreSQL, Prisma/Drizzle, `company_id` enforcement
- Real auth permission matrix (can still sign in as today’s `admin@lf` to see the UI)
- Apply/pending company workflow
- Serials, SOP engine, drawings, planning, purchase, stock, dispatch, orders, OEE/quality/delivery ledgers
- Paint-line plaintext password column
- OEM scorecard / category comparison / risk watchlist

---

## Visual language (this slice)

Keep current `globals.css` tokens:

- Navy `#1B2A4A` / `#14213D`
- Red accent `#BF1E2E`
- Page `#f1f5f9`, cards white, hairline `#e5e7eb`
- Compact primary ~36px height, 8px radius, hug label (paint-line *size*, Exceedoo *colour*)
- Permission ticks: pill chips. Idle = navy outline; selected = navy fill, white type (gold language from paint-line is **not** used)
- Page `h1`: **Administration**, existing Share Tech + red accent bar. No subtitle.

Header signed-in email and muted role/permission text stay in the shared header. Do not restyle them as chips.

---

## Shell

Replace role-based vendor/customer/admin link sets with MES destinations:

| Nav | Route | This slice |
|---|---|---|
| Administration | `/admin` | Full UI, mock data |
| Production | `/production` | Placeholder |
| Planning | `/planning` | Placeholder |
| Purchase | `/purchase` | Placeholder |
| Inventory | `/inventory` | Placeholder |
| Dispatch | `/dispatch` | Placeholder |
| Reports | `/reports` | Placeholder |

Phone: up to four primary tabs (Administration, Production, Planning, Reports); the rest in header overflow — same pattern as today’s mobile shell.

Remove from nav: RE Portal, customer Batch Review, “← Vendor View”, Settings-as-vendor-classification (Settings can wait). Login page stays; demo `admin@lf` is enough to open the vision.

---

## Administration layout

Route: `/admin`. Max width ~960px (page `.section` may stay 1120px; cards themselves cap ~960). Horizontal padding from `.section`. Two cards only.

### Card 1 — Companies

Heading **Companies**. Form then table.

| Field | Behaviour |
|---|---|
| Name | Required |
| Specialization | Required. One of the six labels |
| Save | Hug compact primary. Success: dim 12px **Saved** next to the button. Row appears in the table immediately (live, no pending) |

Table columns: Name, Specialization, People count, Edit. No Remove in this slice (avoid orphaning mock people). Edit loads the row into the form; button becomes **Save company**.

### Card 2 — People

Heading **People**. Four fields + chip row + primary action — paint-line structure, Exceedoo styling.

| Field | Add | Edit |
|---|---|---|
| Name | Required | Required |
| Login | Required; lowercase alphanumeric | Editable except seeded platform root (`admin`) |
| Email | Optional; blank → `{login}@lf` | Same default if cleared |
| Password | Default `{login}123` until the user types in the box | Placeholder “leave blank to keep”; never show stored secret |
| Company | Required select of mock companies | Same; seeded root has no company (platform) |
| Permissions | Ticks; at least one required. Seeded root implied all / not edited | Same. Root row: ticks read-only |

Primary: **Add** vs **Save person**. Compact hug. Failure: short danger text beside the button.

Table: Name, Login, Email, Company, permission pills, Edit, Remove. Remove hidden on seeded root. Sort by login. Scroll well max-height ~420px.

Permission chips are **not** exclusive (unlike paint-line `root`). Any mix allowed.

---

## Mock fixture (this slice)

- Seeded root: name Admin, login `admin`, email `admin@lf`, no company, all capabilities, no Remove.
- Two companies: e.g. Unique Platers / Casting & Machining; a sheet-metal shop / Sheet Metal & Fabrication.
- Two company people with different tick mixes so the table and nav feel real.

---

## Files (expected)

| File | Role |
|---|---|
| `src/app/admin/page.tsx` | Replace analytics with Administration (client island for mock CRUD) |
| `src/components/AppShell.tsx` | MES nav; drop RE Portal / customer analytics |
| `src/components/AdminTabs.tsx` | Stop importing; leave file unused this slice |
| `src/app/production/page.tsx` (and planning, purchase, inventory, dispatch, reports) | Placeholder frames |
| `src/lib/mes-mock.ts` | Fixture + in-memory CRUD for the vision |
| `src/app/globals.css` | Chip/table extras only if existing classes are not enough | |

Do not add PostgreSQL or rewrite `users` hashing in this slice.

---

## Checks (UI vision)

- Signed in as `admin@lf`: `/admin` shows **Companies** and **People** only. No KPI strip, no helper sentence under People, no RE Portal in the header nav.
- Adding a company updates the table and the People company dropdown with no refresh.
- Adding a person with ticks shows navy permission pills in the table.
- Seeded `admin` has no Remove; login field disabled.
- Password column absent.
- Production/Planning/etc. routes render a titled placeholder.
- Phone: bottom tabs still work; Administration is reachable.
- Visual tokens remain Exceedoo navy/red.

---

## Next (not this slice)

1. PostgreSQL + `company_id` + real people APIs (hash passwords, root gate).
2. Production: part number, SOP from category template, serial, drawing on the part.
3. Remaining markdown modules, single-company only.
