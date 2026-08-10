// Days between the Excel epoch (1899-12-30) and the Unix epoch (1970-01-01).
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

/** Converts an Excel serial date/time (as read by SheetJS with raw:true) to a UTC Date. */
export function excelSerialToDate(serial: number): Date {
  const ms = Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * 86400 * 1000);
  return new Date(ms);
}

/** Converts an Excel serial *duration* (a fraction of a day, e.g. Dip Time / Total Time) to whole seconds. */
export function excelDurationToSeconds(serial: number): number {
  return Math.round(serial * 86400);
}
