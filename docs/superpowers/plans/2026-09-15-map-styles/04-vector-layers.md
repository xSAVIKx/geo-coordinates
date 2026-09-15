# Part 4 — Political and Physical vector layers and labels (spec §9.4)

Read spec §3 (Political, Physical rows; physical names) and §4 "Political and Physical vectors" first.

Context every task here needs:
- `src/map/layers/Layers.svelte` stacks the SVG layers for one view: `Land`, globe shade, `Hemispheres`, `Graticule`, `Daylight`, `SpecialLines part="lines"`, schools, `Overlays part="lines"`, point guides, `SpecialLines part="labels"`, `Places`, schools badges, `Overlays part="marks"`, point handle. It reads `const style = $derived(mapState.drawnMapStyle)` (Task 7) and passes `style` to `Land`.
- `src/map/layers/Land.svelte` (Task 7): `surface = style === 'atlas'` gates ocean, land, the region's mask/land/lakes/rivers/coast; borders and voivodeships always draw.
- `src/map/layers/Places.svelte` is the label hub: it computes obstacles (`lineObstacles`, `edgeObstacles`, `pointObstacles`, `overlayObstacles`, `continentObstacles`, `schoolMarks`, `chosenBoxes`), then place-name `placements` (a `Map<string, PlaceLabelOption>`), then `riverLabels`, then `schoolLabels`, each avoiding everything placed before.
- `src/map/labelLayout.ts`: `LabelBox`, `textBox(x, y, width, height, anchor)`, `overlaps`, `selectLabelPlacements(items, boxes, rank, obstacles)`. `src/map/brackets.ts`: `labelWidth(text, size, px)`. `src/map/places.ts`: `PLACES`, `tierZoom(zoom, cssWidth)`.
- `src/map/world.ts` has private helpers `Part<T>`, `boundsOf`, `lineParts`, `polygonParts`, `asMultiPolygon`, `visibleParts`, the arc decoding in `decodedArcs`, and exported `thinArc`, `REGION`, `REGION_MIN_ZOOM`, `REGION_DETAIL_ZOOM`, `landFor`, `detailFor`, `regionActive`, `land`.
- Render health: `reportHealth({ type: 'vector-fail' })` (`src/map/texture/health.svelte.ts`) makes Political and Physical fall back to Atlas with the note (Task 8).
- `testFlag(name)` from `src/app/testMode.ts` reads `?test&name=value`.
- E2E helpers: `openPage`, `pageErrors`, `expectNoAxeViolations`, `setMapStyle`, `waitForTexture`, `probe`.

---

### Task 12: Political layer

**Files:**
- Create: `src/map/political.ts`, `src/map/layers/Political.svelte`, `src/map/styleLabels.ts`
- Modify: `src/map/world.ts` (export helpers), `src/map/layers/Layers.svelte`, `src/map/layers/Land.svelte`, `src/map/layers/Places.svelte`, `src/styles/tokens.css`
- Test: `tests/unit/political.test.ts`, `tests/unit/style-labels.test.ts`, `tests/e2e/political.spec.ts`

**Interfaces:**
- Consumes: `src/map/data/political-pol.json` (Task 3: geometries with `id` = ADM0_A3_PL and `properties: { a2, c, lr, ml, lx, ly }`).
- Produces:
  ```ts
  // src/map/world.ts (now exported, bodies unchanged)
  export interface Part<T> { bounds: GeoBounds; coordinates: T }
  export function boundsOf(points: GeoJSON.Position[]): GeoBounds;
  export const lineParts: (g: GeoJSON.MultiLineString) => Part<GeoJSON.Position[]>[];
  export const polygonParts: (g: GeoJSON.MultiPolygon) => Part<GeoJSON.Position[][]>[];
  export function asMultiPolygon(fc: GeoJSON.Feature | GeoJSON.FeatureCollection): GeoJSON.MultiPolygon;
  export function visibleParts<T>(parts: Part<T>[], view: GeoBounds): T[];
  export function decodeArcs(topology: { arcs: number[][][]; transform?: { scale: number[]; translate: number[] } }): [number, number][][];
  // src/map/political.ts
  export interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }
  export const POLITICAL_COLOURS = 6;
  export const CAPITALS: ReadonlySet<string>;
  export interface CountryFill { id: string; colour: number; geometry: GeoJSON.MultiPolygon }
  export interface PoliticalLayers { fills: CountryFill[]; borders: GeoJSON.MultiLineString; coast: GeoJSON.MultiLineString }
  export function politicalFor(zoom: number, view: GeoBounds): PoliticalLayers;
  export interface CountryLabel { id: string; a2: string; lat: number; lon: number; minZoom: number }
  export const labelMinZoom: (minLabel: number) => number;   // 2 ** (minLabel − 2)
  export function countryLabels(): readonly CountryLabel[];  // sorted by LABELRANK, then minZoom
  export function countryName(a2: string, lang: LangCode): string;
  // src/map/styleLabels.ts
  export interface StyleLabel { id: string; text: string; x: number; y: number; size: number; box: LabelBox }
  export const COUNTRY_FONT = 11;
  export function placeCountryLabels(ctx: ViewCtx, lang: LangCode, obstacles: readonly LabelBox[]): StyleLabel[];
  // CSS tokens: --pol-0 … --pol-5, --pol-border, --pol-coast
  // Test-mode switch: ?test&vector=fail throws inside the Political layer
  ```

- [ ] **Step 1: Export the world.ts helpers**

In `src/map/world.ts` add `export` to `interface Part<T>`, `function boundsOf`, `const lineParts`, `const polygonParts`, `function asMultiPolygon`, `function visibleParts`. Replace the `decodedArcs` IIFE with:
```ts
/** A quantized topology's arcs as absolute [lon, lat] points (delta-decoded, transform applied). */
export function decodeArcs(topology: { arcs: number[][][]; transform?: { scale: number[]; translate: number[] } }): [number, number][][] {
  const [kx, ky] = topology.transform?.scale ?? [1, 1];
  const [dx, dy] = topology.transform?.translate ?? [0, 0];
  return topology.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([qx, qy]) => { x += qx!; y += qy!; return [x * kx! + dx!, y * ky! + dy!] as [number, number]; });
  });
}
const decodedArcs = decodeArcs(regionTopo as unknown as Parameters<typeof decodeArcs>[0]);
```
(Keep the original decoding semantics: read the existing IIFE first; if it does not delta-decode unquantized topologies, keep `transform`-less arcs as-is exactly the way it did.) Run `npx vitest run tests/unit/world.test.ts` — Expected: PASS, unchanged.

