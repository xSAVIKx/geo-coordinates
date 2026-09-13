import { geoCircle, geoDistance, geoEqualEarth, geoEquirectangular, geoIdentity, geoMercator, geoOrthographic, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import type { LatLon } from '../geo/types';
import type { FlatProjection } from './types';

const RAD = Math.PI / 180;

export interface ViewCtx {
  kind: 'flat' | 'globe';
  /** The flat map's projection (absent on the globe). */
  flatProjection?: FlatProjection;
  width: number;
  height: number;
  projection: GeoProjection;
  path: GeoPath;
  /**
   * A faster path generator for the dense Central Europe data (short segments, far from the
   * antimeridian): plain scaling on the grid map, no great-circle resampling elsewhere.
   */
  readonly regionPath: GeoPath;
  px: number;
  /** Map scale as a flat-map zoom factor (1 = whole world across the width); the globe reports its flat equivalent. */
  zoom: number;
  /** The geographic point at the middle of the view. */
  center: LatLon;
  /**
   * A lon/lat box that contains everything visible (conservative). `west`/`east` may run past ±180
   * on the globe; `east - west >= 360` means every longitude is visible.
   */
  bounds: GeoBounds;
  isVisible(p: LatLon): boolean;
  project(p: LatLon): [number, number] | null;
  invert(xy: [number, number]): LatLon | null;
}

export interface GeoBounds { west: number; south: number; east: number; north: number }
export const WORLD_BOUNDS: GeoBounds = { west: -180, south: -90, east: 180, north: 90 };

/** Extra room around the view that paths are still generated for (so clipped stroke ends stay out of sight). */
const CLIP_PAD = 24;

export const TROPIC = 23.44;
export const POLAR = 66.56;

// d3 draws every segment as a great-circle arc; a parallel is not one, so long segments bow towards
// the pole. 1° keeps that bow under a quarter of a map unit even at zoom 80.
export function parallelLine(lat: number, step = 1): GeoJSON.LineString {
  const coordinates: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += step) coordinates.push([lon, lat]);
  return { type: 'LineString', coordinates };
}

export function meridianLine(lon: number, step = 2, fromLat = -90, toLat = 90): GeoJSON.LineString {
  const coordinates: [number, number][] = [];
  const dir = toLat >= fromLat ? 1 : -1;
  for (let lat = fromLat; dir > 0 ? lat < toLat : lat > toLat; lat += step * dir) coordinates.push([lon, lat]);
  coordinates.push([lon, toLat]);
  return { type: 'LineString', coordinates };
}

const CENTERS: Record<'N' | 'S' | 'E' | 'W', [number, number]> = { N: [0, 90], S: [0, -90], E: [90, 0], W: [-90, 0] };
export function hemisphere(region: 'N' | 'S' | 'E' | 'W'): GeoJSON.Polygon {
  return geoCircle().center(CENTERS[region]).radius(90).precision(2)();
}

function inRange(ll: [number, number] | null | undefined): LatLon | null {
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
  const [lon, lat] = ll;
  if (Math.abs(lat) > 90 + 1e-9 || Math.abs(lon) > 180 + 1e-9) return null;
  return { lat, lon };
}

const SPHERE = { type: 'Sphere' } as const;

/** Mercator stretches without end towards the poles, so its map stops at ±85° (as map apps do). */
export const MERCATOR_MAX_LAT = 85;
/** Mercator's y (in radians of the equator) for a latitude. */
export const mercatorY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
/** The latitude at Mercator y (inverse of `mercatorY`). */
export const mercatorLat = (y: number): number => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
const MERCATOR_Y_MAX = mercatorY(MERCATOR_MAX_LAT);

/*
 * Flat views are 2:1 (960 × 480) and every projection is scaled so zoom 1 spans the view's width
 * with the whole world. On the grid map and Equal Earth that already shows all of it; Mercator's
 * world (±85°) is almost square, so at zoom 1 only ±66.5° fits in the height — it can zoom out to
 * about 0.5, where the whole of it fits (with open sea on both sides).
 */

/** Half the view's height at `zoom`, in Mercator y (the view is 2:1; the scale is width / 2π × zoom). */
const mercatorHalfHeight = (zoom: number): number => Math.PI / (2 * zoom);

/** The smallest flat zoom for a projection: the whole world in view. */
export function flatMinZoom(projection: FlatProjection): number {
  return projection === 'mercator' ? Math.PI / (2 * MERCATOR_Y_MAX) : 1;
}

