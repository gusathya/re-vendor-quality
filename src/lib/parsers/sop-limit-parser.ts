// src/lib/parsers/sop-limit-parser.ts

export type LimitStatus = 'parsed' | 'needs_review' | 'non_numeric' | 'no_limit';

export interface ParsedLimit {
  status: LimitStatus;
  min: number | null;
  max: number | null;
  unit: string | null;
  prefix: string | null;
  target: number | null;
  raw: string | null;
}

const RANGE_RE = /^(?:([A-Za-z]{1,4})\s+)?([\d.]+)\s*([A-Za-z°%]*)\s*[–-]\s*([\d.]+)\s*([A-Za-z°%/.\-]*)$/;
const LT_RE = /^<\s*([\d.]+)\s*([A-Za-z°%]*)$/;
const EXACT_RE = /^([\d.]+)\s*([A-Za-z°%/.\-]+)$/;
const TRAILING_QUALIFIER_RE = /\s+(minimum|maximum|min|max)\.?$/i;

const KNOWN_UNITS = new Set([
  '°C', 'SEC', 'MIN', 'HRS', 'GM', 'ML', 'MICRONS', 'AMP',
  'GM/LIT', 'ML/LIT', 'ML/AMP-HR', 'AMP/KG', 'LIT/MIN',
]);

function normalizeUnitForLookup(unit: string): string {
  return unit.toUpperCase().replace(/\./g, '');
}

type PartialLimit = Omit<ParsedLimit, 'raw'>;

const NEEDS_REVIEW: PartialLimit = { status: 'needs_review', min: null, max: null, unit: null, prefix: null, target: null };

function parseSingleExpression(text: string): PartialLimit {
  const range = text.match(RANGE_RE);
  if (range) {
    const [, prefix, minStr, unitA, maxStr, unitB] = range;
    const unit = unitB || unitA || null;
    return { status: 'parsed', min: parseFloat(minStr), max: parseFloat(maxStr), unit, prefix: prefix ?? null, target: null };
  }

  const lt = text.match(LT_RE);
  if (lt) {
    const [, maxStr, unit] = lt;
    return { status: 'parsed', min: null, max: parseFloat(maxStr), unit: unit || null, prefix: null, target: null };
  }

  const exact = text.match(EXACT_RE);
  if (exact) {
    const [, valStr, unit] = exact;
    if (KNOWN_UNITS.has(normalizeUnitForLookup(unit))) {
      const val = parseFloat(valStr);
      return { status: 'parsed', min: val, max: val, unit, prefix: null, target: val };
    }
  }

  return NEEDS_REVIEW;
}

/** Used only for the left/target side of a "/"-combined cell, where a unit can be followed by a qualifier word (e.g. "240 Hrs min"). */
function parseTargetExpression(text: string): PartialLimit {
  const stripped = text.replace(TRAILING_QUALIFIER_RE, '').trim();
  return parseSingleExpression(stripped);
}

export function parseControlLimit(raw: string | null | undefined): ParsedLimit {
  const normalizedRaw = raw ?? null;
  const text = (raw ?? '').trim();

  if (!text) {
    return { status: 'no_limit', min: null, max: null, unit: null, prefix: null, target: null, raw: normalizedRaw };
  }
  if (!/\d/.test(text)) {
    return { status: 'non_numeric', min: null, max: null, unit: null, prefix: null, target: null, raw: normalizedRaw };
  }

  // " / " (with surrounding spaces) marks a dual-limit cell like "15 microns / 12 – 17 microns".
  // A bare unit-internal slash (e.g. "gm/lit", "ml/amp-hr") never has surrounding spaces, so this
  // check does not misfire on ordinary ranges whose unit happens to contain a slash.
  if (text.includes(' / ')) {
    const [leftRaw, rightRaw] = text.split(' / ').map((s) => s.trim());
    const right = parseSingleExpression(rightRaw);
    if (right.status === 'parsed' && right.min !== null && right.max !== null) {
      const left = parseTargetExpression(leftRaw);
      return { ...right, target: left.target ?? left.min ?? left.max, raw: normalizedRaw };
    }
  }

  return { ...parseSingleExpression(text), raw: normalizedRaw };
}
