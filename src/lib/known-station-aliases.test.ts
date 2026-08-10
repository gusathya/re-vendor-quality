import { describe, it, expect } from 'vitest';
import { KNOWN_UNIQUE_PLATERS_ALIASES } from './known-station-aliases';
import { findAliasForLoadReportStation } from './station-matching';

describe('KNOWN_UNIQUE_PLATERS_ALIASES', () => {
  it('maps every distinct station name that appears in the real load report and has an obvious SOP match', () => {
    const realLoadReportStationNames = [
      'Hot Water Rinse', 'Alkaline Emulsion Cleaning', 'Alkaline Soak Cleaning', 'Cascade Rinse',
      'Alk. De Scaling', 'Acid (HCL ) Pickling', 'Single Rinse', 'Alkaline Anodic Cleaning',
      'HCL 6 % dip', 'Zinc Iron  plating 2',
    ];
    for (const name of realLoadReportStationNames) {
      expect(findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, name)).not.toBeNull();
    }
  });

  it('does not invent a mapping for "Cross transfer Pre dip" or "Drag out" (no confident SOP match)', () => {
    expect(findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, 'Cross transfer Pre dip')).toBeNull();
    expect(findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, 'Drag out')).toBeNull();
  });

  it('maps the plating station to its group key with a blank station number', () => {
    const found = findAliasForLoadReportStation(KNOWN_UNIQUE_PLATERS_ALIASES, 'Zinc Iron  plating 2');
    expect(found?.stationGroupKey).toBe('Alkaline Zinc Iron Plating (Barrel)::');
  });
});
