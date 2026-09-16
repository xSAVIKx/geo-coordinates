import { geoArea, geoContains } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { WORLD_BOUNDS } from '../../src/map/geometry';
import { PHYSICAL_NAMES, physicalWaterFor, riverRankFor } from '../../src/map/physical';
import { land } from '../../src/map/world';

describe('physical names', () => {
  test('25 names, each translated, seas on water and the rest on land', () => {
    expect(PHYSICAL_NAMES).toHaveLength(25);
    for (const n of PHYSICAL_NAMES) {
      for (const f of [en, pl, uk] as Record<string, string>[]) expect(f, n.id).toHaveProperty(`physical.${n.id}`);
      const onLand = geoContains(land, [n.lon, n.lat]);
      expect(onLand, n.id).toBe(n.kind !== 'sea');
    }
    expect((pl as Record<string, string>)['physical.tatra']).toBe('Tatry');
  });
});

describe('world rivers and lakes', () => {
  test('fewer, bigger rivers when zoomed out', () => {
    expect(riverRankFor(1)).toBeLessThan(riverRankFor(5));
    const lines = (z: number) => physicalWaterFor(z, WORLD_BOUNDS).rivers.coordinates.length;
    expect(lines(1)).toBeLessThan(lines(5));
    expect(physicalWaterFor(1, WORLD_BOUNDS).lakes.coordinates.length).toBeGreaterThan(20);
  });
  test('from zoom 6 inside Central Europe the detailed regional rivers take over', () => {
    const view = { west: 17, south: 50, east: 22, north: 54 };
    const inside = (c: GeoJSON.Position[]) => c.every(([x, y]) => x! >= 8 && x! <= 32 && y! >= 44 && y! <= 58);
    expect(physicalWaterFor(5, view).rivers.coordinates.some(inside)).toBe(true);
    expect(physicalWaterFor(6, view).rivers.coordinates.some(inside)).toBe(false);
  });

  // The regional lakes (Land.svelte draws them from zoom 4, PhysicalWater.svelte too) replace these there, so the
  // Masurian lakes are never painted twice with their 50m and 10m outlines a hair apart.
  test('from zoom 4 inside Central Europe the detailed regional lakes take over', () => {
    const view = { west: 17, south: 50, east: 22, north: 54 };
    const inside = (rings: GeoJSON.Position[][]) => rings.every((r) => r.every(([x, y]) => x! >= 8 && x! <= 32 && y! >= 44 && y! <= 58));
    expect(physicalWaterFor(3, view).lakes.coordinates.some(inside)).toBe(true);
    expect(physicalWaterFor(4, view).lakes.coordinates.some(inside)).toBe(false);
  });

  // Thinning can flatten a small ring onto a line or turn it the other way round, and d3 then reads the ring as
  // the whole sphere (see `polygonParts` in world.ts): a lake must never fill the map.
  test('no lake covers most of the sphere at any detail level', () => {
    for (const zoom of [1, 4, 16, 80]) {
      const lakes = physicalWaterFor(zoom, WORLD_BOUNDS).lakes;
      for (const rings of lakes.coordinates) expect(geoArea({ type: 'Polygon', coordinates: rings }), `at ${zoom}`).toBeLessThan(0.2);
    }
  });
});
