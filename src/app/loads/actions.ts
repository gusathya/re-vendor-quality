'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { revalidatePath } from 'next/cache';

export async function pushLoadReport(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'vendor') return;

  const loadId = formData.get('loadId');
  if (typeof loadId !== 'string' || !loadId) return;

  const db = getDb();
  const load = db
    .prepare('SELECT vendor_id, push_status FROM load_reports WHERE id = ?')
    .get(loadId) as { vendor_id: string; push_status: string } | undefined;

  if (!load) return;
  if (load.vendor_id !== session.user.vendorId) return;
  if (load.push_status !== 'draft' && load.push_status !== 'rejected') return;

  db.prepare(
    "UPDATE load_reports SET push_status = 'pending', pushed_at = datetime('now') WHERE id = ?",
  ).run(loadId);

  revalidatePath('/loads');
  revalidatePath('/customer');
}