- [ ] **Step 2: Failing unit tests**

`tests/unit/political.test.ts`:
```ts
import { geoContains } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import { PLACES } from '../../src/map/places';
import { CAPITALS, countryLabels, countryName, labelMinZoom, politicalFor } from '../../src/map/political';
import { WORLD_BOUNDS } from '../../src/map/geometry';

describe('political map data at runtime', () => {
  test('the whole world has a fill per country, coloured apart, with borders and coast', () => {
    const w = politicalFor(1, WORLD_BOUNDS);
    expect(w.fills.length).toBeGreaterThan(180);
    expect(new Set(w.fills.map((f) => f.colour)).size).toBeLessThanOrEqual(6);
    expect(w.borders.coordinates.length).toBeGreaterThan(100);
    expect(w.coast.coordinates.length).toBeGreaterThan(100);
    const ukr = w.fills.find((f) => f.id === 'UKR')!;
    expect(geoContains(ukr.geometry, [34.10, 44.95])).toBe(true); // Simferopol
  });

  test('a zoomed-in view keeps only nearby countries, with more detail', () => {
    const view = { west: 14, south: 49, east: 24, north: 55 };
    const near = politicalFor(9, view);
    expect(near.fills.map((f) => f.id)).toContain('POL');
    expect(near.fills.map((f) => f.id)).not.toContain('AUS');
    const points = (z: number) => politicalFor(z, view).fills.find((f) => f.id === 'POL')!.geometry.coordinates.flat(2).length;
    expect(points(9)).toBeGreaterThan(points(1));
  });

  test('labels: Natural Earth label zooms on the flat map; names from Intl in every language', () => {
    expect(labelMinZoom(2)).toBe(1);
    expect(labelMinZoom(5)).toBe(8);
    const pol = countryLabels().find((l) => l.id === 'POL')!;
    expect(pol.a2).toBe('PL');
    expect([countryName('PL', 'en'), countryName('PL', 'pl'), countryName('PL', 'uk')]).toEqual(['Poland', 'Polska', 'Польща']);
    expect(countryName('UA', 'uk')).toBe('Україна');
    expect(countryLabels().every((l) => l.a2 !== '')).toBe(true);
  });

  test('capitals are places on the map', () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const c of CAPITALS) expect(ids.has(c), c).toBe(true);
    expect(CAPITALS.has('warsaw')).toBe(true);
    expect(CAPITALS.has('krakow')).toBe(false);
  });
});
```

`tests/unit/style-labels.test.ts`:
```ts
import { expect, test } from 'vitest';
import { makeFlatCtx } from '../../src/map/geometry';
import { overlaps } from '../../src/map/labelLayout';
import { placeCountryLabels } from '../../src/map/styleLabels';

test('country names on a Europe view: Poland and its neighbours, none overlapping', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const labels = placeCountryLabels(ctx, 'en', []);
  const ids = labels.map((l) => l.id);
  for (const id of ['POL', 'DEU', 'UKR', 'FRA']) expect(ids, id).toContain(id);
  expect(labels.find((l) => l.id === 'POL')!.text).toBe('Poland');
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) expect(overlaps(labels[i]!.box, labels[j]!.box), `${labels[i]!.id}/${labels[j]!.id}`).toBe(false);
});

test('small countries wait for their zoom; obstacles push names out', () => {
  const world = placeCountryLabels(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid'), 'en', []).map((l) => l.id);
  expect(world).toContain('RUS');
  expect(world).not.toContain('KOS');
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const pol = placeCountryLabels(ctx, 'pl', []).find((l) => l.id === 'POL')!;
  expect(pol.text).toBe('Polska');
  const blocked = placeCountryLabels(ctx, 'pl', [pol.box]).map((l) => l.id);
  expect(blocked).not.toContain('POL');
});

test('names stay inside the view', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  for (const l of placeCountryLabels(ctx, 'uk', [])) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(960); }
});
```
Run: `npx vitest run tests/unit/political.test.ts tests/unit/style-labels.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: `src/map/political.ts`**

```ts
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { LangCode } from '../geo/types';
import politicalJson from './data/political-pol.json';
import type { GeoBounds } from './geometry';
import { asMultiPolygon, decodeArcs, lineParts, polygonParts, thinArc, visibleParts, type Part } from './world';

/*
 * The Political map style (spec §3): pastel country fills whose neighbours differ, coast and borders from the same
 * shapes (planning ruling R8), and label data. Natural Earth's Poland point of view (scripts/build-political.ts).
 */
export interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }
type PoliticalTopology = Topology<{ countries: GeometryCollection<CountryProps> }>;
const topo = politicalJson as unknown as PoliticalTopology;

export const POLITICAL_COLOURS = 6;

/** Capitals among the lesson's places, drawn with a ring in the Political style. */
export const CAPITALS: ReadonlySet<string> = new Set([
  'warsaw', 'kyiv', 'london', 'paris', 'berlin', 'rome', 'madrid', 'reykjavik', 'oslo', 'cairo', 'nairobi', 'dakar',
  'mexicocity', 'buenosaires', 'lima', 'quito', 'tokyo', 'beijing', 'delhi', 'singapore', 'jakarta', 'washington', 'suva',
  'prague', 'bratislava', 'vienna', 'budapest', 'vilnius', 'riga',
]);

// Detail levels by flat zoom: arcs thinned to half a pixel at the level's zoom (like world.ts regionData).
const LEVELS = [1, 3, 8, 24] as const;
interface PoliticalData { fills: { id: string; colour: number; parts: Part<GeoJSON.Position[][]>[] }[]; borders: Part<GeoJSON.Position[]>[]; coast: Part<GeoJSON.Position[]>[] }
let arcs: [number, number][][] | null = null;
const levels = new Map<number, PoliticalData>();

