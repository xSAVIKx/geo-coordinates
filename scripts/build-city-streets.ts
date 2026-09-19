// Builds src/map/data/city/streets/<id>.json.gz — the street map inside each city close-up box (Places up close
// spec §4). One quantized, Visvalingam-simplified TopoJSON per box, read at runtime by src/map/streets.ts through
// the same world.ts level-of-detail machinery every other vector layer uses (planning ruling R7).
//
// THE COMMITTED FILES ARE GZIPPED, and the raw .json is an intermediate that is never written to disk.
// Why: the page is one offline file capped at 8 388 608 B. The twelve photos cost 2 374 752 B once base64'd, and
// these twelve topologies are 2 734 653 B as text, which would have put the file at 8 497 108 B — 108 500 B over
// the cap before Tasks 4-8 wrote a line. Gzipped they are 785 349 B (28.7 % of raw), 1 047 132 B base64'd in the
// page, which lands it at 6 809 587 B with 1.5 MB to spare. Nothing is lost; the alternative was trimming real
// content, such as Giza's 1 918 English street names.
// Who unpacks it: src/map/cityStreets.ts — `unpackStreetTopology(base64)`, which base64-decodes, inflates with
// DecompressionStream('gzip') and parses. It returns null instead of throwing, so a browser without
// DecompressionStream, or a damaged block, costs the street layer only and leaves the rest of the map standing
// (the fallback rule every other vector layer follows). Task 3 embeds each file as base64 in its own
// <script type="application/x-geo-city"> block.
//
// Source: OpenStreetMap via Overpass (https://overpass-api.de/api/interpreter), © OpenStreetMap contributors,
// ODbL. Overpass answers 406 to a bare request: it needs an identifying User-Agent and a POSTed query
// (planning ruling R21). One query per box, a polite delay between them, raw answers cached in .cache/overpass/.
//
// Usage:
//   node --experimental-strip-types scripts/build-city-streets.ts [--only <id>,<id>] [--refresh]
//   (npm run data:city-streets). --refresh re-queries Overpass instead of using the cache.
//
// NOT included: building outlines (planning ruling R6 — measured at 2.3 MB for one box).
//
// Multipolygon relations and coastlines ARE included, which planning ruling R16 had left out. Ways only cost the
// release Sydney Harbour (0 water polygons, about 40 % of that box), the Hudson and the East River at Manhattan
// (0.65 % water, so the island was not one), the Seine at Paris (0.12 %) and the Thames past the Greenwich
// peninsula: the big water of a city is never one closed way. `relationPolygons` assembles a relation's member
// ways into outlines and holes; `coastlineWater` closes `natural=coastline` — which OSM stores as open lines
// with the land on their left and no polygon anywhere — against the edge of the box.
//
// Manifest `bytes` is the committed .gz; `rawBytes` is the JSON inside it.
//
// Manifest counts describe the file, not the query: `roads`, `named` and `english` count features after the
// merge in collect() — streets, not the OSM ways they were cut into — while `rail` counts the source ways and
// `water` and `green` the shapes those layers are made of (a closed way, a relation's outline, a ring closed
// against the box from a coastline), because each layer is one merged feature and counting them would say 1.
// `waterM2` is the water the box actually holds, in square metres, which is the number tests/unit/
// city-streets-data.test.ts holds a floor under so a rebuild cannot quietly drop a river again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { clipPolygon, clipPolyline } from 'lineclip';
import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { feature, quantize } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import boxes from '../src/map/data/city/boxes.json' with { type: 'json' };

const OUT = join('src', 'map', 'data', 'city', 'streets');
const CACHE = join('.cache', 'overpass');
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const UA = 'geo-coordinates-lesson/1.0 (school lesson build; yurii@serhiichuk.dev)';
const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
const POLITE_MS = 5000;
const RETRIES = 5;
const M_PER_DEGREE = 111320;
/**
 * Grid cells across the box, NOT degrees: topojson's `quantize(topology, n)` lays n cells over the topology's
 * own bounding box. A box is 6 km wide, so 2e3 cells is 3 m a cell — still finer than a pixel of every photo
 * these lines are drawn over (4.17 m/px at Katowice, 5 m elsewhere, 10 m on the six Sentinel boxes). (The
 * world-scale builds next door pass 1e5 because their box is the whole 360°; passing 1e5 here would store
 * 0.06 m steps, fifty times finer than anything can be drawn, for about 50 KiB a box of digits nobody reads.)
 */
