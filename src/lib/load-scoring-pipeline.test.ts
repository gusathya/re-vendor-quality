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

  describe('multi-characteristic station (regression: a station has one SOP row per characteristic)', () => {
    const anodicTempParam: SopParameter = {
      id: 'p-temp', sopDocumentId: 'd1', stationGroupKey: 'Alkaline Anodic Cleaning::5', srNo: '10', stationNo: '5',
      process: 'Alkaline Anodic Cleaning', productChemical: 'Chemical X', characteristic: 'Temp.',
      minValue: 50, maxValue: 60, unit: '°C', status: 'parsed', rawControlLimit: '50 – 60°C', rawSpecLimit: null,
    };
    const anodicTimeParam: SopParameter = {
      id: 'p-time', sopDocumentId: 'd1', stationGroupKey: 'Alkaline Anodic Cleaning::5', srNo: '11', stationNo: '5',
      process: 'Alkaline Anodic Cleaning', productChemical: 'Chemical X', characteristic: 'Time',
      minValue: 89, maxValue: 89, unit: 'Sec', status: 'parsed', rawControlLimit: '89 Sec', rawSpecLimit: null,
    };
    const anodicCurrentParam: SopParameter = {
      id: 'p-current', sopDocumentId: 'd1', stationGroupKey: 'Alkaline Anodic Cleaning::5', srNo: '12', stationNo: '5',
      process: 'Alkaline Anodic Cleaning', productChemical: 'Chemical X', characteristic: 'AMP',
      minValue: 300, maxValue: 300, unit: 'AMP', status: 'parsed', rawControlLimit: '300 AMP', rawSpecLimit: null,
    };
    const anodicParams = [anodicTempParam, anodicTimeParam, anodicCurrentParam];
    const anodicAliases: StationAlias[] = [
      { vendorId: 'v1', stationGroupKey: 'Alkaline Anodic Cleaning::5', loadReportStationName: 'Anodic Cleaning' },
    ];

    function anodicReading(overrides: Partial<StationReading>): StationReading {
      return {
        stationNo: 5, stationName: 'Anodic Cleaning',
        dipInTime: new Date(), dipOutTime: new Date(), dipTimeSeconds: 90,
        temperatureC: 52, ph: null, setCurrentAmp: null, actualCurrentAmp: 300, ampHr: null,
        ...overrides,
      };
    }

    it('scores a Temperature reading against the °C parameter, not Time or AMP', () => {
      const readings = buildLoadReadings([anodicReading({})], anodicParams, anodicAliases);
      const temp = readings.find((r) => r.parameterName === 'Temperature');
      // 52 is within 50-60 against the correct Temp. param -> pass. Against Time (89-89) or AMP
      // (300-300) it would incorrectly fail, which is exactly the bug this test guards against.
      expect(temp).toMatchObject({ sopParameterId: 'p-temp', value: 52, score: 'pass' });
    });

    it('scores a Dip Time reading against the Sec parameter, not °C or AMP', () => {
      const readings = buildLoadReadings([anodicReading({ dipTimeSeconds: 89 })], anodicParams, anodicAliases);
      const dip = readings.find((r) => r.parameterName === 'Dip Time');
      expect(dip).toMatchObject({ sopParameterId: 'p-time', value: 89, score: 'pass' });
    });

    it('scores an Act. Current reading against the AMP parameter, not °C or Sec', () => {
      const readings = buildLoadReadings([anodicReading({ actualCurrentAmp: 300 })], anodicParams, anodicAliases);
      const current = readings.find((r) => r.parameterName === 'Act. Current');
      expect(current).toMatchObject({ sopParameterId: 'p-current', value: 300, score: 'pass' });
    });
  });

  it('leaves a reading unscored when the station matched but no parameter of the right unit category exists there', () => {
    // Station matches, and there IS a parameter row at this station, but only for temperature -
    // there's no time-category row, so Dip Time should fall back to null/unscored rather than
    // being scored against an unrelated parameter.
    const readings = buildLoadReadings([reading({})], [sopParam], aliases);
    const dip = readings.find((r) => r.parameterName === 'Dip Time');
    expect(dip).toMatchObject({ sopParameterId: null, score: 'unscored' });
  });
});
