export interface StationAlias {
  vendorId: string;
  stationGroupKey: string;
  loadReportStationName: string;
}

/** Groups SOP parameter rows into one physical station, disambiguating same-named steps by SOP Station No. */
export function stationGroupKey(process: string, stationNo: string | null): string {
  return `${process}::${stationNo ?? ''}`;
}

/** Matches a load-report station name against alias entries, normalizing case and collapsing whitespace runs so irregular real-world spacing doesn't break the lookup. */
export function findAliasForLoadReportStation(
  aliases: StationAlias[],
  loadReportStationName: string,
): StationAlias | null {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const normalized = normalize(loadReportStationName);
  return aliases.find((a) => normalize(a.loadReportStationName) === normalized) ?? null;
}
