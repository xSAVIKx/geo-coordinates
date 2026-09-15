# Map Styles, Earth Physics and Seasons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Physical, Satellite (with night-side city lights) and Political map styles to every map in the lesson, plus a Seasons mode in the day and night lab, an explore-only topic 10 "Why we have seasons" and an advanced real-Sun switch — all inside the one offline file, with Atlas unchanged and any failure falling back to Atlas.

**Architecture:** Raster styles are drawn by a new per-view texture layer (`<canvas>` under the existing SVG): a WebGL 2 full-view quad whose fragment shader inverse-projects each pixel (grid, Equal Earth, Mercator, orthographic) with exactly d3's parameters, read from the same `ViewCtx` the SVG layers use; a CPU canvas renderer runs the same math as a fallback; a pure state machine moves down WebGL → canvas → Atlas on any failure. Textures (WebP, base64) are embedded as data blocks in the HTML and decoded on first use. Political and Physical vectors are new SVG layers with label placement through `labelLayout.ts`. Earth physics adds pure modules (`src/geo/seasons.ts`, `src/geo/orbit.ts`), an SVG orbit view, lab controls and topic 10 as scene data.

**Tech Stack:** Svelte 5.57 (runes), TypeScript 6 strict, Vite 8 + vite-plugin-singlefile, d3-geo 3.1, topojson-client/-server/-simplify 3, WebGL 2 (GLSL ES 3.00), Canvas 2D, `createImageBitmap`, Vitest 5, Playwright 1.63 + axe-core; build-time Python 3 + Pillow (textures only, no numpy).

**Spec:** `docs/superpowers/specs/2026-09-15-map-styles-and-seasons-design.md` (binding). Read it before any task. The earlier lesson spec is `docs/superpowers/specs/2026-09-13-geo-coordinates-design.md`.

The plan is split into files by the spec's §9 order of work. Execute tasks strictly in numeric order.

| File | Spec §9 part | Tasks |
|---|---|---|
| `01-data-builds.md` | 1. Data builds | 1 World and detail textures · 2 Texture embedding and the 5 MiB size check · 3 Political shapes · 4 Physical rivers and lakes |
| `02-texture-layer.md` | 2. Texture layer | 5 Style state, Atlas baseline, fallback state machine · 6 Inverse projections (CPU port) · 7 WebGL texture layer · 8 Canvas fallback, context loss, error → Atlas |
| `03-style-switch.md` | 3. Switch, persistence, class quiz, halos, credits | 9 Style switch and persistence · 10 Class quiz style, worksheets stay Atlas · 11 Readability halos, presenter, credits |
| `04-vector-layers.md` | 4. Political and Physical vectors | 12 Political layer · 13 Physical water and names |
| `05-satellite-night-real-sun.md` | 5. Satellite night, real Sun | 14 Sun model: real Sun in MapState · 15 Satellite day/night with city lights · 16 Real-Sun switch in the lab |
| `06-seasons.md` | 6. Seasons and topic 10 | 17 Seasons and orbit maths · 18 Orbit view and Seasons mode · 19 Topic 10 "Why we have seasons" |
| `07-design-release.md` | 7. Design pass, release prep | 20 Design, UX and accessibility pass · 21 Release prep (no push, no merge) |

## Global Constraints

Every task's requirements implicitly include this section. Items in quotes are copied verbatim from the spec.

