import { describe, it, expect } from 'vitest';
import { excelSerialToDate, excelDurationToSeconds } from './excel-datetime';

describe('excelSerialToDate', () => {
  it('converts the real Load In Time serial (2025-08-18_003) to the correct UTC instant', () => {
    expect(excelSerialToDate(45887.42762731481).toISOString()).toBe('2025-08-18T10:15:47.000Z');
  });

  it('converts the real Load Out Time serial to the correct UTC instant', () => {
    expect(excelSerialToDate(45887.55673611111).toISOString()).toBe('2025-08-18T13:21:42.000Z');
  });

  it('converts a station Dip in Time serial to the correct UTC instant', () => {
    expect(excelSerialToDate(45887.487233796295).toISOString()).toBe('2025-08-18T11:41:37.000Z');
  });
});

describe('excelDurationToSeconds', () => {
  it('converts the real Total Time serial to 11155 seconds (3h05m55s)', () => {
    expect(excelDurationToSeconds(0.1291087962962963)).toBe(11155);
  });

  it('converts a short station Dip Time serial to 95 seconds', () => {
    expect(excelDurationToSeconds(0.001099537037037037)).toBe(95);
  });

  it('converts the long plating station Dip Time serial to 5776 seconds (1h36m16s)', () => {
    expect(excelDurationToSeconds(0.06685185185185186)).toBe(5776);
  });

  it('converts a zero-duration serial to 0 seconds', () => {
    expect(excelDurationToSeconds(0)).toBe(0);
  });
});
