import { beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_LAYERS, GLOBE_MAX_ZOOM, GLOBE_MIN_ZOOM, MapState } from '../../src/map/mapState.svelte';
import type { Overlay } from '../../src/map/types';

function makeLocalStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
  } as Storage;
}

describe('MapState', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
  });

  test('flatProjection defaults to grid', () => {
    const s = new MapState();
    expect(s.projectionPreference).toBe('grid');
    expect(s.flatProjection).toBe('grid');
  });

  test('setProjectionPreference updates preference, persists it, and getter reflects it', () => {
    const s = new MapState();
    s.setProjectionPreference('equal-earth');
    expect(s.projectionPreference).toBe('equal-earth');
    expect(s.flatProjection).toBe('equal-earth');
    expect(globalThis.localStorage.getItem('geo-coords:projection')).toBe('equal-earth');
  });

  test('a new MapState initialises its preference from storage', () => {
    globalThis.localStorage.setItem('geo-coords:projection', 'equal-earth');
    const s = new MapState();
    expect(s.projectionPreference).toBe('equal-earth');
    expect(s.flatProjection).toBe('equal-earth');
  });

  test('the preference survives applyScene when the scene does not force a projection', () => {
    const s = new MapState();
    s.setProjectionPreference('equal-earth');
    s.applyScene({ views: ['flat'] });
    expect(s.projectionOverride).toBeNull();
    expect(s.projectionPreference).toBe('equal-earth');
    expect(s.flatProjection).toBe('equal-earth');
  });

  test('a scene with flatProjection overrides, and the next scene without it restores the preference', () => {
    const s = new MapState();
    expect(s.projectionPreference).toBe('grid');
    s.applyScene({ views: ['flat'], flatProjection: 'equal-earth' });
    expect(s.projectionOverride).toBe('equal-earth');
    expect(s.flatProjection).toBe('equal-earth');
    s.applyScene({ views: ['flat'] });
    expect(s.projectionOverride).toBeNull();
    expect(s.flatProjection).toBe('grid');
  });

  test('applyScene fills defaults', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], layers: { tropics: true }, point: { lat: 10, lon: 20 } });
    expect(s.views).toEqual(['flat']);
    expect(s.layers).toEqual({ ...DEFAULT_LAYERS, tropics: true });
    expect(s.point).toEqual({ lat: 10, lon: 20 });
    expect(s.pointEditable).toBe(false);
    expect(s.precision).toBe('degree');
    expect(s.showReadout).toBe(true);
    expect(s.overlays).toEqual([]);
    expect(s.phoneView).toBe('flat');
    expect(s.rotate).toEqual([-20, -10]);
  });
  test('flatView overrides preset and is clamped', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], flatPreset: 'europe', flatView: { center: { lat: 89, lon: 21 }, zoom: 6 } });
    expect(s.flat.zoom).toBe(6);
    expect(s.flat.center).toEqual({ lat: 75, lon: 21 });
  });
  test('scene without point hides it; globe first becomes phone view', () => {
    const s = new MapState();
    s.applyScene({ views: ['globe', 'cross-section'] });
    expect(s.point).toBeNull();
    expect(s.phoneView).toBe('globe');
  });
  test('setPoint snaps, clamps and normalizes', () => {
    const s = new MapState();
    s.setPoint({ lat: 95.4, lon: 190.6 });
    expect(s.point).toEqual({ lat: 90, lon: -169 });
    s.precision = 'minute';
    s.setPoint({ lat: 52.2334, lon: 21.0 });
    expect(s.point!.lat).toBeCloseTo(52 + 14 / 60, 9);
  });
  test('userSetPoint respects editability and records source', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], point: { lat: 0, lon: 0 }, pointEditable: false });
    expect(s.userSetPoint({ lat: 5, lon: 5 }, 'map')).toBe(false);
    expect(s.point).toEqual({ lat: 0, lon: 0 });
    s.pointEditable = true;
    expect(s.userSetPoint({ lat: 5, lon: 5 }, 'map')).toBe(true);
    expect(s.lastChange).toBe('map');
  });
  test('nudge and step sizes', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], point: { lat: 89, lon: 179 }, pointEditable: true });
    expect(s.stepSize(false)).toBe(1); expect(s.stepSize(true)).toBe(10);
    s.nudge(s.stepSize(true), s.stepSize(false), 'slider');
    expect(s.point).toEqual({ lat: 90, lon: 180 });
    s.nudge(0, 1, 'slider');
    expect(s.point).toEqual({ lat: 90, lon: -179 });
    s.precision = 'minute';
    expect(s.stepSize(false)).toBeCloseTo(1 / 60, 12); expect(s.stepSize(true)).toBe(1);
  });
  test('flat zoom clamps and pan keeps the view inside the world', () => {
    const s = new MapState();
    s.zoomFlat(100);
    expect(s.flat.zoom).toBe(12);
    s.zoomFlat(0.001);
    expect(s.flat.zoom).toBe(1);
    expect(s.flat.center).toEqual({ lat: 0, lon: 0 });
    s.zoomFlat(2);
    s.panFlat(80, 0);
    expect(s.flat.center.lat).toBe(45); // half-height at zoom 2 is 45°
  });
  test('setFlatPreset applies the preset through the same clamp path as zoom/pan', () => {
    const s = new MapState();
    s.setFlatPreset('poland');
    expect(s.flat).toEqual({ center: { lat: 52, lon: 19 }, zoom: 9 });
    s.zoomFlat(2);
    s.panFlat(80, 0);
    s.setFlatPreset('world');
    expect(s.flat).toEqual({ center: { lat: 0, lon: 0 }, zoom: 1 });
  });
  test('centerGlobeOn clamps latitude to +/-60', () => {
    const s = new MapState();
    s.centerGlobeOn({ lat: 85, lon: 30 });
    expect(s.rotate).toEqual([-30, -60]);
    s.centerGlobeOn({ lat: -85, lon: -40 });
    expect(s.rotate).toEqual([40, 60]);
  });
  test('zoomGlobe clamps to [1, 8]', () => {
    const s = new MapState();
    expect(s.globeZoom).toBe(1);
    s.zoomGlobe(100);
    expect(s.globeZoom).toBe(GLOBE_MAX_ZOOM);
    s.zoomGlobe(0.001);
    expect(s.globeZoom).toBe(GLOBE_MIN_ZOOM);
    s.globeZoom = 2;
    s.zoomGlobe(1.5);
    expect(s.globeZoom).toBeCloseTo(3, 9);
  });
  test('applyScene resets globeZoom to 1 and honours scene.globeZoom', () => {
    const s = new MapState();
    s.globeZoom = 5;
    s.applyScene({ views: ['globe'] });
    expect(s.globeZoom).toBe(1);
    s.applyScene({ views: ['globe'], globeZoom: 4 });
    expect(s.globeZoom).toBe(4);
  });
  test('addOverlays appends to existing overlays', () => {
    const s = new MapState();
    const a: Overlay[] = [{ kind: 'noon-meridian' }];
    const b: Overlay[] = [{ kind: 'marker', p: { lat: 1, lon: 2 }, tone: 'a' }];
    s.addOverlays(a);
    s.addOverlays(b);
    expect(s.overlays).toEqual([...a, ...b]);
  });
  test('setSunNow and sunDate', () => {
    const s = new MapState();
    s.layers.daylight = true;
    s.setSunNow(new Date('2026-09-23T10:30:00Z'));
    expect(s.sun).toEqual({ utcMinutes: 630, dayOfYear: 266, year: 2026 });
    expect(s.sunDate()!.toISOString()).toBe('2026-09-23T10:30:00.000Z');
  });
  test('sunDate is null without a sun', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'] });
    expect(s.sunDate()).toBeNull();
  });
  test('applyScene honours phoneView when that view is shown, else flat first', () => {
    const s = new MapState();
    s.applyScene({ views: ['globe', 'flat'], phoneView: 'globe' });
    expect(s.phoneView).toBe('globe');
    s.applyScene({ views: ['globe', 'flat'] });
    expect(s.phoneView).toBe('flat');
    s.applyScene({ views: ['flat'], phoneView: 'globe' });
    expect(s.phoneView).toBe('flat');
    s.applyScene({ views: ['globe', 'cross-section'] });
    expect(s.phoneView).toBe('globe');
  });
  test('setSunNow keeps 31 December of a leap year', () => {
    const s = new MapState();
    s.setSunNow(new Date('2028-12-31T08:00:00Z'));
    expect(s.sun).toEqual({ utcMinutes: 480, dayOfYear: 366, year: 2028 });
  });
});
