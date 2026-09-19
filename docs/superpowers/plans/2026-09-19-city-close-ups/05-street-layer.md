# Part 5 — The street layer and its names (spec §9.5)

Task 6 draws the streets, in all four styles, with names that can never displace the lesson's own labels. Read
spec §5 and planning rulings R14 (streets in every style), R16 (ways only), R19 (names placed by `styleLabels.ts`)
first.

---

### Task 6: The street layer and its names, in all four styles

**Files:**
- Create: `src/map/streets.ts`, `src/map/layers/Streets.svelte`
- Modify: `src/map/layers/Layers.svelte`, `src/map/layers/Places.svelte`, `src/map/styleLabels.ts`,
  `src/styles/tokens.css`, `src/styles/base.css`
- Test: `tests/unit/streets.test.ts`, `tests/unit/street-labels.test.ts`, `tests/e2e/city-streets.spec.ts`

**Interfaces:**
- Consumes (Tasks 1–5):
  - `src/map/cityBoxes.ts`: `CityBox { id, lat, lon, bounds, fitZoom, note }`, `CityBoxId`, `CITY_BOXES`,
    `CITY_STREET_ZOOM = 24`, `visibleCityBox(view: GeoBounds, zoom: number): CityBox | null`.
  - `src/map/world.ts`: `levelOfDetail<Topo, T>(topo, levels, build): (zoom) => T`, `lineParts(g: MultiLineString)`,
    `polygonParts(g: MultiPolygon)`, `asMultiPolygon(fc)`, `visibleParts<T>(parts, view): T[]`, `Part<T> { bounds, coordinates }`,
    `ArcTopology { arcs: number[][][]; transform?: { scale: number[]; translate: number[] } }`.
  - `src/map/labelLayout.ts`: `LabelBox`, `textBox(x, y, width, height, anchor)`, `selectLabelPlacements`, `overlaps`.
  - `src/map/styleLabels.ts`: `StyleLabel { id, text, x, y, size, box }`.
  - `src/map/brackets.ts`: `labelWidth(text: string, size: number, px: number): number`.
  - `MapState.closeUps` (Task 4); the page's `<script type="application/x-geo-city" id="geo-city-<id>">` blocks (Task 3).
  - Street topology objects: `roads` (`LineString`/`MultiLineString`, properties `{ c: 0…5; n?: string; e?: string }`
    — `n` is OSM `name`, `e` is `name:en` when present and different), `rail`, `waterways` (lines), `water`,
    `green` (polygons); top-level `places: { id, name, lat, lon }[]`.
  - `src/geo/types.ts`: `LangCode` (`'en' | 'pl' | 'uk'`); `src/i18n/i18n.svelte.ts`: `i18n.lang`.
- Produces:
  ```ts
  // src/map/streets.ts
  export type StreetClass = 0 | 1 | 2 | 3 | 4 | 5;
  export const STREET_CLASS_MIN_ZOOM: readonly number[];
  export const STREET_NAME_ZOOM = 900;
  export const PLACE_NAME_ZOOM = 200;
  export function streetFade(zoom: number): number;             // 0 at CITY_STREET_ZOOM, 1 one octave above
  export function readableName(local: string, english: string | undefined, lang: LangCode): string;
  export interface StreetName { id: string; text: string; lat: number; lon: number; cls: StreetClass }
  export interface StreetLayers {
    roads: { cls: StreetClass; line: GeoJSON.MultiLineString }[];
    rail: GeoJSON.MultiLineString;
    waterways: GeoJSON.MultiLineString;
    water: GeoJSON.MultiPolygon;
    green: GeoJSON.MultiPolygon;
    names: StreetName[];
  }
  export function streetsFor(box: CityBox, zoom: number, view: GeoBounds, lang: LangCode): StreetLayers;
  export function streetsLoaded(id: CityBoxId): boolean;
  export function loadStreets(id: CityBoxId): void;
  // src/map/styleLabels.ts
  export const STREET_FONT = 10;
  export function placeStreetLabels(ctx: ViewCtx, box: CityBox, lang: LangCode, obstacles: readonly LabelBox[]): StyleLabel[];
  ```

---

