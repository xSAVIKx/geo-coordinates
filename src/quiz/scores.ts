import type { TopicId } from '../app/ids';
import { readRecord, writeJSON } from '../app/storage';
import type { Difficulty } from './types';

const KEY = 'geo-coords:scores';

export function scoreId(topic: TopicId | 'rehearsal', difficulty: Difficulty): string {
  return topic === 'rehearsal' ? `rehearsal-${difficulty}` : `topic-${topic}-${difficulty}`;
}

// Storage can hold anything (see readRecord); a stored value that is not a number is ignored below.
function readAll(): Record<string, number> {
  return readRecord(KEY) as Record<string, number>;
}

export function bestScore(id: string): number | null {
  const all = readAll();
  return typeof all[id] === 'number' ? all[id]! : null;
}

export function recordScore(id: string, score: number): number {
  const all = readAll();
  const prev = all[id];
  const best = Math.max(typeof prev === 'number' && Number.isFinite(prev) ? prev : 0, score);
  all[id] = best;
  writeJSON(KEY, all);
  return best;
}
