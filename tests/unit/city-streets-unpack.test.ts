import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import { feature } from 'topojson-client';
import {
  canUnpackStreets, STREET_ENCODING, unpackStreetTopology, type StreetTopology,
} from '../../src/map/cityStreets';

const DIR = 'src/map/data/city/streets/';
const block = (id: string) => readFileSync(DIR + `${id}.json.gz`).toString('base64');

describe('unpacking a city street block', () => {
  test('the committed gzip round-trips into a usable topology', async () => {
    expect(STREET_ENCODING).toBe('gzip');
    expect(canUnpackStreets()).toBe(true);
    const t = await unpackStreetTopology(block('katowice'));
    expect(t).not.toBeNull();
    const topo = t as StreetTopology;
    expect(Object.keys(topo.objects).sort()).toEqual(['green', 'rail', 'roads', 'water', 'waterways']);
    expect(topo.source).toMatch(/OpenStreetMap/);
    expect(topo.transform).toBeDefined();
    const roads = feature(topo, topo.objects.roads).features;
    expect(roads.length).toBeGreaterThan(50);
    expect(roads.some((f) => f.properties.n === 'Chorzowska')).toBe(true);
  });

  test('every box unpacks', async () => {
    for (const id of ['greenwich', 'mitaddelmundo', 'rovaniemi', 'warsaw', 'krakow', 'paris',
      'manhattan', 'delhi', 'sydney', 'tokyo', 'giza']) {
      expect((await unpackStreetTopology(block(id)))?.objects.roads.geometries.length, id).toBeGreaterThan(0);
    }
  });

  test('whitespace in the block is ignored, the way an HTML script block may carry it', async () => {
    const wrapped = block('rovaniemi').replace(/(.{76})/g, '$1\n');
    expect(await unpackStreetTopology(wrapped)).not.toBeNull();
  });

  // The street layer must fail alone: every one of these returns null rather than throwing, so the caller draws
  // no streets and the rest of the map is untouched.
  test.each([
    ['not base64 at all', 'not base64 at all!!'],
    ['base64 of something that is not gzip', Buffer.from('{"objects":{}}').toString('base64')],
    ['gzip of text that is not JSON', gzipSync(Buffer.from('half a file')).toString('base64')],
    ['gzip of JSON of the wrong shape', gzipSync(Buffer.from('{"objects":{"roads":{}}}')).toString('base64')],
    ['gzip of a topology missing a layer', gzipSync(Buffer.from(JSON.stringify({
      type: 'Topology', arcs: [], places: [], objects: { roads: { type: 'GeometryCollection', geometries: [] } },
    }))).toString('base64')],
    ['an empty block', ''],
  ])('returns null for %s', async (_label, text) => {
    await expect(unpackStreetTopology(text)).resolves.toBeNull();
  });

  test('a truncated block returns null instead of throwing', async () => {
    const half = block('rovaniemi').slice(0, 400);
    await expect(unpackStreetTopology(half)).resolves.toBeNull();
  });

  test('a browser without DecompressionStream loses the streets, not the map', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      expect(canUnpackStreets()).toBe(false);
      await expect(unpackStreetTopology(block('katowice'))).resolves.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