const QUANTIZATION = 2e3;
/**
 * Visvalingam weight in square degrees: 2e-8 is a triangle of roughly 150 m² at these latitudes — about 12 m
 * across, three pixels on the sharpest photo (Katowice, 4.17 m/px) and one on a Sentinel box (10 m/px). Below
 * this a kink cannot be seen against the photo it is drawn over. The brief's 7e-10 (≈ 3 m) is finer than any
 * box's photo resolves and costs 136 KiB a box; see the report for the measured curve.
 */
const MIN_WEIGHT = 2e-8;
/**
 * Smallest park, lawn or pond kept, in square metres. OSM maps every strip of grass between blocks of flats:
 * Katowice's box holds 4 651 green ways, of which only 364 reach 2 500 m² (50 m across — twelve pixels on the
 * Katowice photo, five on a Sentinel one, about a football pitch). The rest cannot be told apart from the photo
 * underneath and cost roughly 200 KiB a dense box.
 */
const MIN_AREA_M2 = 2500;

/** Road classes the map draws, coarsest first. The index is the `c` property and src/map/streets.ts's StreetClass. */
const ROAD_CLASSES: readonly (readonly string[])[] = [
  ['motorway', 'trunk', 'motorway_link', 'trunk_link'],
  ['primary', 'primary_link'],
  ['secondary', 'secondary_link'],
  ['tertiary', 'tertiary_link'],
  ['residential', 'unclassified', 'living_street'],
  ['pedestrian'],
];
const ROAD_CLASS = new Map<string, number>(ROAD_CLASSES.flatMap((names, c) => names.map((n) => [n, c] as const)));
const RAIL = new Set(['rail', 'light_rail', 'subway', 'tram', 'narrow_gauge']);
const WATERWAY = new Set(['river', 'stream', 'canal']);
const GREEN_LEISURE = new Set(['park', 'garden', 'pitch', 'golf_course']);
const GREEN_LANDUSE = new Set(['forest', 'grass', 'cemetery', 'recreation_ground', 'meadow', 'village_green']);
const PLACE_KINDS = new Set(['suburb', 'quarter', 'neighbourhood']);

interface OverpassWay { type: 'way'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
interface OverpassNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
interface OverpassMember { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }
interface OverpassRelation { type: 'relation'; id: number; tags?: Record<string, string>; members: OverpassMember[] }
type OverpassElement = OverpassWay | OverpassNode | OverpassRelation;
interface OverpassAnswer { elements: OverpassElement[]; osm3s?: { copyright?: string; timestamp_osm_base?: string } }

/** Overpass takes its bbox as (south, west, north, east). */
function query(b: { south: number; west: number; north: number; east: number }): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const re = (names: Iterable<string>) => `^(${[...names].join('|')})$`;
  return [
    '[out:json][timeout:180];',
    '(',
    `  way["highway"~"${re(ROAD_CLASS.keys())}"](${bbox});`,
    `  way["railway"~"${re(RAIL)}"](${bbox});`,
    `  way["waterway"~"${re(WATERWAY)}"](${bbox});`,
    `  way["natural"="water"](${bbox});`,
    `  way["waterway"="riverbank"](${bbox});`,
    // The sea, a harbour and a tidal river are drawn with `natural=coastline` — open lines with the land on
    // their left — and never as a closed shape; without them Sydney Harbour, the Hudson and the East River are
    // blank land. `coastlineWater` closes them against the box below.
    `  way["natural"="coastline"](${bbox});`,
    `  way["leisure"~"${re(GREEN_LEISURE)}"](${bbox});`,
    `  way["landuse"~"${re(GREEN_LANDUSE)}"](${bbox});`,
    // Anything too big for one way is a multipolygon relation: Sydney Harbour, the Seine, the Vistula at Warsaw
    // and Kraków, the Thames past the Greenwich peninsula, Hyde Park. Ruling R16 skipped these; `relationRings`
    // assembles them (this fix's Critical 1).
    `  relation["natural"="water"](${bbox});`,
    `  relation["waterway"="riverbank"](${bbox});`,
    `  relation["leisure"~"${re(GREEN_LEISURE)}"](${bbox});`,
    `  relation["landuse"~"${re(GREEN_LANDUSE)}"](${bbox});`,
    `  node["place"~"${re(PLACE_KINDS)}"](${bbox});`,
    ');',
    'out geom;',
  ].join('\n');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(id: string, q: string, refresh: boolean): Promise<OverpassAnswer> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${id}.json`);
  if (existsSync(path) && !refresh) return JSON.parse(readFileSync(path, 'utf8')) as OverpassAnswer;
  await sleep(POLITE_MS);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${id} (429 means its two slots are full, 504 that it was busy)`);
  const text = await res.text();
  writeFileSync(path, text);
  return JSON.parse(text) as OverpassAnswer;
}

