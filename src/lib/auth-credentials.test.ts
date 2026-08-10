// src/lib/auth-credentials.test.ts
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { verifyCredentials } from './auth-credentials';

const KNOWN_PASSWORD = 'correct-horse-battery-staple';
const KNOWN_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 10);

describe('verifyCredentials', () => {
  it('returns true for a real user with the correct password', async () => {
    const user = { passwordHash: KNOWN_HASH };
    await expect(verifyCredentials(user, KNOWN_PASSWORD)).resolves.toBe(true);
  });

  it('returns false for a real user with the wrong password', async () => {
    const user = { passwordHash: KNOWN_HASH };
    await expect(verifyCredentials(user, 'totally-wrong-password')).resolves.toBe(false);
  });

  it('returns false for a nonexistent user (null)', async () => {
    await expect(verifyCredentials(null, KNOWN_PASSWORD)).resolves.toBe(false);
  });
});
