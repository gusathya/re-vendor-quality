'use server';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { createDraftSopDocument, insertSopParameters } from '@/lib/db/sop';
import { getVendorByName } from '@/lib/db/vendors';
import { parseSopWorkbook } from '@/lib/parsers/sop-parser';
import { stationGroupKey } from '@/lib/station-matching';
import { redirect } from 'next/navigation';

export async function uploadSop(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Not authenticated');

  const file = formData.get('sopFile') as File | null;
  const vendorName = formData.get('vendorName') as string | null;
  if (!file || file.size === 0) throw new Error('No file uploaded');
  if (!vendorName) throw new Error('No vendor selected');

  const buffer = Buffer.from(await file.arrayBuffer());
  const draftParams = parseSopWorkbook(buffer);

  const db = getDb();
  const vendor = getVendorByName(db, vendorName);
  if (!vendor) throw new Error(`Unknown vendor: ${vendorName}`);

  const uploadDir = path.resolve('./Clients', vendorName, 'SOP');
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
  await writeFile(filePath, buffer);

  const doc = createDraftSopDocument(db, { vendorId: vendor.id, filePath, uploadedBy: session.user.id });
  insertSopParameters(
    db,
    doc.id,
    draftParams.map((p) => ({
      stationGroupKey: stationGroupKey(p.process, p.stationNo),
      srNo: p.srNo,
      stationNo: p.stationNo,
      process: p.process,
      productChemical: p.productChemical,
      characteristic: p.characteristic,
      minValue: p.parsed.min,
      maxValue: p.parsed.max,
      unit: p.parsed.unit,
      status: p.parsed.status,
      rawControlLimit: p.controlLimitsRaw,
      rawSpecLimit: p.specLimitsRaw,
    })),
  );

  redirect(`/sops/${doc.id}`);
}
