import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getActiveSopParameters } from '@/lib/db/sop';

function escapeCSV(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

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

  const headers = ['Sr No', 'Station No', 'Process', 'Product / Chemical', 'Characteristic', 'Min Value', 'Max Value', 'Unit', 'Control Limit', 'Spec Limit'];

  const lines = [
    headers.map(escapeCSV).join(','),
    ...params.map((p) =>
      [p.srNo, p.stationNo, p.process, p.productChemical, p.characteristic, p.minValue, p.maxValue, p.unit, p.rawControlLimit, p.rawSpecLimit]
        .map(escapeCSV)
        .join(','),
    ),
  ];

  const csv = lines.join('\r\n');
  const vendorSlug = (vendor?.name ?? 'vendor').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `RE_SOP_${vendorSlug}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
