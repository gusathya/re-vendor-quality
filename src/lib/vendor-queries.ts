import type Database from 'better-sqlite3';

/* ── Batch KPI summary ── */

export interface VendorBatchKpis {
  totalBatches: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  overallPassRate: number;
  totalReadings: number;
}

export function getVendorBatchKpis(db: Database.Database, vendorId: string): VendorBatchKpis {
  const batchRow = db
    .prepare(
      `SELECT
         COUNT(*) AS totalBatches,
         SUM(CASE WHEN push_status = 'draft'    THEN 1 ELSE 0 END) AS draftCount,
         SUM(CASE WHEN push_status = 'pending'  THEN 1 ELSE 0 END) AS pendingCount,
         SUM(CASE WHEN push_status = 'approved' THEN 1 ELSE 0 END) AS approvedCount,
         SUM(CASE WHEN push_status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount
       FROM load_reports WHERE vendor_id = ?`,
    )
    .get(vendorId) as {
      totalBatches: number; draftCount: number; pendingCount: number;
      approvedCount: number; rejectedCount: number;
    };

  const readingRow = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.score != 'unscored'`,
    )
    .get(vendorId) as { total: number; passes: number | null };

  const total = readingRow.total;
  const passes = readingRow.passes ?? 0;

  return {
    ...batchRow,
    overallPassRate: total > 0 ? passes / total : 0,
    totalReadings: total,
  };
}

/* ── Best batch ── */

export interface BestBatch {
  id: string;
  loadNumber: string;
  uploadedAt: string;
  passRate: number;
  passes: number;
  total: number;
}

export function getVendorBestBatch(db: Database.Database, vendorId: string): BestBatch | null {
  const row = db
    .prepare(
      `SELECT
         lr.id,
         lr.load_number AS loadNumber,
         lr.uploaded_at AS uploadedAt,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
         COUNT(CASE WHEN r.score != 'unscored' THEN 1 END)  AS total
       FROM load_reports lr
       LEFT JOIN load_readings r ON r.load_report_id = lr.id
       WHERE lr.vendor_id = ?
       GROUP BY lr.id
       HAVING total > 0
       ORDER BY (passes * 1.0 / total) DESC, lr.uploaded_at DESC
       LIMIT 1`,
    )
    .get(vendorId) as { id: string; loadNumber: string; uploadedAt: string; passes: number; total: number } | undefined;

  if (!row) return null;
  return { ...row, passRate: Math.round((row.passes / row.total) * 100) };
}

/* ── Station fail breakdown ── */

export interface StationFailStat {
  stationName: string;
  failCount: number;
  totalCount: number;
  failRate: number;
}

export function getVendorStationFailStats(db: Database.Database, vendorId: string): StationFailStat[] {
  const rows = db
    .prepare(
      `SELECT
         r.station_name AS stationName,
         SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS failCount,
         COUNT(CASE WHEN r.score != 'unscored' THEN 1 END)  AS totalCount
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND r.score != 'unscored'
       GROUP BY r.station_name
       HAVING failCount > 0
       ORDER BY failCount DESC
       LIMIT 10`,
    )
    .all(vendorId) as { stationName: string; failCount: number; totalCount: number }[];

  return rows.map((r) => ({
    ...r,
    failRate: r.totalCount > 0 ? Math.round((r.failCount / r.totalCount) * 100) : 0,
  }));
}

/* ── Monthly pass-rate trend (aggregated by calendar month) ── */

export interface MonthlyTrendPoint {
  month: string;       // YYYY-MM
  monthLabel: string;  // "Aug '25"
  batchCount: number;
  avgPassRate: number;
  passes: number;
  total: number;
}

export function getVendorMonthlyTrend(db: Database.Database, vendorId: string): MonthlyTrendPoint[] {
  const rows = db
    .prepare(
      `SELECT
         strftime('%Y-%m', lr.uploaded_at)               AS month,
         COUNT(DISTINCT lr.id)                            AS batchCount,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
         COUNT(CASE WHEN r.score != 'unscored' THEN 1 END)  AS total
       FROM load_reports lr
       LEFT JOIN load_readings r ON r.load_report_id = lr.id
       WHERE lr.vendor_id = ?
       GROUP BY month
       ORDER BY month ASC`,
    )
    .all(vendorId) as { month: string; batchCount: number; passes: number; total: number }[];

  return rows.map((r) => {
    const [y, m] = r.month.split('-').map(Number);
    const label = new Date(y, m - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
    return {
      ...r,
      monthLabel: label,
      avgPassRate: r.total > 0 ? Math.round((r.passes / r.total) * 100) : 0,
    };
  });
}

/* ── Audit trail ── */

export interface BatchEvent {
  id: string;
  loadReportId: string;
  eventType: string;
  actorEmail: string | null;
  note: string | null;
  createdAt: string;
}

export function getBatchEvents(db: Database.Database, loadReportId: string): BatchEvent[] {
  return db
    .prepare(
      `SELECT id, load_report_id AS loadReportId, event_type AS eventType,
              actor_email AS actorEmail, note, created_at AS createdAt
       FROM batch_events WHERE load_report_id = ? ORDER BY created_at ASC`,
    )
    .all(loadReportId) as BatchEvent[];
}

export function logBatchEvent(
  db: Database.Database,
  loadReportId: string,
  eventType: string,
  actorEmail: string | null,
  note: string | null,
): void {
  const { randomUUID } = require('node:crypto') as typeof import('node:crypto');
  db.prepare(
    `INSERT INTO batch_events (id, load_report_id, event_type, actor_email, note)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), loadReportId, eventType, actorEmail, note);
}