/** A flat view's centre moved as little as possible so the view stays inside the projected world. */
export function clampFlatCenter(c: LatLon, zoom: number, projection: FlatProjection): LatLon {
  const halfLon = 180 / zoom;
  const lon = Math.max(-180 + halfLon, Math.min(180 - halfLon, c.lon));
  if (projection === 'mercator') {
    const room = MERCATOR_Y_MAX - mercatorHalfHeight(zoom);
    const y = room <= 1e-9 ? 0 : Math.max(-room, Math.min(room, mercatorY(Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, c.lat)))));
    return { lat: mercatorLat(y) + 0, lon: halfLon >= 180 ? 0 : lon };
  }
  const halfLat = 90 / zoom;
  return { lat: Math.max(-90 + halfLat, Math.min(90 - halfLat, c.lat)), lon };
}

/**
 * A flat view's centre after dragging the map by (dx, dy) view units of a 960-wide view (dy > 0
 * moves the view north). Longitude and, on the grid map and Equal Earth, latitude move by a fixed
 * number of degrees per unit; on Mercator latitude moves in its stretched y, so the map follows the
 * pointer near the poles too. The result is clamped to the world.
 */
export function panFlatCenter(c: LatLon, zoom: number, projection: FlatProjection, dx: number, dy: number): LatLon {
  const degPerUnit = 360 / (960 * zoom);
  const lon = c.lon - dx * degPerUnit;
  const lat = projection === 'mercator'
    ? mercatorLat(mercatorY(Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, c.lat))) + (dy * 2 * Math.PI) / (960 * zoom))
    : c.lat + dy * degPerUnit;
  return clampFlatCenter({ lat, lon }, zoom, projection);
}

export function makeFlatCtx(width: number, height: number, center: LatLon, zoom: number, px: number, projectionKind: FlatProjection = 'grid'): ViewCtx {
  const clip: [[number, number], [number, number]] = [[-CLIP_PAD, -CLIP_PAD], [width + CLIP_PAD, height + CLIP_PAD]];
  const build = (precision: number) => {
    const p = (projectionKind === 'equal-earth'
      ? geoEqualEarth().scale(geoEqualEarth().fitWidth(width, SPHERE).scale() * zoom)
      : (projectionKind === 'mercator' ? geoMercator() : geoEquirectangular()).scale((width / (2 * Math.PI)) * zoom))
      .translate([width / 2, height / 2])
      .center([center.lon, center.lat])
      .precision(precision)
      // Only what can be seen is turned into SVG path data — at zoom 80 the world is 77 000 px wide.
      .clipExtent(clip);
    if (projectionKind === 'mercator') {
      // d3 clips Mercator to the world's width only; cut it off at ±85° too.
      const top = p([center.lon, MERCATOR_MAX_LAT])![1], bottom = p([center.lon, -MERCATOR_MAX_LAT])![1];
      p.clipExtent([[clip[0][0], Math.max(clip[0][1], top)], [clip[1][0], Math.min(clip[1][1], bottom)]]);
    }
    return p;
  };
  const projection = build(0.5);
  const maxLat = projectionKind === 'mercator' ? MERCATOR_MAX_LAT : 90;
  const path = geoPath(projection);
  let regionPath: GeoPath | null = null;
  const makeRegionPath = (): GeoPath => {
    if (projectionKind !== 'grid') return geoPath(build(0)).digits(1);
    // The grid map is equirectangular: x and y are just scaled longitude and latitude.
    const k = ((width / (2 * Math.PI)) * zoom * Math.PI) / 180;
    // One decimal (a tenth of a map unit) is plenty for these thousands of short segments.
    return geoPath(geoIdentity().reflectY(true).scale(k).translate([width / 2 - k * center.lon, height / 2 + k * center.lat]).clipExtent(clip)).digits(1);
  };
  const invert = (xy: [number, number]): LatLon | null => {
    if (xy[0] < 0 || xy[0] > width || xy[1] < 0 || xy[1] > height) return null;
    const ll = inRange(projection.invert?.(xy));
    if (!ll || projectionKind !== 'mercator') return ll;
    if (Math.abs(ll.lat) > maxLat + 1e-9) return null;
    // Zoomed out, Mercator's world is narrower than the view and d3 wraps the sea beside it round
    // to a longitude inside the world: only a point that projects back to where it came from is on the map.
    const back = projection([ll.lon, ll.lat]);
    return back && Math.abs(back[0] - xy[0]) < 0.01 ? ll : null;
  };
  return {
    kind: 'flat', flatProjection: projectionKind, width, height, projection, path, px, zoom, center,
    get regionPath() { return (regionPath ??= makeRegionPath()); },
    bounds: projectionKind === 'grid' ? gridBounds(center, zoom) : projectionKind === 'mercator' ? mercatorBounds(center, zoom) : sampledBounds(invert, width, height),
    isVisible: () => true,
    // Mercator has no place for latitudes beyond ±85° (the poles are infinitely far away).
    project: (p) => (Math.abs(p.lat) > maxLat + 1e-9 ? null : (projection([p.lon, p.lat]) as [number, number])),
    invert,
  };
}

