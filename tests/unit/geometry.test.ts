import { describe, expect, test } from 'vitest';
import { boundsIntersect, hemisphere, makeFlatCtx, makeGlobeCtx, meridianLine, parallelLine } from '../../src/map/geometry';

describe('flat ctx', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1);
  test('projects corners and centre', () => {
    expect(ctx.project({ lat: 0, lon: 0 })).toEqual([480, 240]);
    const [x, y] = ctx.project({ lat: 90, lon: -180 })!;
    expect(x).toBeCloseTo(0, 6); expect(y).toBeCloseTo(0, 6);
  });
  test('invert round-trips and rejects outside', () => {
    const ll = ctx.invert([720, 120])!;
    expect(ll.lon).toBeCloseTo(90, 6); expect(ll.lat).toBeCloseTo(45, 6);
    expect(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1).invert([-50, 10])).toBeNull();
  });
  test('zoom centres the view', () => {
    const z = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 9, 1);
    const [x, y] = z.project({ lat: 52, lon: 19 })!;
    expect(x).toBeCloseTo(480, 6); expect(y).toBeCloseTo(240, 6);
  });
});

describe('equal-earth flat ctx', () => {
  test('centre projects to the viewport middle at zoom 1', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth');
    expect(ctx.project({ lat: 0, lon: 0 })).toEqual([480, 240]);
  });
  test('invert round-trips several points', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth');
    for (const p of [{ lat: 60, lon: -150 }, { lat: -40, lon: 170 }, { lat: 0, lon: 0 }, { lat: 20, lon: 45 }]) {
      const xy = ctx.project(p)!;
      const back = ctx.invert(xy)!;
      expect(back.lat).toBeCloseTo(p.lat, 6);
      expect(back.lon).toBeCloseTo(p.lon, 6);
    }
  });
  test('meridians are curved: same longitude projects to different x at different latitudes', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth');
    const [x0] = ctx.project({ lat: 0, lon: 90 })!;
    const [x60] = ctx.project({ lat: 60, lon: 90 })!;
    expect(x0).not.toBeCloseTo(x60, 3);
  });
  test('rejects points outside the viewport bounds', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth');
    expect(ctx.invert([-50, 10])).toBeNull();
  });
  test('isVisible is always true, matching grid', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth');
    expect(ctx.isVisible({ lat: 89, lon: 179 })).toBe(true);
  });
});

describe('grid ctx defaults to grid projection explicitly', () => {
  test('passing "grid" explicitly matches the default', () => {
    const a = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 9, 1);
    const b = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 9, 1, 'grid');
    expect(a.project({ lat: 52, lon: 19 })).toEqual(b.project({ lat: 52, lon: 19 }));
  });
});

describe('globe ctx', () => {
  const ctx = makeGlobeCtx(500, [-21, -52], 1);
  test('front and back visibility', () => {
    expect(ctx.isVisible({ lat: 52, lon: 21 })).toBe(true);
    expect(ctx.isVisible({ lat: -52, lon: -159 })).toBe(false);
    expect(ctx.project({ lat: -52, lon: -159 })).toBeNull();
  });
  test('centre of view projects to the middle', () => {
    const [x, y] = ctx.project({ lat: 52, lon: 21 })!;
    expect(x).toBeCloseTo(250, 6); expect(y).toBeCloseTo(250, 6);
  });
  test('invert outside the disc is null', () => { expect(ctx.invert([2, 2])).toBeNull(); });
});

