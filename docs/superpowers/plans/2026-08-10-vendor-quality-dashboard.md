# Vendor Quality Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Royal Enfield Vendor Quality dashboard MVP — SOP upload with limit parsing and human review, real-time load-report upload scored against those limits, manual lab-check logging, and a tabbed analytics dashboard — for the first vendor, Unique Platers.

**Architecture:** Next.js (App Router, TypeScript) with SQLite (`better-sqlite3`) for all persistence and Auth.js credentials login. Pure-function parsing/scoring/matching modules under `src/lib/` are built and unit-tested first (bottom-up), against the two real vendor files already on disk, before any UI is wired up. UI is Next.js server components + server actions reading/writing through a thin repository layer over SQLite.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `better-sqlite3`, `next-auth` (Auth.js v5, credentials provider), `bcryptjs`, `xlsx` (SheetJS, reads both `.xlsx` and legacy `.xls`), Vitest for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-08-10-vendor-quality-dashboard-design.md`
**Reference fixtures (real vendor data, on disk, gitignored):**
- `Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx`
- `Clients/Unique Platers/Uploads/OK LoadReport_2025-08-18_003 (1) - Copy.xls`

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: whole project scaffold in repo root (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `eslint.config.mjs`)

- [ ] **Step 1: Run the scaffolder**

```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --use-npm --yes
```

If it prompts anyway, answer: TypeScript = Yes, ESLint = Yes, App Router = Yes, `src/` directory = Yes, Tailwind = No, import alias = `@/*`.

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Install the remaining dependencies**

```bash
npm install better-sqlite3 next-auth@beta bcryptjs xlsx
npm install -D @types/better-sqlite3 @types/bcryptjs vitest @vitejs/plugin-react
```

- [ ] **Step 4: Add a Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

Add to `package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify test runner works with a throwaway test**

Create `src/lib/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed.

Delete `src/lib/sanity.test.ts` once confirmed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with SQLite, Auth.js, and Vitest"
```

---

## Task 2: Excel date/time conversion helpers

Both source files store times as Excel serial numbers. Absolute timestamps (`Load In Time`, `Dip in Time`, etc.) and durations (`Total Time`, `Dip Time`) need different conversions, verified against the real fixture's actual values.

**Files:**
- Create: `src/lib/parsers/excel-datetime.ts`
- Test: `src/lib/parsers/excel-datetime.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/parsers/excel-datetime.test.ts
import { describe, it, expect } from 'vitest';
import { excelSerialToDate, excelDurationToSeconds } from './excel-datetime';

describe('excelSerialToDate', () => {
  it('converts the real Load In Time serial (2025-08-18_003) to the correct UTC instant', () => {
    expect(excelSerialToDate(45887.42762731481).toISOString()).toBe('2025-08-18T10:15:47.000Z');
  });

  it('converts the real Load Out Time serial to the correct UTC instant', () => {
    expect(excelSerialToDate(45887.55673611111).toISOString()).toBe('2025-08-18T13:21:42.000Z');
  });

  it('converts a station Dip in Time serial to the correct UTC instant', () => {
    expect(excelSerialToDate(45887.487233796295).toISOString()).toBe('2025-08-18T11:41:37.000Z');
  });
});

describe('excelDurationToSeconds', () => {
  it('converts the real Total Time serial to 11155 seconds (3h05m55s)', () => {
    expect(excelDurationToSeconds(0.1291087962962963)).toBe(11155);
  });

  it('converts a short station Dip Time serial to 95 seconds', () => {
    expect(excelDurationToSeconds(0.001099537037037037)).toBe(95);
  });

  it('converts the long plating station Dip Time serial to 5776 seconds (1h36m16s)', () => {
    expect(excelDurationToSeconds(0.06685185185185186)).toBe(5776);
  });

  it('converts a zero-duration serial to 0 seconds', () => {
    expect(excelDurationToSeconds(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- excel-datetime`
Expected: FAIL — `excel-datetime.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
// src/lib/parsers/excel-datetime.ts

// Days between the Excel epoch (1899-12-30) and the Unix epoch (1970-01-01).
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

/** Converts an Excel serial date/time (as read by SheetJS with raw:true) to a UTC Date. */
export function excelSerialToDate(serial: number): Date {
  const ms = Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * 86400 * 1000);
  return new Date(ms);
}

