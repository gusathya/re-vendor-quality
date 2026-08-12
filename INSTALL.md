# Installation Guide — Vendor Quality Dashboard

A Next.js application for tracking Royal Enfield vendor quality via SOP-based plating and heat-treatment load reports.

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Node.js | 20.x LTS | [nodejs.org/en/download](https://nodejs.org/en/download) |
| npm | 10.x (ships with Node 20) | Or use pnpm / yarn / bun |
| Git | any | |

> **Windows note:** `better-sqlite3` includes a native binary. Node 20 ships a compatible one for Windows x64 in the package (`@node/node-gyp` is not required unless you change Node versions).

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/gusathya/re-vendor-quality
cd VQ_Claude
```

---

## Step 2 — Install dependencies

```bash
npm install
```

This installs Next.js 16, React 19, better-sqlite3, NextAuth v5, Recharts, and all dev dependencies.

---

## Step 3 — Create the environment file

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```env
# Required — any long random string (min 32 chars recommended)
# Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=replace-with-a-long-random-string

# Path to the SQLite database file (created automatically on first run)
DATABASE_PATH=./data/vendor-quality.sqlite
```

To generate a strong secret in one command:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4 — Seed the database

The database file and schema are created automatically. Run the seed script to create initial vendor, categories, and user accounts:

```bash
npm run seed
```

This creates the following accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@leadership-fractal.local` | `Admin@123` |
| Vendor | `vendor@unique-platers.local` | `Vendor@123` |
| Customer | `customer@royalenfield.local` | `Customer@123` |

> The seed script is idempotent — safe to run multiple times without duplicating data.

---

## Step 5 (optional) — Load synthetic demo data

To populate the dashboard with 24 sample vendors across 6 commodity categories and realistic load reports:

```bash
npm run seed:synthetic
```

Skip this step if you intend to enter real data from scratch.

---

## Step 6 — Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You will be redirected to the login page. Use any of the accounts from Step 4.

---

## Production build

```bash
npm run build
npm start
```

The app binds to port 3000 by default. Set the `PORT` environment variable to change it.

---

## Running tests

```bash
npm test
```

Tests use Vitest. To run in watch mode:

```bash
npm run test:watch
```

---

## Project structure (quick reference)

```
src/
  app/           Next.js App Router pages and API routes
  components/    Shared React components
  lib/
    db/          SQLite client, schema, and query helpers
    parsers/     Excel load-report and SOP parsers
  types/         TypeScript augmentations (NextAuth session)
scripts/
  seed.ts        Baseline seed (vendor + users)
  synthetic-data.ts  Demo data seed
data/            SQLite database file (auto-created, git-ignored)
```

---

## Roles and access

| Role | Can do |
|------|--------|
| **Admin** | Cross-vendor analytics, approve/reject load reports, manage SOPs |
| **Vendor** | Upload load reports, manage own SOPs, view own dashboard |
| **Customer** | Read-only view of approved load reports |

---

## Troubleshooting

**`better-sqlite3` build error on Windows**
Run `npm install --ignore-scripts` then `npm rebuild better-sqlite3`. If that fails, ensure Visual Studio C++ Build Tools are installed (or use the prebuilt binary by installing Node 20 exactly).

**`AUTH_SECRET` missing error**
Next.js will throw at startup if `AUTH_SECRET` is not set in `.env.local`. Make sure the file exists and the variable is not empty.

**Database locked / SQLITE_BUSY**
Only one Node process should access the SQLite file at a time. Stop any running `npm run dev` or `npm start` before running `npm run seed`.

**Port 3000 already in use**
```bash
PORT=3001 npm run dev
```
