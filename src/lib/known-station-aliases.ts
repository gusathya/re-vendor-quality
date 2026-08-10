import { stationGroupKey, type StationAlias } from './station-matching';

/**
 * Seed aliases for Unique Platers, confirmed by inspecting the real SOP and the real
 * 2025-08-18_003 load report side by side. "Cascade Rinse" appears many times in the load
 * report at different station numbers for different SOP rinse steps — each is seeded
 * separately below because the SOP station numbers (5,6,8,9,11,12,15,16,18,19,28,29) line up
 * 1:1 with the load report's numbers for the pre-plating section of the line.
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
