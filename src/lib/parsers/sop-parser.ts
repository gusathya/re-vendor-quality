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

  const parameters: DraftSopParameter[] = [];
  for (let i = DATA_START_INDEX; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === '')) continue;

    const srNo = cellToString(row[0]);
    const process = cellToString(row[2]);
    if (srNo === null || process === null) continue;

    const controlLimitsRaw = cellToString(row[6]);

    parameters.push({
      srNo,
      stationNo: cellToString(row[1]),
      process,
      productChemical: cellToString(row[3]),
      characteristic: cellToString(row[4]),
      specLimitsRaw: cellToString(row[5]),
      controlLimitsRaw,
      impuritiesRaw: cellToString(row[11]),
      parsed: parseControlLimit(controlLimitsRaw),
    });
  }

  return parameters;
}
