'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import {
  activateSopDocument, getSopParametersByDocument, updateSopParameterLimits,
  insertBlankSopParameter, deleteSopParameterById, setSopParameterOrder,
  type SopParameter,
} from '@/lib/db/sop';
import { upsertStationAlias } from '@/lib/db/station-aliases';
import { revalidatePath } from 'next/cache';

async function requireEditAccess() {
  const session = await auth();
  if (!session?.user || !['admin', 'customer'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }
}

export async function updateSopParameter(
  id: string,
  minValue: number | null,
  maxValue: number | null,
  unit: string | null,
) {
  await requireEditAccess();
  updateSopParameterLimits(getDb(), id, minValue, maxValue, unit);
}

// `station_aliases` has a UNIQUE (vendor_id, load_report_station_name) constraint. A
// reviewer on this screen may change their mind about which SOP station a load-report
// name should map to, so this needs upsert-on-conflict semantics rather than the
// insert-only behavior `createStationAlias` provides (that function is deliberately a
// no-op on conflict, for the seed script's idempotent re-runs). `upsertStationAlias`
// (in the station-aliases repository) implements exactly this: update in place if the
// pair exists, insert otherwise.
export async function setStationAlias(vendorId: string, stationGroupKeyValue: string, loadReportStationName: string) {
  await requireEditAccess();
  upsertStationAlias(getDb(), {
    vendorId,
    stationGroupKey: stationGroupKeyValue,
    loadReportStationName,
  });
}

export async function activateSop(sopDocumentId: string, vendorId: string) {
  await requireEditAccess();
  activateSopDocument(getDb(), sopDocumentId, vendorId);
  revalidatePath(`/sops/${sopDocumentId}`);
}

export async function getDraftParameters(sopDocumentId: string): Promise<SopParameter[]> {
  return getSopParametersByDocument(getDb(), sopDocumentId);
}

export async function addSopParameter(sopDocumentId: string): Promise<SopParameter> {
  await requireEditAccess();
  return insertBlankSopParameter(getDb(), sopDocumentId);
}

export async function removeSopParameter(parameterId: string): Promise<void> {
  await requireEditAccess();
  deleteSopParameterById(getDb(), parameterId);
}

export async function reorderSopParameters(orderedIds: string[]): Promise<void> {
  await requireEditAccess();
  setSopParameterOrder(getDb(), orderedIds);
}
