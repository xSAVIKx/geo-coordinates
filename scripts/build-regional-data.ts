// Builds src/map/data/central-europe.json — detailed Natural Earth 10m map data for Central Europe
// (Task 21), drawn on top of the world-atlas 110m data when the flat map or globe is zoomed in there.
//
// Source: Natural Earth (public domain), https://www.naturalearthdata.com/, GeoJSON mirror
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (VERSION 5.2.0-pre, retrieved 2026-09-13):
//   ne_10m_land, ne_10m_admin_0_boundary_lines_land, ne_10m_admin_1_states_provinces,
//   ne_10m_rivers_lake_centerlines, ne_10m_lakes.
//
// Usage:
//   node --experimental-strip-types scripts/build-regional-data.ts <download-dir> [--download]
// The raw downloads (~65 MB) stay in <download-dir> (never in the repo); --download fetches missing files.
//
// Processing: features intersecting the region (padded by 1°) → one topology → Visvalingam
// simplification (planar triangle area) → back to GeoJSON → exact clip to the region box (polygons:
// Sutherland–Hodgman, lines: Cohen–Sutherland) with clip edges densified every 0.25° so they follow
// parallels/meridians on every projection → coastlines = land rings clipped as lines → final
// quantized topology.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clipPolygon, clipPolyline } from 'lineclip';
import type { Feature, FeatureCollection, Geometry, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export const REGION = { west: 8, south: 44, east: 32, north: 58 } as const;
const OUT = 'src/map/data/central-europe.json';
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILES = ['ne_10m_land', 'ne_10m_admin_0_boundary_lines_land', 'ne_10m_admin_1_states_provinces', 'ne_10m_rivers_lake_centerlines', 'ne_10m_lakes'];
/** Natural Earth `name_en` → our river id (i18n key `river.<id>`). */
const RIVERS: Record<string, string> = { Vistula: 'vistula', Oder: 'oder', Warta: 'warta', Bug: 'bug', Dnieper: 'dnieper', Danube: 'danube' };
const MIN_WEIGHT = 1e-5; // square degrees: drops vertices whose triangle is smaller than ~ 0.003° × 0.003° (~ 250 m)
const QUANTIZATION = 30_000; // ~ 0.0008° (60 m) steps: well under a pixel at zoom 80
const DENSIFY = 0.25;

type Box = [number, number, number, number];
const REGION_BOX: Box = [REGION.west, REGION.south, REGION.east, REGION.north];
const PAD_BOX: Box = [REGION.west - 1, REGION.south - 1, REGION.east + 1, REGION.north + 1];

async function ensure(dir: string, download: boolean): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (const f of FILES) {
    const path = join(dir, `${f}.geojson`);
    if (existsSync(path)) continue;
    if (!download) throw new Error(`Missing ${path} (run with --download or fetch ${BASE}${f}.geojson)`);
    console.log(`Downloading ${f}…`);
    const res = await fetch(`${BASE}${f}.geojson`);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${f}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
}

const read = (dir: string, f: string) => JSON.parse(readFileSync(join(dir, `${f}.geojson`), 'utf8')) as FeatureCollection;

function bboxOf(coords: Position[]): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of coords) { b[0] = Math.min(b[0], x!); b[1] = Math.min(b[1], y!); b[2] = Math.max(b[2], x!); b[3] = Math.max(b[3], y!); }
  return b;
}
const intersects = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

function polygonsOf(g: Geometry | null): Position[][][] {
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}
function linesOf(g: Geometry | null): Position[][] {
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}

/** Shoelace area in lon/lat (positive = counter-clockwise with north up). */
function signedArea(ring: Position[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j]![0]! - ring[i]![0]!) * (ring[j]![1]! + ring[i]![1]!);
  return s / 2;
}
/** d3-geo wants exterior rings clockwise and holes counter-clockwise (the reverse of RFC 7946). */
function orientD3(poly: Position[][]): Position[][] {
  return poly.map((ring, i) => {
    const ccw = signedArea(ring) > 0;
    return (i === 0 ? ccw : !ccw) ? [...ring].reverse() : ring;
  });
}

function clipPoly(poly: Position[][], box: Box): Position[][] | null {
  const out: Position[][] = [];
  for (let i = 0; i < poly.length; i++) {
    const clipped = clipPolygon(poly[i] as [number, number][], box);
    if (clipped.length < 4 || Math.abs(signedArea(clipped)) < 1e-9) {
      if (i === 0) return null;
      continue;
    }
    const first = clipped[0]!, last = clipped[clipped.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) clipped.push([first[0], first[1]]);
    out.push(densifyOnBox(clipped, box));
  }
  return out;
}

/** Adds points every DENSIFY degrees along segments that lie on the clip box, so they follow the parallel/meridian. */
function densifyOnBox(ring: Position[], box: Box): Position[] {
  const onEdge = (a: Position, b: Position) =>
    (a[0] === b[0] && (a[0] === box[0] || a[0] === box[2])) || (a[1] === b[1] && (a[1] === box[1] || a[1] === box[3]));
  const out: Position[] = [ring[0]!];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]!, b = ring[i]!;
    if (onEdge(a, b)) {
      const n = Math.floor(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) / DENSIFY);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        out.push([a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t]);
      }
    }
    out.push(b);
  }
  return out;
}

