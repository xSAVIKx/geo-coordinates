import type { MarkerTone } from '../map/types';
import type { Rng } from './types';

export const LABELS = ['A', 'B', 'C', 'D'] as const;
export const TONES: MarkerTone[] = ['a', 'b', 'c', 'd'];

export function gridInt(rng: Rng, min: number, max: number, step: number): number {
  return rng.int(Math.ceil(min / step), Math.floor(max / step)) * step;
}

export function signed(rng: Rng): 1 | -1 {
  return rng.next() < 0.5 ? 1 : -1;
}

export function withMinutes(deg: number, minutes: number): number {
  const s = deg < 0 ? -1 : 1;
  return s * (Math.abs(deg) + minutes / 60);
}
