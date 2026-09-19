import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import boxesJson from '../../src/map/data/city/boxes.json';
import manifest from '../../src/map/data/city/photos/manifest.json';
import { webpSize } from '../../scripts/webp-size';

const DIR = 'src/map/data/city/photos/';
// Planning ruling R22: the ceilings the 8 MiB budget is built on.
const MAX_BYTES: Record<string, number> = { katowice: 340 * 1024, sentinel: 90 * 1024, ortho: 260 * 1024 };
// eo:cloud_cover is the whole 110 km granule's, not the box's. Mitad del Mundo sits in the Andes above Quito and
// has never had a Sentinel-2 granule under 7 % since the mission began, so the build raises its ceiling a step
// (scripts/build-city-photos.py, CLOUD_CEILINGS) and the box itself is clear. Every other box is under 1 %.
const MAX_CLOUD = 15;
const entries = Object.entries(manifest.photos);

describe('city photos', () => {
  test('one photo per box, in the boxes.json order, matching its box exactly', () => {
    expect(entries.map(([id]) => id)).toEqual(boxesJson.boxes.map((b) => b.id));
    for (const [id, p] of entries) {
      const b = boxesJson.boxes.find((x) => x.id === id)!;
      expect(p.bounds, id).toEqual([b.west, b.south, b.east, b.north]);
      expect([p.width, p.height], id).toEqual([b.photoWidth, b.photoHeight]);
      expect(p.source, id).toBe(b.source);
      expect(p.mime, id).toBe('image/webp');
    }
  });

  test('the files on disk are the size and shape the manifest claims, and 3:2 like the box', () => {
    for (const [id, p] of entries) {
      const file = readFileSync(DIR + p.file);
      expect(webpSize(file), id).toEqual({ width: p.width, height: p.height });
      expect(p.bytes, id).toBe(file.length);
      expect(p.width / p.height, id).toBeCloseTo(1.5, 6);
    }
  });

  test('ground resolution is what the source can really give; Sentinel boxes are never enlarged', () => {
    for (const [id, p] of entries) {
      expect(p.groundM, id).toBeCloseTo(boxesJson.widthM / p.width, 2);
      if (p.source === 'sentinel') {
        expect([p.width, p.height], id).toEqual([600, 400]);   // exactly 10 m per pixel: the source's own
        expect(p.groundM, id).toBeCloseTo(10, 1);
      } else {
        expect(p.groundM, id).toBeLessThanOrEqual(5.01);
      }
    }
    expect(manifest.photos.katowice.groundM).toBeCloseTo(4.17, 2);
  });

  test('every photo records a source, a name and a licence, and stays inside its byte ceiling', () => {
    for (const [id, p] of entries) {
      expect(['gugik', 'ign', 'gsi', 'naip', 'sentinel'], id).toContain(p.source);
      expect(p.sourceName.length, id).toBeGreaterThan(8);
      expect(p.licence.length, id).toBeGreaterThan(20);
      if (p.source === 'sentinel') {
        expect(p.licence, id).toMatch(/^Contains modified Copernicus Sentinel data \d{4}(-\d{4})?$/);
        expect(p.cloud, id).toBeLessThan(MAX_CLOUD);
        expect(p.captured, id).toMatch(/^\d{4}-\d\d-\d\d$/);
      }
      const cap = id === 'katowice' ? MAX_BYTES.katowice! : p.source === 'sentinel' ? MAX_BYTES.sentinel! : MAX_BYTES.ortho!;
      expect(p.bytes, `${id} (${(p.bytes / 1024).toFixed(1)} KiB)`).toBeLessThanOrEqual(cap);
    }
  });

  test('only Mitad del Mundo needs a granule cloudier than 5 %', () => {
    const cloudy = entries.filter(([, p]) => p.source === 'sentinel' && (p.cloud ?? 0) >= 5);
    expect(cloudy.map(([id]) => id)).toEqual(['mitaddelmundo']);
  });

  test('all twelve together stay inside the photo half of the budget', () => {
    const total = entries.reduce((n, [, p]) => n + p.bytes, 0);
    // Planning ruling R22: 1.9 MiB raw, about 2.5 MiB once base64 puts it in the page.
    expect(total, `${(total / 1024 / 1024).toFixed(2)} MiB`).toBeLessThan(1.9 * 1024 * 1024);
  });

  test('at least six boxes are sharp enough to show buildings', () => {
    const sharp = entries.filter(([, p]) => p.groundM <= 5.01);
    expect(sharp.map(([id]) => id).sort()).toEqual(['katowice', 'krakow', 'manhattan', 'paris', 'tokyo', 'warsaw']);
  });
});