function politicalData(zoom: number): PoliticalData {
  const level = [...LEVELS].reverse().find((l) => zoom >= l) ?? LEVELS[0];
  const cached = levels.get(level);
  if (cached) return cached;
  arcs ??= decodeArcs(topo as unknown as Parameters<typeof decodeArcs>[0]);
  const tolerance = 0.5 / ((960 / 360) * level);
  const t = { ...topo, transform: undefined, arcs: arcs.map((a) => thinArc(a, tolerance)) } as unknown as PoliticalTopology;
  const countries = t.objects.countries;
  const data: PoliticalData = {
    fills: countries.geometries.map((g) => ({ id: String(g.id), colour: g.properties!.c, parts: polygonParts(asMultiPolygon(feature(t, g) as GeoJSON.Feature)) })),
    borders: lineParts(mesh(t, countries, (a, b) => a !== b)),
    coast: lineParts(mesh(t, countries, (a, b) => a === b)),
  };
  levels.set(level, data);
  return data;
}

export interface CountryFill { id: string; colour: number; geometry: GeoJSON.MultiPolygon }
export interface PoliticalLayers { fills: CountryFill[]; borders: GeoJSON.MultiLineString; coast: GeoJSON.MultiLineString }

/** The fills, borders and coast a view at flat `zoom` covering `view` can see. */
export function politicalFor(zoom: number, view: GeoBounds): PoliticalLayers {
  const d = politicalData(zoom);
  return {
    fills: d.fills
      .map((f) => ({ id: f.id, colour: f.colour, geometry: { type: 'MultiPolygon' as const, coordinates: visibleParts(f.parts, view) } }))
      .filter((f) => f.geometry.coordinates.length > 0),
    borders: { type: 'MultiLineString', coordinates: visibleParts(d.borders, view) },
    coast: { type: 'MultiLineString', coordinates: visibleParts(d.coast, view) },
  };
}

export interface CountryLabel { id: string; a2: string; lat: number; lon: number; minZoom: number }

/** Natural Earth's MIN_LABEL is a web-map zoom; our flat zoom 1 (a 960 px world) is about web zoom 2. */
export const labelMinZoom = (minLabel: number): number => 2 ** (minLabel - 2);

let labels: CountryLabel[] | null = null;
export function countryLabels(): readonly CountryLabel[] {
  return (labels ??= topo.objects.countries.geometries
    .filter((g) => g.properties!.a2 !== '')
    .map((g) => ({ g, p: g.properties! }))
    .sort((a, b) => a.p.lr - b.p.lr || a.p.ml - b.p.ml)
    .map(({ g, p }) => ({ id: String(g.id), a2: p.a2, lat: p.ly, lon: p.lx, minZoom: labelMinZoom(p.ml) })));
}

const displayNames = new Map<LangCode, Intl.DisplayNames>();
/** The country's name in the page language (spec §3: `Intl.DisplayNames`). */
export function countryName(a2: string, lang: LangCode): string {
  let names = displayNames.get(lang);
  if (!names) { names = new Intl.DisplayNames([lang], { type: 'region' }); displayNames.set(lang, names); }
  return names.of(a2) ?? a2;
}
```

- [ ] **Step 4: `src/map/styleLabels.ts`**

```ts
import type { LangCode } from '../geo/types';
import { labelWidth } from './brackets';
import type { ViewCtx } from './geometry';
import { selectLabelPlacements, textBox, type LabelBox } from './labelLayout';
import { tierZoom } from './places';
import { countryLabels, countryName } from './political';

/*
 * Names that only some map styles write (spec §4): country names (Political), and from Task 13 physical names
 * (Physical). Placed after place names by Places.svelte, clear of everything already on the map (labelLayout.ts).
 */
export interface StyleLabel { id: string; text: string; x: number; y: number; size: number; box: LabelBox }

export const COUNTRY_FONT = 11;

const insideView = (ctx: ViewCtx, xy: [number, number]) => xy[0] >= 0 && xy[0] <= ctx.width && xy[1] >= 0 && xy[1] <= ctx.height;

export function placeCountryLabels(ctx: ViewCtx, lang: LangCode, obstacles: readonly LabelBox[]): StyleLabel[] {
  const zoom = tierZoom(ctx.zoom, ctx.width / ctx.px);
  const size = COUNTRY_FONT * ctx.px;
  const items = countryLabels().flatMap((c, rank) => {
    if (zoom < c.minZoom) return [];
    const xy = ctx.project(c);
    if (!xy || !insideView(ctx, xy)) return [];
    const text = countryName(c.a2, lang);
    const y = xy[1] + size * 0.35;
    const box = textBox(xy[0], y, labelWidth(text, COUNTRY_FONT, ctx.px), size, 'middle');
    if (box.left < 0 || box.right > ctx.width) return [];
    return [{ rank, label: { id: c.id, text, x: xy[0], y, size, box } }];
  });
  const chosen = selectLabelPlacements(items, (i) => [i.label.box], (i) => i.rank, obstacles);
  return items.filter((_, k) => chosen[k]! >= 0).map((i) => i.label);
}
```

Run the two unit test files — Expected: PASS (7 tests). If `KOS` shows at world zoom, check `labelMinZoom`; if `FRA` misses at Europe zoom, the label point may collide with `DEU`'s box — accept only if France is placed at zoom 4; adjust the test to zoom 4 then, and say so.

- [ ] **Step 5: `src/map/layers/Political.svelte`**

```svelte
<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import type { ViewCtx } from '../geometry';
  import { politicalFor } from '../political';
  let { ctx }: { ctx: ViewCtx } = $props();
  const layers = $derived.by(() => {
    if (testFlag('vector') === 'fail') throw new Error('political layer failure forced for a test');
    return politicalFor(ctx.zoom, ctx.bounds);
  });
  const fills = $derived(layers.fills.map((f) => ({ id: f.id, colour: f.colour, d: ctx.path(f.geometry) ?? '' })).filter((f) => f.d));
  const coastD = $derived(ctx.path(layers.coast) ?? '');
  const bordersD = $derived(ctx.path(layers.borders) ?? '');
</script>

