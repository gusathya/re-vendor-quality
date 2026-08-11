'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { updateVendorFolderUrl } from '@/lib/db/vendors';
import { revalidatePath } from 'next/cache';

export async function saveFolderUrl(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') return;

  const vendorId = formData.get('vendorId');
  const url = formData.get('folderUrl');

  if (typeof vendorId !== 'string' || !vendorId) return;
  if (typeof url !== 'string') return;

  const trimmed = url.trim();
  if (trimmed && !trimmed.startsWith('http')) return;

  updateVendorFolderUrl(getDb(), vendorId, trimmed || null);
  revalidatePath('/settings');
  revalidatePath('/');
}
