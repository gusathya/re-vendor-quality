// src/lib/require-vendor-session.ts
import { auth } from './auth';

export interface VendorSession {
  vendorId: string;
}

// Dashboard pages (Table, Trends, Hotspots, Compare, Capability) are all vendor-scoped:
// each one needs a signed-in user with a vendorId before it can query. Extracted here once
// this auth-check-and-guard block started appearing on a second page (Trends, Task 18) after
// the Table page (Task 17), to avoid re-copying the same two lines across the remaining tabs.
export async function requireVendorSession(): Promise<VendorSession | null> {
  const session = await auth();
  if (!session?.user?.vendorId) return null;
  return { vendorId: session.user.vendorId };
}
