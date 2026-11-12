import { readFileSync } from 'node:fs';
import { afterAll, expect, test, vi } from 'vitest';
import { loadStreets, streetsLoaded } from '../../src/map/streets';

/*
 * The hosted page downloads a box's street data (scripts/build-site.ts). A download that fails must not be
 * remembered like a block that cannot be unpacked: a later frame tries again, after a wait that grows.
 */
const file = readFileSync('src/map/data/city/streets/katowice.json.gz');
(globalThis as { document?: unknown }).document = {
  baseURI: 'https://example.test/geo-coordinates/',
  getElementById: (id: string) => (id === 'geo-city-katowice'
    ? { textContent: '', getAttribute: (n: string) => (n === 'data-src' ? 'data/geo-city-katowice-0.bin' : null) }
    : null),
};
let online = false;
const get = vi.fn(async () => {
  if (!online) throw new TypeError('Failed to fetch');
  return new Response(new Uint8Array(file));
});
vi.stubGlobal('fetch', get);
afterAll(() => { vi.unstubAllGlobals(); });

test('a failed download is retried after a backoff, and then the box loads', async () => {
  const t0 = 1_000_000;
  expect(await loadStreets('katowice', t0)).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
  // Within the first wait (2 s), every frame gets false at once, with no request.
  expect(await loadStreets('katowice', t0 + 100)).toBe(false);
  expect(await loadStreets('katowice', t0 + 1999)).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
  // After it, one more request; it fails too, so the next wait is 4 s.
  expect(await loadStreets('katowice', t0 + 2000)).toBe(false);
  expect(get).toHaveBeenCalledTimes(2);
  expect(await loadStreets('katowice', t0 + 2000 + 3999)).toBe(false);
  expect(get).toHaveBeenCalledTimes(2);
  // The network comes back: the next attempt loads the box, and it stays loaded.
  online = true;
  expect(await loadStreets('katowice', t0 + 2000 + 4000)).toBe(true);
  expect(get).toHaveBeenCalledTimes(3);
  expect(streetsLoaded('katowice')).toBe(true);
  expect(await loadStreets('katowice', t0 + 10_000)).toBe(true);
  expect(get).toHaveBeenCalledTimes(3);
});
