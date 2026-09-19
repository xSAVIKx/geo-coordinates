import { describe, expect, test } from 'vitest';
import { CITY_BOXES } from '../../src/map/cityBoxes';
import { makeFlatCtx, parallelLine, parallelStep, POLAR, TROPIC } from '../../src/map/geometry';

/**
 * A parallel is not a great circle, and d3 draws every segment as one, so a `parallelLine` with vertices `step`
 * degrees apart bows away from the true parallel between them. The bow's maximum is at the middle of a segment,
 * where the great circle's latitude is atan(tan φ / cos(Δλ/2)); in view units it is that excess times the map's
 * units per degree (960 · zoom / 360). `parallelStep` shrinks the step so the bow stays where it is today.
 */
function bowUnits(lat: number, stepDeg: number, zoom: number): number {
  const phi = (lat * Math.PI) / 180;
  const half = (stepDeg * Math.PI) / 360;
  const excess = (Math.atan(Math.tan(phi) / Math.cos(half)) * 180) / Math.PI - lat;
  return excess * ((960 * zoom) / 360);
}

/** A flat view `zoom` deep, centred on `lon`: 360/zoom degrees across, as `makeFlatCtx` reports it. */
const view = (zoom: number, lon: number) => ({ west: lon - 180 / zoom, east: lon + 180 / zoom, south: 0, north: 1 });