/** Converts an Excel serial *duration* (a fraction of a day, e.g. Dip Time / Total Time) to whole seconds. */
export function excelDurationToSeconds(serial: number): number {
  return Math.round(serial * 86400);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- excel-datetime`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/excel-datetime.ts src/lib/parsers/excel-datetime.test.ts
git commit -m "Add Excel serial date/duration conversion helpers"
```

---

## Task 3: SOP control-limit text parser

This is the core of the SOP ingestion pipeline: turning the free-text `Control Limits` column into structured `{min, max, unit}`. Built and tested against the **Control Limits** column specifically (not Specification Limits) — inspection of all 61 distinct Control Limits strings in the real SOP file showed Control Limits are consistently either a clean range, a single exact value with an unambiguous unit, a `< N` cap, a chemical-prefixed range, or one of two `/`-combined dual-limit cells. Specification Limits are looser/inconsistently phrased and are kept as a reference string only (not parsed) — this is a deliberate scope decision, not an oversight.

**Files:**
- Create: `src/lib/parsers/sop-limit-parser.ts`
- Test: `src/lib/parsers/sop-limit-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/parsers/sop-limit-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseControlLimit } from './sop-limit-parser';

describe('parseControlLimit', () => {
  it('parses a plain range with a trailing unit', () => {
    expect(parseControlLimit('50 – 70°C')).toEqual({
      status: 'parsed', min: 50, max: 70, unit: '°C', prefix: null, target: null, raw: '50 – 70°C',
    });
  });

  it('parses a range with the unit repeated after both numbers', () => {
    expect(parseControlLimit('22°C – 35°C')).toEqual({
      status: 'parsed', min: 22, max: 35, unit: '°C', prefix: null, target: null, raw: '22°C – 35°C',
    });
  });

  it('parses a chemical-symbol-prefixed range', () => {
    expect(parseControlLimit('Zn 8 – 15 gm/lit')).toEqual({
      status: 'parsed', min: 8, max: 15, unit: 'gm/lit', prefix: 'Zn', target: null, raw: 'Zn 8 – 15 gm/lit',
    });
  });

  it('parses a unitless range (specific gravity)', () => {
    const result = parseControlLimit('1.010 – 1.200');
    expect(result.status).toBe('parsed');
    expect(result.min).toBeCloseTo(1.01);
    expect(result.max).toBeCloseTo(1.2);
    expect(result.unit).toBeNull();
  });

  it('parses a range with a unit containing a slash and hyphen (ml/amp-hr)', () => {
    expect(parseControlLimit('20 – 50 ml/amp-hr')).toEqual({
      status: 'parsed', min: 20, max: 50, unit: 'ml/amp-hr', prefix: null, target: null, raw: '20 – 50 ml/amp-hr',
    });
  });

  it('parses a range whose unit contains an internal slash without spaces (not a dual-limit combiner)', () => {
    expect(parseControlLimit('60 – 70 gm/lit')).toEqual({
      status: 'parsed', min: 60, max: 70, unit: 'gm/lit', prefix: null, target: null, raw: '60 – 70 gm/lit',
    });
  });

  it('parses a decimal-max range', () => {
    expect(parseControlLimit('5 – 5.2 ml/lit')).toEqual({
      status: 'parsed', min: 5, max: 5.2, unit: 'ml/lit', prefix: null, target: null, raw: '5 – 5.2 ml/lit',
    });
  });

  it('parses a period-suffixed unit range', () => {
    expect(parseControlLimit('2 – 6 Lit./min.')).toEqual({
      status: 'parsed', min: 2, max: 6, unit: 'Lit./min.', prefix: null, target: null, raw: '2 – 6 Lit./min.',
    });
  });

  it('parses a "< N" max-only limit with no unit', () => {
    expect(parseControlLimit('< 12')).toEqual({
      status: 'parsed', min: null, max: 12, unit: null, prefix: null, target: null, raw: '< 12',
    });
  });

  it('parses a single exact value with a known unit', () => {
    expect(parseControlLimit('89 Sec')).toEqual({
      status: 'parsed', min: 89, max: 89, unit: 'Sec', prefix: null, target: 89, raw: '89 Sec',
    });
  });

  it('parses a bare "N min" as an exact value in minutes, not a minimum qualifier', () => {
    expect(parseControlLimit('90 min')).toEqual({
      status: 'parsed', min: 90, max: 90, unit: 'min', prefix: null, target: 90, raw: '90 min',
    });
  });

  it('parses a "/"-combined single-target-and-range cell (Plating Thickness)', () => {
    expect(parseControlLimit('15 microns / 12 – 17 microns')).toEqual({
      status: 'parsed', min: 12, max: 17, unit: 'microns', prefix: null, target: 15, raw: '15 microns / 12 – 17 microns',
    });
  });

  it('parses a "/"-combined "N unit min / N – N unit" cell (SST White Rust)', () => {
    expect(parseControlLimit('240 Hrs min / 240 – 264 Hrs.')).toEqual({
      status: 'parsed', min: 240, max: 264, unit: 'Hrs.', prefix: null, target: 240, raw: '240 Hrs min / 240 – 264 Hrs.',
    });
  });

  it('parses a "/"-combined "N unit min / N – N unit" cell (SST Red Rust)', () => {
    expect(parseControlLimit('480 Hrs min / 480 – 504 Hrs.')).toEqual({
      status: 'parsed', min: 480, max: 504, unit: 'Hrs.', prefix: null, target: 480, raw: '480 Hrs min / 480 – 504 Hrs.',
    });
  });

  it('flags a non-numeric cell as non_numeric, not needs_review', () => {
    expect(parseControlLimit('As per Supplier Challan').status).toBe('non_numeric');
  });

  it('flags a non-numeric cell containing a slash correctly as non_numeric (not mistaken for a dual-limit combiner)', () => {
    expect(parseControlLimit('Proper / not').status).toBe('non_numeric');
  });

  it('flags a null control limit as no_limit', () => {
    expect(parseControlLimit(null)).toEqual({
      status: 'no_limit', min: null, max: null, unit: null, prefix: null, target: null, raw: null,
    });
  });

  it('flags an empty string as no_limit', () => {
    expect(parseControlLimit('').status).toBe('no_limit');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- sop-limit-parser`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/parsers/sop-limit-parser.ts

export type LimitStatus = 'parsed' | 'needs_review' | 'non_numeric' | 'no_limit';

export interface ParsedLimit {
  status: LimitStatus;
  min: number | null;
  max: number | null;
  unit: string | null;
  prefix: string | null;
  target: number | null;
  raw: string | null;
}

const RANGE_RE = /^(?:([A-Za-z]{1,4})\s+)?([\d.]+)\s*([A-Za-z°%]*)\s*[–-]\s*([\d.]+)\s*([A-Za-z°%/.\-]*)$/;
const LT_RE = /^<\s*([\d.]+)\s*([A-Za-z°%]*)$/;
const EXACT_RE = /^([\d.]+)\s*([A-Za-z°%/.\-]+)$/;
const TRAILING_QUALIFIER_RE = /\s+(minimum|maximum|min|max)\.?$/i;

const KNOWN_UNITS = new Set([
  '°C', 'SEC', 'MIN', 'HRS', 'GM', 'ML', 'MICRONS', 'AMP',
  'GM/LIT', 'ML/LIT', 'ML/AMP-HR', 'AMP/KG', 'LIT/MIN',
]);

function normalizeUnitForLookup(unit: string): string {
  return unit.toUpperCase().replace(/\./g, '');
}

type PartialLimit = Omit<ParsedLimit, 'raw'>;

const NEEDS_REVIEW: PartialLimit = { status: 'needs_review', min: null, max: null, unit: null, prefix: null, target: null };

function parseSingleExpression(text: string): PartialLimit {
  const range = text.match(RANGE_RE);
  if (range) {
    const [, prefix, minStr, unitA, maxStr, unitB] = range;
    const unit = unitB || unitA || null;
    return { status: 'parsed', min: parseFloat(minStr), max: parseFloat(maxStr), unit, prefix: prefix ?? null, target: null };
  }

  const lt = text.match(LT_RE);
  if (lt) {
    const [, maxStr, unit] = lt;
    return { status: 'parsed', min: null, max: parseFloat(maxStr), unit: unit || null, prefix: null, target: null };
  }

  const exact = text.match(EXACT_RE);
  if (exact) {
    const [, valStr, unit] = exact;
    if (KNOWN_UNITS.has(normalizeUnitForLookup(unit))) {
      const val = parseFloat(valStr);
      return { status: 'parsed', min: val, max: val, unit, prefix: null, target: val };
    }
  }

  return NEEDS_REVIEW;
}

/** Used only for the left/target side of a "/"-combined cell, where a unit can be followed by a qualifier word (e.g. "240 Hrs min"). */
function parseTargetExpression(text: string): PartialLimit {
  const stripped = text.replace(TRAILING_QUALIFIER_RE, '').trim();
  return parseSingleExpression(stripped);
}

export function parseControlLimit(raw: string | null | undefined): ParsedLimit {
  const text = (raw ?? '').trim();

  if (!text) {
    return { status: 'no_limit', min: null, max: null, unit: null, prefix: null, target: null, raw: raw ?? null };
  }
  if (!/\d/.test(text)) {
    return { status: 'non_numeric', min: null, max: null, unit: null, prefix: null, target: null, raw };
  }

  // " / " (with surrounding spaces) marks a dual-limit cell like "15 microns / 12 – 17 microns".
  // A bare unit-internal slash (e.g. "gm/lit", "ml/amp-hr") never has surrounding spaces, so this
  // check does not misfire on ordinary ranges whose unit happens to contain a slash.
  if (text.includes(' / ')) {
    const [leftRaw, rightRaw] = text.split(' / ').map((s) => s.trim());
    const right = parseSingleExpression(rightRaw);
    if (right.status === 'parsed' && right.min !== null && right.max !== null) {
      const left = parseTargetExpression(leftRaw);
      return { ...right, target: left.target ?? left.min ?? left.max, raw };
    }
  }

  return { ...parseSingleExpression(text), raw };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- sop-limit-parser`
Expected: 18 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/sop-limit-parser.ts src/lib/parsers/sop-limit-parser.test.ts
git commit -m "Add regex-based SOP control-limit text parser"
```

---

## Task 4: SOP workbook row parser (golden test against the real file)

**Files:**
- Create: `src/lib/parsers/sop-parser.ts`
- Test: `src/lib/parsers/sop-parser.test.ts`
- Test fixture (real file, already on disk): `Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/parsers/sop-parser.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSopWorkbook } from './sop-parser';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx',
);

function loadFixture() {
  return parseSopWorkbook(readFileSync(FIXTURE_PATH));
}

describe('parseSopWorkbook (real Unique Platers SOP)', () => {
  it('extracts exactly 104 characteristic rows from the 41-step process chart', () => {
    expect(loadFixture()).toHaveLength(104);
  });

  it('parses the Hot Water Rinsing temperature control limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '3' && p.characteristic === 'Concentration (Water)');
    expect(row).toBeDefined();
    expect(row!.process).toBe('Hot Water Rinsing');
    expect(row!.stationNo).toBe('2');
    expect(row!.controlLimitsRaw).toBe('50 – 70°C');
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 50, max: 70, unit: '°C' });
  });

  it('parses the Zinc plating Zn control limit with its chemical prefix', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '21' && p.characteristic === 'Zinc');
    expect(row).toBeDefined();
    expect(row!.process).toBe('Alkaline Zinc Iron Plating (Barrel)');
    expect(row!.stationNo).toBeNull();
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 8, max: 15, unit: 'gm/lit', prefix: 'Zn' });
  });

  it('parses the plating AMP control limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '26' && p.characteristic === 'AMP');
    expect(row).toBeDefined();
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 8, max: 12, unit: 'amp/kg' });
  });

  it('parses the "/"-combined Plating Thickness dual limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '39' && p.characteristic === 'Plating Thickness');
    expect(row).toBeDefined();
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 12, max: 17, unit: 'microns', target: 15 });
  });

  it('flags the Material Inward visual-inspection rows as non_numeric', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '1' && p.characteristic === 'Scratches');
    expect(row).toBeDefined();
    expect(row!.controlLimitsRaw).toBe('Scratches not allowed');
    expect(row!.parsed.status).toBe('non_numeric');
  });

  it('flags the Material Loading row (blank Control Limits) as no_limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '2');
    expect(row).toBeDefined();
    expect(row!.controlLimitsRaw).toBeNull();
    expect(row!.parsed.status).toBe('no_limit');
  });

  it('parses the split 20A/20B Neutralization Dip pH as a max-only "< 12" limit', () => {
    const params = loadFixture();
    const rowA = params.find((p) => p.srNo === '20A' && p.characteristic === 'pH');
    const rowB = params.find((p) => p.srNo === '20B' && p.characteristic === 'pH');
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(rowA!.parsed).toMatchObject({ status: 'parsed', min: null, max: 12 });
    expect(rowB!.parsed).toMatchObject({ status: 'parsed', min: null, max: 12 });
  });

  it('keeps distinct station numbers for the two same-named "Alkaline Emulsion Clean" steps', () => {
    const params = loadFixture();
    const rows = params.filter((p) => p.process === 'Alkaline Emulsion Clean' && p.characteristic === 'Concentration');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.stationNo).sort()).toEqual(['3', '4']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- sop-parser`
Expected: FAIL — `sop-parser.ts` does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/parsers/sop-parser.ts
import * as XLSX from 'xlsx';
import { parseControlLimit, type ParsedLimit } from './sop-limit-parser';

export interface DraftSopParameter {
  srNo: string;
  stationNo: string | null;
  process: string;
  productChemical: string | null;
  characteristic: string | null;
  specLimitsRaw: string | null;
  controlLimitsRaw: string | null;
  impuritiesRaw: string | null;
  parsed: ParsedLimit;
}

const SHEET_NAME = 'Process Chart';
const HEADER_ROW_INDEX = 3; // 0-indexed; "Sr.No" header is on spreadsheet row 4
const DATA_START_INDEX = HEADER_ROW_INDEX + 1;

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

export function parseSopWorkbook(buffer: Buffer): DraftSopParameter[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Expected a "${SHEET_NAME}" sheet in the SOP workbook`);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const parameters: DraftSopParameter[] = [];
  for (let i = DATA_START_INDEX; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === '')) continue;

    const srNo = cellToString(row[0]);
    const process = cellToString(row[2]);
    if (srNo === null || process === null) continue;

    const controlLimitsRaw = cellToString(row[6]);

    parameters.push({
      srNo,
      stationNo: cellToString(row[1]),
      process,
      productChemical: cellToString(row[3]),
      characteristic: cellToString(row[4]),
      specLimitsRaw: cellToString(row[5]),
      controlLimitsRaw,
      impuritiesRaw: cellToString(row[11]),
      parsed: parseControlLimit(controlLimitsRaw),
    });
  }

  return parameters;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- sop-parser`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/sop-parser.ts src/lib/parsers/sop-parser.test.ts
git commit -m "Add SOP workbook row parser with golden tests against the real Unique Platers SOP"
```

---

## Task 5: Load report parser (golden test — full exact fixture data)

**Files:**
- Create: `src/lib/parsers/load-report-parser.ts`
- Test: `src/lib/parsers/load-report-parser.test.ts`
- Test fixture (real file, already on disk): `Clients/Unique Platers/Uploads/OK LoadReport_2025-08-18_003 (1) - Copy.xls`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/parsers/load-report-parser.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseLoadReportWorkbook } from './load-report-parser';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../Clients/Unique Platers/Uploads/OK LoadReport_2025-08-18_003 (1) - Copy.xls',
);

function loadFixture() {
  return parseLoadReportWorkbook(readFileSync(FIXTURE_PATH));
}

describe('parseLoadReportWorkbook (real Unique Platers load report)', () => {
  it('parses the metadata block', () => {
    const { metadata } = loadFixture();
    expect(metadata).toEqual({
      loadNumber: '2025-08-18_003',
      loadInTime: new Date('2025-08-18T10:15:47.000Z'),
      loadOutTime: new Date('2025-08-18T13:21:42.000Z'),
      stillInProcess: false,
      totalTimeSeconds: 11155,
      partNumber: 'SU6065',
      totalWeightKg: 60,
    });
  });

  it('parses exactly 23 station readings, stopping at the END OF REPORT marker', () => {
    expect(loadFixture().readings).toHaveLength(23);
  });

  it('parses every station reading with the exact real values', () => {
    const { readings } = loadFixture();
    expect(readings).toEqual([
      { stationNo: 2, stationName: 'Hot Water Rinse', dipInTime: new Date('2025-08-18T10:16:12.000Z'), dipOutTime: new Date('2025-08-18T10:17:47.000Z'), dipTimeSeconds: 95, temperatureC: 39, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 3, stationName: 'Alkaline Emulsion Cleaning', dipInTime: new Date('2025-08-18T10:18:08.000Z'), dipOutTime: new Date('2025-08-18T10:33:06.000Z'), dipTimeSeconds: 898, temperatureC: 56, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 4, stationName: 'Alkaline Soak Cleaning', dipInTime: new Date('2025-08-18T10:33:29.000Z'), dipOutTime: new Date('2025-08-18T10:48:27.000Z'), dipTimeSeconds: 898, temperatureC: 61, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 5, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T10:48:48.000Z'), dipOutTime: new Date('2025-08-18T10:50:22.000Z'), dipTimeSeconds: 94, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 6, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T10:50:42.000Z'), dipOutTime: new Date('2025-08-18T10:51:35.000Z'), dipTimeSeconds: 53, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 7, stationName: 'Alk. De Scaling', dipInTime: new Date('2025-08-18T10:51:56.000Z'), dipOutTime: new Date('2025-08-18T11:11:21.000Z'), dipTimeSeconds: 1165, temperatureC: 73, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 8, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:11:42.000Z'), dipOutTime: new Date('2025-08-18T11:12:35.000Z'), dipTimeSeconds: 53, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 9, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:12:55.000Z'), dipOutTime: new Date('2025-08-18T11:13:16.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 10, stationName: 'Acid (HCL ) Pickling', dipInTime: new Date('2025-08-18T11:13:37.000Z'), dipOutTime: new Date('2025-08-18T11:15:46.000Z'), dipTimeSeconds: 129, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 11, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:16:06.000Z'), dipOutTime: new Date('2025-08-18T11:16:27.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 12, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:16:47.000Z'), dipOutTime: new Date('2025-08-18T11:17:08.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 13, stationName: 'Single Rinse', dipInTime: new Date('2025-08-18T11:17:29.000Z'), dipOutTime: new Date('2025-08-18T11:18:27.000Z'), dipTimeSeconds: 58, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 14, stationName: 'Alkaline Anodic Cleaning', dipInTime: new Date('2025-08-18T11:18:50.000Z'), dipOutTime: new Date('2025-08-18T11:33:45.000Z'), dipTimeSeconds: 895, temperatureC: 52, ph: null, setCurrentAmp: null, actualCurrentAmp: 502, ampHr: null },
      { stationNo: 15, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:34:07.000Z'), dipOutTime: new Date('2025-08-18T11:35:05.000Z'), dipTimeSeconds: 58, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 16, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:35:25.000Z'), dipOutTime: new Date('2025-08-18T11:35:46.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 17, stationName: 'HCL 6 % dip', dipInTime: new Date('2025-08-18T11:36:07.000Z'), dipOutTime: new Date('2025-08-18T11:37:13.000Z'), dipTimeSeconds: 66, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 18, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:37:33.000Z'), dipOutTime: new Date('2025-08-18T11:37:54.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 19, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T11:38:14.000Z'), dipOutTime: new Date('2025-08-18T11:38:35.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 20, stationName: 'Cross transfer Pre dip', dipInTime: new Date('2025-08-18T11:38:59.000Z'), dipOutTime: new Date('2025-08-18T11:41:12.000Z'), dipTimeSeconds: 133, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 22, stationName: 'Zinc Iron  plating 2', dipInTime: new Date('2025-08-18T11:41:37.000Z'), dipOutTime: new Date('2025-08-18T13:17:53.000Z'), dipTimeSeconds: 5776, temperatureC: 31, ph: null, setCurrentAmp: null, actualCurrentAmp: 536, ampHr: null },
      { stationNo: 27, stationName: 'Drag out', dipInTime: new Date('2025-08-18T13:18:24.000Z'), dipOutTime: new Date('2025-08-18T13:19:46.000Z'), dipTimeSeconds: 82, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 28, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T13:20:06.000Z'), dipOutTime: new Date('2025-08-18T13:20:27.000Z'), dipTimeSeconds: 21, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
      { stationNo: 29, stationName: 'Cascade Rinse', dipInTime: new Date('2025-08-18T13:20:45.000Z'), dipOutTime: new Date('2025-08-18T13:20:45.000Z'), dipTimeSeconds: 0, temperatureC: null, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- load-report-parser`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/parsers/load-report-parser.ts
import * as XLSX from 'xlsx';
import { excelSerialToDate, excelDurationToSeconds } from './excel-datetime';

export interface LoadReportMetadata {
  loadNumber: string;
  loadInTime: Date;
  loadOutTime: Date;
  stillInProcess: boolean;
  totalTimeSeconds: number;
  partNumber: string;
  totalWeightKg: number;
}

export interface StationReading {
  stationNo: number;
  stationName: string;
  dipInTime: Date;
  dipOutTime: Date;
  dipTimeSeconds: number;
  temperatureC: number | null;
  ph: number | null;
  setCurrentAmp: number | null;
  actualCurrentAmp: number | null;
  ampHr: number | null;
}

export interface ParsedLoadReport {
  metadata: LoadReportMetadata;
  readings: StationReading[];
}

const SHEET_NAME = 'LoadReport';
const ROW = { loadNumber: 2, loadInTime: 3, loadOutTime: 4, stillInProcess: 5, totalTime: 6 };
const PART_DATA_ROW = 10;
const STATION_DATA_START_ROW = 17;
const END_MARKER = 'END OF REPORT';

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function parseLoadReportWorkbook(buffer: Buffer): ParsedLoadReport {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Expected a "${SHEET_NAME}" sheet in the load report workbook`);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const metadata: LoadReportMetadata = {
    loadNumber: String(rows[ROW.loadNumber][2]),
    loadInTime: excelSerialToDate(Number(rows[ROW.loadInTime][2])),
    loadOutTime: excelSerialToDate(Number(rows[ROW.loadOutTime][2])),
    stillInProcess: String(rows[ROW.stillInProcess][2]).trim().toLowerCase() === 'yes',
    totalTimeSeconds: excelDurationToSeconds(Number(rows[ROW.totalTime][2])),
    partNumber: String(rows[PART_DATA_ROW][0]),
    totalWeightKg: Number(rows[PART_DATA_ROW][1]),
  };

  const readings: StationReading[] = [];
  for (let i = STATION_DATA_START_ROW; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[0] === null || row[0] === '') continue;
    if (String(row[0]).trim() === END_MARKER) break;

    readings.push({
      stationNo: Number(row[0]),
      stationName: String(row[1]).trim(),
      dipInTime: excelSerialToDate(Number(row[2])),
      dipOutTime: excelSerialToDate(Number(row[3])),
      dipTimeSeconds: excelDurationToSeconds(Number(row[4])),
      temperatureC: toNumberOrNull(row[5]),
      ph: toNumberOrNull(row[6]),
      setCurrentAmp: toNumberOrNull(row[7]),
      actualCurrentAmp: toNumberOrNull(row[8]),
      ampHr: toNumberOrNull(row[9]),
    });
  }

  return { metadata, readings };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- load-report-parser`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/load-report-parser.ts src/lib/parsers/load-report-parser.test.ts
git commit -m "Add load report parser with a full golden test against the real Unique Platers load"
```

---

## Task 6: Scoring engine

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scoreReading } from './scoring';

describe('scoreReading', () => {
  it('passes a value inside the range', () => {
    expect(scoreReading(55, 50, 70)).toBe('pass');
  });

  it('passes a value exactly at the min boundary (inclusive)', () => {
    expect(scoreReading(50, 50, 70)).toBe('pass');
  });

  it('passes a value exactly at the max boundary (inclusive)', () => {
    expect(scoreReading(70, 50, 70)).toBe('pass');
  });

  it('fails a value below the min', () => {
    expect(scoreReading(49.9, 50, 70)).toBe('fail');
  });

  it('fails a value above the max', () => {
    expect(scoreReading(70.1, 50, 70)).toBe('fail');
  });

  it('passes a value above a min-only limit (no max)', () => {
    expect(scoreReading(100, 50, null)).toBe('pass');
  });

  it('fails a value below a min-only limit', () => {
    expect(scoreReading(10, 50, null)).toBe('fail');
  });

  it('passes a value below a max-only limit (no min)', () => {
    expect(scoreReading(5, null, 12)).toBe('pass');
  });

  it('fails a value above a max-only limit', () => {
    expect(scoreReading(13, null, 12)).toBe('fail');
  });

  it('is unscored when the reading value is null (station not logged)', () => {
    expect(scoreReading(null, 50, 70)).toBe('unscored');
  });

  it('is unscored when there is no limit to check against', () => {
    expect(scoreReading(55, null, null)).toBe('unscored');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- scoring`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/scoring.ts

export type ScoreResult = 'pass' | 'fail' | 'unscored';

export function scoreReading(value: number | null, min: number | null, max: number | null): ScoreResult {
  if (value === null) return 'unscored';
  if (min === null && max === null) return 'unscored';
  if (min !== null && value < min) return 'fail';
  if (max !== null && value > max) return 'fail';
  return 'pass';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- scoring`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "Add pass/fail scoring engine with inclusive-boundary tests"
```

---

## Task 7: Station alias matching

SOP station numbers and load-report station numbers are two independent PLC/authoring schemes that only align for part of the line (verified: they match 1:1 for stations 2–19, diverge after the plating step). Matching is therefore name-based via an explicit alias table, keyed by a `stationGroupKey` that disambiguates SOP rows sharing a process name (e.g. the two "Alkaline Emulsion Clean" steps at SOP Station No 3 and 4).

**Files:**
- Create: `src/lib/station-matching.ts`
- Test: `src/lib/station-matching.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/station-matching.test.ts
import { describe, it, expect } from 'vitest';
import { stationGroupKey, findAliasForLoadReportStation, type StationAlias } from './station-matching';

describe('stationGroupKey', () => {
  it('combines process name and station number so same-named steps stay distinct', () => {
    expect(stationGroupKey('Alkaline Emulsion Clean', '3')).toBe('Alkaline Emulsion Clean::3');
    expect(stationGroupKey('Alkaline Emulsion Clean', '4')).toBe('Alkaline Emulsion Clean::4');
  });

  it('groups all plating sub-parameters (blank station number) under one key', () => {
    const key1 = stationGroupKey('Alkaline Zinc Iron Plating (Barrel)', null);
    const key2 = stationGroupKey('Alkaline Zinc Iron Plating (Barrel)', null);
    expect(key1).toBe(key2);
    expect(key1).toBe('Alkaline Zinc Iron Plating (Barrel)::');
  });
});

describe('findAliasForLoadReportStation', () => {
  const aliases: StationAlias[] = [
    { vendorId: 'v1', stationGroupKey: 'Hot Water Rinsing::2', loadReportStationName: 'Hot Water Rinse' },
    { vendorId: 'v1', stationGroupKey: 'Alkaline Zinc Iron Plating (Barrel)::', loadReportStationName: 'Zinc Iron  plating 2' },
  ];

  it('finds a matching alias case-insensitively', () => {
    const found = findAliasForLoadReportStation(aliases, 'hot water rinse');
    expect(found?.stationGroupKey).toBe('Hot Water Rinsing::2');
  });

  it('matches the plating station despite its double-spaced load report name', () => {
    const found = findAliasForLoadReportStation(aliases, 'Zinc Iron  plating 2');
    expect(found?.stationGroupKey).toBe('Alkaline Zinc Iron Plating (Barrel)::');
  });

  it('returns null for a station with no alias (e.g. "Drag out", which has no SOP row)', () => {
    expect(findAliasForLoadReportStation(aliases, 'Drag out')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- station-matching`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/station-matching.ts

export interface StationAlias {
  vendorId: string;
  stationGroupKey: string;
  loadReportStationName: string;
}

/** Groups SOP parameter rows into one physical station, disambiguating same-named steps by SOP Station No. */
export function stationGroupKey(process: string, stationNo: string | null): string {
  return `${process}::${stationNo ?? ''}`;
}

export function findAliasForLoadReportStation(
  aliases: StationAlias[],
  loadReportStationName: string,
): StationAlias | null {
  const normalized = loadReportStationName.trim().toLowerCase();
  return aliases.find((a) => a.loadReportStationName.trim().toLowerCase() === normalized) ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- station-matching`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/station-matching.ts src/lib/station-matching.test.ts
git commit -m "Add station-group keying and name-based alias matching"
```

---

## Task 8: Known station alias seed data (from the real fixture pair)

Encodes the SOP↔load-report station name pairs already confirmed by inspecting both real files side by side. Used by the seed script (Task 12) to pre-populate `station_aliases` so the reviewer only has to confirm/extend, not build the whole table from scratch.

**Files:**
- Create: `src/lib/known-station-aliases.ts`
- Test: `src/lib/known-station-aliases.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/known-station-aliases.test.ts
import { describe, it, expect } from 'vitest';
import { KNOWN_UNIQUE_PLATERS_ALIASES } from './known-station-aliases';
import { findAliasForLoadReportStation } from './station-matching';

describe('KNOWN_UNIQUE_PLATERS_ALIASES', () => {
  it('maps every distinct station name that appears in the real load report and has an obvious SOP match', () => {
    const realLoadReportStationNames = [
      'Hot Water Rinse', 'Alkaline Emulsion Cleaning', 'Alkaline Soak Cleaning', 'Cascade Rinse',
      'Alk. De Scaling', 'Acid (HCL ) Pickling', 'Single Rinse', 'Alkaline Anodic Cleaning',
      'HCL 6 % dip', 'Zinc Iron  plating 2',
    ];
    for (const name of realLoadReportStationNames) {
      expect(findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, name)).not.toBeNull();
    }
  });

  it('does not invent a mapping for "Cross transfer Pre dip" or "Drag out" (no confident SOP match)', () => {
    expect(findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, 'Cross transfer Pre dip')).toBeNull();
    expect(findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, 'Drag out')).toBeNull();
  });

  it('maps the plating station to its group key with a blank station number', () => {
    const found = findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, 'Zinc Iron  plating 2');
    expect(found?.stationGroupKey).toBe('Alkaline Zinc Iron Plating (Barrel)::');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- known-station-aliases`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/known-station-aliases.ts
import { stationGroupKey, type StationAlias } from './station-matching';

/**
 * Seed aliases for Unique Platers, confirmed by inspecting the real SOP and the real
 * 2025-08-18_003 load report side by side. "Cascade Rinse" appears many times in the load
 * report at different station numbers for different SOP rinse steps — each is seeded
 * separately below because the SOP station numbers (5,6,8,9,11,12,15,16,18,19,28,29) line up
 * 1:1 with the load report's numbers for the pre-plating section of the line.
 */
export const KNOWN_UNIQUE_PLATERS_ALIASES: StationAlias[] = [
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Hot Water Rinsing', '2'), loadReportStationName: 'Hot Water Rinse' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Alkaline Emulsion Clean', '3'), loadReportStationName: 'Alkaline Emulsion Cleaning' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Alkaline Emulsion Clean', '4'), loadReportStationName: 'Alkaline Soak Cleaning' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Cascading Rinsing', '5'), loadReportStationName: 'Cascade Rinse' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('De-Scaling', '7'), loadReportStationName: 'Alk. De Scaling' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Acid Cleaning Comm. HCL', '10'), loadReportStationName: 'Acid (HCL ) Pickling' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Water Rinsing', '13'), loadReportStationName: 'Single Rinse' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Anodic Cleaning', '14'), loadReportStationName: 'Alkaline Anodic Cleaning' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('HCL Dip', '17'), loadReportStationName: 'HCL 6 % dip' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Alkaline Zinc Iron Plating (Barrel)', null), loadReportStationName: 'Zinc Iron  plating 2' },
];
```

Note: `findAliasForLoadReportStation` only returns the *first* alias matching a given `loadReportStationName`, so the repeated "Cascade Rinse" load-report name (stations 5,6,8,9,11,12,15,16,18,19,28,29 in this load) will only auto-resolve to the Station-5 SOP row above. This is a known, intentional MVP limitation — document it in the SOP review UI (Task 13) as "Cascade Rinse maps to multiple SOP steps; only the first is auto-scored today," rather than silently guessing which occurrence is which.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- known-station-aliases`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/known-station-aliases.ts src/lib/known-station-aliases.test.ts
git commit -m "Seed known Unique Platers station aliases from the real SOP/load-report pair"
```

---

## Task 9: SQLite schema and connection

**Files:**
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/client.ts`
- Test: `src/lib/db/client.test.ts`

- [ ] **Step 1: Write the schema**

```sql
-- src/lib/db/schema.sql

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  process_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'vendor')),
  vendor_id TEXT REFERENCES vendors(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_documents (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  file_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'superseded')) DEFAULT 'draft',
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT
);

CREATE TABLE IF NOT EXISTS sop_parameters (
  id TEXT PRIMARY KEY,
  sop_document_id TEXT NOT NULL REFERENCES sop_documents(id),
  station_group_key TEXT NOT NULL,
  sr_no TEXT NOT NULL,
  station_no TEXT,
  process TEXT NOT NULL,
  product_chemical TEXT,
  characteristic TEXT,
  min_value REAL,
  max_value REAL,
  unit TEXT,
  status TEXT NOT NULL CHECK (status IN ('parsed', 'needs_review', 'non_numeric', 'no_limit')),
  raw_control_limit TEXT,
  raw_spec_limit TEXT
);

CREATE TABLE IF NOT EXISTS station_aliases (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  station_group_key TEXT NOT NULL,
  load_report_station_name TEXT NOT NULL,
  UNIQUE (vendor_id, load_report_station_name)
);

CREATE TABLE IF NOT EXISTS load_reports (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  load_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  part_number TEXT,
  total_weight_kg REAL,
  load_in_time TEXT,
  load_out_time TEXT,
  total_time_seconds INTEGER,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vendor_id, load_number)
);

CREATE TABLE IF NOT EXISTS load_readings (
  id TEXT PRIMARY KEY,
  load_report_id TEXT NOT NULL REFERENCES load_reports(id),
  sop_parameter_id TEXT REFERENCES sop_parameters(id),
  station_no INTEGER NOT NULL,
  station_name TEXT NOT NULL,
  parameter_name TEXT NOT NULL,
  value REAL,
  dip_time_seconds INTEGER,
  recorded_at TEXT,
  score TEXT NOT NULL CHECK (score IN ('pass', 'fail', 'unscored'))
);

CREATE TABLE IF NOT EXISTS manual_checks (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  sop_parameter_id TEXT NOT NULL REFERENCES sop_parameters(id),
  value REAL NOT NULL,
  checked_at TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES users(id),
  score TEXT NOT NULL CHECK (score IN ('pass', 'fail'))
);

CREATE TABLE IF NOT EXISTS dashboard_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  filters_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Write the failing test for the connection module**

```ts
// src/lib/db/client.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { createDb } from './client';

const TEST_DB_PATH = './data/test-client.sqlite';

afterEach(() => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

describe('createDb', () => {
  it('creates all expected tables from schema.sql', () => {
    const db = createDb(TEST_DB_PATH);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row: any) => row.name);

    expect(tables).toEqual([
      'dashboard_prefs', 'load_readings', 'load_reports', 'manual_checks',
      'sop_documents', 'sop_parameters', 'station_aliases', 'users', 'vendors',
    ]);
    db.close();
  });

  it('enforces the role check constraint on users', () => {
    const db = createDb(TEST_DB_PATH);
    expect(() =>
      db
        .prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)')
        .run('u1', 'x@example.com', 'hash', 'not-a-real-role'),
    ).toThrow();
    db.close();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- db/client`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement**

```ts
// src/lib/db/client.ts
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

export function createDb(filePath: string): Database.Database {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'));
  return db;
}

let singleton: Database.Database | null = null;

/** App-wide singleton connection, pointed at DATABASE_PATH (defaults to ./data/vendor-quality.sqlite). */
export function getDb(): Database.Database {
  if (!singleton) {
    const filePath = process.env.DATABASE_PATH ?? './data/vendor-quality.sqlite';
    singleton = createDb(filePath);
  }
  return singleton;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- db/client`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.sql src/lib/db/client.ts src/lib/db/client.test.ts
git commit -m "Add SQLite schema and connection module"
```

---

## Task 10: Repository layer

Thin, typed CRUD functions over the schema from Task 9. Each function takes a `Database.Database` instance (from `getDb()` in production, from `createDb(':memory:')` in tests) so tests never touch the real app database file.

**Files:**
- Create: `src/lib/db/vendors.ts`
- Create: `src/lib/db/users.ts`
- Create: `src/lib/db/sop.ts`
- Create: `src/lib/db/load-reports.ts`
- Create: `src/lib/db/manual-checks.ts`
- Test: `src/lib/db/repository.test.ts`

- [ ] **Step 1: Write the failing integration test covering the full write/read path**

```ts
// src/lib/db/repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from './client';
import { createVendor, getVendorByName } from './vendors';
import { createUser, getUserByEmail } from './users';
import {
  createDraftSopDocument, insertSopParameters, activateSopDocument,
  getActiveSopParameters, getSopParametersByDocument,
} from './sop';
import { createLoadReport, loadNumberExists, insertLoadReadings, getLoadReadingsForReport } from './load-reports';
import { createManualCheck, getManualChecksForVendor } from './manual-checks';

let db: Database.Database;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('vendors + users', () => {
  it('creates a vendor and a user scoped to it', () => {
    const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const user = createUser(db, { email: 'vendor@unique.local', passwordHash: 'hash', role: 'vendor', vendorId: vendor.id });

    expect(getVendorByName(db, 'Unique Platers')?.id).toBe(vendor.id);
    expect(getUserByEmail(db, 'vendor@unique.local')?.vendorId).toBe(vendor.id);
    expect(user.role).toBe('vendor');
  });
});

describe('SOP draft -> review -> activation', () => {
  it('only exposes activated parameters via getActiveSopParameters', () => {
    const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const admin = createUser(db, { email: 'admin@lf.local', passwordHash: 'hash', role: 'admin', vendorId: null });

    const draft = createDraftSopDocument(db, { vendorId: vendor.id, filePath: '/x/sop.xlsx', uploadedBy: admin.id });
    insertSopParameters(db, draft.id, [
      {
        stationGroupKey: 'Hot Water Rinsing::2', srNo: '3', stationNo: '2', process: 'Hot Water Rinsing',
        productChemical: 'Water', characteristic: 'Concentration (Water)',
        minValue: 50, maxValue: 70, unit: '°C', status: 'parsed',
        rawControlLimit: '50 – 70°C', rawSpecLimit: '50°C minimum',
      },
    ]);

    expect(getActiveSopParameters(db, vendor.id)).toHaveLength(0);
    expect(getSopParametersByDocument(db, draft.id)).toHaveLength(1);

    activateSopDocument(db, draft.id, vendor.id);

    const active = getActiveSopParameters(db, vendor.id);
    expect(active).toHaveLength(1);
    expect(active[0].minValue).toBe(50);
  });

  it('supersedes the previous active SOP when a new one activates', () => {
    const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const admin = createUser(db, { email: 'admin@lf.local', passwordHash: 'hash', role: 'admin', vendorId: null });

    const first = createDraftSopDocument(db, { vendorId: vendor.id, filePath: '/x/sop-v1.xlsx', uploadedBy: admin.id });
    insertSopParameters(db, first.id, [
      { stationGroupKey: 'k1', srNo: '3', stationNo: '2', process: 'P', productChemical: null, characteristic: null, minValue: 1, maxValue: 2, unit: null, status: 'parsed', rawControlLimit: 'x', rawSpecLimit: null },
    ]);
    activateSopDocument(db, first.id, vendor.id);

    const second = createDraftSopDocument(db, { vendorId: vendor.id, filePath: '/x/sop-v2.xlsx', uploadedBy: admin.id });
    insertSopParameters(db, second.id, [
      { stationGroupKey: 'k1', srNo: '3', stationNo: '2', process: 'P', productChemical: null, characteristic: null, minValue: 5, maxValue: 6, unit: null, status: 'parsed', rawControlLimit: 'y', rawSpecLimit: null },
    ]);
    activateSopDocument(db, second.id, vendor.id);

    const active = getActiveSopParameters(db, vendor.id);
    expect(active).toHaveLength(1);
    expect(active[0].minValue).toBe(5);
  });
});

describe('load reports', () => {
  it('rejects a duplicate load number for the same vendor', () => {
    const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const user = createUser(db, { email: 'v@u.local', passwordHash: 'hash', role: 'vendor', vendorId: vendor.id });

    createLoadReport(db, {
      vendorId: vendor.id, loadNumber: '2025-08-18_003', filePath: '/x/load.xls',
      partNumber: 'SU6065', totalWeightKg: 60,
      loadInTime: '2025-08-18T10:15:47.000Z', loadOutTime: '2025-08-18T13:21:42.000Z',
      totalTimeSeconds: 11155, uploadedBy: user.id,
    });

    expect(loadNumberExists(db, vendor.id, '2025-08-18_003')).toBe(true);
    expect(() =>
      createLoadReport(db, {
        vendorId: vendor.id, loadNumber: '2025-08-18_003', filePath: '/x/load-again.xls',
        partNumber: 'SU6065', totalWeightKg: 60,
        loadInTime: '2025-08-18T10:15:47.000Z', loadOutTime: '2025-08-18T13:21:42.000Z',
        totalTimeSeconds: 11155, uploadedBy: user.id,
      }),
    ).toThrow();
  });

  it('stores readings including unmatched stations with a null sop_parameter_id', () => {
    const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const user = createUser(db, { email: 'v@u.local', passwordHash: 'hash', role: 'vendor', vendorId: vendor.id });
    const report = createLoadReport(db, {
      vendorId: vendor.id, loadNumber: 'L1', filePath: '/x/load.xls',
      partNumber: 'SU6065', totalWeightKg: 60,
      loadInTime: '2025-08-18T10:15:47.000Z', loadOutTime: '2025-08-18T13:21:42.000Z',
      totalTimeSeconds: 11155, uploadedBy: user.id,
    });

    insertLoadReadings(db, report.id, [
      { sopParameterId: null, stationNo: 27, stationName: 'Drag out', parameterName: 'Temperature', value: null, dipTimeSeconds: 82, score: 'unscored' },
      { sopParameterId: null, stationNo: 2, stationName: 'Hot Water Rinse', parameterName: 'Temperature', value: 39, dipTimeSeconds: 95, score: 'pass' },
    ]);

    const readings = getLoadReadingsForReport(db, report.id);
    expect(readings).toHaveLength(2);
    expect(readings.find((r) => r.stationName === 'Drag out')?.sopParameterId).toBeNull();
  });
});

describe('manual checks', () => {
  it('records a manual check independent of any load report', () => {
    const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const admin = createUser(db, { email: 'admin@lf.local', passwordHash: 'hash', role: 'admin', vendorId: null });
    const draft = createDraftSopDocument(db, { vendorId: vendor.id, filePath: '/x/sop.xlsx', uploadedBy: admin.id });
    const [param] = insertSopParameters(db, draft.id, [
      { stationGroupKey: 'k1', srNo: '4', stationNo: '3', process: 'Alkaline Emulsion Clean', productChemical: 'ECT Met Clean 288', characteristic: 'Concentration', minValue: 60, maxValue: 70, unit: 'gm/lit', status: 'parsed', rawControlLimit: '60 – 70 gm/lit', rawSpecLimit: '70 gm/lit minimum' },
    ]);
    activateSopDocument(db, draft.id, vendor.id);

    createManualCheck(db, {
      vendorId: vendor.id, sopParameterId: param.id, value: 65,
      checkedAt: '2026-08-10T09:00:00.000Z', enteredBy: admin.id, score: 'pass',
    });

    const checks = getManualChecksForVendor(db, vendor.id);
    expect(checks).toHaveLength(1);
    expect(checks[0].score).toBe('pass');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- db/repository`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement each repository module**

```ts
// src/lib/db/vendors.ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface Vendor {
  id: string;
  name: string;
  processName: string;
}

export function createVendor(db: Database.Database, input: { name: string; processName: string }): Vendor {
  const id = randomUUID();
  db.prepare('INSERT INTO vendors (id, name, process_name) VALUES (?, ?, ?)').run(id, input.name, input.processName);
  return { id, name: input.name, processName: input.processName };
}

export function getVendorByName(db: Database.Database, name: string): Vendor | null {
  const row = db.prepare('SELECT id, name, process_name AS processName FROM vendors WHERE name = ?').get(name) as
    | Vendor
    | undefined;
  return row ?? null;
}
```

```ts
// src/lib/db/users.ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type UserRole = 'admin' | 'vendor';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  vendorId: string | null;
}

export function createUser(
  db: Database.Database,
  input: { email: string; passwordHash: string; role: UserRole; vendorId: string | null },
): User {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, email, password_hash, role, vendor_id) VALUES (?, ?, ?, ?, ?)').run(
    id, input.email, input.passwordHash, input.role, input.vendorId,
  );
  return { id, ...input };
}

export function getUserByEmail(db: Database.Database, email: string): User | null {
  const row = db
    .prepare('SELECT id, email, password_hash AS passwordHash, role, vendor_id AS vendorId FROM users WHERE email = ?')
    .get(email) as User | undefined;
  return row ?? null;
}
```

```ts
// src/lib/db/sop.ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { LimitStatus } from '../parsers/sop-limit-parser';

export interface SopDocument {
  id: string;
  vendorId: string;
  filePath: string;
  status: 'draft' | 'active' | 'superseded';
}

export interface SopParameterInput {
  stationGroupKey: string;
  srNo: string;
  stationNo: string | null;
  process: string;
  productChemical: string | null;
  characteristic: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  status: LimitStatus;
  rawControlLimit: string | null;
  rawSpecLimit: string | null;
}

export interface SopParameter extends SopParameterInput {
  id: string;
  sopDocumentId: string;
}

export function createDraftSopDocument(
  db: Database.Database,
  input: { vendorId: string; filePath: string; uploadedBy: string },
): SopDocument {
  const id = randomUUID();
  db.prepare('INSERT INTO sop_documents (id, vendor_id, file_path, status, uploaded_by) VALUES (?, ?, ?, ?, ?)').run(
    id, input.vendorId, input.filePath, 'draft', input.uploadedBy,
  );
  return { id, vendorId: input.vendorId, filePath: input.filePath, status: 'draft' };
}

export function insertSopParameters(
  db: Database.Database,
  sopDocumentId: string,
  params: SopParameterInput[],
): SopParameter[] {
  const insert = db.prepare(`
    INSERT INTO sop_parameters
      (id, sop_document_id, station_group_key, sr_no, station_no, process, product_chemical,
       characteristic, min_value, max_value, unit, status, raw_control_limit, raw_spec_limit)
    VALUES (@id, @sopDocumentId, @stationGroupKey, @srNo, @stationNo, @process, @productChemical,
            @characteristic, @minValue, @maxValue, @unit, @status, @rawControlLimit, @rawSpecLimit)
  `);
  const inserted: SopParameter[] = [];
  const runAll = db.transaction((rows: SopParameterInput[]) => {
    for (const row of rows) {
      const id = randomUUID();
      insert.run({ id, sopDocumentId, ...row });
      inserted.push({ id, sopDocumentId, ...row });
    }
  });
  runAll(params);
  return inserted;
}

export function getSopParametersByDocument(db: Database.Database, sopDocumentId: string): SopParameter[] {
  return db
    .prepare(
      `SELECT id, sop_document_id AS sopDocumentId, station_group_key AS stationGroupKey, sr_no AS srNo,
              station_no AS stationNo, process, product_chemical AS productChemical, characteristic,
              min_value AS minValue, max_value AS maxValue, unit, status,
              raw_control_limit AS rawControlLimit, raw_spec_limit AS rawSpecLimit
       FROM sop_parameters WHERE sop_document_id = ?`,
    )
    .all(sopDocumentId) as SopParameter[];
}

export function activateSopDocument(db: Database.Database, sopDocumentId: string, vendorId: string): void {
  const run = db.transaction(() => {
    db.prepare(
      "UPDATE sop_documents SET status = 'superseded' WHERE vendor_id = ? AND status = 'active'",
    ).run(vendorId);
    db.prepare(
      "UPDATE sop_documents SET status = 'active', activated_at = datetime('now') WHERE id = ?",
    ).run(sopDocumentId);
  });
  run();
}

export function getActiveSopParameters(db: Database.Database, vendorId: string): SopParameter[] {
  return db
    .prepare(
      `SELECT p.id, p.sop_document_id AS sopDocumentId, p.station_group_key AS stationGroupKey, p.sr_no AS srNo,
              p.station_no AS stationNo, p.process, p.product_chemical AS productChemical, p.characteristic,
              p.min_value AS minValue, p.max_value AS maxValue, p.unit, p.status,
              p.raw_control_limit AS rawControlLimit, p.raw_spec_limit AS rawSpecLimit
       FROM sop_parameters p
       JOIN sop_documents d ON d.id = p.sop_document_id
       WHERE d.vendor_id = ? AND d.status = 'active'`,
    )
    .all(vendorId) as SopParameter[];
}
```

```ts
// src/lib/db/load-reports.ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ScoreResult } from '../scoring';

export interface LoadReport {
  id: string;
  vendorId: string;
  loadNumber: string;
}

export interface LoadReadingInput {
  sopParameterId: string | null;
  stationNo: number;
  stationName: string;
  parameterName: string;
  value: number | null;
  dipTimeSeconds: number | null;
  score: ScoreResult;
}

export interface LoadReading extends LoadReadingInput {
  id: string;
  loadReportId: string;
}

export function loadNumberExists(db: Database.Database, vendorId: string, loadNumber: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM load_reports WHERE vendor_id = ? AND load_number = ?')
    .get(vendorId, loadNumber);
  return row !== undefined;
}

export function createLoadReport(
  db: Database.Database,
  input: {
    vendorId: string; loadNumber: string; filePath: string; partNumber: string; totalWeightKg: number;
    loadInTime: string; loadOutTime: string; totalTimeSeconds: number; uploadedBy: string;
  },
): LoadReport {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO load_reports
      (id, vendor_id, load_number, file_path, part_number, total_weight_kg,
       load_in_time, load_out_time, total_time_seconds, uploaded_by)
    VALUES (@id, @vendorId, @loadNumber, @filePath, @partNumber, @totalWeightKg,
            @loadInTime, @loadOutTime, @totalTimeSeconds, @uploadedBy)
  `).run({ id, ...input });
  return { id, vendorId: input.vendorId, loadNumber: input.loadNumber };
}

export function insertLoadReadings(
  db: Database.Database,
  loadReportId: string,
  readings: LoadReadingInput[],
): LoadReading[] {
  const insert = db.prepare(`
    INSERT INTO load_readings
      (id, load_report_id, sop_parameter_id, station_no, station_name, parameter_name, value, dip_time_seconds, score)
    VALUES (@id, @loadReportId, @sopParameterId, @stationNo, @stationName, @parameterName, @value, @dipTimeSeconds, @score)
  `);
  const inserted: LoadReading[] = [];
  const runAll = db.transaction((rows: LoadReadingInput[]) => {
    for (const row of rows) {
      const id = randomUUID();
      insert.run({ id, loadReportId, ...row });
      inserted.push({ id, loadReportId, ...row });
    }
  });
  runAll(readings);
  return inserted;
}

export function getLoadReadingsForReport(db: Database.Database, loadReportId: string): LoadReading[] {
  return db
    .prepare(
      `SELECT id, load_report_id AS loadReportId, sop_parameter_id AS sopParameterId, station_no AS stationNo,
              station_name AS stationName, parameter_name AS parameterName, value, dip_time_seconds AS dipTimeSeconds, score
       FROM load_readings WHERE load_report_id = ?`,
    )
    .all(loadReportId) as LoadReading[];
}
```

```ts
// src/lib/db/manual-checks.ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export interface ManualCheckInput {
  vendorId: string;
  sopParameterId: string;
  value: number;
  checkedAt: string;
  enteredBy: string;
  score: 'pass' | 'fail';
}

export interface ManualCheck extends ManualCheckInput {
  id: string;
}

export function createManualCheck(db: Database.Database, input: ManualCheckInput): ManualCheck {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO manual_checks (id, vendor_id, sop_parameter_id, value, checked_at, entered_by, score)
    VALUES (@id, @vendorId, @sopParameterId, @value, @checkedAt, @enteredBy, @score)
  `).run({ id, ...input });
  return { id, ...input };
}

export function getManualChecksForVendor(db: Database.Database, vendorId: string): ManualCheck[] {
  return db
    .prepare(
      `SELECT id, vendor_id AS vendorId, sop_parameter_id AS sopParameterId, value,
              checked_at AS checkedAt, entered_by AS enteredBy, score
       FROM manual_checks WHERE vendor_id = ? ORDER BY checked_at`,
    )
    .all(vendorId) as ManualCheck[];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- db/repository`
Expected: 6 passed.

- [ ] **Step 5: Run the full test suite before moving to UI work**

Run: `npm test`
Expected: all suites pass (excel-datetime, sop-limit-parser, sop-parser, load-report-parser, scoring, station-matching, known-station-aliases, db/client, db/repository).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/vendors.ts src/lib/db/users.ts src/lib/db/sop.ts src/lib/db/load-reports.ts src/lib/db/manual-checks.ts src/lib/db/repository.test.ts
git commit -m "Add repository layer over SQLite: vendors, users, SOP lifecycle, load reports, manual checks"
```

---

## Task 11: Auth.js credentials login

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `.env.example`

- [ ] **Step 1: Add environment variable template**

```bash
# .env.example
AUTH_SECRET=replace-with-a-long-random-string
DATABASE_PATH=./data/vendor-quality.sqlite
```

Copy it: `cp .env.example .env.local` then edit `.env.local` and set `AUTH_SECRET` to a real random string (e.g. `openssl rand -base64 32`, or any 32+ character random string if `openssl` is unavailable).

- [ ] **Step 2: Implement the Auth.js config**

```ts
// src/lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from './db/client';
import { getUserByEmail } from './db/users';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = getUserByEmail(getDb(), email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, role: user.role, vendorId: user.vendorId };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.vendorId = (user as any).vendorId;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as any).role = token.role;
      (session.user as any).vendorId = token.vendorId;
      return session;
    },
  },
});
```

```ts
// src/types/next-auth.d.ts
import type { UserRole } from '@/lib/db/users';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      vendorId: string | null;
    };
  }
}
```

```ts
// src/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/lib/auth';
```

```ts
// src/middleware.ts
export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 3: Add the login page**

