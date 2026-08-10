'use server';

import { getDb } from '@/lib/db/client';
import { activateSopDocument, getSopParametersByDocument, type SopParameter } from '@/lib/db/sop';
import { upsertStationAlias } from '@/lib/db/station-aliases';
import { revalidatePath } from 'next/cache';

export async function updateSopParameter(
  id: string,
  minValue: number | null,
  maxValue: number | null,
  unit: string | null,
) {
  getDb()
    .prepare('UPDATE sop_parameters SET min_value = ?, max_value = ?, unit = ?, status = ? WHERE id = ?')
    .run(minValue, maxValue, unit, minValue !== null || maxValue !== null ? 'parsed' : 'needs_review', id);
}

// `station_aliases` has a UNIQUE (vendor_id, load_report_station_name) constraint. A
// reviewer on this screen may change their mind about which SOP station a load-report
// name should map to, so this needs upsert-on-conflict semantics rather than the
// insert-only behavior `createStationAlias` provides (that function is deliberately a
// no-op on conflict, for the seed script's idempotent re-runs). `upsertStationAlias`
// (in the station-aliases repository) implements exactly this: update in place if the
// pair exists, insert otherwise.
export async function setStationAlias(vendorId: string, stationGroupKeyValue: string, loadReportStationName: string) {
  upsertStationAlias(getDb(), {
    vendorId,
    stationGroupKey: stationGroupKeyValue,
    loadReportStationName,
  });
}

export async function activateSop(sopDocumentId: string, vendorId: string) {
  activateSopDocument(getDb(), sopDocumentId, vendorId);
  revalidatePath(`/sops/${sopDocumentId}`);
}

export async function getDraftParameters(sopDocumentId: string): Promise<SopParameter[]> {
  return getSopParametersByDocument(getDb(), sopDocumentId);
}
