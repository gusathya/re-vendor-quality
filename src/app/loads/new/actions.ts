'use server';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { createLoadReport, loadNumberExists, insertLoadReadings } from '@/lib/db/load-reports';
import { getActiveSopParameters } from '@/lib/db/sop';
import { getVendorByName } from '@/lib/db/vendors';
import { getStationAliasesForVendor } from '@/lib/db/station-aliases';
import { parseLoadReportWorkbook } from '@/lib/parsers/load-report-parser';
import { buildLoadReadings } from '@/lib/load-scoring-pipeline';
import { safeUploadFilename } from '@/lib/safe-filename';
import { redirect } from 'next/navigation';

export async function uploadLoadReport(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Not authenticated');

  const file = formData.get('loadFile') as File | null;
  const vendorName = formData.get('vendorName') as string | null;
  if (!file || file.size === 0) throw new Error('No file uploaded');
  if (!vendorName) throw new Error('No vendor selected');

  const db = getDb();
  const vendor = getVendorByName(db, vendorName);
  if (!vendor) throw new Error(`Unknown vendor: ${vendorName}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseLoadReportWorkbook(buffer);

  if (loadNumberExists(db, vendor.id, parsed.metadata.loadNumber)) {
    throw new Error(`Load ${parsed.metadata.loadNumber} was already uploaded for ${vendorName}`);
  }

  const activeParams = getActiveSopParameters(db, vendor.id);
  if (activeParams.length === 0) {
    throw new Error(`${vendorName} has no active SOP yet — finish SOP review and activation first`);
  }

  const aliases = getStationAliasesForVendor(db, vendor.id);

  const uploadDir = path.resolve('./Vendors', vendorName, 'Uploads');
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, safeUploadFilename(file.name));
  await writeFile(filePath, buffer);

  const report = createLoadReport(db, {
    vendorId: vendor.id,
    loadNumber: parsed.metadata.loadNumber,
    filePath,
    partNumber: parsed.metadata.partNumber,
    totalWeightKg: parsed.metadata.totalWeightKg,
    loadInTime: parsed.metadata.loadInTime.toISOString(),
    loadOutTime: parsed.metadata.loadOutTime.toISOString(),
    totalTimeSeconds: parsed.metadata.totalTimeSeconds,
    uploadedBy: session.user.id,
  });

  insertLoadReadings(db, report.id, buildLoadReadings(parsed.readings, activeParams, aliases));

  redirect('/');
}
