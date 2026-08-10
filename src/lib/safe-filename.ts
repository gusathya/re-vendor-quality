// src/lib/safe-filename.ts
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * Returns a filename that is safe to `path.join` into an on-disk upload directory.
 *
 * The original filename's text is never reused in the path — only its extension (if any)
 * is preserved, purely for human readability of the stored file. This eliminates path
 * traversal risk entirely: there is no directory-component or `..` sequence to strip or
 * miss, because none of the original name's characters make it into the returned string
 * except via `path.extname`, which itself only ever returns a suffix like `.xlsx`.
 */
export function safeUploadFilename(originalName: string): string {
  const ext = path.extname(originalName);
  return `${randomUUID()}${ext}`;
}
