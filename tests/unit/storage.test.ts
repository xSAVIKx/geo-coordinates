import { beforeEach, describe, expect, test } from 'vitest';
import { initSettings, settings } from '../../src/app/settings.svelte';
import { readJSON, readRecord, readString, writeJSON, writeString } from '../../src/app/storage';

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void };
const setStorage = (s: Store | undefined) => { (globalThis as { localStorage?: unknown }).localStorage = s; };
const memory = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const throwing: Store = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };

beforeEach(() => setStorage(memory()));

describe('storage', () => {
  test('reads back what it wrote', () => {
    writeString('k', 'v');
    expect(readString('k')).toBe('v');
    expect(readString('missing')).toBeNull();
    writeJSON('j', { a: 1 });
    expect(readJSON('j', null)).toEqual({ a: 1 });
    expect(readRecord('j')).toEqual({ a: 1 });
  });

  test('storage that throws, or no storage at all, reads as empty and writes nothing without throwing', () => {
    for (const s of [throwing, undefined]) {
      setStorage(s);
      expect(() => writeString('k', 'v')).not.toThrow();
      expect(() => writeJSON('k', { a: 1 })).not.toThrow();
      expect(readString('k')).toBeNull();
      expect(readJSON('k', 'fallback')).toBe('fallback');
      expect(readRecord('k')).toEqual({});
    }
  });

  test('invalid JSON gives the fallback', () => {
    writeString('k', '{not json');
    expect(readJSON('k', 42)).toBe(42);
    expect(readRecord('k')).toEqual({});
  });

  test('JSON that is not a plain object reads as an empty record', () => {
    for (const raw of ['null', '[]', '[1,2]', '"text"', '7', 'true']) {
      writeString('k', raw);
      expect(readRecord('k'), raw).toEqual({});
    }
    // readJSON itself hands back what parsed (callers that need an object use readRecord).
    writeString('k', 'null');
    expect(readJSON('k', { a: 1 })).toBeNull();
  });
});

describe('saved settings', () => {
  const defaults = { theme: 'system', largeText: false, reducedMotion: false };

  test('null, a non-object, invalid JSON or throwing storage fall back to the defaults', () => {
    for (const raw of ['null', '[]', '"dark"', '12', '{oops']) {
      const store = memory();
      store.data.set('geo-coords:settings', raw);
      setStorage(store);
      settings.theme = 'dark'; settings.largeText = true; settings.reducedMotion = true;
      expect(() => initSettings(), raw).not.toThrow();
      expect({ ...settings }, raw).toEqual(defaults);
    }
    setStorage(throwing);
    expect(() => initSettings()).not.toThrow();
    expect({ ...settings }).toEqual(defaults);
  });

  test('each field is validated on its own', () => {
    const store = memory();
    store.data.set('geo-coords:settings', JSON.stringify({ theme: 'purple', largeText: 'yes', reducedMotion: 1 }));
    setStorage(store);
    initSettings();
    expect({ ...settings }).toEqual(defaults);
    store.data.set('geo-coords:settings', JSON.stringify({ theme: 'dark', largeText: true, reducedMotion: false }));
    initSettings();
    expect({ ...settings }).toEqual({ theme: 'dark', largeText: true, reducedMotion: false });
    store.data.set('geo-coords:settings', JSON.stringify({ theme: 'light' }));
    initSettings();
    expect({ ...settings }).toEqual({ theme: 'light', largeText: false, reducedMotion: false });
  });
});
