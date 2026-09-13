import { geoDistance } from 'd3-geo';
import { retrieved, schools as slim } from 'virtual:maple-bear-schools';
import type { LatLon } from '../geo/types';
import { makeFlatCtx, type ViewCtx } from './geometry';
import { gridCluster } from './gridCluster';
import type { FlatProjection } from './types';

// Maple Bear schools (Task 23b). The data is src/map/data/maple-bear-schools.json, bundled slim
// (id, name, country, position) by scripts/schools-plugin.ts. Locations are approximate.

export interface School { id: string; name: string; country: string; lat: number; lon: number }

export const SCHOOLS: readonly School[] = slim.map(([id, name, country, lat, lon]) => ({ id, name, country, lat, lon }));
export const SCHOOLS_RETRIEVED = retrieved;

/** Schools closer than this many CSS px (one grid cell) share a count badge. */
export const SCHOOL_CELL = 44;
/** A count badge's height and width, in CSS px (Schools.svelte draws it, Places.svelte keeps names off it). */
export const SCHOOL_BADGE_H = 20;
export const schoolBadgeWidth = (count: number): number => Math.max(SCHOOL_BADGE_H + 2, 10 + 7.5 * String(count).length);

export interface SchoolCluster {
  /** The first member's id: stable while the group stays the same. */
  key: string;
  x: number;
  y: number;
  members: School[];
}

const FLAT_W = 960, FLAT_H = 480;
const GLOBE_SIZE = 500, GLOBE_RADIUS = GLOBE_SIZE / 2 - 6;

// Flat maps: a projection's `center()` only shifts the picture, so schools are clustered once per
// zoom, projection and pixel size in the coordinates of a view centred on 0°, 0° — the grouping is
// the same wherever the view is panned — and each view just adds its own shift. A handful of recent
// groupings is kept, so zooming back and forth does not redo them either.
const flatCache = new Map<string, SchoolCluster[]>();
const FLAT_CACHE_SIZE = 8;

function flatWorldClusters(projection: FlatProjection, zoom: number, px: number, schools: readonly School[]): SchoolCluster[] {
  const key = `${projection}|${zoom}|${px}`;
  const hit = schools === SCHOOLS ? flatCache.get(key) : undefined;
  if (hit) return hit;
  const ref = makeFlatCtx(FLAT_W, FLAT_H, { lat: 0, lon: 0 }, zoom, px, projection);
  const clusters = gridCluster(schools, (s) => ref.project(s), SCHOOL_CELL * px).map((c) => ({ key: c.members[0]!.id, ...c }));
  if (schools === SCHOOLS) {
    flatCache.set(key, clusters);
    if (flatCache.size > FLAT_CACHE_SIZE) flatCache.delete(flatCache.keys().next().value!);
  }
  return clusters;
}

/**
 * The schools of a view grouped by screen distance, in the view's coordinates. Only groups within
 * `margin` view units of the view are returned (the flat map's drag slides a wider drawing). The
 * globe groups only the schools on its front side, afresh for every turn.
 */
export function clusterSchools(ctx: ViewCtx, schools: readonly School[] = SCHOOLS, margin = 400): SchoolCluster[] {
  const inView = (c: { x: number; y: number }) => c.x >= -margin && c.x <= ctx.width + margin && c.y >= -margin && c.y <= ctx.height + margin;
  if (ctx.kind === 'flat') {
    const origin = ctx.project({ lat: 0, lon: 0 });
    if (!origin) return [];
    const dx = origin[0] - FLAT_W / 2, dy = origin[1] - FLAT_H / 2;
    return flatWorldClusters(ctx.flatProjection ?? 'grid', ctx.zoom, ctx.px, schools)
      .map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
      .filter(inView);
  }
  return gridCluster(schools, (s) => ctx.project(s), SCHOOL_CELL * ctx.px)
    .map((c) => ({ key: c.members[0]!.id, ...c }))
    .filter(inView);
}

const sameSpot = (a: LatLon, b: LatLon) => Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;

