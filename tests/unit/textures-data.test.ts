import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import regionJson from '../../src/map/data/central-europe.json';
import manifest from '../../src/map/data/textures/manifest.json';
import { webpSize } from '../../scripts/webp-size';

const DIR = 'src/map/data/textures/';
const EXPECTED: Record<string, [number, number]> = {
  'physical-world': [4096, 2048], 'physical-region': [720, 420],
  'satellite-day': [4096, 2048], 'satellite-region': [1440, 840], 'satellite-night': [4096, 2048],
};
const entries = Object.entries(manifest.textures) as [string, { file: string; width: number; height: number; bounds: number[]; source: string; bytes: number; mime: string }][];

describe('webpSize', () => {
  test('reads a VP8X header', () => {
    const buf = new Uint8Array(30);
    buf.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    buf.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
    buf.set([0xff, 0x0f, 0x00, 0xff, 0x07, 0x00], 24); // 4096 × 2048
    expect(webpSize(buf)).toEqual({ width: 4096, height: 2048 });
    expect(() => webpSize(new Uint8Array(40))).toThrow(/not a WebP/);
  });
});

describe('map-style textures', () => {
  test('the five textures, with the sizes the plan fixes, read from the files themselves', () => {
    expect(entries.map(([id]) => id).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [id, t] of entries) {
      const file = readFileSync(DIR + t.file);
      expect(webpSize(file), id).toEqual({ width: EXPECTED[id]![0], height: EXPECTED[id]![1] });
      expect([t.width, t.height], id).toEqual(EXPECTED[id]);
      expect(t.bytes, id).toBe(file.length);
      expect(t.mime, id).toBe('image/webp');
    }
  });

  test('world textures cover the whole world; region tiles cover the Central Europe box at 30 and 60 px per degree', () => {
    const r = regionJson.region;
    expect([r.west, r.south, r.east, r.north]).toEqual([8, 44, 32, 58]);
    for (const [id, t] of entries) {
      if (id.endsWith('-region')) expect(t.bounds, id).toEqual([8, 44, 32, 58]);
      else expect(t.bounds, id).toEqual([-180, -90, 180, 90]);
    }
    expect(manifest.textures['physical-region'].width / 24).toBe(30);
    expect(manifest.textures['satellite-region'].width / 24).toBe(60);
    expect(manifest.textures['satellite-region'].height / 14).toBe(60);
  });

  test('sources are recorded and the set stays within its budget', () => {
    expect(manifest.textures['physical-world'].source).toMatch(/Natural Earth.*HYP_50M_SR_W.*2\.0\.0/);
    expect(manifest.textures['physical-region'].source).toMatch(/HYP_50M_SR_W/);
    expect(manifest.textures['satellite-day'].source).toMatch(/NASA Earth Observatory.*Blue Marble/);
    expect(manifest.textures['satellite-region'].source).toMatch(/Blue Marble.*21600/);
    expect(manifest.textures['satellite-night'].source).toMatch(/NASA Earth Observatory.*Black Marble 2016/);
    const total = entries.reduce((n, [, t]) => n + t.bytes, 0);
    // ≈ 1.45 MB measured in the brainstorm (sizes.json); base64 adds a third in the page.
    expect(total).toBeLessThan(2.2 * 1024 * 1024);
    expect(manifest.textures['physical-world'].bytes).toBeLessThan(560 * 1024);
    expect(manifest.textures['satellite-day'].bytes).toBeLessThan(760 * 1024);
    expect(manifest.textures['satellite-night'].bytes).toBeLessThan(360 * 1024);
  });
});
