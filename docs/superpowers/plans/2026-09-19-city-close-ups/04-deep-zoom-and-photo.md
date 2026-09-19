# Part 4 — Deep zoom and the third blend level (spec §9.4)

Task 4 makes it possible to *reach* a box; Task 5 paints the photo inside it. Read spec §5 and planning rulings
R1, R2, R3, R11, R12, R13, R14, R15 first.

Both tasks end by re-running `tests/e2e/atlas-baseline.spec.ts`. Those seven screenshots are **never regenerated**:
a diff means the change is wrong.

---

### Task 4: The zoom ceiling, box maths, the parallel step and the scene flag

Nothing new is drawn. What changes: the flat map can zoom to 6000 instead of 80, the parallels stop bowing when it
does, scenes can say they offer close-ups, and `boxMix` exists for Task 5.

**Files:**
- Modify: `src/map/geometry.ts`, `src/map/mapState.svelte.ts`, `src/map/types.ts`, `src/map/FlatMap.svelte`,
  `src/map/layers/SpecialLines.svelte`, `src/map/layers/PointMarker.svelte`, `src/map/layers/Overlays.svelte`,
  `src/map/chosenLabel.ts`, `src/map/texture/inverse.ts`, `src/quiz/values.ts` (a comment), `src/app/LabPage.svelte`,
  `src/topics/t4-finding.ts`, `src/topics/t9-phone.ts`, `src/topics/t10-seasons.ts`
- Modify (existing tests, ruling R2 — these three and nothing else): `tests/unit/mapState.test.ts`,
  `tests/unit/schools.test.ts`, `tests/e2e/deep-zoom.spec.ts`
- Test: `tests/unit/parallel-step.test.ts`, `tests/unit/box-mix.test.ts`, `tests/unit/mapState-close-ups.test.ts`,
  `tests/unit/gridStep.test.ts` (extend)

**Interfaces:**
- Consumes (Task 1): `src/map/cityBoxes.ts` — `CITY_BOXES`, `CityBox { id, lat, lon, bounds, fitZoom, note }`,
  `CITY_STREET_ZOOM = 24`, `CITY_PHOTO_ZOOM = 40`, `CITY_PHOTO_FULL_ZOOM = 80`, `cityBoxAt`, `visibleCityBox`, `fitZoom`.
- Produces:
  ```ts
  // src/map/geometry.ts
  export function parallelStep(zoom: number): number;   // exactly 1 at or below zoom 80
  // src/map/texture/inverse.ts
  export function boxMix(v: TextureView, box: GeoBounds, fadeFrom: number, fullAt: number): number;
  export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number;  // unchanged signature
  // src/map/mapState.svelte.ts
  export const FLAT_MAX_ZOOM = 6000;
  export const SCHOOL_MAX_ZOOM = 80;
  // MapState: closeUps: boolean   (from SceneSpec.closeUps, default false)
  //   Task 7 renames this field to `closeUpsScene` and adds a `get closeUps()` that also checks the pupil's
  //   "Places up close" switch, so every reader written in Tasks 4-6 keeps working unchanged.
  // src/map/types.ts
  // SceneSpec gains: closeUps?: boolean
  ```

---

- [ ] **Step 1: Write the failing test `tests/unit/parallel-step.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { makeFlatCtx, parallelLine, parallelStep } from '../../src/map/geometry';

/**
 * A parallel is not a great circle, and d3 draws every segment as one, so a `parallelLine` with vertices `step`
 * degrees apart bows away from the true parallel between them. The bow's maximum is at the middle of a segment,
 * where the great circle's latitude is atan(tan φ / cos(Δλ/2)); in view units it is that excess times the map's
 * units per degree (960 · zoom / 360). `parallelStep` shrinks the step so the bow stays where it is today.
 */
function bowUnits(lat: number, stepDeg: number, zoom: number): number {
  const phi = (lat * Math.PI) / 180;
  const half = (stepDeg * Math.PI) / 360;
  const excess = (Math.atan(Math.tan(phi) / Math.cos(half)) * 180) / Math.PI - lat;
  return excess * ((960 * zoom) / 360);
}

describe('parallelStep', () => {
  test('exactly 1 at or below zoom 80, so nothing Atlas draws today moves (planning ruling R3)', () => {
    for (const zoom of [0.5, 1, 3.5, 9, 12, 20, 40, 79.9, 80]) expect(parallelStep(zoom), String(zoom)).toBe(1);
  });

  test('above zoom 80 it shrinks as 1/sqrt(zoom), which holds the bow constant', () => {
    expect(parallelStep(320)).toBeCloseTo(0.5, 10);
    expect(parallelStep(4270)).toBeCloseTo(0.13688, 5);
    expect(parallelStep(6000)).toBeCloseTo(0.11547, 5);
    for (const zoom of [80, 200, 1000, 4270, 6000]) {
      expect(bowUnits(50.26, parallelStep(zoom), zoom), `zoom ${zoom}`).toBeCloseTo(0.229, 2);
    }
  });

  test('without it a city zoom would bow the line 17 view units off the feature it names', () => {
    expect(bowUnits(50.26, 1, 6000)).toBeGreaterThan(17);
    expect(bowUnits(50.26, 1, 80)).toBeLessThan(0.25);
  });

  test('the drawn path really follows the parallel at a city zoom', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 66.5436, lon: 25.8475 }, 2659, 1, 'grid');
    // The Arctic Circle across the Rovaniemi box: every vertex of the drawn line must project to the same y as
    // the true parallel does at the middle of the view.
    const trueY = ctx.project({ lat: 66.5436, lon: 25.8475 })![1];
    const line = parallelLine(66.5436, parallelStep(ctx.zoom));
    const near = line.coordinates.filter(([lon]) => Math.abs(lon! - 25.8475) < 0.1);
    expect(near.length).toBeGreaterThan(1);
    for (const [lon, lat] of near) {
      const xy = ctx.project({ lat: lat!, lon: lon! })!;
      expect(Math.abs(xy[1] - trueY), `${lon}`).toBeLessThan(0.01);
    }
  });

  test('parallelLine still takes its step and defaults to 1', () => {
    expect(parallelLine(0).coordinates.length).toBe(361);
    expect(parallelLine(0, 0.5).coordinates.length).toBe(721);
    expect(parallelLine(12, 1).coordinates[0]).toEqual([-180, 12]);
  });
});
```

