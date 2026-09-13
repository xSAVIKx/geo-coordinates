import { geoCircle, geoDistance, geoEqualEarth, geoEquirectangular, geoIdentity, geoOrthographic, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import type { LatLon } from '../geo/types';
import type { FlatProjection } from './types';

const RAD = Math.PI / 180;

export interface ViewCtx {
  kind: 'flat' | 'globe';
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

export function makeFlatCtx(width: number, height: number, center: LatLon, zoom: number, px: number, projectionKind: FlatProjection = 'grid'): ViewCtx {
  const clip: [[number, number], [number, number]] = [[-CLIP_PAD, -CLIP_PAD], [width + CLIP_PAD, height + CLIP_PAD]];
  const build = (precision: number) =>
    (projectionKind === 'equal-earth'
      ? geoEqualEarth().scale(geoEqualEarth().fitWidth(width, SPHERE).scale() * zoom)
      : geoEquirectangular().scale((width / (2 * Math.PI)) * zoom))
      .translate([width / 2, height / 2])
      .center([center.lon, center.lat])
      .precision(precision)
      // Only what can be seen is turned into SVG path data — at zoom 80 the world is 77 000 px wide.
      .clipExtent(clip);
  const projection = build(0.5);
  const path = geoPath(projection);
  let regionPath: GeoPath | null = null;
  const makeRegionPath = (): GeoPath => {
    if (projectionKind === 'equal-earth') return geoPath(build(0)).digits(1);
    // The grid map is equirectangular: x and y are just scaled longitude and latitude.
    const k = ((width / (2 * Math.PI)) * zoom * Math.PI) / 180;
    // One decimal (a tenth of a map unit) is plenty for these thousands of short segments.
    return geoPath(geoIdentity().reflectY(true).scale(k).translate([width / 2 - k * center.lon, height / 2 + k * center.lat]).clipExtent(clip)).digits(1);
  };
  const invert = (xy: [number, number]): LatLon | null => {
    if (xy[0] < 0 || xy[0] > width || xy[1] < 0 || xy[1] > height) return null;
    return inRange(projection.invert?.(xy));
  };
  return {
    kind: 'flat', width, height, projection, path, px, zoom, center,
    get regionPath() { return (regionPath ??= makeRegionPath()); },
    bounds: projectionKind === 'grid' ? gridBounds(center, zoom) : sampledBounds(invert, width, height),
    isVisible: () => true,
    project: (p) => projection([p.lon, p.lat]) as [number, number],
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
