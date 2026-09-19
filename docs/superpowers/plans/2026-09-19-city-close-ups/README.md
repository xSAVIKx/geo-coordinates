# Places Up Close: City-Scale Maps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third level of detail inside twelve small 6 × 4 km boxes — an aerial photo under an OpenStreetMap street layer — so a pupil can go from the globe to their own school's street in one tap and still read the coordinates to the minute, with everything outside the boxes unchanged.

**Architecture:** A city box is a third level of the mechanism the Central Europe tile already uses. The fragment shader (and its CPU twin) gains one more `mix()` against a `uCity` sampler with its own box and fade, and the renderer gains `setCityTexture()` so only the box in view is uploaded. Streets are a new SVG layer built exactly like `Political.svelte` / `PhysicalWater.svelte`: one quantized, Visvalingam-simplified TopoJSON per box, decoded lazily from a data block in the page and thinned by the shared `levelOfDetail` helper in `world.ts`; the street names are placed by `styleLabels.ts` and drawn by `Places.svelte`, so they are last in the label queue and can never displace the lesson's own names. Photos come from **five different sources, chosen per box** — the national open orthophoto services of Poland, France, Japan and the United States where they exist (sub-metre, so buildings are visible), and Copernicus Sentinel-2 at 10 m everywhere else. Reaching a box needs a much higher zoom ceiling than the lesson has today (a 6 km box fills the view at zoom ≈ 2 700–5 000, not 80), so `FLAT_MAX_ZOOM` goes to 6000 and the parallel lines the lesson draws gain a zoom-aware vertex step so they stop bowing. A settings switch hides the whole feature.

**Tech Stack:** Svelte 5.57 (runes), TypeScript 6 strict, Vite 8 + vite-plugin-singlefile, d3-geo 3.1, topojson-server / -simplify / -client 3, WebGL 2 (GLSL ES 3.00), Canvas 2D, Vitest 5, Playwright 1.63 + axe-core. Build-time only: Python 3.13 + Pillow 12 (**no numpy, no rasterio, no GDAL** — the Sentinel-2 COG is read with HTTP range requests and `zlib`, the WMTS/XYZ sources with plain tile GETs), Node 24 with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-09-19-city-close-ups-design.md` (binding). Read it before any task. The feature it extends is specified in `docs/superpowers/specs/2026-09-15-map-styles-and-seasons-design.md` and planned in `docs/superpowers/plans/2026-09-15-map-styles/`; the original lesson is `docs/superpowers/specs/2026-09-13-geo-coordinates-design.md`.

The plan is split into files by the spec's §9 order of work. Execute tasks strictly in numeric order.

| File | Spec §9 part | Tasks |
|---|---|---|
| `01-photos.md` | 1. Data build: photos | 1 The twelve boxes and the five photo sources |
| `02-streets.md` | 2. Data build: street vectors | 2 Overpass fetch, simplification and the street TopoJSON |
| `03-size-budget.md` | 3. Size budget and embedding | 3 Embed photos and streets, 8 MiB limit, per-place breakdown, licence notices |
| `04-deep-zoom-and-photo.md` | 4. Texture layer | 4 The zoom ceiling, box maths and the parallel step · 5 The third blend level (GLSL and its CPU twin) |
| `05-street-layer.md` | 5. Street layer | 6 The street layer and its names, in all four styles |
| `06-controls-and-text.md` | 6. List, notes, topic 9, strings | 7 The settings switch, the close-up list, the three notes, topic 9's sentence, EN/PL/UK |
| `07-design-release.md` | 7. Design pass, release prep | 8 Design, UX and accessibility pass · 9 Release prep (no push, no merge) |

## Global Constraints

Every task's requirements implicitly include this section. Items in quotes are copied verbatim from the spec.

- "The single file stays under **8 MiB** (8,388,608 B), still offline, still no runtime network requests." `scripts/size-check.ts`'s limit is raised in Task 3, "with the per-asset breakdown listing each place". The file is 3,387,703 B today.
- "Atlas at desktop stays pixel-identical outside the boxes (the 7 baselines stand); inside a box, Atlas gains the street map, which is a deliberate, owner-approved change." The baselines in `tests/e2e/atlas-baseline.spec.ts-snapshots/` are **never regenerated**. If one fails, the change is wrong, not the snapshot. (Ruling R3 shows why none of the seven can contain a drawn box.)
- "**Fallback:** everything obeys the existing chain — any failure in the texture path falls back to Atlas; a failure in the street layer disables that layer only, as the other vector layers do." Failures are never persisted beyond the page session.
- "WCAG 2.2 AA holds on every route × style × theme; AAA in presenter mode." 44 px targets; keyboard-only operable; colour is never the only signal.
- EN/PL/UK parity: `src/i18n/en.json`, `pl.json`, `uk.json` keep identical base key sets and identical `{params}` (`tests/unit/i18n.test.ts`). JSON edits are serialized — only the task being executed edits these files; never run two tasks in parallel. Polish and Ukrainian are natural, school-level (11–12-year-olds, PL „ty”, UK «ти»); the texts written out in Task 7 are the source. New keys that are legitimately identical across languages go on the allow-lists in `scripts/translation-review-lib.ts` with a reason.
- Mean Sun: "the lessons, questions and topic 8 always use the mean Sun" (15° = 1 hour exact); only the lab's advanced switch differs. Nothing in this feature touches it.
- Borders: Natural Earth **Poland point of view** (Crimea, Sevastopol, Donbas in Ukraine; Kosovo a country; Western Sahara in Morocco). Unchanged.
- "Svelte 5 runes, TypeScript strict; build scripts follow `scripts/build-textures.py` and `scripts/build-political.ts`."
- Git: the identity is preconfigured (Yurii Serhiichuk <yurii@serhiichuk.dev>); do not change it. No attribution trailers in commit messages. **Never push. Never merge to `main`.** Work on branch `feat/city-close-ups`.
- E2E runs against a fresh build: always `npm run build` immediately before `npx playwright test …` (the tests open `dist/geo-coordinates.html` via `file://`).
- Project conventions kept: `localStorage` only through `src/app/storage.ts`, keys prefixed `geo-coords:`; neutral examples (Kyiv may appear with other cities, never as the single highlighted answer); no class, school or pupil details in texts; `?test` exposes `window.__mapState` and `window.__mapTextures`.
- If a command under `/srv/work` fails with EPERM / EAFNOSUPPORT / ERR_INTERNET_DISCONNECTED / a sandbox-looking error, load the `agent-session-failures` skill before improvising.

