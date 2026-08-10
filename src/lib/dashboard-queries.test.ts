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
