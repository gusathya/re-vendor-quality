export type ScoreResult = 'pass' | 'fail' | 'unscored';

export function scoreReading(value: number | null, min: number | null, max: number | null): ScoreResult {
  if (value === null) return 'unscored';
  if (min === null && max === null) return 'unscored';
  if (min !== null && value < min) return 'fail';
  if (max !== null && value > max) return 'fail';
  return 'pass';
}
