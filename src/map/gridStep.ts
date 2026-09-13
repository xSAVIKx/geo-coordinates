import type { GeoBounds, ViewCtx } from './geometry';
import type { LayerFlags } from './types';

/** Steps (in degrees) the adaptive grid picks from: 30°, 15°, 10°, 5°, 1°, 30′, 10′, 5′, 1′. */
export const AUTO_GRID_STEPS: readonly number[] = [30, 15, 10, 5, 1, 1 / 2, 1 / 6, 1 / 12, 1 / 60];
export const GRID_MIN_PX = 40;
export const GRID_MAX_PX = 120;

/**
 * The adaptive grid step for a map drawn at `pxPerDegree` CSS px per degree: a step whose lines are
 * 40–120 CSS px apart (the finest such step when several fit); when none fits — the list jumps from
 * 5° to 1° — the one closest to that range on a log scale.
 */
export function chooseGridStep(pxPerDegree: number): number {
  let best = AUTO_GRID_STEPS[0]!;
  let bestMiss = Infinity;
  for (const step of AUTO_GRID_STEPS) {
    const gap = step * pxPerDegree;
    const miss = gap < GRID_MIN_PX ? Math.log(GRID_MIN_PX / gap) : gap > GRID_MAX_PX ? Math.log(gap / GRID_MAX_PX) : 0;
    if (miss <= bestMiss) { best = step; bestMiss = miss; }
  }
  return best;
}

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
  return step === 'auto' ? chooseGridStep(pxPerDegreeAtCenter(ctx)) : step;
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
