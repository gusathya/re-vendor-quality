import { describe, it, expect } from 'vitest';
import { scoreReading } from './scoring';

describe('scoreReading', () => {
  it('passes a value inside the range', () => {
    expect(scoreReading(55, 50, 70)).toBe('pass');
  });

  it('passes a value exactly at the min boundary (inclusive)', () => {
    expect(scoreReading(50, 50, 70)).toBe('pass');
  });

  it('passes a value exactly at the max boundary (inclusive)', () => {
    expect(scoreReading(70, 50, 70)).toBe('pass');
  });

  it('fails a value below the min', () => {
    expect(scoreReading(49.9, 50, 70)).toBe('fail');
  });

  it('fails a value above the max', () => {
    expect(scoreReading(70.1, 50, 70)).toBe('fail');
  });

  it('passes a value above a min-only limit (no max)', () => {
    expect(scoreReading(100, 50, null)).toBe('pass');
  });

  it('fails a value below a min-only limit', () => {
    expect(scoreReading(10, 50, null)).toBe('fail');
  });

  it('passes a value below a max-only limit (no min)', () => {
    expect(scoreReading(5, null, 12)).toBe('pass');
  });

  it('fails a value above a max-only limit', () => {
    expect(scoreReading(13, null, 12)).toBe('fail');
  });

  it('is unscored when the reading value is null (station not logged)', () => {
    expect(scoreReading(null, 50, 70)).toBe('unscored');
  });

  it('is unscored when there is no limit to check against', () => {
    expect(scoreReading(55, null, null)).toBe('unscored');
  });
});
