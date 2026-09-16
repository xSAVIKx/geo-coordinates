import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { decodeBase64, fitWithin, STYLE_TEXTURES } from '../../src/map/texture/assets';
import { sunVector } from '../../src/map/texture/renderer';

test('base64 from a data block decodes to the file bytes (whitespace and line breaks ignored)', () => {
  const bytes = readFileSync('src/map/data/textures/physical-region.webp');
  const b64 = bytes.toString('base64');
  const wrapped = `\n  ${b64.slice(0, 100)}\n${b64.slice(100)}  \n`;
  expect(Buffer.from(decodeBase64(wrapped)).equals(bytes)).toBe(true);
  expect([...decodeBase64('QUJD')]).toEqual([65, 66, 67]);
});

test('textures larger than the device allows are decoded smaller, keeping their shape', () => {
  expect(fitWithin(4096, 2048, 4096)).toEqual({ width: 4096, height: 2048 });
  expect(fitWithin(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
  expect(fitWithin(1440, 840, 2048)).toEqual({ width: 1440, height: 840 });
  expect(fitWithin(1440, 840, 1024)).toEqual({ width: 1024, height: 597 });
});

test('which textures each style needs', () => {
  expect(STYLE_TEXTURES).toEqual({
    physical: { day: 'physical-world', region: 'physical-region', night: null },
    satellite: { day: 'satellite-day', region: 'satellite-region', night: 'satellite-night' },
  });
});

test('the Sun as a unit vector in d3 cartesian coordinates', () => {
  const v = sunVector({ lat: 0, lon: 90 });
  expect(v.x).toBeCloseTo(0, 12); expect(v.y).toBeCloseTo(1, 12); expect(v.z).toBeCloseTo(0, 12);
  expect(sunVector({ lat: 90, lon: 0 }).z).toBeCloseTo(1, 12);
});
