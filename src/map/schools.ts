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
/** From this flat zoom (the globe: its flat equivalent) the cells shrink, so schools a street or two apart separate. */
export const SCHOOL_DEEP_ZOOM = 40;
export const SCHOOL_CELL_DEEP = 28;
/** The grid cell, in CSS px, at a flat(-equivalent) zoom. */
export const schoolCell = (zoom: number): number => (zoom >= SCHOOL_DEEP_ZOOM ? SCHOOL_CELL_DEEP : SCHOOL_CELL);
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

function flatWorldClusters(projection: FlatProjection, zoom: number, px: number, exclude: string | null): SchoolCluster[] {
  const key = `${projection}|${zoom}|${px}|${exclude ?? ''}`;
  const hit = flatCache.get(key);
  if (hit) return hit;
  const ref = makeFlatCtx(FLAT_W, FLAT_H, { lat: 0, lon: 0 }, zoom, px, projection);
  const schools = exclude ? SCHOOLS.filter((s) => s.id !== exclude) : SCHOOLS;
  const clusters = gridCluster(schools, (s) => ref.project(s), schoolCell(zoom) * px).map((c) => ({ key: c.members[0]!.id, ...c }));
  flatCache.set(key, clusters);
  if (flatCache.size > FLAT_CACHE_SIZE) flatCache.delete(flatCache.keys().next().value!);
  return clusters;
}

/**
 * The schools of a view grouped by screen distance, in the view's coordinates. Only groups within
 * `margin` view units of the view are returned (the flat map's drag slides a wider drawing). The
 * globe groups only the schools on its front side, afresh for every turn. `exclude` (the school
 * chosen from the list) is left out of every group: it is drawn on its own (`chosenSchoolMark`).
 */
export function clusterSchools(ctx: ViewCtx, exclude: string | null = null, margin = 400): SchoolCluster[] {
  const inView = (c: { x: number; y: number }) => c.x >= -margin && c.x <= ctx.width + margin && c.y >= -margin && c.y <= ctx.height + margin;
  if (ctx.kind === 'flat') {
    const origin = ctx.project({ lat: 0, lon: 0 });
    if (!origin) return [];
    const dx = origin[0] - FLAT_W / 2, dy = origin[1] - FLAT_H / 2;
    return flatWorldClusters(ctx.flatProjection ?? 'grid', ctx.zoom, ctx.px, exclude)
      .map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
      .filter(inView);
  }
  const schools = exclude ? SCHOOLS.filter((s) => s.id !== exclude) : SCHOOLS;
  return gridCluster(schools, (s) => ctx.project(s), schoolCell(ctx.zoom) * ctx.px)
    .map((c) => ({ key: c.members[0]!.id, ...c }))
    .filter(inView);
}

/** How far (CSS px) a group is drawn from the chosen school at least: clear of its ring and of the point's grab area on it. */
export const CHOSEN_CLEARANCE = 30;

/**
 * Groups drawn where the chosen school sits (often its city-level neighbours, at the very same spot)
 * are moved out from under it — away from it, or up and to the right when on top of it — so their
 * badge stays visible and clickable. Only where they are drawn changes, never who is in them.
 */
export function clearOfChosen(clusters: SchoolCluster[], chosen: { x: number; y: number } | null, px: number): SchoolCluster[] {
  if (!chosen) return clusters;
  const min = CHOSEN_CLEARANCE * px;
  const near = (c: SchoolCluster) => Math.hypot(c.x - chosen.x, c.y - chosen.y) < min;
  // Badges already in place (those not near the chosen school, then each one moved): a moved badge
  // turns round the chosen school, 40° at a time, until it is a badge's width from all of them.
  const placed: { x: number; y: number }[] = clusters.filter((c) => !near(c));
  const apart = min * 0.9;
  return clusters.map((c) => {
    if (!near(c)) return c;
    const dx = c.x - chosen.x, dy = c.y - chosen.y;
    const base = Math.hypot(dx, dy) > 0.5 * px ? Math.atan2(dy, dx) : -Math.PI / 4;
    let spot = { x: chosen.x + Math.cos(base) * min, y: chosen.y + Math.sin(base) * min };
    for (let k = 0; k < 9; k++) {
      const angle = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4.5);
      const at = { x: chosen.x + Math.cos(angle) * min, y: chosen.y + Math.sin(angle) * min };
      if (placed.every((p) => Math.hypot(p.x - at.x, p.y - at.y) >= apart)) { spot = at; break; }
    }
    placed.push(spot);
    return { ...c, ...spot };
  });
}

