import { expect, test } from 'vitest';
import { DEFAULT_MAP_STYLE, isMapStyle, isTextureStyle, MAP_STYLES, parseMapStyle } from '../../src/map/mapStyle';

test('four styles in switch order, Atlas by default', () => {
  expect(MAP_STYLES).toEqual(['atlas', 'physical', 'satellite', 'political']);
  expect(DEFAULT_MAP_STYLE).toBe('atlas');
  expect(MAP_STYLES.filter(isTextureStyle)).toEqual(['physical', 'satellite']);
});

test('a saved or typed value is a style only when it is exactly one; anything else reads as Atlas', () => {
  for (const s of MAP_STYLES) { expect(isMapStyle(s)).toBe(true); expect(parseMapStyle(s)).toBe(s); }
  for (const v of [null, undefined, '', 'Satellite', ' physical', 'terrain', 1, true, {}, ['atlas']]) {
    expect(isMapStyle(v), String(v)).toBe(false);
    expect(parseMapStyle(v), String(v)).toBe('atlas');
  }
});
