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

  it('refuses to activate a document that belongs to a different vendor, leaving the original vendor untouched', () => {
    const vendorA = createVendor(db, { name: 'Unique Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const vendorB = createVendor(db, { name: 'Other Platers', processName: 'Alkaline Zinc Iron Plating (Barrel)' });
    const admin = createUser(db, { email: 'admin@lf.local', passwordHash: 'hash', role: 'admin', vendorId: null });

    const docA = createDraftSopDocument(db, { vendorId: vendorA.id, filePath: '/x/sop-a.xlsx', uploadedBy: admin.id });
    insertSopParameters(db, docA.id, [
      { stationGroupKey: 'k1', srNo: '3', stationNo: '2', process: 'P', productChemical: null, characteristic: null, minValue: 1, maxValue: 2, unit: null, status: 'parsed', rawControlLimit: 'x', rawSpecLimit: null },
    ]);
    activateSopDocument(db, docA.id, vendorA.id);

    expect(() => activateSopDocument(db, docA.id, vendorB.id)).toThrow(
      `Cannot activate SOP document ${docA.id}: it does not belong to vendor ${vendorB.id}`,
    );

    const docAStatus = db.prepare('SELECT status FROM sop_documents WHERE id = ?').get(docA.id) as { status: string };
    expect(docAStatus.status).toBe('active');
    expect(getActiveSopParameters(db, vendorA.id)).toHaveLength(1);
    expect(getActiveSopParameters(db, vendorB.id)).toHaveLength(0);
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