describe('globe ctx zoom', () => {
  test('centre still projects to the middle at zoom 2', () => {
    const ctx = makeGlobeCtx(500, [-21, -52], 1, 2);
    const [x, y] = ctx.project({ lat: 52, lon: 21 })!;
    expect(x).toBeCloseTo(250, 6); expect(y).toBeCloseTo(250, 6);
  });
  test('a point 30 degrees from centre is twice as far from centre at zoom 2 as at zoom 1', () => {
    const p = { lat: 22, lon: 21 }; // 30° south of the centre (52,21), same meridian
    const ctx1 = makeGlobeCtx(500, [-21, -52], 1, 1);
    const ctx2 = makeGlobeCtx(500, [-21, -52], 1, 2);
    const [x1, y1] = ctx1.project(p)!;
    const [x2, y2] = ctx2.project(p)!;
    const d1 = Math.hypot(x1 - 250, y1 - 250);
    const d2 = Math.hypot(x2 - 250, y2 - 250);
    expect(d2 / d1).toBeCloseTo(2, 6);
  });
  test('invert of a viewBox corner is null at zoom 1 (outside disc) and non-null at zoom 3 (disc covers it)', () => {
    const ctx1 = makeGlobeCtx(500, [-21, -52], 1, 1);
    const ctx3 = makeGlobeCtx(500, [-21, -52], 1, 3);
    expect(ctx1.invert([0, 0])).toBeNull();
    expect(ctx3.invert([0, 0])).not.toBeNull();
  });
  test('invert outside the viewBox is null even when the disc would cover it', () => {
    const ctx3 = makeGlobeCtx(500, [-21, -52], 1, 3);
    expect(ctx3.invert([-5, -5])).toBeNull();
    expect(ctx3.invert([505, 250])).toBeNull();
  });
  test('default zoom of 1 matches passing zoom explicitly', () => {
    const a = makeGlobeCtx(500, [-21, -52], 1);
    const b = makeGlobeCtx(500, [-21, -52], 1, 1);
    expect(a.project({ lat: 52, lon: 21 })).toEqual(b.project({ lat: 52, lon: 21 }));
  });
});

describe('lines', () => {
  test('parallel is dense and closed around the globe', () => {
    const l = parallelLine(50, 2);
    expect(l.coordinates[0]).toEqual([-180, 50]);
    expect(l.coordinates.at(-1)).toEqual([180, 50]);
    expect(l.coordinates.length).toBe(181);
  });
  test('meridian spans pole to pole', () => {
    const m = meridianLine(21, 2);
    expect(m.coordinates[0]).toEqual([21, -90]);
    expect(m.coordinates.at(-1)).toEqual([21, 90]);
  });
  test('hemisphere polygons exist', () => {
    for (const r of ['N', 'S', 'E', 'W'] as const) expect(hemisphere(r).coordinates[0]!.length).toBeGreaterThan(10);
  });
});