const clipLines = (lines: Position[][], box: Box): Position[][] =>
  lines.flatMap((l) => clipPolyline(l as [number, number][], box)).filter((l) => l.length >= 2);

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const roundLines = (lines: Position[][]) => lines.map((l) => l.map(([x, y]) => [round(x!), round(y!)]));

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: build-regional-data.ts <download-dir> [--download]');
  await ensure(dir, process.argv.includes('--download'));

  // 1. Select and pre-clip to the padded box.
  const landPolys: Position[][][] = [];
  for (const f of read(dir, 'ne_10m_land').features) {
    for (const poly of polygonsOf(f.geometry)) {
      if (!intersects(bboxOf(poly[0]!), PAD_BOX)) continue;
      const c = clipPoly(poly, PAD_BOX);
      if (c) landPolys.push(c);
    }
  }
  const lakePolys: Position[][][] = [];
  for (const f of read(dir, 'ne_10m_lakes').features) {
    for (const poly of polygonsOf(f.geometry)) {
      if (!intersects(bboxOf(poly[0]!), REGION_BOX)) continue;
      const c = clipPoly(poly, PAD_BOX);
      if (c) lakePolys.push(c);
    }
  }
  const borderLines: Position[][] = [];
  for (const f of read(dir, 'ne_10m_admin_0_boundary_lines_land').features) {
    if (!String(f.properties?.FEATURECLA ?? '').startsWith('International boundary')) continue;
    borderLines.push(...clipLines(linesOf(f.geometry), PAD_BOX));
  }
  const voivodeships: Feature<Polygon | MultiPolygon>[] = read(dir, 'ne_10m_admin_1_states_provinces').features
    .filter((f) => f.properties?.iso_a2 === 'PL')
    .map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry as Polygon | MultiPolygon }));
  const riverLines = new Map<string, Position[][]>();
  for (const f of read(dir, 'ne_10m_rivers_lake_centerlines').features) {
    const id = RIVERS[String(f.properties?.name_en)];
    if (!id) continue;
    riverLines.set(id, [...(riverLines.get(id) ?? []), ...clipLines(linesOf(f.geometry), PAD_BOX)]);
  }
  if (voivodeships.length !== 16) throw new Error(`Expected 16 voivodeships, got ${voivodeships.length}`);
  if (riverLines.size !== Object.keys(RIVERS).length) throw new Error(`Missing rivers: ${[...riverLines.keys()]}`);

  // 2. Simplify everything in one topology (shared borders simplify identically).
  const raw = topology({
    land: { type: 'MultiPolygon', coordinates: landPolys } as MultiPolygon,
    lakes: { type: 'MultiPolygon', coordinates: lakePolys } as MultiPolygon,
    borders: { type: 'MultiLineString', coordinates: borderLines } as MultiLineString,
    voivodeships: { type: 'FeatureCollection', features: voivodeships } as FeatureCollection,
    rivers: { type: 'FeatureCollection', features: [...riverLines].map(([id, coordinates]) => ({ type: 'Feature', properties: { id }, geometry: { type: 'MultiLineString', coordinates } })) } as FeatureCollection,
  });
  const simple = simplify(presimplify(raw as unknown as Topology<Record<string, GeometryCollection>>), MIN_WEIGHT) as Topology<Record<string, GeometryCollection>>;
  const back = <T extends Geometry>(name: string) => feature(simple, simple.objects[name] as never) as unknown as Feature<T> | FeatureCollection<T>;
  const geom = <T extends Geometry>(name: string) => (back<T>(name) as Feature<T>).geometry;

  // 3. Exact clip to the region box.
  const land = polygonsOf(geom<MultiPolygon>('land')).map((p) => clipPoly(p, REGION_BOX)).filter((p): p is Position[][] => p !== null).map(orientD3);
  const lakes = polygonsOf(geom<MultiPolygon>('lakes')).map((p) => clipPoly(p, REGION_BOX)).filter((p): p is Position[][] => p !== null).map(orientD3);
  // Coastlines: the (unclipped) simplified land rings, clipped as lines — so the box edge never becomes a "coast".
  const coast = clipLines(polygonsOf(geom<MultiPolygon>('land')).flat(), REGION_BOX);
  const borders = clipLines(linesOf(geom<MultiLineString>('borders')), REGION_BOX);
  const voiv = (back<Polygon | MultiPolygon>('voivodeships') as FeatureCollection<Polygon | MultiPolygon>).features.map((f) => ({
    type: 'Feature' as const, properties: {}, geometry: { type: 'MultiPolygon' as const, coordinates: polygonsOf(f.geometry).map(orientD3) },
  }));
  const rivers = (back<MultiLineString>('rivers') as FeatureCollection<MultiLineString>).features.map((f) => ({
    type: 'Feature' as const, properties: { id: f.properties?.id as string }, geometry: { type: 'MultiLineString' as const, coordinates: roundLines(clipLines(linesOf(f.geometry), REGION_BOX)) },
  }));

  // 4. Final quantized topology.
  const out = topology({
    land: { type: 'MultiPolygon', coordinates: land.map((p) => p.map((r) => roundLines([r])[0]!)) } as MultiPolygon,
    lakes: { type: 'MultiPolygon', coordinates: lakes.map((p) => p.map((r) => roundLines([r])[0]!)) } as MultiPolygon,
    coast: { type: 'MultiLineString', coordinates: roundLines(coast) } as MultiLineString,
    borders: { type: 'MultiLineString', coordinates: roundLines(borders) } as MultiLineString,
    voivodeships: { type: 'FeatureCollection', features: voiv } as FeatureCollection,
    rivers: { type: 'FeatureCollection', features: rivers } as FeatureCollection,
  }, QUANTIZATION);
  const json = JSON.stringify({ ...out, source: 'Natural Earth 10m (public domain), naturalearthdata.com; built by scripts/build-regional-data.ts', region: REGION });
  writeFileSync(OUT, json);
  const count = (lines: Position[][]) => lines.reduce((n, l) => n + l.length, 0);
  console.log(`${OUT}: ${(json.length / 1024).toFixed(1)} KiB; land points ${count(land.flat())}, lakes ${lakes.length}, coast ${count(coast)}, borders ${count(borders)}, rivers ${rivers.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}

