// src/lib/dashboard-queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from './db/client';
import { createVendor } from './db/vendors';
import { createUser } from './db/users';
import { createDraftSopDocument, insertSopParameters, activateSopDocument, updateSopParameterLimits } from './db/sop';
import { createLoadReport, insertLoadReadings } from './db/load-reports';
import {
  getKpis,
  getFilteredReadings,
  getParameterTrend,
  getStationHotspots,
  getParameterHotspots,
  listLoadNumbers,
  getLoadReadingsByLoadNumber,
  getParameterCapability,
} from './dashboard-queries';

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

  it('returns all-zero numbers (not null) when no readings match the filters', () => {
    const kpis = getKpis(db, vendorId, { parameterName: 'Nonexistent Parameter' });
    expect(kpis).toEqual({ totalReadings: 0, passRate: 0, outOfLimitCount: 0 });
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

describe('getParameterTrend', () => {
  it('returns readings for one parameter in chronological order with pass/fail flags', () => {
    const trend = getParameterTrend(db, vendorId, 'Temperature');
    expect(trend).toHaveLength(2);
    expect(trend.map((t) => t.score)).toEqual(['fail', 'pass']);
  });
});

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

describe('load comparison', () => {
  it('lists distinct load numbers for a vendor', () => {
    expect(listLoadNumbers(db, vendorId)).toEqual(['L1']);
  });

  it('lists multiple load numbers ordered lexicographically by load_number', () => {
    // Local fixture only, so we don't perturb the shared beforeEach counts relied on by other tests.
    const user = createUser(db, { email: 'b@a.local', passwordHash: 'h', role: 'admin', vendorId: null });
    createLoadReport(db, {
      vendorId, loadNumber: 'L10', filePath: '/y', partNumber: 'P2', totalWeightKg: 60,
      loadInTime: '2026-08-02T00:00:00.000Z', loadOutTime: '2026-08-02T01:00:00.000Z',
      totalTimeSeconds: 3600, uploadedBy: user.id,
    });
    createLoadReport(db, {
      vendorId, loadNumber: 'L2', filePath: '/z', partNumber: 'P3', totalWeightKg: 60,
      loadInTime: '2026-08-03T00:00:00.000Z', loadOutTime: '2026-08-03T01:00:00.000Z',
      totalTimeSeconds: 3600, uploadedBy: user.id,
    });
    // Lexicographic order: 'L1' < 'L10' < 'L2' (not numeric order).
    expect(listLoadNumbers(db, vendorId)).toEqual(['L1', 'L10', 'L2']);
  });

  it('fetches all readings for one load number', () => {
    const rows = getLoadReadingsByLoadNumber(db, vendorId, 'L1');
    expect(rows).toHaveLength(2);
  });
});

describe('getParameterCapability', () => {
  it('computes average distance from the nearest limit for a parameter', () => {
    // readings: 39 (min 50, distance -11, i.e. 11 below min) and 55 (min 50 max 70, distance 5 from min, 15 from max -> nearest 5)
    const capability = getParameterCapability(db, vendorId, 'Temperature');
    expect(capability.parameterName).toBe('Temperature');
    expect(capability.sampleCount).toBe(2);
    expect(capability.avgDistanceFromLimit).toBeCloseTo((-11 + 5) / 2);
  });

  it('returns null average with zero samples when the parameter has no scored data', () => {
    const capability = getParameterCapability(db, vendorId, 'Nonexistent Parameter');
    expect(capability).toEqual({ parameterName: 'Nonexistent Parameter', sampleCount: 0, avgDistanceFromLimit: null });
  });

  it('excludes readings whose SOP parameter had its limits cleared after scoring, instead of computing an Infinity distance', () => {
    // Both fixture readings (39 -> fail, 55 -> pass) reference the same already-active sop_parameters
    // row (paramId). Clearing that row's bounds in place (as the live SopReviewTable UI allows, even
    // for an already-scored parameter) must not corrupt the capability average with an unbounded
    // (Infinity) distance for readings that are no longer scoreable against any limit. Since both
    // readings share this one parameter, clearing its limits leaves zero legitimately scoreable
    // readings for 'Temperature'.
    updateSopParameterLimits(db, paramId, null, null, null);

    const capability = getParameterCapability(db, vendorId, 'Temperature');
    expect(capability.avgDistanceFromLimit).not.toBe(Infinity);
    expect(capability.avgDistanceFromLimit).not.toBeNaN();
    expect(capability).toEqual({ parameterName: 'Temperature', sampleCount: 0, avgDistanceFromLimit: null });
  });
});
