import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import photoManifest from '../../src/map/data/city/photos/manifest.json';
import streetManifest from '../../src/map/data/city/streets/manifest.json';
import boxesJson from '../../src/map/data/city/boxes.json';
import { cityBlocks, PHOTO_SCRIPT_TYPE, STREET_SCRIPT_TYPE } from '../../scripts/city-plugin';
import { unpackStreetTopology } from '../../src/map/cityStreets';

const html = cityBlocks();
const ids = boxesJson.boxes.map((b) => b.id);

describe('city data blocks', () => {
  test('one photo block and one street block per box, in the boxes.json order', () => {
    expect([...html.matchAll(/id="geo-photo-([a-z]+)"/g)].map((m) => m[1])).toEqual(ids);
    expect([...html.matchAll(/id="geo-city-([a-z]+)"/g)].map((m) => m[1])).toEqual(ids);
    expect(html).toContain(`type="${PHOTO_SCRIPT_TYPE}"`);
    expect(html).toContain(`type="${STREET_SCRIPT_TYPE}"`);
  });

  test('a photo block is the base64 of its file, and carries its size for the decoder', () => {
    const p = photoManifest.photos.katowice;
    const b64 = readFileSync(`src/map/data/city/photos/${p.file}`).toString('base64');
    const block = new RegExp(`<script type="${PHOTO_SCRIPT_TYPE}" id="geo-photo-katowice" data-width="(\\d+)" data-height="(\\d+)">([A-Za-z0-9+/=]+)</script>`).exec(html)!;
    expect(block[1]).toBe(String(p.width));
    expect(block[2]).toBe(String(p.height));
    expect(block[3]).toBe(b64);
  });

  test('a street block is the base64 of its gzipped file, can never close its own script tag, and unpacks back to a topology with roads', async () => {
    const s = streetManifest.streets.katowice;
    const b64 = readFileSync(`src/map/data/city/streets/${s.file}`).toString('base64');
    expect(html).toContain(`<script type="${STREET_SCRIPT_TYPE}" id="geo-city-katowice">${b64}</script>`);
    for (const id of ids) {
      const entry = (streetManifest.streets as Record<string, { file: string }>)[id]!;
      const raw = readFileSync(`src/map/data/city/streets/${entry.file}`).toString('base64');
      expect(raw, id).not.toContain('</script');
    }
    const topology = await unpackStreetTopology(b64);
    expect(topology).not.toBeNull();
    expect(topology!.objects.roads).toBeDefined();
  });

  test('the blocks together are what the 8 MiB budget expects (planning ruling R22, gzip embedding per Task 2)', () => {
    const b64Bytes = (n: number) => Math.ceil(n / 3) * 4;
    const photos = Object.values(photoManifest.photos).reduce((n, p) => n + b64Bytes(p.bytes), 0);
    const streets = Object.values(streetManifest.streets).reduce((n, s) => n + b64Bytes(s.bytes), 0);
    expect(Buffer.byteLength(html, 'utf8')).toBeGreaterThan(photos + streets);          // plus the tags
    expect(photos + streets, `${((photos + streets) / 1024 / 1024).toFixed(2)} MiB`).toBeLessThan(4 * 1024 * 1024);
  });
});
