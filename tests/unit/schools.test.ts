import { geoDistance } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import data from '../../src/map/data/maple-bear-schools.json';
import { retrieved, schools as slim } from 'virtual:maple-bear-schools';
import { schoolsModuleCode, slimSchools } from '../../scripts/schools-plugin.ts';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { gridCluster } from '../../src/map/gridCluster';
import { FLAT_MAX_ZOOM, GLOBE_MAX_ZOOM } from '../../src/map/mapState.svelte';
import { clusterSchools, clusterTargetByKey, clusterZoomTarget, isolatingFlatZoom, isolatingGlobeZoom, SCHOOL_CELL, SCHOOLS } from '../../src/map/schools';

const katowice = () => SCHOOLS.find((s) => s.id === 'pl-katowice')!;
const total = (clusters: { members: unknown[] }[]) => clusters.reduce((n, c) => n + c.members.length, 0);

describe('slim schools module', () => {
  test('bundles only id, name, country and position, for every school', () => {
    expect(retrieved).toBe(data.retrieved);
    expect(slim).toHaveLength(data.schools.length);
    expect(slim).toEqual(slimSchools(data).schools);
    expect(slim[0]).toHaveLength(5);
    const code = schoolsModuleCode(data);
    expect(code).not.toContain('https://');
    expect(code.length).toBeLessThan(JSON.stringify(data).length * 0.45);
    expect(SCHOOLS.find((s) => s.id === 'pl-katowice')).toEqual({ id: 'pl-katowice', name: 'Maple Bear Katowice', country: 'PL', lat: 50.2604, lon: 19.0185 });
  });
});

describe('gridCluster', () => {
  test('groups points in a cell and merges close neighbours across a cell edge', () => {
    const pts: [number, number][] = [[1, 1], [2, 2], [9.5, 1], [10.5, 1], [35, 35]];
    const clusters = gridCluster(pts, (p) => p, 10, 10);
    expect(clusters.map((c) => c.members.length).sort()).toEqual([1, 4]);
    const big = clusters.find((c) => c.members.length === 4)!;
    expect(big.x).toBeCloseTo((1 + 2 + 9.5 + 10.5) / 4);
  });

  test('skips points without a position and keeps far points apart', () => {
    const pts: ([number, number] | null)[] = [[0, 0], null, [100, 100]];
    const clusters = gridCluster(pts, (p) => p, 10);
    expect(clusters).toHaveLength(2);
  });
});