function gridBounds(center: LatLon, zoom: number): GeoBounds {
  const halfLat = 90 / zoom, halfLon = 180 / zoom;
  return {
    west: Math.max(-180, center.lon - halfLon), east: Math.min(180, center.lon + halfLon),
    south: Math.max(-90, center.lat - halfLat), north: Math.min(90, center.lat + halfLat),
  };
}

/** The exact visible box of a Mercator view, within ±85°. */
function mercatorBounds(center: LatLon, zoom: number): GeoBounds {
  const halfLon = 180 / zoom;
  const y = mercatorY(Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, center.lat))), half = mercatorHalfHeight(zoom);
  return {
    west: Math.max(-180, center.lon - halfLon), east: Math.min(180, center.lon + halfLon),
    south: Math.max(-MERCATOR_MAX_LAT, mercatorLat(y - half)), north: Math.min(MERCATOR_MAX_LAT, mercatorLat(y + half)),
  };
}

/** Bounds from inverting a grid of view points; any point off the map (outside the world outline) means the whole world. */
function sampledBounds(invert: (xy: [number, number]) => LatLon | null, width: number, height: number): GeoBounds {
  const N = 8;
  const b = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const ll = invert([(width * i) / N, (height * j) / N]);
      if (!ll) return WORLD_BOUNDS;
      b.west = Math.min(b.west, ll.lon); b.east = Math.max(b.east, ll.lon);
      b.south = Math.min(b.south, ll.lat); b.north = Math.max(b.north, ll.lat);
    }
  }
  // Meridians and parallels curve between the samples: pad by one sample cell.
  const padLon = (b.east - b.west) / N, padLat = (b.north - b.south) / N;
  return {
    west: Math.max(-180, b.west - padLon), east: Math.min(180, b.east + padLon),
    south: Math.max(-90, b.south - padLat), north: Math.min(90, b.north + padLat),
  };
}

export function makeGlobeCtx(size: number, rotate: [number, number], px: number, zoom = 1): ViewCtx {
  const radius = (size / 2 - 6) * zoom;
  const build = (precision: number) => geoOrthographic()
    .scale(radius)
    .translate([size / 2, size / 2])
    .rotate(rotate)
    .clipAngle(90)
    .precision(precision)
    .clipExtent([[-CLIP_PAD, -CLIP_PAD], [size + CLIP_PAD, size + CLIP_PAD]]);
  const projection = build(0.5);
  const path = geoPath(projection);
  let regionPath: GeoPath | null = null;
  const centre: [number, number] = [-rotate[0], -rotate[1]];
  const isVisible = (p: LatLon) => geoDistance([p.lon, p.lat], centre) < Math.PI / 2 - 1e-6;
  return {
    kind: 'globe', width: size, height: size, projection, path, px, isVisible,
    get regionPath() { return (regionPath ??= geoPath(build(0)).digits(1)); },
    // The whole globe disc spans 180° of longitude — about what a flat map shows at zoom 2.
    zoom: 2 * zoom,
    center: { lat: centre[1], lon: centre[0] },
    bounds: globeBounds({ lat: centre[1], lon: centre[0] }, radius, size),
    project: (p) => (isVisible(p) ? (projection([p.lon, p.lat]) as [number, number]) : null),
    invert: (xy) => {
      if (xy[0] < 0 || xy[0] > size || xy[1] < 0 || xy[1] > size) return null;
      if (Math.hypot(xy[0] - size / 2, xy[1] - size / 2) > radius) return null;
      return inRange(projection.invert?.(xy));
    },
  };
}

/** Everything within the angular radius that the view's half-diagonal reaches on the sphere. */
function globeBounds(c: LatLon, radius: number, size: number): GeoBounds {
  const halfDiagonal = (size / 2) * Math.SQRT2 + CLIP_PAD;
  const rho = halfDiagonal >= radius ? 90 : Math.asin(halfDiagonal / radius) / RAD;
  const south = c.lat - rho, north = c.lat + rho;
  if (south <= -90 || north >= 90) return { west: -180, east: 180, south: Math.max(-90, south), north: Math.min(90, north) };
  const s = Math.sin(rho * RAD) / Math.cos(c.lat * RAD);
  const dLon = s >= 1 ? 180 : Math.asin(s) / RAD;
  return { west: c.lon - dLon, east: c.lon + dLon, south, north };
}

/** Whether two boxes overlap, trying the ±360° copies of `a` so a globe view across the antimeridian still matches. */
export function boundsIntersect(a: GeoBounds, b: GeoBounds): boolean {
  if (a.south > b.north || b.south > a.north) return false;
  if (a.east - a.west >= 360 || b.east - b.west >= 360) return true;
  return [-360, 0, 360].some((k) => a.west + k <= b.east && b.west <= a.east + k);
}

export { RAD };