## Be honest about what each box can show

**Six boxes are sharp and six are not.** Every number below was measured during planning against the real services, not assumed.

| Boxes | Source | Ground resolution of the committed photo | What a pupil can see |
|---|---|---|---|
| Katowice (the school) | GUGiK ORTOFOTOMAPA (PL) | 1440 × 960 → **4.17 m/px** | Individual buildings with their shapes and roof colours, yards, car parks, the school's own block, tracks in the station, allotment gardens, tennis courts |
| Warsaw, Kraków | GUGiK ORTOFOTOMAPA (PL) | 1200 × 800 → **5.0 m/px** | The same, a little softer |
| Paris | IGN BD ORTHO (FR) | 1200 × 800 → **5.0 m/px** | The same |
| Tokyo | GSI seamlessphoto (JP) | 1200 × 800 → **5.0 m/px** | The same |
| Manhattan | USGS / USDA NAIP (US) | 1200 × 800 → **5.0 m/px** | The same |
| Greenwich, Mitad del Mundo, Rovaniemi, Delhi, Sydney, Giza | Copernicus Sentinel-2 L2A | 600 × 400 → **10 m/px** (the source's own resolution) | Motorway junctions, the railway and its station, a stadium, a park, a lake, the block-by-block texture of a housing estate, wood against built-up. A large single building is a 3–6 pixel blob whose *position* reads but whose shape does not. A house, a roof, a car: **not visible at any zoom** |

The sources' own resolution is far finer than the committed photo (GUGiK is 0.76 m/px on the ground at zoom 17, IGN about 0.2 m, NAIP 0.6–1 m); the committed size is what the **8 MiB budget** allows, and a 6 × 4 km box at 25 cm would be 24 000 × 16 000 pixels. Task 1 fetches at roughly twice the output resolution and downsamples with Lanczos, so the committed photo is genuinely resolved rather than a blurred upscale. It never upsamples past a source's own resolution: the Sentinel-2 boxes stay at exactly 600 × 400, which is 10 m/px, because anything larger is empty bytes.

So the spec's "sharp enough to point at a building" is delivered like this, and copy must say no more:
- In the six sharp boxes the photo itself shows buildings.
- In the six 10 m boxes the **street layer** is what makes a building findable — the pupil finds the corner of the two named streets, and the photo under it tells them whether that corner is a park, a yard or a rooftop.
- Never promise rooftops anywhere. If a task finds a box unusable, it must say so in its report rather than upscaling to hide it.

The box also fills the view only at a very deep zoom. Measured per box (Task 4's table): the fill zoom runs from 2 659 (Rovaniemi, where 6 km is 0.135° of longitude) to 5 009 (every box whose 4 km height binds first). The lesson's ceiling today is 80, where the box is 18 of 960 view units — 2 % of the width. That is why Task 4 raises the ceiling before anything else.

## Photo sources, verified 2026-09-19

Each was called from this machine during planning; the exact request shape is in Task 1. Five sources, each with its own licence and its own credit line, recorded per box in the manifest.

| Key | Service | Verified call | Licence / credit |
|---|---|---|---|
| `gugik` | GUGiK ORTOFOTOMAPA, Poland | WMTS `GetTile`, `LAYER=ORTOFOTOMAPA`, `TILEMATRIXSET=EPSG:3857`, `TILEMATRIX=EPSG:3857:{z}`, `FORMAT=image/jpeg` — 672 tiles fetched at z 17 (0.76 m/px on the ground), 4.9 MiB | Capabilities say `AccessConstraints: brak ograniczeń`; `Fees` points at the Geoportal regulations, which require naming the source. Credit: "Ortofotomapa: Główny Urząd Geodezji i Kartografii, geoportal.gov.pl" |
| `ign` | IGN BD ORTHO, France, via `data.geopf.fr` | WMTS `GetTile`, `LAYER=ORTHOIMAGERY.ORTHOPHOTOS`, `STYLE=normal`, `TILEMATRIXSET=PM`, `TILEMATRIX={z}` — 200, 9 930 B JPEG at z 18 | Licence Ouverte / Open Licence (Etalab 2.0). Credit: "Orthophotos: © IGN / Géoplateforme (data.geopf.fr), Licence Ouverte Etalab 2.0" |
| `gsi` | GSI seamlessphoto, Japan | XYZ `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` — 200, 19 609 B, 256 × 256 | GSI tile terms: free with attribution; processed tiles must say so. Credit: "空中写真: 国土地理院シームレス空中写真（加工）／ Aerial photo: Geospatial Information Authority of Japan, seamlessphoto tiles (processed)" |
| `naip` | USGS / USDA NAIP, United States | ArcGIS `exportImage?bbox=<W,S,E,N>&bboxSR=4326&size=1200,800&imageSR=4326&format=png&f=image` — 200, a 1 200 × 800 PNG already in the box's own frame | Public domain (US federal). Credit: "Aerial photo: USDA-FSA National Agriculture Imagery Program (NAIP), via USGS (public domain)" |
| `sentinel` | Copernicus Sentinel-2 L2A via Earth Search STAC on AWS | `POST https://earth-search.aws.element84.com/v1/search` for the lowest `eo:cloud_cover`, then HTTP range reads of the scene's `assets.visual` COG (TCI, 10 m, 3 × uint8, 1024 × 1024 Deflate tiles, predictor 2) | Free, no account. Credit, verbatim and in English everywhere: "Contains modified Copernicus Sentinel data 2025–2026" |

Finland's NLS open WMTS returned **401** (it needs a free API key), so **Rovaniemi uses Sentinel-2**. If a source is unusable at build time the fallback for that box is Sentinel-2 — **never a silent upscale**, and the manifest records which source was actually used.

## File map

```
scripts/
  city-boxes.ts                 T1  the twelve centres, their photo source, box maths; writes boxes.json
  cog.py                        T1  pure-Python COG reader (range requests + zlib) and UTM forward
  tiles.py                      T1  Web Mercator tile mosaics (WMTS / XYZ) and lon-lat resampling
  build-city-photos.py          T1  five sources -> equirectangular WebP + photo manifest
  build-city-streets.ts         T2  Overpass -> simplify -> quantize -> one TopoJSON per box
  city-plugin.ts                T3  Vite plugin: photo (base64) and street (JSON) data blocks
  size-report.ts                T3  (modified) one line per city photo and per city street file
  size-check.ts                 T3  (modified) 8 MiB, the five new licence notices
  licence-notices.ts            T3  (modified) Copernicus, OpenStreetMap, GUGiK, IGN, GSI, NAIP notices
  translation-review-lib.ts     T7  (modified) allow-lists for closeup.* keys
  readme-shots.ts               T9  (modified) a close-up screenshot
src/map/data/city/
  boxes.json                    T1  the twelve boxes (single source of truth for both builds and the page)
  photos/<id>.webp              T1  twelve photos, 1440x960 / 1200x800 / 600x400 by source
  photos/manifest.json          T1  per photo: source key, licence, ground resolution, date, bounds, bytes
  streets/<id>.json             T2  twelve street topologies
  streets/manifest.json         T2  per box: counts, bytes, Overpass query date
src/map/
  cityBoxes.ts                  T1  CityBox type, CITY_BOXES, box maths, membership, thresholds
  closeUps.svelte.ts            T7  the "Places up close" switch (own storage key)
  streets.ts                    T6  street level of detail, classes, names
  layers/Streets.svelte         T6  the street SVG layer
  CloseUpList.svelte            T7  the "Places up close" disclosure
  CloseUpNote.svelte            T7  the three teaching notes and the per-box credit line
  texture/cityAssets.ts         T5  lazy decode of one city photo, release of the others
  texture/inverse.ts            T4  boxMix (regionMix keeps its signature)
  texture/shaders.ts            T5  uCity, uCityBox, uCityMix
  texture/cpuShade.ts           T5  the same third level on the CPU
  texture/webgl.ts              T5  setCityTexture
  texture/canvas2d.ts           T5  setCityTexture
  texture/renderer.ts           T5  DrawInputs.city, TextureRenderer.setCityTexture
  texture/TextureLayer.svelte   T5  choose the box in view, load and release its photo
  geometry.ts                   T4  parallelStep, parallelLine(lat, step)
  mapState.svelte.ts            T4  FLAT_MAX_ZOOM 6000, SCHOOL_MAX_ZOOM 80 · T7 closeUps scene flag, showCityBox
  types.ts                      T7  SceneSpec.closeUps
  styleLabels.ts                T6  placeStreetLabels
  layers/Layers.svelte          T6  the Streets layer in the stack
  layers/Places.svelte          T6  draws the street names last
  layers/SpecialLines.svelte    T4  parallel lines with the zoom-aware step
  layers/PointMarker.svelte     T4  the point's latitude guide with the same step
  layers/Overlays.svelte        T4  highlight-line parallels with the same step
  MapStage.svelte               T7  the close-up list, the note, the credit line
src/app/
  SettingsDialog.svelte         T7  the "Places up close" switch
  Footer.svelte                 T7  the photo and street credits
  credits.ts                    T7  CLOSE_UP_SOURCES
  Explore.svelte                T7  a step's extra close-up sentence
src/topics/
  types.ts                      T7  ExploreStep.closeUpNote
  t9-phone.ts                   T7  the find step gains the sentence and closeUps
  t4-finding.ts, t10-seasons.ts T7  free-play steps gain closeUps
tests/unit/   city-boxes, city-photos-data, city-streets-data, city-plugin, size-report (modified),
              parallel-step, box-mix, cpu-shade (modified), streets, street-labels, close-ups,
              mapState-close-ups, gridStep (modified), mapState (modified), schools (modified) (.test.ts)
tests/e2e/    city-data-embedded, city-photo, city-streets, close-ups-switch, close-up-places, city-a11y (.spec.ts);
              deep-zoom.spec.ts (modified, ruling R2); map-style-readability.spec.ts (extended, T8);
              helpers.ts gains setFlatView and the cityBytes hook (T5)
```

## Shared contracts

Created by the task named; later tasks use these exact names. Each task repeats what it needs, so an implementer never has to open another task.

```ts
// scripts/city-boxes.ts (T1) — build-time only, never imported by the page
export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';
export interface CityBoxSpec {
  id: string; lat: number; lon: number; note: boolean;
  source: PhotoSourceKey; photoWidth: number; photoHeight: number; quality: number;
}
export const CITY_BOX_WIDTH_M = 6000;
export const CITY_BOX_HEIGHT_M = 4000;
export const CITY_BOX_SPECS: readonly CityBoxSpec[];          // the twelve, in the spec §3 order
export interface BoxBounds { west: number; south: number; east: number; north: number }
export function boxAround(lat: number, lon: number, widthM: number, heightM: number): BoxBounds;
export interface BoxesFile { widthM: number; heightM: number; boxes: (CityBoxSpec & BoxBounds)[] }
export function boxesFile(): BoxesFile;                        // what src/map/data/city/boxes.json holds

// src/map/cityBoxes.ts (T1)
export type CityBoxId = 'katowice' | 'greenwich' | 'mitaddelmundo' | 'rovaniemi' | 'warsaw' | 'krakow'
  | 'paris' | 'manhattan' | 'delhi' | 'sydney' | 'tokyo' | 'giza';
export interface CityBox { id: CityBoxId; lat: number; lon: number; bounds: GeoBounds; fitZoom: number; note: boolean }
export const CITY_BOXES: readonly CityBox[];
export const CITY_BOX_IDS: readonly CityBoxId[];
export const CITY_STREET_ZOOM = 24;    // streets fade in from here (spec §5)
export const CITY_PHOTO_ZOOM = 40;     // the photo starts to fade in (spec §5)
export const CITY_PHOTO_FULL_ZOOM = 80;
export function fitZoom(b: GeoBounds): number;                     // zoom at which the box fills a 960 x 480 view
export function cityBoxById(id: string): CityBox | null;
export function cityBoxAt(p: LatLon, zoom: number): CityBox | null;        // the box the view centre is in
export function visibleCityBox(view: GeoBounds, zoom: number): CityBox | null; // the box to draw

// src/map/texture/inverse.ts (T4)
export function boxMix(v: TextureView, box: GeoBounds, fadeFrom: number, fullAt: number): number;
export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number;  // unchanged signature

// src/map/geometry.ts (T4)
export function parallelStep(zoom: number): number;                 // 1 at or below zoom 80, sqrt(80/zoom) above
export function parallelLine(lat: number, step?: number): GeoJSON.LineString;   // unchanged signature

// src/map/mapState.svelte.ts (T4, T7)
export const FLAT_MAX_ZOOM = 6000;      // T4 (was 80)
export const SCHOOL_MAX_ZOOM = 80;      // T4: the cap the Maple Bear school list and badges still use
closeUpsScene: boolean;                 // T4 (named `closeUps` there, renamed in T7): the SceneSpec flag
get closeUps(): boolean;                // T7: the scene flag AND the pupil's switch — the one thing everything reads
showCityBox(id: string): CityBox | null; // T7

// src/map/texture/renderer.ts (T5)
export interface CityDraw { bounds: GeoBounds; mix: number }
export interface DrawInputs { /* …unchanged fields… */ city: CityDraw | null }
export interface TextureRenderer { /* …unchanged… */ setCityTexture(bmp: ImageBitmap | null): void }

// src/map/texture/cityAssets.ts (T5)
export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';
export interface CityPhoto {
  id: CityBoxId; width: number; height: number; bounds: GeoBounds;
  source: PhotoSourceKey; captured: string; groundM: number; bytes: number; mime: 'image/webp';
}
export const CITY_PHOTOS: Readonly<Record<CityBoxId, CityPhoto>>;
export function loadCityPhoto(id: CityBoxId): Promise<ImageBitmap>;
export function releaseCityPhotosExcept(keep: CityBoxId | null): number;   // bytes of RGBA freed
export function cachedCityPhotoBytes(): number;

// src/map/streets.ts (T6)
export type StreetClass = 0 | 1 | 2 | 3 | 4 | 5;   // motorway/trunk, primary, secondary, tertiary, residential, pedestrian
export const STREET_CLASS_MIN_ZOOM: readonly number[];  // by class; index with StreetClass
export const STREET_NAME_ZOOM = 900;
export const PLACE_NAME_ZOOM = 200;
export function streetFade(zoom: number): number;       // 0 at CITY_STREET_ZOOM, 1 one octave above
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
export function loadStreets(id: CityBoxId): void;    // parses the page's data block; throws if it is missing

// src/map/styleLabels.ts (T6)
export const STREET_FONT = 10;
export function placeStreetLabels(ctx: ViewCtx, box: CityBox, obstacles: readonly LabelBox[]): StyleLabel[];

// src/map/closeUps.svelte.ts (T7)
export const CLOSE_UPS_KEY = 'geo-coords:close-ups';
export const closeUpSetting: { on: boolean };      // $state rune, default on
export function initCloseUps(): void;
export function setCloseUps(on: boolean): void;    // writes storage
export function parseCloseUps(v: unknown): boolean; // anything but the exact string 'off' is on

// src/app/credits.ts (T7)
export interface CloseUpSource { key: PhotoSourceKey; name: string; url: string; boxes: CityBoxId[] }
export const CLOSE_UP_SOURCES: readonly CloseUpSource[];
export const OSM = { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' };
```

## Execution notes for the controller

- Strictly sequential, numeric order (1 → 9). Several tasks edit `src/i18n/*.json`, `MapState`, `Layers.svelte`, `MapStage.svelte` and the texture modules.
- Before every commit: `npm run check && npm test` pass. Tasks that change what the page renders also run `npm run build` and the named e2e specs. Tasks 5, 6, 7 and 8 run `npm run build && npx playwright test tests/e2e/atlas-baseline.spec.ts` as well; Tasks 6 and 8 run the full `npm run e2e`.
- Network is available for the **data builds only** (Tasks 1 and 2) and their raw responses are cached under the git-ignored `.cache/`. Everything after Task 2 must build and test with no network at all; `npm run build` never runs a data script.
- Endpoints verified reachable from this machine on 2026-09-19 are listed in "Photo sources" above and in Task 2 for Overpass. Overpass answers **406** to a bare request: it needs a real `User-Agent` **and** a POSTed query, and Task 2 must confirm the exact call before anything depends on it.
- Visual tasks (1, 5, 6, 7, 8) look at screenshots or the built photos before reporting: `npm run build && npm run shot -- <hash> <name>` writes `shots/<name>-375x667.png` and `shots/<name>-1366x768.png` (`shots/` is git-ignored). `scripts/shot.ts` takes a hash like `en/lab`.
- Playwright Chromium runs headless with SwiftShader WebGL 2 (`MAX_TEXTURE_SIZE` 8192, `highp` 23 bits). Pixel probes use tolerances; never exact colours.
- Each implementer reports: files changed, test commands and their results, byte sizes (Tasks 1, 2, 3, 9), screenshots looked at, and anything that deviated from the task text with the reason.

## Planning rulings

Each: **what** — why — cost if wrong.

- **R1 The zoom ceiling goes from 80 to 6000, and the globe's stays at 60.** A 6 × 4 km box fills a 960 × 480 view at zoom 2 659 (Rovaniemi) to 5 009 (any box bound by its 4 km height); at today's ceiling of 80 the box is 18 of 960 view units. The spec's "setting the zoom so the box fills the view" is impossible without this, so `FLAT_MAX_ZOOM = 6000` (about 20 % past the deepest fill). City close-ups are therefore a **flat-map** feature: the globe keeps `GLOBE_MAX_ZOOM = 60`, choosing a close-up place centres the globe as `chooseSchool` does and switches a phone to the flat view. — An orthographic projection over 0.08° is meaningless, and raising the globe's ceiling would need a separate precision review. — A pupil who stays on the globe never sees a close-up; fixing that later means raising the globe ceiling and re-checking `makeGlobeCtx` at sub-degree radii.
- **R2 Raising the ceiling changes three existing assertions, and nothing else.** `tests/unit/mapState.test.ts` (`expect(FLAT_MAX_ZOOM).toBe(80)` → `6000`, plus a new `expect(SCHOOL_MAX_ZOOM).toBe(80)`), `tests/unit/schools.test.ts` (the `FLAT_MAX_ZOOM` argument passed to `clusterClick` / `isolatingFlatZoom` becomes `SCHOOL_MAX_ZOOM`, keeping the behaviour identical), and `tests/e2e/deep-zoom.spec.ts` (the "zoom stops at 80 and the globe at 60" test). A new `SCHOOL_MAX_ZOOM = 80` keeps every school interaction exactly where it is. — Those assertions encode "80 is as close as the map goes", which the feature changes on purpose. — None; without `SCHOOL_MAX_ZOOM` a school badge click would jump to zoom 500 and `schools.spec.ts` would fail.
- **R3 No Atlas baseline contains a drawn box, so all seven stand and are never regenerated.** Only `lab-katowice-zoom12` has a box in view at all (the Katowice box's centre *is* that scene's centre). It is drawn at zoom 12, below `CITY_STREET_ZOOM` (24) and far below `CITY_PHOTO_ZOOM` (40), so no close-up pixel is drawn there; `parallelStep(12)` returns exactly 1, so the special lines and the point's guides are byte-identical; and the zoom ceiling does not enter a zoom-12 view. Tasks 4, 5, 6, 7 and 8 each re-run `atlas-baseline.spec.ts` to prove it. — The thresholds are one octave above the baseline's zoom. — If a baseline ever fails, the change is wrong: lower nothing, fix the cause.
- **R4 Photo source is chosen per box, and the committed size is chosen per source.** The spec's §4 names one source, "Copernicus Sentinel-2 L2A, 10 m per pixel", for all twelve. That cannot deliver its own §1 goal — "sharp enough to point at a building" — because at 10 m a building is a 3–6 pixel blob. Four national services publish open sub-metre aerial photography over six of the twelve boxes (table above), including the school's, so those six use it and six stay on Sentinel-2. Committed sizes: Katowice 1440 × 960 (4.17 m/px, the box the whole feature exists for), the other five sharp boxes 1200 × 800 (5.0 m/px), the six Sentinel boxes 600 × 400 (10 m/px, the source's own resolution). WebP quality 65 for the orthophoto boxes, 80 for the Sentinel ones. — Measured on the real Katowice orthophoto: 1440 × 960 q65 = 305 696 B, 1200 × 800 q65 = 220 938 B, 2048 × 1365 q72 = 682 300 B. 2048 everywhere would be 4.1 MB of photos before base64 and would burst the 8 MiB limit; 1024 saves only 55 KB a box and visibly softens buildings. The Sentinel boxes are never enlarged: 600 × 400 *is* 10 m. — Six sources instead of one means six attributions to keep right in four places; if a national service is unusable at build time, that box falls back to Sentinel-2, and if Task 3's total runs over, drop the five non-school sharp boxes to 1024 × 683 q65 (≈ 166 KB each, −275 KB total) before touching anything else.
- **R5 Photo resolution is capped by the screen, not by the source.** At the fill zoom a box spans 960 view units, and `webgl.ts` caps the drawing buffer at `devicePixelRatio` 2, so at most about 1 920 device pixels are ever resolved across the box. 1440 px is well matched to a 1× desktop and slightly soft on a 2× phone; 1200 px is one step softer again. — The trade is bytes against sharpness at a zoom most sessions reach for one or two boxes. — Task 8's design pass looks at the school box on a 375 px phone at 2× and says whether 1440 was enough.
- **R6 No building outlines in the street data.** Measured on the real data: the buildings of a 0.016° × 0.024° patch of central Katowice are 3 351 ways / 35 133 vertices / 293 415 B once quantized to 1.1 m and delta-encoded; scaled to the whole 6 × 4 km box that is ≈ 2.3 MB, and ≈ 12–25 MB for the twelve — three times the whole file budget. The street layer therefore carries roads, railways, waterways, water bodies and green areas; buildings come from the photo, which in six boxes shows them properly. — The spec's §4 list and its §7 8 MiB limit cannot both hold; the limit is the one the owner set a number on. — A pupil cannot trace one building's outline as a vector; adding buildings later would need a much smaller inner box.
- **R7 Street data is TopoJSON, like every other vector layer here.** Quantized at 1e-5° (≈ 1.1 m) and Visvalingam-simplified to about 3 m, built with `topojson-server` / `topojson-simplify` / `topojson-client` exactly as `scripts/build-physical-water.ts` does, and read at runtime through `world.ts`'s `decodeArcs` / `levelOfDetail` / `lineParts` / `visibleParts`. Measured: Katowice's roads to residential class are 113 KB in that form (8 469 vertices over 3 069 ways). — Reusing the existing machinery buys level of detail, arc thinning and view culling for free and makes the build script a sibling of one already reviewed. — The alternative measured on the same data — a delta-varint string in a 64-character alphabet — is 62.7 KB, 45 % smaller. If Task 3's budget is tight, that is the second lever after R4, and it changes only the build script and one decoder.
- **R8 Photos and street data live in data blocks, not in the JS bundle.** `scripts/city-plugin.ts` writes each box's topology into `<script type="application/x-geo-city" id="geo-city-<id>">` before `</body>` (raw JSON text, not base64 — TopoJSON can never contain `</script>`) and each photo into `<script type="application/x-geo-photo" id="geo-photo-<id>">` as base64, matching `scripts/textures-plugin.ts`. `streets.ts` calls `JSON.parse` on a block the first time a box is entered. — An `import streets from './data/city/streets.json'` would make Vite inline ≈ 1.7 MB of object literal that every page parses at startup, on the 2 GB Chromebooks this lesson runs on, for a feature most sessions never open. — If a browser mishandled the blocks, the plugin can emit a virtual module instead; nothing else changes.
- **R9 The "Places up close" switch gets its own storage key, `geo-coords:close-ups`.** Not a field of `geo-coords:settings`. — `tests/unit/storage.test.ts` asserts the settings object exactly (`{ theme, largeText, reducedMotion }`) in three places, and the map-style preference already set this precedent (map-styles ruling R1). The Settings dialog still shows the switch, which is what the spec asks for. — Moving it into the settings record later is ~15 lines plus a one-time migration.
- **R10 Close-ups are scene-gated by `SceneSpec.closeUps`, default false.** Set true on the lab scene (`LabPage.svelte`), on topic 9's `find` and `play` steps and on the free-play steps of topics 4 and 10. Questions, rehearsal, the class quiz and worksheets never set it, so neither the photo, the street layer nor the list can appear there. — Spec §2 "Where it appears: Free play, the lab, and topic 9's … step. Not in questions, rehearsal or worksheets." A zoom check alone would be an accident waiting to happen. — A scene the owner later wants close-ups in is a one-word data change.
- **R11 Parallels gain a zoom-aware vertex step; meridians do not.** `parallelLine`'s 1° vertices make d3 draw each segment as a great circle, which at 50°N bows 0.229 view units away from the parallel at zoom 80 — and 17.2 units at zoom 6000, which would put the equator at Mitad del Mundo, the Arctic Circle at Rovaniemi and the point's own latitude guide visibly off the feature they name. `parallelStep(zoom) = min(1, sqrt(80 / zoom))` holds the bow at 0.229 units at every zoom and returns **exactly 1** at or below zoom 80, so nothing Atlas draws today moves. Meridians are great circles already and keep their step. — Measured with d3 for zooms 80 / 1000 / 4270 / 6000. — None; the only cost is a few thousand extra vertices in a clipped path at city zoom.
- **R12 The grid ladder stays as it is: minutes are the finest step.** At the Katowice fill zoom (4 270) a 1′ grid is 189 CSS px apart on a 960 px map — five gaps across the view, right at the top of the band — and `chooseGridStep` already picks it. No second or 30″ rungs are added. — Spec §1: "the coordinate readout, point marker, grid and edge labels behave exactly as they do now, so … answerable to the minute." Seconds would mean new formatting in the readout, the sliders, the spoken forms and the edge labels — a different feature. — At zoom 6000 the grid shows only 3–4 gaps; if the design pass finds that too sparse, a 30″ rung plus `gridUsesMinutes` handling is the follow-up.
- **R13 One city photo is decoded at a time.** `cityAssets.ts` keeps a single `ImageBitmap` (at most 1440 × 960 → 5.5 MB of RGBA) and `releaseCityPhotosExcept` closes the rest, exactly as `assets.ts`'s `releaseTexturesExcept` does for the world images; `TextureLayer` releases everything when the view leaves every box or the style stops being a texture style. — The twelve decoded at once would be about 30 MB of RGBA held for the page's life for no benefit; one is always enough because two boxes can never be in view together (the nearest pair, Warsaw and Kraków, are 250 km apart). — None.
- **R14 The city photo appears in Physical and Satellite only; the street layer appears in all four styles.** Straight from spec §5. In Atlas and Political the streets are drawn on the lesson's own background, which is a deliberate, owner-approved Atlas change inside the boxes. — Spec. — None.
- **R15 The city photo is equirectangular in the box's own lon/lat frame, north up** — the same convention as `physical-region.webp`, so the shader's existing `ruv` arithmetic works unchanged with a different box and a different sampler. Each pixel is square *in metres*, because the box is defined in metres and converted to degrees at its own latitude; all twelve are 3:2, matching the 6 × 4 km box. — One sampling path for all three levels. — None.
- **R16 Street relations are skipped; ways only.** The Overpass query asks for `way` (and `node` for place names), and a park or lake mapped only as a multipolygon relation will be missing. — Relation assembly is a substantial amount of build code for a handful of shapes the photo already shows in colour. — A few missing green or blue patches in some boxes; the design pass (Task 8) lists any box where it is noticeable, and adding `rel` handling later is a build-script change only.
- **R17 Sentinel scene choice favours cloud-free over season; the orthophoto services give whatever flight they hold.** For Sentinel boxes the build asks the STAC API for the lowest `eo:cloud_cover` in a two-year window, so a box may come out leafless or snowy (the verified Katowice test pick was 2026-03-14, cloud cover 0.0006 %, bare trees). Each box's source, date and cloud cover go into the manifest and are reported. — Spec §10 already accepts "a box may end up in a different season"; a cloudy tile is useless, a wintry one is not. — Task 8 may re-run one box with a seasonal window and a slightly higher cloud threshold; that is a manifest change only.
- **R18 The twelve names are their own key set, `closeup.place.<id>`, and the boxes are not added to `PLACES`.** `src/map/places.ts` is untouched, so no new dot or name appears on any map at any zoom and the Atlas baselines cannot move. The names of the boxes that share an id with a place (`warsaw`, `krakow`, `paris`, `delhi`, `sydney`, `tokyo`, `katowice`) are still written out in full under the new keys, because several of them say more than the plain city name ("Katowice — the school", "Paris — Eiffel Tower"). `scripts/translation-review-lib.ts` gains `/^closeup\.place\./` and `/^closeup\.credit\./` to its `SAME_OK` and `PLACE_NAME_KEY` lists. — Names identical across languages ("Giza", "Sydney") are names, not untranslated strings, which is exactly what those allow-lists are for. — None.
- **R19 Street names are placed by `styleLabels.ts` and drawn by `Places.svelte`, last in the queue.** `Streets.svelte` draws only lines and areas. — `Places.svelte` already holds every obstacle box the lesson's own labels occupy (places, schools, the point, line names, overlays, edge numbers); placing street names anywhere else would need those boxes passed around, and the spec's "never displace the lesson's own labels" would be a hope rather than a guarantee. — None; it is one more call beside `placeCountryLabels` and `placePhysicalLabels`.
- **R20 Each photo source keeps its own attribution, and the prescribed formulas stay in their own language.** `closeup.credit.<source>` holds one line per source, identical in `en.json`, `pl.json` and `uk.json` (allow-listed per R18), and only the framing around it is translated: "Contains modified Copernicus Sentinel data 2025–2026", "© OpenStreetMap contributors (ODbL)", "Ortofotomapa: Główny Urząd Geodezji i Kartografii, geoportal.gov.pl", "Orthophotos: © IGN / Géoplateforme (data.geopf.fr), Licence Ouverte Etalab 2.0", "空中写真: 国土地理院シームレス空中写真（加工）/ Geospatial Information Authority of Japan, seamlessphoto (processed)", "USDA-FSA National Agriculture Imagery Program (NAIP), via USGS (public domain)". All six appear in the footer, the README, `LICENSE-CONTENT.md` and the built file's licence comment; the map only shows the credit for the box on screen. — These are prescribed attribution formulas; a translated copyright line is not the attribution a licence asks for. — If GUGiK's regulations turn out to demand different wording, Task 1 reports it and Tasks 3 and 7 use that wording instead.
- **R21 Overpass is called once per box, cached, and never at build time.** Raw responses are written to `.cache/overpass/<id>.json` and the script reuses a cached file unless `--refresh` is given; a polite 5 s delay separates calls, and the identifying `User-Agent` is `geo-coordinates-lesson/1.0 (school lesson build; yurii@serhiichuk.dev)`. The committed `src/map/data/city/streets/*.json` is what the page uses; `npm run build` never touches Overpass. — Spec §10's rate-limit risk; verified working, and one 504 was already seen during planning on a large query. — A 504 means re-running that one box.
- **R22 Budget arithmetic the plan is built on.** Today 3,387,703 B. Photos: 305 696 (Katowice) + 5 × ≈ 221 000 (the other orthophoto boxes) + 6 × ≈ 60 000 (Sentinel) ≈ 1.77 MB, × 4/3 as base64 ≈ **2.36 MB**. Streets: ≈ 145 KB per box (Katowice's roads measured at 113 KB; rail, water, green and names add the rest) × 12 ≈ **1.75 MB**, as raw JSON. Total ≈ **7.50 MB** of 8,388,608 B, leaving ≈ 0.89 MB (10.6 %). Per-place ceilings enforced by tests: photo 340 KB (Katowice), 260 KB (the other orthophoto boxes), 90 KB (Sentinel boxes); street file 200 KB; all photos together 1.9 MB; all street files together 1.9 MB. — Every number is measured on the real services except the street extras. — Levers in order if a box overruns: R4 (drop the five to 1024 × 683), raise that box's simplification tolerance, drop street class 5, then R7's varint encoding.
- **R23 At night, a city box shows a dimmed close-up, not the world's night image.** Black Marble is 4096 px for the whole world — about 10 km a pixel — so inside a 6 km box it is one flat smear. In Satellite with the day/night side on, the night colour inside the box fades, by the same weight the photo is blended with, towards `photo × 0.35` plus a faint blue, so a box at night reads as a dark version of itself with its streets still on top. The shader and `cpuShade.ts` carry the same three lines. — The alternative is a pupil zooming to their school at local midnight and finding a coloured blur. — Visual only; a box at night looks dimmed rather than lit by its own street lights.
- **R24 Street names are OSM's local `name`, with `name:en` kept and used where the local name is in a script the reader cannot read.** The build stores `n` (always) and `e` (`name:en`, only when it is present and different); `readableName(local, english, lang)` returns the local name when it is written in a script the page language uses (Latin for `en` and `pl`, Latin or Cyrillic for `uk`) and the English name otherwise. — Spec §4: "Names are the local ones from OSM (`name`), with `name:en` kept where present." Tokyo's and Delhi's street names are in Japanese and Devanagari, which is not a name an 11-year-old in Katowice can read off the map; everywhere else the local name is the name on the street sign, which is the point. — Costs a few KB in the two boxes that need it; if a box turns out to have no `name:en` at all, its street names simply stay local and the design pass says so.