- [ ] **Step 1: Write the failing test `tests/unit/streets.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { cityBoxById, CITY_STREET_ZOOM } from '../../src/map/cityBoxes';
import { loadStreets, readableName, streetFade, streetsFor, streetsLoaded, STREET_CLASS_MIN_ZOOM } from '../../src/map/streets';
import type { GeoBounds } from '../../src/map/geometry';

const box = cityBoxById('katowice')!;
const all: GeoBounds = box.bounds;

/** The data blocks the page carries are made by scripts/city-plugin.ts; in a unit test, put one in the DOM. */
function putBlock(id: string): void {
  const el = document.createElement('script');
  el.type = 'application/x-geo-city';
  el.id = `geo-city-${id}`;
  el.textContent = readFileSync(`src/map/data/city/streets/${id}.json`, 'utf8');
  document.body.append(el);
}

beforeAll(() => putBlock('katowice'));

describe('city streets', () => {
  test('a box is parsed only when it is first asked for', () => {
    expect(streetsLoaded('warsaw')).toBe(false);
    loadStreets('katowice');
    expect(streetsLoaded('katowice')).toBe(true);
    expect(() => loadStreets('warsaw')).toThrow(/geo-city-warsaw/);
  });

  test('at the fit zoom every road class is drawn, with the classes in order', () => {
    const s = streetsFor(box, box.fitZoom, all, 'en');
    expect(s.roads.map((r) => r.cls)).toEqual([0, 1, 2, 3, 4, 5].filter((c) => s.roads.some((r) => r.cls === c)));
    expect(s.roads.length).toBeGreaterThan(3);
    expect(s.roads.every((r) => r.line.coordinates.length > 0)).toBe(true);
    expect(s.rail.coordinates.length).toBeGreaterThan(0);
    expect(s.green.coordinates.length).toBeGreaterThan(0);
  });

  test('zoomed out, only the main roads are drawn; zoomed in, the small ones join', () => {
    const wide = streetsFor(box, 60, all, 'en');
    const close = streetsFor(box, box.fitZoom, all, 'en');
    expect(Math.max(...wide.roads.map((r) => r.cls))).toBeLessThan(Math.max(...close.roads.map((r) => r.cls)));
    for (const r of wide.roads) expect(60, `class ${r.cls}`).toBeGreaterThanOrEqual(STREET_CLASS_MIN_ZOOM[r.cls]!);
    expect(STREET_CLASS_MIN_ZOOM).toHaveLength(6);
    expect(STREET_CLASS_MIN_ZOOM[0]).toBe(CITY_STREET_ZOOM);
    for (let i = 1; i < 6; i++) expect(STREET_CLASS_MIN_ZOOM[i]!).toBeGreaterThan(STREET_CLASS_MIN_ZOOM[i - 1]!);
  });

  test('only the part of the box the view can see is built', () => {
    const half: GeoBounds = { west: box.bounds.west, south: box.bounds.south, east: box.lon, north: box.lat };
    const part = streetsFor(box, box.fitZoom, half, 'en');
    const whole = streetsFor(box, box.fitZoom, all, 'en');
    const count = (s: typeof whole) => s.roads.reduce((n, r) => n + r.line.coordinates.length, 0);
    expect(count(part)).toBeLessThan(count(whole));
    expect(count(part)).toBeGreaterThan(0);
  });

  test('names appear only when a street name could be read, and never twice', () => {
    expect(streetsFor(box, 100, all, 'en').names).toEqual([]);
    const names = streetsFor(box, box.fitZoom, all, 'en').names;
    expect(names.length).toBeGreaterThan(10);
    expect(new Set(names.map((n) => n.text)).size).toBe(names.length);
    for (const n of names) {
      expect(n.text.trim(), n.id).not.toBe('');
      expect(n.lat >= box.bounds.south && n.lat <= box.bounds.north, n.id).toBe(true);
      expect(n.lon >= box.bounds.west && n.lon <= box.bounds.east, n.id).toBe(true);
    }
  });

  test('a name in a script the reader cannot read falls back to name:en (planning ruling R24)', () => {
    expect(readableName('Rue de Rivoli', 'Rivoli Street', 'pl')).toBe('Rue de Rivoli');
    expect(readableName('青梅街道', 'Ome-kaido Avenue', 'en')).toBe('Ome-kaido Avenue');
    expect(readableName('青梅街道', 'Ome-kaido Avenue', 'uk')).toBe('Ome-kaido Avenue');
    expect(readableName('青梅街道', undefined, 'en')).toBe('青梅街道');       // nothing better to offer
    expect(readableName('Хрещатик', 'Khreshchatyk', 'uk')).toBe('Хрещатик'); // Cyrillic is readable in Ukrainian
    expect(readableName('Хрещатик', 'Khreshchatyk', 'pl')).toBe('Khreshchatyk');
    expect(readableName('कनॉट प्लेस', 'Connaught Place', 'pl')).toBe('Connaught Place');
  });

  test('the layer fades in over one octave from the street zoom', () => {
    expect(streetFade(CITY_STREET_ZOOM)).toBe(0);
    expect(streetFade(CITY_STREET_ZOOM * 1.5)).toBeCloseTo(0.5, 10);
    expect(streetFade(CITY_STREET_ZOOM * 2)).toBe(1);
    expect(streetFade(4000)).toBe(1);
    expect(streetFade(12)).toBe(0);
  });
});
```

