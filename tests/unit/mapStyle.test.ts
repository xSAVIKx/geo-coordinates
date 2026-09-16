import { beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_MAP_STYLE, isMapStyle, isTextureStyle, MAP_STYLES, MAP_STYLE_KEY, parseMapStyle, readMapStyle, writeMapStyle } from '../../src/map/mapStyle';

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

describe('the saved style', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage;
  });
  test('written and read back under its own key', () => {
    expect(MAP_STYLE_KEY).toBe('geo-coords:map-style');
    writeMapStyle('satellite');
    expect(store.get('geo-coords:map-style')).toBe('satellite');
    expect(readMapStyle()).toBe('satellite');
  });
  test('missing, corrupted or unknown values read as Atlas', () => {
    expect(readMapStyle()).toBe('atlas');
    for (const raw of ['', 'null', '"satellite"', 'Satellite', 'terrain', '{}']) { store.set(MAP_STYLE_KEY, raw); expect(readMapStyle(), raw).toBe('atlas'); }
  });
  test('storage that throws reads as Atlas and writing does not throw', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(readMapStyle()).toBe('atlas');
    expect(() => writeMapStyle('physical')).not.toThrow();
  });
});
