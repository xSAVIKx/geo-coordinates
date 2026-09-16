import { describe, expect, test } from 'vitest';
import { candidateValues, edgeTicks } from '../../src/map/edgeTicks';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { AUTO_GRID_STEPS, BRIDGE_GRID_STEPS, chooseGridStep, GRID_BAND_MAX_SPREAD, GRID_BAND_REF_PX, gridBand, gridExtent, gridUsesMinutes, pxPerDegreeAtCenter, resolveGridStep } from '../../src/map/gridStep';
import { formatLat, formatLon } from '../../src/geo/format';

describe('chooseGridStep', () => {
  test('lines land 40–120 CSS px apart whenever a listed step allows it', () => {
    for (let ppd = 1; ppd < 20_000; ppd *= 1.07) {
      const step = chooseGridStep(ppd);
      expect([...AUTO_GRID_STEPS, ...BRIDGE_GRID_STEPS]).toContain(step);
      const fits = AUTO_GRID_STEPS.some((s) => s * ppd >= 40 && s * ppd <= 120);
      if (fits) {
        expect(step * ppd).toBeGreaterThanOrEqual(40);
        expect(step * ppd).toBeLessThanOrEqual(120);
      }
    }
  });
  test('typical maps (a map at or above the reference width keeps the original band)', () => {
    expect(chooseGridStep(573 / 360, 573)).toBe(30);        // lab world map (573 CSS px wide)
    expect(chooseGridStep((573 * 9) / 360, 573)).toBe(5);   // Poland preset: 14.3 px/° → 5° = 72 px
    expect(chooseGridStep((573 * 40) / 360, 573)).toBe(1);  // 63.7 px/°
    expect(chooseGridStep((573 * 80) / 360, 573)).toBe(1 / 2); // 127 px/° → 30′ = 64 px
    expect(chooseGridStep(300, 573)).toBe(1 / 6);            // 10′ = 50 px
    expect(chooseGridStep(3000, 573)).toBe(1 / 60);          // 1′ = 50 px
    expect(chooseGridStep(0.3, 573)).toBe(30);               // tiny scale: the coarsest step
  });
  test('the 5° → 1° gap picks the nearer one on a log scale', () => {
    expect(chooseGridStep(30, 573)).toBe(5);   // 1° = 30 px (too dense) vs 5° = 150 px
    expect(chooseGridStep(36, 573)).toBe(1);   // 1° = 36 px vs 5° = 180 px
  });
  test('a narrow map is given more room per line, so fewer of them cross the picture', () => {
    const PHONE = 351; // the flat map in a 375-wide window
    // The owner's Poland view: 5° put fourteen lines across the phone map; 10° puts eight.
    expect(chooseGridStep((PHONE * 9) / 360, PHONE)).toBe(10);
    expect(chooseGridStep((PHONE * 9) / 360, 875)).toBe(5); // the same view on a projector is untouched
    // Europe at zoom 6 keeps 10°: six gaps is already right, and the band only nudges, it does not stampede.
    expect(chooseGridStep((PHONE * 6) / 360, PHONE)).toBe(10);
    // The whole world has nowhere coarser to go than 30°, so it stays there and weight has to carry it.
    expect(chooseGridStep(PHONE / 360, PHONE)).toBe(30);
  });
  test('the bridging 2° rung only appears where no ordinary step fits at all', () => {
    // A phone globe zoomed onto Poland: ~35 px per degree, where 1° is ten lines and 5° is two.
    expect(chooseGridStep(35, 351)).toBe(2);
    // On a wide map at the same scale 1° fits the band, so the bridge is never consulted and nothing changes.
    expect(chooseGridStep(35, 875)).toBe(1);
    expect(chooseGridStep(22, 875)).toBe(5);
  });
  test('the band opens in proportion below the reference width and stops at the spread cap', () => {
    expect(gridBand(900)).toEqual([40, 120]);
    expect(gridBand(GRID_BAND_REF_PX)).toEqual([40, 120]);
    const [min] = gridBand(250);
    expect(min).toBeCloseTo(40 * (GRID_BAND_REF_PX / 250), 6);
    expect(gridBand(100)[0]).toBe(40 * GRID_BAND_MAX_SPREAD); // capped, however small the map gets
    // However wide the spacing grows, three gaps still have to cross the map.
    for (const w of [120, 200, 280, 351, 460, 575, 978]) expect(gridBand(w)[1]).toBeLessThanOrEqual(Math.max(gridBand(w)[0] * 1.5, w / 3));
  });
});

