# Part 2 — Data build: street vectors (spec §9.2)

Task 2 produces committed data files only. Nothing the page draws changes yet. Read spec §4 and planning rulings
R6 (no buildings), R7 (TopoJSON), R16 (ways only) and R21 (Overpass etiquette) first.

Conventions: `node --experimental-strip-types scripts/<name>.ts`; raw answers cached in the git-ignored `.cache/`;
committed output in `src/map/data/`; `npm run check && npm test` before committing.

---

### Task 2: Overpass fetch, simplification and the street TopoJSON

**Files:**
- Create: `scripts/build-city-streets.ts`
- Create (generated, committed): `src/map/data/city/streets/<id>.json` × 12, `src/map/data/city/streets/manifest.json`
- Modify: `package.json` (script `data:city-streets`)
- Test: `tests/unit/city-streets-data.test.ts`

**Interfaces:**
- Consumes: `src/map/data/city/boxes.json` from Task 1 —
  `{ widthM: 6000, heightM: 4000, boxes: [{ id, lat, lon, note, source, photoWidth, photoHeight, quality, west, south, east, north }, …] }`,
  twelve entries in the order `katowice, greenwich, mitaddelmundo, rovaniemi, warsaw, krakow, paris, manhattan, delhi, sydney, tokyo, giza`.
- Produces:
  ```ts
  // src/map/data/city/streets/<id>.json — a quantized TopoJSON topology with these objects:
  //   roads        GeometryCollection<{ c: StreetClass; n?: string; e?: string }>   (LineString / MultiLineString)
  //                n = OSM `name` (the name on the street sign), e = OSM `name:en` when it is present and
  //                different — the map uses `e` only where `n` is in a script the reader cannot read (ruling R24)
  //   rail         GeometryCollection<{}>
  //   waterways    GeometryCollection<{}>
  //   water        GeometryCollection<{}>   (Polygon / MultiPolygon)
  //   green        GeometryCollection<{}>   (Polygon / MultiPolygon)
  // plus a top-level  "places": { id: string; name: string; lat: number; lon: number }[]
  // and a top-level  "source": string
  // StreetClass: 0 motorway/trunk, 1 primary, 2 secondary, 3 tertiary, 4 residential/unclassified/living street,
  //              5 pedestrian
  // src/map/data/city/streets/manifest.json
  interface StreetEntry { file: string; bytes: number; arcs: number; roads: number; named: number; english: number;
    rail: number; water: number; green: number; places: number; retrieved: string }
  interface StreetManifest { generatedBy: string; attribution: string; streets: Record<string, StreetEntry> }
  ```

---

- [ ] **Step 1: Confirm the exact Overpass call before anything depends on it**

A bare request answers **406**. It needs a real `User-Agent` *and* a POSTed query. Verify both halves:

```bash
UA='geo-coordinates-lesson/1.0 (school lesson build; yurii@serhiichuk.dev)'
curl -s -o /dev/null -w '%{http_code}\n' https://overpass-api.de/api/status                 # expect 406
curl -s -A "$UA" https://overpass-api.de/api/status | head -3                                # expect "Connected as: …"
curl -s -A "$UA" -X POST --data-urlencode \
  'data=[out:json][timeout:60];way["highway"="motorway"](50.2420,18.9778,50.2780,19.0622);out geom;' \
  https://overpass-api.de/api/interpreter -o /tmp/ov-check.json -w '%{http_code} %{size_download}\n'
head -c 300 /tmp/ov-check.json
```
Expected: `406`, then a status listing with a rate limit and free slots, then `200` with a JSON body whose
`osm3s.copyright` says "The data included in this document is from www.openstreetmap.org. The data is made
available under ODbL." If the third call does not return 200, stop and report — do not invent a workaround.
Note the bbox order: Overpass takes **(south, west, north, east)**.

