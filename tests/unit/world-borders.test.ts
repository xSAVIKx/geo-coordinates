import { geoArea, geoContains } from 'd3-geo';
import { clipPolyline } from 'lineclip';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, test } from 'vitest';
import worldAtlas from 'world-atlas/countries-110m.json';
import bordersJson from '../../src/map/data/world-borders-pol.json';
import { borders } from '../../src/map/world';

type Countries = Topology<{ countries: GeometryCollection }>;
const topo = bordersJson as unknown as Countries;
const countries = feature(topo, topo.objects.countries);
const country = (id: string) => countries.features.find((f) => f.id === id)!;
const countryAt = (lon: number, lat: number) => countries.features.filter((f) => geoContains(f, [lon, lat])).map((f) => f.id);

/** The Crimean peninsula with the Perekop and Chonhar isthmuses and the Arabat Spit (lon/lat box). */
const CRIMEA: [number, number, number, number] = [32.3, 44.3, 36.8, 46.35];
/** Border segments that run through `box` (a segment can cross it with both ends outside). */
function segmentsIn(lines: GeoJSON.Position[][], box: [number, number, number, number]): GeoJSON.Position[][] {
  return lines.flatMap((l) => clipPolyline(l as [number, number][], box));
}

describe('world borders: Natural Earth, Poland point of view', () => {
  test('stays small', () => {
    expect(JSON.stringify(bordersJson).length).toBeLessThan(60 * 1024);
  });

  test('the map draws these borders', () => {
    expect(borders).toEqual(mesh(topo, topo.objects.countries, (a, b) => a !== b));
  });

  test('Crimea, Sevastopol and Donbas are in Ukraine', () => {
    const cities: Record<string, [number, number]> = {
      Simferopol: [34.10, 44.95], Sevastopol: [33.60, 44.56], Donetsk: [37.80, 48.00], Luhansk: [39.31, 48.57], Mariupol: [37.55, 47.10],
    };
    for (const [name, [lon, lat]] of Object.entries(cities)) {
      expect(geoContains(country('UKR'), [lon, lat]), name).toBe(true);
      expect(countryAt(lon, lat), name).toEqual(['UKR']);
    }
    expect(countryAt(30.52, 50.45)).toEqual(['UKR']); // Kyiv
    expect(countryAt(37.62, 55.75)).toEqual(['RUS']); // Moscow
  });

  test('no border crosses the Crimean isthmus or runs inside the peninsula', () => {
    expect(segmentsIn(borders.coordinates, CRIMEA)).toEqual([]);
    // Perekop: a line across the isthmus at 46.1°N meets no border.
    expect(segmentsIn(borders.coordinates, [33.3, 46.0, 34.1, 46.2])).toEqual([]);
    // The check can fail: world-atlas ("de facto") draws a border there.
    const atlas = worldAtlas as unknown as Countries;
    expect(segmentsIn(mesh(atlas, atlas.objects.countries, (a, b) => a !== b).coordinates, CRIMEA).length).toBeGreaterThan(0);
  });

  test('the Russia–Ukraine border reaches the Sea of Azov east of Mariupol', () => {
    const shared = mesh(topo, topo.objects.countries, (a, b) => (a.id === 'UKR' && b.id === 'RUS') || (a.id === 'RUS' && b.id === 'UKR'));
    const points = shared.coordinates.flat();
    expect(points.length).toBeGreaterThan(10);
    const south = points.reduce((s, p) => (p[1]! < s[1]! ? p : s));
    expect(south[0]).toBeGreaterThan(37.8);
    expect(south[1]).toBeGreaterThan(46.8);
  });

  test('Kosovo is a country and Western Sahara is part of Morocco', () => {
    expect(countryAt(21.17, 42.67)).toEqual(['KOS']); // Pristina
    expect(countryAt(-13.2, 27.15)).toEqual(['MAR']); // Laayoune
  });

  test('every country ring is wound for d3 (a country, not the rest of the sphere)', () => {
    for (const f of countries.features) expect(geoArea(f), String(f.id)).toBeLessThan(1);
  });
});
