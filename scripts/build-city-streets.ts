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
// NOT included: building outlines (planning ruling R6 — measured at 2.3 MB for one box) and multipolygon
// relations (planning ruling R16 — ways only, so a park mapped only as a relation is missing).
//
// Manifest `bytes` is the committed .gz; `rawBytes` is the JSON inside it.
//
// Manifest counts describe the file, not the query: `roads`, `named` and `english` count features after the
// merge in collect() — streets, not the OSM ways they were cut into — while `rail`, `water` and `green` count
// the source ways, because those layers are one merged feature each and counting them would always say 1.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { clipPolygon, clipPolyline } from 'lineclip';
import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { quantize } from 'topojson-client';
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
type OverpassElement = OverpassWay | OverpassNode;
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
    `  way["leisure"~"${re(GREEN_LEISURE)}"](${bbox});`,
    `  way["landuse"~"${re(GREEN_LANDUSE)}"](${bbox});`,
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

type Box = [number, number, number, number];

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

/** A ring wound the way d3 reads an outline on the sphere: clockwise, so the planar shoelace sum is negative. */
function ring(points: Position[]): Position[] {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j]![0]! * points[i]![1]! - points[i]![0]! * points[j]![1]!;
  }
  return sum < 0 ? points : [...points].reverse();
}

type Layer = 'roads' | 'rail' | 'waterways' | 'water' | 'green';

interface Built {
  collections: Record<Layer, FeatureCollection>;
  places: { id: string; name: string; lat: number; lon: number }[];
  /** Source OSM ways behind each layer, before the merge below folded them together. */
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

  for (const el of answer.elements) {
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
    } else if (tags.natural === 'water' && closed(g)) {
      const p = patch();
      if (p) { rings.water.push(p); ways.water++; }
    } else if ((GREEN_LEISURE.has(tags.leisure ?? '') || GREEN_LANDUSE.has(tags.landuse ?? '')) && closed(g)) {
      const p = patch();
      if (p) { rings.green.push(p); ways.green++; }
    }
  }

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
    };
    const e = streets[b.id]!;
    console.log(`${join(OUT, file)}: ${(e.bytes / 1024).toFixed(1)} KiB gz of ${(e.rawBytes / 1024).toFixed(1)} KiB, `
      + `${e.roads} streets from ${ways.roads} ways (${e.named} named), ${out.arcs.length} arcs`);
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