describe('resolveGridStep', () => {
  test('a scene’s fixed step is kept exactly', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 50, lon: 19 }, 80, 1);
    for (const s of [1, 5, 10, 15, 30] as const) expect(resolveGridStep(s, ctx)).toBe(s);
  });
  test("'auto' follows the zoom (flat, css px = map units / px)", () => {
    const px = 960 / 573;
    expect(pxPerDegreeAtCenter(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, px))).toBeCloseTo(573 / 360, 6);
    expect(resolveGridStep('auto', makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, px))).toBe(30);
    expect(resolveGridStep('auto', makeFlatCtx(960, 480, { lat: 50.26, lon: 19.02 }, 80, px))).toBe(1 / 2);
    expect(gridUsesMinutes(1 / 2)).toBe(true);
    expect(gridUsesMinutes(1)).toBe(false);
  });
  test("'auto' on Mercator follows its stretched scale: finer grid further north at the same zoom", () => {
    const px = 960 / 573;
    const equator = resolveGridStep('auto', makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 9, px, 'mercator'));
    const north = resolveGridStep('auto', makeFlatCtx(960, 480, { lat: 70, lon: 0 }, 9, px, 'mercator'));
    expect(north).toBeLessThan(equator);
    for (const [c, z] of [[{ lat: 0, lon: 0 }, 0.51], [{ lat: 50.26, lon: 19.02 }, 9], [{ lat: 50.26, lon: 19.02 }, 80]] as const) {
      const ctx = makeFlatCtx(960, 480, c, z, px, 'mercator');
      const gap = resolveGridStep('auto', ctx) * pxPerDegreeAtCenter(ctx);
      expect(gap).toBeGreaterThanOrEqual(24); expect(gap).toBeLessThanOrEqual(200);
    }
  });
  test("'auto' on the globe gets finer as it zooms", () => {
    const px = 500 / 287;
    const a = resolveGridStep('auto', makeGlobeCtx(500, [-19, -50], px, 1));
    const b = resolveGridStep('auto', makeGlobeCtx(500, [-19, -50], px, 60));
    expect(a).toBeGreaterThanOrEqual(15);
    expect(b).toBeLessThan(1);
  });
});

describe('grid extent and minute ticks', () => {
  test('the whole world keeps the classic extent; a small view is snapped outward to whole steps', () => {
    expect(gridExtent({ west: -180, south: -90, east: 180, north: 90 }, 10)).toEqual([[-180, -90], [180, 90.0001]]);
    const [[w, s], [e, n]] = gridExtent({ west: 16.77, south: 49.135, east: 21.27, north: 51.385 }, 1 / 2);
    expect(w).toBe(16.5); expect(s).toBe(49);
    expect(e).toBeGreaterThanOrEqual(21.5); expect(n).toBeGreaterThanOrEqual(51.5);
  });
  test('candidate values are exact multiples of minute steps', () => {
    const v = candidateValues(1 / 60, 50.2, 50.3);
    expect(v[0]).toBe(50.2); // 50°12′
    expect(v[3]).toBe(50.25); // 50°15′, not 50.250000001
    expect(v).toHaveLength(7);
    expect(candidateValues(10, -25, 25)).toEqual([-20, -10, 0, 10, 20]);
  });
  test('zoom 80 over Katowice: 30′ ticks with minute labels in every language', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 50.26, lon: 19.02 }, 80, 960 / 573);
    const ticks = edgeTicks(ctx, { lat: 50.26, lon: 19.02 }, 80, 1 / 2);
    expect(ticks.lats.map((t) => t.value)).toEqual([49.5, 50, 50.5, 51]);
    expect(ticks.lons.map((t) => t.value)).toContain(19);
    expect(formatLat(50.5, 'en', 'minute')).toBe('50°30′N');
    expect(formatLat(50.5, 'uk', 'minute')).toBe('50°30′ пн. ш.');
    expect(formatLon(19.5, 'pl', 'minute')).toBe('19°30′E');
  });
});