```tsx
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      setError('Invalid email or password');
      return;
    }
    router.push('/');
  }

  return (
    <main className="login-page">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>Vendor Quality — Sign In</h1>
        {error && <p className="login-error">{error}</p>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Sign In</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000` — expect a redirect to `/login` (no session yet, no users seeded yet — full login smoke test happens after Task 12 seeds a real user).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/middleware.ts src/app/login src/types/next-auth.d.ts .env.example
git commit -m "Add Auth.js credentials login and route protection middleware"
```

---

## Task 12: Seed script

**Files:**
- Create: `src/lib/seed.ts`
- Create: `scripts/seed.ts`

- [ ] **Step 1: Implement the seed function**

```ts
// src/lib/seed.ts
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { createVendor, getVendorByName } from './db/vendors';
import { createUser, getUserByEmail } from './db/users';

export async function seed(db: Database.Database) {
  let vendor = getVendorByName(db, 'Unique Platers');
  if (!vendor) {
    vendor = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
  }

  if (!getUserByEmail(db, 'admin@leadership-fractal.local')) {
    createUser(db, {
      email: 'admin@leadership-fractal.local',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      role: 'admin',
      vendorId: null,
    });
  }

  if (!getUserByEmail(db, 'vendor@unique-platers.local')) {
    createUser(db, {
      email: 'vendor@unique-platers.local',
      passwordHash: await bcrypt.hash('Vendor@123', 10),
      role: 'vendor',
      vendorId: vendor.id,
    });
  }

  return vendor;
}
```

```ts
// scripts/seed.ts
import { getDb } from '../src/lib/db/client';
import { seed } from '../src/lib/seed';

