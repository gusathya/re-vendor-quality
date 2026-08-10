import { stationGroupKey, type StationAlias } from './station-matching';

/**
 * Seed aliases for Unique Platers, confirmed by inspecting the real SOP and the real
 * 2025-08-18_003 load report side by side. "Cascade Rinse" is the load-report name for
 * ~12 distinct physical stations (SOP station numbers 5,6,8,9,11,12,15,16,18,19,28,29).
 * Matching is by name only, so only one alias is seeded here (station 5) and every
 * "Cascade Rinse" row in a load report resolves to it — a known, intentional MVP
 * limitation, not an omission. Task 13's SOP review UI should surface this so a reviewer
 * knows the other 11 occurrences aren't independently scored.
 */
export const KNOWN_UNIQUE_PLATERS_ALIASES: StationAlias[] = [
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Hot Water Rinsing', '2'), loadReportStationName: 'Hot Water Rinse' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Alkaline Emulsion Clean', '3'), loadReportStationName: 'Alkaline Emulsion Cleaning' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Alkaline Emulsion Clean', '4'), loadReportStationName: 'Alkaline Soak Cleaning' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Cascading Rinsing', '5'), loadReportStationName: 'Cascade Rinse' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('De-Scaling', '7'), loadReportStationName: 'Alk. De Scaling' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Acid Cleaning Comm. HCL', '10'), loadReportStationName: 'Acid (HCL ) Pickling' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Water Rinsing', '13'), loadReportStationName: 'Single Rinse' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Anodic Cleaning', '14'), loadReportStationName: 'Alkaline Anodic Cleaning' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('HCL Dip', '17'), loadReportStationName: 'HCL 6 % dip' },
  { vendorId: 'unique-platers', stationGroupKey: stationGroupKey('Alkaline Zinc Iron Plating (Barrel)', null), loadReportStationName: 'Zinc Iron  plating 2' },
];