<g class="political" aria-hidden="true">
  {#each fills as f (f.id)}<path class="country c{f.colour}" data-country={f.id} d={f.d} />{/each}
  <path class="coast" d={coastD} />
  <path class="borders" d={bordersD} />
</g>

<style>
  .political { pointer-events: none; }
  .country { stroke: none; }
  .c0 { fill: var(--pol-0); } .c1 { fill: var(--pol-1); } .c2 { fill: var(--pol-2); } .c3 { fill: var(--pol-3); } .c4 { fill: var(--pol-4); } .c5 { fill: var(--pol-5); }
  .coast { fill: none; stroke: var(--pol-coast); stroke-width: calc(0.9px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .borders { fill: none; stroke: var(--pol-border); stroke-width: calc(1.1px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
```

Tokens, appended to the `:root` light block, both dark blocks (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`) of `src/styles/tokens.css`:
- light: `--pol-0: #f6e3b4; --pol-1: #cfe6c1; --pol-2: #f5cfc6; --pol-3: #d6d9f2; --pol-4: #c9e7e5; --pol-5: #efd9ea; --pol-border: #6b6152; --pol-coast: #7d8fa0;`
- dark (both blocks, identical): `--pol-0: #4a4231; --pol-1: #34462f; --pol-2: #4d3632; --pol-3: #383b52; --pol-4: #2f4948; --pol-5: #463646; --pol-border: #c9bfa6; --pol-coast: #8fa6ba;`

- [ ] **Step 6: Wire it into the layers**

`src/map/layers/Land.svelte`: add `const ocean = $derived(style === 'atlas' || style === 'political');` and `const ownBorders = $derived(style !== 'political');`. The ocean path uses `{#if ocean}`; the land path stays `{#if surface}`; world and region borders and voivodeships use `{#if ownBorders && …}` (Political draws its own coast and borders).

`src/map/layers/Layers.svelte`, right after `<Land {ctx} {style} />`:
```svelte
{#if style === 'political'}
  <svelte:boundary onerror={vectorFailed}><Political {ctx} /></svelte:boundary>
{/if}
```
with
```ts
  import Political from './Political.svelte';
  import { reportHealth } from '../texture/health.svelte';
  // Spec §4 "any error → Atlas": an exception in a style's vector layer shows Atlas with the note.
  function vectorFailed(error: unknown) {
    console.warn('map style layer:', error);
    queueMicrotask(() => reportHealth({ type: 'vector-fail' }));
  }
```

`src/map/layers/Places.svelte`:
```ts
  import { reportHealth } from '../texture/health.svelte';
  import { CAPITALS } from '../political';
  import { placeCountryLabels } from '../styleLabels';
  const political = $derived(mapState.drawnMapStyle === 'political');
```
- `showContinents` gains `&& !political` (country names replace continent names).
- After `placements`:
```ts
  // Political: country names after place names, clear of everything placed so far (spec §4).
  const countryNames = $derived.by(() => {
    if (!political || !mapState.layers.places) return [];
    try {
      return placeCountryLabels(ctx, i18n.lang, [...lineObstacles, ...edgeObstacles, ...pointObstacles, ...overlayObstacles, ...[...placements.values()].map((o) => o.box), ...schoolMarks, ...chosenBoxes]);
    } catch (e) {
      console.warn('country names:', e);
      queueMicrotask(() => reportHealth({ type: 'vector-fail' }));
      return [];
    }
  });
```
- `riverLabels` and `schoolLabels`: add `...countryNames.map((l) => l.box)` to their `placed` arrays (empty in every other style, so Atlas is unchanged).
- Markup, inside `{#if mapState.layers.places}` before the continents loop:
```svelte
  {#each countryNames as l (l.id)}
    <text class="halo country-name" data-country={l.id} x={l.x} y={l.y} text-anchor="middle" font-size={l.size}>{l.text}</text>
  {/each}
```
- In the places loop, right before `<circle class="place" …/>`: `{#if political && CAPITALS.has(p.id)}<circle class="capital-ring" cx={xy[0]} cy={xy[1]} r={(a ? 6 : 4.5) * ctx.px} />{/if}`
- CSS: `.country-name { fill: var(--map-label); font-weight: 650; letter-spacing: 0.05em; }` and `.capital-ring { fill: none; stroke: var(--text); stroke-width: calc(1.4px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }`.

- [ ] **Step 7: E2E `tests/e2e/political.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { makeFlatCtx } from '../../src/map/geometry';
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle } from './helpers';

const fill = (page: import('@playwright/test').Page, id: string) => page.locator(`.view-flat path.country[data-country="${id}"]`).evaluate((p) => getComputedStyle(p).fill);

for (const scheme of ['light', 'dark'] as const) {
  test(`Political (${scheme}): Poland's neighbours all differ from it; names, capitals, no continents`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'political');
    await page.evaluate(() => (window as unknown as { __mapState: { setFlatPreset(p: string): void } }).__mapState.setFlatPreset('europe'));
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'political');
    const pol = await fill(page, 'POL');
    for (const n of ['DEU', 'CZE', 'SVK', 'UKR', 'BLR', 'LTU', 'RUS']) expect(await fill(page, n), n).not.toBe(pol);
    await expect(page.locator('.view-flat text.country-name[data-country="POL"]')).toHaveText('Poland');
    await expect(page.locator('.view-flat text.map-label')).toHaveCount(0);
    await expect(page.locator('.view-flat circle.capital-ring')).not.toHaveCount(0);
    await expect(page.locator('.view-flat path.land')).toHaveCount(0);
    await expectNoAxeViolations(page, `political ${scheme}`);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('Political: Crimea is drawn inside Ukraine', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'political');
  await page.evaluate(() => (window as unknown as { __mapState: { setFlatView(c: object, z: number): void } }).__mapState.setFlatView({ lat: 46, lon: 34 }, 6));
  const st = await page.evaluate(() => { const s = (window as unknown as { __mapState: { flat: { center: { lat: number; lon: number }; zoom: number } } }).__mapState; return s.flat; });
  const [x, y] = makeFlatCtx(960, 480, st.center, st.zoom, 1, 'grid').project({ lat: 44.95, lon: 34.10 })!;
  const inside = await page.locator('.view-flat path.country[data-country="UKR"]').evaluate((p, [px, py]) => {
    const g = p as SVGGeometryElement;
    const pt = g.ownerSVGElement!.createSVGPoint(); pt.x = px!; pt.y = py!;
    return g.isPointInFill(pt);
  }, [x, y]);
  expect(inside).toBe(true);
  await expect(page.locator('.view-flat path.country[data-country="RUS"]')).toBeAttached();
});

test('Political names follow the language', async ({ page }) => {
  for (const [lang, name] of [['pl', 'Polska'], ['uk', 'Польща']] as const) {
    await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'political'));
    await openPage(page, `${lang}/lab`, '?test');
    await page.evaluate(() => (window as unknown as { __mapState: { setFlatPreset(p: string): void } }).__mapState.setFlatPreset('europe'));
    await expect(page.locator('.view-flat text.country-name[data-country="POL"]')).toHaveText(name);
  }
});