seed(getDb()).then((vendor) => {
  console.log(`Seeded vendor ${vendor.name} (${vendor.id}) and demo users.`);
  process.exit(0);
});
```

- [ ] **Step 2: Add the npm script**

Add to `package.json` `"scripts"`: `"seed": "tsx scripts/seed.ts"`

```bash
npm install -D tsx
```

- [ ] **Step 3: Run it and verify**

Run: `npm run seed`
Expected: prints `Seeded vendor Unique Platers (...) and demo users.`

Run: `npm run dev`, go to `http://localhost:3000/login`, sign in as `vendor@unique-platers.local` / `Vendor@123`.
Expected: redirected to `/` and no longer bounced back to `/login`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/seed.ts scripts/seed.ts package.json package-lock.json
git commit -m "Add seed script for the demo admin/vendor users and Unique Platers vendor"
```

---

## Task 13: SOP upload, review, and activation UI

**Files:**
- Create: `src/app/sops/page.tsx` (SOP library)
- Create: `src/app/sops/new/page.tsx` (upload form)
- Create: `src/app/sops/new/actions.ts` (server action: parse + create draft)
- Create: `src/app/sops/[id]/page.tsx` (review screen: editable table + activate button)
- Create: `src/app/sops/[id]/actions.ts` (server actions: update a parameter row, set/update a station alias, activate)
- Create: `src/components/SopReviewTable.tsx`

- [ ] **Step 1: Upload action — parses the file and creates a draft**

```ts
// src/app/sops/new/actions.ts
'use server';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { createDraftSopDocument, insertSopParameters } from '@/lib/db/sop';
import { getVendorByName } from '@/lib/db/vendors';
import { parseSopWorkbook } from '@/lib/parsers/sop-parser';
import { stationGroupKey } from '@/lib/station-matching';
import { redirect } from 'next/navigation';

