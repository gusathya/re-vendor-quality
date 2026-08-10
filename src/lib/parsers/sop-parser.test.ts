import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSopWorkbook } from './sop-parser';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../Clients/Unique Platers/SOP/Unique_Enterprises_Process_Chart.xlsx',
);

function loadFixture() {
  return parseSopWorkbook(readFileSync(FIXTURE_PATH));
}

describe('parseSopWorkbook (real Unique Platers SOP)', () => {
  it('extracts exactly 104 characteristic rows from the 41-step process chart', () => {
    expect(loadFixture()).toHaveLength(104);
  });

  it('parses the Hot Water Rinsing temperature control limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '3' && p.characteristic === 'Concentration (Water)');
    expect(row).toBeDefined();
    expect(row!.process).toBe('Hot Water Rinsing');
    expect(row!.stationNo).toBe('2');
    expect(row!.controlLimitsRaw).toBe('50 – 70°C');
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 50, max: 70, unit: '°C' });
  });

  it('parses the Zinc plating Zn control limit with its chemical prefix', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '21' && p.characteristic === 'Zinc');
    expect(row).toBeDefined();
    expect(row!.process).toBe('Alkaline Zinc Iron Plating (Barrel)');
    expect(row!.stationNo).toBeNull();
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 8, max: 15, unit: 'gm/lit', prefix: 'Zn' });
  });

  it('parses the plating AMP control limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '26' && p.characteristic === 'AMP');
    expect(row).toBeDefined();
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 8, max: 12, unit: 'amp/kg' });
  });

  it('parses the "/"-combined Plating Thickness dual limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '39' && p.characteristic === 'Plating Thickness');
    expect(row).toBeDefined();
    expect(row!.parsed).toMatchObject({ status: 'parsed', min: 12, max: 17, unit: 'microns', target: 15 });
  });

  it('flags the Material Inward visual-inspection rows as non_numeric', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '1' && p.characteristic === 'Scratches');
    expect(row).toBeDefined();
    expect(row!.controlLimitsRaw).toBe('Scratches not allowed');
    expect(row!.parsed.status).toBe('non_numeric');
  });

  it('flags the Material Loading row (blank Control Limits) as no_limit', () => {
    const params = loadFixture();
    const row = params.find((p) => p.srNo === '2');
    expect(row).toBeDefined();
    expect(row!.controlLimitsRaw).toBeNull();
    expect(row!.parsed.status).toBe('no_limit');
  });

  it('parses the split 20A/20B Neutralization Dip pH as a max-only "< 12" limit', () => {
    const params = loadFixture();
    const rowA = params.find((p) => p.srNo === '20A' && p.characteristic === 'pH');
    const rowB = params.find((p) => p.srNo === '20B' && p.characteristic === 'pH');
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(rowA!.parsed).toMatchObject({ status: 'parsed', min: null, max: 12 });
    expect(rowB!.parsed).toMatchObject({ status: 'parsed', min: null, max: 12 });
  });

  it('keeps distinct station numbers for the two same-named "Alkaline Emulsion Clean" steps', () => {
    const params = loadFixture();
    const rows = params.filter((p) => p.process === 'Alkaline Emulsion Clean' && p.characteristic === 'Concentration');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.stationNo).sort()).toEqual(['3', '4']);
  });
});
