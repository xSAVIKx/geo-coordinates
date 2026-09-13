import { normalizeLon } from './format';
import type { LatLon } from './types';

export function hemisphereLat(lat: number): 'N' | 'S' | null {
  return lat > 0 ? 'N' : lat < 0 ? 'S' : null;
}

export function hemisphereLon(lon: number): 'E' | 'W' | null {
  const n = normalizeLon(lon);
  if (n === 0 || n === 180) return null;
  return n > 0 ? 'E' : 'W';
}

export function relativeToParallel(lat: number, parallel: number): 'north' | 'south' | 'on' {
  return lat > parallel ? 'north' : lat < parallel ? 'south' : 'on';
}

export function relativeToMeridian(lon: number, meridian: number): 'east' | 'west' | 'on' | 'opposite' {
  const d = normalizeLon(lon - meridian);
  if (d === 0) return 'on';
  if (d === 180) return 'opposite';
  return d > 0 ? 'east' : 'west';
}

export function latDifference(a: number, b: number): number {
  return Math.abs(a - b);
}

export function lonDifference(a: number, b: number): number {
  const d = Math.abs(normalizeLon(a) - normalizeLon(b));
  return d > 180 ? 360 - d : d;
}

export function latDifferenceMethod(a: number, b: number): 'same-subtract' | 'opposite-add' | 'zero-line' {
  if (a === 0 || b === 0) return 'zero-line';
  return Math.sign(a) === Math.sign(b) ? 'same-subtract' : 'opposite-add';
}

export function lonDifferenceMethod(a: number, b: number): 'same-subtract' | 'opposite-add' | 'opposite-over-180' | 'zero-line' {
  const ha = hemisphereLon(a);
  const hb = hemisphereLon(b);
  if (ha === null || hb === null) return 'zero-line';
  if (ha === hb) return 'same-subtract';
  return Math.abs(normalizeLon(a)) + Math.abs(normalizeLon(b)) > 180 ? 'opposite-over-180' : 'opposite-add';
}

export function extremeIndex(points: readonly LatLon[], dir: 'N' | 'S' | 'E' | 'W'): number {
  const key = (p: LatLon) => (dir === 'N' ? p.lat : dir === 'S' ? -p.lat : dir === 'E' ? normalizeLon(p.lon) : -normalizeLon(p.lon));
  let best = 0;
  points.forEach((p, i) => { if (key(p) > key(points[best]!)) best = i; });
  return best;
}

export function spansAntimeridian(lons: readonly number[]): boolean {
  const sorted = [...new Set(lons.map(normalizeLon))].sort((x, y) => x - y);
  if (sorted.length < 2) return false;
  // Largest empty gap; the points' smallest covering arc is the complement of that gap.
  let gapStart = sorted[sorted.length - 1]!;
  let gap = sorted[0]! + 360 - gapStart;
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i]! - sorted[i - 1]!;
    if (g > gap) { gap = g; gapStart = sorted[i - 1]!; }
  }
  const gapEnd = gapStart + gap;
  // The covering arc crosses 180° unless the gap itself contains 180° (or -180°).
  const contains180 = (gapStart < 180 && gapEnd > 180) || (gapStart < -180 && gapEnd > -180);
  return !contains180;
}