- [ ] **Step 2: Write the failing test `tests/unit/city-streets-data.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import boxesJson from '../../src/map/data/city/boxes.json';
import manifest from '../../src/map/data/city/streets/manifest.json';
import { decodeArcs } from '../../src/map/world';

const DIR = 'src/map/data/city/streets/';
const OBJECTS = ['roads', 'rail', 'waterways', 'water', 'green'] as const;
type StreetTopology = Topology<Record<(typeof OBJECTS)[number], GeometryCollection>> &
  { places: { id: string; name: string; lat: number; lon: number }[]; source: string };

const topo = (id: string) => JSON.parse(readFileSync(DIR + `${id}.json`, 'utf8')) as StreetTopology;
const ids = boxesJson.boxes.map((b) => b.id);

describe('city street data', () => {
  test('one file per box, listed in the manifest, with the ODbL attribution recorded once', () => {
    expect(Object.keys(manifest.streets)).toEqual(ids);
    expect(manifest.attribution).toBe('© OpenStreetMap contributors (ODbL)');
    for (const id of ids) {
      const e = manifest.streets[id as keyof typeof manifest.streets];
      expect(e.file, id).toBe(`${id}.json`);
      expect(e.bytes, id).toBe(readFileSync(DIR + e.file).length);
      expect(e.retrieved, id).toMatch(/^\d{4}-\d\d-\d\d$/);
    }
  });

  test('every topology has the five objects, is quantized, and names OpenStreetMap as its source', () => {
    for (const id of ids) {
      const t = topo(id);
      expect(Object.keys(t.objects).sort(), id).toEqual([...OBJECTS].sort());
      expect(t.transform, id).toBeDefined();          // quantized: arcs are integer deltas
      expect(t.source, id).toMatch(/OpenStreetMap/);
      expect(Array.isArray(t.places), id).toBe(true);
    }
  });

  test('every vertex is inside its own box (with a 5 % margin for a way that leaves and returns)', () => {
    for (const b of boxesJson.boxes) {
      const t = topo(b.id);
      const padLon = (b.east - b.west) * 0.05, padLat = (b.north - b.south) * 0.05;
      for (const arc of decodeArcs(t)) {
        for (const [lon, lat] of arc) {
          expect(lon >= b.west - padLon && lon <= b.east + padLon, `${b.id} lon ${lon}`).toBe(true);
          expect(lat >= b.south - padLat && lat <= b.north + padLat, `${b.id} lat ${lat}`).toBe(true);
        }
      }
      for (const p of t.places) {
        expect(p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north, `${b.id} place ${p.id}`).toBe(true);
      }
    }
  });

  test('road classes are 0-5 and every box has at least a main road and some residential streets', () => {
    for (const id of ids) {
      const roads = feature(topo(id) as never, topo(id).objects.roads as never) as GeoJSON.FeatureCollection;
      const classes = new Set(roads.features.map((f) => (f.properties as { c: number }).c));
      for (const c of classes) expect(c, `${id} class ${c}`).toBeGreaterThanOrEqual(0);
      for (const c of classes) expect(c, `${id} class ${c}`).toBeLessThanOrEqual(5);
      expect([...classes].some((c) => c <= 2), `${id} has no main road`).toBe(true);
      expect(classes.has(4), `${id} has no residential streets`).toBe(true);
      expect(roads.features.length, id).toBeGreaterThan(50);
    }
  });

  test('an English name is kept only where it differs from the local one (planning ruling R24)', () => {
    for (const id of ids) {
      const t = topo(id);
      const roads = feature(t as never, t.objects.roads as never) as GeoJSON.FeatureCollection;
      for (const f of roads.features) {
        const p = f.properties as { n?: string; e?: string };
        if (p.e !== undefined) {
          expect(p.n, `${id} ${p.e}`).toBeTruthy();
          expect(p.e, `${id} ${p.e}`).not.toBe(p.n);
        }
      }
      expect(manifest.streets[id as keyof typeof manifest.streets].english, id)
        .toBe(roads.features.filter((f) => 'e' in (f.properties ?? {})).length);
    }
    // Tokyo's street names are in Japanese, so that box is the one that needs them.
    expect(manifest.streets.tokyo.english).toBeGreaterThan(0);
  });

  test('Katowice, the school box, has the features the lesson points at', () => {
    const t = topo('katowice');
    const roads = feature(t as never, t.objects.roads as never) as GeoJSON.FeatureCollection;
    const named = roads.features.filter((f) => typeof (f.properties as { n?: string }).n === 'string');
    expect(named.length).toBeGreaterThan(80);
    expect(manifest.streets.katowice.named).toBe(named.length);
    expect(manifest.streets.katowice.rail).toBeGreaterThan(0);     // the station's tracks
    expect(manifest.streets.katowice.green).toBeGreaterThan(0);    // parks
  });

  test('every file stays inside its byte ceiling, and the twelve inside the budget', () => {
    let total = 0;
    for (const id of ids) {
      const e = manifest.streets[id as keyof typeof manifest.streets];
      total += e.bytes;
      // Planning ruling R22: 200 KiB a box; Katowice's roads alone measured 113 KiB during planning.
      expect(e.bytes, `${id} (${(e.bytes / 1024).toFixed(1)} KiB)`).toBeLessThanOrEqual(200 * 1024);
    }
    expect(total, `${(total / 1024 / 1024).toFixed(2)} MiB`).toBeLessThan(1.9 * 1024 * 1024);
  });

  test('no building outlines anywhere (planning ruling R6: they would be 12-25 MB)', () => {
    for (const id of ids) expect(Object.keys(topo(id).objects), id).not.toContain('buildings');
  });
});
```

