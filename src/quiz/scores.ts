import type { TopicId } from '../app/ids';
import { readJSON, writeJSON } from '../app/storage';
import type { Difficulty } from './types';

const KEY = 'geo-coords:scores';

export function scoreId(topic: TopicId | 'rehearsal', difficulty: Difficulty): string {
  return topic === 'rehearsal' ? `rehearsal-${difficulty}` : `topic-${topic}-${difficulty}`;
}

// Storage can hold anything (cleared/corrupted data, or a value written by an older/different
// version of the app) — guard against JSON that parsed fine but isn't the plain object we expect
// (null, an array, a string, ...), which would otherwise throw on property access below.
function readAll(): Record<string, number> {
  const all = readJSON<unknown>(KEY, {});
  return all !== null && typeof all === 'object' && !Array.isArray(all) ? (all as Record<string, number>) : {};
}

export function bestScore(id: string): number | null {
  const all = readAll();
  return typeof all[id] === 'number' ? all[id]! : null;
}

export function recordScore(id: string, score: number): number {
  const all = readAll();
  const best = Math.max(all[id] ?? 0, score);
  all[id] = best;
  writeJSON(KEY, all);
  return best;
}