/**
 * Overpass hands out two query slots and answers 429 when both are busy, 504 when a query outlives its slot.
 * Neither says the query is wrong, so wait — doubling each time — and ask again rather than failing the build
 * eleven boxes from the end.
 */
async function overpassWithRetry(id: string, q: string, refresh: boolean): Promise<OverpassAnswer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await overpass(id, q, refresh);
    } catch (err) {
      const busy = err instanceof Error && /Overpass (429|5\d\d)/.test(err.message);
      if (!busy || attempt >= RETRIES) throw err;
      const wait = POLITE_MS * 2 ** attempt;
      console.warn(`${id}: ${(err as Error).message.split(' (')[0]}; retrying in ${wait / 1000}s (${attempt}/${RETRIES - 1})`);
      await sleep(wait);
    }
  }
}

/**
 * Planar shoelace area of a ring in square metres, scaled for the latitude and independent of winding.
 * d3's `geoArea` cannot be used for the size filter below: it is a spherical area, so a ring wound the other
 * way measures as the whole sphere minus itself and a lawn comes out bigger than the box.
 */
function ringAreaM2(points: Position[]): number {
  let sum = 0, lat = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j]![0]! * points[i]![1]! - points[i]![0]! * points[j]![1]!;
    lat += points[i]![1]!;
  }
  const k = Math.cos(((lat / points.length) * Math.PI) / 180);
  return (Math.abs(sum) / 2) * M_PER_DEGREE * M_PER_DEGREE * k;
}

const closed = (g: { lat: number; lon: number }[]) =>
  g.length > 3 && g[0]!.lat === g[g.length - 1]!.lat && g[0]!.lon === g[g.length - 1]!.lon;
const line = (g: { lat: number; lon: number }[]): Position[] => g.map((p) => [p.lon, p.lat]);

/** A clipping box as lineclip wants it: west, south, east, north. */
export type Box = [number, number, number, number];

/**
 * Overpass's `out geom;` returns each way whole, however little of it is in the bbox: Warsaw's answer carries
 * the Vistula out to 21.09°E, half a box past the eastern edge. Nothing out there is ever drawn, so clip every
 * way to the box the photo covers — the same lineclip pass scripts/build-regional-data.ts uses.
 */
const clipLine = (points: Position[], box: Box): Position[][] =>
  clipPolyline(points as [number, number][], box).filter((l) => l.length >= 2);

/** Clipped ring, closed again along the box edge; null when nothing of it is inside. */
function clipRing(points: Position[], box: Box): Position[] | null {
  const clipped = clipPolygon(points as [number, number][], box);
  if (clipped.length < 4) return null;
  const first = clipped[0]!, last = clipped[clipped.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) clipped.push([first[0]!, first[1]!]);
  return clipped;
}

/** Twice a ring's signed planar area; negative means clockwise in lon/lat with north up. */
function shoelace(points: Position[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j]![0]! * points[i]![1]! - points[i]![0]! * points[j]![1]!;
  }
  return sum;
}

/** A ring wound the way d3 reads an outline on the sphere: clockwise, so the planar shoelace sum is negative. */
function ring(points: Position[]): Position[] {
  return shoelace(points) < 0 ? points : [...points].reverse();
}

/** The other way round: a hole inside an outline (src/map/world.ts's `oriented(r, false)`). */
function hole(points: Position[]): Position[] {
  return shoelace(points) > 0 ? points : [...points].reverse();
}