```bash
npx vitest run tests/unit/city-streets-data.test.ts
```
Expected: FAIL — cannot resolve `src/map/data/city/streets/manifest.json`.

- [ ] **Step 3: Write `scripts/build-city-streets.ts`**

```ts
// Builds src/map/data/city/streets/<id>.json — the street map inside each city close-up box (Places up close
// spec §4). One quantized, Visvalingam-simplified TopoJSON per box, read at runtime by src/map/streets.ts through
// the same world.ts level-of-detail machinery every other vector layer uses (planning ruling R7).
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
/** 1e-5 degrees is about 1.1 m: finer than any line this map draws at the deepest zoom. */
const QUANTIZATION = 1e5;
/** Visvalingam weight in square degrees ≈ a 3 m triangle at these latitudes; tuned to land under 200 KiB a box. */
const MIN_WEIGHT = 7e-10;

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
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${id} (504 means it was busy: run again for this box)`);
  const text = await res.text();
  writeFileSync(path, text);
  return JSON.parse(text) as OverpassAnswer;
}

const closed = (g: { lat: number; lon: number }[]) =>
  g.length > 3 && g[0]!.lat === g[g.length - 1]!.lat && g[0]!.lon === g[g.length - 1]!.lon;
const line = (g: { lat: number; lon: number }[]): Position[] => g.map((p) => [p.lon, p.lat]);

/** A ring wound the way d3 reads an outline on the sphere: clockwise, so the planar shoelace sum is negative. */
function ring(points: Position[]): Position[] {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j]![0]! * points[i]![1]! - points[i]![0]! * points[j]![1]!;
  }
  return sum < 0 ? points : [...points].reverse();
}

interface Built { collections: Record<string, FeatureCollection>; places: { id: string; name: string; lat: number; lon: number }[] }

function collect(answer: OverpassAnswer): Built {
  const make = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
  const collections = { roads: make(), rail: make(), waterways: make(), water: make(), green: make() };
  const places: Built['places'] = [];
  for (const el of answer.elements) {
    if (el.type === 'node') {
      const name = el.tags?.name;
      if (name && PLACE_KINDS.has(el.tags?.place ?? '')) places.push({ id: `n${el.id}`, name, lat: el.lat, lon: el.lon });
      continue;
    }
    const g = el.geometry;
    const tags = el.tags ?? {};
    if (!g || g.length < 2) continue;
    const push = (into: FeatureCollection, geometry: LineString | Polygon, properties: Record<string, unknown>) =>
      into.features.push({ type: 'Feature', id: el.id, properties, geometry } as Feature);
    const cls = ROAD_CLASS.get(tags.highway ?? '');
    if (cls !== undefined) {
      // `name` is the name on the street sign; `name:en` is kept only where it says something different, for the
      // boxes whose local names are in a script a pupil here cannot read (spec §4, planning ruling R24).
      const name = tags.name;
      const english = tags['name:en'];
      const props: Record<string, unknown> = { c: cls };
      if (name) props.n = name;
      if (name && english && english !== name) props.e = english;
      push(collections.roads, { type: 'LineString', coordinates: line(g) }, props);
    } else if (RAIL.has(tags.railway ?? '')) {
      push(collections.rail, { type: 'LineString', coordinates: line(g) }, {});
    } else if (WATERWAY.has(tags.waterway ?? '')) {
      push(collections.waterways, { type: 'LineString', coordinates: line(g) }, {});
    } else if (tags.natural === 'water' && closed(g)) {
      push(collections.water, { type: 'Polygon', coordinates: [ring(line(g))] }, {});
    } else if ((GREEN_LEISURE.has(tags.leisure ?? '') || GREEN_LANDUSE.has(tags.landuse ?? '')) && closed(g)) {
      push(collections.green, { type: 'Polygon', coordinates: [ring(line(g))] }, {});
    }
  }
  return { collections, places };
}

