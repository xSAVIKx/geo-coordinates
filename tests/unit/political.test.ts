import { geoArea, geoContains } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import { PALETTE_SIZE } from '../../scripts/political-colours';
import { PLACES } from '../../src/map/places';
import { CAPITALS, countryLabels, countryName, labelMinZoom, politicalFor, POLITICAL_COLOURS } from '../../src/map/political';
import { WORLD_BOUNDS } from '../../src/map/geometry';

describe('political map data at runtime', () => {
  test('the whole world has a fill per country, coloured apart, with borders and coast', () => {
    const w = politicalFor(1, WORLD_BOUNDS);
    expect(w.fills.length).toBeGreaterThan(180);
    expect(new Set(w.fills.map((f) => f.colour)).size).toBeLessThanOrEqual(6);
    expect(w.borders.coordinates.length).toBeGreaterThan(100);
    expect(w.coast.coordinates.length).toBeGreaterThan(100);
    const ukr = w.fills.find((f) => f.id === 'UKR')!;
    expect(geoContains(ukr.geometry, [34.10, 44.95])).toBe(true); // Simferopol
  });

  // The drawn colour classes (.c0 … in Political.svelte, --pol-0 … in tokens.css) must cover every colour the
  // build script may hand out: one constant, not two unrelated sixes that could drift apart.
  test('the drawn colour list is exactly the palette the countries were coloured with', () => {
    expect(POLITICAL_COLOURS).toBe(PALETTE_SIZE);
    const colours = politicalFor(1, WORLD_BOUNDS).fills.map((f) => f.colour);
    expect(Math.max(...colours)).toBeLessThan(POLITICAL_COLOURS);
    expect(Math.min(...colours)).toBeGreaterThanOrEqual(0);
  });

  // Thinning can flatten a small island's ring onto a line or turn it the other way round, and d3 then reads the
  // ring as the whole sphere: at the coarsest level an islet of Norway and one of Greenland used to paint the
  // entire map their country's colour (see `polygonParts` in world.ts).
  test('no country covers most of the sphere at any detail level', () => {
    for (const zoom of [1, 3, 8, 24, 80]) {
      for (const f of politicalFor(zoom, WORLD_BOUNDS).fills) expect(geoArea(f.geometry), `${f.id} at ${zoom}`).toBeLessThan(2 * Math.PI);
    }
  });

  test('a zoomed-in view keeps only nearby countries, with more detail', () => {
    const view = { west: 14, south: 49, east: 24, north: 55 };
    const near = politicalFor(9, view);
    expect(near.fills.map((f) => f.id)).toContain('POL');
    expect(near.fills.map((f) => f.id)).not.toContain('AUS');
    const points = (z: number) => politicalFor(z, view).fills.find((f) => f.id === 'POL')!.geometry.coordinates.flat(2).length;
    expect(points(9)).toBeGreaterThan(points(1));
  });

  test('labels: Natural Earth label zooms on the flat map; names from Intl in every language', () => {
    expect(labelMinZoom(2)).toBe(1);
    expect(labelMinZoom(5)).toBe(8);
    const pol = countryLabels().find((l) => l.id === 'POL')!;
    expect(pol.a2).toBe('PL');
    expect([countryName('PL', 'en'), countryName('PL', 'pl'), countryName('PL', 'uk')]).toEqual(['Poland', 'Polska', 'Польща']);
    expect(countryName('UA', 'uk')).toBe('Україна');
    expect(countryLabels().every((l) => l.a2 !== '')).toBe(true);
  });

  test('capitals are places on the map', () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const c of CAPITALS) expect(ids.has(c), c).toBe(true);
    expect(CAPITALS.has('warsaw')).toBe(true);
    expect(CAPITALS.has('krakow')).toBe(false);
  });
});
