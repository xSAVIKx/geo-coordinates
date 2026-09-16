import { describe, expect, test } from 'vitest';
import { flatMinZoom, makeFlatCtx, makeGlobeCtx, type ViewCtx } from '../../src/map/geometry';
import { REGION, REGION_MIN_ZOOM } from '../../src/map/world';
import { inverseProject, regionMix } from '../../src/map/texture/inverse';
import { textureView } from '../../src/map/texture/viewParams';
import type { FlatProjection } from '../../src/map/types';

const DEG = 180 / Math.PI;
const lonDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Samples a grid of view points (plus the corners) and compares the port with d3's own invert (ViewCtx.invert). */
function compare(ctx: ViewCtx, nx: number, ny: number) {
  const v = textureView(ctx);
  let checked = 0;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const x = (ctx.width * i) / nx, y = (ctx.height * j) / ny;
      const port = inverseProject(v, x, y);
      if (ctx.kind === 'globe') {
        const r = Math.hypot(x - v.origin[0], y - v.origin[1]) / v.scale;
        if (Math.abs(r - 1) < 1e-3) continue; // exactly on the limb either answer is fine
      }
      const d3 = ctx.invert([x, y]);
      // d3's generic invert un-rotates with an identity rotation (d3-geo's rotationIdentity) and, on Equal Earth,
      // its own asin helper clamps overflow to the pole instead of rejecting it — so a pixel genuinely outside the
      // leaf (e.g. a zoomed-in view near the pole) still gets a "valid" but meaningless longitude out of d3 (see the
      // 'outside its outline' case below, and Math.abs(d3.lat) < 89.99 a few lines down for the same degeneracy).
      // The port's stricter outline check is correct there; only this one known quirk is skipped, and only when it
      // is the port that says off-map.
      if (ctx.flatProjection === 'equal-earth' && port === null && d3 !== null && Math.abs(d3.lat) >= 89.99) continue;
      expect(port === null, `null at ${x},${y}`).toBe(d3 === null);
      if (!port || !d3) continue;
      checked++;
      expect(Math.abs(port.phi * DEG - d3.lat), `lat at ${x},${y}`).toBeLessThanOrEqual(0.01);
      if (Math.abs(d3.lat) < 89.99) expect(lonDiff(port.lambda * DEG, d3.lon), `lon at ${x},${y}`).toBeLessThanOrEqual(0.01);
    }
  }
  return checked;
}

describe('texture inverse projections match d3 to 0.01°', () => {
  const flats: [FlatProjection, { lat: number; lon: number }, number][] = [];
  for (const p of ['grid', 'equal-earth', 'mercator'] as const) {
    flats.push([p, { lat: 0, lon: 0 }, flatMinZoom(p)], [p, { lat: 0, lon: 0 }, 1], [p, { lat: 50.26, lon: 19.02 }, 9],
      [p, { lat: -33.87, lon: 151.21 }, 3.5], [p, { lat: 60, lon: 170 }, 2], [p, { lat: 50.26, lon: 19.02 }, 80]);
  }
  test.each(flats)('%s centred %o at zoom %d', (projection, center, zoom) => {
    expect(compare(makeFlatCtx(960, 480, center, zoom, 1, projection), 32, 16)).toBeGreaterThan(100);
  });

  test.each([
    [[-19, -50], 1], [[0, -90], 1], [[0, 90], 1], [[170, 30], 3], [[-19.02, -50.26], 60], [[179.5, 0], 1.5],
  ] as [[number, number], number][])('globe rotated %o at zoom %d', (rotate, zoom) => {
    expect(compare(makeGlobeCtx(500, rotate, 1, zoom), 40, 40)).toBeGreaterThan(50);
  });
});

describe('clip edges', () => {
  test('globe: just inside the disc is on the map, just outside is not', () => {
    const v = textureView(makeGlobeCtx(500, [0, 0], 1, 1)); // radius 244 around (250, 250)
    expect(inverseProject(v, 250 + 243.9, 250)).not.toBeNull();
    expect(inverseProject(v, 250 + 244.2, 250)).toBeNull();
    expect(inverseProject(v, 250, 250)!.rho).toBe(0);
  });
  test('Mercator stops at 85°; Equal Earth outside its outline and grid beyond the poles are off the map', () => {
    const merc = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, flatMinZoom('mercator'), 1, 'mercator');
    const top = merc.project({ lat: 85, lon: 0 })![1];
    expect(inverseProject(textureView(merc), 480, top + 0.5)).not.toBeNull();
    expect(inverseProject(textureView(merc), 480, top - 0.5)).toBeNull();
    expect(inverseProject(textureView(merc), 5, 240)).toBeNull(); // sea beside a zoomed-out Mercator world
    expect(inverseProject(textureView(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth')), 2, 2)).toBeNull();
  });
});

test('the detail tile fades in from zoom 4 to 5 where the view reaches Central Europe', () => {
  const at = (center: { lat: number; lon: number }, zoom: number) => regionMix(textureView(makeFlatCtx(960, 480, center, zoom, 1, 'grid')), REGION, REGION_MIN_ZOOM);
  expect(at({ lat: 50, lon: 19 }, 3.9)).toBe(0);
  expect(at({ lat: 50, lon: 19 }, 4.5)).toBeCloseTo(0.5, 9);
  expect(at({ lat: 50, lon: 19 }, 9)).toBe(1);
  expect(at({ lat: -33.87, lon: 151.21 }, 9)).toBe(0);
});
