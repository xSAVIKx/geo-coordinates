import type { TopicId } from '../app/ids';
import { readJSON, writeJSON } from '../app/storage';
import type { Difficulty } from './types';

const KEY = 'geo-coords:scores';

export function scoreId(topic: TopicId | 'rehearsal', difficulty: Difficulty): string {
  return topic === 'rehearsal' ? `rehearsal-${difficulty}` : `topic-${topic}-${difficulty}`;
}

export function bestScore(id: string): number | null {
  const all = readJSON<Record<string, number>>(KEY, {});
  return typeof all[id] === 'number' ? all[id]! : null;
}

export function recordScore(id: string, score: number): number {
  const all = readJSON<Record<string, number>>(KEY, {});
  const best = Math.max(all[id] ?? 0, score);
  all[id] = best;
  writeJSON(KEY, all);
  return best;
}
