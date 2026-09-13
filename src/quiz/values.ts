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

/**
 * A flat-map view that shows every point with room for a difference bracket: beside the points
 * (`'side'`, used for latitude brackets) or above them (`'top'`, longitude brackets). Whole-degree centre,
 * zoom in half steps between 1 and 5. The view is worked out for the grid map, so scenes using it force `flatProjection: 'grid'`.
 */
export function fitFlatView(points: readonly LatLon[], bracket: 'side' | 'top'): { center: LatLon; zoom: number } {
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const latSpan = Math.max(...lats) - Math.min(...lats), lonSpan = Math.max(...lons) - Math.min(...lons);
  const raw = Math.min(180 / (latSpan + (bracket === 'top' ? 60 : 40)), 360 / (lonSpan + (bracket === 'side' ? 150 : 80)));
  const zoom = Math.max(1, Math.min(5, Math.floor(raw * 2) / 2));
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2, midLon = (Math.max(...lons) + Math.min(...lons)) / 2;
  const center = {
    lat: Math.round(midLat + (bracket === 'top' ? (180 / zoom) * 0.08 : 0)),
    // East of 0° the points go right of centre (bracket on their left), west of 0° left of centre (bracket on their right),
    // so the shift never runs into the edge of the map.
    lon: Math.round(midLon - (bracket === 'side' ? Math.sign(midLon || 1) * (360 / zoom) * 0.2 : 0)),
  };
  return { center, zoom };
}