`vitest.config.ts` must give this test a DOM. Read it: if `environment` is not already `'jsdom'` or `'happy-dom'`
for `tests/unit`, add a per-file directive at the top of `tests/unit/streets.test.ts` instead of changing the
project config:
```ts
// @vitest-environment jsdom
```
and check `jsdom` is available (`node -e "require.resolve('jsdom')"`); if it is not, use `happy-dom` if that is
present, and if neither is, replace the DOM in this test with a tiny stub:
```ts
(globalThis as { document?: unknown }).document = {
  getElementById: (id: string) => (id === 'geo-city-katowice'
    ? { textContent: readFileSync('src/map/data/city/streets/katowice.json', 'utf8') } : null),
};
```
Say in the report which of the three you used.

- [ ] **Step 2: Write `src/map/streets.ts`**

```ts
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import { CITY_STREET_ZOOM, type CityBox, type CityBoxId } from './cityBoxes';
import type { GeoBounds } from './geometry';
import { asMultiPolygon, levelOfDetail, lineParts, polygonParts, visibleParts, type Part } from './world';

/*
 * The street map inside a city close-up box (Places up close spec §5): roads by class, railways, waterways, water
 * bodies and green areas from OpenStreetMap (scripts/build-city-streets.ts), plus the street and place names.
 * There are no building outlines: they measured 2.3 MB for one box, which is a quarter of the whole file budget
 * (planning ruling R6); in the six boxes with orthophotos the photo itself shows the buildings.
 *
 * Each box's topology is a data block in the page (scripts/city-plugin.ts), parsed the first time the view enters
 * that box and then kept: a page that never opens a close-up never parses 1.7 MB of JSON (planning ruling R8).
 */
export type StreetClass = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * The flat zoom each road class first appears at. Class 0 (motorways and trunk roads) comes in with the layer
 * itself; the smaller classes join as the box grows, so a box that is still a smudge across the view is a few
 * strokes rather than a scribble. The fit zooms are 2 659 to 5 009, so every class is drawn once a box fills
 * the view.
 */
export const STREET_CLASS_MIN_ZOOM: readonly number[] = [CITY_STREET_ZOOM, 60, 150, 400, 900, 2000];
/** Street names need a street wide enough to write along: about a fifth of the way to the fit zoom. */
export const STREET_NAME_ZOOM = 900;
/** District names (OSM `place=suburb|quarter|neighbourhood`) come earlier — they name a whole area. */
export const PLACE_NAME_ZOOM = 200;

/** The layer's opacity: it fades in over one octave from CITY_STREET_ZOOM rather than appearing all at once (spec §5). */
export function streetFade(zoom: number): number {
  return Math.max(0, Math.min(1, (zoom - CITY_STREET_ZOOM) / CITY_STREET_ZOOM));
}

export interface StreetName { id: string; text: string; lat: number; lon: number; cls: StreetClass }

/**
 * The name to write on a street: OpenStreetMap's local `name` — the name on the street sign — unless it is
 * written in a script this page's language does not use, in which case `name:en` where the data has one
 * (spec §4, planning ruling R24). Latin for English and Polish; Latin or Cyrillic for Ukrainian. A Tokyo street
 * called 青梅街道 is useless to a pupil in Katowice; a Paris street called Rue de Rivoli is exactly right.
 */
const READABLE: Record<LangCode, RegExp> = {
  en: /\p{Script=Latin}/u, pl: /\p{Script=Latin}/u, uk: /\p{Script=Latin}|\p{Script=Cyrillic}/u,
};
export function readableName(local: string, english: string | undefined, lang: LangCode): string {
  return READABLE[lang].test(local) || !english ? local : english;
}

export interface StreetLayers {
  roads: { cls: StreetClass; line: GeoJSON.MultiLineString }[];
  rail: GeoJSON.MultiLineString;
  waterways: GeoJSON.MultiLineString;
  water: GeoJSON.MultiPolygon;
  green: GeoJSON.MultiPolygon;
  names: StreetName[];
}

interface RoadProps { c: StreetClass; n?: string; e?: string }
type StreetTopology = Topology<{
  roads: GeometryCollection<RoadProps>; rail: GeometryCollection; waterways: GeometryCollection;
  water: GeometryCollection; green: GeometryCollection;
}> & { places: { id: string; name: string; lat: number; lon: number }[] };

/** A name before the page language has chosen between the local and the English form (`readableName`). */
interface NameCandidate { id: string; local: string; english?: string; lat: number; lon: number; cls: StreetClass }

interface BoxData {
  roads: { cls: StreetClass; parts: Part<GeoJSON.Position[]>[] }[];
  rail: Part<GeoJSON.Position[]>[];
  waterways: Part<GeoJSON.Position[]>[];
  water: Part<GeoJSON.Position[][]>[];
  green: Part<GeoJSON.Position[][]>[];
  /** One candidate point per distinct street name, at the middle of its longest way. */
  names: NameCandidate[];
  /** District names (OSM `place` nodes): the same at every level of detail. */
  places: NameCandidate[];
}

/*
 * Level of detail by flat zoom, the same shared helper the Central Europe data, Political and Physical use
 * (world.ts): arcs are thinned to half a map unit at the level's zoom. The ladder is geared to the range a box is
 * actually looked at in — from a smudge at zoom 24 to filling the view at 2 659-5 009 — and the finest level
 * thins to about 3.5 m, which is under one map unit at zoom 6000.
 */
const LEVELS = [24, 100, 400, 1600, 6000] as const;

const boxes = new Map<CityBoxId, (zoom: number) => BoxData>();

export function streetsLoaded(id: CityBoxId): boolean {
  return boxes.has(id);
}

/** Longest way wins: a street is many OSM ways, and its name goes on the longest piece inside the box. */
function nameCandidates(t: StreetTopology, roads: readonly (GeometryObject & { properties: RoadProps })[]): NameCandidate[] {
  const best = new Map<string, { len: number; name: NameCandidate }>();
  roads.forEach((g, i) => {
    const local = g.properties.n;
    if (local === undefined) return;
    const line = mesh(t as never, { type: 'GeometryCollection', geometries: [g] } as never);
    const run = line.coordinates.reduce((a, b) => (b.length > a.length ? b : a), [] as GeoJSON.Position[]);
    if (run.length < 2) return;
    let len = 0;
    for (let k = 1; k < run.length; k++) len += Math.hypot(run[k]![0]! - run[k - 1]![0]!, run[k]![1]! - run[k - 1]![1]!);
    const prev = best.get(local);
    if (prev && prev.len >= len) return;
    const mid = run[Math.floor(run.length / 2)]!;
    best.set(local, { len, name: { id: `r${i}`, local, english: g.properties.e, lat: mid[1]!, lon: mid[0]!, cls: g.properties.c } });
  });
  return [...best.values()].map((b) => b.name);
}

function build(t: StreetTopology, places: NameCandidate[]): BoxData {
  const roadGeoms = t.objects.roads.geometries as unknown as (GeometryObject & { properties: RoadProps })[];
  const byClass = new Map<StreetClass, (GeometryObject & { properties: RoadProps })[]>();
  for (const g of roadGeoms) {
    const list = byClass.get(g.properties.c) ?? [];
    list.push(g);
    byClass.set(g.properties.c, list);
  }
  const lines = (key: 'rail' | 'waterways') => lineParts(mesh(t as never, t.objects[key] as never));
  const areas = (key: 'water' | 'green') => polygonParts(asMultiPolygon(feature(t as never, t.objects[key] as never) as GeoJSON.FeatureCollection));
  return {
    roads: [...byClass.entries()].sort((a, b) => a[0] - b[0]).map(([cls, geoms]) => ({
      cls, parts: lineParts(mesh(t as never, { type: 'GeometryCollection', geometries: geoms } as never)),
    })),
    rail: lines('rail'),
    waterways: lines('waterways'),
    water: areas('water'),
    green: areas('green'),
    names: nameCandidates(t, roadGeoms),
    places,
  };
}

/** Parses the box's data block. Throws (so the layer's error boundary drops it, spec §5) when the block is missing. */
export function loadStreets(id: CityBoxId): void {
  if (boxes.has(id)) return;
  const block = document.getElementById(`geo-city-${id}`);
  if (!block?.textContent) throw new Error(`street data for ${id} is missing from the page (geo-city-${id})`);
  const topo = JSON.parse(block.textContent) as StreetTopology;
  // District names have no geometry to thin, so they are read once and handed to every level of detail.
  const places: NameCandidate[] = topo.places.map((p) => ({ id: p.id, local: p.name, lat: p.lat, lon: p.lon, cls: 0 }));
  boxes.set(id, levelOfDetail(topo as never, LEVELS, (t) => build(t as unknown as StreetTopology, places)));
}

/** Everything of `box` a view at flat `zoom` covering `view` draws. Call only inside the box (`visibleCityBox`). */
export function streetsFor(box: CityBox, zoom: number, view: GeoBounds, lang: LangCode): StreetLayers {
  loadStreets(box.id);
  const d = boxes.get(box.id)!(zoom);
  const named = zoom >= STREET_NAME_ZOOM ? d.names.filter((n) => n.cls <= 4) : [];
  const districts = zoom >= PLACE_NAME_ZOOM ? d.places : [];
  const resolve = (n: NameCandidate): StreetName =>
    ({ id: n.id, text: readableName(n.local, n.english, lang), lat: n.lat, lon: n.lon, cls: n.cls });
  return {
    roads: d.roads
      .filter((r) => zoom >= STREET_CLASS_MIN_ZOOM[r.cls]!)
      .map((r) => ({ cls: r.cls, line: { type: 'MultiLineString' as const, coordinates: visibleParts(r.parts, view) } }))
      .filter((r) => r.line.coordinates.length > 0),
    rail: { type: 'MultiLineString', coordinates: visibleParts(d.rail, view) },
    waterways: { type: 'MultiLineString', coordinates: visibleParts(d.waterways, view) },
    water: { type: 'MultiPolygon', coordinates: visibleParts(d.water, view) },
    green: { type: 'MultiPolygon', coordinates: visibleParts(d.green, view) },
    names: [...districts, ...named].map(resolve),
  };
}
```
Imports to add beside the others: `import type { LangCode } from '../geo/types';`.