export function schoolById(id: string): School | undefined {
  return SCHOOLS.find((s) => s.id === id);
}

/** Where the school chosen from the list is drawn, or null when it is on the globe's far side (or unknown). */
export function chosenSchoolMark(ctx: ViewCtx, id: string | null): { x: number; y: number; school: School } | null {
  const school = id ? schoolById(id) : undefined;
  const xy = school ? ctx.project(school) : null;
  return school && xy ? { x: xy[0], y: xy[1], school } : null;
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

/**
 * The zoom (flat or flat-equivalent) at which the nearest school elsewhere is more than a cell's
 * diagonal away — the cell shrinks from `SCHOOL_DEEP_ZOOM`, so a zoom that deep only needs the room
 * of a small cell. `unitsAtZoom1` is that neighbour's distance in view units at zoom 1.
 */
function roomyZoom(unitsAtZoom1: number, px: number): number {
  if (!Number.isFinite(unitsAtZoom1) || unitsAtZoom1 <= 0) return 0;
  const coarse = (1.6 * SCHOOL_CELL * px) / unitsAtZoom1;
  return coarse < SCHOOL_DEEP_ZOOM ? coarse : Math.max(SCHOOL_DEEP_ZOOM, (1.6 * SCHOOL_CELL_DEEP * px) / unitsAtZoom1);
}

/**
 * How close the flat map zooms in on a school chosen from the list: where its neighbours elsewhere
 * no longer crowd it (distances grow in step with the zoom, so they are read off a zoom-1 view), at
 * least 6 (a region around it). The chosen school itself is always drawn alone and named.
 */
export function isolatingFlatZoom(school: School, projection: FlatProjection, px: number, maxZoom: number): number {
  const ref = makeFlatCtx(FLAT_W, FLAT_H, { lat: 0, lon: 0 }, 1, px, projection);
  const d = nearestOther(school, (a, b) => {
    const pa = ref.project(a), pb = ref.project(b);
    return pa && pb ? Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) : Infinity;
  }, SCHOOLS);
  return Math.min(maxZoom, Math.max(6, roomyZoom(d, px)));
}

/** The same for the globe (near the middle of the disc a radian is `radius × zoom` units; its flat equivalent is twice its zoom). At least 3. */
export function isolatingGlobeZoom(school: School, px: number, maxZoom: number): number {
  const d = nearestOther(school, (a, b) => geoDistance([a.lon, a.lat], [b.lon, b.lat]), SCHOOLS);
  // At globe zoom g the neighbour is GLOBE_RADIUS × g × d units away, and g is flat-equivalent zoom 2g.
  return Math.min(maxZoom, Math.max(3, roomyZoom((GLOBE_RADIUS * d) / 2, px) / 2));
}

export type ClusterClick = { kind: 'zoom'; center: LatLon; zoom: number } | { kind: 'list'; members: School[] };

/**
 * What a click on the badge with `key` (see Schools.svelte) does: zoom in on the group, or — when
 * that cannot pull it apart (all its schools share one spot, or the map is already as close as it
 * goes) — list its schools. Null when no such group is drawn. `exclude` is the chosen school, as drawn.
 */
export function clusterClick(ctx: ViewCtx, key: string, maxZoom: number, exclude: string | null = null): ClusterClick | null {
  const c = clusterSchools(ctx, exclude).find((x) => x.key === key && x.members.length > 1);
  if (!c) return null;
  const current = ctx.kind === 'flat' ? ctx.zoom : ctx.zoom / 2;
  const oneSpot = c.members.every((s) => sameSpot(s, c.members[0]!));
  const target = clusterZoomTarget(c.members, ctx, maxZoom);
  if (oneSpot || target.zoom <= current * (1 + 1e-9)) {
    const collator = new Intl.Collator();
    return { kind: 'list', members: [...c.members].sort((a, b) => collator.compare(a.name, b.name)) };
  }
  return { kind: 'zoom', ...target };
}