- [ ] **Step 2: Add `parallelStep` to `src/map/geometry.ts`**

Right after the existing `parallelLine`, and change `parallelLine`'s comment to point at it:

```ts
/**
 * The vertex step (degrees of longitude) a `parallelLine` needs at flat zoom `zoom`.
 *
 * d3 draws every segment as a great-circle arc, and a parallel is not one, so the drawn line bows towards the
 * pole between two vertices. The bow grows with the square of the step and linearly with the zoom: at 50°N a 1°
 * step is 0.229 view units at zoom 80 — the value the lesson was tuned to — and would be 17.2 units at zoom 6000,
 * which would put the equator beside the monument at Mitad del Mundo, the Arctic Circle beside its marker at
 * Rovaniemi and the point's own latitude guide visibly off the point. Shrinking the step as 1/sqrt(zoom) holds
 * the bow at 0.229 units at every zoom, and the `min(1, …)` makes it *exactly* 1 at or below zoom 80, so every
 * map the lesson drew before this feature is byte-identical (planning rulings R11, R3).
 *
 * Meridians are great circles, so `meridianLine` needs nothing of the kind.
 */
export function parallelStep(zoom: number): number {
  return Math.min(1, Math.sqrt(80 / Math.max(1e-6, zoom)));
}
```

- [ ] **Step 3: Use it at the four call sites**

Each of these draws a parallel through the whole world and must not bow at a city zoom. Read each file first.

- `src/map/layers/SpecialLines.svelte` — `GEO` is built once per language change, but the step depends on the
  view, so move the `ctx` into the derived:
  ```svelte
  const step = $derived(parallelStep(ctx.zoom));
  const GEO: Record<string, (s: number) => GeoJSON.LineString> = {
    eq: (s) => parallelLine(0, s), pm: () => meridianLine(0), am: () => meridianLine(180),
    tc: (s) => parallelLine(TROPIC, s), tk: (s) => parallelLine(-TROPIC, s),
    ac: (s) => parallelLine(POLAR, s), aa: (s) => parallelLine(-POLAR, s),
  };
  const lines = $derived.by<Line[]>(() => {
    void i18n.lang;
    return lineLabelSpecs(mapState.layers).map((spec) => ({ ...spec, geo: GEO[spec.id]!(step) }));
  });
  ```
  and import `parallelStep` beside `parallelLine`.
- `src/map/layers/PointMarker.svelte` line 19: `ctx.path(parallelLine(p.lat, parallelStep(ctx.zoom)))`.
- `src/map/layers/Overlays.svelte` line 52: `parallelLine(o.value, parallelStep(ctx.zoom))`.
- `src/map/chosenLabel.ts` line 214: `crosses(parallelLine(point.lat, Math.min(0.5, parallelStep(ctx.zoom))))` —
  it already asks for a finer 0.5° step; keep that as the ceiling and go finer when the zoom needs it.

- [ ] **Step 4: Run the parallel tests**

```bash
npx vitest run tests/unit/parallel-step.test.ts
npm run check
```
Expected: PASS, no type errors.

- [ ] **Step 5: Raise the ceiling in `src/map/mapState.svelte.ts`**

```ts
/**
 * Deep enough for a 6 x 4 km city close-up box to fill the view (Places up close spec §3). The twelve boxes fill
 * a 960 x 480 view between zoom 2 659 (Rovaniemi) and 5 009 (the boxes their 4 km height binds), so 6000 leaves
 * about 20 % of room past the deepest of them. Before the close-ups this was 80, where a box was 18 of 960 view
 * units across (planning ruling R1).
 */
export const FLAT_MAX_ZOOM = 6000;
const MAX_ZOOM = FLAT_MAX_ZOOM;
/**
 * How close the Maple Bear school list, a school badge and the school clustering go — unchanged at 80, the old
 * ceiling. Those views are about telling two schools apart, not about reading a street, and letting them reach
 * 6000 would fling the map to a blur on one click (planning ruling R2).
 */
export const SCHOOL_MAX_ZOOM = 80;
export const GLOBE_MIN_ZOOM = 1;
/** The globe keeps its old ceiling: city close-ups are a flat-map feature (planning ruling R1). */
export const GLOBE_MAX_ZOOM = 60;
```
Then in `chooseSchool` change `isolatingFlatZoom(school, this.flatProjection, flatPx, FLAT_MAX_ZOOM)` to
`… SCHOOL_MAX_ZOOM)`, and in `src/map/FlatMap.svelte` line 137 change
`clusterClick(ctx, drag.cluster, FLAT_MAX_ZOOM, …)` to `clusterClick(ctx, drag.cluster, SCHOOL_MAX_ZOOM, …)`
(import `SCHOOL_MAX_ZOOM` instead of `FLAT_MAX_ZOOM` there). Update the comment in `src/quiz/values.ts` line 26
to say "(The map itself zooms to FLAT_MAX_ZOOM, 6000, for the city close-ups.)". `src/quiz/paper.ts`'s clamp is
left alone: no paper scene sets a zoom anywhere near it.