- "Single file < 5,242,880 B (`scripts/size-check.ts` limit raised, with a per-asset breakdown on failure). No runtime network requests."
- "No new runtime dependencies beyond what the shader and decoding need (none expected)."
- "Atlas pixel-identical to today; existing tests unchanged." (The only existing-test edits allowed are the three listed in Planning ruling R10.)
- "**Any** error in the new path falls back to the existing Atlas rendering." Failures "are not persisted beyond the page session."
- "WCAG 2.2 AA on every route × style × theme; AAA in presenter mode; 44 px targets; keyboard-only operable." Colour is never the only signal.
- EN/PL/UK parity: `src/i18n/en.json`, `pl.json`, `uk.json` keep identical key sets and parameters (`tests/unit/i18n.test.ts`). JSON edits are serialized: only the task being executed edits these files; never run two tasks in parallel. Polish and Ukrainian are natural, school-level (11–12-year-olds, PL „ty”, UK «ти»); the texts given in this plan are the source.
- Mean Sun: "Changing the lessons' mean-Sun rule (15° = 1 hour stays exact everywhere except the lab's advanced switch)" is a non-goal; "lessons, questions and topic 8 always use the mean Sun."
- Borders: "Natural Earth **Poland point-of-view** (Crimea, Sevastopol, Donbas in Ukraine; Kosovo a country; Western Sahara in Morocco)."
- "Svelte 5 runes, TypeScript strict; follow existing module boundaries (`MapState`, layers, scenes as data)."
- Git: the identity is preconfigured (Yurii Serhiichuk <yurii@serhiichuk.dev>); do not change it. No attribution trailers in commit messages. Never push. Never merge to `main`. Work on branch `feat/map-styles`.
- E2E runs against a fresh build: always `npm run build` immediately before `npx playwright test …` (the tests open `dist/geo-coordinates.html` via `file://`).
- Project conventions kept: `localStorage` only through `src/app/storage.ts`, keys prefixed `geo-coords:`; neutral examples (Kyiv may appear with other cities, never as the single highlighted answer); no class, school or pupil details in texts; `?test` exposes `window.__mapState` (and, from Task 7, `window.__mapTextures`).
- If a command under `/srv/work` fails with EPERM / EAFNOSUPPORT / ERR_INTERNET_DISCONNECTED / a sandbox-looking error, load the `agent-session-failures` skill before improvising.

## File map

```
scripts/
  build-textures.py            T1  Python 3 + Pillow: WebP textures + manifest
  webp-size.ts                 T1  width/height from a WebP header (tests, size report)
  textures-plugin.ts           T2  Vite plugin: base64 texture data blocks before </body>
  size-report.ts               T2  per-asset byte breakdown of the built file
  size-check.ts                T2  (modified) 5 MiB, breakdown, NASA notice
  licence-notices.ts           T2  (modified) NASA Earth Observatory data notice
  political-colours.ts         T3  DSatur greedy colouring
  build-political.ts           T3  political-pol.json
  build-physical-water.ts      T4  physical-water.json
  translation-review-lib.ts    T9, T11, T13, T18 (modified allow-lists)
src/map/data/
  textures/*.webp, manifest.json   T1
  political-pol.json               T3
  physical-water.json              T4
src/map/
  mapStyle.ts                  T5 (type, parse) · T9 (storage)
  texture/fallback.ts          T5  pure state machine + style resolution
  texture/health.svelte.ts     T5  session render health (runes)
  texture/viewParams.ts        T6  ViewCtx → TextureView (d3 parameters)
  texture/inverse.ts           T6  CPU port of the shader's inverse projections
  texture/renderer.ts          T7  shared types, RenderFailure, sunVector
  texture/shaders.ts           T7  GLSL ES 3.00 sources
  texture/assets.ts            T7  base64 → ImageBitmap (downscale), cache
  texture/webgl.ts             T7  WebGL 2 renderer
  texture/testHooks.ts         T7  window.__mapTextures (test mode)
  texture/TextureLayer.svelte  T7 (WebGL) · T8 (canvas, loss, print) · T15 (night)
  texture/cpuShade.ts          T8  per-pixel shading shared by the canvas path (T15 night)
  texture/canvas2d.ts          T8  Canvas 2D renderer
  MapStyleNote.svelte          T8  "showing Atlas" note
  MapStyleSwitch.svelte        T9  toolbar group / compact menu
  styleFade.ts                 T9  fade-in action when the drawn style changes
  political.ts                 T12 political LOD, labels, capitals, names
  layers/Political.svelte      T12
  styleLabels.ts               T12 (countries) · T13 (physical names)
  physical.ts                  T13 water LOD, physical names
  layers/PhysicalWater.svelte  T13
  OrbitView.svelte             T18
  SeasonsReadout.svelte        T18
src/geo/
  sun.ts (modified)            T14 solarParams, sunPoint
  time.ts (modified)           T14 apparentSolarMinutes
  seasons.ts                   T17 day length, sunrise/sunset, polar limits
  orbit.ts                     T17 orbit angle, camera, lit outline, drag inverse
src/topics/t10-seasons.ts      T19
tests/unit/  textures-data, textures-plugin, size-report, political-colours, political-data, physical-water-data,
             mapStyle, fallback, mapState-style, texture-inverse, texture-assets, cpu-shade, paper-style, political,
             physical, style-labels, sun-real, seasons, orbit, mapState-orbit, topic10 (.test.ts)
             existing tests edited only per ruling R10: router, topics (unit), explore (e2e)
tests/e2e/   atlas-baseline, textures-embedded, texture-webgl, texture-fallback, map-style-switch, class-quiz-style,
             map-style-readability, political, physical, satellite-night, real-sun, seasons, topic10,
             styles-matrix, perf-smoke (.spec.ts); helpers.ts gains style helpers (T7)
```

