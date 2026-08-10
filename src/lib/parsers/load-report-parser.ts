// src/lib/parsers/load-report-parser.ts
import * as XLSX from 'xlsx';
import { excelSerialToDate, excelDurationToSeconds } from './excel-datetime';

export interface LoadReportMetadata {
  loadNumber: string;
  loadInTime: Date;
  loadOutTime: Date;
  stillInProcess: boolean;
  totalTimeSeconds: number;
  partNumber: string;
  totalWeightKg: number;
}

export interface StationReading {
  stationNo: number;
  stationName: string;
  dipInTime: Date;
  dipOutTime: Date;
  dipTimeSeconds: number;
  temperatureC: number | null;
  ph: number | null;
  setCurrentAmp: number | null;
  actualCurrentAmp: number | null;
  ampHr: number | null;
}

export interface ParsedLoadReport {
  metadata: LoadReportMetadata;
  readings: StationReading[];
}

const SHEET_NAME = 'LoadReport';
const ROW = { loadNumber: 2, loadInTime: 3, loadOutTime: 4, stillInProcess: 5, totalTime: 6 };
const PART_DATA_ROW = 10;
const STATION_HEADER_ROW = 15; // 0-indexed; "Station No" header is two rows above the station data
const STATION_DATA_START_ROW = 17;
const END_MARKER = 'END OF REPORT';
const EXPECTED_STATION_HEADER_CELL = 'Station No';

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

export function parseLoadReportWorkbook(buffer: Buffer): ParsedLoadReport {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Expected a "${SHEET_NAME}" sheet in the load report workbook`);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const metadata: LoadReportMetadata = {
    loadNumber: String(rows[ROW.loadNumber][2]),
    loadInTime: excelSerialToDate(Number(rows[ROW.loadInTime][2])),
    loadOutTime: excelSerialToDate(Number(rows[ROW.loadOutTime][2])),
    stillInProcess: String(rows[ROW.stillInProcess][2]).trim().toLowerCase() === 'yes',
    totalTimeSeconds: excelDurationToSeconds(Number(rows[ROW.totalTime][2])),
    partNumber: String(rows[PART_DATA_ROW][0]),
    totalWeightKg: Number(rows[PART_DATA_ROW][1]),
  };

  const stationHeaderCell = cellToString(rows[STATION_HEADER_ROW]?.[0]);
  if (stationHeaderCell !== EXPECTED_STATION_HEADER_CELL) {
    throw new Error(
      `Expected header row ${STATION_HEADER_ROW} of the "${SHEET_NAME}" sheet to start with ` +
        `"${EXPECTED_STATION_HEADER_CELL}", but found ${stationHeaderCell === null ? 'an empty cell' : `"${stationHeaderCell}"`}. ` +
        'The load report workbook layout may have changed (e.g. a row inserted above the station table).',
    );
  }

  const readings: StationReading[] = [];
  let sawEndMarker = false;
  for (let i = STATION_DATA_START_ROW; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[0] === null || row[0] === '') continue;
    if (String(row[0]).trim() === END_MARKER) {
      sawEndMarker = true;
      break;
    }

    readings.push({
      stationNo: Number(row[0]),
      stationName: String(row[1]).trim(),
      dipInTime: excelSerialToDate(Number(row[2])),
      dipOutTime: excelSerialToDate(Number(row[3])),
      dipTimeSeconds: excelDurationToSeconds(Number(row[4])),
      temperatureC: toNumberOrNull(row[5]),
      ph: toNumberOrNull(row[6]),
      setCurrentAmp: toNumberOrNull(row[7]),
      actualCurrentAmp: toNumberOrNull(row[8]),
      ampHr: toNumberOrNull(row[9]),
    });
  }

  if (!sawEndMarker) {
    throw new Error(
      `Expected an "${END_MARKER}" marker but reached the end of the sheet without finding one — ` +
        'the file may be truncated or malformed.',
    );
  }

  return { metadata, readings };
}
