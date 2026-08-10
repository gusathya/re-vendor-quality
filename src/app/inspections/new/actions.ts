'use server';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getSopParameterById } from '@/lib/db/sop';
import { createManualCheck } from '@/lib/db/manual-checks';
import { scoreReading } from '@/lib/scoring';
import { redirect } from 'next/navigation';

export async function submitManualCheck(formData: FormData) {
  const session = await auth();
  if (!session?.user?.vendorId) throw new Error('Not authenticated as a vendor user');

  const sopParameterId = formData.get('sopParameterId') as string;
  const value = Number(formData.get('value'));

  const db = getDb();
  const param = getSopParameterById(db, sopParameterId);
  if (!param) throw new Error('Unknown SOP parameter');

  const score = scoreReading(value, param.minValue, param.maxValue);
  if (score === 'unscored') throw new Error('This parameter has no usable limit to check against yet');

  createManualCheck(db, {
    vendorId: session.user.vendorId,
    sopParameterId,
    value,
    checkedAt: new Date().toISOString(),
    enteredBy: session.user.id,
    score,
  });

  redirect('/inspections');
}