/* ── Re-submission diff ── */

export interface BatchReadingDiff {
  stationName: string;
  parameterName: string;
  currentScore: string;
  previousScore: string | null;
  improved: boolean;
  regressed: boolean;
}

export function getResubmissionDiff(
  db: Database.Database,
  currentLoadId: string,
  vendorId: string,
): { previousLoadNumber: string; improved: number; regressed: number; rows: BatchReadingDiff[] } | null {
  const prev = db
    .prepare(
      `SELECT id, load_number AS loadNumber
       FROM load_reports
       WHERE vendor_id = ? AND id != ? AND push_status IN ('rejected', 'pending', 'approved')
       ORDER BY uploaded_at DESC LIMIT 1`,
    )
    .get(vendorId, currentLoadId) as { id: string; loadNumber: string } | undefined;
  if (!prev) return null;

  const current = db
    .prepare(`SELECT station_name AS stationName, parameter_name AS parameterName, score
              FROM load_readings WHERE load_report_id = ? AND score != 'unscored'`)
    .all(currentLoadId) as { stationName: string; parameterName: string; score: string }[];

  const previous = db
    .prepare(`SELECT station_name AS stationName, parameter_name AS parameterName, score
              FROM load_readings WHERE load_report_id = ? AND score != 'unscored'`)
    .all(prev.id) as { stationName: string; parameterName: string; score: string }[];

  const prevMap = new Map(previous.map((r) => [`${r.stationName}|${r.parameterName}`, r.score]));

  const rows: BatchReadingDiff[] = current.map((r) => {
    const prevScore = prevMap.get(`${r.stationName}|${r.parameterName}`) ?? null;
    return {
      stationName: r.stationName,
      parameterName: r.parameterName,
      currentScore: r.score,
      previousScore: prevScore,
      improved: prevScore === 'fail' && r.score === 'pass',
      regressed: prevScore === 'pass' && r.score === 'fail',
    };
  });

  return {
    previousLoadNumber: prev.loadNumber,
    improved: rows.filter((r) => r.improved).length,
    regressed: rows.filter((r) => r.regressed).length,
    rows,
  };
}

/* ── Monthly scorecard ── */