test('an exception in the Political layer shows Atlas with the note', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&vector=fail');
  await setMapStyle(page, 'political');
  await expect(page.getByRole('status').filter({ hasText: "This device can't draw this style; showing Atlas." })).toBeVisible();
  await expect(page.locator('.view-flat path.land')).toHaveCount(1);
});
```
The flat projection in the lab is the grid map unless a preference says otherwise; the Crimea test assumes `grid` (fresh profile).

- [ ] **Step 8: Run, look, commit**

```bash
npm run check && npm test
npm run build && npx playwright test tests/e2e/political.spec.ts tests/e2e/atlas-baseline.spec.ts tests/e2e/map-layers.spec.ts tests/e2e/map-polish.spec.ts tests/e2e/schools.spec.ts
```
Expected: PASS. Look at the lab in Political at 375×667 and 1366×768 at world, Europe and Poland presets, light and dark: pastel fills, neighbours different, names readable and not crowding city names, capitals ringed; drag the globe and check it stays smooth (note roughly how it feels; Task 20 measures).
```bash
git add src/map/world.ts src/map/political.ts src/map/layers/Political.svelte src/map/styleLabels.ts src/map/layers/Layers.svelte src/map/layers/Land.svelte src/map/layers/Places.svelte src/styles/tokens.css tests/unit/political.test.ts tests/unit/style-labels.test.ts tests/e2e/political.spec.ts
git commit -m "feat(map): Political style with coloured countries, their names and capitals"
```

---

### Task 13: Physical water and names

World rivers and lakes (Natural Earth 50m), Central Europe's detailed rivers and lakes from zoom 4/6, and ≈ 25 physical names over the relief.

**Files:**
- Create: `src/map/physical.ts`, `src/map/layers/PhysicalWater.svelte`
- Modify: `src/map/styleLabels.ts`, `src/map/layers/Layers.svelte`, `src/map/layers/Places.svelte`, `src/styles/tokens.css`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`, `scripts/translation-review-lib.ts`
- Test: `tests/unit/physical.test.ts`, extend `tests/unit/style-labels.test.ts`, `tests/e2e/physical.spec.ts`

**Interfaces:**
- Consumes: `src/map/data/physical-water.json` (Task 4: objects `rivers`, `lakes`, properties `{ r }` = scalerank); `decodeArcs`, `thinArc`, `lineParts`, `polygonParts`, `asMultiPolygon`, `visibleParts`, `landFor`, `detailFor`, `REGION`, `REGION_DETAIL_ZOOM`, `regionActive`, `land` (`src/map/world.ts`, Task 12 exports); `StyleLabel`, `placeCountryLabels` (Task 12).
- Produces:
  ```ts
  // src/map/physical.ts
  export type PhysicalKind = 'mountains' | 'desert' | 'plateau' | 'sea' | 'river';
  export interface PhysicalName { id: string; lat: number; lon: number; kind: PhysicalKind; minZoom: number }
  export const PHYSICAL_NAMES: readonly PhysicalName[];                 // 25 entries, i18n key `physical.<id>`
  export function riverRankFor(zoom: number): number;                  // largest scalerank drawn at a flat zoom
  export function physicalWaterFor(zoom: number, view: GeoBounds): { rivers: GeoJSON.MultiLineString; lakes: GeoJSON.MultiPolygon };
  // src/map/styleLabels.ts
  export const PHYSICAL_FONT = 11.5;
  export function placePhysicalLabels(ctx: ViewCtx, lang: LangCode, obstacles: readonly LabelBox[]): (StyleLabel & { kind: PhysicalKind })[];
  // i18n keys physical.<id> (25); CSS tokens --relief-label, --sea-label
  ```

- [ ] **Step 1: Messages (25 physical names)**

| id | lat | lon | kind | minZoom | en | pl | uk |
|---|---|---|---|---|---|---|---|
| tatra | 49.18 | 20.08 | mountains | 6 | Tatra Mountains | Tatry | Татри |
| sudetes | 50.75 | 16.10 | mountains | 5 | Sudetes | Sudety | Судети |
| carpathians | 47.60 | 24.80 | mountains | 3 | Carpathians | Karpaty | Карпати |
| alps | 46.50 | 10.20 | mountains | 2.5 | Alps | Alpy | Альпи |
| pyrenees | 42.70 | 0.90 | mountains | 4 | Pyrenees | Pireneje | Пиренеї |
| caucasus | 42.90 | 44.00 | mountains | 3 | Caucasus | Kaukaz | Кавказ |
| urals | 58.00 | 59.30 | mountains | 2 | Ural Mountains | Ural | Уральські гори |
| scandinavian | 65.00 | 14.50 | mountains | 2.5 | Scandinavian Mountains | Góry Skandynawskie | Скандинавські гори |
| himalayas | 28.30 | 84.50 | mountains | 1 | Himalayas | Himalaje | Гімалаї |
| tibet | 33.50 | 88.00 | plateau | 1.5 | Tibetan Plateau | Wyżyna Tybetańska | Тибетське нагір'я |
| andes | -19.00 | -67.80 | mountains | 1 | Andes | Andy | Анди |
| rockies | 45.00 | -111.00 | mountains | 1 | Rocky Mountains | Góry Skaliste | Скелясті гори |
| atlas | 31.80 | -5.50 | mountains | 3 | Atlas Mountains | Atlas | Атлаські гори |
| sahara | 23.50 | 10.00 | desert | 1 | Sahara | Sahara | Сахара |
| gobi | 43.00 | 105.00 | desert | 1.5 | Gobi Desert | Gobi | Гобі |
| kalahari | -23.00 | 21.50 | desert | 2 | Kalahari | Kalahari | Калахарі |
| arabian | 22.50 | 47.50 | desert | 2 | Arabian Desert | Pustynia Arabska | Аравійська пустеля |
| baltic | 55.60 | 17.80 | sea | 2 | Baltic Sea | Morze Bałtyckie | Балтійське море |
| northsea | 56.00 | 3.50 | sea | 2.5 | North Sea | Morze Północne | Північне море |
| mediterranean | 35.00 | 18.00 | sea | 1.5 | Mediterranean Sea | Morze Śródziemne | Середземне море |
| blacksea | 43.20 | 34.50 | sea | 2 | Black Sea | Morze Czarne | Чорне море |
| caribbean | 15.00 | -75.00 | sea | 1.5 | Caribbean Sea | Morze Karaibskie | Карибське море |
| redsea | 20.00 | 38.50 | sea | 3 | Red Sea | Morze Czerwone | Червоне море |
| amazon | -3.30 | -60.00 | river | 1.5 | Amazon | Amazonka | Амазонка |
| nile | 25.00 | 32.70 | river | 2 | Nile | Nil | Ніл |