export async function uploadSop(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Not authenticated');

  const file = formData.get('sopFile') as File;
  const vendorName = formData.get('vendorName') as string;
  if (!file || file.size === 0) throw new Error('No file uploaded');

  const buffer = Buffer.from(await file.arrayBuffer());
  const draftParams = parseSopWorkbook(buffer);

  const db = getDb();
  const vendor = getVendorByName(db, vendorName);
  if (!vendor) throw new Error(`Unknown vendor: ${vendorName}`);

  const uploadDir = path.resolve('./Clients', vendorName, 'SOP');
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
  await writeFile(filePath, buffer);

  const doc = createDraftSopDocument(db, { vendorId: vendor.id, filePath, uploadedBy: session.user.id });
  insertSopParameters(
    db,
    doc.id,
    draftParams.map((p) => ({
      stationGroupKey: stationGroupKey(p.process, p.stationNo),
      srNo: p.srNo,
      stationNo: p.stationNo,
      process: p.process,
      productChemical: p.productChemical,
      characteristic: p.characteristic,
      minValue: p.parsed.min,
      maxValue: p.parsed.max,
      unit: p.parsed.unit,
      status: p.parsed.status,
      rawControlLimit: p.controlLimitsRaw,
      rawSpecLimit: p.specLimitsRaw,
    })),
  );

  redirect(`/sops/${doc.id}`);
}
```

```tsx
// src/app/sops/new/page.tsx
import { uploadSop } from './actions';

export default function NewSopPage() {
  return (
    <main className="section">
      <h1><span className="accent-bar" />Feed SOP</h1>
      <form action={uploadSop}>
        <label>
          Vendor
          <select name="vendorName" defaultValue="Unique Platers">
            <option value="Unique Platers">Unique Platers</option>
          </select>
        </label>
        <label>
          SOP file (.xlsx)
          <input type="file" name="sopFile" accept=".xlsx" required />
        </label>
        <button type="submit">Parse SOP</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Review screen actions — edit a row, set an alias, activate**

```ts
// src/app/sops/[id]/actions.ts
'use server';

import { getDb } from '@/lib/db/client';
import { activateSopDocument, getSopParametersByDocument } from '@/lib/db/sop';
import { revalidatePath } from 'next/cache';

export async function updateSopParameter(id: string, minValue: number | null, maxValue: number | null, unit: string | null) {
  getDb()
    .prepare('UPDATE sop_parameters SET min_value = ?, max_value = ?, unit = ?, status = ? WHERE id = ?')
    .run(minValue, maxValue, unit, minValue !== null || maxValue !== null ? 'parsed' : 'needs_review', id);
}

export async function setStationAlias(vendorId: string, stationGroupKey: string, loadReportStationName: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO station_aliases (id, vendor_id, station_group_key, load_report_station_name)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?)
     ON CONFLICT(vendor_id, load_report_station_name) DO UPDATE SET station_group_key = excluded.station_group_key`,
  ).run(vendorId, stationGroupKey, loadReportStationName);
}

export async function activateSop(sopDocumentId: string, vendorId: string) {
  activateSopDocument(getDb(), sopDocumentId, vendorId);
  revalidatePath(`/sops/${sopDocumentId}`);
}

export async function getDraftParameters(sopDocumentId: string) {
  return getSopParametersByDocument(getDb(), sopDocumentId);
}
```

```tsx
// src/app/sops/[id]/page.tsx
import { getDraftParameters, activateSop } from './actions';
import { SopReviewTable } from '@/components/SopReviewTable';
import { getDb } from '@/lib/db/client';

export default async function SopReviewPage({ params }: { params: { id: string } }) {
  const parameters = await getDraftParameters(params.id);
  const doc = getDb().prepare('SELECT vendor_id AS vendorId, status FROM sop_documents WHERE id = ?').get(params.id) as
    | { vendorId: string; status: string }
    | undefined;
  if (!doc) return <main className="section">SOP not found.</main>;

  return (
    <main className="section">
      <h1><span className="accent-bar" />Review SOP — status: {doc.status}</h1>
      <SopReviewTable parameters={parameters} vendorId={doc.vendorId} />
      {doc.status === 'draft' && (
        <form action={async () => { 'use server'; await activateSop(params.id, doc.vendorId); }}>
          <button type="submit">Activate SOP</button>
        </form>
      )}
    </main>
  );
}
```

```tsx
// src/components/SopReviewTable.tsx
'use client';

import { useState } from 'react';
import { updateSopParameter, setStationAlias } from '@/app/sops/[id]/actions';
import type { SopParameter } from '@/lib/db/sop';

