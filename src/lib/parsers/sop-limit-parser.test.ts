// src/lib/parsers/sop-limit-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseControlLimit } from './sop-limit-parser';

describe('parseControlLimit', () => {
  it('parses a plain range with a trailing unit', () => {
    expect(parseControlLimit('50 – 70°C')).toEqual({
      status: 'parsed', min: 50, max: 70, unit: '°C', prefix: null, target: null, raw: '50 – 70°C',
    });
  });

  it('parses a range with the unit repeated after both numbers', () => {
    expect(parseControlLimit('22°C – 35°C')).toEqual({
      status: 'parsed', min: 22, max: 35, unit: '°C', prefix: null, target: null, raw: '22°C – 35°C',
    });
  });

  it('parses a chemical-symbol-prefixed range', () => {
    expect(parseControlLimit('Zn 8 – 15 gm/lit')).toEqual({
      status: 'parsed', min: 8, max: 15, unit: 'gm/lit', prefix: 'Zn', target: null, raw: 'Zn 8 – 15 gm/lit',
    });
  });

  it('parses a unitless range (specific gravity)', () => {
    const result = parseControlLimit('1.010 – 1.200');
    expect(result.status).toBe('parsed');
    expect(result.min).toBeCloseTo(1.01);
    expect(result.max).toBeCloseTo(1.2);
    expect(result.unit).toBeNull();
  });

  it('parses a range with a unit containing a slash and hyphen (ml/amp-hr)', () => {
    expect(parseControlLimit('20 – 50 ml/amp-hr')).toEqual({
      status: 'parsed', min: 20, max: 50, unit: 'ml/amp-hr', prefix: null, target: null, raw: '20 – 50 ml/amp-hr',
    });
  });

  it('parses a range whose unit contains an internal slash without spaces (not a dual-limit combiner)', () => {
    expect(parseControlLimit('60 – 70 gm/lit')).toEqual({
      status: 'parsed', min: 60, max: 70, unit: 'gm/lit', prefix: null, target: null, raw: '60 – 70 gm/lit',
    });
  });

  it('parses a decimal-max range', () => {
    expect(parseControlLimit('5 – 5.2 ml/lit')).toEqual({
      status: 'parsed', min: 5, max: 5.2, unit: 'ml/lit', prefix: null, target: null, raw: '5 – 5.2 ml/lit',
    });
  });

  it('parses a period-suffixed unit range', () => {
    expect(parseControlLimit('2 – 6 Lit./min.')).toEqual({
      status: 'parsed', min: 2, max: 6, unit: 'Lit./min.', prefix: null, target: null, raw: '2 – 6 Lit./min.',
    });
  });

  it('parses a "< N" max-only limit with no unit', () => {
    expect(parseControlLimit('< 12')).toEqual({
      status: 'parsed', min: null, max: 12, unit: null, prefix: null, target: null, raw: '< 12',
    });
  });

  it('parses a single exact value with a known unit', () => {
    expect(parseControlLimit('89 Sec')).toEqual({
      status: 'parsed', min: 89, max: 89, unit: 'Sec', prefix: null, target: 89, raw: '89 Sec',
    });
  });

  it('parses a bare "N min" as an exact value in minutes, not a minimum qualifier', () => {
    expect(parseControlLimit('90 min')).toEqual({
      status: 'parsed', min: 90, max: 90, unit: 'min', prefix: null, target: 90, raw: '90 min',
    });
  });

  it('parses a "/"-combined single-target-and-range cell (Plating Thickness)', () => {
    expect(parseControlLimit('15 microns / 12 – 17 microns')).toEqual({
      status: 'parsed', min: 12, max: 17, unit: 'microns', prefix: null, target: 15, raw: '15 microns / 12 – 17 microns',
    });
  });

  it('parses a "/"-combined "N unit min / N – N unit" cell (SST White Rust)', () => {
    expect(parseControlLimit('240 Hrs min / 240 – 264 Hrs.')).toEqual({
      status: 'parsed', min: 240, max: 264, unit: 'Hrs.', prefix: null, target: 240, raw: '240 Hrs min / 240 – 264 Hrs.',
    });
  });

  it('parses a "/"-combined "N unit min / N – N unit" cell (SST Red Rust)', () => {
    expect(parseControlLimit('480 Hrs min / 480 – 504 Hrs.')).toEqual({
      status: 'parsed', min: 480, max: 504, unit: 'Hrs.', prefix: null, target: 480, raw: '480 Hrs min / 480 – 504 Hrs.',
    });
  });

  it('flags a non-numeric cell as non_numeric, not needs_review', () => {
    expect(parseControlLimit('As per Supplier Challan').status).toBe('non_numeric');
  });

  it('flags a non-numeric cell containing a slash correctly as non_numeric (not mistaken for a dual-limit combiner)', () => {
    expect(parseControlLimit('Proper / not').status).toBe('non_numeric');
  });

  it('flags a null control limit as no_limit', () => {
    expect(parseControlLimit(null)).toEqual({
      status: 'no_limit', min: null, max: null, unit: null, prefix: null, target: null, raw: null,
    });
  });

  it('flags an empty string as no_limit', () => {
    expect(parseControlLimit('').status).toBe('no_limit');
  });
});
