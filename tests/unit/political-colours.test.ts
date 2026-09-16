import { expect, test } from 'vitest';
import { colourCountries, PALETTE_SIZE } from '../../scripts/political-colours';

const differ = (colours: number[], neighbours: number[][]) => neighbours.every((ns, i) => ns.every((j) => colours[i] !== colours[j]));

test('neighbours get different colours, with as few colours as DSatur needs', () => {
  // A triangle needs 3; a wheel with 5 spokes (odd cycle + hub) needs 4.
  const triangle = [[1, 2], [0, 2], [0, 1]];
  const t = colourCountries(['A', 'B', 'C'], triangle);
  expect(differ(t, triangle)).toBe(true);
  expect(new Set(t).size).toBe(3);
  const wheel = [[1, 2, 3, 4, 5], [0, 2, 5], [0, 1, 3], [0, 2, 4], [0, 3, 5], [0, 4, 1]];
  const w = colourCountries(['H', 'a', 'b', 'c', 'd', 'e'], wheel);
  expect(differ(w, wheel)).toBe(true);
  expect(Math.max(...w)).toBe(3);
});

test('isolated countries take colour 0; the result does not depend on input order', () => {
  expect(colourCountries(['X', 'Y'], [[], []])).toEqual([0, 0]);
  const ids = ['POL', 'DEU', 'CZE'];
  const ns = [[1, 2], [0, 2], [0, 1]];
  const a = colourCountries(ids, ns);
  const b = colourCountries([...ids].reverse(), [[1, 2], [0, 2], [0, 1]].map((n) => n.map((j) => 2 - j)).reverse());
  expect([...b].reverse()).toEqual(a);
});

test('a graph needing more colours than the palette fails loudly', () => {
  const k7 = Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => j).filter((j) => j !== i));
  expect(() => colourCountries('ABCDEFG'.split(''), k7, PALETTE_SIZE)).toThrow(/needs colour 7 of 6/);
});