```bash
npx vitest run tests/unit/streets.test.ts
```
Expected: PASS. If `levelOfDetail`'s thinning has flattened too much at the coarsest level, raise `LEVELS[0]` to
`CITY_STREET_ZOOM * 2` and say so — never lower `CITY_STREET_ZOOM` itself, which is what keeps the Atlas baseline
at zoom 12 untouched (planning ruling R3).

- [ ] **Step 3: `src/map/layers/Streets.svelte`**

```svelte
<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import { visibleCityBox } from '../cityBoxes';
  import type { ViewCtx } from '../geometry';
  import { useMapState } from '../mapStateContext';
  import type { MapStyle } from '../mapStyle';
  import { i18n } from '../../i18n/i18n.svelte';
  import { streetFade, streetsFor } from '../streets';
  const mapState = useMapState();
  // Drawn above the photo and below the graticule, in all four styles: in Atlas and Political the street map
  // appears without a photo, which suits those styles (Places up close spec §5, planning ruling R14). `style`
  // comes from Layers.svelte, the one place that decides what this map draws.
  let { ctx, style }: { ctx: ViewCtx; style: MapStyle } = $props();
  const box = $derived(mapState.closeUps ? visibleCityBox(ctx.bounds, ctx.zoom) : null);
  const layers = $derived.by(() => {
    if (!box) return null;
    if (testFlag('vector') === 'fail') throw new Error('street layer failure forced for a test');
    return streetsFor(box, ctx.zoom, ctx.bounds, i18n.lang);
  });
  const fade = $derived(streetFade(ctx.zoom));
  const d = (g: GeoJSON.Geometry) => ctx.regionPath(g) ?? '';
  const greenD = $derived(layers ? d(layers.green) : '');
  const waterD = $derived(layers ? d(layers.water) : '');
  const waterwaysD = $derived(layers ? d(layers.waterways) : '');
  const railD = $derived(layers ? d(layers.rail) : '');
  const roads = $derived(layers ? layers.roads.map((r) => ({ cls: r.cls, d: d(r.line) })).filter((r) => r.d) : []);
  // Political already paints its own country colours; a green wash over them reads as a third colour, so the
  // area fills are left out there and only the lines are drawn.
  const areas = $derived(style !== 'political');
</script>

<!-- Decorative: the names that matter are text, placed with everything else by Places.svelte (planning ruling R19). -->
{#if layers && fade > 0}
  <g class="streets" data-city-box={box?.id} style:opacity={fade} aria-hidden="true">
    {#if areas}
      <path class="green" d={greenD} />
      <path class="water" d={waterD} />
    {/if}
    <path class="waterway" d={waterwaysD} />
    <path class="rail" d={railD} />
    <!-- Casings first, all of them, then the fills: a junction then reads as roads crossing, not as a pile of strokes. -->
    {#each roads as r (r.cls)}<path class="casing c{r.cls}" d={r.d} />{/each}
    {#each roads as r (r.cls)}<path class="road c{r.cls}" d={r.d} />{/each}
  </g>
{/if}

<style>
  .streets { pointer-events: none; }
  .green { fill: var(--street-green); stroke: none; }
  .water { fill: var(--street-water); stroke: none; }
  .waterway { fill: none; stroke: var(--street-water); stroke-width: calc(1.6px * var(--stroke-scale)); stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .rail { fill: none; stroke: var(--street-rail); stroke-width: calc(1.4px * var(--stroke-scale)); stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; }
  .casing { fill: none; stroke: var(--street-casing); stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .road { fill: none; stroke: var(--street-ink); stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  /* Motorways widest, footways thinnest; the casing is 2 px wider than its road at every class. */
  .casing.c0 { stroke-width: calc(8px * var(--stroke-scale)); } .road.c0 { stroke-width: calc(6px * var(--stroke-scale)); stroke: var(--street-major); }
  .casing.c1 { stroke-width: calc(6.5px * var(--stroke-scale)); } .road.c1 { stroke-width: calc(4.5px * var(--stroke-scale)); stroke: var(--street-major); }
  .casing.c2 { stroke-width: calc(5.5px * var(--stroke-scale)); } .road.c2 { stroke-width: calc(3.5px * var(--stroke-scale)); }
  .casing.c3 { stroke-width: calc(4.5px * var(--stroke-scale)); } .road.c3 { stroke-width: calc(2.6px * var(--stroke-scale)); }
  .casing.c4 { stroke-width: calc(3.4px * var(--stroke-scale)); } .road.c4 { stroke-width: calc(1.8px * var(--stroke-scale)); }
  .casing.c5 { stroke-width: calc(2.4px * var(--stroke-scale)); } .road.c5 { stroke-width: calc(1.1px * var(--stroke-scale)); stroke-dasharray: 3 3; }
</style>
```

