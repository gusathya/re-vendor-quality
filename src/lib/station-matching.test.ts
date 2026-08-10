import { describe, it, expect } from 'vitest';
import { stationGroupKey, findAliasForLoadReportStation, type StationAlias } from './station-matching';

describe('stationGroupKey', () => {
  it('combines process name and station number so same-named steps stay distinct', () => {
    expect(stationGroupKey('Alkaline Emulsion Clean', '3')).toBe('Alkaline Emulsion Clean::3');
    expect(stationGroupKey('Alkaline Emulsion Clean', '4')).toBe('Alkaline Emulsion Clean::4');
  });

  it('groups all plating sub-parameters (blank station number) under one key', () => {
    const key1 = stationGroupKey('Alkaline Zinc Iron Plating (Barrel)', null);
    const key2 = stationGroupKey('Alkaline Zinc Iron Plating (Barrel)', null);
    expect(key1).toBe(key2);
    expect(key1).toBe('Alkaline Zinc Iron Plating (Barrel)::');
  });
});

describe('findAliasForLoadReportStation', () => {
  const aliases: StationAlias[] = [
    { vendorId: 'v1', stationGroupKey: 'Hot Water Rinsing::2', loadReportStationName: 'Hot Water Rinse' },
    { vendorId: 'v1', stationGroupKey: 'Alkaline Zinc Iron Plating (Barrel)::', loadReportStationName: 'Zinc Iron  plating 2' },
  ];

  it('finds a matching alias case-insensitively', () => {
    const found = findAliasForLoadReportStation(aliases, 'hot water rinse');
    expect(found?.stationGroupKey).toBe('Hot Water Rinsing::2');
  });

  it('matches the plating station despite its double-spaced load report name', () => {
    const found = findAliasForLoadReportStation(aliases, 'Zinc Iron  plating 2');
    expect(found?.stationGroupKey).toBe('Alkaline Zinc Iron Plating (Barrel)::');
  });

  it('returns null for a station with no alias (e.g. "Drag out", which has no SOP row)', () => {
    expect(findAliasForLoadReportStation(aliases, 'Drag out')).toBeNull();
  });
});