/** The middle of a group's bounding box. */
function boxCentre(members: readonly School[]): LatLon {
  const lats = members.map((s) => s.lat), lons = members.map((s) => s.lon);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
}

/**
 * Where a click on a group takes the map: its middle, zoomed in so the group fills about half the
 * view — at least twice, at most eight times as close as now, and never past `maxZoom`.
 */
export function clusterZoomTarget(members: readonly School[], ctx: ViewCtx, maxZoom: number): { center: LatLon; zoom: number } {
  const center = boxCentre(members);
  if (ctx.kind === 'flat') {
    const ref = makeFlatCtx(FLAT_W, FLAT_H, { lat: 0, lon: 0 }, 1, ctx.px, ctx.flatProjection ?? 'grid');
    const xy = members.map((s) => ref.project(s)).filter((p): p is [number, number] => p !== null);
    const spanX = Math.max(...xy.map((p) => p[0])) - Math.min(...xy.map((p) => p[0]));
    const spanY = Math.max(...xy.map((p) => p[1])) - Math.min(...xy.map((p) => p[1]));
    const fit = Math.min(spanX > 0 ? (FLAT_W * 0.5) / spanX : Infinity, spanY > 0 ? (FLAT_H * 0.5) / spanY : Infinity);
    return { center, zoom: Math.min(maxZoom, Math.max(ctx.zoom * 2, Math.min(fit, ctx.zoom * 8))) };
  }
  const globeZoom = ctx.zoom / 2;
  const rho = Math.max(...members.map((s) => geoDistance([center.lon, center.lat], [s.lon, s.lat])));
  const fit = rho > 0 ? (GLOBE_SIZE * 0.3) / (GLOBE_RADIUS * rho) : Infinity;
  return { center, zoom: Math.min(maxZoom, Math.max(globeZoom * 2, Math.min(fit, globeZoom * 8))) };
}

/** The nearest other school that is not at the very same spot (city-level entries often share one). */
function nearestOther(school: School, distance: (a: School, b: School) => number, schools: readonly School[]): number {
  let best = Infinity;
  for (const s of schools) {
    if (s.id === school.id || sameSpot(s, school)) continue;
    best = Math.min(best, distance(school, s));
  }
  return best;
}

/** Room around a chosen school: more than a grid cell's diagonal to its nearest neighbour, so it stands alone. */
const ISOLATE = 1.6 * SCHOOL_CELL;

/**
 * The flat-map zoom at which `school` no longer shares a badge with a school elsewhere: distances
 * grow in step with the zoom, so it is read off a zoom-1 view. At least 6 (a region around it).
 */
export function isolatingFlatZoom(school: School, projection: FlatProjection, px: number, maxZoom: number, schools: readonly School[] = SCHOOLS): number {
  const ref = makeFlatCtx(FLAT_W, FLAT_H, { lat: 0, lon: 0 }, 1, px, projection);
  const d = nearestOther(school, (a, b) => {
    const pa = ref.project(a), pb = ref.project(b);
    return pa && pb ? Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) : Infinity;
  }, schools);
  return Math.min(maxZoom, Math.max(6, Number.isFinite(d) ? (ISOLATE * px) / d : 6));
}

/** The same for the globe (near the middle of the disc a radian is `radius × zoom` units). At least 3. */
export function isolatingGlobeZoom(school: School, px: number, maxZoom: number, schools: readonly School[] = SCHOOLS): number {
  const d = nearestOther(school, (a, b) => geoDistance([a.lon, a.lat], [b.lon, b.lat]), schools);
  return Math.min(maxZoom, Math.max(3, Number.isFinite(d) ? (ISOLATE * px) / (GLOBE_RADIUS * d) : 3));
}

/** Where a click on the badge with `key` (see Schools.svelte) takes the view, or null when no such group is drawn. */
export function clusterTargetByKey(ctx: ViewCtx, key: string, maxZoom: number): { center: LatLon; zoom: number } | null {
  const c = clusterSchools(ctx).find((x) => x.key === key && x.members.length > 1);
  return c ? clusterZoomTarget(c.members, ctx, maxZoom) : null;
}