- [ ] **Step 6: The scene flag**

In `src/map/types.ts`, inside `SceneSpec` right after `mapStyle`:
```ts
  closeUps?: boolean;                    // offers the twelve city close-ups in this scene (spec §2 "Where it appears")
```
In `MapState`, beside the other scene-derived fields:
```ts
  /**
   * Whether this scene offers the city close-ups at all (spec §2: free play, the lab, topic 9's find step — never
   * questions, rehearsal or worksheets). The photo, the street layer and the "Places up close" list all check it,
   * so a close-up can never appear where the lesson does not want one (planning ruling R10).
   */
  closeUps = $state(false);
```
and in `replaceScene`, beside `this.schoolsToggle = scene.schoolsToggle ?? false;`:
```ts
    this.closeUps = scene.closeUps ?? false;
```
Set `closeUps: true` on exactly these scenes (read each file first, change only the scene object named):
- `src/app/LabPage.svelte`'s `applyScene({ … })`
- `src/topics/t4-finding.ts`, the `play` step's scene
- `src/topics/t9-phone.ts`, the `find` step's scene and the `play` step's scene
- `src/topics/t10-seasons.ts`, the `play` step's scene

- [ ] **Step 7: `boxMix` in `src/map/texture/inverse.ts`**

Replace the existing `regionMix` with the pair, keeping `regionMix`'s signature and behaviour exactly:

```ts
/**
 * How much of a detail tile to blend in for this view: 0 below `fadeFrom` or away from the box, rising linearly to
 * 1 at `fullAt`. The Central Europe tile and a city box are the same mechanism at two scales (spec §5).
 */
export function boxMix(v: TextureView, box: GeoBounds, fadeFrom: number, fullAt: number): number {
  if (!boundsIntersect(v.bounds, box)) return 0;
  return Math.max(0, Math.min(1, (v.zoom - fadeFrom) / (fullAt - fadeFrom)));
}

/** How much of the Central Europe detail tile to blend in: 0 below `minZoom` or away from the region, 1 from one zoom level above. */
export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number {
  return boxMix(v, region, minZoom, minZoom + 1);
}
```

`tests/unit/box-mix.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { CITY_PHOTO_FULL_ZOOM, CITY_PHOTO_ZOOM, cityBoxById } from '../../src/map/cityBoxes';
import { makeFlatCtx } from '../../src/map/geometry';
import { boxMix, regionMix } from '../../src/map/texture/inverse';
import { textureView } from '../../src/map/texture/viewParams';
import { REGION, REGION_MIN_ZOOM } from '../../src/map/world';

const katowice = cityBoxById('katowice')!;
const view = (lat: number, lon: number, zoom: number) =>
  textureView(makeFlatCtx(960, 480, { lat, lon }, zoom, 1, 'grid'));

describe('boxMix', () => {
  test('regionMix is unchanged: 0 at the minimum zoom, 1 one level above, 0 away from the region', () => {
    expect(regionMix(view(50, 19, REGION_MIN_ZOOM), REGION, REGION_MIN_ZOOM)).toBe(0);
    expect(regionMix(view(50, 19, REGION_MIN_ZOOM + 0.5), REGION, REGION_MIN_ZOOM)).toBeCloseTo(0.5, 10);
    expect(regionMix(view(50, 19, REGION_MIN_ZOOM + 3), REGION, REGION_MIN_ZOOM)).toBe(1);
    expect(regionMix(view(-20, -60, 20), REGION, REGION_MIN_ZOOM)).toBe(0);
  });

  test('a city box fades in between zoom 40 and zoom 80 (spec §5)', () => {
    const mix = (zoom: number) => boxMix(view(katowice.lat, katowice.lon, zoom), katowice.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM);
    expect(mix(12)).toBe(0);          // the Atlas baseline scene's zoom (planning ruling R3)
    expect(mix(24)).toBe(0);
    expect(mix(40)).toBe(0);
    expect(mix(60)).toBeCloseTo(0.5, 10);
    expect(mix(80)).toBe(1);
    expect(mix(4270)).toBe(1);
  });

  test('a view nowhere near the box never mixes it in, however deep it is', () => {
    expect(boxMix(view(0, 0, 4000), katowice.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM)).toBe(0);
    expect(boxMix(view(52.2297, 21.0122, 4000), katowice.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM)).toBe(0);
  });
});
```

- [ ] **Step 8: `tests/unit/mapState-close-ups.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { FLAT_MAX_ZOOM, MapState, SCHOOL_MAX_ZOOM } from '../../src/map/mapState.svelte';
import { CITY_BOXES } from '../../src/map/cityBoxes';

describe('MapState and the city close-ups', () => {
  test('the flat map reaches every box\'s fit zoom; the globe and the school views do not follow it up', () => {
    expect(FLAT_MAX_ZOOM).toBe(6000);
    expect(SCHOOL_MAX_ZOOM).toBe(80);
    const s = new MapState();
    for (const b of CITY_BOXES) {
      s.setFlatView(b, b.fitZoom);
      expect(s.flat.zoom, b.id).toBeCloseTo(b.fitZoom, 6);
      expect(s.flat.center.lat, b.id).toBeCloseTo(b.lat, 4);
      expect(s.flat.center.lon, b.id).toBeCloseTo(b.lon, 4);
    }
    s.setFlatView({ lat: 0, lon: 0 }, 99_999);
    expect(s.flat.zoom).toBe(FLAT_MAX_ZOOM);
  });

  test('a scene says whether it offers close-ups, and it is off unless it does', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'] });
    expect(s.closeUps).toBe(false);
    s.applyScene({ views: ['flat'], closeUps: true });
    expect(s.closeUps).toBe(true);
    s.applyScene({ views: ['flat'] });
    expect(s.closeUps).toBe(false);
  });
});
```