export function SopReviewTable({ parameters, vendorId }: { parameters: SopParameter[]; vendorId: string }) {
  const [rows, setRows] = useState(parameters);

  async function handleChange(id: string, field: 'minValue' | 'maxValue' | 'unit', value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: field === 'unit' ? value : Number(value) } : r)));
  }

  async function handleSave(row: SopParameter) {
    await updateSopParameter(row.id, row.minValue, row.maxValue, row.unit);
  }

  async function handleAlias(row: SopParameter, loadReportStationName: string) {
    await setStationAlias(vendorId, row.stationGroupKey, loadReportStationName);
  }

  return (
    <table className="sop-review-table">
      <thead>
        <tr>
          <th>Sr.No</th><th>Process</th><th>Characteristic</th><th>Status</th>
          <th>Min</th><th>Max</th><th>Unit</th><th>Raw Control Limit</th><th>Load-Report Station Name</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.status === 'needs_review' ? 'needs-review' : ''}>
            <td>{row.srNo}</td>
            <td>{row.process}</td>
            <td>{row.characteristic}</td>
            <td>{row.status}</td>
            <td><input value={row.minValue ?? ''} onChange={(e) => handleChange(row.id, 'minValue', e.target.value)} onBlur={() => handleSave(row)} /></td>
            <td><input value={row.maxValue ?? ''} onChange={(e) => handleChange(row.id, 'maxValue', e.target.value)} onBlur={() => handleSave(row)} /></td>
            <td><input value={row.unit ?? ''} onChange={(e) => handleChange(row.id, 'unit', e.target.value)} onBlur={() => handleSave(row)} /></td>
            <td>{row.rawControlLimit}</td>
            <td><input placeholder="e.g. Hot Water Rinse" onBlur={(e) => e.target.value && handleAlias(row, e.target.value)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: SOP library page**

```tsx
// src/app/sops/page.tsx
import Link from 'next/link';
import { getDb } from '@/lib/db/client';

export default function SopsPage() {
  const docs = getDb()
    .prepare(
      `SELECT d.id, d.status, d.uploaded_at AS uploadedAt, v.name AS vendorName
       FROM sop_documents d JOIN vendors v ON v.id = d.vendor_id ORDER BY d.uploaded_at DESC`,
    )
    .all() as { id: string; status: string; uploadedAt: string; vendorName: string }[];

  return (
    <main className="section">
      <h1><span className="accent-bar" />SOP Library</h1>
      <Link href="/sops/new">Feed a new SOP</Link>
      <ul>
        {docs.map((d) => (
          <li key={d.id}>
            <Link href={`/sops/${d.id}`}>{d.vendorName} — {d.status} — {d.uploadedAt}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Manual smoke test with the real SOP file**

Run: `npm run dev`, sign in as `admin@leadership-fractal.local` / `Admin@123`, go to `/sops/new`, upload `Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx`.
Expected: redirected to `/sops/[id]` showing 104 rows, `needs_review` rows highlighted, editable inline. Set the alias for at least the Hot Water Rinsing and plating rows (matching Task 8's seed values), then click **Activate SOP** — status should flip to `active`.

- [ ] **Step 4: Commit**

```bash
git add src/app/sops src/components/SopReviewTable.tsx
git commit -m "Add SOP upload, review, and activation UI"
```

---

## Task 14: Load report upload and scoring pipeline

**Files:**
- Create: `src/app/loads/new/page.tsx`
- Create: `src/app/loads/new/actions.ts`
- Create: `src/lib/load-scoring-pipeline.ts` (pure function: parsed load + active SOP params + aliases -> readings to insert)
- Test: `src/lib/load-scoring-pipeline.test.ts`

- [ ] **Step 1: Write the failing test for the pure scoring-pipeline function**

```ts
// src/lib/load-scoring-pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { buildLoadReadings } from './load-scoring-pipeline';
import type { StationReading } from './parsers/load-report-parser';
import type { SopParameter } from './db/sop';
import type { StationAlias } from './station-matching';

const sopParam: SopParameter = {
  id: 'p1', sopDocumentId: 'd1', stationGroupKey: 'Hot Water Rinsing::2', srNo: '3', stationNo: '2',
  process: 'Hot Water Rinsing', productChemical: 'Water', characteristic: 'Concentration (Water)',
  minValue: 50, maxValue: 70, unit: '°C', status: 'parsed', rawControlLimit: '50 – 70°C', rawSpecLimit: null,
};

const aliases: StationAlias[] = [
  { vendorId: 'v1', stationGroupKey: 'Hot Water Rinsing::2', loadReportStationName: 'Hot Water Rinse' },
];

function reading(overrides: Partial<StationReading>): StationReading {
  return {
    stationNo: 2, stationName: 'Hot Water Rinse',
    dipInTime: new Date(), dipOutTime: new Date(), dipTimeSeconds: 95,
    temperatureC: 39, ph: null, setCurrentAmp: null, actualCurrentAmp: null, ampHr: null,
    ...overrides,
  };
}

describe('buildLoadReadings', () => {
  it('matches a station via alias and scores its temperature against the SOP limit', () => {
    const readings = buildLoadReadings([reading({})], [sopParam], aliases);
    const temp = readings.find((r) => r.parameterName === 'Temperature');
    expect(temp).toMatchObject({ sopParameterId: 'p1', value: 39, score: 'fail' }); // 39 < 50 min
  });

  it('marks an unmatched station as unscored with a null sopParameterId', () => {
    const readings = buildLoadReadings([reading({ stationName: 'Drag out', stationNo: 27, temperatureC: null })], [sopParam], aliases);
    const temp = readings.find((r) => r.parameterName === 'Temperature');
    expect(temp).toMatchObject({ sopParameterId: null, score: 'unscored' });
  });

  it('always emits a Dip Time reading, unscored (no SOP dip-time limit modeled in this fixture)', () => {
    const readings = buildLoadReadings([reading({})], [sopParam], aliases);
    const dip = readings.find((r) => r.parameterName === 'Dip Time');
    expect(dip).toMatchObject({ value: 95, score: 'unscored' });
  });

  it('emits an Act. Current reading only when present on the station row', () => {
    const readings = buildLoadReadings([reading({ actualCurrentAmp: 502 })], [sopParam], aliases);
    const current = readings.find((r) => r.parameterName === 'Act. Current');
    expect(current).toMatchObject({ value: 502 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- load-scoring-pipeline`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/load-scoring-pipeline.ts
import type { StationReading } from './parsers/load-report-parser';
import type { SopParameter } from './db/sop';
import type { LoadReadingInput } from './db/load-reports';
import { findAliasForLoadReportStation } from './station-matching';
import { scoreReading } from './scoring';

export function buildLoadReadings(
  readings: StationReading[],
  activeParams: SopParameter[],
  aliases: import('./station-matching').StationAlias[],
): LoadReadingInput[] {
  const paramsByGroupKey = new Map(activeParams.map((p) => [p.stationGroupKey, p]));
  const result: LoadReadingInput[] = [];

  for (const reading of readings) {
    const alias = findAliasForLoadReportStation(aliases, reading.stationName);
    const param = alias ? paramsByGroupKey.get(alias.stationGroupKey) ?? null : null;

    if (reading.temperatureC !== null) {
      result.push({
        sopParameterId: param?.id ?? null, stationNo: reading.stationNo, stationName: reading.stationName,
        parameterName: 'Temperature', value: reading.temperatureC, dipTimeSeconds: reading.dipTimeSeconds,
        score: scoreReading(reading.temperatureC, param?.minValue ?? null, param?.maxValue ?? null),
      });
    }

    result.push({
      sopParameterId: null, stationNo: reading.stationNo, stationName: reading.stationName,
      parameterName: 'Dip Time', value: reading.dipTimeSeconds, dipTimeSeconds: reading.dipTimeSeconds,
      score: 'unscored',
    });

    if (reading.actualCurrentAmp !== null) {
      result.push({
        sopParameterId: param?.id ?? null, stationNo: reading.stationNo, stationName: reading.stationName,
        parameterName: 'Act. Current', value: reading.actualCurrentAmp, dipTimeSeconds: reading.dipTimeSeconds,
        score: scoreReading(reading.actualCurrentAmp, param?.minValue ?? null, param?.maxValue ?? null),
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- load-scoring-pipeline`
Expected: 4 passed.

- [ ] **Step 5: Wire up the upload action**

```ts
// src/app/loads/new/actions.ts
'use server';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { createLoadReport, loadNumberExists, insertLoadReadings } from '@/lib/db/load-reports';
import { getActiveSopParameters } from '@/lib/db/sop';
import { getVendorByName } from '@/lib/db/vendors';
import { parseLoadReportWorkbook } from '@/lib/parsers/load-report-parser';
import { buildLoadReadings } from '@/lib/load-scoring-pipeline';
import type { StationAlias } from '@/lib/station-matching';
import { redirect } from 'next/navigation';

export async function uploadLoadReport(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Not authenticated');

  const file = formData.get('loadFile') as File;
  const vendorName = formData.get('vendorName') as string;
  if (!file || file.size === 0) throw new Error('No file uploaded');

  const db = getDb();
  const vendor = getVendorByName(db, vendorName);
  if (!vendor) throw new Error(`Unknown vendor: ${vendorName}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseLoadReportWorkbook(buffer);

  if (loadNumberExists(db, vendor.id, parsed.metadata.loadNumber)) {
    throw new Error(`Load ${parsed.metadata.loadNumber} was already uploaded for ${vendorName}`);
  }

  const activeParams = getActiveSopParameters(db, vendor.id);
  if (activeParams.length === 0) {
    throw new Error(`${vendorName} has no active SOP yet — finish SOP review and activation first`);
  }

  const aliases = db
    .prepare('SELECT vendor_id AS vendorId, station_group_key AS stationGroupKey, load_report_station_name AS loadReportStationName FROM station_aliases WHERE vendor_id = ?')
    .all(vendor.id) as StationAlias[];

  const uploadDir = path.resolve('./Clients', vendorName, 'Uploads');
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
  await writeFile(filePath, buffer);

  const report = createLoadReport(db, {
    vendorId: vendor.id, loadNumber: parsed.metadata.loadNumber, filePath,
    partNumber: parsed.metadata.partNumber, totalWeightKg: parsed.metadata.totalWeightKg,
    loadInTime: parsed.metadata.loadInTime.toISOString(), loadOutTime: parsed.metadata.loadOutTime.toISOString(),
    totalTimeSeconds: parsed.metadata.totalTimeSeconds, uploadedBy: session.user.id,
  });

  insertLoadReadings(db, report.id, buildLoadReadings(parsed.readings, activeParams, aliases));

  redirect('/');
}
```

```tsx
// src/app/loads/new/page.tsx
import { uploadLoadReport } from './actions';

export default function NewLoadPage() {
  return (
    <main className="section">
      <h1><span className="accent-bar" />Upload Load Report</h1>
      <form action={uploadLoadReport}>
        <label>
          Vendor
          <select name="vendorName" defaultValue="Unique Platers">
            <option value="Unique Platers">Unique Platers</option>
          </select>
        </label>
        <label>
          Load report file (.xls)
          <input type="file" name="loadFile" accept=".xls" required />
        </label>
        <button type="submit">Upload & Score</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Manual smoke test with the real load report**

With the SOP from Task 13 activated, go to `/loads/new`, upload `Clients/Unique Platers/Uploads/OK LoadReport_2025-08-18_003 (1) - Copy.xls`.
Expected: redirects to `/` without error. Re-uploading the same file should now throw "Load 2025-08-18_003 was already uploaded" (duplicate guard).

- [ ] **Step 7: Commit**

```bash
git add src/lib/load-scoring-pipeline.ts src/lib/load-scoring-pipeline.test.ts src/app/loads
git commit -m "Add load report upload, station matching, and scoring pipeline"
```

---

## Task 15: Manual check entry

**Files:**
- Create: `src/app/inspections/page.tsx`
- Create: `src/app/inspections/new/page.tsx`
- Create: `src/app/inspections/new/actions.ts`

- [ ] **Step 1: Implement the entry action**

```ts
// src/app/inspections/new/actions.ts
'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { createManualCheck } from '@/lib/db/manual-checks';
import { scoreReading } from '@/lib/scoring';
import { redirect } from 'next/navigation';

export async function submitManualCheck(formData: FormData) {
  const session = await auth();
  if (!session?.user?.vendorId) throw new Error('Not authenticated as a vendor user');

  const sopParameterId = formData.get('sopParameterId') as string;
  const value = Number(formData.get('value'));

  const db = getDb();
  const param = db
    .prepare('SELECT min_value AS minValue, max_value AS maxValue FROM sop_parameters WHERE id = ?')
    .get(sopParameterId) as { minValue: number | null; maxValue: number | null } | undefined;
  if (!param) throw new Error('Unknown SOP parameter');

  const score = scoreReading(value, param.minValue, param.maxValue);
  if (score === 'unscored') throw new Error('This parameter has no usable limit to check against yet');

  createManualCheck(db, {
    vendorId: session.user.vendorId, sopParameterId, value,
    checkedAt: new Date().toISOString(), enteredBy: session.user.id, score,
  });

  redirect('/inspections');
}
```

```tsx
// src/app/inspections/new/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getActiveSopParameters } from '@/lib/db/sop';
import { submitManualCheck } from './actions';

export default async function NewInspectionPage() {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user to log a check.</main>;

  const params = getActiveSopParameters(getDb(), session.user.vendorId).filter((p) => p.status === 'parsed');

  return (
    <main className="section">
      <h1><span className="accent-bar" />Log a manual check</h1>
      <form action={submitManualCheck}>
        <label>
          Parameter
          <select name="sopParameterId" required>
            {params.map((p) => (
              <option key={p.id} value={p.id}>
                {p.process} — {p.characteristic} ({p.minValue}–{p.maxValue} {p.unit})
              </option>
            ))}
          </select>
        </label>
        <label>
          Value
          <input type="number" step="any" name="value" required />
        </label>
        <button type="submit">Log Check</button>
      </form>
    </main>
  );
}
```

```tsx
// src/app/inspections/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getManualChecksForVendor } from '@/lib/db/manual-checks';
import Link from 'next/link';

export default async function InspectionsPage() {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user to view checks.</main>;

  const checks = getManualChecksForVendor(getDb(), session.user.vendorId);

  return (
    <main className="section">
      <h1><span className="accent-bar" />Manual Check Log</h1>
      <Link href="/inspections/new">Log a new check</Link>
      <table>
        <thead><tr><th>Checked At</th><th>Value</th><th>Score</th></tr></thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} className={c.score === 'fail' ? 'out-of-limit' : ''}>
              <td>{c.checkedAt}</td><td>{c.value}</td><td>{c.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Sign in as `vendor@unique-platers.local`, go to `/inspections/new`, log a check against a `parsed`-status parameter (e.g. the Hot Water Rinsing temperature), submit, confirm it appears at `/inspections` with the correct `pass`/`fail` score.

- [ ] **Step 3: Commit**

```bash
git add src/app/inspections
git commit -m "Add manual lab-check entry form and log, scored against active SOP limits"
```

---

## Task 16: Dashboard data layer

Shared query functions used by every dashboard tab, so filter state means the same thing everywhere.

**Files:**
- Create: `src/lib/dashboard-queries.ts`
- Test: `src/lib/dashboard-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dashboard-queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from './db/client';
import { createVendor } from './db/vendors';
import { createUser } from './db/users';
import { createDraftSopDocument, insertSopParameters, activateSopDocument } from './db/sop';
import { createLoadReport, insertLoadReadings } from './db/load-reports';
import { getKpis, getFilteredReadings } from './dashboard-queries';

let db: Database.Database;
let vendorId: string;
let paramId: string;

beforeEach(() => {
  db = createDb(':memory:');
  const vendor = createVendor(db, { name: 'Unique Platers', processName: 'Plating' });
  vendorId = vendor.id;
  const user = createUser(db, { email: 'a@a.local', passwordHash: 'h', role: 'admin', vendorId: null });
  const doc = createDraftSopDocument(db, { vendorId, filePath: '/x', uploadedBy: user.id });
  const [param] = insertSopParameters(db, doc.id, [
    { stationGroupKey: 'k', srNo: '3', stationNo: '2', process: 'Hot Water Rinsing', productChemical: null, characteristic: null, minValue: 50, maxValue: 70, unit: '°C', status: 'parsed', rawControlLimit: 'x', rawSpecLimit: null },
  ]);
  paramId = param.id;
  activateSopDocument(db, doc.id, vendorId);

  const report = createLoadReport(db, {
    vendorId, loadNumber: 'L1', filePath: '/x', partNumber: 'P1', totalWeightKg: 60,
    loadInTime: '2026-08-01T00:00:00.000Z', loadOutTime: '2026-08-01T01:00:00.000Z',
    totalTimeSeconds: 3600, uploadedBy: user.id,
  });
  insertLoadReadings(db, report.id, [
    { sopParameterId: paramId, stationNo: 2, stationName: 'Hot Water Rinse', parameterName: 'Temperature', value: 39, dipTimeSeconds: 95, score: 'fail' },
    { sopParameterId: paramId, stationNo: 2, stationName: 'Hot Water Rinse', parameterName: 'Temperature', value: 55, dipTimeSeconds: 95, score: 'pass' },
  ]);
});

describe('getKpis', () => {
  it('computes pass rate and out-of-limit count over all readings for the vendor', () => {
    const kpis = getKpis(db, vendorId, {});
    expect(kpis.totalReadings).toBe(2);
    expect(kpis.passRate).toBeCloseTo(0.5);
    expect(kpis.outOfLimitCount).toBe(1);
  });
});

describe('getFilteredReadings', () => {
  it('filters to only failing readings when result=fail', () => {
    const rows = getFilteredReadings(db, vendorId, { result: 'fail' });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(39);
  });

  it('returns all readings with no filter', () => {
    expect(getFilteredReadings(db, vendorId, {})).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- dashboard-queries`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/lib/dashboard-queries.ts
import type Database from 'better-sqlite3';

export interface DashboardFilters {
  from?: string;
  to?: string;
  parameterName?: string;
  result?: 'pass' | 'fail';
}

export interface Kpis {
  totalReadings: number;
  passRate: number;
  outOfLimitCount: number;
}

interface ReadingRow {
  id: string;
  stationName: string;
  parameterName: string;
  value: number | null;
  score: string;
  loadNumber: string;
  uploadedAt: string;
}

function whereClause(vendorId: string, filters: DashboardFilters): { sql: string; args: unknown[] } {
  const conditions = ['lr.vendor_id = ?', "r.score != 'unscored'"];
  const args: unknown[] = [vendorId];

  if (filters.parameterName) {
    conditions.push('r.parameter_name = ?');
    args.push(filters.parameterName);
  }
  if (filters.result) {
    conditions.push('r.score = ?');
    args.push(filters.result);
  }
  if (filters.from) {
    conditions.push('lr.uploaded_at >= ?');
    args.push(filters.from);
  }
  if (filters.to) {
    conditions.push('lr.uploaded_at <= ?');
    args.push(filters.to);
  }

  return { sql: conditions.join(' AND '), args };
}

export function getKpis(db: Database.Database, vendorId: string, filters: DashboardFilters): Kpis {
  const { sql, args } = whereClause(vendorId, filters);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
              SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS fails
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE ${sql}`,
    )
    .get(...args) as { total: number; passes: number; fails: number };

  return {
    totalReadings: row.total,
    passRate: row.total > 0 ? row.passes / row.total : 0,
    outOfLimitCount: row.fails,
  };
}

export function getFilteredReadings(db: Database.Database, vendorId: string, filters: DashboardFilters): ReadingRow[] {
  const { sql, args } = whereClause(vendorId, filters);
  return db
    .prepare(
      `SELECT r.id, r.station_name AS stationName, r.parameter_name AS parameterName, r.value, r.score,
              lr.load_number AS loadNumber, lr.uploaded_at AS uploadedAt
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE ${sql} ORDER BY lr.uploaded_at DESC`,
    )
    .all(...args) as ReadingRow[];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- dashboard-queries`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard-queries.ts src/lib/dashboard-queries.test.ts
git commit -m "Add shared dashboard KPI and filtered-readings query layer"
```

---

## Task 17: Dashboard shell — KPI strip, filter bar, Table tab

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/KpiStrip.tsx`
- Create: `src/components/FilterBar.tsx`
- Create: `src/components/DashboardTabs.tsx`
- Create: `src/app/globals.css` (design system from `design-spec.md`, replacing the scaffolded default)

- [ ] **Step 1: Apply the visual design system**

```css
/* src/app/globals.css */
:root {
  --color-navy-primary: #1B2A4A;
  --color-navy-deep: #14213D;
  --color-red-accent: #BF1E2E;
  --color-white: #FFFFFF;
  --color-text-body: #1C1C1C;
  --color-text-heading: #333333;
  --color-bg-light-gray: #F2F2F2;
  --color-nav-link: #000000;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Mulish', system-ui, sans-serif;
  color: var(--color-text-body);
  background: var(--color-white);
}
h1, h2, h3 {
  font-family: 'Share Tech', monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-heading);
}
.accent-bar {
  display: inline-block;
  width: 4px;
  height: 1em;
  background: var(--color-red-accent);
  margin-right: 8px;
  vertical-align: middle;
}
.section { max-width: 1080px; margin: 0 auto; padding: 24px 16px; }
button {
  background: var(--color-red-accent);
  color: var(--color-white);
  border: none;
  border-radius: 0;
  padding: 10px 20px;
  font-family: 'Share Tech', monospace;
  text-transform: uppercase;
  cursor: pointer;
}
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
tr.out-of-limit, tr.needs-review { background: #fdecea; }
```

- [ ] **Step 2: KPI strip and filter bar components**

```tsx
// src/components/KpiStrip.tsx
import type { Kpis } from '@/lib/dashboard-queries';

export function KpiStrip({ kpis }: { kpis: Kpis }) {
  return (
    <div className="kpi-strip" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <div className="kpi-card">Pass Rate<br /><strong>{Math.round(kpis.passRate * 100)}%</strong></div>
      <div className="kpi-card">Scored Readings<br /><strong>{kpis.totalReadings}</strong></div>
      <div className="kpi-card">Out of Limit<br /><strong>{kpis.outOfLimitCount}</strong></div>
    </div>
  );
}
```

```tsx
// src/components/FilterBar.tsx
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="filter-bar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <label>
        Result
        <select defaultValue={searchParams.get('result') ?? ''} onChange={(e) => setParam('result', e.target.value)}>
          <option value="">All</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </select>
      </label>
      <label>
        Parameter
        <input
          defaultValue={searchParams.get('parameterName') ?? ''}
          onBlur={(e) => setParam('parameterName', e.target.value)}
          placeholder="e.g. Temperature"
        />
      </label>
    </div>
  );
}
```

```tsx
// src/components/DashboardTabs.tsx
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
    <nav style={{ display: 'flex', gap: 16, borderBottom: '2px solid var(--color-navy-primary)', marginBottom: 16 }}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={query ? `${tab.href}?${query}` : tab.href}
          style={{ fontWeight: pathname === tab.href ? 700 : 400 }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Table tab (dashboard home)**

```tsx
// src/app/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getKpis, getFilteredReadings, type DashboardFilters } from '@/lib/dashboard-queries';
import { KpiStrip } from '@/components/KpiStrip';
import { FilterBar } from '@/components/FilterBar';
import { DashboardTabs } from '@/components/DashboardTabs';

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string> }) {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user to see the dashboard.</main>;

  const filters: DashboardFilters = {
    result: searchParams.result as 'pass' | 'fail' | undefined,
    parameterName: searchParams.parameterName || undefined,
  };

  const db = getDb();
  const kpis = getKpis(db, session.user.vendorId, filters);
  const readings = getFilteredReadings(db, session.user.vendorId, filters);

  return (
    <main className="section">
      <h1><span className="accent-bar" />Vendor Dashboard</h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      <FilterBar />
      <table>
        <thead><tr><th>Load</th><th>Station</th><th>Parameter</th><th>Value</th><th>Score</th></tr></thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}>
              <td>{r.loadNumber}</td><td>{r.stationName}</td><td>{r.parameterName}</td><td>{r.value}</td><td>{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Manual smoke test**

Sign in as `vendor@unique-platers.local`, confirm the KPI strip and table render with the readings from the load uploaded in Task 14, and that the Result filter narrows the table correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css src/components/KpiStrip.tsx src/components/FilterBar.tsx src/components/DashboardTabs.tsx
git commit -m "Add dashboard shell: design system, KPI strip, filter bar, Table tab"
```

---

## Task 18: Trends tab

**Files:**
- Create: `src/app/trends/page.tsx`
- Create: `src/lib/dashboard-queries.ts` (extend: add `getParameterTrend`)
- Test: extend `src/lib/dashboard-queries.test.ts`

- [ ] **Step 1: Add a failing test for the trend query**

Append to `src/lib/dashboard-queries.test.ts`:

```ts
describe('getParameterTrend', () => {
  it('returns readings for one parameter in chronological order with pass/fail flags', () => {
    const trend = getParameterTrend(db, vendorId, 'Temperature');
    expect(trend).toHaveLength(2);
    expect(trend.map((t) => t.score)).toEqual(['fail', 'pass']);
  });
});
```

Add the import: `import { getKpis, getFilteredReadings, getParameterTrend } from './dashboard-queries';`

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- dashboard-queries`
Expected: FAIL — `getParameterTrend` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dashboard-queries.ts`:

```ts
export interface TrendPoint {
  loadNumber: string;
  uploadedAt: string;
  value: number | null;
  score: string;
}

export function getParameterTrend(db: Database.Database, vendorId: string, parameterName: string): TrendPoint[] {
  return db
    .prepare(
      `SELECT lr.load_number AS loadNumber, lr.uploaded_at AS uploadedAt, r.value, r.score
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.parameter_name = ? AND r.score != 'unscored'
       ORDER BY lr.uploaded_at ASC`,
    )
    .all(vendorId, parameterName) as TrendPoint[];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- dashboard-queries`
Expected: 4 passed.

- [ ] **Step 5: Build the Trends page**

```tsx
// src/app/trends/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getKpis, getParameterTrend } from '@/lib/dashboard-queries';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

export default async function TrendsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user.</main>;

  const parameterName = searchParams.parameterName || 'Temperature';
  const db = getDb();
  const kpis = getKpis(db, session.user.vendorId, {});
  const trend = getParameterTrend(db, session.user.vendorId, parameterName);

  return (
    <main className="section">
      <h1><span className="accent-bar" />Vendor Dashboard</h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      <h2>Trend — {parameterName}</h2>
      <table>
        <thead><tr><th>Load</th><th>Uploaded</th><th>Value</th><th>Score</th></tr></thead>
        <tbody>
          {trend.map((t, i) => (
            <tr key={i} className={t.score === 'fail' ? 'out-of-limit' : ''}>
              <td>{t.loadNumber}</td><td>{t.uploadedAt}</td><td>{t.value}</td><td>{t.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {trend.length === 0 && <p>No scored readings yet for {parameterName}. Upload more load reports to see a trend.</p>}
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/trends src/lib/dashboard-queries.ts src/lib/dashboard-queries.test.ts
git commit -m "Add Trends tab with per-parameter chronological readings"
```

---

## Task 19: Hotspots tab

**Files:**
- Create: `src/app/hotspots/page.tsx`
- Extend: `src/lib/dashboard-queries.ts` (add `getStationHotspots`, `getParameterHotspots`)
- Test: extend `src/lib/dashboard-queries.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/lib/dashboard-queries.test.ts`:

```ts
describe('hotspot rankings', () => {
  it('ranks stations by fail count', () => {
    const stations = getStationHotspots(db, vendorId);
    expect(stations[0]).toMatchObject({ stationName: 'Hot Water Rinse', failCount: 1 });
  });

  it('ranks parameters by fail count', () => {
    const params = getParameterHotspots(db, vendorId);
    expect(params[0]).toMatchObject({ parameterName: 'Temperature', failCount: 1 });
  });
});
```

Update the import to include `getStationHotspots, getParameterHotspots`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- dashboard-queries`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dashboard-queries.ts`:

```ts
export interface HotspotRow {
  failCount: number;
}

export function getStationHotspots(db: Database.Database, vendorId: string): (HotspotRow & { stationName: string })[] {
  return db
    .prepare(
      `SELECT r.station_name AS stationName, COUNT(*) AS failCount
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.score = 'fail'
       GROUP BY r.station_name ORDER BY failCount DESC`,
    )
    .all(vendorId) as (HotspotRow & { stationName: string })[];
}

export function getParameterHotspots(db: Database.Database, vendorId: string): (HotspotRow & { parameterName: string })[] {
  return db
    .prepare(
      `SELECT r.parameter_name AS parameterName, COUNT(*) AS failCount
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.score = 'fail'
       GROUP BY r.parameter_name ORDER BY failCount DESC`,
    )
    .all(vendorId) as (HotspotRow & { parameterName: string })[];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- dashboard-queries`
Expected: 6 passed.

- [ ] **Step 5: Build the Hotspots page**

```tsx
// src/app/hotspots/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getKpis, getStationHotspots, getParameterHotspots } from '@/lib/dashboard-queries';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

export default async function HotspotsPage() {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user.</main>;

  const db = getDb();
  const kpis = getKpis(db, session.user.vendorId, {});
  const stations = getStationHotspots(db, session.user.vendorId);
  const params = getParameterHotspots(db, session.user.vendorId);

  return (
    <main className="section">
      <h1><span className="accent-bar" />Vendor Dashboard</h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <h2>Most-failed stations</h2>
          <ol>{stations.map((s) => <li key={s.stationName}>{s.stationName} — {s.failCount}</li>)}</ol>
        </div>
        <div>
          <h2>Most-failed parameters</h2>
          <ol>{params.map((p) => <li key={p.parameterName}>{p.parameterName} — {p.failCount}</li>)}</ol>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/hotspots src/lib/dashboard-queries.ts src/lib/dashboard-queries.test.ts
git commit -m "Add Hotspots tab: station and parameter fail-count rankings"
```

---

## Task 20: Compare tab

**Files:**
- Create: `src/app/compare/page.tsx`
- Extend: `src/lib/dashboard-queries.ts` (add `getLoadReadingsByLoadNumber`, `listLoadNumbers`)
- Test: extend `src/lib/dashboard-queries.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/lib/dashboard-queries.test.ts`:

```ts
describe('load comparison', () => {
  it('lists distinct load numbers for a vendor', () => {
    expect(listLoadNumbers(db, vendorId)).toEqual(['L1']);
  });

  it('fetches all readings for one load number', () => {
    const rows = getLoadReadingsByLoadNumber(db, vendorId, 'L1');
    expect(rows).toHaveLength(2);
  });
});
```

Update the import to include `listLoadNumbers, getLoadReadingsByLoadNumber`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- dashboard-queries`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dashboard-queries.ts`:

```ts
export function listLoadNumbers(db: Database.Database, vendorId: string): string[] {
  return (
    db
      .prepare('SELECT DISTINCT load_number AS loadNumber FROM load_reports WHERE vendor_id = ? ORDER BY load_number')
      .all(vendorId) as { loadNumber: string }[]
  ).map((r) => r.loadNumber);
}

export function getLoadReadingsByLoadNumber(db: Database.Database, vendorId: string, loadNumber: string): ReadingRow[] {
  return db
    .prepare(
      `SELECT r.id, r.station_name AS stationName, r.parameter_name AS parameterName, r.value, r.score,
              lr.load_number AS loadNumber, lr.uploaded_at AS uploadedAt
       FROM load_readings r JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND lr.load_number = ?`,
    )
    .all(vendorId, loadNumber) as ReadingRow[];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- dashboard-queries`
Expected: 8 passed.

- [ ] **Step 5: Build the Compare page**

```tsx
// src/app/compare/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getKpis, listLoadNumbers, getLoadReadingsByLoadNumber } from '@/lib/dashboard-queries';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

export default async function ComparePage({ searchParams }: { searchParams: Record<string, string> }) {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user.</main>;

  const db = getDb();
  const kpis = getKpis(db, session.user.vendorId, {});
  const loadNumbers = listLoadNumbers(db, session.user.vendorId);
  const loadA = searchParams.a || loadNumbers[0];
  const loadB = searchParams.b || loadNumbers[1];
  const readingsA = loadA ? getLoadReadingsByLoadNumber(db, session.user.vendorId, loadA) : [];
  const readingsB = loadB ? getLoadReadingsByLoadNumber(db, session.user.vendorId, loadB) : [];

  return (
    <main className="section">
      <h1><span className="accent-bar" />Vendor Dashboard</h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      <h2>Compare loads</h2>
      <div className="split" style={{ display: 'flex', gap: 24 }}>
        <div>
          <h3>{loadA ?? 'No load selected'}</h3>
          <table>
            <tbody>
              {readingsA.map((r) => <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}><td>{r.stationName}</td><td>{r.parameterName}</td><td>{r.value}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <h3>{loadB ?? 'No load selected'}</h3>
          <table>
            <tbody>
              {readingsB.map((r) => <tr key={r.id} className={r.score === 'fail' ? 'out-of-limit' : ''}><td>{r.stationName}</td><td>{r.parameterName}</td><td>{r.value}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/compare src/lib/dashboard-queries.ts src/lib/dashboard-queries.test.ts
git commit -m "Add Compare tab: side-by-side station readings for two loads"
```

---

## Task 21: Capability tab

**Files:**
- Create: `src/app/capability/page.tsx`
- Extend: `src/lib/dashboard-queries.ts` (add `getParameterCapability`)
- Test: extend `src/lib/dashboard-queries.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `src/lib/dashboard-queries.test.ts`:

```ts
describe('getParameterCapability', () => {
  it('computes average distance from the nearest limit for a parameter', () => {
    // readings: 39 (min 50, distance -11, i.e. 11 below min) and 55 (min 50 max 70, distance 5 from min, 15 from max -> nearest 5)
    const capability = getParameterCapability(db, vendorId, 'Temperature');
    expect(capability.parameterName).toBe('Temperature');
    expect(capability.sampleCount).toBe(2);
    expect(capability.avgDistanceFromLimit).toBeCloseTo((-11 + 5) / 2);
  });
});
```

Update the import to include `getParameterCapability`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- dashboard-queries`
Expected: FAIL — function not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dashboard-queries.ts`:

```ts
export interface CapabilityResult {
  parameterName: string;
  sampleCount: number;
  avgDistanceFromLimit: number | null;
}

/**
 * Distance from the nearest limit, signed: negative means the reading was outside the
 * limit on that side, positive means it was inside with that much headroom.
 */
export function getParameterCapability(db: Database.Database, vendorId: string, parameterName: string): CapabilityResult {
  const rows = db
    .prepare(
      `SELECT r.value, p.min_value AS minValue, p.max_value AS maxValue
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       JOIN sop_parameters p ON p.id = r.sop_parameter_id
       WHERE lr.vendor_id = ? AND r.parameter_name = ? AND r.value IS NOT NULL`,
    )
    .all(vendorId, parameterName) as { value: number; minValue: number | null; maxValue: number | null }[];

  if (rows.length === 0) return { parameterName, sampleCount: 0, avgDistanceFromLimit: null };

  const distances = rows.map(({ value, minValue, maxValue }) => {
    const distToMin = minValue !== null ? value - minValue : Infinity;
    const distToMax = maxValue !== null ? maxValue - value : Infinity;
    return Math.min(distToMin, distToMax);
  });

  const avg = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  return { parameterName, sampleCount: rows.length, avgDistanceFromLimit: avg };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- dashboard-queries`
Expected: 9 passed.

- [ ] **Step 5: Build the Capability page**

```tsx
// src/app/capability/page.tsx
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getKpis, getParameterCapability } from '@/lib/dashboard-queries';
import { KpiStrip } from '@/components/KpiStrip';
import { DashboardTabs } from '@/components/DashboardTabs';

const TRACKED_PARAMETERS = ['Temperature', 'Act. Current'];

export default async function CapabilityPage() {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user.</main>;

  const db = getDb();
  const kpis = getKpis(db, session.user.vendorId, {});
  const results = TRACKED_PARAMETERS.map((name) => getParameterCapability(db, session.user!.vendorId!, name));

  return (
    <main className="section">
      <h1><span className="accent-bar" />Vendor Dashboard</h1>
      <KpiStrip kpis={kpis} />
      <DashboardTabs />
      <h2>Process capability</h2>
      <table>
        <thead><tr><th>Parameter</th><th>Samples</th><th>Avg. distance from nearest limit</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.parameterName} className={r.avgDistanceFromLimit !== null && r.avgDistanceFromLimit < 0 ? 'out-of-limit' : ''}>
              <td>{r.parameterName}</td>
              <td>{r.sampleCount}</td>
              <td>{r.avgDistanceFromLimit === null ? 'No scored data yet' : r.avgDistanceFromLimit.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Positive = average headroom inside the limit. Negative = averaging outside the limit.</p>
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/capability src/lib/dashboard-queries.ts src/lib/dashboard-queries.test.ts
git commit -m "Add Capability tab: average distance-from-limit per parameter"
```

---

## Task 22: App shell, navigation, and full manual walkthrough

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Build the shared navy/white app shell**

```tsx
// src/components/AppShell.tsx
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header style={{ background: 'var(--color-navy-primary)', color: 'var(--color-white)', padding: '8px 16px' }}>
        Royal Enfield Vendor Quality
      </header>
      <nav style={{ background: 'var(--color-white)', borderBottom: '1px solid #ddd', padding: '8px 16px', display: 'flex', gap: 16 }}>
        <Link href="/">Dashboard</Link>
        <Link href="/sops">SOPs</Link>
        <Link href="/loads/new">Upload Load</Link>
        <Link href="/inspections">Inspections</Link>
      </nav>
      {children}
      <footer style={{ borderTop: '2px solid var(--color-navy-primary)', padding: '16px', marginTop: 32, fontSize: 12 }}>
        Royal Enfield Vendor Quality — local build
      </footer>
    </>
  );
}
```

```tsx
// src/app/layout.tsx
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata = { title: 'Royal Enfield Vendor Quality' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run the full automated test suite**

Run: `npm test`
Expected: every suite passes (parsers, scoring, matching, db/repository, dashboard-queries, load-scoring-pipeline — 60+ tests total).

- [ ] **Step 3: Full manual end-to-end walkthrough**

Starting from a clean `./data/vendor-quality.sqlite` (delete it and re-run `npm run seed` if it already has data from earlier tasks):

1. `npm run dev`, sign in as `admin@leadership-fractal.local` / `Admin@123`.
2. `/sops/new` → upload `Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx` → confirm 104 rows appear, with `needs_review` rows visibly flagged.
3. On the review screen, set station aliases for at least: Hot Water Rinsing→"Hot Water Rinse", Alkaline Zinc Iron Plating (Barrel)→"Zinc Iron  plating 2" (matching Task 8's seed pairs — this step exists so the reviewer can see the pre-seeded aliases can also be entered/edited by hand).
4. Click **Activate SOP** → confirm status becomes `active`.
5. `/loads/new` → upload `Clients/Unique Platers/Uploads/OK LoadReport_2025-08-18_003 (1) - Copy.xls` → confirm no error and redirect to `/`.
6. On `/`, confirm the KPI strip shows non-zero scored readings, and the Hot Water Rinse Temperature reading (39°C against a 50–70°C limit) appears flagged `fail` in red.
7. Re-upload the same load report file → confirm it's rejected with the duplicate-load-number error.
8. Sign out, sign in as `vendor@unique-platers.local` / `Vendor@123`.
9. `/inspections/new` → log a manual check against a `parsed` SOP parameter → confirm it appears at `/inspections` with the correct score.
10. Click through **Trends**, **Hotspots**, **Compare**, **Capability** tabs → confirm each renders without error and reflects the uploaded load's data.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppShell.tsx src/app/layout.tsx
git commit -m "Add app shell navigation and complete the end-to-end walkthrough"
```

---

## Self-review notes

**Spec coverage:** every §-numbered section of the design spec maps to a task — §4 data model → Task 9; §5 SOP pipeline → Tasks 3–4, 13; §6 load report pipeline → Tasks 5, 7–8, 14; §7 manual checks → Task 15; §8 dashboard tabs → Tasks 16–21; §9 visual system → Task 17/22; §10 error handling → duplicate-load guard (Task 14), no-active-SOP guard (Task 14), unmatched-station handling (Task 14/7), draft-vs-active isolation (Task 10); §11 testing → parser golden tests (Tasks 4–5), scoring boundary tests (Task 6), manual smoke test (Task 22).

**Deferred by design (per spec §8):** Alarm/Event sheet ingestion, high-frequency `Data` sheet, `GraphPlot` sheet — intentionally out of scope for this plan.

**Known MVP limitation carried forward from Task 8:** `findAliasForLoadReportStation` resolves a repeated load-report station name (e.g. "Cascade Rinse", which appears at ~12 different SOP rinse steps) to only the first seeded alias. Extending matching to disambiguate repeated station names by load-report `Station No` position is a reasonable follow-up once a second load report is available to validate the approach against, not part of this plan.