Add the six tokens to `src/styles/tokens.css`, in both the light and the dark blocks, beside the existing
`--pol-*` / `--physical-*` map tokens (read the file and follow its shape). Start from these and let Task 8's
contrast pass adjust them:
```css
  --street-ink: #2b2b2b;        /* dark: #e6e6e6 */
  --street-major: #b4642a;      /* dark: #e08a45 */
  --street-casing: #f6f2ea;     /* dark: #1a1d22 */
  --street-rail: #6b6b6b;       /* dark: #a8a8a8 */
  --street-water: #7fb3d5;      /* dark: #3a6f95 */
  --street-green: #bcd9a6;      /* dark: #3d5a36 */
```
In `src/styles/base.css`, where the map-style overrides already live, make the street ink and casing swap over a
photo (Physical and Satellite draw the streets on an aerial photo, where a dark line on a light casing reads best
in both themes): follow the file's existing `[data-map-style]` pattern and set `--street-casing` to a translucent
light tone and `--street-ink` to near-black for those two styles in **both** themes.

- [ ] **Step 4: Put the layer in the stack (`src/map/layers/Layers.svelte`)**

"Above the photo and below the graticule" (spec §5). Insert right after the `Political` / `PhysicalWater` blocks
and before `<Hemispheres …>`:
```svelte
<svelte:boundary onerror={vectorFailed}><Streets {ctx} {style} /></svelte:boundary>
```
with `import Streets from './Streets.svelte';`. The existing `vectorFailed` handler is exactly the behaviour spec
§5 asks for — "a failure in the street layer disables that layer only" — because `reportHealth({ type: 'vector-fail' })`
already does that for the other vector layers. No condition on `style`: `Streets.svelte` decides for itself, and
it renders nothing outside a box.

