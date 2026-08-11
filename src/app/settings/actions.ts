'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { updateVendorFolderUrl, updateVendorMeta } from '@/lib/db/vendors';
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

export async function saveVendorMeta(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') return;

  const vendorId = formData.get('vendorId');
  const categoryId = formData.get('categoryId');
  const vendorCode = formData.get('vendorCode');

  if (typeof vendorId !== 'string' || !vendorId) return;

  updateVendorMeta(getDb(), vendorId, {
    categoryId: typeof categoryId === 'string' && categoryId ? categoryId : null,
    vendorCode: typeof vendorCode === 'string' ? vendorCode : null,
  });
  revalidatePath('/settings');
  revalidatePath('/admin');
}
