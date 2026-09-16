import { geoArea, geoContains } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, test } from 'vitest';
import politicalJson from '../../src/map/data/political-pol.json';

interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }
const topo = politicalJson as unknown as Topology<{ countries: GeometryCollection<CountryProps> }> & { source: string };
// @types/topojson-specification's GeometryObject<P> union includes NullObject, which is not parameterized over P
// (its properties stay {}); every country here is an actual Polygon/MultiPolygon, so narrow the element type back
// to what it really is instead of widening every properties access to `CountryProps | {}`.
const geoms = topo.objects.countries.geometries as unknown as ReadonlyArray<{ id: string; properties: CountryProps }>;
const fc = feature(topo, topo.objects.countries);
const at = (lon: number, lat: number) => fc.features.filter((f) => geoContains(f, [lon, lat])).map((f) => f.id);

describe('political shapes: Natural Earth, Poland point of view', () => {
  test('stays small and names its source', () => {
    expect(JSON.stringify(politicalJson).length).toBeLessThan(300 * 1024);
    expect(topo.source).toMatch(/Natural Earth 5\.1\.1.*Poland point of view/);
  });

  test('ids are unique Poland point-of-view codes; Western Sahara is not a separate country', () => {
    const ids = geoms.map((g) => g.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['POL', 'UKR', 'RUS', 'KOS', 'MAR', 'DEU', 'LUX']) expect(ids, id).toContain(id);
    expect(ids).not.toContain('SAH');
    expect(geoms.length).toBeGreaterThan(180);
  });

  // Regression: MIN_WEIGHT tuned up for the size budget once simplified a small country's only ring down near
  // RING_MIN_AREA, so the ring-area filter deleted the whole country instead of only an islet (see build-political.ts).
  // These are small but real, internationally recognised UN member states — none is a dependency or uninhabited islet.
  test('small sovereign countries survive simplification, not just large ones', () => {
    const ids = geoms.map((g) => g.id as string);
    for (const id of ['MLT', 'SGP', 'BHR', 'AND', 'SYC', 'KIR', 'GRD', 'VCT', 'ATG', 'FSM']) expect(ids, id).toContain(id);
  });

  test('Crimea, Sevastopol and Donbas are in Ukraine; Kosovo, Western Sahara, Moscow and Warsaw where Poland sees them', () => {
    for (const [name, lon, lat] of [['Simferopol', 34.10, 44.95], ['Sevastopol', 33.60, 44.56], ['Donetsk', 37.80, 48.00], ['Luhansk', 39.31, 48.57], ['Kyiv', 30.52, 50.45]] as const) {
      expect(at(lon, lat), name).toEqual(['UKR']);
    }
    expect(at(21.17, 42.66)).toEqual(['KOS']); // Pristina
    expect(at(-13.20, 27.15)).toEqual(['MAR']); // Laayoune
    expect(at(37.62, 55.75)).toEqual(['RUS']);
    expect(at(21.01, 52.23)).toEqual(['POL']);
  });

  test('polygons are wound the way d3 expects (no country covers most of the sphere)', () => {
    for (const f of fc.features) expect(geoArea(f), String(f.id)).toBeLessThan(2 * Math.PI);
  });

  test('neighbours never share a colour, at most 6 colours; all of Poland\'s land neighbours are there', () => {
    const ns = neighbors(topo.objects.countries.geometries);
    geoms.forEach((g, i) => { for (const j of ns[i]!) expect(geoms[j]!.properties!.c, `${g.id}–${geoms[j]!.id}`).not.toBe(g.properties!.c); });
    expect(Math.max(...geoms.map((g) => g.properties!.c))).toBeLessThan(6);
    const pol = geoms.findIndex((g) => g.id === 'POL');
    expect(ns[pol]!.map((j) => geoms[j]!.id).sort()).toEqual(['BLR', 'CZE', 'DEU', 'LTU', 'RUS', 'SVK', 'UKR']);
  });

  test('label data: a point in range, a label zoom and a region code Intl knows in every language (or none)', () => {
    for (const g of geoms) {
      const p = g.properties!;
      expect(Math.abs(p.lx), String(g.id)).toBeLessThanOrEqual(180);
      expect(Math.abs(p.ly), String(g.id)).toBeLessThanOrEqual(90);
      expect(p.ml, String(g.id)).toBeGreaterThan(0);
      if (p.a2 === '') continue;
      expect(p.a2).toMatch(/^[A-Z]{2}$/);
      for (const lang of ['en', 'pl', 'uk']) expect(new Intl.DisplayNames([lang], { type: 'region' }).of(p.a2), `${lang} ${p.a2}`).not.toBe(p.a2);
    }
    const pol = geoms.find((g) => g.id === 'POL')!.properties!;
    expect(new Intl.DisplayNames(['uk'], { type: 'region' }).of(pol.a2)).toBe('Польща');
    expect(geoms.find((g) => g.id === 'KOS')!.properties!.a2).toBe('XK');
  });
});
