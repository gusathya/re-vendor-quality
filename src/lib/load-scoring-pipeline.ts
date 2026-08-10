// src/lib/load-scoring-pipeline.ts
import type { StationReading } from './parsers/load-report-parser';
import type { SopParameter } from './db/sop';
import type { LoadReadingInput } from './db/load-reports';
import { normalizeUnitForLookup } from './parsers/sop-limit-parser';
import { findAliasForLoadReportStation, type StationAlias } from './station-matching';
import { scoreReading } from './scoring';

/**
 * Buckets a raw SOP `unit` string into the broad measurement category it represents, so a
 * load-report reading (Temperature / Dip Time / Act. Current) can be matched to the right
 * `sop_parameters` row at a station, even though a single station typically has multiple
 * parameter rows (one per characteristic) sharing the same `stationGroupKey`.
 *
 * The SOP's freeform `characteristic` label is NOT reliable for this (real vendor SOPs
 * mislabel rows — e.g. a temperature spec titled "Concentration (Water)"), but the parsed
 * `unit` field is, so classification is unit-based rather than name-based.
 */
export type UnitCategory = 'temperature' | 'time' | 'current' | 'other';

export function classifyUnit(unit: string | null): UnitCategory {
  if (!unit) return 'other';
  const normalized = normalizeUnitForLookup(unit).trim();
  if (normalized === '°C' || normalized === 'C') return 'temperature';
  if (normalized === 'SEC' || normalized === 'MIN' || normalized === 'HRS') return 'time';
  if (normalized === 'AMP' || normalized === 'AMP/KG') return 'current';
  return 'other';
}

/**
 * Pure function: turns a parsed load report's station readings into scored rows ready
 * for `insertLoadReadings`. A station is matched to its SOP parameters via the vendor's
 * station aliases (load-report station name -> SOP station group key). A single station
 * group key can span multiple SOP parameter rows (one per characteristic), so within a
 * matched station the right row is selected by unit category (temperature/time/current)
 * to match the kind of reading being scored. Unmatched stations, and stations with no
 * parameter row of the needed unit category, still produce readings, just with a null
 * `sopParameterId` and an 'unscored' result (there's no limit to score against).
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
  const paramsByGroupKey = new Map<string, SopParameter[]>();
  for (const p of activeParams) {
    const list = paramsByGroupKey.get(p.stationGroupKey);
    if (list) {
      list.push(p);
    } else {
      paramsByGroupKey.set(p.stationGroupKey, [p]);
    }
  }

  const findParam = (stationGroupKey: string | undefined, category: UnitCategory): SopParameter | null => {
    if (!stationGroupKey) return null;
    const candidates = paramsByGroupKey.get(stationGroupKey);
    if (!candidates) return null;
    const matches = candidates.filter((p) => classifyUnit(p.unit) === category);
    if (matches.length > 1) {
      console.warn(
        `Ambiguous SOP parameter match: station "${stationGroupKey}" has ${matches.length} parameters in the "${category}" unit category; using the first match (id=${matches[0].id}).`,
      );
    }
    return matches[0] ?? null;
  };

  const result: LoadReadingInput[] = [];

  for (const reading of readings) {
    const alias = findAliasForLoadReportStation(aliases, reading.stationName);
    const tempParam = findParam(alias?.stationGroupKey, 'temperature');
    const timeParam = findParam(alias?.stationGroupKey, 'time');
    const currentParam = findParam(alias?.stationGroupKey, 'current');

    result.push({
      sopParameterId: tempParam?.id ?? null,
      stationNo: reading.stationNo,
      stationName: reading.stationName,
      parameterName: 'Temperature',
      value: reading.temperatureC,
      dipTimeSeconds: reading.dipTimeSeconds,
      score: scoreReading(reading.temperatureC, tempParam?.minValue ?? null, tempParam?.maxValue ?? null),
    });

    result.push({
      sopParameterId: timeParam?.id ?? null,
      stationNo: reading.stationNo,
      stationName: reading.stationName,
      parameterName: 'Dip Time',
      value: reading.dipTimeSeconds,
      dipTimeSeconds: reading.dipTimeSeconds,
      score: scoreReading(reading.dipTimeSeconds, timeParam?.minValue ?? null, timeParam?.maxValue ?? null),
    });

    if (reading.actualCurrentAmp !== null) {
      result.push({
        sopParameterId: currentParam?.id ?? null,
        stationNo: reading.stationNo,
        stationName: reading.stationName,
        parameterName: 'Act. Current',
        value: reading.actualCurrentAmp,
        dipTimeSeconds: reading.dipTimeSeconds,
        score: scoreReading(reading.actualCurrentAmp, currentParam?.minValue ?? null, currentParam?.maxValue ?? null),
      });
    }
  }

  return result;
}