Add `physical.<id>` to the three files (the `en`, `pl`, `uk` columns; one file at a time). In `scripts/translation-review-lib.ts` add to `SAME_OK`: `/^physical\.(sahara|kalahari)$/` with the comment line `//  - physical.sahara, physical.kalahari  proper names spelt the same in Polish`.

- [ ] **Step 2: Failing tests**

`tests/unit/physical.test.ts`:
```ts
import { geoContains } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { WORLD_BOUNDS } from '../../src/map/geometry';
import { PHYSICAL_NAMES, physicalWaterFor, riverRankFor } from '../../src/map/physical';
import { land } from '../../src/map/world';

describe('physical names', () => {
  test('25 names, each translated, seas on water and the rest on land', () => {
    expect(PHYSICAL_NAMES).toHaveLength(25);
    for (const n of PHYSICAL_NAMES) {
      for (const f of [en, pl, uk] as Record<string, string>[]) expect(f, n.id).toHaveProperty(`physical.${n.id}`);
      const onLand = geoContains(land, [n.lon, n.lat]);
      expect(onLand, n.id).toBe(n.kind !== 'sea');
    }
    expect((pl as Record<string, string>)['physical.tatra']).toBe('Tatry');
  });
});

describe('world rivers and lakes', () => {
  test('fewer, bigger rivers when zoomed out', () => {
    expect(riverRankFor(1)).toBeLessThan(riverRankFor(5));
    const lines = (z: number) => physicalWaterFor(z, WORLD_BOUNDS).rivers.coordinates.length;
    expect(lines(1)).toBeLessThan(lines(5));
    expect(physicalWaterFor(1, WORLD_BOUNDS).lakes.coordinates.length).toBeGreaterThan(20);
  });
  test('from zoom 6 inside Central Europe the detailed regional rivers take over', () => {
    const view = { west: 17, south: 50, east: 22, north: 54 };
    const inside = (c: GeoJSON.Position[]) => c.every(([x, y]) => x! >= 8 && x! <= 32 && y! >= 44 && y! <= 58);
    expect(physicalWaterFor(5, view).rivers.coordinates.some(inside)).toBe(true);
    expect(physicalWaterFor(6, view).rivers.coordinates.some(inside)).toBe(false);
  });
});
```
Append to `tests/unit/style-labels.test.ts`:
```ts
import { placePhysicalLabels } from '../../src/map/styleLabels';

test('physical names: the Alps on a Europe view, the Tatras only from zoom 6, clear of obstacles', () => {
  const europe = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const ids = placePhysicalLabels(europe, 'en', []).map((l) => l.id);
  expect(ids).toContain('alps');
  expect(ids).toContain('baltic');
  expect(ids).not.toContain('tatra');
  const tatras = makeFlatCtx(960, 480, { lat: 49.5, lon: 20 }, 12, 1, 'grid');
  const t = placePhysicalLabels(tatras, 'pl', []).find((l) => l.id === 'tatra')!;
  expect(t.text).toBe('Tatry');
  expect(t.kind).toBe('mountains');
  expect(placePhysicalLabels(tatras, 'pl', [t.box]).map((l) => l.id)).not.toContain('tatra');
});
```
Run: `npx vitest run tests/unit/physical.test.ts tests/unit/style-labels.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: `src/map/physical.ts`**

```ts
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import waterJson from './data/physical-water.json';
import { boundsIntersect, type GeoBounds } from './geometry';
import { asMultiPolygon, decodeArcs, lineParts, polygonParts, REGION, REGION_DETAIL_ZOOM, thinArc, visibleParts, type Part } from './world';

/*
 * The Physical map style's vectors (spec §3): world rivers and lakes (Natural Earth 50m, scripts/build-physical-water.ts)
 * over the relief texture, and physical names. Inside Central Europe the detailed regional lakes (zoom 4) and rivers
 * (zoom 6) from central-europe.json take over, following the regional level of detail (world.ts).
 */
export type PhysicalKind = 'mountains' | 'desert' | 'plateau' | 'sea' | 'river';
export interface PhysicalName { id: string; lat: number; lon: number; kind: PhysicalKind; minZoom: number }

const n = (id: string, lat: number, lon: number, kind: PhysicalKind, minZoom: number): PhysicalName => ({ id, lat, lon, kind, minZoom });
export const PHYSICAL_NAMES: readonly PhysicalName[] = [
  n('tatra', 49.18, 20.08, 'mountains', 6), n('sudetes', 50.75, 16.1, 'mountains', 5), n('carpathians', 47.6, 24.8, 'mountains', 3),
  n('alps', 46.5, 10.2, 'mountains', 2.5), n('pyrenees', 42.7, 0.9, 'mountains', 4), n('caucasus', 42.9, 44, 'mountains', 3),
  n('urals', 58, 59.3, 'mountains', 2), n('scandinavian', 65, 14.5, 'mountains', 2.5), n('himalayas', 28.3, 84.5, 'mountains', 1),
  n('tibet', 33.5, 88, 'plateau', 1.5), n('andes', -19, -67.8, 'mountains', 1), n('rockies', 45, -111, 'mountains', 1),
  n('atlas', 31.8, -5.5, 'mountains', 3), n('sahara', 23.5, 10, 'desert', 1), n('gobi', 43, 105, 'desert', 1.5),
  n('kalahari', -23, 21.5, 'desert', 2), n('arabian', 22.5, 47.5, 'desert', 2), n('baltic', 55.6, 17.8, 'sea', 2),
  n('northsea', 56, 3.5, 'sea', 2.5), n('mediterranean', 35, 18, 'sea', 1.5), n('blacksea', 43.2, 34.5, 'sea', 2),
  n('caribbean', 15, -75, 'sea', 1.5), n('redsea', 20, 38.5, 'sea', 3), n('amazon', -3.3, -60, 'river', 1.5), n('nile', 25, 32.7, 'river', 2),
];

