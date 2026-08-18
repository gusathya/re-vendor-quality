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
  if (!session?.user) redirect('/login');

  const file = formData.get('loadFile') as File | null;
  const vendorName = (formData.get('vendorName') as string | null)?.trim() ?? null;

  if (!file || file.size === 0) {
    redirect(`/loads/new?error=${encodeURIComponent('No file selected — please choose an Excel file.')}`);
  }
  if (!vendorName) {
    redirect(`/loads/new?error=${encodeURIComponent('No vendor selected.')}`);
  }

  let parsed;
  let buffer: Buffer;

  try {
    buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseLoadReportWorkbook(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    redirect(`/loads/new?error=${encodeURIComponent(`Could not parse the file: ${msg}`)}`);
  }

  const db = getDb();
  const vendor = getVendorByName(db, vendorName);
  if (!vendor) {
    redirect(`/loads/new?error=${encodeURIComponent(`Vendor not found: "${vendorName}". Try refreshing the page.`)}`);
  }

  if (loadNumberExists(db, vendor.id, parsed.metadata.loadNumber)) {
    redirect(`/loads/new?error=${encodeURIComponent(`Load #${parsed.metadata.loadNumber} has already been uploaded for ${vendorName}.`)}`);
  }

  const activeParams = getActiveSopParameters(db, vendor.id);
  if (activeParams.length === 0) {
    redirect(`/loads/new?error=${encodeURIComponent(`${vendorName} has no active SOP yet. Activate the SOP first before uploading a batch.`)}`);
  }

  const aliases = getStationAliasesForVendor(db, vendor.id);
  const uploadsRoot = process.env.UPLOADS_ROOT ?? './Vendors';
  const uploadDir = path.resolve(uploadsRoot, vendorName, 'Uploads');

  try {
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeUploadFilename(file.name));
    await writeFile(filePath, buffer!);

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    redirect(`/loads/new?error=${encodeURIComponent(`Upload failed: ${msg}`)}`);
  }

  redirect('/loads');
}