describe('deep zoom (Task 21)', () => {
  const katowice = { lat: 50.26, lon: 19.02 };
  test('flat zoom 80: centre, round trips to well under a pixel, and bounds of 4.5° × 2.25°', () => {
    for (const projection of ['grid', 'equal-earth'] as const) {
      const ctx = makeFlatCtx(960, 480, katowice, 80, 1, projection);
      const [x, y] = ctx.project(katowice)!;
      expect(x).toBeCloseTo(480, 6); expect(y).toBeCloseTo(240, 6);
      for (const xy of [[10, 10], [950, 470], [480.5, 240.5]] as [number, number][]) {
        const back = ctx.project(ctx.invert(xy)!)!;
        expect(Math.hypot(back[0] - xy[0], back[1] - xy[1])).toBeLessThan(1e-6);
      }
      expect(ctx.zoom).toBe(80);
      expect(ctx.bounds.west).toBeLessThanOrEqual(ctx.invert([0, 240])!.lon + 1e-9);
      expect(ctx.bounds.east).toBeGreaterThanOrEqual(ctx.invert([960, 240])!.lon - 1e-9);
    }
    const grid = makeFlatCtx(960, 480, katowice, 80, 1);
    expect(grid.bounds.east - grid.bounds.west).toBeCloseTo(4.5, 9);
    expect(grid.bounds.north - grid.bounds.south).toBeCloseTo(2.25, 9);
    // One arc minute is 3.6 map units: a click lands on the right minute.
    const oneMinute = grid.project({ lat: katowice.lat, lon: katowice.lon + 1 / 60 })![0] - 480;
    expect(oneMinute).toBeCloseTo(960 * 80 / 360 / 60, 6);
  });
  test('flat zoom 80: paths are clipped to the view, so a whole-world line stays short', () => {
    const ctx = makeFlatCtx(960, 480, katowice, 80, 1);
    const d = ctx.path(parallelLine(katowice.lat))!;
    const xs = [...d.matchAll(/[ML]([-\d.]+),/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-24 - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(984 + 1e-6);
    // The parallel through the centre is drawn through the centre (no great-circle bow).
    const mid = ctx.projection.invert!([480, 240])!;
    expect(mid[1]).toBeCloseTo(katowice.lat, 6);
  });
  test('globe zoom 60: centre, invert near the centre, bounds a few degrees wide', () => {
    const ctx = makeGlobeCtx(500, [-katowice.lon, -katowice.lat], 1, 60);
    const [x, y] = ctx.project(katowice)!;
    expect(x).toBeCloseTo(250, 6); expect(y).toBeCloseTo(250, 6);
    const ll = ctx.invert([260, 240])!;
    const back = ctx.project(ll)!;
    expect(Math.hypot(back[0] - 260, back[1] - 240)).toBeLessThan(1e-6);
    expect(ctx.zoom).toBe(120);
    expect(ctx.bounds.north - ctx.bounds.south).toBeLessThan(4);
    expect(ctx.bounds.south).toBeLessThan(ctx.invert([250, 499])!.lat);
    expect(ctx.bounds.east).toBeGreaterThan(ctx.invert([499, 250])!.lon);
  });
  test('globe at zoom 1 sees a whole hemisphere (conservatively: every longitude once a pole is in view)', () => {
    expect(makeGlobeCtx(500, [0, 0], 1, 1).bounds).toEqual({ west: -180, east: 180, south: -90, north: 90 });
    const z3 = makeGlobeCtx(500, [0, 0], 1, 3).bounds;
    expect(z3.east).toBeLessThan(90); expect(z3.west).toBeGreaterThan(-90);
  });
  test('boundsIntersect handles the antimeridian and full-world views', () => {
    const region = { west: 8, south: 44, east: 32, north: 58 };
    expect(boundsIntersect({ west: 350, south: 40, east: 370, north: 60 }, region)).toBe(true);
    expect(boundsIntersect({ west: -10, south: 40, east: 5, north: 60 }, region)).toBe(false);
    expect(boundsIntersect({ west: -180, south: 59, east: 180, north: 90 }, region)).toBe(false);
    expect(boundsIntersect({ west: -200, south: 0, east: 200, north: 50 }, region)).toBe(true);
  });
});

describe('regionPath', () => {
  test('on the grid map it draws exactly where the projection does, at any zoom', () => {
    for (const zoom of [4, 9, 80]) {
      const ctx = makeFlatCtx(960, 480, { lat: 50.26, lon: 19.02 }, zoom, 1);
      const line: GeoJSON.LineString = { type: 'LineString', coordinates: [[19, 50.2], [19.05, 50.3]] };
      const nums = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
      const planar = nums(ctx.regionPath(line)!);
      const a = ctx.project({ lat: 50.2, lon: 19 })!, b = ctx.project({ lat: 50.3, lon: 19.05 })!;
      expect(planar[0]).toBeCloseTo(a[0], 0); expect(planar[1]).toBeCloseTo(a[1], 0);
      expect(planar.at(-2)).toBeCloseTo(b[0], 0); expect(planar.at(-1)).toBeCloseTo(b[1], 0);
    }
  });
  test('globe and Equal Earth have one too', () => {
    const line: GeoJSON.LineString = { type: 'LineString', coordinates: [[19, 50.2], [19.05, 50.3]] };
    expect(makeGlobeCtx(500, [-19, -50], 1, 6).regionPath(line)).toMatch(/^M/);
    expect(makeFlatCtx(960, 480, { lat: 50, lon: 19 }, 6, 1, 'equal-earth').regionPath(line)).toMatch(/^M/);
  });
});
