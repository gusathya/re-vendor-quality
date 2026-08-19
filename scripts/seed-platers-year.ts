/**
 * scripts/seed-platers-year.ts
 *
 * Seeds 1 year (Aug 2025 → Aug 2026) of realistic Unique Platers batch data:
 *  - 125 batches spread across 13 months
 *  - 20 plating-process SOP parameters with real alkaline Zn-Fe limits
 *  - Seasonal quality variation (winter dip Dec-Jan, recovery through mid-2026)
 *  - Realistic push notes, review notes, batch events, part numbers
 *  - Re-run safe: removes synthetic batches (file_path LIKE 'synthetic/UP-%') first
 *
 * Usage:  npm run seed:platers
 */

import { createDb } from '../src/lib/db/client';
import { randomUUID } from 'node:crypto';

const DB_PATH = process.env.DATABASE_PATH ?? './data/vendor-quality.sqlite';

// ── helpers ───────────────────────────────────────────────────────────────────

function rand(lo: number, hi: number): number { return lo + Math.random() * (hi - lo); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

function fmtDt(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ── SOP parameter definitions for Alkaline Zinc Iron Plating (Barrel) ─────────

interface ParamDef {
  srNo: string;
  stationNo: number;
  stationName: string;  // name as it appears in load readings
  process: string;
  characteristic: string;
  productChemical: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  center: number;   // nominal target value
  halfRange: number; // typical variation (radius of passing zone)
}

const PARAM_DEFS: ParamDef[] = [
  // Station 2 – Hot Water Rinse
  { srNo: '1',  stationNo: 2,  stationName: 'Hot Water Rinse',          process: 'Hot Water Rinsing',                    characteristic: 'Temperature',        productChemical: 'Water',                minValue: 60,   maxValue: 80,   unit: '°C',    center: 70,    halfRange: 6    },

  // Station 3 – Alkaline Emulsion Cleaning
  { srNo: '2',  stationNo: 3,  stationName: 'Alkaline Emulsion Cleaning', process: 'Alkaline Emulsion Clean',             characteristic: 'Temperature',        productChemical: 'Emulsion Cleaner',     minValue: 60,   maxValue: 80,   unit: '°C',    center: 70,    halfRange: 7    },
  { srNo: '3',  stationNo: 3,  stationName: 'Alkaline Emulsion Cleaning', process: 'Alkaline Emulsion Clean',             characteristic: 'Concentration',      productChemical: 'Emulsion Cleaner',     minValue: 40,   maxValue: 60,   unit: 'g/L',   center: 50,    halfRange: 7    },

  // Station 4 – Alkaline Soak Cleaning
  { srNo: '4',  stationNo: 4,  stationName: 'Alkaline Soak Cleaning',   process: 'Alkaline Soak Cleaning',               characteristic: 'Temperature',        productChemical: 'Soak Cleaner',         minValue: 55,   maxValue: 75,   unit: '°C',    center: 65,    halfRange: 7    },
  { srNo: '5',  stationNo: 4,  stationName: 'Alkaline Soak Cleaning',   process: 'Alkaline Soak Cleaning',               characteristic: 'Free Alkali',        productChemical: 'Soak Cleaner',         minValue: 25,   maxValue: 45,   unit: 'g/L',   center: 35,    halfRange: 7    },

  // Station 5 – Cascade Rinse
  { srNo: '6',  stationNo: 5,  stationName: 'Cascade Rinse',            process: 'Cascading Rinsing',                    characteristic: 'pH',                 productChemical: 'Water',                minValue: 6.5,  maxValue: 8.0,  unit: 'pH',    center: 7.2,   halfRange: 0.5  },

  // Station 7 – De-Scaling (max-only limit: pH ≤ 2.0)
  { srNo: '7',  stationNo: 7,  stationName: 'Alk. De Scaling',          process: 'De-Scaling',                           characteristic: 'pH',                 productChemical: 'De-scaler',            minValue: null, maxValue: 2.0,  unit: 'pH',    center: 1.4,   halfRange: 0.3  },

  // Station 10 – HCL Pickling
  { srNo: '8',  stationNo: 10, stationName: 'Acid (HCL ) Pickling',     process: 'Acid Cleaning Comm. HCL',              characteristic: 'HCl Concentration',  productChemical: 'Hydrochloric Acid',    minValue: 15,   maxValue: 25,   unit: '%',     center: 20,    halfRange: 3.5  },
  { srNo: '9',  stationNo: 10, stationName: 'Acid (HCL ) Pickling',     process: 'Acid Cleaning Comm. HCL',              characteristic: 'Temperature',        productChemical: 'Hydrochloric Acid',    minValue: 20,   maxValue: 30,   unit: '°C',    center: 25,    halfRange: 3    },

  // Station 13 – Single Rinse
  { srNo: '10', stationNo: 13, stationName: 'Single Rinse',             process: 'Water Rinsing',                        characteristic: 'pH',                 productChemical: 'Water',                minValue: 6.5,  maxValue: 8.0,  unit: 'pH',    center: 7.1,   halfRange: 0.5  },

  // Station 14 – Anodic Cleaning
  { srNo: '11', stationNo: 14, stationName: 'Alkaline Anodic Cleaning', process: 'Anodic Cleaning',                      characteristic: 'Temperature',        productChemical: 'Anodic Cleaner',       minValue: 60,   maxValue: 75,   unit: '°C',    center: 67,    halfRange: 6    },
  { srNo: '12', stationNo: 14, stationName: 'Alkaline Anodic Cleaning', process: 'Anodic Cleaning',                      characteristic: 'Current Density',    productChemical: 'Anodic Cleaner',       minValue: 3,    maxValue: 8,    unit: 'A/dm²', center: 5.5,   halfRange: 1.5  },

  // Station 17 – HCL 6% Dip
  { srNo: '13', stationNo: 17, stationName: 'HCL 6 % dip',             process: 'HCL Dip',                              characteristic: 'HCl Concentration',  productChemical: 'Hydrochloric Acid',    minValue: 5.5,  maxValue: 7.5,  unit: '%',     center: 6.0,   halfRange: 0.7  },

  // Station 20 – Zinc Iron Plating (6 parameters — the heart of the process)
  { srNo: '14', stationNo: 20, stationName: 'Zinc Iron  plating 2',     process: 'Alkaline Zinc Iron Plating (Barrel)', characteristic: 'pH',                 productChemical: 'Zn-Fe Bath',           minValue: 8.5,  maxValue: 9.5,  unit: 'pH',    center: 9.0,   halfRange: 0.4  },
  { srNo: '15', stationNo: 20, stationName: 'Zinc Iron  plating 2',     process: 'Alkaline Zinc Iron Plating (Barrel)', characteristic: 'Temperature',        productChemical: 'Zn-Fe Bath',           minValue: 25,   maxValue: 30,   unit: '°C',    center: 27.5,  halfRange: 1.8  },
  { srNo: '16', stationNo: 20, stationName: 'Zinc Iron  plating 2',     process: 'Alkaline Zinc Iron Plating (Barrel)', characteristic: 'Iron Content',       productChemical: 'Zn-Fe Bath',           minValue: 0.3,  maxValue: 0.6,  unit: '%',     center: 0.45,  halfRange: 0.1  },
  { srNo: '17', stationNo: 20, stationName: 'Zinc Iron  plating 2',     process: 'Alkaline Zinc Iron Plating (Barrel)', characteristic: 'Brightener',         productChemical: 'Brightener Additive',  minValue: 3,    maxValue: 5,    unit: 'mL/L',  center: 4.0,   halfRange: 0.7  },
  { srNo: '18', stationNo: 20, stationName: 'Zinc Iron  plating 2',     process: 'Alkaline Zinc Iron Plating (Barrel)', characteristic: 'Carrier',            productChemical: 'Carrier Additive',     minValue: 10,   maxValue: 15,   unit: 'mL/L',  center: 12.5,  halfRange: 1.5  },
  { srNo: '19', stationNo: 20, stationName: 'Zinc Iron  plating 2',     process: 'Alkaline Zinc Iron Plating (Barrel)', characteristic: 'Zinc Concentration', productChemical: 'Zn-Fe Bath',           minValue: 6,    maxValue: 10,   unit: 'g/L',   center: 8,     halfRange: 1.5  },

  // Station 25 – Plating Thickness (final quality check)
  { srNo: '20', stationNo: 25, stationName: 'Plating Thickness',        process: 'Quality Check',                        characteristic: 'Coating Thickness',  productChemical: 'Zn-Fe Deposit',        minValue: 8,    maxValue: 12,   unit: 'µm',    center: 10,    halfRange: 1.5  },
];

// ── Text banks ────────────────────────────────────────────────────────────────

const PUSH_NOTES = [
  'All parameters checked per SOP before dispatch. Bath conditions stable.',
  'Batch processed per SOP v2. Minor temperature fluctuation in cleaning stage corrected mid-process.',
  'All bath concentrations verified. Plating thickness within specification across sample points.',
  'Standard batch. pH maintained throughout. No deviations during plating.',
  'Bath replenished prior to this batch run. All parameters confirmed stable.',
  'Process run under close supervision. Readings within SOP limits.',
  'Minor variation in rinse pH corrected early. Final readings within spec.',
  'Resubmission — adjusted brightener concentration per RE feedback on previous batch.',
  'Temperature fluctuation in anodic cleaning noted and corrected. Batch completed within spec.',
  'All 20 process parameters verified against SOP before submitting. Batch ready for RE review.',
  'Iron content slightly on the lower end but within spec. Overall bath chemistry confirmed stable.',
  'New carrier additive batch used from today. All readings acceptable.',
  'Routine batch. HCl concentration maintained at nominal. No issues.',
];

const APPROVE_NOTES = [
  'All 20 parameters reviewed against SOP. No deviations found. Approved for dispatch.',
  'Readings verified — within specification. Iron content and pH satisfactory. Approved.',
  'Pass rate acceptable. Coating thickness within 8–12 µm range. Approved.',
  'Bath chemistry within limits. Good quality batch. Approved.',
  'All plating parameters compliant. Minor variation in pre-treatment stages — acceptable. Approved.',
  'Consistent performance across stations. Approved.',
  'Iron content at 0.45%, pH at 9.1 — both within spec. Good batch. Approved.',
];

const REJECT_NOTES = [
  'Zinc bath pH measured at 9.7 — above maximum of 9.5 (Station 20). Batch rejected. Please adjust bath and resubmit.',
  'Plating thickness below minimum 8 µm on 3 sample points. Rejected — reprocess required.',
  'Iron content at 0.68%, exceeding 0.6% upper limit. Batch rejected.',
  'HCl pickling concentration below 15% spec. Surface activation insufficient. Rejected.',
  'Brightener concentration measured at 2.4 mL/L, below the 3 mL/L minimum. Rejected.',
  'Temperature in anodic cleaning dropped to 54°C during process, below 60°C minimum. Rejected.',
  'Multiple parameters out of limit. Overall pass rate below acceptable threshold. Batch rejected.',
  'Carrier additive depleted — measured at 8.5 mL/L against minimum 10. Rejected.',
  'De-scaling pH at 2.4, above maximum of 2.0. Pre-treatment effectiveness in question. Rejected.',
];

const PART_NUMBERS = [
  'RE-FBR-114', 'RE-FBR-116', 'RE-CHN-201', 'RE-CHN-204',
  'RE-BRK-312', 'RE-EXH-408', 'RE-EXH-411', 'RE-HBR-507',
  'RE-FBR-118', 'RE-CHN-207', 'RE-BRK-315', 'RE-HBR-512',
];

// ── Monthly schedule ──────────────────────────────────────────────────────────
// [year, month (1-based), batchCount, targetPassRate]

const MONTHS: [number, number, number, number][] = [
  [2025, 8,   6, 0.87],  // partial month
  [2025, 9,  10, 0.85],
  [2025, 10, 11, 0.89],
  [2025, 11, 10, 0.83],
  [2025, 12,  8, 0.77],  // winter dip begins
  [2026, 1,   9, 0.75],  // worst month
  [2026, 2,   9, 0.82],  // recovery
  [2026, 3,  11, 0.86],
  [2026, 4,  12, 0.90],
  [2026, 5,  12, 0.91],
  [2026, 6,  11, 0.93],
  [2026, 7,  10, 0.92],
  [2026, 8,   6, 0.94],  // partial month up to Aug 19
];

const NOW = new Date('2026-08-19T18:00:00');

// ── Value generation ──────────────────────────────────────────────────────────

function generateReading(
  p: ParamDef,
  shouldPass: boolean,
): { value: number; score: 'pass' | 'fail' } {
  if (shouldPass) {
    let v: number;
    if (p.minValue !== null && p.maxValue !== null) {
      const mid = (p.minValue + p.maxValue) / 2;
      const safeRadius = (p.maxValue - p.minValue) * 0.4;
      v = mid + rand(-safeRadius, safeRadius);
      v = Math.max(p.minValue + 0.01, Math.min(p.maxValue - 0.01, v));
    } else if (p.maxValue !== null) {
      // max-only: stay well below
      v = p.maxValue - rand(0.15, p.halfRange);
    } else {
      // min-only: stay above
      v = (p.minValue ?? 0) + rand(0.1, p.halfRange);
    }
    return { value: round2(v), score: 'pass' };
  } else {
    // generate a failing value
    if (p.minValue !== null && p.maxValue !== null) {
      const range = p.maxValue - p.minValue;
      if (Math.random() < 0.5) {
        const v = p.minValue - rand(range * 0.05, range * 0.22);
        return { value: round2(v), score: 'fail' };
      } else {
        const v = p.maxValue + rand(range * 0.05, range * 0.22);
        return { value: round2(v), score: 'fail' };
      }
    } else if (p.maxValue !== null) {
      const v = p.maxValue + rand(0.1, 0.6);
      return { value: round2(v), score: 'fail' };
    } else {
      const v = (p.minValue ?? 0) - rand(0.5, 1.5);
      return { value: round2(v), score: 'fail' };
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = createDb(DB_PATH);

  // 1. Locate Unique Platers
  const vendor = db
    .prepare("SELECT id FROM vendors WHERE name = 'Unique Platers'")
    .get() as { id: string } | undefined;

  if (!vendor) {
    console.error('Unique Platers not found. Run: npm run seed  (to create base vendor first)');
    process.exit(1);
  }
  const vendorId = vendor.id;
  console.log(`Found Unique Platers: ${vendorId}`);

  // 2. Find users
  const adminUser = db
    .prepare("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string; email: string } | undefined;
  const vendorUser = db
    .prepare('SELECT id, email FROM users WHERE vendor_id = ? LIMIT 1')
    .get(vendorId) as { id: string; email: string } | undefined;

  if (!adminUser || !vendorUser) {
    console.error('Users not found. Run: npm run seed  first.');
    process.exit(1);
  }
  const { id: adminId, email: adminEmail } = adminUser;
  const { email: vendorEmail } = vendorUser;

  // 3. Wipe existing synthetic batches (safe re-run)
  const existing = db
    .prepare("SELECT id FROM load_reports WHERE vendor_id = ? AND file_path LIKE 'synthetic/UP-%'")
    .all(vendorId) as { id: string }[];

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    const ph = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM batch_events   WHERE load_report_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM load_readings  WHERE load_report_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM load_reports   WHERE id             IN (${ph})`).run(...ids);
    console.log(`Removed ${ids.length} existing synthetic batches.`);
  }

  // 4. Create (or reuse) active SOP document + parameters
  let sopDocId: string;
  const existingDoc = db
    .prepare("SELECT id FROM sop_documents WHERE vendor_id = ? AND status = 'active' ORDER BY uploaded_at DESC LIMIT 1")
    .get(vendorId) as { id: string } | undefined;

  // Track param IDs for reading injection
  const sopParamIds: string[] = [];

  if (existingDoc) {
    sopDocId = existingDoc.id;
    console.log(`Reusing active SOP document: ${sopDocId}`);

    // Load existing param IDs in sr_no order
    const rows = db
      .prepare('SELECT id, sr_no FROM sop_parameters WHERE sop_document_id = ? ORDER BY CAST(sr_no AS INTEGER)')
      .all(sopDocId) as { id: string; sr_no: string }[];

    if (rows.length === PARAM_DEFS.length) {
      rows.forEach((r) => sopParamIds.push(r.id));
      console.log(`Using ${rows.length} existing SOP parameters.`);
    } else {
      // Mismatch — insert fresh params under the same doc
      console.log(`SOP parameter count mismatch (${rows.length} vs ${PARAM_DEFS.length}). Inserting missing params.`);
      const existingSrNos = new Set(rows.map((r) => r.sr_no));
      for (const p of PARAM_DEFS) {
        if (existingSrNos.has(p.srNo)) {
          const row = rows.find((r) => r.sr_no === p.srNo)!;
          sopParamIds.push(row.id);
        } else {
          const pid = randomUUID();
          db.prepare(`
            INSERT INTO sop_parameters
              (id, sop_document_id, station_group_key, sr_no, station_no, process, product_chemical,
               characteristic, min_value, max_value, unit, status, raw_control_limit, raw_spec_limit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?)
          `).run(
            pid, sopDocId,
            `${p.process}::${p.stationNo}`,
            p.srNo, String(p.stationNo),
            p.process, p.productChemical, p.characteristic,
            p.minValue, p.maxValue, p.unit,
            p.minValue !== null && p.maxValue !== null
              ? `${p.minValue}–${p.maxValue}`
              : (p.maxValue !== null ? `≤ ${p.maxValue}` : `≥ ${p.minValue}`),
            p.unit,
          );
          sopParamIds.push(pid);
        }
      }
    }
  } else {
    // Create a new synthetic SOP document
    sopDocId = randomUUID();
    db.prepare(`
      INSERT INTO sop_documents (id, vendor_id, file_path, status, uploaded_by, uploaded_at, activated_at)
      VALUES (?, ?, 'synthetic/UP-SOP-v2.csv', 'active', ?, '2025-07-15 10:00:00', '2025-07-20 09:00:00')
    `).run(sopDocId, vendorId, adminId);

    for (const p of PARAM_DEFS) {
      const pid = randomUUID();
      db.prepare(`
        INSERT INTO sop_parameters
          (id, sop_document_id, station_group_key, sr_no, station_no, process, product_chemical,
           characteristic, min_value, max_value, unit, status, raw_control_limit, raw_spec_limit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?)
      `).run(
        pid, sopDocId,
        `${p.process}::${p.stationNo}`,
        p.srNo, String(p.stationNo),
        p.process, p.productChemical, p.characteristic,
        p.minValue, p.maxValue, p.unit,
        p.minValue !== null && p.maxValue !== null
          ? `${p.minValue}–${p.maxValue}`
          : (p.maxValue !== null ? `≤ ${p.maxValue}` : `≥ ${p.minValue}`),
        p.unit,
      );
      sopParamIds.push(pid);
    }
    console.log(`Created SOP document ${sopDocId} with ${PARAM_DEFS.length} parameters.`);
  }

  // 5. Generate batches
  const insertLoad = db.prepare(`
    INSERT INTO load_reports
      (id, vendor_id, load_number, file_path, part_number, push_status,
       uploaded_by, uploaded_at, pushed_at, reviewed_at, reviewed_by, review_note, push_note)
    VALUES
      (@id, @vendorId, @loadNumber, @filePath, @partNumber, @pushStatus,
       @uploadedBy, @uploadedAt, @pushedAt, @reviewedAt, @reviewedBy, @reviewNote, @pushNote)
  `);

  const insertReading = db.prepare(`
    INSERT INTO load_readings
      (id, load_report_id, sop_parameter_id, station_no, station_name, parameter_name, value, score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO batch_events (id, load_report_id, event_type, actor_email, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const seedBatches = db.transaction(() => {
    let batchSeq = 1;
    let totalBatches = 0;
    let totalReadings = 0;

    for (const [year, month, batchCount, monthPassRate] of MONTHS) {
      const monthStart = new Date(year, month - 1, 1, 8, 0, 0);
      const monthEnd = new Date(year, month, 0, 17, 0, 0); // last day of month
      const isPartialMonth = year === 2026 && month === 8;
      const effectiveEnd = isPartialMonth ? new Date('2026-08-18T17:00:00') : monthEnd;
      const spanMs = effectiveEnd.getTime() - monthStart.getTime();

      for (let b = 0; b < batchCount; b++) {
        // Distribute batches evenly across working hours in the month
        const slotMs = spanMs / batchCount;
        const uploadedDate = new Date(
          monthStart.getTime() + slotMs * b + rand(0, slotMs * 0.85),
        );
        // Clamp to NOW
        if (uploadedDate > NOW) uploadedDate.setTime(NOW.getTime() - 3_600_000);

        // Per-batch pass rate: monthly target ± 8 pp, clamped 55–99%
        const batchPassRate = Math.min(0.99, Math.max(0.55, monthPassRate + rand(-0.08, 0.08)));

        // Generate readings
        const readings: Array<{
          paramIdx: number;
          value: number;
          score: 'pass' | 'fail';
        }> = PARAM_DEFS.map((p, idx) => {
          const { value, score } = generateReading(p, Math.random() < batchPassRate);
          return { paramIdx: idx, value, score };
        });

        const passes = readings.filter((r) => r.score === 'pass').length;
        const actualPassRate = passes / readings.length;

        // Determine review status based on recency + actual quality
        const daysSince = Math.floor((NOW.getTime() - uploadedDate.getTime()) / 86_400_000);
        let pushStatus: 'draft' | 'pending' | 'approved' | 'rejected';

        if (daysSince < 4) {
          pushStatus = Math.random() < 0.65 ? 'pending' : 'draft';
        } else if (daysSince < 18) {
          if (Math.random() < 0.48) {
            pushStatus = 'pending';
          } else {
            const approveP = actualPassRate >= 0.85 ? 0.94 : actualPassRate >= 0.75 ? 0.78 : 0.35;
            pushStatus = Math.random() < approveP ? 'approved' : 'rejected';
          }
        } else {
          const approveP = actualPassRate >= 0.85 ? 0.95 : actualPassRate >= 0.75 ? 0.80 : 0.28;
          pushStatus = Math.random() < approveP ? 'approved' : 'rejected';
        }

        const loadNumber = `UP-${year}-${String(month).padStart(2, '0')}-${String(batchSeq++).padStart(3, '0')}`;
        const loadId = randomUUID();
        const uploadedAt = fmtDt(uploadedDate);

        // Submission: 1-5 h after upload (for non-draft)
        const pushedDate = new Date(uploadedDate.getTime() + rand(1, 5) * 3_600_000);
        const pushedAt = pushStatus !== 'draft' ? fmtDt(pushedDate) : null;
        const pushNote = pushStatus !== 'draft' ? pick(PUSH_NOTES) : null;

        // Review: 1-4 business days after push
        const reviewedDate = pushedDate
          ? new Date(pushedDate.getTime() + rand(1, 4) * 86_400_000)
          : null;
        const reviewedAt = (pushStatus === 'approved' || pushStatus === 'rejected') && reviewedDate
          ? fmtDt(reviewedDate) : null;
        const reviewNote = reviewedAt
          ? (pushStatus === 'approved' ? pick(APPROVE_NOTES) : pick(REJECT_NOTES))
          : null;

        insertLoad.run({
          id: loadId,
          vendorId,
          loadNumber,
          filePath: `synthetic/${loadNumber}.csv`,
          partNumber: pick(PART_NUMBERS),
          pushStatus,
          uploadedBy: adminId,
          uploadedAt,
          pushedAt,
          reviewedAt,
          reviewedBy: reviewedAt ? adminId : null,
          reviewNote,
          pushNote,
        });

        // Insert readings
        for (const r of readings) {
          const p = PARAM_DEFS[r.paramIdx];
          insertReading.run(
            randomUUID(), loadId,
            sopParamIds[r.paramIdx],
            p.stationNo, p.stationName, p.characteristic,
            r.value, r.score,
          );
        }
        totalReadings += readings.length;

        // Batch events
        insertEvent.run(randomUUID(), loadId, 'uploaded', vendorEmail,
          `Batch ${loadNumber} uploaded`, uploadedAt);

        if (pushedAt) {
          const isProbablyResubmission = pushStatus !== 'draft' && daysSince > 40 && Math.random() < 0.12;
          insertEvent.run(randomUUID(), loadId,
            isProbablyResubmission ? 'resubmitted' : 'submitted',
            vendorEmail, pushNote, pushedAt);
        }

        if (reviewedAt) {
          insertEvent.run(randomUUID(), loadId,
            pushStatus === 'approved' ? 'approved' : 'rejected',
            adminEmail, reviewNote, reviewedAt);
        }

        totalBatches++;
      }

      const label = `${year}-${String(month).padStart(2, '0')}`;
      const actualPassRateForMonth = Math.round(monthPassRate * 100);
      console.log(`  ${label}: ${batchCount} batches  (target pass rate ~${actualPassRateForMonth}%)`);
    }

    return { totalBatches, totalReadings };
  });

  console.log('\nGenerating batches...');
  const { totalBatches, totalReadings } = seedBatches();

  // Summary
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN push_status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN push_status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN push_status = 'pending'  THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN push_status = 'draft'    THEN 1 ELSE 0 END) AS draft
    FROM load_reports WHERE vendor_id = ? AND file_path LIKE 'synthetic/UP-%'
  `).get(vendorId) as { approved: number; rejected: number; pending: number; draft: number };

  const readingStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes
    FROM load_readings r
    JOIN load_reports lr ON lr.id = r.load_report_id
    WHERE lr.vendor_id = ? AND lr.file_path LIKE 'synthetic/UP-%'
  `).get(vendorId) as { total: number; passes: number };

  const overallPassRate = readingStats.total > 0
    ? Math.round((readingStats.passes / readingStats.total) * 100)
    : 0;

  console.log(`
Done!
  Batches seeded   : ${totalBatches}
    ✓ Approved     : ${counts.approved}
    ✗ Rejected     : ${counts.rejected}
    ⏳ Pending     : ${counts.pending}
    📝 Draft       : ${counts.draft}
  Total readings   : ${totalReadings}
  Overall pass rate: ${overallPassRate}%
  Period           : Aug 2025 → Aug 2026
  `);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
