import type { GeoBounds, ViewCtx } from './geometry';
import type { LayerFlags } from './types';

/** Steps (in degrees) the adaptive grid picks from: 30°, 15°, 10°, 5°, 1°, 30′, 10′, 5′, 1′. */
export const AUTO_GRID_STEPS: readonly number[] = [30, 15, 10, 5, 1, 1 / 2, 1 / 6, 1 / 12, 1 / 60];
/**
 * Rungs used only to bridge a hole in the ladder, and only on a map narrower than the reference width,
 * where no ordinary step lands inside the band at all.
 *
 * 5° to 1° is the one five-fold jump in the list, and a phone's globe zoomed onto Poland sits right in
 * it, at about 35 px per degree: 1° draws ten lines each way across a 350 px map (the mesh the owner
 * photographed) and 5° draws two. 2° draws five. A wide map can afford the jump — it has room for 1°'s
 * twenty-five lines, or it can take 5°'s wider spacing without running out of map — so the bridge is
 * kept away from it, and a desktop or a projector sees exactly the steps it saw before.
 */
export const BRIDGE_GRID_STEPS: readonly number[] = [2];
export const GRID_MIN_PX = 40;
export const GRID_MAX_PX = 120;
/**
 * The width the 40–120 px band was chosen on. Every map this wide or wider keeps that band exactly, which
 * is what leaves desktop Atlas and the projector alone. The lesson's flat map is 575 px in a 1366-wide
 * window and 499 px (in unscaled units) in presenter mode on a 1920 screen; 480 puts both of those, and
 * every larger one, firmly on the untouched side rather than balanced on the edge of the rule.
 */
export const GRID_BAND_REF_PX = 480;
/** How far the band may open up on a narrow map (a 192 px map and anything smaller sits at the cap). */
export const GRID_BAND_MAX_SPREAD = 2.5;
/** However wide the spacing gets, this many gaps still have to cross the map, or it stops being a grid. */
export const GRID_MIN_GAPS = 3;

/**
 * The spacing a map `cssWidth` px wide aims for.
 *
 * 40 px between lines is comfortable on the desktop map the number was picked on; on a 350 px phone the
 * same 40 px lets nine or ten lines cross the picture, and the graticule stops being a reference and
 * becomes a texture over the relief. So the band opens up as the map narrows, in inverse proportion to
 * its width, up to the spread cap — and is then pulled back so at least `GRID_MIN_GAPS` gaps still
 * cross the map, since a phone map with one line on it is no more readable than one with ten.
 */
export function gridBand(cssWidth: number): [number, number] {
  const spread = gridBandSpread(cssWidth);
  const min = GRID_MIN_PX * spread;
  return [min, Math.max(min * 1.5, Math.min(GRID_MAX_PX * spread, cssWidth / GRID_MIN_GAPS))];
}

/** How far this map's band is opened up: 1 at or above the reference width, growing as the map narrows. */
export const gridBandSpread = (cssWidth: number): number =>
  Math.min(GRID_BAND_MAX_SPREAD, Math.max(1, GRID_BAND_REF_PX / Math.max(1, cssWidth)));

/**
 * The adaptive grid step for a map `cssWidth` px wide drawn at `pxPerDegree` CSS px per degree: the
 * finest ordinary step whose lines land inside that map's band; failing that — the ladder is coarse at
 * both ends — the step closest to the band on a log scale, bridging rungs included on a narrow map.
 */
export function chooseGridStep(pxPerDegree: number, cssWidth: number = GRID_BAND_REF_PX): number {
  const [minPx, maxPx] = gridBand(cssWidth);
  const missOf = (step: number) => {
    const gap = step * pxPerDegree;
    return gap < minPx ? Math.log(minPx / gap) : gap > maxPx ? Math.log(gap / maxPx) : 0;
  };
  let best = AUTO_GRID_STEPS[0]!;
  let bestMiss = Infinity;
  for (const step of AUTO_GRID_STEPS) {
    const miss = missOf(step);
    if (miss <= bestMiss) { best = step; bestMiss = miss; }
  }
  if (bestMiss === 0 || gridBandSpread(cssWidth) === 1) return best;
  for (const step of BRIDGE_GRID_STEPS) {
    const miss = missOf(step);
    if (miss < bestMiss) { best = step; bestMiss = miss; }
  }
  return best;
}

/** The map's width in the same CSS px the band is measured in (`ctx.width` is in map units). */
export const cssWidthOf = (ctx: ViewCtx): number => ctx.width / ctx.px;

/** CSS px per degree of latitude at the centre of the view (where the pupil is looking). */
export function pxPerDegreeAtCenter(ctx: ViewCtx): number {
  const { lat, lon } = ctx.center;
  const d = 0.05;
  const a = ctx.project({ lat: Math.max(-90, lat - d), lon });
  const b = ctx.project({ lat: Math.min(90, lat + d), lon });
  if (!a || !b) return 0;
  const degrees = Math.min(90, lat + d) - Math.max(-90, lat - d);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / degrees / ctx.px;
}

/** The step to draw: a scene's fixed step as is, `'auto'` adapted to the view. */
export function resolveGridStep(step: LayerFlags['graticuleStep'], ctx: ViewCtx): number {
  return step === 'auto' ? chooseGridStep(pxPerDegreeAtCenter(ctx), cssWidthOf(ctx)) : step;
}

/** Steps below 1° are labelled with minutes. */
export const gridUsesMinutes = (step: number): boolean => step < 1 - 1e-9;

/**
 * The graticule extent for `bounds`, snapped outward to whole steps so lines don't start or end
 * inside the view. The whole world keeps d3's classic extent (lines reach the poles).
 */
export function gridExtent(bounds: GeoBounds, step: number): [[number, number], [number, number]] {
  if (bounds.east - bounds.west >= 360 && bounds.south <= -90 && bounds.north >= 90) return [[-180, -90], [180, 90.0001]];
  const west = Math.floor(bounds.west / step) * step;
  const east = Math.ceil(bounds.east / step) * step + step / 2;
  const south = Math.max(-90, Math.floor(bounds.south / step) * step);
  const north = Math.min(90.0001, Math.ceil(bounds.north / step) * step + step / 2);
  return [[west, south], [east, north]];
}
