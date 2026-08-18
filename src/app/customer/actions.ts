'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function canReview(role: string) {
  return role === 'customer' || role === 'admin';
}

export async function approveLoadReport(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || !canReview(session.user.role)) return;

  const loadId = formData.get('loadId');
  const note = formData.get('reviewNote');
  if (typeof loadId !== 'string' || !loadId) return;
  if (typeof note !== 'string' || !note.trim()) return;

  const db = getDb();
  const load = db
    .prepare('SELECT push_status FROM load_reports WHERE id = ?')
    .get(loadId) as { push_status: string } | undefined;

  if (!load || load.push_status !== 'pending') return;

  db.prepare(
    "UPDATE load_reports SET push_status = 'approved', reviewed_at = datetime('now'), reviewed_by = ?, review_note = ? WHERE id = ?",
  ).run(session.user.id, note.trim(), loadId);

  revalidatePath('/customer');
  revalidatePath('/admin');
}

export async function rejectLoadReport(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || !canReview(session.user.role)) return;

  const loadId = formData.get('loadId');
  const note = formData.get('reviewNote');
  if (typeof loadId !== 'string' || !loadId) return;
  if (typeof note !== 'string' || !note.trim()) return;

  const db = getDb();
  const load = db
    .prepare('SELECT push_status FROM load_reports WHERE id = ?')
    .get(loadId) as { push_status: string } | undefined;

  if (!load || load.push_status !== 'pending') return;

  db.prepare(
    "UPDATE load_reports SET push_status = 'rejected', reviewed_at = datetime('now'), reviewed_by = ?, review_note = ? WHERE id = ?",
  ).run(session.user.id, note.trim(), loadId);

  revalidatePath('/customer');
  revalidatePath('/admin');
  redirect(`/customer?emailLoadId=${loadId}`);
}
