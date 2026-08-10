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
