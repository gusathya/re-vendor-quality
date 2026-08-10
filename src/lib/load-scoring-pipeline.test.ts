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