- [ ] **Step 5: `placeStreetLabels` in `src/map/styleLabels.ts`**

```ts
export const STREET_FONT = 10;

/**
 * Street and district names inside a city close-up box (spec §5). Placed last of everything on the map: the
 * `obstacles` Places.svelte hands in are every label the lesson has already put down — places, schools, the point,
 * the special-line names, overlay texts and the edge numbers — so a street name is left out rather than pushed
 * over one of them (planning ruling R19). District names rank before street names, and within each group the ones
 * nearest the middle of the view go first, so the names stay steady while the map is panned.
 */
export function placeStreetLabels(ctx: ViewCtx, box: CityBox, lang: LangCode, obstacles: readonly LabelBox[]): StyleLabel[] {
  const size = STREET_FONT * ctx.px;
  const centre = ctx.center;
  const items = streetsFor(box, ctx.zoom, ctx.bounds, lang).names.flatMap((n) => {
    const xy = ctx.project(n);
    if (!xy || !insideView(ctx, xy)) return [];
    const width = labelWidth(n.text, STREET_FONT, ctx.px);
    const at = (dx: number, dy: number) => {
      const x = xy[0] + dx, y = xy[1] + size * 0.35 + dy;
      return { x, y, box: textBox(x, y, width, size, 'middle') };
    };
    const step = size * 1.2;
    const options = [at(0, 0), at(0, -step), at(0, step)]
      .filter((o) => o.box.left >= 0 && o.box.right <= ctx.width && o.box.top >= 0 && o.box.bottom <= ctx.height);
    if (options.length === 0) return [];
    // District names come first: their ids begin with `n` (an OSM node), a street name's with `r`
    // (see scripts/build-city-streets.ts and streets.ts). Within each group the names nearest the middle of the
    // view are placed first, with the distance bucketed so a small pan cannot make two of them swap.
    const distance = Math.hypot(n.lon - centre.lon, n.lat - centre.lat);
    return [{ id: n.id, text: n.text, options, rank: (n.id.startsWith('n') ? 0 : 1_000_000) + Math.round(distance * 1e5) }];
  });
  const chosen = selectLabelPlacements(items, (i) => i.options.map((o) => o.box), (i) => i.rank, obstacles);
  return items.flatMap((i, k) => {
    const o = chosen[k]! >= 0 ? i.options[chosen[k]!]! : null;
    return o ? [{ id: i.id, text: i.text, x: o.x, y: o.y, size, box: o.box }] : [];
  });
}
```
Imports to add:
`import type { CityBox } from './cityBoxes';`, `import type { LangCode } from '../geo/types';` and `import { streetsFor } from './streets';`
(`insideView`, `labelWidth`, `textBox`, `selectLabelPlacements`, `StyleLabel`, `LabelBox` are already in the file).