## Shared contracts

Created by the task named; later tasks use these exact names. Each task repeats what it needs.

```ts
// src/map/mapStyle.ts (T5; storage added in T9)
export type MapStyle = 'atlas' | 'physical' | 'satellite' | 'political';
export type TextureStyle = 'physical' | 'satellite';
export const MAP_STYLES: readonly MapStyle[];                 // ['atlas', 'physical', 'satellite', 'political']
export const DEFAULT_MAP_STYLE: MapStyle;                     // 'atlas'
export function isMapStyle(v: unknown): v is MapStyle;
export function isTextureStyle(s: MapStyle): s is TextureStyle;
export function parseMapStyle(v: unknown): MapStyle;
export const MAP_STYLE_KEY = 'geo-coords:map-style';          // T9
export function readMapStyle(): MapStyle;                     // T9
export function writeMapStyle(s: MapStyle): void;             // T9

// src/map/texture/fallback.ts (T5)
export type RenderTier = 'webgl' | 'canvas' | 'atlas';
export type FailReason = 'no-webgl' | 'shader' | 'texture-size' | 'decode' | 'oom' | 'context-lost' | 'render' | 'no-canvas';
export interface RenderHealth { tier: RenderTier; maxTexture: 4096 | 2048; waitingForRestore: boolean; vectorFailed: boolean; reasons: FailReason[] }
export type HealthEvent = { type: 'fail'; reason: FailReason } | { type: 'context-lost' } | { type: 'context-restored' } | { type: 'restore-timeout' } | { type: 'vector-fail' };
export const INITIAL_HEALTH: RenderHealth;
export function nextHealth(s: RenderHealth, e: HealthEvent): RenderHealth;
export function effectiveStyle(chosen: MapStyle, h: RenderHealth): MapStyle;
export function drawnStyle(style: MapStyle, ready: Readonly<Record<TextureStyle, boolean>>): MapStyle;
export function styleUnavailable(chosen: MapStyle, h: RenderHealth): boolean;

// src/map/texture/health.svelte.ts (T5)
export const renderHealth: { state: RenderHealth; ready: Record<TextureStyle, boolean>; loading: TextureStyle | null };
export function reportHealth(e: HealthEvent): void;
export function markReady(style: TextureStyle): void;
export function resetHealth(): void;

// MapState additions (src/map/mapState.svelte.ts)
stylePreference: MapStyle; styleOverride: MapStyle | null; styleChoice: MapStyle | null; runStyle: MapStyle | null;   // T5
get chosenMapStyle(): MapStyle; get mapStyle(): MapStyle; get drawnMapStyle(): MapStyle;                              // T5
chooseMapStyle(s: MapStyle): void; setStylePreference(s: MapStyle): void;                                            // T5 (T9 persists)
realSun: boolean; sunPoint(): LatLon | null;                                                                         // T14
// SceneSpec (src/map/types.ts)
mapStyle?: MapStyle;                                                                                                 // T5
// ViewId gains 'orbit' (T18); LabControl gains 'real-sun' (T16) and 'seasons' (T18); TopicId gains 10 (T19)

// src/map/texture/viewParams.ts (T6)
export type ProjectionCode = 0 | 1 | 2 | 3;                  // grid, equal-earth, mercator, globe
export interface TextureView { projection: ProjectionCode; width: number; height: number; scale: number; origin: [number, number]; rotate: [number, number]; maxLat: number; zoom: number; bounds: GeoBounds }
export function textureView(ctx: ViewCtx): TextureView;
// src/map/texture/inverse.ts (T6)
export interface Inverse { lambda: number; phi: number; rho: number }   // radians; rho: globe distance from centre in radii (0 on flat maps)
export function inverseProject(v: TextureView, x: number, y: number): Inverse | null;
export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number;

// src/map/texture/renderer.ts (T7)
export class RenderFailure extends Error { readonly reason: FailReason }
export interface SunVector { x: number; y: number; z: number }
export function sunVector(p: LatLon): SunVector;
export interface StyleTextures { day: ImageBitmap; region: ImageBitmap; night: ImageBitmap | null }
export interface DrawInputs { view: TextureView; regionMix: number; night: SunVector | null; limb: boolean; glow: boolean; quality: 'full' | 'fast'; debug: 0 | 1 | 2 }
export interface TextureRenderer {
  readonly tier: 'webgl' | 'canvas'; readonly maxTextureSize: number;
  resize(cssWidth: number, cssHeight: number, dpr: number): void; setTextures(t: StyleTextures): void;
  draw(input: DrawInputs): void; readPixels(x: number, y: number, w: number, h: number): Uint8Array; // top-down RGBA
  bufferSize(): { width: number; height: number }; loseContext?(restoreAfterMs: number | null): void; dispose(): void;
}
// src/map/texture/assets.ts (T7)
export type TextureId = 'physical-world' | 'physical-region' | 'satellite-day' | 'satellite-region' | 'satellite-night';
export function decodeBase64(b64: string): Uint8Array;
export function loadStyleTextures(style: TextureStyle, maxSize: number, withNight: boolean): Promise<StyleTextures>;

// src/geo/sun.ts (T14)
export interface SolarParams { declination: number; eqTimeMin: number; appLongitude: number }
export function solarParams(date: Date): SolarParams;
export function sunPoint(date: Date, real: boolean): LatLon;
// src/geo/time.ts (T14)
export function apparentSolarMinutes(utcMinutes: number, lon: number, eqTimeMin: number): number;

// src/geo/seasons.ts (T17)
export interface DayInfo { declination: number; eqTimeMin: number; dayMinutes: number; polar: 'day' | 'night' | null; sunrise: number | null; sunset: number | null }
export function dayInfo(lat: number, date: Date, realSun: boolean): DayInfo;
export interface PolarLimit { lat: number; hemisphere: 'N' | 'S' }
export function polarLimits(declination: number): { day: PolarLimit; night: PolarLimit } | null;
export function splitMinutes(minutes: number): { h: number; m: number };
// src/geo/orbit.ts (T17)
export type Vec3 = [number, number, number]; export type SeasonEvent = 'march' | 'june' | 'september' | 'december';
export const AXIAL_TILT = 23.44; export const VIEW_ELEVATION = 22;
export function orbitAngle(date: Date): number; export function toCamera(v: Vec3, elevationDeg?: number): Vec3;
export function earthOnOrbit(angleDeg: number, radius: number): Vec3; export function sunSeenFromEarth(angleDeg: number): Vec3;
export const AXIS: Vec3; export function litOutline(sun: Vec3, steps?: number): [number, number][];
export function angleFromScreen(right: number, up: number): number; export function dayForAngle(angleDeg: number, year: number): number;
export function eventDay(year: number, e: SeasonEvent): number; export function eventOnDay(year: number, day: number): SeasonEvent | null;
```

