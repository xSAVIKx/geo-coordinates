import { expect, test } from 'vitest';
import { createRng } from '../../src/quiz/rng';

test('deterministic per seed, different across seeds', () => {
  const a = createRng('5b'), b = createRng('5b'), c = createRng('5c');
  const seqA = Array.from({ length: 5 }, () => a.next());
  expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
  expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
});
test('int is inclusive and in range; shuffle is a permutation', () => {
  const r = createRng(1);
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) { const v = r.int(-2, 2); expect(v).toBeGreaterThanOrEqual(-2); expect(v).toBeLessThanOrEqual(2); seen.add(v); }
  expect(seen.size).toBe(5);
  expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
});
