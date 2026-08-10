// src/lib/parsers/sop-parser.ts
import * as XLSX from 'xlsx';
import { parseControlLimit, type ParsedLimit } from './sop-limit-parser';

export interface DraftSopParameter {
  srNo: string;
  stationNo: string | null;
  process: string;
  productChemical: string | null;
  characteristic: string | null;
  specLimitsRaw: string | null;
  controlLimitsRaw: string | null;
  impuritiesRaw: string | null;
  parsed: ParsedLimit;
}

const SHEET_NAME = 'Process Chart';
const HEADER_ROW_INDEX = 3; // 0-indexed; "Sr.No" header is on spreadsheet row 4
const DATA_START_INDEX = HEADER_ROW_INDEX + 1;
const EXPECTED_HEADER_CELL = 'Sr.No';

// Column indices within each data row (0-indexed), as laid out in the "Process Chart" sheet.
const COL_SR_NO = 0;
const COL_STATION_NO = 1;
const COL_PROCESS = 2;
const COL_PRODUCT_CHEMICAL = 3;
const COL_CHARACTERISTIC = 4;
const COL_SPEC_LIMITS = 5;
const COL_CONTROL_LIMITS = 6;
const COL_IMPURITIES = 11;

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

export function parseSopWorkbook(buffer: Buffer): DraftSopParameter[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Expected a "${SHEET_NAME}" sheet in the SOP workbook`);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const headerCell = cellToString(rows[HEADER_ROW_INDEX]?.[COL_SR_NO]);
  if (headerCell !== EXPECTED_HEADER_CELL) {
    throw new Error(
      `Expected header row ${HEADER_ROW_INDEX} of the "${SHEET_NAME}" sheet to start with ` +
        `"${EXPECTED_HEADER_CELL}", but found ${headerCell === null ? 'an empty cell' : `"${headerCell}"`}. ` +
        'The SOP workbook layout may have changed (e.g. a row inserted above the header).',
    );
  }

  const parameters: DraftSopParameter[] = [];
  for (let i = DATA_START_INDEX; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === '')) continue;

    const srNo = cellToString(row[COL_SR_NO]);
    const process = cellToString(row[COL_PROCESS]);
    if (srNo === null || process === null) continue;

    const controlLimitsRaw = cellToString(row[COL_CONTROL_LIMITS]);

    parameters.push({
      srNo,
      stationNo: cellToString(row[COL_STATION_NO]),
      process,
      productChemical: cellToString(row[COL_PRODUCT_CHEMICAL]),
      characteristic: cellToString(row[COL_CHARACTERISTIC]),
      specLimitsRaw: cellToString(row[COL_SPEC_LIMITS]),
      controlLimitsRaw,
      impuritiesRaw: cellToString(row[COL_IMPURITIES]),
      parsed: parseControlLimit(controlLimitsRaw),
    });
  }

  return parameters;
}