## Execution notes for the controller

- Strictly sequential, numeric order (1 → 21). Many tasks edit `src/i18n/*.json`, `MapState`, `Layers.svelte`, `FlatMap.svelte` and `Globe.svelte`.
- Before every commit: `npm run check && npm test` pass. Tasks that change what the page renders also run `npm run build` and the named e2e specs; Tasks 8, 11, 13, 16, 19 and 20 run the full `npm run e2e` (after `npm run build`).
- `dist/` is committed only in Task 21. `npm run build` rewrites `dist/geo-coordinates.html` and `dist/translation-review.html`: never `git add -A`; stage the task's own paths. Leaving `dist/` modified between tasks is fine (`git checkout -- dist` also fine).
- The Atlas baseline screenshots made in Task 5 (`tests/e2e/atlas-baseline.spec.ts-snapshots/`) are never regenerated after Task 5. If one fails, the change is wrong, not the snapshot.
- Raw data is already downloaded under `/tmp/claude-997/-srv-work-geo-coordinates-viz/8881ec1b-a091-4263-ad3d-faaf2e54929a/scratchpad/map-styles/raw/` and `…/scratchpad/pov/ne_10m_pol.geojson`; Tasks 1, 3 and 4 copy what they need into the git-ignored `.cache/`. Reference renders and formulas: `…/scratchpad/map-styles/raster.py`, `vector.mjs`, `out/sizes.json`.
- Visual tasks (7, 9, 11, 12, 13, 15, 18, 19, 20) look at screenshots before reporting: `npm run build && npm run shot -- <hash> <name>` writes `shots/<name>-375x667.png` and `shots/<name>-1366x768.png` (`shots/` is git-ignored). Choose a style first with `?test` + `localStorage` or the switch; `scripts/shot.ts` accepts a hash like `en/lab`.
- Playwright Chromium runs headless with SwiftShader WebGL 2 (checked: `MAX_TEXTURE_SIZE` 8192, `highp` 23 bits, no flags needed). Pixel probes use tolerances; never exact colours.
- Each implementer reports: files changed, test commands and their results, sizes (Tasks 1–4, 21), screenshots looked at, and anything that deviated from the task text with the reason.