type StreetTopology = Topology<Record<'roads' | 'rail' | 'waterways' | 'water' | 'green', GeometryCollection>>;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const onlyArg = args.indexOf('--only');
  const only = onlyArg >= 0 ? new Set(args[onlyArg + 1]!.split(',')) : null;
  mkdirSync(OUT, { recursive: true });
  const manifestPath = join(OUT, 'manifest.json');
  const streets: Record<string, unknown> = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { streets: Record<string, unknown> }).streets
    : {};

  for (const b of boxes.boxes) {
    if (only && !only.has(b.id)) continue;
    const answer = await overpass(b.id, query(b), refresh);
    const { collections, places } = collect(answer);
    const raw = topology(collections as never) as unknown as StreetTopology;
    const out = quantize(simplify(presimplify(raw), MIN_WEIGHT), QUANTIZATION) as unknown as StreetTopology;
    const retrieved = (answer.osm3s?.timestamp_osm_base ?? new Date().toISOString()).slice(0, 10);
    const json = JSON.stringify({ ...out, places, source: `OpenStreetMap via Overpass, ${ATTRIBUTION}` });
    const file = `${b.id}.json`;
    writeFileSync(join(OUT, file), json);
    const count = (k: keyof typeof collections) => collections[k].features.length;
    streets[b.id] = {
      file, bytes: Buffer.byteLength(json, 'utf8'), arcs: out.arcs.length,
      roads: count('roads'), named: collections.roads.features.filter((f) => f.properties && 'n' in f.properties).length,
      english: collections.roads.features.filter((f) => f.properties && 'e' in f.properties).length,
      rail: count('rail'), water: count('water'), green: count('green'), places: places.length, retrieved,
    };
    const e = streets[b.id] as { bytes: number; roads: number; named: number };
    console.log(`${join(OUT, file)}: ${(e.bytes / 1024).toFixed(1)} KiB, ${e.roads} roads (${e.named} named), ${out.arcs.length} arcs`);
  }

  const ordered = Object.fromEntries(boxes.boxes.filter((b) => b.id in streets).map((b) => [b.id, streets[b.id]]));
  writeFileSync(manifestPath, `${JSON.stringify({ generatedBy: 'scripts/build-city-streets.ts', attribution: ATTRIBUTION, streets: ordered }, null, 1)}\n`);
  const total = Object.values(ordered).reduce((n, e) => n + (e as { bytes: number }).bytes, 0);
  console.log(`${manifestPath}: ${Object.keys(ordered).length} boxes, ${(total / 1024).toFixed(1)} KiB total`);
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
```

Add to `package.json` `"scripts"`: `"data:city-streets": "node --experimental-strip-types scripts/build-city-streets.ts"`.

- [ ] **Step 4: Build one box and check the size before doing all twelve**

```bash
npm run data:city-streets -- --only katowice
```
Expected: about 120–160 KiB, more than 2 000 roads, more than 80 named. If it is over 200 KiB, raise `MIN_WEIGHT`
by a factor of 3 (to `2.1e-9`) and run again; if it is still over, drop class 5 from `ROAD_CLASSES` for that build
and record it. Do not lower `QUANTIZATION` below `1e5` — 1.1 m is already coarser than the finest line the map
draws at zoom 6000 (1 map unit ≈ 0.7 m).

- [ ] **Step 5: Build the other eleven**

```bash
npm run data:city-streets
```
Overpass may answer **504** when it is busy; that is not a bug. Re-run the failed box on its own
(`-- --only <id>`) after a minute. Check `.cache/overpass/` has twelve files afterwards; those are the raw
answers, git-ignored, and re-running without `--refresh` will never call Overpass again.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run tests/unit/city-streets-data.test.ts
```
Expected: PASS. Manhattan, Tokyo and Delhi are the other dense ones and are the likeliest to need Step 4's
`MIN_WEIGHT` treatment; Mitad del Mundo and Rovaniemi will be small (a few tens of KiB).

- [ ] **Step 7: Check the whole suite and commit**

```bash
npm run check && npm test
git add scripts/build-city-streets.ts src/map/data/city/streets tests/unit/city-streets-data.test.ts package.json
git commit -m "feat(data): OpenStreetMap street vectors for the twelve close-up boxes"
```

**Report:** the exact Overpass call that worked (Step 1); per box the bytes, arcs, roads, named roads, roads with
an English name, rail, water, green and places; the total and what it does to the budget (photos from Task 1 + streets + the current 3,387,703 B
against 8,388,608 B); any box that needed a higher `MIN_WEIGHT` or lost class 5; any box with surprisingly little
data (which would show as a bare street map in Task 6 and should be checked against openstreetmap.org by eye).