export interface MonthlyStats {
  month: string;
  totalBatches: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalReadings: number;
  passes: number;
  fails: number;
  passRate: number;
}

export function getVendorMonthlyStats(
  db: Database.Database,
  vendorId: string,
  month: string,
): MonthlyStats {
  const from = `${month}-01`;
  const to = `${month}-31 23:59:59`;

  const batchRow = db
    .prepare(
      `SELECT
         COUNT(*) AS totalBatches,
         SUM(CASE WHEN push_status = 'approved' THEN 1 ELSE 0 END) AS approvedCount,
         SUM(CASE WHEN push_status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount,
         SUM(CASE WHEN push_status = 'pending'  THEN 1 ELSE 0 END) AS pendingCount
       FROM load_reports WHERE vendor_id = ? AND uploaded_at >= ? AND uploaded_at <= ?`,
    )
    .get(vendorId, from, to) as {
      totalBatches: number; approvedCount: number; rejectedCount: number; pendingCount: number;
    };

  const readingRow = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
              SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS fails
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND lr.uploaded_at >= ? AND lr.uploaded_at <= ?
         AND r.score != 'unscored'`,
    )
    .get(vendorId, from, to) as { total: number; passes: number | null; fails: number | null };

  const total = readingRow.total;
  const passes = readingRow.passes ?? 0;
  const fails = readingRow.fails ?? 0;

  return {
    month,
    ...batchRow,
    totalReadings: total,
    passes,
    fails,
    passRate: total > 0 ? Math.round((passes / total) * 100) : 0,
  };
}

export interface MonthlyBatchRow {
  id: string;
  loadNumber: string;
  uploadedAt: string;
  pushStatus: string;
  passes: number;
  fails: number;
  total: number;
}

export function getVendorMonthlyBatches(
  db: Database.Database,
  vendorId: string,
  month: string,
): MonthlyBatchRow[] {
  const from = `${month}-01`;
  const to = `${month}-31 23:59:59`;

  return db
    .prepare(
      `SELECT
         lr.id,
         lr.load_number AS loadNumber,
         lr.uploaded_at AS uploadedAt,
         lr.push_status AS pushStatus,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END)       AS passes,
         SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END)        AS fails,
         COUNT(CASE WHEN r.score != 'unscored' THEN 1 END)        AS total
       FROM load_reports lr
       LEFT JOIN load_readings r ON r.load_report_id = lr.id
       WHERE lr.vendor_id = ? AND lr.uploaded_at >= ? AND lr.uploaded_at <= ?
       GROUP BY lr.id
       ORDER BY lr.uploaded_at ASC`,
    )
    .all(vendorId, from, to) as MonthlyBatchRow[];
}

export interface MonthlyStationStat {
  stationName: string;
  passes: number;
  fails: number;
  failRate: number;
}

export function getVendorMonthlyStationStats(
  db: Database.Database,
  vendorId: string,
  month: string,
): MonthlyStationStat[] {
  const from = `${month}-01`;
  const to = `${month}-31 23:59:59`;

  const rows = db
    .prepare(
      `SELECT
         r.station_name AS stationName,
         SUM(CASE WHEN r.score = 'pass' THEN 1 ELSE 0 END) AS passes,
         SUM(CASE WHEN r.score = 'fail' THEN 1 ELSE 0 END) AS fails
       FROM load_readings r
       JOIN load_reports lr ON lr.id = r.load_report_id
       WHERE lr.vendor_id = ? AND lr.uploaded_at >= ? AND lr.uploaded_at <= ?
         AND r.score != 'unscored'
       GROUP BY r.station_name
       ORDER BY fails DESC, stationName`,
    )
    .all(vendorId, from, to) as { stationName: string; passes: number; fails: number }[];

  return rows.map((r) => ({
    ...r,
    failRate: (r.passes + r.fails) > 0 ? Math.round((r.fails / (r.passes + r.fails)) * 100) : 0,
  }));
}
