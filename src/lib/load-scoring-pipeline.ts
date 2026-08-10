// src/lib/load-scoring-pipeline.ts
import type { StationReading } from './parsers/load-report-parser';
import type { SopParameter } from './db/sop';
import type { LoadReadingInput } from './db/load-reports';
import { findAliasForLoadReportStation, type StationAlias } from './station-matching';
import { scoreReading } from './scoring';

/**
 * Pure function: turns a parsed load report's station readings into scored rows ready
 * for `insertLoadReadings`. A station is matched to its SOP parameter via the vendor's
 * station aliases (load-report station name -> SOP station group key); unmatched
 * stations still produce readings, just with a null `sopParameterId` and an 'unscored'
 * result (there's no limit to score against).
 *
 * Temperature and Dip Time are always emitted (one row each per station reading, even
 * when the value itself is null/unmatched) so every station shows up in the report.
 * Act. Current is only emitted when the load report actually recorded a value for it.
 */
export function buildLoadReadings(
  readings: StationReading[],
  activeParams: SopParameter[],
  aliases: StationAlias[],
): LoadReadingInput[] {
  const paramsByGroupKey = new Map(activeParams.map((p) => [p.stationGroupKey, p]));
  const result: LoadReadingInput[] = [];

  for (const reading of readings) {
    const alias = findAliasForLoadReportStation(aliases, reading.stationName);
    const param = alias ? (paramsByGroupKey.get(alias.stationGroupKey) ?? null) : null;

    result.push({
      sopParameterId: param?.id ?? null,
      stationNo: reading.stationNo,
      stationName: reading.stationName,
      parameterName: 'Temperature',
      value: reading.temperatureC,
      dipTimeSeconds: reading.dipTimeSeconds,
      score: scoreReading(reading.temperatureC, param?.minValue ?? null, param?.maxValue ?? null),
    });

    result.push({
      sopParameterId: null,
      stationNo: reading.stationNo,
      stationName: reading.stationName,
      parameterName: 'Dip Time',
      value: reading.dipTimeSeconds,
      dipTimeSeconds: reading.dipTimeSeconds,
      score: 'unscored',
    });

    if (reading.actualCurrentAmp !== null) {
      result.push({
        sopParameterId: param?.id ?? null,
        stationNo: reading.stationNo,
        stationName: reading.stationName,
        parameterName: 'Act. Current',
        value: reading.actualCurrentAmp,
        dipTimeSeconds: reading.dipTimeSeconds,
        score: scoreReading(reading.actualCurrentAmp, param?.minValue ?? null, param?.maxValue ?? null),
      });
    }
  }

  return result;
}