describe('school clusters', () => {
  test('world zoom: every school counted, grouped into count badges', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1.2, 'grid');
    const clusters = clusterSchools(ctx);
    expect(total(clusters)).toBe(SCHOOLS.length);
    expect(clusters.length).toBeLessThan(80);
    expect(clusters.length).toBeGreaterThan(10);
    // Brazil's schools make up the biggest badges.
    const biggest = [...clusters].sort((a, b) => b.members.length - a.members.length)[0]!;
    expect(biggest.members.length).toBeGreaterThan(40);
    expect(biggest.members.filter((s) => s.country === 'BR').length / biggest.members.length).toBeGreaterThan(0.95);
    // After merging, no two badges are drawn on top of each other.
    for (const a of clusters) for (const b of clusters) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y) / 1.2, `${a.key} ${b.key}`).toBeGreaterThanOrEqual(0.8 * SCHOOL_CELL - 1e-9);
  });

  test('high zoom over Katowice: the school stands alone', () => {
    const ctx = makeFlatCtx(960, 480, katowice(), 60, 1.2, 'grid');
    const clusters = clusterSchools(ctx);
    const own = clusters.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!;
    expect(own.members).toHaveLength(1);
    const xy = ctx.project(katowice())!;
    expect(own.x).toBeCloseTo(xy[0], 6);
    expect(own.y).toBeCloseTo(xy[1], 6);
  });

  test('a pan never regroups the flat map (only shifts the groups)', () => {
    for (const projection of ['grid', 'equal-earth', 'mercator'] as const) {
      const a = makeFlatCtx(960, 480, { lat: 50, lon: 15 }, 6, 1.1, projection);
      const b = makeFlatCtx(960, 480, { lat: 47.3, lon: 21.7 }, 6, 1.1, projection);
      const ka = clusterSchools(a, SCHOOLS, Infinity), kb = clusterSchools(b, SCHOOLS, Infinity);
      const groups = (cs: typeof ka) => cs.map((c) => c.members.map((s) => s.id).join(',')).sort();
      expect(groups(kb)).toEqual(groups(ka));
      const shift = [a.project(katowice())!, b.project(katowice())!];
      const ca = ka.find((c) => c.key === 'pl-katowice' || c.members.some((s) => s.id === 'pl-katowice'))!;
      const cb = kb.find((c) => c.key === ca.key)!;
      expect(cb.x - ca.x).toBeCloseTo(shift[1]![0] - shift[0]![0], 6);
      expect(cb.y - ca.y).toBeCloseTo(shift[1]![1] - shift[0]![1], 6);
    }
  });

  test('the globe groups only the front side', () => {
    const ctx = makeGlobeCtx(500, [-19, -50], 1, 1);
    const clusters = clusterSchools(ctx);
    const ids = new Set(clusters.flatMap((c) => c.members.map((s) => s.id)));
    expect(ids.has('pl-katowice')).toBe(true);
    // Every school on the far side (more than 90° from the middle of the disc) is left out.
    const far = SCHOOLS.filter((s) => geoDistance([s.lon, s.lat], [19, 50]) > Math.PI / 2);
    expect(far.length).toBeGreaterThan(50);
    expect(far.some((s) => ids.has(s.id))).toBe(false);
    expect(total(clusters)).toBe(SCHOOLS.length - far.length);
    // Zoomed in on the globe, Katowice stands alone too.
    const near = clusterSchools(makeGlobeCtx(500, [-19.02, -50.26], 0.6, 40));
    expect(near.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!.members).toHaveLength(1);
  });

  test('a click on a badge zooms in on its group', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1.2, 'grid');
    const biggest = [...clusterSchools(ctx)].sort((a, b) => b.members.length - a.members.length)[0]!;
    const target = clusterTargetByKey(ctx, biggest.key, FLAT_MAX_ZOOM)!;
    expect(target.zoom).toBeGreaterThanOrEqual(2);
    expect(target.zoom).toBeLessThanOrEqual(8);
    expect(target.center.lat).toBeLessThan(0); // Brazil
    expect(clusterTargetByKey(ctx, 'no-such-school', FLAT_MAX_ZOOM)).toBeNull();
    // Schools at one spot: the zoom still grows (up to the limit).
    const same = SCHOOLS.filter((s) => s.id.startsWith('in-') && s.id.endsWith('-bengaluru'));
    expect(clusterZoomTarget(same, makeFlatCtx(960, 480, same[0]!, 70, 1, 'grid'), FLAT_MAX_ZOOM).zoom).toBe(FLAT_MAX_ZOOM);
    const globe = makeGlobeCtx(500, [50, 15], 1, 1);
    const gBiggest = [...clusterSchools(globe)].sort((a, b) => b.members.length - a.members.length)[0]!;
    const g = clusterZoomTarget(gBiggest.members, globe, GLOBE_MAX_ZOOM);
    expect(g.zoom).toBeGreaterThanOrEqual(2);
  });

  test('choosing a school zooms far enough for it to stand alone', () => {
    for (const px of [1, 2.8]) {
      const zoom = isolatingFlatZoom(katowice(), 'grid', px, FLAT_MAX_ZOOM);
      expect(zoom).toBeGreaterThanOrEqual(6);
      expect(zoom).toBeLessThanOrEqual(FLAT_MAX_ZOOM);
      const clusters = clusterSchools(makeFlatCtx(960, 480, katowice(), zoom, px, 'grid'));
      expect(clusters.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!.members).toHaveLength(1);
    }
    const gz = isolatingGlobeZoom(katowice(), 1, GLOBE_MAX_ZOOM);
    const k = katowice();
    const g = clusterSchools(makeGlobeCtx(500, [-k.lon, -k.lat], 1, gz));
    expect(g.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!.members).toHaveLength(1);
    expect(SCHOOL_CELL).toBeGreaterThanOrEqual(40);
  });
});