/** Ray casting; `r` is a closed ring. Used only to hang a relation's inner rings on the outer that holds them. */
function pointInRing(p: Position, r: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = [r[i]![0]!, r[i]![1]!], [xj, yj] = [r[j]![0]!, r[j]![1]!];
    if ((yi > p[1]!) !== (yj > p[1]!) && p[0]! < ((xj - xi) * (p[1]! - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const endKey = (p: Position) => `${p[0]},${p[1]}`;

/**
 * Ways joined end to end into the longest lines they make, then split into the ones that close on themselves and
 * the ones that do not. OSM never stores a ring: a lake's outline is a relation's member ways, a coastline is a
 * chain of ways thousands of kilometres long, and both arrive here in fragments whose direction is meaningful
 * (a coastline keeps the land on its left). Joining preserves that direction; a fragment met from its far end is
 * reversed before it is appended, which reverses nothing about the chain as a whole.
 */
function chain(ways: readonly Position[][]): { rings: Position[][]; open: Position[][] } {
  const usable = ways.filter((w) => w.length >= 2);
  const used = new Set<Position[]>();
  const ends = new Map<string, Position[][]>();
  for (const w of usable) {
    for (const k of [endKey(w[0]!), endKey(w[w.length - 1]!)]) {
      const list = ends.get(k) ?? [];
      list.push(w);
      ends.set(k, list);
    }
  }
  const rings: Position[][] = [], open: Position[][] = [];
  for (const start of usable) {
    if (used.has(start)) continue;
    used.add(start);
    let line = [...start];
    for (;;) {
      const tail = endKey(line[line.length - 1]!);
      if (tail === endKey(line[0]!)) break;
      const next = (ends.get(tail) ?? []).find((w) => !used.has(w));
      if (!next) break;
      used.add(next);
      const seq = endKey(next[0]!) === tail ? next : [...next].reverse();
      line.push(...seq.slice(1));
    }
    for (;;) {
      const head = endKey(line[0]!);
      if (head === endKey(line[line.length - 1]!)) break;
      const prev = (ends.get(head) ?? []).find((w) => !used.has(w));
      if (!prev) break;
      used.add(prev);
      const seq = endKey(prev[prev.length - 1]!) === head ? prev : [...prev].reverse();
      line = [...seq.slice(0, -1), ...line];
    }
    if (line.length >= 4 && endKey(line[0]!) === endKey(line[line.length - 1]!)) rings.push(line);
    else open.push(line);
  }
  return { rings, open };
}

/**
 * One multipolygon relation, clipped to the box: its `outer` member ways chained into outlines, its `inner` ones
 * into holes, and each hole hung on the outline that contains it. A member with no role is an outer (OSM's own
 * default for `type=multipolygon`). Returns one entry per outline, outline first and holes after, which is the
 * shape `area()` below and src/map/world.ts's `polygonParts` both read.
 */
export function relationPolygons(rel: OverpassRelation, box: Box): Position[][][] {
  const geom = (role: string) => rel.members
    .filter((m) => m.type === 'way' && m.geometry && m.geometry.length >= 2 && (role === 'outer' ? m.role !== 'inner' : m.role === 'inner'))
    .map((m) => line(m.geometry!));
  const outers = chain(geom('outer')).rings
    .map((r) => clipRing(r, box))
    .filter((r): r is Position[] => r !== null && ringAreaM2(r) >= MIN_AREA_M2);
  const inners = chain(geom('inner')).rings
    .map((r) => clipRing(r, box))
    .filter((r): r is Position[] => r !== null);
  const taken = new Set<Position[]>();
  return outers.map((o) => {
    const holes = inners.filter((h) => !taken.has(h) && pointInRing(h[0]!, o));
    for (const h of holes) taken.add(h);
    return [ring(o), ...holes.map(hole)];
  });
}

/**
 * Where a point on the box's edge sits, measured clockwise from the north-west corner: east along the north
 * edge, south down the east edge, west along the south edge, north up the west edge. Null when the point is not
 * on the edge at all. Corners answer the same number from either of the two edges that meet there.
 *
 * Clockwise, because walking a box clockwise in lon/lat with north up keeps the box's inside on the right — the
 * same side `natural=coastline` keeps the water on. So a water outline can run along the coast and along the box
 * edge without ever changing which side the water is on.
 */
function edgeAt(p: Position, box: Box, eps: number): number | null {
  const [W, S, E, N] = box;
  const w = E - W, h = N - S;
  if (Math.abs(p[1]! - N) <= eps) return p[0]! - W;
  if (Math.abs(p[0]! - E) <= eps) return w + (N - p[1]!);
  if (Math.abs(p[1]! - S) <= eps) return w + h + (E - p[0]!);
  if (Math.abs(p[0]! - W) <= eps) return 2 * w + h + (p[1]! - S);
  return null;
}

/** The box's corners passed while walking its edge clockwise from `from` to `to`, in the order they are met. */
function cornersBetween(from: number, to: number, box: Box): Position[] {
  const [W, S, E, N] = box;
  const w = E - W, h = N - S, P = 2 * (w + h);
  const corners: [number, Position][] = [[w, [E, N]], [w + h, [E, S]], [2 * w + h, [W, S]], [P, [W, N]]];
  // Exactly zero means the next coast line starts where this one stopped: no edge is walked, so no corner is
  // passed. (`|| P` below is the other end of the same thought — a corner at the point being walked away from
  // has already been laid down and is not passed again.)
  const span = (to - from + P) % P;
  if (span === 0) return [];
  return corners
    .map(([t, p]) => [(t - from + P) % P || P, p] as const)
    .filter(([d]) => d < span)
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => [p[0]!, p[1]!]);
}

/**
 * Water from `natural=coastline` (this fix's Critical 1).
 *
 * OSM draws the sea as an open line with the land on its left and never closes it — there is no polygon anywhere
 * in the database for Sydney Harbour's water, the Hudson or the English Channel. Inside a 6 x 4 km box a coast is
 * therefore a handful of lines that enter the box at one edge and leave at another, and the water is whatever is
 * on their right. This closes them: follow a coast line forward, then walk the box's edge clockwise (the inside
 * of the box is on the right, the same side the water is on) until the next coast line starts, and carry on until
 * the walk comes back to where it began. What comes out is one ring per body of water in the box.
 *
 * A closed coast line wholly inside the box is an island (land on the left means it is wound anticlockwise) or a
 * closed inner sea; islands become holes in the water ring that holds them.
 *
 * Returns nothing at all rather than a guess when a coast line stops inside the box — that means the query did
 * not bring back the way that continues it, and closing it would invent a shoreline. The box then keeps whatever
 * water its ways and relations give it, which is what every box had before this function existed.
 */
export function coastlineWater(ways: readonly Position[][], box: Box): Position[][][] {
  if (ways.length === 0) return [];
  const [W, S, E, N] = box;
  const eps = Math.min(E - W, N - S) * 1e-9;
  const joined = chain(ways);
  type Piece = { points: Position[]; from: number; to: number };
  const pieces: Piece[] = [];
  const islands: Position[][] = [];
  for (const whole of [...joined.rings, ...joined.open]) {
    for (const part of clipPolyline(whole as [number, number][], box)) {
      if (part.length < 2) continue;
      const a = part[0]!, b = part[part.length - 1]!;
      if (a[0] === b[0] && a[1] === b[1]) { if (part.length >= 4) islands.push(part as Position[]); continue; }
      const from = edgeAt(a as Position, box, eps), to = edgeAt(b as Position, box, eps);
      if (from === null || to === null) return [];
      pieces.push({ points: part as Position[], from, to });
    }
  }
  if (pieces.length === 0) return [];
  const P = 2 * (E - W) + 2 * (N - S);
  /** The coast line that starts first when walking the box's edge clockwise from `t`. */
  const nextFrom = (t: number): Piece => pieces
    .reduce((best, p) => ((p.from - t + P) % P < (best.from - t + P) % P ? p : best), pieces[0]!);
  const used = new Set<Piece>();
  const rings: Position[][] = [];
  for (const start of pieces) {
    if (used.has(start)) continue;
    const points: Position[] = [];
    let cur = start;
    for (let guard = 0; guard <= pieces.length; guard++) {
      used.add(cur);
      points.push(...cur.points);
      const next = nextFrom(cur.to);
      points.push(...cornersBetween(cur.to, next.from, box));
      if (next === start || used.has(next)) break;
      cur = next;
    }
    points.push([points[0]![0]!, points[0]![1]!]);
    if (points.length >= 4 && ringAreaM2(points) >= MIN_AREA_M2) rings.push(points);
  }
  // An island is land, so it is a hole in the water around it; one wholly outside every water ring is a coast
  // the walk above already went round and is dropped rather than painted blue.
  const taken = new Set<Position[]>();
  return rings.map((r) => {
    const holes = islands.filter((h) => !taken.has(h) && pointInRing(h[0]!, r));
    for (const h of holes) taken.add(h);
    return [ring(r), ...holes.map(hole)];
  });
}

type Layer = 'roads' | 'rail' | 'waterways' | 'water' | 'green';

interface Built {
  collections: Record<Layer, FeatureCollection>;
  places: { id: string; name: string; lat: number; lon: number }[];
  /** Source shapes behind each layer, before the merge below folded them together. */
  ways: Record<Layer, number>;
}

/** One box's row in streets/manifest.json. */
interface StreetEntry {
  /** The committed artefact, `<id>.json.gz`. */
  file: string;
  /** Bytes of that gzipped file, as committed. */
  bytes: number;
  /** Bytes of the TopoJSON inside it, which is what the page holds once unpacked. */
  rawBytes: number;
  arcs: number; roads: number; named: number; english: number;
  rail: number; water: number; green: number; places: number; retrieved: string;
  /** Square metres of water in the box, measured on the committed topology (see `waterAreaM2`). */
  waterM2: number;
}

/**
 * OSM splits one street into a way per junction, speed limit or surface change: Katowice's box holds 3 156 road
 * ways but only 456 distinct (class, name) streets. Every one of those ways would otherwise be its own TopoJSON
 * geometry record, and the record — type, arc index, properties — costs more than the line it points at.
 *
 * So the ways of one street become one feature, a MultiLineString, which is the shape the output contract asks
 * for; the nameless ways of a class become a single MultiLineString for that class, and each of rail, waterways,
 * water and green becomes one feature for the whole layer (they carry no properties to tell apart). This is also
 * what the layer above wants: one label per street rather than one per fragment, and one path per class to stroke.
 * It changes no coordinate — `topology()` still cuts arcs at the junctions, so shared geometry stays shared.
 */
function collect(answer: OverpassAnswer, box: Box): Built {
  const places: Built['places'] = [];
  const ways: Record<Layer, number> = { roads: 0, rail: 0, waterways: 0, water: 0, green: 0 };
  /** Road parts by `class \0 name \0 name:en`, so one street's ways land in one feature. */
  const roads = new Map<string, { props: Record<string, unknown>; parts: Position[][] }>();
  const lines: Record<'rail' | 'waterways', Position[][]> = { rail: [], waterways: [] };
  const rings: Record<'water' | 'green', Position[][][]> = { water: [], green: [] };
  /** Whole `natural=coastline` ways, kept aside: they are only water once closed against the box. */
  const coast: Position[][] = [];

  for (const el of answer.elements) {
    if (el.type === 'relation') {
      const tags = el.tags ?? {};
      const water = tags.natural === 'water' || tags.waterway === 'riverbank';
      const green = GREEN_LEISURE.has(tags.leisure ?? '') || GREEN_LANDUSE.has(tags.landuse ?? '');
      if (!water && !green) continue;
      const polys = relationPolygons(el, box);
      const layer: 'water' | 'green' = water ? 'water' : 'green';
      rings[layer].push(...polys);
      ways[layer] += polys.length;
      continue;
    }
    if (el.type === 'node') {
      const name = el.tags?.name;
      if (name && PLACE_KINDS.has(el.tags?.place ?? '')) places.push({ id: `n${el.id}`, name, lat: el.lat, lon: el.lon });
      continue;
    }
    const g = el.geometry;
    const tags = el.tags ?? {};
    if (!g || g.length < 2) continue;
    /** The part of this way that is inside the box, in one or more pieces; empty when none of it is. */
    const parts = () => clipLine(line(g), box);
    /** A pond or lawn smaller than this is fewer pixels than the photo under it resolves; see MIN_AREA_M2. */
    const patch = (): Position[][] | null => {
      const r = clipRing(line(g), box);
      return r && ringAreaM2(r) >= MIN_AREA_M2 ? [ring(r)] : null;
    };
    const cls = ROAD_CLASS.get(tags.highway ?? '');
    if (cls !== undefined) {
      const inside = parts();
      if (inside.length === 0) continue;
      // `name` is the name on the street sign; `name:en` is kept only where it says something different, for the
      // boxes whose local names are in a script a pupil here cannot read (spec §4, planning ruling R24).
      const name = tags.name;
      const english = name && tags['name:en'] && tags['name:en'] !== name ? tags['name:en'] : undefined;
      const props: Record<string, unknown> = { c: cls };
      if (name) props.n = name;
      if (english) props.e = english;
      const key = `${cls}\u0000${name ?? ''}\u0000${english ?? ''}`;
      const street = roads.get(key) ?? { props, parts: [] };
      street.parts.push(...inside);
      roads.set(key, street);
      ways.roads++;
    } else if (RAIL.has(tags.railway ?? '')) {
      const inside = parts();
      if (inside.length === 0) continue;
      lines.rail.push(...inside);
      ways.rail++;
    } else if (WATERWAY.has(tags.waterway ?? '')) {
      const inside = parts();
      if (inside.length === 0) continue;
      lines.waterways.push(...inside);
      ways.waterways++;
    } else if (tags.natural === 'coastline') {
      coast.push(line(g));
    } else if ((tags.natural === 'water' || tags.waterway === 'riverbank') && closed(g)) {
      const p = patch();
      if (p) { rings.water.push(p); ways.water++; }
    } else if ((GREEN_LEISURE.has(tags.leisure ?? '') || GREEN_LANDUSE.has(tags.landuse ?? '')) && closed(g)) {
      const p = patch();
      if (p) { rings.green.push(p); ways.green++; }
    }
  }

  const fromCoast = coastlineWater(coast, box);
  if (coast.length > 0 && fromCoast.length === 0) {
    console.warn(`  coastline: ${coast.length} way(s) in the box but no closed water came out — left as it was`);
  }
  rings.water.push(...fromCoast);
  ways.water += fromCoast.length;

  const make = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
  const one = (parts: Position[][], properties: Record<string, unknown>): Feature[] =>
    parts.length === 0 ? []
      : [{ type: 'Feature', properties, geometry: parts.length === 1
          ? { type: 'LineString', coordinates: parts[0]! } as LineString
          : { type: 'MultiLineString', coordinates: parts } } as Feature];
  const area = (parts: Position[][][]): Feature[] =>
    parts.length === 0 ? []
      : [{ type: 'Feature', properties: {}, geometry: parts.length === 1
          ? { type: 'Polygon', coordinates: parts[0]! } as Polygon
          : { type: 'MultiPolygon', coordinates: parts } } as Feature];

  return {
    collections: {
      roads: make([...roads.values()].flatMap((s) => one(s.parts, s.props))),
      rail: make(one(lines.rail, {})),
      waterways: make(one(lines.waterways, {})),
      water: make(area(rings.water)),
      green: make(area(rings.green)),
    },
    places,
    ways,
  };
}

type StreetTopology = Topology<Record<Layer, GeometryCollection>>;

/** Every filled shape of a topology's `water` object, each as its outline followed by its holes. */
export function waterPolygons(t: Topology<{ water: GeometryCollection }>): Position[][][] {
  const f = feature(t as never, t.objects.water as never) as unknown as Feature | FeatureCollection;
  const features = f.type === 'FeatureCollection' ? f.features : [f];
  return features.flatMap((x) => {
    const g = x.geometry;
    if (!g) return [];
    if (g.type === 'Polygon') return [g.coordinates];
    if (g.type === 'MultiPolygon') return g.coordinates;
    return [];
  });
}

/** Rows of the box sampled across its height by `waterAreaM2`. 2 000 rows is 2 m a row on a 4 km box. */
const WATER_ROWS = 2000;

/**
 * Square metres of water inside `box`, counting ground that is under water **once**. Exported because
 * tests/unit/city-streets-data.test.ts holds a per-box floor under exactly this number on the committed files
 * (this fix's Critical 2): a rebuild that loses Sydney Harbour, the Hudson or the Seine again fails there
 * instead of shipping.
 *
 * Adding the shapes' own areas up would not do. OSM maps the same water more than once on purpose — Sydney's box
 * holds Sydney Harbour, Port Jackson and the Parramatta River as three relations over one stretch of water, which
 * sums to 103 % of a box that is about two fifths water. So this sweeps the box in horizontal rows, takes each
 * shape's spans on the row (its ring crossings paired off, which subtracts its holes), unions the spans and
 * measures what is left. A row's width in metres is scaled for its latitude, as `ringAreaM2` does.
 *
 * Sampled rather than exact: a union's outline is not piecewise-linear in the box's own frame, and 2 000 rows put
 * the error near 0.05 % of the box — three orders below anything the floors below turn on.
 */
export function waterAreaM2(t: Topology<{ water: GeometryCollection }>, box: Box): number {
  const [W, S, E, N] = box;
  const polygons = waterPolygons(t);
  if (polygons.length === 0) return 0;
  const rowH = (N - S) / WATER_ROWS;
  let total = 0;
  for (let r = 0; r < WATER_ROWS; r++) {
    const y = S + (r + 0.5) * rowH;
    const spans: [number, number][] = [];
    for (const rings of polygons) {
      const xs: number[] = [];
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = [ring[i]![0]!, ring[i]![1]!], [xj, yj] = [ring[j]![0]!, ring[j]![1]!];
          if ((yi > y) !== (yj > y)) xs.push(xi + ((xj - xi) * (y - yi)) / (yj - yi));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i]!, xs[i + 1]!]);
    }
    if (spans.length === 0) continue;
    spans.sort((a, b) => a[0] - b[0]);
    let lon = 0, [from, to] = spans[0]!;
    for (const [a, b] of spans.slice(1)) {
      if (a > to) { lon += to - from; from = a; to = b; } else if (b > to) to = b;
    }
    lon += to - from;
    total += Math.max(0, Math.min(lon, E - W)) * M_PER_DEGREE * Math.cos((y * Math.PI) / 180) * rowH * M_PER_DEGREE;
  }
  return total;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const onlyArg = args.indexOf('--only');
  const only = onlyArg >= 0 ? new Set(args[onlyArg + 1]!.split(',')) : null;
  mkdirSync(OUT, { recursive: true });
  const manifestPath = join(OUT, 'manifest.json');
  const streets: Record<string, StreetEntry> = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { streets: Record<string, StreetEntry> }).streets
    : {};

  for (const b of boxes.boxes) {
    if (only && !only.has(b.id)) continue;
    const answer = await overpassWithRetry(b.id, query(b), refresh);
    const { collections, places, ways } = collect(answer, [b.west, b.south, b.east, b.north]);
    const raw = topology(collections as never) as unknown as StreetTopology;
    const out = quantize(simplify(presimplify(raw), MIN_WEIGHT), QUANTIZATION) as unknown as StreetTopology;
    const retrieved = (answer.osm3s?.timestamp_osm_base ?? new Date().toISOString()).slice(0, 10);
    const json = JSON.stringify({ ...out, places, source: `OpenStreetMap via Overpass, ${ATTRIBUTION}` });
    // Level 9. Node writes a zero MTIME into the gzip header, so rebuilding the same answer gives the same bytes
    // and a committed artefact never churns; `npm run data:city-streets` twice over is a no-op in git.
    const packed = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
    const file = `${b.id}.json.gz`;
    writeFileSync(join(OUT, file), packed);
    // Counts describe what is in the file: `roads` is streets after the merge, `ways` the OSM ways behind them.
    const road = collections.roads.features;
    streets[b.id] = {
      file, bytes: packed.byteLength, rawBytes: Buffer.byteLength(json, 'utf8'), arcs: out.arcs.length,
      roads: road.length,
      named: road.filter((f) => f.properties && 'n' in f.properties).length,
      english: road.filter((f) => f.properties && 'e' in f.properties).length,
      rail: ways.rail, water: ways.water, green: ways.green, places: places.length, retrieved,
      waterM2: Math.round(waterAreaM2(out, [b.west, b.south, b.east, b.north])),
    };
    const e = streets[b.id]!;
    console.log(`${join(OUT, file)}: ${(e.bytes / 1024).toFixed(1)} KiB gz of ${(e.rawBytes / 1024).toFixed(1)} KiB, `
      + `${e.roads} streets from ${ways.roads} ways (${e.named} named), ${out.arcs.length} arcs, `
      + `water ${(e.waterM2 / 1e6).toFixed(3)} km² in ${e.water} shapes `
      + `(${((e.waterM2 / (boxes.widthM * boxes.heightM)) * 100).toFixed(2)} % of the box)`);
  }

  const ordered: Record<string, StreetEntry> = Object.fromEntries(
    boxes.boxes.filter((b) => b.id in streets).map((b) => [b.id, streets[b.id]!] as const));
  writeFileSync(manifestPath, `${JSON.stringify({ generatedBy: 'scripts/build-city-streets.ts', attribution: ATTRIBUTION, streets: ordered }, null, 1)}\n`);
  const total = Object.values(ordered).reduce((n, e) => n + e.bytes, 0);
  const raw = Object.values(ordered).reduce((n, e) => n + e.rawBytes, 0);
  console.log(`${manifestPath}: ${Object.keys(ordered).length} boxes, ${(total / 1024).toFixed(1)} KiB gz `
    + `of ${(raw / 1024).toFixed(1)} KiB raw (${((total / raw) * 100).toFixed(0)} %)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
