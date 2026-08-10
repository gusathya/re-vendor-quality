// src/lib/safe-filename.test.ts
import { describe, it, expect } from 'vitest';
import { safeUploadFilename } from './safe-filename';

describe('safeUploadFilename', () => {
  it('produces a safe result that preserves the extension of a normal filename', () => {
    const result = safeUploadFilename('sop-report.xlsx');
    expect(result.endsWith('.xlsx')).toBe(true);
    // UUID + extension, nothing else of the original name survives.
    expect(result).toMatch(/^[0-9a-f-]{36}\.xlsx$/);
  });

  it('strips path-traversal sequences entirely, leaving no separators or ".." in the result', () => {
    const result = safeUploadFilename('../../../etc/passwd');
    expect(result).not.toMatch(/\.\./);
    expect(result).not.toMatch(/[/\\]/);
  });

  it('strips path-traversal sequences even when a trailing extension is present', () => {
    const result = safeUploadFilename('../../../etc/evil.xlsx');
    expect(result).not.toMatch(/\.\./);
    expect(result).not.toMatch(/[/\\]/);
    expect(result.endsWith('.xlsx')).toBe(true);
  });

  it('handles a filename with no extension without throwing', () => {
    expect(() => safeUploadFilename('no-extension-file')).not.toThrow();
    const result = safeUploadFilename('no-extension-file');
    expect(result).toMatch(/^[0-9a-f-]{36}$/);
  });
});
