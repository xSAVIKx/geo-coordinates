import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import topoJson from 'world-atlas/countries-110m.json';
import bordersJson from './data/world-borders-pol.json';
import regionJson from './data/central-europe.json';
import { boundsIntersect, type GeoBounds } from './geometry';

const topo = topoJson as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
// Borders are not world-atlas's (Natural Earth "de facto": Crimea inside Russia) but Natural Earth's Poland
// point of view, Ukraine's internationally recognised borders (scripts/build-world-borders.ts).
const bordersTopo = bordersJson as unknown as Topology<{ countries: GeometryCollection }>;

export const land = feature(topo, topo.objects.land);
export const borders = mesh(bordersTopo, bordersTopo.objects.countries, (a, b) => a !== b);
export const sphere = { type: 'Sphere' } as const;

// ---------------------------------------------------------------------------------------------
// Level of detail. Below zoom 4 (and outside Central Europe) the world 110m data (above) is all
// there is. From zoom 4, when the view reaches the region box, Natural Earth 10m data
// (scripts/build-regional-data.ts) is drawn over it: a sea-coloured box hides the coarse land
// there, then detailed land, lakes, coastlines and borders. Voivodeships and rivers join at zoom 6.
// ---------------------------------------------------------------------------------------------

type RegionObjects = { land: GeometryCollection; lakes: GeometryCollection; coast: GeometryCollection; borders: GeometryCollection; voivodeships: GeometryCollection; rivers: GeometryCollection };
const regionTopo = regionJson as unknown as Topology<RegionObjects> & { region: GeoBounds };

export const REGION: GeoBounds = regionTopo.region;
export const REGION_MIN_ZOOM = 4;
export const REGION_DETAIL_ZOOM = 6;

/** The region box as a d3 polygon, its edges densified so they follow parallels and meridians on every projection. */
function boxPolygon(b: GeoBounds, step = 0.25): GeoJSON.Polygon {
  const ring: [number, number][] = [];
  for (let x = b.west; x < b.east; x += step) ring.push([x, b.north]);
  for (let y = b.north; y > b.south; y -= step) ring.push([b.east, y]);
  for (let x = b.east; x > b.west; x -= step) ring.push([x, b.south]);
  for (let y = b.south; y < b.north; y += step) ring.push([b.west, y]);
  ring.push([b.west, b.north]);
  return { type: 'Polygon', coordinates: [ring] }; // clockwise: d3's exterior ring
}

export interface Part<T> { bounds: GeoBounds; coordinates: T }
export function boundsOf(points: GeoJSON.Position[]): GeoBounds {
  const b = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const [x, y] of points) {
    b.west = Math.min(b.west, x!); b.east = Math.max(b.east, x!);
    b.south = Math.min(b.south, y!); b.north = Math.max(b.north, y!);
  }
  return b;
}
/** Lines are cut into short runs (sharing their end vertex) so a view only draws the runs it can see. */
const LINE_CHUNK = 48;
export const lineParts = (g: GeoJSON.MultiLineString): Part<GeoJSON.Position[]>[] =>
  g.coordinates.flatMap((c) => {
    const out: Part<GeoJSON.Position[]>[] = [];
    for (let i = 0; i < c.length - 1; i += LINE_CHUNK) {
      const run = c.slice(i, i + LINE_CHUNK + 1);
      out.push({ bounds: boundsOf(run), coordinates: run });
    }
    return out;
  });
/** Twice a ring's signed planar area (the shoelace sum), zero once thinning has flattened the ring onto a line. */
function ringArea2(ring: GeoJSON.Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j]![0]! * ring[i]![1]! - ring[i]![0]! * ring[j]![1]!;
  return sum;
}
/**
 * A ring the way d3 wants it, or null when thinning has left nothing to draw. On the sphere d3 reads a ring by the
 * way it is wound — an outline clockwise (negative above), a hole the other way — and takes anything else to mean
 * "all of the sphere but this". Dropping vertices can flatten a small ring onto a line or turn what is left of it
 * the other way round, and one islet of Norway and one of Greenland, simplified at the coarsest Political level,
 * used to paint the whole map their country's colour. Such a ring is turned back, or dropped if it has no area.
 */
function oriented(ring: GeoJSON.Position[], outline: boolean): GeoJSON.Position[] | null {
  if (ring.length < 4) return null;
  const area = ringArea2(ring);
  if (area === 0) return null;
  return area < 0 === outline ? ring : [...ring].reverse();
}
/** A filled shape's parts, one per polygon, each with its outline first and its holes after it. */
export const polygonParts = (g: GeoJSON.MultiPolygon): Part<GeoJSON.Position[][]>[] =>
  g.coordinates.flatMap((rings) => {
    const outline = oriented(rings[0]!, true);
    if (!outline) return [];
    const holes = rings.slice(1).map((r) => oriented(r, false)).filter((r): r is GeoJSON.Position[] => r !== null);
    return [{ bounds: boundsOf(outline), coordinates: [outline, ...holes] }];
  });
