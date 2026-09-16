import { beforeEach, expect, test } from 'vitest';
import { MapState } from '../../src/map/mapState.svelte';
import { markReady, reportHealth, resetHealth } from '../../src/map/texture/health.svelte';

beforeEach(() => resetHealth());

test('Atlas by default; a scene with no style keeps the preference', () => {
  const s = new MapState();
  expect(s.chosenMapStyle).toBe('atlas');
  s.setStylePreference('political');
  s.applyScene({ views: ['flat'] });
  expect(s.chosenMapStyle).toBe('political');
  expect(s.mapStyle).toBe('political');
});

test('a scene may force a style; a pick then lasts for that scene only', () => {
  const s = new MapState();
  s.setStylePreference('satellite');
  s.applyScene({ views: ['flat'], mapStyle: 'atlas' });
  expect(s.chosenMapStyle).toBe('atlas');
  s.chooseMapStyle('physical');
  expect(s.chosenMapStyle).toBe('physical');
  expect(s.stylePreference).toBe('satellite');
  s.applyScene({ views: ['flat'] });
  expect(s.chosenMapStyle).toBe('satellite');
});

test('a class quiz run style beats the preference, and picks during the run change only the run', () => {
  const s = new MapState();
  s.setStylePreference('physical');
  s.runStyle = 'political';
  s.applyScene({ views: ['flat'] });
  expect(s.chosenMapStyle).toBe('political');
  s.chooseMapStyle('satellite');
  expect([s.runStyle, s.stylePreference]).toEqual(['satellite', 'physical']);
  s.runStyle = null;
  expect(s.chosenMapStyle).toBe('physical');
  s.chooseMapStyle('atlas');
  expect(s.stylePreference).toBe('atlas');
});

test('the drawn style waits for decoded images and falls back to Atlas when the device fails', () => {
  const s = new MapState();
  s.chooseMapStyle('satellite');
  expect([s.mapStyle, s.drawnMapStyle]).toEqual(['satellite', 'atlas']);
  markReady('satellite');
  expect(s.drawnMapStyle).toBe('satellite');
  reportHealth({ type: 'fail', reason: 'decode' });
  expect([s.chosenMapStyle, s.mapStyle, s.drawnMapStyle]).toEqual(['satellite', 'atlas', 'atlas']);
});

test('the preference is saved; a new MapState starts with it; scene and run picks are never saved', () => {
  const store = new Map<string, string>();
  globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as unknown as Storage;
  const a = new MapState();
  a.chooseMapStyle('physical');
  expect(store.get('geo-coords:map-style')).toBe('physical');
  expect(new MapState().stylePreference).toBe('physical');
  a.applyScene({ views: ['flat'], mapStyle: 'atlas' });
  a.chooseMapStyle('satellite');
  a.applyScene({ views: ['flat'] });
  a.runStyle = 'political';
  a.chooseMapStyle('satellite');
  expect(store.get('geo-coords:map-style')).toBe('physical');
});