/** The largest Natural Earth scalerank drawn at a flat zoom: the great rivers on the world map, all of them from zoom 4. */
export const riverRankFor = (zoom: number): number => (zoom < 2 ? 4 : zoom < 4 ? 6 : 9);

type WaterTopology = Topology<{ rivers: GeometryCollection<{ r: number }>; lakes: GeometryCollection<{ r: number }> }>;
const topo = waterJson as unknown as WaterTopology;
const LEVELS = [1, 4, 16] as const;
interface WaterData { rivers: { r: number; parts: Part<GeoJSON.Position[]>[] }[]; lakes: Part<GeoJSON.Position[][]>[] }
let arcs: [number, number][][] | null = null;
const levels = new Map<number, WaterData>();

function waterData(zoom: number): WaterData {
  const level = [...LEVELS].reverse().find((l) => zoom >= l) ?? LEVELS[0];
  const cached = levels.get(level);
  if (cached) return cached;
  arcs ??= decodeArcs(topo as unknown as Parameters<typeof decodeArcs>[0]);
  const tolerance = 0.5 / ((960 / 360) * level);
  const t = { ...topo, transform: undefined, arcs: arcs.map((a) => thinArc(a, tolerance)) } as unknown as WaterTopology;
  const data: WaterData = {
    rivers: t.objects.rivers.geometries.map((g) => ({ r: g.properties!.r, parts: lineParts(mesh(t, { type: 'GeometryCollection', geometries: [g] })) })),
    lakes: polygonParts(asMultiPolygon(feature(t, t.objects.lakes))),
  };
  levels.set(level, data);
  return data;
}

const insideRegion = (b: GeoBounds) => b.west >= REGION.west && b.east <= REGION.east && b.south >= REGION.south && b.north <= REGION.north;

export function physicalWaterFor(zoom: number, view: GeoBounds): { rivers: GeoJSON.MultiLineString; lakes: GeoJSON.MultiPolygon } {
  const d = waterData(zoom);
  const rank = riverRankFor(zoom);
  // From REGION_DETAIL_ZOOM the regional rivers (world.ts detailFor) are drawn instead of these inside the box.
  const regional = zoom >= REGION_DETAIL_ZOOM && boundsIntersect(view, REGION);
  const parts = d.rivers.filter((river) => river.r <= rank).flatMap((river) => (regional ? river.parts.filter((p) => !insideRegion(p.bounds)) : river.parts));
  return { rivers: { type: 'MultiLineString', coordinates: visibleParts(parts, view) }, lakes: { type: 'MultiPolygon', coordinates: visibleParts(d.lakes, view) } };
}
```

- [ ] **Step 4: `placePhysicalLabels` in `src/map/styleLabels.ts`**

```ts
import { PHYSICAL_NAMES, type PhysicalKind } from './physical';
import { t } from '../i18n/i18n.svelte';

export const PHYSICAL_FONT = 11.5;

export function placePhysicalLabels(ctx: ViewCtx, lang: LangCode, obstacles: readonly LabelBox[]): (StyleLabel & { kind: PhysicalKind })[] {
  const zoom = tierZoom(ctx.zoom, ctx.width / ctx.px);
  const size = PHYSICAL_FONT * ctx.px;
  const items = PHYSICAL_NAMES.flatMap((p, rank) => {
    if (zoom < p.minZoom) return [];
    const xy = ctx.project(p);
    if (!xy || !insideView(ctx, xy)) return [];
    const text = t(`physical.${p.id}`, undefined, lang);
    // Mountain names are spaced out capitals (wider); seas, rivers and deserts are italic.
    const width = labelWidth(text, PHYSICAL_FONT, ctx.px) * (p.kind === 'mountains' ? 1.25 : 1);
    const y = xy[1] + size * 0.35;
    const box = textBox(xy[0], y, width, size, 'middle');
    if (box.left < 0 || box.right > ctx.width) return [];
    return [{ rank: p.minZoom * 100 + rank, label: { id: p.id, text, x: xy[0], y, size, box, kind: p.kind } }];
  });
  const chosen = selectLabelPlacements(items, (i) => [i.label.box], (i) => i.rank, obstacles);
  return items.filter((_, k) => chosen[k]! >= 0).map((i) => i.label);
}
```
(`t(key, params, lang)` never mutates state, so it is safe here.) Run the unit tests — Expected: PASS.

- [ ] **Step 5: `src/map/layers/PhysicalWater.svelte` and wiring**

```svelte
<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import { physicalWaterFor } from '../physical';
  import { detailFor, landFor } from '../world';
  let { ctx }: { ctx: ViewCtx } = $props();
  const water = $derived(physicalWaterFor(ctx.zoom, ctx.bounds));
  const lakesD = $derived(ctx.path(water.lakes) ?? '');
  const riversD = $derived(ctx.path(water.rivers) ?? '');
  // Central Europe: the detailed lakes from zoom 4, the detailed rivers from zoom 6 (world.ts level of detail).
  const regionLakesD = $derived.by(() => { const r = landFor(ctx.zoom, ctx.bounds).region; return r ? (ctx.regionPath(r.lakes) ?? '') : ''; });
  const regionRivers = $derived((detailFor(ctx.zoom, ctx.bounds)?.rivers ?? []).map((r) => ({ id: r.id, d: ctx.regionPath(r.line) ?? '' })));
</script>