export function asMultiPolygon(fc: GeoJSON.Feature | GeoJSON.FeatureCollection): GeoJSON.MultiPolygon {
  const features = fc.type === 'FeatureCollection' ? fc.features : [fc];
  const coordinates = features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []));
  return { type: 'MultiPolygon', coordinates };
}

interface RegionData {
  land: Part<GeoJSON.Position[][]>[];
  lakes: Part<GeoJSON.Position[][]>[];
  coast: Part<GeoJSON.Position[]>[];
  borders: Part<GeoJSON.Position[]>[];
  voivodeships: Part<GeoJSON.Position[]>[];
  rivers: { id: RiverId; parts: Part<GeoJSON.Position[]>[] }[];
}

export type RiverId = 'vistula' | 'oder' | 'warta' | 'bug' | 'dnieper' | 'danube';
/** Rivers whose name is written on the map (i18n `river.<id>`). */
export const LABELLED_RIVERS: readonly RiverId[] = ['vistula', 'oder'];

// The 10m data has a vertex every ~1 km, which is right at zoom 80 but ten times more than a
// Europe-sized view can show — and turning points into SVG path data is what makes panning slow.
// So each zoom level from 4, 8, 16, 32 and 64 up gets its own copy with every arc thinned to
// vertices at least half a pixel apart (arc ends are kept, so shared borders stay shared).
const DETAIL_LEVELS = [4, 8, 16, 32, 64] as const;
/** A TopoJSON topology as far as thinning cares: arcs, quantized (a `transform`) or not. */
export interface ArcTopology { arcs: number[][][]; transform?: { scale: number[]; translate: number[] } }

/**
 * A topology's arcs as absolute `[lon, lat]` points. A *quantized* topology (one with a `transform`) stores each
 * arc delta-encoded in integer grid steps, so its points are summed and then scaled and shifted; an unquantized
 * topology already holds absolute coordinates, which are only copied.
 */
export function decodeArcs(topology: ArcTopology): [number, number][][] {
  const transform = topology.transform;
  if (!transform) return topology.arcs.map((arc) => arc.map(([x, y]) => [x!, y!] as [number, number]));
  const [kx, ky] = transform.scale, [dx, dy] = transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([qx, qy]) => { x += qx!; y += qy!; return [x * kx! + dx!, y * ky! + dy!] as [number, number]; });
  });
}

/**
 * Level of detail, shared by the layers built from a simplified topology (Central Europe below, the Political
 * style's countries, the Physical style's water): a view at flat-map `zoom` is served the highest `levels` entry
 * it has reached, and that level's arcs are thinned once — to vertices at least half a pixel apart at that zoom —
 * and cached. Thinning keeps arc ends, so shared borders stay shared, and the copy drops the `transform` because
 * its arcs are now absolute coordinates. The source arcs are decoded on the first call, so a style nobody opens
 * costs nothing.
 */
export function levelOfDetail<Topo extends ArcTopology, T>(topo: Topo, levels: readonly number[], build: (topology: Topo) => T): (zoom: number) => T {
  const cache = new Map<number, T>();
  let decoded: [number, number][][] | null = null;
  return (zoom: number): T => {
    const level = [...levels].reverse().find((l) => zoom >= l) ?? levels[0]!;
    const cached = cache.get(level);
    if (cached) return cached;
    decoded ??= decodeArcs(topo);
    // Half a pixel at this level's zoom on a 960-unit-wide flat map (960/360 units per degree at zoom 1).
    const tolerance = 0.5 / ((960 / 360) * level);
    const data = build({ ...topo, transform: undefined, arcs: decoded.map((a) => thinArc(a, tolerance)) } as unknown as Topo);
    cache.set(level, data);
    return data;
  };
}

/** Radial-distance thinning: drops vertices closer than `tolerance` (degrees, longitude scaled for latitude) to the last kept one. */
export function thinArc(arc: readonly [number, number][], tolerance: number): [number, number][] {
  if (arc.length <= 2) return [...arc];
  const t2 = tolerance * tolerance;
  const out: [number, number][] = [arc[0]!];
  let [lx, ly] = arc[0]!;
  for (let i = 1; i < arc.length - 1; i++) {
    const [x, y] = arc[i]!;
    const k = Math.cos((y * Math.PI) / 180);
    if (((x - lx) * k) ** 2 + (y - ly) ** 2 >= t2) { out.push(arc[i]!); lx = x; ly = y; }
  }
  out.push(arc[arc.length - 1]!);
  return out;
}

