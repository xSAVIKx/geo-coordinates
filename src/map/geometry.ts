import { geoCircle, geoDistance, geoEqualEarth, geoEquirectangular, geoOrthographic, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import type { LatLon } from '../geo/types';
import type { FlatProjection } from './types';

export interface ViewCtx {
  kind: 'flat' | 'globe';
  width: number;
  height: number;
  projection: GeoProjection;
  path: GeoPath;
  px: number;
  /** Map scale as a flat-map zoom factor (1 = whole world across the width); the globe reports its flat equivalent. */
  zoom: number;
  isVisible(p: LatLon): boolean;
  project(p: LatLon): [number, number] | null;
  invert(xy: [number, number]): LatLon | null;
}

export const TROPIC = 23.44;
export const POLAR = 66.56;
const RAD = Math.PI / 180;

export function parallelLine(lat: number, step = 2): GeoJSON.LineString {
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
  const projection =
    projectionKind === 'equal-earth'
      ? geoEqualEarth()
          .scale(geoEqualEarth().fitWidth(width, SPHERE).scale() * zoom)
          .translate([width / 2, height / 2])
          .center([center.lon, center.lat])
          .precision(0.5)
      : geoEquirectangular()
          .scale((width / (2 * Math.PI)) * zoom)
          .translate([width / 2, height / 2])
          .center([center.lon, center.lat])
          .precision(0.5);
  const path = geoPath(projection);
  return {
    kind: 'flat', width, height, projection, path, px, zoom,
    isVisible: () => true,
    project: (p) => projection([p.lon, p.lat]) as [number, number],
    invert: (xy) => {
      if (xy[0] < 0 || xy[0] > width || xy[1] < 0 || xy[1] > height) return null;
      return inRange(projection.invert?.(xy));
    },
  };
}

export function makeGlobeCtx(size: number, rotate: [number, number], px: number, zoom = 1): ViewCtx {
  const projection = geoOrthographic()
    .scale((size / 2 - 6) * zoom)
    .translate([size / 2, size / 2])
    .rotate(rotate)
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection);
  const centre: [number, number] = [-rotate[0], -rotate[1]];
  const isVisible = (p: LatLon) => geoDistance([p.lon, p.lat], centre) < Math.PI / 2 - 1e-6;
  return {
    kind: 'globe', width: size, height: size, projection, path, px, isVisible,
    // The whole globe disc spans 180° of longitude — about what a flat map shows at zoom 2.
    zoom: 2 * zoom,
    project: (p) => (isVisible(p) ? (projection([p.lon, p.lat]) as [number, number]) : null),
    invert: (xy) => {
      if (xy[0] < 0 || xy[0] > size || xy[1] < 0 || xy[1] > size) return null;
      const r = (size / 2 - 6) * zoom;
      if (Math.hypot(xy[0] - size / 2, xy[1] - size / 2) > r) return null;
      return inRange(projection.invert?.(xy));
    },
  };
}
export { RAD };