- [ ] **Step 6: Draw the names in `src/map/layers/Places.svelte`**

Read the file first. It already computes `overlayObstacles`, `lineObstacles`, `pointObstacles`,
`continentObstacles`, `edgeObstacles`, the place-name boxes and the country / physical style labels, and draws
them at the end. Add, after the country and physical label deriveds:

```ts
  // Street names go last of everything, with every other label as an obstacle: the lesson's own names always win
  // (spec §5, planning ruling R19). Only inside a box, only where the scene offers close-ups.
  const cityBox = $derived(mapState.closeUps ? visibleCityBox(ctx.bounds, ctx.zoom) : null);
  const streetLabels = $derived.by(() => {
    if (!cityBox || ctx.zoom < PLACE_NAME_ZOOM) return [];
    void i18n.lang;
    return placeStreetLabels(ctx, cityBox, i18n.lang, [
      ...overlayObstacles, ...lineObstacles, ...pointObstacles, ...continentObstacles, ...edgeObstacles,
      ...placeLabelBoxes, ...countryLabels.map((l) => l.box), ...physicalLabels.map((l) => l.box),
      ...chosenBoxes, ...lineAvoid,
    ]);
  });
```
with `import { visibleCityBox } from '../cityBoxes';`, `import { PLACE_NAME_ZOOM } from '../streets';` and
`placeStreetLabels` added to the existing `../styleLabels` import. Use whatever the file's own names for those
obstacle deriveds are — read them, do not guess — with `placeLabelBoxes` being the boxes of the place names this
layer has already placed. Then render them after the existing label
groups:
```svelte
{#each streetLabels as l (l.id)}
  <text class="street-name halo" x={l.x} y={l.y} font-size={l.size}>{l.text}</text>
{/each}
```
and a style rule beside the other name rules:
```css
  .street-name { fill: var(--street-name-ink); font-weight: 600; letter-spacing: 0.01em; paint-order: stroke fill; }
```
with `--street-name-ink` added to `tokens.css` next to the other street tokens (light `#3a3a3a`, dark `#eaeaea`).

- [ ] **Step 7: `tests/unit/street-labels.test.ts`**

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { cityBoxById } from '../../src/map/cityBoxes';
import { makeFlatCtx } from '../../src/map/geometry';
import { overlaps, type LabelBox } from '../../src/map/labelLayout';
import { placeStreetLabels, STREET_FONT } from '../../src/map/styleLabels';

const box = cityBoxById('katowice')!;
const ctx = () => makeFlatCtx(960, 480, { lat: box.lat, lon: box.lon }, box.fitZoom, 1, 'grid');

beforeAll(() => {
  const el = document.createElement('script');
  el.type = 'application/x-geo-city';
  el.id = 'geo-city-katowice';
  el.textContent = readFileSync('src/map/data/city/streets/katowice.json', 'utf8');
  document.body.append(el);
});

describe('street labels', () => {
  test('names are placed, inside the view, and never on top of one another', () => {
    const labels = placeStreetLabels(ctx(), box, 'en', []);
    expect(labels.length).toBeGreaterThan(5);
    expect(STREET_FONT).toBe(10);
    for (const a of labels) {
      expect(a.box.left, a.text).toBeGreaterThanOrEqual(0);
      expect(a.box.right, a.text).toBeLessThanOrEqual(960);
      for (const b of labels) if (a !== b) expect(overlaps(a.box, b.box), `${a.text} / ${b.text}`).toBe(false);
    }
  });

  test('a lesson label always wins: a street name on its spot is left out, not moved onto it', () => {
    const c = ctx();
    const free = placeStreetLabels(c, box, 'en', []);
    const victim = free[0]!;
    const obstacle: LabelBox = { left: 0, top: 0, right: 960, bottom: 480 };   // the whole view
    expect(placeStreetLabels(c, box, 'en', [obstacle])).toEqual([]);
    // A single obstacle exactly over one name's three options removes that name and keeps the others.
    const tight: LabelBox = { left: victim.box.left - 2, right: victim.box.right + 2, top: victim.box.top - 20, bottom: victim.box.bottom + 20 };
    const some = placeStreetLabels(c, box, 'en', [tight]);
    expect(some.some((l) => l.text === victim.text)).toBe(false);
    expect(some.length).toBeGreaterThan(0);
  });

  test('no names at all when the view is not deep enough to read one', () => {
    expect(placeStreetLabels(makeFlatCtx(960, 480, { lat: box.lat, lon: box.lon }, 100, 1, 'grid'), box, 'en', [])).toEqual([]);
  });
});
```

- [ ] **Step 8: `tests/e2e/city-streets.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json';
import { expectNoAxeViolations, openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const fit = (b: { west: number; east: number; south: number; north: number }) =>
  Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));

