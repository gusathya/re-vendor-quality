import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getActiveSopParameters } from '@/lib/db/sop';
import * as XLSX from 'xlsx';

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const vendorId = session.user.vendorId;
  if (!vendorId) return new Response('No vendor associated with this account', { status: 403 });

  const db = getDb();
  const params = getActiveSopParameters(db, vendorId);

  if (params.length === 0) {
    return new Response('No active SOP found for this vendor', { status: 404 });
  }

  const vendor = db
    .prepare('SELECT name, vendor_code FROM vendors WHERE id = ?')
    .get(vendorId) as { name: string; vendor_code: string | null } | undefined;

  const rows = params.map((p) => ({
    'Sr No': p.srNo,
    'Station No': p.stationNo ?? '',
    'Process': p.process,
    'Product / Chemical': p.productChemical ?? '',
    'Characteristic': p.characteristic ?? '',
    'Min Value': p.minValue ?? '',
    'Max Value': p.maxValue ?? '',
    'Unit': p.unit ?? '',
    'Control Limit': p.rawControlLimit ?? '',
    'Spec Limit': p.rawSpecLimit ?? '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 20 },
    { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 16 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'SOP Parameters');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const vendorSlug = (vendor?.name ?? 'vendor').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `RE_SOP_${vendorSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