<g class="physical-water" aria-hidden="true">
  <path class="lake" d={lakesD} />
  {#if regionLakesD}<path class="lake" d={regionLakesD} />{/if}
  <path class="river" d={riversD} />
  {#each regionRivers as r (r.id)}<path class="river" data-river={r.id} d={r.d} />{/each}
</g>

<style>
  .physical-water { pointer-events: none; }
  .lake { fill: var(--physical-water); stroke: var(--physical-water-edge); stroke-width: calc(0.6px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .river { fill: none; stroke: var(--physical-water-edge); stroke-width: calc(1.2px * var(--stroke-scale)); stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
```
Tokens (light `:root` and both dark blocks, identical values — the relief texture looks the same in both themes): `--physical-water: #9cc9e8; --physical-water-edge: #3f7fb5; --relief-label: #5a3a1c; --sea-label: #1d4f7a;` and inside `.frame[data-map-style="physical"]` (append after the Satellite rule in tokens.css): `.frame[data-map-style="physical"] { --halo: #f8fbfd; --text: #16202b; --map-label: #26323e; }` — the relief is light in every theme, so map text stays dark on a light halo. In presenter mode add `:root[data-presenter="true"] .frame[data-map-style="physical"] { --relief-label: #3f2812; --sea-label: #123a5c; }`.

`src/map/layers/Layers.svelte`: right after `<SpecialLines {ctx} part="lines" />`:
```svelte
{#if style === 'physical'}
  <svelte:boundary onerror={vectorFailed}><PhysicalWater {ctx} /></svelte:boundary>
{/if}
```

`src/map/layers/Places.svelte`:
- `const physical = $derived(mapState.drawnMapStyle === 'physical');`; `showContinents` also `&& !physical` (physical names replace continent names).
- after `countryNames`:
```ts
  const physicalNames = $derived.by(() => {
    if (!physical || !mapState.layers.places) return [];
    try {
      return placePhysicalLabels(ctx, i18n.lang, [...lineObstacles, ...edgeObstacles, ...pointObstacles, ...overlayObstacles, ...[...placements.values()].map((o) => o.box), ...schoolMarks, ...chosenBoxes]);
    } catch (e) {
      console.warn('physical names:', e);
      queueMicrotask(() => reportHealth({ type: 'vector-fail' }));
      return [];
    }
  });
```
- `riverLabels` and `schoolLabels` also avoid `...physicalNames.map((l) => l.box)`.
- markup after the country names: `{#each physicalNames as l (l.id)}<text class="halo physical-name {l.kind}" data-physical={l.id} x={l.x} y={l.y} text-anchor="middle" font-size={l.size}>{l.text}</text>{/each}`
- CSS: `.physical-name { fill: var(--relief-label); font-weight: 650; } .physical-name.mountains { text-transform: uppercase; letter-spacing: 0.12em; } .physical-name.sea, .physical-name.river { fill: var(--sea-label); font-style: italic; letter-spacing: 0.03em; } .physical-name.desert, .physical-name.plateau { font-style: italic; }`.

- [ ] **Step 6: E2E `tests/e2e/physical.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

type S = { setFlatPreset(p: string): void; setFlatView(c: object, z: number): void };
const view = (page: import('@playwright/test').Page, fn: string) => page.evaluate((f) => new Function('s', f)((window as unknown as { __mapState: S }).__mapState), fn);

test('Physical: rivers and lakes over the relief, names that follow the zoom, no continent names', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await expect(page.locator('.view-flat g.physical-water path.river').first()).toHaveAttribute('d', /M/);
  await expect(page.locator('.view-flat g.physical-water path.lake').first()).toHaveAttribute('d', /M/);
  await expect(page.locator('.view-flat text.map-label')).toHaveCount(0);
  await expect(page.locator('.view-flat text.physical-name[data-physical="sahara"]')).toHaveText('Sahara');

  await view(page, "s.setFlatPreset('europe')");
  await expect(page.locator('.view-flat text.physical-name[data-physical="alps"]')).toHaveText('Alps');
  await expect(page.locator('.view-flat text.physical-name[data-physical="tatra"]')).toHaveCount(0);

  await view(page, 's.setFlatView({ lat: 49.6, lon: 20 }, 12)');
  await expect(page.locator('.view-flat text.physical-name[data-physical="tatra"]')).toHaveText('Tatra Mountains');
  await expect(page.locator('.view-flat g.physical-water path.river[data-river="vistula"]')).toHaveCount(1);
  await expectNoAxeViolations(page, 'lab physical tatras');

  // Physical names never cover a place name.
  const boxes = await page.locator('.view-flat svg').evaluate((svg) => {
    const r = (sel: string) => [...svg.querySelectorAll<SVGTextElement>(sel)].map((t) => t.getBBox());
    return { names: r('text.physical-name'), places: r('text.place-name') };
  });
  for (const a of boxes.names) for (const b of boxes.places) expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(false);
  expect(pageErrors(page)).toEqual([]);
});

test('Physical names in Polish and Ukrainian', async ({ page }) => {
  for (const [lang, alps] of [['pl', 'ALPY'], ['uk', 'АЛЬПИ']] as const) {
    await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'physical'));
    await openPage(page, `${lang}/lab`, '?test');
    await waitForTexture(page, 'flat');
    await view(page, "s.setFlatPreset('europe')");
    await expect(page.locator('.view-flat text.physical-name[data-physical="alps"]')).toHaveText(new RegExp(alps, 'i'));
  }
});
```
(`toHaveText` compares the DOM text, which is not upper-cased by CSS; the `i` flag makes `Alpy`/`Альпи` match.)

- [ ] **Step 7: Run, look, commit**

```bash
npm run check && npm test
npm run build && npm run e2e
```
Expected: all PASS. Look at Physical at world, Europe, Poland and zoom 12 over the Tatras, light and dark, 375 and 1366 px: rivers line up with the relief's valleys, names legible and not crowding city names.
```bash
git add src/map/physical.ts src/map/layers/PhysicalWater.svelte src/map/styleLabels.ts src/map/layers/Layers.svelte src/map/layers/Places.svelte src/styles/tokens.css src/i18n scripts/translation-review-lib.ts tests/unit/physical.test.ts tests/unit/style-labels.test.ts tests/e2e/physical.spec.ts
git commit -m "feat(map): Physical style rivers, lakes and names of mountains, deserts and seas"
```