## Planning rulings

Each: **what** — why — cost if wrong.

- **R1 Style preference key.** Stored under its own key `geo-coords:map-style` (validated by `parseMapStyle`), not inside `geo-coords:settings`. — `tests/unit/storage.test.ts` asserts the exact settings object (`{ theme, largeText, reducedMotion }`); the spec also says "remembered (like the grid / Equal Earth preference)", which has its own key. The Settings dialog still shows the choice. — Moving it into the settings record later is ~15 lines plus a one-time migration.
- **R2 WebGL 2 only.** No WebGL 1 shader. — `textureGrad` + derivatives give seamless mipmapped sampling across the antimeridian, `highp` is guaranteed and non-power-of-two region tiles get mipmaps. — Devices with WebGL 1 only (≈ iOS < 15) use the canvas path: slower dragging, same picture.
- **R3 Which trigger goes where in the chain.** Texture larger than `MAX_TEXTURE_SIZE` first retries with 2048 px bitmaps; no WebGL, shader compile/link failure, out-of-memory, context lost without restore (3 s) and exceptions in the WebGL draw → canvas; image decode failure → Atlas directly (the canvas path needs the same images); any canvas failure and any vector-layer exception → Atlas. §8 "forced failures → Atlas plus the note" is tested as the end of the chain: e2e forces every trigger, asserts the tier the chain defines, and forces the canvas failure too. — Tier table is one pure function; changing a row is a one-line change plus its test.
- **R4 Physical detail tile resolution.** 720 × 420 at the source's native 30 px/° (HYP_50M_SR_W is the only relief raster available; no 60 px/° relief was downloaded); the Satellite tile is 1440 × 840 at 60 px/° from the 21600 px Blue Marble. — Upscaling would add bytes, not detail. — Slightly softer relief at deep zoom; Natural Earth `HYP_HR_SR_W` (10m) could replace it later for ≈ +70 KB.
- **R5 Texture embedding.** Base64 WebP in `<script type="application/x-geo-texture" id="geo-texture-<id>">` data blocks appended before `</body>` by a Vite plugin; decoded with `createImageBitmap(Blob)` on first use. — Nothing is parsed as JavaScript at load, lazy by construction, trivially measured per asset, no `data:` URL requests. — If a browser mishandled large data blocks, switch the plugin to emit a virtual JS module (plugin-only change).
- **R6 Build tooling.** Textures: `scripts/build-textures.py` needs Python 3.10+ and Pillow with WebP (documented; no numpy; `sharp` is not a dependency). Vectors: Node scripts like the existing ones. Outputs are committed; `npm run build` needs neither Python nor network. — Adding `sharp` would be a new dev dependency for one script. — Rewriting the texture script in Node later changes nothing downstream (same manifest).
- **R7 Political detail.** One ~50m-detail political topology for the whole world (runtime LOD thinning), no 10m political tile for Central Europe. — Spec asks for "~50m detail … simplified"; keeps size down. — Country outlines look coarse at zoom ≥ 9 in Political; a regional 10m build would add ≈ 100 KB.
- **R8 Political borders and coast.** Political draws fills, coastline and borders from its own topology; the world borders (110m simplification of the same Poland point of view) are not drawn in Political because they would not line up with 50m fills. Physical and Satellite keep the existing SVG borders (and voivodeship lines) but no SVG ocean, land, lakes or coast; Political keeps the SVG ocean. — Consistent outlines per style. — Visual only.
- **R9 `SceneSpec.mapStyle` users.** Implemented and unit-tested; used by the worksheet's paper scenes (`'atlas'`). Topic 10 texts are written to work in every style, so no step forces one. A pick with the switch in a scene that forces a style lasts for that scene only. — The spec's "e.g. topic 10 steps" is an example; forcing Satellite would make a step depend on WebGL. — Adding `mapStyle` to a step later is data only.
- **R10 Topic 10 after topic 9 changes three existing assertions** (and nothing else): `tests/unit/router.test.ts` (`#en/topic-10` now opens topic 10's explore; `#en/topic-11` stays home), `tests/unit/topics.test.ts` ("every topic but 9 has question types" becomes "but 9 and 10"), `tests/e2e/explore.spec.ts` (topic 9 now has a "Next topic: Why we have seasons" link). — They encode "topic 9 is the last topic", which the approved topic 10 changes. — None; the alternative (topic 10 not in `TOPIC_IDS`) would break the home list and routing.
- **R11 Loading.** Until a texture style's images are decoded, layers keep drawing Atlas (`drawnMapStyle`) and the stage says "Loading map…" in a polite live region: the map is never blank. — Spec wants a status, not an empty map. — None.
- **R12 Crossfade.** A 180 ms fade-in of the new picture when the drawn style changes; none with reduced motion (setting or media query). — A true two-image blend needs a second canvas snapshot per view. — Visual only.
- **R13 Satellite day/night.** Day weight is `smoothstep(−6°, 0°, solar elevation)`; the SVG day/twilight/night shading is not drawn in Satellite (the Sun symbol, noon line and legend stay). — Spec: "Satellite does its own". — None.
- **R14 Day length.** Geometric (Sun's centre on the horizon, no refraction): the existing `dayLightMinutes`, consistent with the shading. Real day lengths are ≈ 10–15 min longer; texts say "about 16 hours" etc., verified by rounding in tests. Sunrise/sunset in the readout are local mean solar time `12:00 ∓ day/2`; with the real-Sun switch they shift by −(equation of time). — Keeps the readout and the picture consistent. — Wording only.
- **R15 Polar-limit notes** use minute precision (`Polar day north of 66°34′N` at a solstice), in the lesson's notation via `formatLat(…, 'minute')`. Step texts name the Arctic Circle instead of repeating the number. — Readout is exact for any date. — Wording only.
- **R16 Orbit picture.** Camera 22° above the orbit plane; June solstice on the left, December on the right, March equinox at the back, September at the front; Earth moves counter-clockwise (as seen from the north); axis tilted towards ecliptic longitude 90° (towards the Sun in June); lit half from the true 3D Sun direction. — Tilt visible on screen and textbook-like. — Visual only.
- **R17 Class quiz style.** `MapState.runStyle`, set on Start from the setup's radio group (default: the current chosen style) and cleared on End and when the quiz page unmounts; toolbar picks during a run change the run style, never the saved preference. — "applies to that run only". — None.
- **R18 Pixel-identical Atlas** is enforced by Playwright screenshot baselines (`maxDiffPixels: 0`, animations disabled) of the flat map and globe frames in 7 Atlas scenes, captured in Task 5 before any rendering change, on this machine's Chromium. — Only way to prove "pixel-identical". — Baselines are machine-specific; on another machine regenerate them from commit `a355149` first.
- **R19 Printing.** Worksheets and the cheat sheet never create a canvas (paper scenes force Atlas, `StaticMap` has no texture layer). Other pages replace the canvas with a PNG snapshot taken on `beforeprint`. — Spec §4 Print. — None.
- **R20 Lab controls.** The real-Sun switch is lab control `'real-sun'`, Seasons mode is lab control `'seasons'` (a toggle that adds the orbit view in the lab and shows the readout); topic 10 scenes list `'orbit'` in `views` directly. — Scenes stay data; topic 8 cannot show the switch. — None.
- **R21 Names used by tests.** Style button names (Atlas/Physical/Satellite/Political; Atlas/Fizyczna/Satelitarna/Polityczna; Атлас/Фізична/Супутникова/Політична) avoid words existing tests match by substring (Map, Globe, Globus, Mapa, Карта). The compact menu button reads "Map style: …" only below 480 px, where no existing test clicks a "Map" button. — Existing tests unchanged. — Renaming later needs the same check.
- **R22 Country names.** `Intl.DisplayNames(lang, { type: 'region' })` on the Natural Earth `ISO_A2_EH` code; features without a two-letter code get no label. — Spec says `Intl.DisplayNames`; the six codeless features are specks. — The design pass (Task 20) may add a short override table for awkward names ("Congo - Kinshasa").
- **R23 Performance checks.** The e2e perf smoke under SwiftShader + CPU throttle ×4 uses generous bounds (median drag frame < 120 ms, first draw after choosing Satellite < 2.5 s, a later style switch < 400 ms) because software GL is far slower than a phone GPU; "60 fps on a mid-range phone" and "within 100 ms" are manual checks recorded in Task 20. — CI numbers cannot prove phone numbers. — A slow phone found in the manual check becomes a follow-up.
