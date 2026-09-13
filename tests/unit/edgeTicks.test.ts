import { describe, expect, test } from 'vitest';
import { edgeTicks, type LatTick, type LonTick } from '../../src/map/edgeTicks';
import { flatMinZoom, makeFlatCtx } from '../../src/map/geometry';
import { DEFAULT_LAYERS } from '../../src/map/mapState.svelte';
import type { LatLon } from '../../src/geo/types';
import type { FlatProjection } from '../../src/map/types';

const STEP = DEFAULT_LAYERS.graticuleStep as number; // 10, matches the default flat map

function pos(tick: LatTick | LonTick): number {
  return 'y' in tick ? tick.y : tick.x;
}

function spacings(ticks: (LatTick | LonTick)[]): number[] {
  const sorted = [...ticks].sort((a, b) => a.value - b.value);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) out.push(Math.abs(pos(sorted[i]!) - pos(sorted[i - 1]!)));
  return out;
}

const CASES: { name: string; center: LatLon; zoom: number; px: number }[] = [
  { name: 'zoom 1 world, desktop px', center: { lat: 0, lon: 0 }, zoom: 1, px: 1 },
  { name: 'zoom 1 world, phone px', center: { lat: 0, lon: 0 }, zoom: 1, px: 2.56 },
  { name: 'zoom 4 europe, desktop px', center: { lat: 52, lon: 15 }, zoom: 4, px: 1 },
  { name: 'zoom 4 europe, phone px', center: { lat: 52, lon: 15 }, zoom: 4, px: 2.56 },
];

const MERCATOR_CASES: typeof CASES = [
  { name: 'whole world (min zoom), desktop px', center: { lat: 0, lon: 0 }, zoom: flatMinZoom('mercator'), px: 1 },
  { name: 'whole world (min zoom), phone px', center: { lat: 0, lon: 0 }, zoom: flatMinZoom('mercator'), px: 2.56 },
  { name: 'zoom 1 far north (Greenland), phone px', center: { lat: 60, lon: -40 }, zoom: 1, px: 2.56 },
  { name: 'zoom 9 Katowice, desktop px', center: { lat: 50.26, lon: 19.02 }, zoom: 9, px: 1 },
];

for (const projection of ['grid', 'equal-earth', 'mercator'] as FlatProjection[]) {
  describe(`edgeTicks (${projection})`, () => {
    for (const { name, center, zoom, px } of [...CASES, ...(projection === 'mercator' ? MERCATOR_CASES : [])]) {
      describe(name, () => {
        const ctx = makeFlatCtx(960, 480, center, zoom, px, projection);
        const ticks = edgeTicks(ctx, center, zoom, STEP);
        const minGap = 34 * px;
        const halfLat = 90 / zoom, halfLon = 180 / zoom;
        // Mercator stretches latitude: its visible span is the view's exact bounds (within ±85°).
        const latMin = projection === 'mercator' ? ctx.bounds.south : Math.max(-90, center.lat - halfLat);
        const latMax = projection === 'mercator' ? ctx.bounds.north : Math.min(90, center.lat + halfLat);
        const lonMin = Math.max(-180, center.lon - halfLon), lonMax = Math.min(180, center.lon + halfLon);

        test('adjacent latitude labels are >= 34 CSS px apart', () => {
          for (const d of spacings(ticks.lats)) expect(d).toBeGreaterThanOrEqual(minGap - 1e-6);
        });

        test('adjacent longitude labels are >= 34 CSS px apart', () => {
          for (const d of spacings(ticks.lons)) expect(d).toBeGreaterThanOrEqual(minGap - 1e-6);
        });

        test('every latitude value is within the visible range', () => {
          for (const t of ticks.lats) {
            expect(t.value).toBeGreaterThanOrEqual(latMin - 1e-9);
            expect(t.value).toBeLessThanOrEqual(latMax + 1e-9);
          }
        });

        test('every longitude value is within the visible range', () => {
          for (const t of ticks.lons) {
            expect(t.value).toBeGreaterThanOrEqual(lonMin - 1e-9);
            expect(t.value).toBeLessThanOrEqual(lonMax + 1e-9);
          }
        });

        if (projection === 'mercator') test('every label sits inside the view', () => {
          for (const t of ticks.lats) { expect(t.y).toBeGreaterThanOrEqual(-1e-6); expect(t.y).toBeLessThanOrEqual(480 + 1e-6); }
          for (const t of ticks.lons) { expect(t.x).toBeGreaterThanOrEqual(-1e-6); expect(t.x).toBeLessThanOrEqual(960 + 1e-6); }
        });

        test('0 degrees is kept when visible', () => {
          if (0 >= latMin && 0 <= latMax) expect(ticks.lats.some((t) => t.value === 0)).toBe(true);
          if (0 >= lonMin && 0 <= lonMax) expect(ticks.lons.some((t) => t.value === 0)).toBe(true);
        });
      });
    }
  });
}

describe('edgeTicks pole handling', () => {
  test('the poles themselves are never labelled', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid');
    const ticks = edgeTicks(ctx, { lat: 0, lon: 0 }, 1, 10);
    expect(ticks.lats.some((t) => Math.abs(t.value) === 90)).toBe(false);
  });
});