describe('parallelStep', () => {
  test('exactly 1 at or below zoom 80, so nothing Atlas draws today moves (planning ruling R3)', () => {
    for (const zoom of [0.5, 1, 3.5, 9, 12, 20, 40, 79.9, 80]) expect(parallelStep(zoom), String(zoom)).toBe(1);
  });

  test('above zoom 80 it shrinks as 1/sqrt(zoom), which holds the bow constant', () => {
    expect(parallelStep(320)).toBeCloseTo(0.5, 10);
    expect(parallelStep(4270)).toBeCloseTo(0.13688, 5);
    expect(parallelStep(6000)).toBeCloseTo(0.11547, 5);
    for (const zoom of [80, 200, 1000, 4270, 6000]) {
      expect(bowUnits(50.26, parallelStep(zoom), zoom), `zoom ${zoom}`).toBeCloseTo(0.229, 2);
    }
  });

  test('without it a city zoom would bow the line 17 view units off the feature it names', () => {
    expect(bowUnits(50.26, 1, 6000)).toBeGreaterThan(17);
    expect(bowUnits(50.26, 1, 80)).toBeLessThan(0.25);
  });

  test('the drawn path really follows the parallel at a city zoom', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 66.5436, lon: 25.8475 }, 2659, 1, 'grid');
    // The Arctic Circle across the Rovaniemi box: every vertex of the drawn line must project to the same y as
    // the true parallel does at the middle of the view. The window is ±0.5° because at zoom 2659 the step is
    // 0.173°, so a ±0.1° window holds one vertex or two depending on where the ticks happen to fall.
    const trueY = ctx.project({ lat: 66.5436, lon: 25.8475 })![1];
    const line = parallelLine(66.5436, parallelStep(ctx.zoom));
    const near = line.coordinates.filter(([lon]) => Math.abs(lon! - 25.8475) < 0.5);
    expect(near.length).toBeGreaterThan(1);
    for (const [lon, lat] of near) {
      const xy = ctx.project({ lat: lat!, lon: lon! })!;
      expect(Math.abs(xy[1] - trueY), `${lon}`).toBeLessThan(0.01);
    }
    // The vertices are on the parallel whatever the step; what bows is the great-circle arc d3 draws *between*
    // them, which only the generated path shows. Every y of the drawn path has to be the parallel's own y.
    const ys = (d: string) => [...d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => Number(m[2]!));
    const dev = (step: number) => Math.max(...ys(ctx.path(parallelLine(66.5436, step)) ?? '').map((y) => Math.abs(y - trueY)));
    expect(dev(parallelStep(ctx.zoom))).toBeLessThan(0.25);
    expect(dev(1), 'a 1° step is what the shrinking step exists to avoid').toBeGreaterThan(3);
  });

  test('inside every one of the twelve boxes, at zoom 80, 800 and 6000, a parallel is drawn where it belongs', () => {
    // The whole point of the step: a line the lesson names must land on the thing it names. For each box the
    // view stands on the box, and on each special line that box is about, and the drawn path is measured against
    // the parallel's own y. A tenth of a view unit is a twentieth of a CSS pixel on a 960-unit map.
    const ys = (d: string) => [...d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => Number(m[2]!));
    const dev = (c: { lat: number; lon: number }, zoom: number, lat: number, step: number): number | null => {
      const ctx = makeFlatCtx(960, 480, c, zoom, 1, 'grid');
      const d = ctx.path(parallelLine(lat, step)) ?? '';
      if (!d) return null;
      const trueY = ctx.project({ lat, lon: c.lon })![1];
      return Math.max(...ys(d).map((y) => Math.abs(y - trueY)));
    };
    for (const b of CITY_BOXES) {
      for (const zoom of [80, 800, 6000]) {
        // the point's own dashed latitude guide, drawn through the middle of the box
        expect(dev(b, zoom, b.lat, parallelStep(zoom)), `${b.id} guide z${zoom}`).toBeLessThan(0.1);
        // the equator, the two tropics and the two polar circles, with the view standing on each of them
        for (const lat of [0, TROPIC, -TROPIC, POLAR, -POLAR]) {
          const d = dev({ lat, lon: b.lon }, zoom, lat, parallelStep(zoom));
          expect(d ?? 0, `${b.id} lat ${lat} z${zoom}`).toBeLessThan(0.1);
        }
      }
    }
    // And the same measurement with the old fixed 1° step, to show the fence is load-bearing.
    expect(dev({ lat: POLAR, lon: 25.8475 }, 6000, POLAR, 1)!).toBeGreaterThan(7);
    expect(dev({ lat: TROPIC, lon: 31.1325 }, 6000, TROPIC, 1)!).toBeGreaterThan(6);
  });

  test('parallelLine still takes its step and defaults to 1', () => {
    expect(parallelLine(0).coordinates.length).toBe(361);
    expect(parallelLine(0, 0.5).coordinates.length).toBe(721);
    expect(parallelLine(12, 1).coordinates[0]).toEqual([-180, 12]);
  });

  test('a parallel always reaches the antimeridian, whatever the step', () => {
    // The loop stops at the last vertex at or below 180, and a step that does not divide 360 never lands on it:
    // at zoom 6000 it would stop 0.08° short, which is 1 277 view units — a view panned to the date line would
    // show no line at all. Every step, tidy or not, has to close on [180, lat].
    for (const zoom of [80, 100, 120, 800, 2659, 4270, 6000]) {
      const c = parallelLine(37.5, parallelStep(zoom)).coordinates;
      expect(c[c.length - 1], `zoom ${zoom}`).toEqual([180, 37.5]);
      expect(c[0], `zoom ${zoom}`).toEqual([-180, 37.5]);
    }
    // ... and the tidy steps are untouched: no duplicate vertex is appended, so the counts above still hold.
    for (const step of [1, 0.5, 2, 0.25]) {
      const c = parallelLine(-12, step).coordinates;
      expect(c[c.length - 1], `step ${step}`).toEqual([180, -12]);
      expect(c[c.length - 2]![0], `step ${step}`).toBe(180 - step);
    }
  });

  /*
   * A deep flat view builds the parallel over a window round itself instead of the whole world: at zoom 6000
   * the line is 3 118 vertices and 0.06° of it can be seen, so 3 116 of them were projected and clipped away
   * seven times a frame. The window has to be wide enough that it never shows an end, and the whole world has
   * to come back the moment the step is 1 — that is every map the lesson drew before city close-ups existed.
   */
  test('a deep flat view builds only the part of a parallel it can see', () => {
    const full = parallelLine(50.26, parallelStep(6000)).coordinates.length;
    const windowed = parallelLine(50.26, parallelStep(6000), view(6000, 19.02)).coordinates;
    expect(full).toBe(3119);
    expect(windowed.length).toBeLessThan(20);
    // The ends are outside the view on both sides, so the drawn line still crosses it edge to edge.
    expect(windowed[0]![0]).toBeLessThan(view(6000, 19.02).west);
    expect(windowed[windowed.length - 1]![0]).toBeGreaterThan(view(6000, 19.02).east);
    for (const p of windowed) expect(p[1]).toBe(50.26);
  });

  test('at a step of 1 the window changes nothing at all, so the Atlas baselines cannot move', () => {
    for (const zoom of [1, 12, 40, 80]) {
      for (const lon of [-170, 0, 19.02, 175]) {
        expect(parallelLine(0, parallelStep(zoom), view(zoom, lon)).coordinates, `zoom ${zoom} lon ${lon}`)
          .toEqual(parallelLine(0).coordinates);
      }
    }
  });

  test('a view that wraps past the antimeridian, or covers the world, gets the whole line', () => {
    const step = parallelStep(6000);
    const whole = parallelLine(0, step).coordinates;
    expect(parallelLine(0, step, { west: -200, east: -190, south: -1, north: 1 }).coordinates).toEqual(whole);
    expect(parallelLine(0, step, { west: 170, east: 200, south: -1, north: 1 }).coordinates).toEqual(whole);
    expect(parallelLine(0, step, { west: -180, east: 180, south: -90, north: 90 }).coordinates).toEqual(whole);
    expect(parallelLine(0, step, { west: 10, east: 10, south: -1, north: 1 }).coordinates).toEqual(whole);
  });
});
