import { beforeEach, expect, test } from 'vitest';
import { bestScore, recordScore, scoreId } from '../../src/quiz/scores';

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

test('records the best score per id', () => {
  const id = scoreId(3, 'easy');
  expect(id).toBe('topic-3-easy');
  expect(bestScore(id)).toBeNull();
  expect(recordScore(id, 6)).toBe(6);
  expect(recordScore(id, 4)).toBe(6);
  expect(recordScore(id, 9)).toBe(9);
  expect(bestScore(id)).toBe(9);
  expect(bestScore(scoreId('rehearsal', 'hard'))).toBeNull();
});

test('works when storage throws', () => {
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  expect(recordScore('x', 5)).toBe(5);
  expect(bestScore('x')).toBeNull();
});

test('recovers from non-object JSON in storage instead of throwing', () => {
  const store = new Map<string, string>([['geo-coords:scores', 'null']]);
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  expect(bestScore('x')).toBeNull();
  expect(recordScore('x', 7)).toBe(7);

  store.set('geo-coords:scores', '[1,2,3]');
  expect(bestScore('x')).toBeNull();
  expect(recordScore('x', 3)).toBe(3);

  store.set('geo-coords:scores', '"oops"');
  expect(bestScore('x')).toBeNull();
});