for (const style of STYLES) {
  test(`the street map is drawn in ${style}, with a photo only where the spec says`, async ({ page }) => {
    test.setTimeout(90_000);
    const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, style);
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    await setFlatView(page, b.lat, b.lon, fit(b));
    const streets = page.locator('.view-flat g.streets[data-city-box="katowice"]');
    await expect(streets).toHaveCount(1);
    await expect(streets.locator('path.road.c0')).toHaveCount(1);
    await expect(streets.locator('path.road.c4')).toHaveCount(1);
    // Planning ruling R14: the photo layer only exists for the two texture styles.
    await expect(page.locator('.view-flat canvas.texture')).toHaveCount(style === 'physical' || style === 'satellite' ? 1 : 0);
    await expect(page.locator('.view-flat text.street-name').first()).toBeVisible();
    expect(pageErrors(page)).toEqual([]);
  });
}

test('every one of the twelve boxes draws a street map at its fit zoom', async ({ page }) => {
  test.setTimeout(180_000);
  await openPage(page, 'en/lab', '?test');
  for (const b of boxesJson.boxes) {
    await setFlatView(page, b.lat, b.lon, fit(b));
    await expect(page.locator(`.view-flat g.streets[data-city-box="${b.id}"]`), b.id).toHaveCount(1);
    await expect(page.locator('.view-flat g.streets path.road'), b.id).not.toHaveCount(0);
  }
  expect(pageErrors(page)).toEqual([]);
});

test('outside a box, and zoomed out, there is no street layer at all', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, 50.26, 19.02, 12);           // the Atlas baseline scene's own view
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await setFlatView(page, 12.5, 40.5, 4000);           // open desert
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
});

test('a broken street layer drops only itself, and the map keeps working (spec §5)', async ({ page }) => {
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  await openPage(page, 'en/lab', '?test&vector=fail');
  await setFlatView(page, b.lat, b.lon, fit(b));
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.view-flat svg[role="group"] .grid')).toHaveCount(1);
  await expect(page.locator('.view-flat [data-point-handle]')).toHaveCount(1);
});

test('axe is clean inside a box, in every style and both themes', async ({ page }) => {
  test.setTimeout(180_000);
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const style of STYLES) {
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
      await setFlatView(page, b.lat, b.lon, fit(b));
      await expect(page.locator('.view-flat g.streets')).toHaveCount(1);
      await expectNoAxeViolations(page, `close-up ${style} ${scheme}`);
    }
  }
});
```
The `?test&vector=fail` flag already exists and is read by `testFlag('vector')` in `Political.svelte` and
`PhysicalWater.svelte`; `Streets.svelte` reads the same flag, so this test also proves the three agree.

- [ ] **Step 9: Run everything and look at it**

```bash
npm run check && npm test
npm run build
npm run e2e
```
Expected: the whole suite passes, including the seven Atlas baselines with zero diff (at zoom 12 no box is in
view, planning ruling R3).

Then look at the twelve, in all four styles, light and dark, at 375 px and 1366 px:
```bash
npm run shot -- en/lab city-streets
```
(set the style and the view through `localStorage` + `window.__mapState` first). Check and write down:
1. Road hierarchy reads: a motorway is obviously a motorway and a residential street obviously smaller.
2. The casings separate the roads from the photo under them in Physical and Satellite, in both themes, and from
   the Atlas and Political backgrounds too.
3. Street names are legible, not crowded, and none sits on a place name, the point, the grid numbers or a
   special-line name.
4. The grid, the point marker, the edge labels and the readout behave exactly as they do at any other zoom
   (spec §1's success criterion).
5. Green areas and water read as parks and water, not as a third country colour (this is why Political drops the
   fills).
6. A box with visibly little data (planning ruling R16's missing relations) — name it in the report.
7. Tokyo and Delhi: the street names must be readable — they should come out in English where the local name is
   Japanese or Devanagari (planning ruling R24). Check the same box in `pl` and `uk` too.

- [ ] **Step 10: Commit**

```bash
git add src/map/streets.ts src/map/layers/Streets.svelte src/map/layers/Layers.svelte \
  src/map/layers/Places.svelte src/map/styleLabels.ts src/styles/tokens.css src/styles/base.css \
  tests/unit/streets.test.ts tests/unit/street-labels.test.ts tests/e2e/city-streets.spec.ts
git commit -m "feat(map): street layer and street names inside the city close-up boxes"
```

**Report:** the ten checks above per style; which boxes looked thin; whether any street name ever beat a lesson
label (it must not); the DOM approach you used for the unit tests (Step 1); and the full e2e result.
