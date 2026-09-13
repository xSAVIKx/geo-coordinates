import { geoArea } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { mesh } from 'topojson-client';
import { LABELLED_RIVERS, REGION, REGION_MIN_ZOOM, bordersFor, detailFor, land, landFor, regionActive, riverLabelPoints, thinArc } from '../../src/map/world';
import regionJson from '../../src/map/data/central-europe.json';

const katowice = { lat: 50.26, lon: 19.02 };

describe('regional level of detail', () => {
  test('region box and data', () => {
    expect(REGION).toEqual({ west: 8, south: 44, east: 32, north: 58 });
    expect(JSON.stringify(regionJson).length).toBeLessThan(200 * 1024);
  });
  test('world 110m only below zoom 4 or away from Central Europe', () => {
    const world = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1);
    expect(landFor(world.zoom, world.bounds)).toEqual({ world: land, region: null });
    const europe = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1);
    expect(landFor(europe.zoom, europe.bounds).region).toBeNull();
    const spain = makeFlatCtx(960, 480, { lat: 40, lon: -15 }, 12, 1);
    expect(regionActive(spain.zoom, spain.bounds)).toBe(false);
    expect(bordersFor(spain.zoom, spain.bounds).region).toBeNull();
  });
  test('detail from zoom 4 over the region, on flat maps and the globe', () => {
    const poland = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 9, 1);
    const layers = landFor(poland.zoom, poland.bounds);
    expect(layers.world).toBe(land);
    expect(layers.region!.land.coordinates.length).toBeGreaterThan(0);
    expect(layers.region!.coast.coordinates.length).toBeGreaterThan(0);
    expect(layers.region!.lakes.coordinates.length).toBeGreaterThan(5);
    expect(bordersFor(poland.zoom, poland.bounds).region!.coordinates.length).toBeGreaterThan(5);
    expect(regionActive(REGION_MIN_ZOOM - 0.01, poland.bounds)).toBe(false);
    const globe = makeGlobeCtx(500, [-19, -51], 1, 3);
    expect(regionActive(globe.zoom, globe.bounds)).toBe(true);
    expect(regionActive(makeGlobeCtx(500, [-19, -51], 1, 1).zoom, makeGlobeCtx(500, [-19, -51], 1, 1).bounds)).toBe(false);
  });
  test('rings are wound for d3 (small areas, not the rest of the sphere) at every detail level', () => {
    for (const zoom of [4, 8, 16, 32, 80]) {
      const ctx = makeFlatCtx(960, 480, katowice, zoom, 1);
      const r = landFor(zoom, ctx.bounds).region!;
      expect(geoArea(r.land)).toBeLessThan(0.1);
      expect(geoArea(r.lakes)).toBeLessThan(0.01);
      expect(geoArea(r.mask)).toBeLessThan(0.2);
    }
  });
  test('zoom 80 only processes what is near the view, and draws it', () => {
    const wide = makeFlatCtx(960, 480, katowice, 8, 1);
    const deep = makeFlatCtx(960, 480, katowice, 80, 1);
    const count = (g: { coordinates: unknown[] }) => JSON.stringify(g.coordinates).length;
    const b8 = bordersFor(8, wide.bounds).region!, b80 = bordersFor(80, deep.bounds).region!;
    expect(count(b80)).toBeLessThan(count(b8) / 2);
    expect(deep.path(landFor(80, deep.bounds).region!.land)!.length).toBeGreaterThan(10);
  });
  test('thinArc keeps both ends and drops only near vertices', () => {
    const arc: [number, number][] = [[0, 50], [0.001, 50], [0.002, 50], [0.1, 50], [0.1005, 50], [0.2, 50]];
    expect(thinArc(arc, 0.01)).toEqual([[0, 50], [0.1, 50], [0.2, 50]]);
    expect(thinArc([[0, 0], [1, 1]], 5)).toEqual([[0, 0], [1, 1]]);
  });
});

describe('voivodeships and rivers', () => {
  test('appear from zoom 6 over the region only', () => {
    const z5 = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 5.9, 1);
    expect(detailFor(z5.zoom, z5.bounds)).toBeNull();
    const far = makeFlatCtx(960, 480, { lat: 40, lon: -15 }, 12, 1);
    expect(detailFor(far.zoom, far.bounds)).toBeNull();
    const z6 = makeFlatCtx(960, 480, { lat: 50, lon: 20 }, 6, 1);
    const detail = detailFor(z6.zoom, z6.bounds)!;
    expect(detail.rivers.map((r) => r.id).sort()).toEqual(['bug', 'danube', 'dnieper', 'oder', 'vistula', 'warta']);
    expect(detail.voivodeships.coordinates.length).toBeGreaterThan(10);
  });
  test('voivodeship lines are the borders between voivodeships, inside Poland', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 6, 1);
    const pts = detailFor(ctx.zoom, ctx.bounds)!.voivodeships.coordinates.flat();
    for (const [lon, lat] of pts) {
      expect(lon).toBeGreaterThan(14); expect(lon).toBeLessThan(24.2);
      expect(lat).toBeGreaterThan(49); expect(lat).toBeLessThan(54.9);
    }
    // Interior only: far fewer vertices than every voivodeship outline (which would include Poland's border and coast).
    const outline = mesh(regionJson as never, (regionJson as unknown as { objects: { voivodeships: never } }).objects.voivodeships);
    expect(pts.length).toBeLessThan(outline.coordinates.flat().length * 0.7);
  });
  test('labelled rivers have label spots along them', () => {
    expect(LABELLED_RIVERS).toEqual(['vistula', 'oder']);
    const vistula = riverLabelPoints('vistula');
    expect(vistula.length).toBeGreaterThan(10);
    for (const p of vistula) { expect(p.lat).toBeGreaterThan(49.5); expect(p.lat).toBeLessThan(54.5); }
    expect(riverLabelPoints('oder').length).toBeGreaterThan(8);
  });
});