- [ ] **Step 9: Extend `tests/unit/gridStep.test.ts` (planning ruling R12)**

Read the file first and add, keeping everything in it:
```ts
test('at a city close-up zoom the adaptive grid is one minute, on desktop and on a phone', () => {
  // 960 CSS px showing 360/4270 degrees: 11 387 px per degree, so a minute is 189 px — the top of the band.
  expect(chooseGridStep((960 * 4270) / 360, 960)).toBeCloseTo(1 / 60, 10);
  // A 351 px phone at the same zoom: 4 163 px per degree, a minute is 69 px, inside the band.
  expect(chooseGridStep((351 * 4270) / 360, 351)).toBeCloseTo(1 / 60, 10);
  // Even at the new ceiling there is no finer rung: minutes are as fine as the lesson goes.
  expect(chooseGridStep((960 * 6000) / 360, 960)).toBeCloseTo(1 / 60, 10);
  expect(Math.min(...AUTO_GRID_STEPS)).toBeCloseTo(1 / 60, 10);
});
```
(`AUTO_GRID_STEPS` is already exported; add it to the file's import if it is not already imported.)

- [ ] **Step 10: The three existing-test edits (planning ruling R2 — these and nothing else)**

`tests/unit/mapState.test.ts` line ~190: `expect(FLAT_MAX_ZOOM).toBe(80)` → `expect(FLAT_MAX_ZOOM).toBe(6000)`.
Import `SCHOOL_MAX_ZOOM` and add `expect(SCHOOL_MAX_ZOOM).toBe(80);` on the next line. Line ~189 asserts a clamped
zoom equals `FLAT_MAX_ZOOM`; read the test and make sure the value it starts from is still above 6000 — if it
zooms from a smaller number by a factor, raise the number of steps so it still reaches the ceiling.

`tests/unit/schools.test.ts`: replace every `FLAT_MAX_ZOOM` argument passed to `clusterClick`,
`clusterZoomTarget` and `isolatingFlatZoom` with `SCHOOL_MAX_ZOOM`, and change the import. `GLOBE_MAX_ZOOM` stays.
Behaviour is identical — `SCHOOL_MAX_ZOOM` is the old value.

`tests/e2e/deep-zoom.spec.ts`, the test named "flat map zoom stops at 80 and the globe at 60": rename it and
rewrite its body so it checks the new ceiling without breaking the click-accuracy check, which needs zoom 80:
```ts
test('flat map zoom stops at 6000 and the globe at 60', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flat = page.getByRole('group', { name: 'World map with parallels and meridians' });
  await flat.focus();
  // Each press multiplies the zoom by 1.5; 1.5^22 is about 5 300 000, well past the ceiling.
  for (let i = 0; i < 22; i++) await page.keyboard.press('+');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  await globe.focus();
  for (let i = 0; i < 14; i++) await page.keyboard.press('+');
  const z = await page.evaluate(() => { const s = (window as unknown as { __mapState: { flat: { zoom: number }; globeZoom: number } }).__mapState; return [s.flat.zoom, s.globeZoom]; });
  expect(z).toEqual([6000, 60]);

  // Clicking still places the point exactly where clicked. At zoom 80 a minute is about 2 CSS px, which is what
  // this check was written for; the deeper zooms are covered by tests/e2e/city-streets.spec.ts.
  await page.evaluate(() => { const s = (window as unknown as { __mapState: { precision: string; flat: unknown } }).__mapState; s.precision = 'minute'; s.flat = { center: { lat: 50.26, lon: 19.02 }, zoom: 80 }; });
  const box = (await flat.boundingBox())!;
  await flat.click({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
  const hb = (await flat.locator('[data-point-handle]').boundingBox())!;
  expect(Math.abs(hb.x + hb.width / 2 - (box.x + box.width * 0.7))).toBeLessThan(3);
  expect(Math.abs(hb.y + hb.height / 2 - (box.y + box.height * 0.3))).toBeLessThan(3);
});
```

- [ ] **Step 11: Run everything, including the Atlas baselines**

```bash
npm run check && npm test
npm run build
npx playwright test tests/e2e/atlas-baseline.spec.ts tests/e2e/deep-zoom.spec.ts tests/e2e/schools.spec.ts tests/e2e/map-layers.spec.ts
```
Expected: all pass, the seven Atlas baselines with zero diff. If a baseline differs, `parallelStep` is returning
something other than exactly 1 at that scene's zoom, or a call site is passing a step where it passed none — fix
that, never the snapshot.

- [ ] **Step 12: Commit**

```bash
git add src/map/geometry.ts src/map/mapState.svelte.ts src/map/types.ts src/map/FlatMap.svelte \
  src/map/layers/SpecialLines.svelte src/map/layers/PointMarker.svelte src/map/layers/Overlays.svelte \
  src/map/chosenLabel.ts src/map/texture/inverse.ts src/quiz/values.ts src/app/LabPage.svelte \
  src/topics/t4-finding.ts src/topics/t9-phone.ts src/topics/t10-seasons.ts \
  tests/unit/parallel-step.test.ts tests/unit/box-mix.test.ts tests/unit/mapState-close-ups.test.ts \
  tests/unit/gridStep.test.ts tests/unit/mapState.test.ts tests/unit/schools.test.ts tests/e2e/deep-zoom.spec.ts
git commit -m "feat(map): zoom to 6000 for the city boxes, with parallels that stay straight"
```

**Report:** the three existing tests you edited and why; the Atlas baseline result; the fit zoom the map now
reaches for each of the twelve; whether the grid really shows minutes at those zooms.

---

### Task 5: The third blend level — the city photo in the shader and its CPU twin

**Files:**
- Create: `src/map/texture/cityAssets.ts`
- Modify: `src/map/texture/shaders.ts`, `src/map/texture/cpuShade.ts`, `src/map/texture/webgl.ts`,
  `src/map/texture/canvas2d.ts`, `src/map/texture/renderer.ts`, `src/map/texture/TextureLayer.svelte`,
  `tests/e2e/helpers.ts`
- Test: `tests/unit/cpu-shade.test.ts` (extend), `tests/e2e/city-photo.spec.ts`

**Interfaces:**
- Consumes (Tasks 1, 3, 4): `CITY_BOXES`, `CityBox`, `CITY_PHOTO_ZOOM = 40`, `CITY_PHOTO_FULL_ZOOM = 80`,
  `visibleCityBox(view, zoom)`; `boxMix(v, box, fadeFrom, fullAt)`; `MapState.closeUps`; the page's
  `<script type="application/x-geo-photo" id="geo-photo-<id>" data-width data-height>` base64 blocks; the existing
  `RenderFailure`, `DrawInputs`, `StyleTextures`, `TextureRenderer`, `decodeBase64`, `fitWithin`, `countTextureDecode`.
- Produces:
  ```ts
  // src/map/texture/cityAssets.ts
  export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';
  export interface CityPhoto { id: CityBoxId; width: number; height: number; bounds: GeoBounds;
    source: PhotoSourceKey; captured: string; groundM: number; bytes: number; mime: 'image/webp' }
  export const CITY_PHOTOS: Readonly<Record<CityBoxId, CityPhoto>>;
  export function loadCityPhoto(id: CityBoxId): Promise<ImageBitmap>;
  export function releaseCityPhotosExcept(keep: CityBoxId | null): number;
  export function cachedCityPhotoBytes(): number;
  // src/map/texture/renderer.ts
  export interface CityDraw { bounds: GeoBounds; mix: number }
  // DrawInputs gains:  city: CityDraw | null
  // TextureRenderer gains:  setCityTexture(bmp: ImageBitmap | null): void
  // src/map/texture/cpuShade.ts
  // CpuTextures gains:  city: Sampled | null
  // tests/e2e/helpers.ts
  export async function setFlatView(page: Page, lat: number, lon: number, zoom: number): Promise<void>;
  ```

---

- [ ] **Step 1: `src/map/texture/cityAssets.ts`**

```ts
import manifest from '../data/city/photos/manifest.json';
import type { GeoBounds } from '../geometry';
import type { CityBoxId } from '../cityBoxes';
import { decodeBase64 } from './assets';
import { RenderFailure } from './renderer';
import { countTextureDecode } from './testHooks';

/*
 * The embedded city close-up photos (scripts/city-plugin.ts puts each WebP into the page as base64 in a
 * <script type="application/x-geo-photo" id="geo-photo-<id>">). One is decoded at a time: a box only ever fills
 * the view on its own, and the twelve decoded together would be about 30 MB of RGBA held for the page's life
 * (planning ruling R13).
 */
export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';

export interface CityPhoto {
  id: CityBoxId;
  width: number;
  height: number;
  bounds: GeoBounds;
  source: PhotoSourceKey;
  /** The date the photo was taken, `YYYY-MM-DD`, or '' where the source does not say. */
  captured: string;
  /** Metres on the ground per pixel: 4.17 for the school box, 5.0 for the other orthophotos, 10.0 for Sentinel-2. */
  groundM: number;
  bytes: number;
  mime: 'image/webp';
}

export const CITY_PHOTOS: Readonly<Record<CityBoxId, CityPhoto>> = Object.fromEntries(
  Object.entries(manifest.photos).map(([id, p]) => [id, {
    id: id as CityBoxId, width: p.width, height: p.height,
    bounds: { west: p.bounds[0], south: p.bounds[1], east: p.bounds[2], north: p.bounds[3] },
    source: p.source as PhotoSourceKey, captured: p.captured, groundM: p.groundM, bytes: p.bytes, mime: 'image/webp',
  }]),
) as Record<CityBoxId, CityPhoto>;

const cache = new Map<CityBoxId, Promise<ImageBitmap>>();

/** The RGBA a decoded photo holds — 4 bytes a pixel. */
const decodedBytes = (id: CityBoxId) => CITY_PHOTOS[id].width * CITY_PHOTOS[id].height * 4;

export function cachedCityPhotoBytes(): number {
  let total = 0;
  for (const id of cache.keys()) total += decodedBytes(id);
  return total;
}

/** Closes every decoded photo but `keep` and forgets them. Returns the bytes of RGBA given back. */
export function releaseCityPhotosExcept(keep: CityBoxId | null): number {
  let freed = 0;
  for (const [id, p] of [...cache]) {
    if (id === keep) continue;
    freed += decodedBytes(id);
    // Detached from the cache first, so nothing can hand out a closed bitmap; a load that failed has nothing to close.
    cache.delete(id);
    void p.then((b) => b.close(), () => {});
  }
  return freed;
}

export function loadCityPhoto(id: CityBoxId): Promise<ImageBitmap> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const block = document.getElementById(`geo-photo-${id}`);
      if (!block?.textContent) throw new RenderFailure('decode', `city photo ${id} is missing from the page`);
      try {
        const blob = new Blob([decodeBase64(block.textContent)], { type: 'image/webp' });
        countTextureDecode();
        return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      } catch (e) {
        throw new RenderFailure('decode', `city photo ${id}: ${(e as Error).message}`);
      }
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
```
`decodeBase64` is already exported from `src/map/texture/assets.ts`; do not copy it.

- [ ] **Step 2: `src/map/texture/renderer.ts`**

Add, beside the existing types:
```ts
/** The city close-up box being blended in, in degrees, and how much of it (0…1) — `inverse.ts`'s `boxMix`. */
export interface CityDraw { bounds: GeoBounds; mix: number }
```
(import `GeoBounds` from `../geometry`), add to `DrawInputs`:
```ts
  /** The city close-up photo to blend over everything else, or null when no box is in view (spec §5). */
  city: CityDraw | null;
```
and to `TextureRenderer`:
```ts
  /** The decoded close-up photo for the box in view, or null to drop it. Cheap to call with the same bitmap twice. */
  setCityTexture(bmp: ImageBitmap | null): void;
```

- [ ] **Step 3: The shader (`src/map/texture/shaders.ts`)**

Add three uniforms beside the region ones:
```glsl
uniform sampler2D uCity;   // the city close-up photo, in its own box's lon/lat frame
uniform vec4 uCityBox;     // west, south, east, north (radians); a unit box when uCityMix is 0
uniform float uCityMix;
```
In `main`, beside the `ruv` block (derivatives need uniform control flow, so this is computed for every fragment):
```glsl
  vec2 cuv = vec2((ll.x - uCityBox.x) / (uCityBox.z - uCityBox.x), (uCityBox.w - ll.y) / (uCityBox.w - uCityBox.y));
  vec2 cdx = dFdx(cuv);
  vec2 cdy = dFdy(cuv);
```
and after the region `mix`, before the night block:
```glsl
  // The third level (Places up close spec §5): the same blend as the region tile, with a feather scaled to the
  // box so a 6 x 4 km photo never appears as a sharp rectangle against the blur around it.
  float cityW = 0.0;
  if (uCityMix > 0.0) {
    float cedge = min(min(ll.x - uCityBox.x, uCityBox.z - ll.x), min(ll.y - uCityBox.y, uCityBox.w - ll.y));
    cityW = smoothstep(0.0, (uCityBox.w - uCityBox.y) / 12.0, cedge) * uCityMix;
    if (cityW > 0.0) color = mix(color, textureGrad(uCity, cuv, cdx, cdy).rgb, cityW);
  }
```
and change the night block's `night` line to fade the world night image out inside the box:
```glsl
  if (uNightOn == 1) {
    vec3 p = vec3(cos(ll.y) * cos(ll.x), cos(ll.y) * sin(ll.x), sin(ll.y));
    float altitude = asin(clamp(dot(p, uSun), -1.0, 1.0));
    float day = smoothstep(-6.0 * DEG, 0.0, altitude);
    vec3 night = min(textureGrad(uNight, uv, dx, dy).rgb * 1.15, vec3(1.0));
    // Black Marble is 4096 px for the whole world -- about 10 km a pixel -- so inside a 6 km box it is one flat
    // smear. Fade it towards a dimmed copy of the close-up instead, so a city box at night still shows its
    // streets rather than a coloured blur (planning ruling R23).
    night = mix(night, color * 0.35 + vec3(0.02, 0.03, 0.06), cityW);
    color = mix(night, color, day);
  }
```
`uCityBox` must never be degenerate: the renderer sets `(0, 0, 1, 1)` when no box is active, so the divisions
above stay finite even though `uCityMix` is 0.

Add `'uCity'`, `'uCityBox'`, `'uCityMix'` to `UNIFORMS` in `src/map/texture/webgl.ts`.

- [ ] **Step 4: `src/map/texture/webgl.ts`**

Beside `textures`, keep the city texture separately so the world images are not re-uploaded when the box changes:
```ts
  let cityTexture: WebGLTexture | null = null;
  let citySource: ImageBitmap | null = null;
```
Add to the returned object:
```ts
    setCityTexture(bmp: ImageBitmap | null) {
      if (bmp === citySource) return;
      if (cityTexture) { gl.deleteTexture(cityTexture); cityTexture = null; }
      citySource = bmp;
      if (!bmp) return;
      if (Math.max(bmp.width, bmp.height) > maxTextureSize) throw new RenderFailure('texture-size', `city photo ${bmp.width} px > MAX_TEXTURE_SIZE ${maxTextureSize}`);
      cityTexture = upload(bmp, false);   // clamped on both axes, like the region tile
    },
```
In `draw`, after the region uniforms:
```ts
      const city = input.city;
      gl.uniform1f(u.uCityMix, city && cityTexture ? city.mix : 0);
      gl.uniform4f(u.uCityBox, city ? city.bounds.west * RAD : 0, city ? city.bounds.south * RAD : 0,
        city ? city.bounds.east * RAD : 1, city ? city.bounds.north * RAD : 1);
```
and in the texture binding block: `bind(3, cityTexture ?? textures.region, 'uCity');`.
In `freeTextures` and `dispose`, delete `cityTexture` too and null `citySource`.

- [ ] **Step 5: `src/map/texture/cpuShade.ts` and `src/map/texture/canvas2d.ts`**

`CpuTextures` gains `city: Sampled | null`. In `shadePixel`, after the region block and before the night block:
```ts
  let cityW = 0;
  if (input.city && t.city && input.city.mix > 0) {
    const b = input.city.bounds;
    const W2 = b.west * RAD, S2 = b.south * RAD, E2 = b.east * RAD, N2 = b.north * RAD;
    const edge = Math.min(lambda - W2, E2 - lambda, phi - S2, N2 - phi);
    cityW = smooth(0, (N2 - S2) / 12, edge) * input.city.mix;
    if (cityW > 0) {
      sample(t.city, (lambda - W2) / (E2 - W2), (N2 - phi) / (N2 - S2), false, other);
      for (let c = 0; c < 3; c++) day[c] = day[c]! * (1 - cityW) + other[c]! * cityW;
    }
  }
```
and the night block's `other` blend becomes (the same arithmetic as the shader, in the same order):
```ts
  if (input.night && t.night) {
    const s = input.night;
    const dot = Math.cos(phi) * Math.cos(lambda) * s.x + Math.cos(phi) * Math.sin(lambda) * s.y + Math.sin(phi) * s.z;
    const w = smooth(-6 * RAD, 0, Math.asin(clamp1(dot)));
    sample(t.night, u, vv, true, other);
    for (let c = 0; c < 3; c++) {
      const lit = Math.min(255, other[c]! * 1.15);
      const dim = day[c]! * 0.35 + [0.02, 0.03, 0.06][c]! * 255;
      const nightC = lit * (1 - cityW) + dim * cityW;
      day[c] = nightC * (1 - w) + day[c]! * w;
    }
  }
```
Keep the file's standing rule at the top: *any change to `shadePixel` is made to `FRAGMENT_SHADER` in the same
commit.* Extend that comment to name the city level.

In `canvas2d.ts`'s `setTextures`, add `city: null` to the object it builds, and add:
```ts
    setCityTexture(bmp: ImageBitmap | null) {
      if (tex) tex.city = bmp ? sampled(bmp, 2048) : null;
    },
```
(`tex` is the `CpuTextures | null` the closure already holds; `sampled` is already in the file.)

- [ ] **Step 6: `src/map/texture/TextureLayer.svelte`**

Add the imports (`visibleCityBox`, `CITY_PHOTO_FULL_ZOOM`, `CITY_PHOTO_ZOOM` and the type `CityBoxId` from
`../cityBoxes`; `boxMix` from `./inverse`; `loadCityPhoto`, `releaseCityPhotosExcept` from `./cityAssets`) and:

```ts
  // The city close-up box this view is in (spec §5). Only where the scene offers close-ups (planning ruling R10)
  // and only in the two texture styles — Atlas and Political get the street layer with no photo (ruling R14).
  const cityBox = $derived(mapState.closeUps && isTextureStyle(style) ? visibleCityBox(ctx.bounds, ctx.zoom) : null);
  let cityLoaded = $state<CityBoxId | null>(null);

  // The box's photo, decoded on first entry and given back when the view leaves every box (ruling R13).
  $effect(() => {
    const r = renderer, box = cityBox;
    if (!r) return;
    if (!box) { r.setCityTexture(null); cityLoaded = null; releaseCityPhotosExcept(null); return; }
    let cancelled = false;
    loadCityPhoto(box.id).then(
      (bmp) => {
        if (cancelled) return;
        try { r.setCityTexture(bmp); cityLoaded = box.id; releaseCityPhotosExcept(box.id); } catch (e) { fail(e); }
      },
      (e) => { if (!cancelled) fail(e); },
    );
    return () => { cancelled = true; };
  });
```
and in the draw effect's `base`, add
```ts
    city: cityBox && cityLoaded === cityBox.id ? { bounds: cityBox.bounds, mix: boxMix(v, cityBox.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM) } : null,
```
The renderer-teardown effect already nulls `renderer`; add `cityLoaded = null` to its cleanup so a new tier
re-uploads the photo.

- [ ] **Step 7: Extend `tests/unit/cpu-shade.test.ts`**

Read the file first; it already builds `Sampled` textures by hand and compares `shadePixel` against known values.
Add, in its style:
```ts
test('a city box replaces the world colour inside it and feathers out at its edge', () => {
  const box = cityBoxById('katowice')!;
  const t = { day: flat(4, 2, [10, 20, 30]), region: flat(2, 2, [40, 50, 60]), night: null, city: flat(2, 2, [200, 100, 50]) };
  const v = textureView(makeFlatCtx(960, 480, { lat: box.lat, lon: box.lon }, box.fitZoom, 1, 'grid'));
  const input = { view: v, regionMix: 0, night: null, limb: false, glow: false, quality: 'full' as const, debug: 0 as const,
    city: { bounds: box.bounds, mix: 1 } };
  const out = new Uint8ClampedArray(8);
  // The middle of the view is the middle of the box: fully the photo.
  shadePixel(input, t, 480, 240, out, 0, 1);
  expect([out[0], out[1], out[2]]).toEqual([200, 100, 50]);
  // One view unit in from the left edge is inside the feather: a blend, not the photo and not the world.
  shadePixel(input, t, 1, 240, out, 4, 1);
  expect(out[4]).toBeGreaterThan(10);
  expect(out[4]).toBeLessThan(200);
  // With mix 0 nothing of the photo shows.
  shadePixel({ ...input, city: { bounds: box.bounds, mix: 0 } }, t, 480, 240, out, 0, 1);
  expect([out[0], out[1], out[2]]).toEqual([10, 20, 30]);
});
```
`flat(w, h, rgb)` is whatever the file's existing helper for a solid `Sampled` is called — reuse it; if the file
has no such helper, add one beside the others it already defines.

- [ ] **Step 8: `tests/e2e/helpers.ts` and `tests/e2e/city-photo.spec.ts`**

Add to `helpers.ts`:
```ts
/** Puts the flat map at a centre and zoom through MapState (the page must be opened with ?test). */
export async function setFlatView(page: Page, lat: number, lon: number, zoom: number): Promise<void> {
  await page.evaluate(([la, lo, z]) => {
    (window as unknown as { __mapState: { flat: unknown } }).__mapState.flat = { center: { lat: la, lon: lo }, zoom: z };
  }, [lat, lon, zoom] as const);
}
```

`tests/e2e/city-photo.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json';
import { openPage, pageErrors, probe, setFlatView, setMapStyle, waitForTexture } from './helpers';

const katowice = boxesJson.boxes.find((b) => b.id === 'katowice')!;
const fitZoom = Math.min(360 / (katowice.east - katowice.west), 180 / (katowice.north - katowice.south));

test('the close-up photo really sharpens inside the box and leaves everything outside it alone', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');

  // Well outside every box, at a zoom where the world image is all there is.
  await setFlatView(page, 50.26, 10, 60);
  await waitForTexture(page, 'flat', 2);
  const away = await probe(page, 'flat', 50.26, 10, 3);

  // Inside the box, one octave apart: the same spot must look different once the photo is mixed in.
  await setFlatView(page, katowice.lat, katowice.lon, 30);
  await waitForTexture(page, 'flat', 3);
  const before = await probe(page, 'flat', katowice.lat, katowice.lon, 3);
  await setFlatView(page, katowice.lat, katowice.lon, fitZoom);
  await waitForTexture(page, 'flat', 4);
  const after = await probe(page, 'flat', katowice.lat, katowice.lon, 3);

  expect(away).not.toBeNull();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  const diff = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // Zoom 30 is below the photo's fade-in (40): the picture there is still the world image, only magnified.
  expect(diff(after!.avg, before!.avg), 'the photo did not change the picture').toBeGreaterThan(24);
  // A close-up photo has real structure; a magnified world image is flat.
  expect(after!.maxSum).toBeGreaterThan(before!.maxSum);
  expect(pageErrors(page)).toEqual([]);
});

test('no box, no photo: a deep zoom somewhere else shows only the world image', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await setFlatView(page, 12.5, 40.5, 4000);       // open desert, 3 000 km from any box
  await waitForTexture(page, 'flat', 2);
  const decoded = await page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes?(): number } }).__mapTextures.cityBytes?.() ?? 0);
  expect(decoded).toBe(0);
  expect(pageErrors(page)).toEqual([]);
});

test('only one photo is ever decoded at a time (planning ruling R13)', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  const bytes = async () => page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes(): number } }).__mapTextures.cityBytes());
  for (const id of ['katowice', 'warsaw', 'paris'] as const) {
    const b = boxesJson.boxes.find((x) => x.id === id)!;
    await setFlatView(page, b.lat, b.lon, Math.min(360 / (b.east - b.west), 180 / (b.north - b.south)));
    await expect.poll(bytes, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await bytes(), id).toBeLessThanOrEqual(b.photoWidth * b.photoHeight * 4);
  }
});
```
This needs one hook: add `cityBytes: () => cachedCityPhotoBytes()` to the object `registerTextureView` /
`src/map/texture/testHooks.ts` exposes as `window.__mapTextures` (read that file first and follow its shape), and
add `cityBytes(): number` to the `Win` type in `tests/e2e/helpers.ts`.

- [ ] **Step 9: Run everything, look at the picture, and commit**

```bash
npm run check && npm test
npm run build
npx playwright test tests/e2e/city-photo.spec.ts tests/e2e/atlas-baseline.spec.ts \
  tests/e2e/texture-webgl.spec.ts tests/e2e/texture-fallback.spec.ts tests/e2e/satellite-night.spec.ts
```
Expected: all pass, the seven Atlas baselines with zero diff (nothing here touches Atlas: `isTextureStyle(style)`
gates the whole layer).

Then look at it. Set the Satellite style and the school box, and take a screenshot:
```bash
npm run shot -- en/lab city-katowice
```
and, in the browser, put the map at each of the twelve boxes at its fit zoom in Physical and in Satellite. Check
and write down:
1. The photo appears with no sharp rectangle at the box's edge (the feather works) and no seam or offset against
   the world image around it.
2. The photo is the right way up and in the right place: the features in it line up with the graticule and with
   the point marker's coordinates.
3. Between zoom 40 and 80 the photo fades in smoothly rather than popping.
4. In Satellite with the lab's night side over the box, the close-up is dimmed rather than buried under the blurry
   Black Marble smear.
5. The canvas tier draws the same picture: open with `?test&gl=off`, go to the school box, compare.

```bash
git add src/map/texture/cityAssets.ts src/map/texture/shaders.ts src/map/texture/cpuShade.ts \
  src/map/texture/webgl.ts src/map/texture/canvas2d.ts src/map/texture/renderer.ts \
  src/map/texture/TextureLayer.svelte src/map/texture/testHooks.ts tests/e2e/helpers.ts \
  tests/unit/cpu-shade.test.ts tests/e2e/city-photo.spec.ts
git commit -m "feat(map): blend the city close-up photo as a third texture level"
```

**Report:** what each of the twelve boxes looked like at its fit zoom in both texture styles (the five checks
above); the Atlas baseline result; the decoded-bytes numbers from the one-photo-at-a-time test; and any box whose
photo turned out misaligned (which would mean its `bounds` and its pixels disagree — a Task 1 problem, not a
Task 5 one).
