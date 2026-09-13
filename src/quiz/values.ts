import type { LatLon } from '../geo/types';
import type { MarkerTone } from '../map/types';
import type { Rng } from './types';

export const LABELS = ['A', 'B', 'C', 'D'] as const;
export const TONES: MarkerTone[] = ['a', 'b', 'c', 'd'];

export function gridInt(rng: Rng, min: number, max: number, step: number): number {
  return rng.int(Math.ceil(min / step), Math.floor(max / step)) * step;
}

export function signed(rng: Rng): 1 | -1 {
  return rng.next() < 0.5 ? 1 : -1;
}

export function withMinutes(deg: number, minutes: number): number {
  const s = deg < 0 ? -1 : 1;
  return s * (Math.abs(deg) + minutes / 60);
}

// Room around the points, in degrees at zoom 1 (a zoom-1 grid map is 360° × 180° over 960 × 480 units, so at zoom z this room
// shrinks to room / z degrees but stays the same size on screen). Sized for a phone (1 CSS px ≈ 2.56 units): marker labels and the
// edge-label rows above and below; beside the points the bracket with its numbers ('side'), or above them its two rows ('top').
const ROOM = { side: { lat: 70, lon: 230 }, top: { lat: 130, lon: 80 } } as const;
export const MAX_FIT_ZOOM = 12; // MapState's MAX_ZOOM

/**
 * A flat-map view that shows every point with room for a difference bracket: beside the points
 * (`'side'`, used for latitude brackets) or above them (`'top'`, longitude brackets). The zoom is the largest that still fits,
 * in half steps from 1 to 12, so points a few degrees apart are drawn well apart. Whole-degree centre. The view is worked out
 * for the grid map, so scenes using it force `flatProjection: 'grid'`.
 */
export function fitFlatView(points: readonly LatLon[], bracket: 'side' | 'top'): { center: LatLon; zoom: number } {
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const latSpan = Math.max(...lats) - Math.min(...lats), lonSpan = Math.max(...lons) - Math.min(...lons);
  const room = ROOM[bracket];
  // Fits when span + room / z ≤ visible span (180 / z or 360 / z), i.e. z ≤ (visible − room) / span.
  const raw = Math.min(latSpan > 0 ? (180 - room.lat) / latSpan : Infinity, lonSpan > 0 ? (360 - room.lon) / lonSpan : Infinity);
  const zoom = Math.max(1, Math.min(MAX_FIT_ZOOM, Math.floor(raw * 2) / 2));
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2, midLon = (Math.max(...lons) + Math.min(...lons)) / 2;
  const center = {
    lat: Math.round(midLat + (bracket === 'top' ? (180 / zoom) * 0.08 : 0)),
    // East of 0° the points go right of centre (bracket on their left), west of 0° left of centre (bracket on their right),
    // so the shift never runs into the edge of the map.
    lon: Math.round(midLon - (bracket === 'side' ? Math.sign(midLon || 1) * (360 / zoom) * 0.2 : 0)),
  };
  return { center, zoom };
}

/** Grid lines that stay readable at a fitted zoom. */
export function gridStepFor(zoom: number): 1 | 5 | 10 {
  return zoom >= 6 ? 1 : zoom >= 2.5 ? 5 : 10;
}