const regionData = levelOfDetail(regionTopo, DETAIL_LEVELS, (topology): RegionData => ({
  land: polygonParts(asMultiPolygon(feature(topology, topology.objects.land))),
  lakes: polygonParts(asMultiPolygon(feature(topology, topology.objects.lakes))),
  coast: lineParts(mesh(topology, topology.objects.coast)),
  borders: lineParts(mesh(topology, topology.objects.borders)),
  // Only the lines between two voivodeships: Poland's outline is already a country border or coast.
  voivodeships: lineParts(mesh(topology, topology.objects.voivodeships, (a, b) => a !== b)),
  rivers: topology.objects.rivers.geometries.map((g) => ({
    id: (g.properties as { id: RiverId }).id,
    parts: lineParts(mesh(topology, { type: 'GeometryCollection', geometries: [g] })),
  })),
}));
const regionMask = boxPolygon(REGION);

/** Only the parts whose box meets the view (a 10% margin keeps strokes that just enter the view). */
export function visibleParts<T>(parts: Part<T>[], view: GeoBounds): T[] {
  const padLon = (view.east - view.west) * 0.1, padLat = (view.north - view.south) * 0.1;
  const padded = { west: view.west - padLon, east: view.east + padLon, south: view.south - padLat, north: view.north + padLat };
  return parts.filter((p) => boundsIntersect(padded, p.bounds)).map((p) => p.coordinates);
}

/** Whether the detailed regional data is drawn for a view at `zoom` (flat-map zoom) covering `view`. */
export function regionActive(zoom: number, view: GeoBounds): boolean {
  return zoom >= REGION_MIN_ZOOM && boundsIntersect(view, REGION);
}

export interface LandLayers {
  world: typeof land;
  /** Present when the regional data is active: `mask` hides the world land under the region box. */
  region: { mask: GeoJSON.Polygon; land: GeoJSON.MultiPolygon; lakes: GeoJSON.MultiPolygon; coast: GeoJSON.MultiLineString } | null;
}

export function landFor(zoom: number, view: GeoBounds): LandLayers {
  if (!regionActive(zoom, view)) return { world: land, region: null };
  const region = regionData(zoom);
  return {
    world: land,
    region: {
      mask: regionMask,
      land: { type: 'MultiPolygon', coordinates: visibleParts(region.land, view) },
      lakes: { type: 'MultiPolygon', coordinates: visibleParts(region.lakes, view) },
      coast: { type: 'MultiLineString', coordinates: visibleParts(region.coast, view) },
    },
  };
}

export interface BorderLayers {
  world: GeoJSON.MultiLineString;
  region: GeoJSON.MultiLineString | null;
}

export function bordersFor(zoom: number, view: GeoBounds): BorderLayers {
  if (!regionActive(zoom, view)) return { world: borders, region: null };
  return { world: borders, region: { type: 'MultiLineString', coordinates: visibleParts(regionData(zoom).borders, view) } };
}

export interface DetailLayers {
  voivodeships: GeoJSON.MultiLineString;
  rivers: { id: RiverId; line: GeoJSON.MultiLineString }[];
}

/** Voivodeship borders and major rivers: from zoom 6 when the view reaches Central Europe. */
export function detailFor(zoom: number, view: GeoBounds): DetailLayers | null {
  if (zoom < REGION_DETAIL_ZOOM || !regionActive(zoom, view)) return null;
  const region = regionData(zoom);
  return {
    voivodeships: { type: 'MultiLineString', coordinates: visibleParts(region.voivodeships, view) },
    rivers: region.rivers
      .map((r) => ({ id: r.id, line: { type: 'MultiLineString' as const, coordinates: visibleParts(r.parts, view) } }))
      .filter((r) => r.line.coordinates.length > 0),
  };
}

/**
 * Points along a river, about every 0.3°, where its name may be written; the map picks the visible
 * one nearest the middle of the view, so the name stays on screen while panning.
 */
export function riverLabelPoints(id: RiverId): readonly { lat: number; lon: number }[] {
  const cached = labelPoints.get(id);
  if (cached) return cached;
  const out: { lat: number; lon: number }[] = [];
  for (const part of regionData(DETAIL_LEVELS[DETAIL_LEVELS.length - 1]!).rivers.find((r) => r.id === id)?.parts ?? []) {
    for (const [lon, lat] of part.coordinates) {
      if (out.every((p) => Math.hypot((p.lon - lon!) * 0.64, p.lat - lat!) >= 0.3)) out.push({ lat: lat!, lon: lon! });
    }
  }
  labelPoints.set(id, out);
  return out;
}
const labelPoints = new Map<RiverId, { lat: number; lon: number }[]>();
