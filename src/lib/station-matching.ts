export interface StationAlias {
  vendorId: string;
  stationGroupKey: string;
  loadReportStationName: string;
}

/** Groups SOP parameter rows into one physical station, disambiguating same-named steps by SOP Station No. */
export function stationGroupKey(process: string, stationNo: string | null): string {
  return `${process}::${stationNo ?? ''}`;
}

export function findAliasForLoadReportStation(
  aliases: StationAlias[],
  loadReportStationName: string,
): StationAlias | null {
  const normalized = loadReportStationName.trim().toLowerCase();
  return aliases.find((a) => a.loadReportStationName.trim().toLowerCase() === normalized) ?? null;
}
