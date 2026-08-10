// src/lib/auth-credentials.ts
import bcrypt from 'bcryptjs';

// Used only when no user was found for the supplied email. Comparing against this fixed
// hash (instead of short-circuiting) ensures `verifyCredentials` always pays the same
// bcrypt cost whether the account exists or not, closing a timing side-channel that would
// otherwise let an attacker distinguish "unknown email" from "wrong password" by latency.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', 10);

/**
 * Verifies a plaintext password against a user's stored bcrypt hash.
 *
 * Always calls `bcrypt.compare` exactly once, regardless of whether `user` is `null`, so
 * the "unknown email" and "wrong password" paths take the same amount of time. Returns
 * `true` only when `user` is non-null and the password actually matches its hash.
 */
export async function verifyCredentials(
  user: { passwordHash: string } | null,
  password: string,
): Promise<boolean> {
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);
  return user !== null && matches;
}
