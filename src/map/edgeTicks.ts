import type { LatLon } from '../geo/types';
import type { ViewCtx } from './geometry';

export interface LatTick { value: number; y: number }
export interface LonTick { value: number; x: number }
export interface EdgeTicks {
  lats: LatTick[];
  lons: LonTick[];
  bottomLat: number; // lowest visible latitude — where longitude labels are anchored
}

const MIN_GAP_PX = 34;

/**
 * Multiples of `step` within `[min, max]` (0 included when visible), counted as whole multiples so
 * minute steps such as 1/60 don't pile up rounding error (50.25 stays 50.25, not 50.250000001).
 */
export function candidateValues(step: number, min: number, max: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9), last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last; k++) out.push(Math.round(k * step * 1e9) / 1e9 + 0);
  return out;
}

/**
 * Greedily keeps candidates that are >= minGap apart in projected position, walking outward from
 * the candidate closest to 0 (the equator / prime meridian) in both directions independently.
 * This is projection-agnostic: it measures real projected distance rather than assuming a fixed
 * degrees-per-pixel ratio, which is wrong near the poles in curved projections like Equal Earth.
 */
function greedyKeep<T extends { value: number; pos: number }>(items: T[], minGap: number): T[] {
  if (items.length === 0) return [];
  let anchor = 0;
  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i]!.value) < Math.abs(items[anchor]!.value)) anchor = i;
  }
  const kept: T[] = [items[anchor]!];
  let last = items[anchor]!.pos;
  for (let i = anchor + 1; i < items.length; i++) {
    if (Math.abs(items[i]!.pos - last) >= minGap) {
      kept.push(items[i]!);
      last = items[i]!.pos;
    }
  }
  last = items[anchor]!.pos;
  for (let i = anchor - 1; i >= 0; i--) {
    if (Math.abs(items[i]!.pos - last) >= minGap) {
      kept.push(items[i]!);
      last = items[i]!.pos;
    }
  }
  return kept.sort((a, b) => a.value - b.value);
}

/**
 * Latitude/longitude tick values for the flat map's edge labels, spaced so adjacent labels are
 * always >= 34 CSS px apart in real projected pixels — works for any flat projection, including
 * Equal Earth where the same span of degrees covers far fewer pixels near the poles.
 */
export function edgeTicks(ctx: ViewCtx, center: LatLon, zoom: number, graticuleStep: number): EdgeTicks {
  const halfLat = 90 / zoom, halfLon = 180 / zoom;
  // Mercator stretches latitude, so its visible span comes from the view's exact bounds (within ±85°).
  const mercator = ctx.flatProjection === 'mercator';
  const latMin = mercator ? ctx.bounds.south : Math.max(-90, center.lat - halfLat);
  const latMax = mercator ? ctx.bounds.north : Math.min(90, center.lat + halfLat);
  const lonMin = Math.max(-180, center.lon - halfLon), lonMax = Math.min(180, center.lon + halfLon);
  const bottomLat = latMin;
  const minGap = MIN_GAP_PX * ctx.px;

  const latItems = candidateValues(graticuleStep, latMin, latMax)
    .filter((value) => Math.abs(value) < 90) // the pole projects to a line, not a single label position
    .map((value) => ({ value, xy: ctx.project({ lat: value, lon: center.lon }) }))
    .filter((t): t is { value: number; xy: [number, number] } => t.xy !== null)
    .map((t) => ({ value: t.value, pos: t.xy[1] }));
  const lats = greedyKeep(latItems, minGap).map(({ value, pos }) => ({ value, y: pos }));

  // Longitude labels are projected at the lowest visible latitude, so they sit under their
  // meridian even when it curves (Equal Earth) rather than under the map's centre latitude.
  const lonItems = candidateValues(graticuleStep, lonMin, lonMax)
    .map((value) => ({ value, xy: ctx.project({ lat: bottomLat, lon: value }) }))
    .filter((t): t is { value: number; xy: [number, number] } => t.xy !== null)
    .map((t) => ({ value: t.value, pos: t.xy[0] }));
  const lons = greedyKeep(lonItems, minGap).map(({ value, pos }) => ({ value, x: pos }));

  return { lats, lons, bottomLat };
}
