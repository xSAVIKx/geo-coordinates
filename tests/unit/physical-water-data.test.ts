import { geoArea, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { expect, test } from 'vitest';
import waterJson from '../../src/map/data/physical-water.json';

const topo = waterJson as unknown as Topology<{ rivers: GeometryCollection<{ r: number }>; lakes: GeometryCollection<{ r: number }> }> & { source: string };
// @types/topojson-specification's GeometryObject<P> union includes NullObject, which is not parameterized over P
// (its properties stay {}); every geometry here is an actual Line/MultiLine/Polygon/MultiPolygon, so narrow the
// element type back to what it really is instead of widening every properties access to `{ r: number } | {}`.
const properties = (geoms: readonly { properties?: unknown }[]) => geoms as unknown as ReadonlyArray<{ properties: { r: number } }>;
const rivers = feature(topo, topo.objects.rivers);
const lakes = feature(topo, topo.objects.lakes);
const RAD = Math.PI / 180;
const nearRiver = (lon: number, lat: number, deg: number) => rivers.features.some((f) => {
  const g = f.geometry;
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  return lines.some((l) => l.some(([x, y]) => geoDistance([x!, y!], [lon, lat]) < deg * RAD));
});

test('stays small, names its source, keeps a scale rank per feature', () => {
  expect(JSON.stringify(waterJson).length).toBeLessThan(260 * 1024);
  expect(topo.source).toMatch(/Natural Earth.*50m rivers.*lakes/);
  for (const g of properties([...topo.objects.rivers.geometries, ...topo.objects.lakes.geometries])) expect(Number.isInteger(g.properties.r)).toBe(true);
  expect(topo.objects.rivers.geometries.length).toBeGreaterThan(300);
});

test('real rivers and lakes are where they should be', () => {
  expect(nearRiver(31.23, 30.05, 0.5)).toBe(true);   // the Nile at Cairo
  expect(nearRiver(-60.0, -3.1, 0.6)).toBe(true);    // the Amazon near Manaus
  expect(nearRiver(19.0, 52.4, 0.6)).toBe(true);     // the Vistula
  expect(lakes.features.some((f) => geoContains(f, [33.0, -1.0]))).toBe(true);   // Lake Victoria
  expect(lakes.features.some((f) => geoContains(f, [-87.0, 44.0]))).toBe(true);  // Lake Michigan
});

test('lake polygons are wound the way d3 expects', () => {
  for (const f of lakes.features) expect(geoArea(f)).toBeLessThan(0.1);
});
