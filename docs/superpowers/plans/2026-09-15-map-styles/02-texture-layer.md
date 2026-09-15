# Part 2 — Texture layer (spec §9.2)

Tasks 5–8: the style state, the Atlas pixel baseline, the fallback state machine, the inverse projections, the WebGL texture layer and its canvas/Atlas fallbacks. Read spec §4 first.

Context every task here needs:
- Flat maps are an SVG `viewBox="0 0 960 480"`, the globe `viewBox="0 0 500 500"`. `src/map/geometry.ts` builds a `ViewCtx` per view (`makeFlatCtx(width, height, center, zoom, px, projection)` / `makeGlobeCtx(size, rotate, px, zoom)`) whose `projection` is a d3 projection; every SVG layer draws with it. `ctx.zoom` is the flat-map zoom (the globe reports `2 × globeZoom`), `ctx.bounds` a conservative lon/lat box.
- `src/map/mapState.svelte.ts` exports `class MapState` and the shared `mapState`; `applyScene(scene)` replaces the scene (it must not read its own state — see its comment). Layers get their state through `useMapState()` (`src/map/mapStateContext.ts`), so the worksheet's `StaticMap.svelte` can use its own `MapState`.
- `src/map/world.ts` exports `REGION` (lon 8–32°E, lat 44–58°N), `REGION_MIN_ZOOM = 4`, `REGION_DETAIL_ZOOM = 6`, `landFor`, `bordersFor`, `detailFor`.
- `src/app/testMode.ts`: `TEST_MODE` (URL has `?test`) and `expose(name, value)`; `src/main.ts` exposes `__mapState`.
- E2E helpers (`tests/e2e/helpers.ts`): `openPage(page, hash, query)`, `pageErrors(page)`, `expectNoAxeViolations(page, context)`.

---

### Task 5: Style state, Atlas baseline, fallback state machine

**Files:**
- Create: `tests/e2e/atlas-baseline.spec.ts` (+ committed `tests/e2e/atlas-baseline.spec.ts-snapshots/*.png`)
- Create: `src/map/mapStyle.ts`, `src/map/texture/fallback.ts`, `src/map/texture/health.svelte.ts`
- Modify: `src/map/types.ts` (`SceneSpec.mapStyle`), `src/map/mapState.svelte.ts`, `src/app/testMode.ts` (`testFlag`)
- Test: `tests/unit/mapStyle.test.ts`, `tests/unit/fallback.test.ts`, `tests/unit/mapState-style.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (exact):
  ```ts
  // src/map/mapStyle.ts
  export type MapStyle = 'atlas' | 'physical' | 'satellite' | 'political';
  export type TextureStyle = 'physical' | 'satellite';
  export const MAP_STYLES: readonly MapStyle[];     // ['atlas', 'physical', 'satellite', 'political']
  export const DEFAULT_MAP_STYLE: MapStyle;         // 'atlas'
  export function isMapStyle(v: unknown): v is MapStyle;
  export function isTextureStyle(s: MapStyle): s is TextureStyle;
  export function parseMapStyle(v: unknown): MapStyle;
  // src/map/texture/fallback.ts — RenderTier, FailReason, RenderHealth, HealthEvent, INITIAL_HEALTH, nextHealth,
  //   effectiveStyle, drawnStyle, styleUnavailable (code below)
  // src/map/texture/health.svelte.ts — renderHealth, reportHealth, markReady, resetHealth (code below)
  // src/app/testMode.ts — export function testFlag(name: string): string | null
  // MapState: stylePreference, styleOverride, styleChoice, runStyle, chosenMapStyle, mapStyle, drawnMapStyle,
  //   chooseMapStyle(s), setStylePreference(s)
  // SceneSpec: mapStyle?: MapStyle
  ```

- [ ] **Step 1: Capture the Atlas pixel baseline BEFORE changing any code**

Create `tests/e2e/atlas-baseline.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// Map styles spec §7: "Atlas pixel-identical to today". These screenshots were taken from the released code before the
// map styles work began (Task 5) and are never regenerated: a difference means an Atlas rendering change.
type MS = { sun: unknown; rotate: [number, number]; globeZoom: number; setFlatView(c: { lat: number; lon: number }, z: number): void };
const settle = async (page: Page, fn?: (s: MS) => void) => {
  await page.evaluate((src) => {
    const s = (window as unknown as { __mapState: MS }).__mapState;
    if (s.sun) s.sun = { utcMinutes: 720, dayOfYear: 80, year: 2026 };
    if (src) new Function('s', src)(s);
  }, fn ? `(${fn.toString()})(s)` : null);
  await page.waitForTimeout(300);
};
const shoot = async (page: Page, name: string) => {
  for (const view of ['flat', 'globe'] as const) {
    const frame = page.locator(`.view-${view} .frame`);
    if (await frame.count()) await expect(frame, `${name} ${view}`).toHaveScreenshot(`${name}-${view}.png`, { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' });
  }
};

const SCENES: { name: string; hash: string; scheme?: 'dark'; fn?: (s: MS) => void }[] = [
  { name: 'lab', hash: 'en/lab' },
  { name: 'lab-katowice-zoom12', hash: 'en/lab', fn: (s) => s.setFlatView({ lat: 50.26, lon: 19.02 }, 12) },
  { name: 't1-ball', hash: 'en/topic-1/explore' },
  { name: 't1-projections', hash: 'en/topic-1/explore/7' },
  { name: 't6-step5', hash: 'en/topic-6/explore/5' },
  { name: 't9-signs-mercator', hash: 'pl/topic-9/explore/3' },
  { name: 't8-seasons-dark', hash: 'en/topic-8/explore/7', scheme: 'dark' },
];

for (const scene of SCENES) {
  test(`Atlas is pixel-identical: ${scene.name}`, async ({ page }) => {
    if (scene.scheme) await page.emulateMedia({ colorScheme: scene.scheme });
    await openPage(page, scene.hash, '?test');
    await settle(page, scene.fn);
    await shoot(page, scene.name);
  });
}
```
Run (on the unchanged code):
```bash
npm run build
npx playwright test tests/e2e/atlas-baseline.spec.ts --update-snapshots
npx playwright test tests/e2e/atlas-baseline.spec.ts
npx playwright test tests/e2e/atlas-baseline.spec.ts
```
Expected: the first run writes ≈ 12 PNGs into `tests/e2e/atlas-baseline.spec.ts-snapshots/`; the next two runs PASS (7 tests) with no diff. If a run is flaky (e.g. a label moving between runs), raise the `waitForTimeout` to 800 ms and regenerate; never use a `maxDiffPixels` above 0. Commit now, alone:
```bash
git add tests/e2e/atlas-baseline.spec.ts tests/e2e/atlas-baseline.spec.ts-snapshots
git commit -m "test(e2e): Atlas pixel baseline before the map styles work"
```

- [ ] **Step 2: Failing unit tests for the style type and the state machine**

`tests/unit/mapStyle.test.ts`:
```ts
import { expect, test } from 'vitest';
import { DEFAULT_MAP_STYLE, isMapStyle, isTextureStyle, MAP_STYLES, parseMapStyle } from '../../src/map/mapStyle';

test('four styles in switch order, Atlas by default', () => {
  expect(MAP_STYLES).toEqual(['atlas', 'physical', 'satellite', 'political']);
  expect(DEFAULT_MAP_STYLE).toBe('atlas');
  expect(MAP_STYLES.filter(isTextureStyle)).toEqual(['physical', 'satellite']);
});

test('a saved or typed value is a style only when it is exactly one; anything else reads as Atlas', () => {
  for (const s of MAP_STYLES) { expect(isMapStyle(s)).toBe(true); expect(parseMapStyle(s)).toBe(s); }
  for (const v of [null, undefined, '', 'Satellite', ' physical', 'terrain', 1, true, {}, ['atlas']]) {
    expect(isMapStyle(v), String(v)).toBe(false);
    expect(parseMapStyle(v), String(v)).toBe('atlas');
  }
});
```

`tests/unit/fallback.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { drawnStyle, effectiveStyle, INITIAL_HEALTH, nextHealth, styleUnavailable, type HealthEvent, type RenderHealth } from '../../src/map/texture/fallback';

const run = (...events: HealthEvent[]): RenderHealth => events.reduce(nextHealth, INITIAL_HEALTH);
const fail = (reason: Parameters<typeof nextHealth>[1] extends infer E ? E extends { type: 'fail'; reason: infer R } ? R : never : never): HealthEvent => ({ type: 'fail', reason });

describe('fallback chain: WebGL → canvas → Atlas', () => {
  test('starts on WebGL with 4096 px textures', () => {
    expect(INITIAL_HEALTH).toEqual({ tier: 'webgl', maxTexture: 4096, waitingForRestore: false, vectorFailed: false, reasons: [] });
  });
  test.each(['no-webgl', 'shader', 'oom', 'render'] as const)('%s on WebGL moves to canvas', (reason) => {
    expect(run(fail(reason))).toMatchObject({ tier: 'canvas', reasons: [reason] });
  });
  test('a texture too large first tries 2048 px, then the canvas', () => {
    expect(run(fail('texture-size'))).toMatchObject({ tier: 'webgl', maxTexture: 2048 });
    expect(run(fail('texture-size'), fail('texture-size'))).toMatchObject({ tier: 'canvas', maxTexture: 2048, reasons: ['texture-size', 'texture-size'] });
  });
  test('an image that cannot be decoded goes straight to Atlas (the canvas needs the same images)', () => {
    expect(run(fail('decode')).tier).toBe('atlas');
  });
  test('a lost context waits; restored it stays on WebGL; not restored in time it moves to canvas', () => {
    expect(run({ type: 'context-lost' })).toMatchObject({ tier: 'webgl', waitingForRestore: true });
    expect(run({ type: 'context-lost' }, { type: 'context-restored' })).toMatchObject({ tier: 'webgl', waitingForRestore: false });
    expect(run({ type: 'context-lost' }, { type: 'restore-timeout' })).toMatchObject({ tier: 'canvas', waitingForRestore: false, reasons: ['context-lost'] });
    // A late timeout after a restore changes nothing.
    expect(run({ type: 'context-lost' }, { type: 'context-restored' }, { type: 'restore-timeout' }).tier).toBe('webgl');
  });
  test.each(['no-canvas', 'render', 'oom', 'texture-size', 'decode'] as const)('%s on the canvas moves to Atlas', (reason) => {
    expect(run(fail('no-webgl'), fail(reason)).tier).toBe('atlas');
  });
  test('Atlas is final for the page session', () => {
    const atlas = run(fail('decode'));
    expect(run(fail('decode'), { type: 'context-restored' }, fail('no-webgl'))).toEqual(atlas);
  });
  test('a vector layer failure is remembered without touching the raster tier', () => {
    expect(run({ type: 'vector-fail' })).toMatchObject({ tier: 'webgl', vectorFailed: true });
  });
});

describe('which style can be drawn', () => {
  const canvas = run(fail('no-webgl')), atlas = run(fail('decode')), vector = run({ type: 'vector-fail' });
  test('effective style', () => {
    expect(effectiveStyle('satellite', INITIAL_HEALTH)).toBe('satellite');
    expect(effectiveStyle('satellite', canvas)).toBe('satellite');
    expect(effectiveStyle('physical', atlas)).toBe('atlas');
    expect(effectiveStyle('satellite', atlas)).toBe('atlas');
    expect(effectiveStyle('political', atlas)).toBe('political');
    expect(effectiveStyle('political', vector)).toBe('atlas');
    expect(effectiveStyle('physical', vector)).toBe('atlas');
    expect(effectiveStyle('satellite', vector)).toBe('satellite');
    expect(effectiveStyle('atlas', atlas)).toBe('atlas');
  });
  test('a texture style draws Atlas until its images are decoded', () => {
    const none = { physical: false, satellite: false };
    expect(drawnStyle('physical', none)).toBe('atlas');
    expect(drawnStyle('physical', { physical: true, satellite: false })).toBe('physical');
    expect(drawnStyle('political', none)).toBe('political');
  });
  test('the "showing Atlas" note shows only when a chosen style fell back', () => {
    expect(styleUnavailable('satellite', atlas)).toBe(true);
    expect(styleUnavailable('satellite', canvas)).toBe(false);
    expect(styleUnavailable('atlas', atlas)).toBe(false);
    expect(styleUnavailable('political', vector)).toBe(true);
  });
});
```
Simplify the `fail` helper's type to `(reason: FailReason)` when you write it (import `FailReason`); the conditional type above only documents the intent.

Run: `npx vitest run tests/unit/mapStyle.test.ts tests/unit/fallback.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/map/mapStyle.ts`**

```ts
// The map styles (Map styles spec §3): Atlas (the lesson's own map), Physical (relief), Satellite (NASA imagery) and
// Political (countries). Physical and Satellite are drawn from textures (src/map/texture/); the others in SVG.
export type MapStyle = 'atlas' | 'physical' | 'satellite' | 'political';
export type TextureStyle = Extract<MapStyle, 'physical' | 'satellite'>;

export const MAP_STYLES: readonly MapStyle[] = ['atlas', 'physical', 'satellite', 'political'];
export const DEFAULT_MAP_STYLE: MapStyle = 'atlas';

export const isMapStyle = (v: unknown): v is MapStyle => typeof v === 'string' && (MAP_STYLES as readonly string[]).includes(v);
export const isTextureStyle = (s: MapStyle): s is TextureStyle => s === 'physical' || s === 'satellite';

/** A saved or typed value as a style: anything that is not exactly a style name (null, 'Satellite', a number) is Atlas. */
export const parseMapStyle = (v: unknown): MapStyle => (isMapStyle(v) ? v : DEFAULT_MAP_STYLE);
```

- [ ] **Step 4: Implement `src/map/texture/fallback.ts`**

```ts
import { isTextureStyle, type MapStyle, type TextureStyle } from '../mapStyle';

/*
 * Map styles spec §4 "Fallback chain (owner rule: any error → existing solution)": WebGL → Canvas 2D → Atlas. A pure
 * state machine, kept for the page session only (never saved). Planning ruling R3 fixes where each trigger goes.
 */
export type RenderTier = 'webgl' | 'canvas' | 'atlas';
export type FailReason = 'no-webgl' | 'shader' | 'texture-size' | 'decode' | 'oom' | 'context-lost' | 'render' | 'no-canvas';

export interface RenderHealth {
  tier: RenderTier;
  /** Largest texture edge to decode: 4096, or 2048 after the device refused 4096 px textures. */
  maxTexture: 4096 | 2048;
  /** A WebGL context was lost and may still be restored. */
  waitingForRestore: boolean;
  /** An exception in the Political or Physical vector layers: those styles show Atlas. */
  vectorFailed: boolean;
  /** Why the chain moved, oldest first (for tests and the design pass). */
  reasons: FailReason[];
}

export type HealthEvent =
  | { type: 'fail'; reason: FailReason }
  | { type: 'context-lost' }
  | { type: 'context-restored' }
  | { type: 'restore-timeout' }
  | { type: 'vector-fail' };

export const INITIAL_HEALTH: RenderHealth = Object.freeze({ tier: 'webgl', maxTexture: 4096, waitingForRestore: false, vectorFailed: false, reasons: [] }) as RenderHealth;

const down = (s: RenderHealth, reason: FailReason): RenderHealth =>
  ({ ...s, tier: s.tier === 'webgl' ? 'canvas' : 'atlas', waitingForRestore: false, reasons: [...s.reasons, reason] });

export function nextHealth(s: RenderHealth, e: HealthEvent): RenderHealth {
  if (e.type === 'vector-fail') return s.vectorFailed ? s : { ...s, vectorFailed: true };
  if (s.tier === 'atlas') return s;
  switch (e.type) {
    case 'context-lost':
      return s.tier === 'webgl' ? { ...s, waitingForRestore: true } : s;
    case 'context-restored':
      return s.waitingForRestore ? { ...s, waitingForRestore: false } : s;
    case 'restore-timeout':
      return s.tier === 'webgl' && s.waitingForRestore ? down(s, 'context-lost') : s;
    case 'fail':
      if (e.reason === 'decode') return { ...s, tier: 'atlas', waitingForRestore: false, reasons: [...s.reasons, 'decode'] };
      if (e.reason === 'texture-size' && s.tier === 'webgl' && s.maxTexture === 4096) return { ...s, maxTexture: 2048, reasons: [...s.reasons, 'texture-size'] };
      return down(s, e.reason);
  }
}

/** The style that can be drawn on this device for the chosen one. */
export function effectiveStyle(chosen: MapStyle, h: RenderHealth): MapStyle {
  if (chosen === 'atlas') return 'atlas';
  if (chosen === 'political') return h.vectorFailed ? 'atlas' : 'political';
  if (h.tier === 'atlas') return 'atlas';
  return chosen === 'physical' && h.vectorFailed ? 'atlas' : chosen;
}

/** What the layers draw right now: a texture style keeps Atlas on screen until its images are decoded (ruling R11). */
export function drawnStyle(style: MapStyle, ready: Readonly<Record<TextureStyle, boolean>>): MapStyle {
  return isTextureStyle(style) && !ready[style] ? 'atlas' : style;
}

/** Whether to show "This device can't draw this style; showing Atlas". */
export function styleUnavailable(chosen: MapStyle, h: RenderHealth): boolean {
  return chosen !== 'atlas' && effectiveStyle(chosen, h) === 'atlas';
}
```

- [ ] **Step 5: Implement `src/map/texture/health.svelte.ts` and `testFlag`**

```ts
import type { TextureStyle } from '../mapStyle';
import { INITIAL_HEALTH, nextHealth, type HealthEvent, type RenderHealth } from './fallback';

/**
 * The page session's render health, shared by every map view: the fallback tier, which texture styles have their
 * images decoded, and which style is decoding now (the "Loading map…" status).
 */
export const renderHealth = $state<{ state: RenderHealth; ready: Record<TextureStyle, boolean>; loading: TextureStyle | null }>({
  state: INITIAL_HEALTH, ready: { physical: false, satellite: false }, loading: null,
});

export function reportHealth(e: HealthEvent): void {
  const next = nextHealth(renderHealth.state, e);
  if (next !== renderHealth.state) renderHealth.state = next;
}

export function markReady(style: TextureStyle): void {
  if (!renderHealth.ready[style]) renderHealth.ready[style] = true;
}

/** Tests only. */
export function resetHealth(): void {
  renderHealth.state = INITIAL_HEALTH;
  renderHealth.ready = { physical: false, satellite: false };
  renderHealth.loading = null;
}
```
In `src/app/testMode.ts` append:
```ts
/** A `?test` page's switch such as `gl=off` (see src/map/texture/): null outside test mode, so real users never hit one. */
export function testFlag(name: string): string | null {
  return TEST_MODE ? new URLSearchParams(location.search).get(name) : null;
}
```

- [ ] **Step 6: Failing MapState style test `tests/unit/mapState-style.test.ts`**

```ts
import { beforeEach, expect, test } from 'vitest';
import { MapState } from '../../src/map/mapState.svelte';
import { markReady, reportHealth, resetHealth } from '../../src/map/texture/health.svelte';

beforeEach(() => resetHealth());

test('Atlas by default; a scene with no style keeps the preference', () => {
  const s = new MapState();
  expect(s.chosenMapStyle).toBe('atlas');
  s.setStylePreference('political');
  s.applyScene({ views: ['flat'] });
  expect(s.chosenMapStyle).toBe('political');
  expect(s.mapStyle).toBe('political');
});

test('a scene may force a style; a pick then lasts for that scene only', () => {
  const s = new MapState();
  s.setStylePreference('satellite');
  s.applyScene({ views: ['flat'], mapStyle: 'atlas' });
  expect(s.chosenMapStyle).toBe('atlas');
  s.chooseMapStyle('physical');
  expect(s.chosenMapStyle).toBe('physical');
  expect(s.stylePreference).toBe('satellite');
  s.applyScene({ views: ['flat'] });
  expect(s.chosenMapStyle).toBe('satellite');
});

test('a class quiz run style beats the preference, and picks during the run change only the run', () => {
  const s = new MapState();
  s.setStylePreference('physical');
  s.runStyle = 'political';
  s.applyScene({ views: ['flat'] });
  expect(s.chosenMapStyle).toBe('political');
  s.chooseMapStyle('satellite');
  expect([s.runStyle, s.stylePreference]).toEqual(['satellite', 'physical']);
  s.runStyle = null;
  expect(s.chosenMapStyle).toBe('physical');
  s.chooseMapStyle('atlas');
  expect(s.stylePreference).toBe('atlas');
});

test('the drawn style waits for decoded images and falls back to Atlas when the device fails', () => {
  const s = new MapState();
  s.chooseMapStyle('satellite');
  expect([s.mapStyle, s.drawnMapStyle]).toEqual(['satellite', 'atlas']);
  markReady('satellite');
  expect(s.drawnMapStyle).toBe('satellite');
  reportHealth({ type: 'fail', reason: 'decode' });
  expect([s.chosenMapStyle, s.mapStyle, s.drawnMapStyle]).toEqual(['satellite', 'atlas', 'atlas']);
});
```
Run: `npx vitest run tests/unit/mapState-style.test.ts` — Expected: FAIL (`setStylePreference` is not a function).

- [ ] **Step 7: Add the style state to `MapState` and `SceneSpec`**

In `src/map/types.ts` add `import type { MapStyle } from './mapStyle';` and to `SceneSpec`, after `projectionSwitch`:
```ts
  mapStyle?: MapStyle;                   // forces this map style for the scene (worksheets: 'atlas'); a pick with the switch then lasts for the scene only
```
In `src/map/mapState.svelte.ts`:
```ts
import { DEFAULT_MAP_STYLE, type MapStyle } from './mapStyle';
import { drawnStyle, effectiveStyle } from './texture/fallback';
import { renderHealth } from './texture/health.svelte';
```
Fields (after `schoolsToggle`):
```ts
  /** The remembered map style (Task 9 reads and writes it in storage). */
  stylePreference = $state<MapStyle>(DEFAULT_MAP_STYLE);
  /** The style the scene sets (`SceneSpec.mapStyle`), if any. */
  styleOverride = $state<MapStyle | null>(null);
  /** A style picked with the switch while the scene sets its own: lasts until the next `applyScene`. */
  styleChoice = $state<MapStyle | null>(null);
  /** A class quiz run's style (ClassQuiz sets it on Start, clears it on End): never saved. */
  runStyle = $state<MapStyle | null>(null);
```
Getters and methods (after `flatProjection`):
```ts
  /** The style the pupil or teacher chose for this map, before any fallback. */
  get chosenMapStyle(): MapStyle {
    return this.styleChoice ?? this.styleOverride ?? this.runStyle ?? this.stylePreference;
  }

  /** The chosen style, or Atlas when this device cannot draw it (src/map/texture/fallback.ts). */
  get mapStyle(): MapStyle {
    return effectiveStyle(this.chosenMapStyle, renderHealth.state);
  }

  /** What the layers draw now: a texture style shows Atlas until its images are decoded. */
  get drawnMapStyle(): MapStyle {
    return drawnStyle(this.mapStyle, renderHealth.ready);
  }

  /** The style switch: a scene with its own style → this scene; a class quiz run → this run; otherwise the preference. */
  chooseMapStyle(s: MapStyle): void {
    if (this.styleOverride !== null) this.styleChoice = s;
    else if (this.runStyle !== null) this.runStyle = s;
    else this.setStylePreference(s);
  }

  setStylePreference(s: MapStyle): void {
    this.stylePreference = s;
  }
```
In `replaceScene`, after `this.projectionSwitch = …`: `this.styleOverride = scene.mapStyle ?? null;` and `this.styleChoice = null;`.

- [ ] **Step 8: Run everything**

Run: `npx vitest run tests/unit/mapStyle.test.ts tests/unit/fallback.test.ts tests/unit/mapState-style.test.ts && npm run check && npm test`
Expected: PASS; svelte-check 0 errors, 0 warnings.
Run: `npm run build && npx playwright test tests/e2e/atlas-baseline.spec.ts`
Expected: PASS (7) — nothing is drawn differently yet.

- [ ] **Step 9: Commit**

```bash
git add src/map/mapStyle.ts src/map/texture/fallback.ts src/map/texture/health.svelte.ts src/map/types.ts src/map/mapState.svelte.ts src/app/testMode.ts tests/unit/mapStyle.test.ts tests/unit/fallback.test.ts tests/unit/mapState-style.test.ts
git commit -m "feat(map): map style state and the WebGL → canvas → Atlas fallback state machine"
```

---

### Task 6: Inverse projections (CPU port of the shader)

The single source of view parameters for the texture layer, and a JavaScript port of the shader's inverse projections, proven against d3 to ≤ 0.01°.

**Files:**
- Create: `src/map/texture/viewParams.ts`, `src/map/texture/inverse.ts`
- Test: `tests/unit/texture-inverse.test.ts`

**Interfaces:**
- Consumes: `ViewCtx`, `GeoBounds`, `RAD`, `MERCATOR_MAX_LAT`, `boundsIntersect`, `makeFlatCtx`, `makeGlobeCtx`, `flatMinZoom` from `src/map/geometry.ts`; `REGION`, `REGION_MIN_ZOOM` from `src/map/world.ts`.
- Produces:
  ```ts
  export type ProjectionCode = 0 | 1 | 2 | 3;   // grid (equirectangular), equal-earth, mercator, globe (orthographic)
  export interface TextureView {
    projection: ProjectionCode; width: number; height: number;   // view units (960×480 or 500×500)
    scale: number;                // d3 projection.scale()
    origin: [number, number];     // flat: projection([0, 0]); globe: projection.translate()
    rotate: [number, number];     // globe: projection.rotate()[0..1] in radians; flat: [0, 0]
    maxLat: number;               // radians: 85° on Mercator, 90° otherwise
    zoom: number; bounds: GeoBounds;
  }
  export function textureView(ctx: ViewCtx): TextureView;
  export interface Inverse { lambda: number; phi: number; rho: number }
  export function inverseProject(v: TextureView, x: number, y: number): Inverse | null;   // x, y in view units
  export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number; // 0…1
  ```

Why `origin = projection([0, 0])` is exact: d3 applies `.center([λ0, φ0])` by translating so the centre lands on `translate`; with no rotation, a flat projection maps a point to `x = dx + k·rawX(λ, φ)`, `y = dy − k·rawY(λ, φ)`, and every raw projection used here has `raw(0, 0) = (0, 0)`, so `(dx, dy) = projection([0, 0])`. The globe has no centre offset: `(dx, dy) = translate`, and the rotation is d3's `rotateRadians(δλ, δφ, 0)`: λ′ = λ + δλ, then `x = cosφ cosλ′, y = cosφ sinλ′, z = sinφ`, `λ″ = atan2(y, x cosδφ − z sinδφ)`, `φ″ = asin(z cosδφ + x sinδφ)`, then orthographic `X = cosφ″ sinλ″, Y = sinφ″`.

- [ ] **Step 1: Failing test `tests/unit/texture-inverse.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { flatMinZoom, makeFlatCtx, makeGlobeCtx, type ViewCtx } from '../../src/map/geometry';
import { REGION, REGION_MIN_ZOOM } from '../../src/map/world';
import { inverseProject, regionMix } from '../../src/map/texture/inverse';
import { textureView } from '../../src/map/texture/viewParams';
import type { FlatProjection } from '../../src/map/types';

const DEG = 180 / Math.PI;
const lonDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Samples a grid of view points (plus the corners) and compares the port with d3's own invert (ViewCtx.invert). */
function compare(ctx: ViewCtx, nx: number, ny: number) {
  const v = textureView(ctx);
  let checked = 0;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const x = (ctx.width * i) / nx, y = (ctx.height * j) / ny;
      const port = inverseProject(v, x, y);
      if (ctx.kind === 'globe') {
        const r = Math.hypot(x - v.origin[0], y - v.origin[1]) / v.scale;
        if (Math.abs(r - 1) < 1e-3) continue; // exactly on the limb either answer is fine
      }
      const d3 = ctx.invert([x, y]);
      expect(port === null, `null at ${x},${y}`).toBe(d3 === null);
      if (!port || !d3) continue;
      checked++;
      expect(Math.abs(port.phi * DEG - d3.lat), `lat at ${x},${y}`).toBeLessThanOrEqual(0.01);
      if (Math.abs(d3.lat) < 89.99) expect(lonDiff(port.lambda * DEG, d3.lon), `lon at ${x},${y}`).toBeLessThanOrEqual(0.01);
    }
  }
  return checked;
}

describe('texture inverse projections match d3 to 0.01°', () => {
  const flats: [FlatProjection, { lat: number; lon: number }, number][] = [];
  for (const p of ['grid', 'equal-earth', 'mercator'] as const) {
    flats.push([p, { lat: 0, lon: 0 }, flatMinZoom(p)], [p, { lat: 0, lon: 0 }, 1], [p, { lat: 50.26, lon: 19.02 }, 9],
      [p, { lat: -33.87, lon: 151.21 }, 3.5], [p, { lat: 60, lon: 170 }, 2], [p, { lat: 50.26, lon: 19.02 }, 80]);
  }
  test.each(flats)('%s centred %o at zoom %d', (projection, center, zoom) => {
    expect(compare(makeFlatCtx(960, 480, center, zoom, 1, projection), 32, 16)).toBeGreaterThan(100);
  });

  test.each([
    [[-19, -50], 1], [[0, -90], 1], [[0, 90], 1], [[170, 30], 3], [[-19.02, -50.26], 60], [[179.5, 0], 1.5],
  ] as [[number, number], number][])('globe rotated %o at zoom %d', (rotate, zoom) => {
    expect(compare(makeGlobeCtx(500, rotate, 1, zoom), 40, 40)).toBeGreaterThan(50);
  });
});

describe('clip edges', () => {
  test('globe: just inside the disc is on the map, just outside is not', () => {
    const v = textureView(makeGlobeCtx(500, [0, 0], 1, 1)); // radius 244 around (250, 250)
    expect(inverseProject(v, 250 + 243.9, 250)).not.toBeNull();
    expect(inverseProject(v, 250 + 244.2, 250)).toBeNull();
    expect(inverseProject(v, 250, 250)!.rho).toBe(0);
  });
  test('Mercator stops at 85°; Equal Earth outside its outline and grid beyond the poles are off the map', () => {
    const merc = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, flatMinZoom('mercator'), 1, 'mercator');
    const top = merc.project({ lat: 85, lon: 0 })![1];
    expect(inverseProject(textureView(merc), 480, top + 0.5)).not.toBeNull();
    expect(inverseProject(textureView(merc), 480, top - 0.5)).toBeNull();
    expect(inverseProject(textureView(merc), 5, 240)).toBeNull(); // sea beside a zoomed-out Mercator world
    expect(inverseProject(textureView(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth')), 2, 2)).toBeNull();
  });
});

test('the detail tile fades in from zoom 4 to 5 where the view reaches Central Europe', () => {
  const at = (center: { lat: number; lon: number }, zoom: number) => regionMix(textureView(makeFlatCtx(960, 480, center, zoom, 1, 'grid')), REGION, REGION_MIN_ZOOM);
  expect(at({ lat: 50, lon: 19 }, 3.9)).toBe(0);
  expect(at({ lat: 50, lon: 19 }, 4.5)).toBeCloseTo(0.5, 9);
  expect(at({ lat: 50, lon: 19 }, 9)).toBe(1);
  expect(at({ lat: -33.87, lon: 151.21 }, 9)).toBe(0);
});
```
Run: `npx vitest run tests/unit/texture-inverse.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 2: Implement `src/map/texture/viewParams.ts`**

```ts
import { MERCATOR_MAX_LAT, RAD, type GeoBounds, type ViewCtx } from '../geometry';

/*
 * Map styles spec §4 "Single source of truth": the texture layer reads the view from the same ViewCtx (and so the same
 * d3 projection) the SVG layers draw with, so the image and the vectors cannot drift.
 */
export type ProjectionCode = 0 | 1 | 2 | 3;
export const PROJECTION_CODE = { grid: 0, 'equal-earth': 1, mercator: 2, globe: 3 } as const;

export interface TextureView {
  projection: ProjectionCode;
  width: number;
  height: number;
  scale: number;
  origin: [number, number];
  rotate: [number, number];
  maxLat: number;
  zoom: number;
  bounds: GeoBounds;
}

export function textureView(ctx: ViewCtx): TextureView {
  const p = ctx.projection;
  if (ctx.kind === 'globe') {
    const [lambda = 0, phi = 0] = p.rotate();
    const [tx, ty] = p.translate();
    return { projection: 3, width: ctx.width, height: ctx.height, scale: p.scale(), origin: [tx, ty], rotate: [lambda * RAD, phi * RAD], maxLat: Math.PI / 2, zoom: ctx.zoom, bounds: ctx.bounds };
  }
  const kind = ctx.flatProjection ?? 'grid';
  const o = p([0, 0])!;
  return { projection: PROJECTION_CODE[kind], width: ctx.width, height: ctx.height, scale: p.scale(), origin: [o[0], o[1]], rotate: [0, 0], maxLat: (kind === 'mercator' ? MERCATOR_MAX_LAT : 90) * RAD, zoom: ctx.zoom, bounds: ctx.bounds };
}
```

- [ ] **Step 3: Implement `src/map/texture/inverse.ts` (mirrors the GLSL of Task 7 line for line)**

```ts
import { boundsIntersect, type GeoBounds } from '../geometry';
import type { TextureView } from './viewParams';

// d3-geo's Equal Earth constants (node_modules/d3-geo/src/projection/equalEarth.js).
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
const EPS = 1e-6;

export interface Inverse { lambda: number; phi: number; rho: number }

/**
 * The longitude and latitude (radians) under view point (x, y), or null off the map. The same arithmetic as the
 * fragment shader (src/map/texture/shaders.ts), used by the canvas fallback and by the tests against d3.
 */
export function inverseProject(v: TextureView, x: number, y: number): Inverse | null {
  const X = (x - v.origin[0]) / v.scale;
  const Y = (v.origin[1] - y) / v.scale;
  if (v.projection === 3) {
    const r2 = X * X + Y * Y;
    if (r2 > 1) return null;
    // Back through d3's rotation: the visible hemisphere in the rotated frame (x towards the viewer, y right, z up).
    const xr = Math.sqrt(1 - r2);
    const cp = Math.cos(v.rotate[1]), sp = Math.sin(v.rotate[1]);
    const cx = xr * cp + Y * sp;
    const cy = X;
    const cz = Y * cp - xr * sp;
    let lambda = Math.atan2(cy, cx) - v.rotate[0];
    lambda = ((((lambda + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return { lambda, phi: Math.asin(Math.max(-1, Math.min(1, cz))), rho: Math.sqrt(r2) };
  }
  let lambda: number, phi: number;
  if (v.projection === 0) {
    lambda = X; phi = Y;
  } else if (v.projection === 2) {
    lambda = X; phi = 2 * Math.atan(Math.exp(Y)) - Math.PI / 2;
  } else {
    let l = Y;
    for (let i = 0; i < 12; i++) {
      const l2 = l * l, l6 = l2 * l2 * l2;
      l -= (l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - Y) / (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2));
    }
    const l2 = l * l, l6 = l2 * l2 * l2;
    const s = Math.sin(l) / M;
    if (Math.abs(s) > 1) return null;
    lambda = (M * X * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))) / Math.cos(l);
    phi = Math.asin(s);
  }
  if (!Number.isFinite(lambda) || Math.abs(lambda) > Math.PI + EPS || Math.abs(phi) > v.maxLat + EPS) return null;
  return { lambda, phi, rho: 0 };
}

/** How much of the Central Europe detail tile to blend in: 0 below `minZoom` or away from the region, 1 from one zoom level above. */
export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number {
  if (!boundsIntersect(v.bounds, region)) return 0;
  return Math.max(0, Math.min(1, v.zoom - minZoom));
}
```
The GLSL uses the same epsilon (`1e-6`) and the same `mod` for wrapping.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/texture-inverse.test.ts`
Expected: PASS (27 tests). The scratch check done while planning measured the worst difference at 1.4e-14° (Equal Earth) and 4e-14° (globe). If the grid map at `zoom 80` fails at the view edge because `ctx.invert` returns null for `x === width`, skip samples where `x === ctx.width || y === ctx.height` only for that reason and say so in a comment.

- [ ] **Step 5: Commit**

```bash
npm run check && npm test
git add src/map/texture/viewParams.ts src/map/texture/inverse.ts tests/unit/texture-inverse.test.ts
git commit -m "feat(map): texture view parameters from the d3 projection and inverse projections checked against d3"
```

---

### Task 7: WebGL texture layer

Decode the embedded textures, draw Physical and Satellite (day only for now) with a WebGL 2 shader under the SVG of every interactive flat map and globe, and hide the Atlas surfaces (ocean, land, coasts) while a texture style is drawn.

**Files:**
- Create: `src/map/texture/renderer.ts`, `src/map/texture/shaders.ts`, `src/map/texture/assets.ts`, `src/map/texture/webgl.ts`, `src/map/texture/testHooks.ts`, `src/map/texture/TextureLayer.svelte`
- Modify: `src/map/FlatMap.svelte`, `src/map/Globe.svelte`, `src/map/layers/Layers.svelte`, `src/map/layers/Land.svelte`, `src/main.ts`, `tests/e2e/helpers.ts`
- Test: `tests/unit/texture-assets.test.ts`, `tests/e2e/texture-webgl.spec.ts`

**Interfaces:**
- Consumes: `TextureView`, `textureView(ctx)`, `inverseProject`, `regionMix` (Task 6); `renderHealth`, `reportHealth`, `markReady` (Task 5); `FailReason` (Task 5); `MapState.mapStyle`, `drawnMapStyle`, `chooseMapStyle` (Task 5); `isTextureStyle`, `TextureStyle` (Task 5); `testFlag`, `expose` (`src/app/testMode.ts`); texture data blocks `script#geo-texture-<id>` (Task 2); `src/map/data/textures/manifest.json` (Task 1).
- Produces:
  ```ts
  // renderer.ts
  export class RenderFailure extends Error { constructor(readonly reason: FailReason, message: string) }
  export interface SunVector { x: number; y: number; z: number }
  export function sunVector(p: LatLon): SunVector;         // d3 cartesian: x = cosφ cosλ, y = cosφ sinλ, z = sinφ
  export interface StyleTextures { day: ImageBitmap; region: ImageBitmap; night: ImageBitmap | null }
  export interface DrawInputs { view: TextureView; regionMix: number; night: SunVector | null; limb: boolean; glow: boolean; quality: 'full' | 'fast'; debug: 0 | 1 | 2 }
  export interface TextureRenderer { readonly tier: 'webgl' | 'canvas'; readonly maxTextureSize: number; resize(cssWidth: number, cssHeight: number, dpr: number): void; setTextures(t: StyleTextures): void; draw(input: DrawInputs): void; readPixels(x: number, y: number, w: number, h: number): Uint8Array; bufferSize(): { width: number; height: number }; loseContext?(restoreAfterMs: number | null): void; dispose(): void }
  // shaders.ts
  export const VERTEX_SHADER: string; export const FRAGMENT_SHADER: string;
  // assets.ts
  export type TextureId = 'physical-world' | 'physical-region' | 'satellite-day' | 'satellite-region' | 'satellite-night';
  export const STYLE_TEXTURES: Record<TextureStyle, { day: TextureId; region: TextureId; night: TextureId | null }>;
  export function decodeBase64(b64: string): Uint8Array;
  export function fitWithin(width: number, height: number, maxSize: number): { width: number; height: number };
  export function loadTexture(id: TextureId, maxSize: number): Promise<ImageBitmap>;
  export function loadStyleTextures(style: TextureStyle, maxSize: number, withNight: boolean): Promise<StyleTextures>;
  // webgl.ts
  export function createWebGLRenderer(canvas: HTMLCanvasElement, forced: string | null): TextureRenderer;
  // testHooks.ts
  export interface TextureViewHandle { renderer(): TextureRenderer | null; input(): DrawInputs | null; ctx(): ViewCtx; drawCount(): number }
  export function registerTextureView(view: 'flat' | 'globe', handle: TextureViewHandle): () => void;
  export const textureTestHooks: { tier(): string; health(): unknown; probe(view: 'flat' | 'globe', lat: number, lon: number, radius?: number): ProbeResult | null; debugCoords(view: 'flat' | 'globe', points: [number, number][]): ({ x: number; y: number; lon: number; lat: number } | null)[]; loseContext(view: 'flat' | 'globe', restoreAfterMs: number | null): void; drawCount(view: 'flat' | 'globe'): number };
  export interface ProbeResult { avg: [number, number, number]; maxSum: number }
  // TextureLayer.svelte props: { ctx: ViewCtx; view: 'flat' | 'globe' }
  // Land.svelte gains prop `style: MapStyle` (default 'atlas')
  // tests/e2e/helpers.ts gains: setMapStyle(page, style), waitForTexture(page, view), probe(page, view, lat, lon, radius?)
  ```
- `window.__mapTextures` (test mode) = `textureTestHooks`.

- [ ] **Step 1: Failing unit test `tests/unit/texture-assets.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { decodeBase64, fitWithin, STYLE_TEXTURES } from '../../src/map/texture/assets';
import { sunVector } from '../../src/map/texture/renderer';

test('base64 from a data block decodes to the file bytes (whitespace and line breaks ignored)', () => {
  const bytes = readFileSync('src/map/data/textures/physical-region.webp');
  const b64 = bytes.toString('base64');
  const wrapped = `\n  ${b64.slice(0, 100)}\n${b64.slice(100)}  \n`;
  expect(Buffer.from(decodeBase64(wrapped)).equals(bytes)).toBe(true);
  expect([...decodeBase64('QUJD')]).toEqual([65, 66, 67]);
});

test('textures larger than the device allows are decoded smaller, keeping their shape', () => {
  expect(fitWithin(4096, 2048, 4096)).toEqual({ width: 4096, height: 2048 });
  expect(fitWithin(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
  expect(fitWithin(1440, 840, 2048)).toEqual({ width: 1440, height: 840 });
  expect(fitWithin(1440, 840, 1024)).toEqual({ width: 1024, height: 597 });
});

test('which textures each style needs', () => {
  expect(STYLE_TEXTURES).toEqual({
    physical: { day: 'physical-world', region: 'physical-region', night: null },
    satellite: { day: 'satellite-day', region: 'satellite-region', night: 'satellite-night' },
  });
});

test('the Sun as a unit vector in d3 cartesian coordinates', () => {
  const v = sunVector({ lat: 0, lon: 90 });
  expect(v.x).toBeCloseTo(0, 12); expect(v.y).toBeCloseTo(1, 12); expect(v.z).toBeCloseTo(0, 12);
  expect(sunVector({ lat: 90, lon: 0 }).z).toBeCloseTo(1, 12);
});
```
Run: `npx vitest run tests/unit/texture-assets.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 2: `src/map/texture/renderer.ts`**

```ts
import type { LatLon } from '../../geo/types';
import type { FailReason } from './fallback';
import type { TextureView } from './viewParams';

/** A failure with the reason the fallback chain (fallback.ts) needs to pick the next tier. */
export class RenderFailure extends Error {
  constructor(readonly reason: FailReason, message: string) {
    super(message);
    this.name = 'RenderFailure';
  }
}

export interface SunVector { x: number; y: number; z: number }

/** The point under the Sun as a unit vector in d3's cartesian frame (x = cosφ cosλ, y = cosφ sinλ, z = sinφ). */
export function sunVector(p: LatLon): SunVector {
  const la = (p.lat * Math.PI) / 180, lo = (p.lon * Math.PI) / 180;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.cos(la) * Math.sin(lo), z: Math.sin(la) };
}

export interface StyleTextures { day: ImageBitmap; region: ImageBitmap; night: ImageBitmap | null }

export interface DrawInputs {
  view: TextureView;
  /** 0…1: how much of the Central Europe detail tile to blend in (inverse.ts regionMix). */
  regionMix: number;
  /** Satellite with day and night: the Sun; null draws the day image everywhere. */
  night: SunVector | null;
  /** Globe: darken towards the rim. */
  limb: boolean;
  /** Globe, Satellite: an atmosphere glow just outside the rim. */
  glow: boolean;
  /** 'fast' lets the canvas path draw at reduced resolution while dragging (WebGL ignores it). */
  quality: 'full' | 'fast';
  /** Tests only: 1 writes the longitude, 2 the latitude, as 16-bit values in red (high byte) and green (low byte). */
  debug: 0 | 1 | 2;
}

export interface TextureRenderer {
  readonly tier: 'webgl' | 'canvas';
  readonly maxTextureSize: number;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  setTextures(t: StyleTextures): void;
  draw(input: DrawInputs): void;
  /** RGBA bytes of a rectangle of the drawing buffer, rows top to bottom (call right after draw). */
  readPixels(x: number, y: number, w: number, h: number): Uint8Array;
  bufferSize(): { width: number; height: number };
  loseContext?(restoreAfterMs: number | null): void;
  dispose(): void;
}
```

- [ ] **Step 3: `src/map/texture/shaders.ts` (GLSL ES 3.00)**

```ts
// The texture layer's shaders (Map styles spec §4 "WebGL path"). The inverse projections must stay identical to
// src/map/texture/inverse.ts, which the unit tests check against d3; an e2e test reads this shader's longitudes and
// latitudes back (uDebug) and checks them against d3 too.
export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
uniform vec2 uSize;
out vec2 vView;
void main() {
  // View units with the origin top-left and y down, exactly like the SVG viewBox.
  vView = vec2((aPos.x + 1.0) * 0.5 * uSize.x, (1.0 - aPos.y) * 0.5 * uSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
in vec2 vView;
out vec4 outColor;

const float PI = 3.141592653589793;
const float HALF_PI = 1.5707963267948966;
const float DEG = 0.017453292519943295;
const float EPS = 1e-6;
const float A1 = 1.340264;
const float A2 = -0.081106;
const float A3 = 0.000893;
const float A4 = 0.003796;
const float M = 0.8660254037844386;

uniform int uProjection;   // 0 grid, 1 equal earth, 2 mercator, 3 globe
uniform float uScale;      // d3 projection.scale()
uniform vec2 uOrigin;      // flat: projection([0, 0]); globe: projection.translate()
uniform vec2 uRotate;      // globe: rotate()[0..1] in radians
uniform float uMaxLat;     // radians
uniform float uViewPx;     // drawing-buffer pixels per view unit
uniform sampler2D uDay;    // whole-world equirectangular image, north at the top
uniform sampler2D uRegion; // Central Europe detail tile
uniform vec4 uRegionBox;   // west, south, east, north (radians)
uniform float uRegionMix;
uniform sampler2D uNight;  // Black Marble city lights
uniform int uNightOn;
uniform vec3 uSun;         // unit vector towards the point under the Sun
uniform int uLimb;
uniform int uGlow;
uniform int uDebug;

vec2 inverseProject(vec2 view, out bool ok, out float rho) {
  ok = true;
  rho = 0.0;
  float X = (view.x - uOrigin.x) / uScale;
  float Y = (uOrigin.y - view.y) / uScale;
  if (uProjection == 3) {
    float r2 = X * X + Y * Y;
    rho = sqrt(r2);
    if (r2 > 1.0) { ok = false; return vec2(0.0); }
    float xr = sqrt(1.0 - r2);
    float cp = cos(uRotate.y);
    float sp = sin(uRotate.y);
    float cx = xr * cp + Y * sp;
    float cy = X;
    float cz = Y * cp - xr * sp;
    float lambda = mod(atan(cy, cx) - uRotate.x + PI, 2.0 * PI) - PI;
    return vec2(lambda, asin(clamp(cz, -1.0, 1.0)));
  }
  vec2 ll;
  if (uProjection == 0) {
    ll = vec2(X, Y);
  } else if (uProjection == 2) {
    ll = vec2(X, 2.0 * atan(exp(Y)) - HALF_PI);
  } else {
    float l = Y;
    for (int i = 0; i < 12; i++) {
      float l2 = l * l;
      float l6 = l2 * l2 * l2;
      l -= (l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - Y) / (A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2));
    }
    float l2 = l * l;
    float l6 = l2 * l2 * l2;
    float s = sin(l) / M;
    if (abs(s) > 1.0) { ok = false; return vec2(0.0); }
    ll = vec2(M * X * (A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2)) / cos(l), asin(s));
  }
  if (abs(ll.x) > PI + EPS || abs(ll.y) > uMaxLat + EPS) ok = false;
  return ll;
}

void main() {
  bool ok;
  float rho;
  vec2 ll = inverseProject(vView, ok, rho);

  if (uDebug > 0) {
    float v = uDebug == 1 ? (ll.x + PI) / (2.0 * PI) : (ll.y + HALF_PI) / PI;
    float q = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5);
    outColor = ok ? vec4(floor(q / 256.0) / 255.0, mod(q, 256.0) / 255.0, 0.0, 1.0) : vec4(0.0);
    return;
  }

  // Texture coordinates and their screen derivatives, computed for every fragment (derivatives need uniform control
  // flow). The longitude derivative ignores the jump at the antimeridian, so mipmaps have no seam there.
  vec2 uv = vec2(ll.x / (2.0 * PI) + 0.5, 0.5 - ll.y / PI);
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  dx.x -= round(dx.x);
  dy.x -= round(dy.x);
  vec2 ruv = vec2((ll.x - uRegionBox.x) / (uRegionBox.z - uRegionBox.x), (uRegionBox.w - ll.y) / (uRegionBox.w - uRegionBox.y));
  vec2 rdx = dFdx(ruv);
  vec2 rdy = dFdy(ruv);

  if (!ok) {
    if (uProjection == 3 && uGlow == 1) {
      float t = 1.0 - (rho - 1.0) * uScale / 6.0; // 6 view units wide
      float a = 0.55 * clamp(t, 0.0, 1.0) * clamp(t, 0.0, 1.0);
      outColor = vec4(vec3(0.45, 0.70, 1.0) * a, a);
    } else {
      outColor = vec4(0.0);
    }
    return;
  }

  vec3 color = textureGrad(uDay, uv, dx, dy).rgb;
  if (uRegionMix > 0.0) {
    float edge = min(min(ll.x - uRegionBox.x, uRegionBox.z - ll.x), min(ll.y - uRegionBox.y, uRegionBox.w - ll.y));
    float w = smoothstep(0.0, 0.25 * DEG, edge) * uRegionMix;
    if (w > 0.0) color = mix(color, textureGrad(uRegion, ruv, rdx, rdy).rgb, w);
  }
  if (uNightOn == 1) {
    vec3 p = vec3(cos(ll.y) * cos(ll.x), cos(ll.y) * sin(ll.x), sin(ll.y));
    float altitude = asin(clamp(dot(p, uSun), -1.0, 1.0));
    float day = smoothstep(-6.0 * DEG, 0.0, altitude);
    vec3 night = min(textureGrad(uNight, uv, dx, dy).rgb * 1.15, vec3(1.0));
    color = mix(night, color, day);
  }
  float alpha = 1.0;
  if (uProjection == 3) {
    if (uLimb == 1) color *= mix(0.78, 1.0, pow(sqrt(max(0.0, 1.0 - rho * rho)), 0.35));
    alpha = clamp((1.0 - rho) * uScale * uViewPx + 0.5, 0.0, 1.0);
  }
  outColor = vec4(color * alpha, alpha);
}`;
```

- [ ] **Step 4: `src/map/texture/assets.ts`**

```ts
import manifest from '../data/textures/manifest.json';
import { testFlag } from '../../app/testMode';
import type { TextureStyle } from '../mapStyle';
import { RenderFailure, type StyleTextures } from './renderer';

/*
 * The embedded map textures (scripts/textures-plugin.ts puts each WebP into the page as base64 in a
 * <script type="application/x-geo-texture" id="geo-texture-<id>">). Decoded on first use, then kept for the page
 * session (spec §3 "Lazy decoding"), at most `maxSize` pixels along the longer edge.
 */
export type TextureId = keyof typeof manifest.textures;

export const STYLE_TEXTURES: Record<TextureStyle, { day: TextureId; region: TextureId; night: TextureId | null }> = {
  physical: { day: 'physical-world', region: 'physical-region', night: null },
  satellite: { day: 'satellite-day', region: 'satellite-region', night: 'satellite-night' },
};

export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function fitWithin(width: number, height: number, maxSize: number): { width: number; height: number } {
  const k = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

const cache = new Map<string, Promise<ImageBitmap>>();

export function loadTexture(id: TextureId, maxSize: number): Promise<ImageBitmap> {
  const key = `${id}@${maxSize}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      if (testFlag('gl') === 'decode-fail') throw new RenderFailure('decode', 'decoding switched off for a test');
      const block = document.getElementById(`geo-texture-${id}`);
      if (!block?.textContent) throw new RenderFailure('decode', `texture ${id} is missing from the page`);
      const t = manifest.textures[id];
      const size = fitWithin(t.width, t.height, maxSize);
      try {
        const blob = new Blob([decodeBase64(block.textContent)], { type: t.mime });
        return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none', ...(size.width < t.width ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' as const } : {}) });
      } catch (e) {
        throw new RenderFailure('decode', `texture ${id}: ${(e as Error).message}`);
      }
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export async function loadStyleTextures(style: TextureStyle, maxSize: number, withNight: boolean): Promise<StyleTextures> {
  const ids = STYLE_TEXTURES[style];
  const [day, region, night] = await Promise.all([
    loadTexture(ids.day, maxSize), loadTexture(ids.region, maxSize),
    withNight && ids.night ? loadTexture(ids.night, maxSize) : Promise.resolve(null),
  ]);
  return { day, region, night };
}
```
`decodeBase64` and `fitWithin` run in Node for the unit test; `loadTexture` is browser-only.

- [ ] **Step 5: `src/map/texture/webgl.ts`**

```ts
import { RAD } from '../geometry';
import { REGION } from '../world';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { RenderFailure, type DrawInputs, type StyleTextures, type TextureRenderer } from './renderer';

const UNIFORMS = ['uSize', 'uProjection', 'uScale', 'uOrigin', 'uRotate', 'uMaxLat', 'uViewPx', 'uDay', 'uRegion', 'uRegionBox', 'uRegionMix', 'uNight', 'uNightOn', 'uSun', 'uLimb', 'uGlow', 'uDebug'] as const;
type Uniform = (typeof UNIFORMS)[number];

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new RenderFailure('shader', 'createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? 'compile failed';
    gl.deleteShader(shader);
    throw new RenderFailure('shader', log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new RenderFailure('shader', 'createProgram failed');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new RenderFailure('shader', gl.getProgramInfoLog(program) ?? 'link failed');
  return program;
}

function checkError(gl: WebGL2RenderingContext, what: string): void {
  const err = gl.getError();
  if (err === gl.NO_ERROR || gl.isContextLost()) return;
  if (err === gl.OUT_OF_MEMORY) throw new RenderFailure('oom', `out of GPU memory: ${what}`);
  throw new RenderFailure('render', `WebGL error ${err}: ${what}`);
}

/**
 * The WebGL 2 texture renderer. `forced` is the `?test&gl=` switch: 'off' (no WebGL), 'shader-fail',
 * 'small-textures' (MAX_TEXTURE_SIZE reported as 2048), 'render-fail' (the first draw throws).
 */
export function createWebGLRenderer(canvas: HTMLCanvasElement, forced: string | null): TextureRenderer {
  if (forced === 'off') throw new RenderFailure('no-webgl', 'WebGL switched off for a test');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new RenderFailure('no-webgl', 'WebGL 2 is not available');
  const high = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  if (!high || high.precision < 16) throw new RenderFailure('no-webgl', 'no high-precision floats in fragment shaders');
  const program = link(gl, forced === 'shader-fail' ? FRAGMENT_SHADER.replace('void main()', 'void main(int broken)') : FRAGMENT_SHADER);
  const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<Uniform, WebGLUniformLocation | null>;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const maxTextureSize = forced === 'small-textures' ? 2048 : (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  let textures: { day: WebGLTexture; region: WebGLTexture; night: WebGLTexture | null } | null = null;
  let failNextDraw = forced === 'render-fail';

  const upload = (bmp: ImageBitmap, repeat: boolean): WebGLTexture => {
    const tex = gl.createTexture();
    if (!tex) throw new RenderFailure('render', 'createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    checkError(gl, 'texImage2D');
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    checkError(gl, 'mipmaps');
    return tex;
  };
  const freeTextures = () => {
    if (!textures) return;
    gl.deleteTexture(textures.day); gl.deleteTexture(textures.region);
    if (textures.night) gl.deleteTexture(textures.night);
    textures = null;
  };

  return {
    tier: 'webgl',
    maxTextureSize,
    resize(cssWidth, cssHeight, dpr) {
      const k = Math.min(2, Math.max(1, dpr));
      const w = Math.max(1, Math.round(cssWidth * k)), h = Math.max(1, Math.round(cssHeight * k));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    },
    setTextures(t: StyleTextures) {
      if (Math.max(t.day.width, t.day.height) > maxTextureSize) throw new RenderFailure('texture-size', `texture ${t.day.width} px > MAX_TEXTURE_SIZE ${maxTextureSize}`);
      freeTextures();
      textures = { day: upload(t.day, true), region: upload(t.region, false), night: t.night ? upload(t.night, true) : null };
    },
    draw(input: DrawInputs) {
      if (gl.isContextLost() || !textures) return;
      if (failNextDraw) { failNextDraw = false; throw new RenderFailure('render', 'draw failure forced for a test'); }
      const v = input.view;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(u.uSize, v.width, v.height);
      gl.uniform1i(u.uProjection, v.projection);
      gl.uniform1f(u.uScale, v.scale);
      gl.uniform2f(u.uOrigin, v.origin[0], v.origin[1]);
      gl.uniform2f(u.uRotate, v.rotate[0], v.rotate[1]);
      gl.uniform1f(u.uMaxLat, v.maxLat);
      gl.uniform1f(u.uViewPx, canvas.width / v.width);
      gl.uniform4f(u.uRegionBox, REGION.west * RAD, REGION.south * RAD, REGION.east * RAD, REGION.north * RAD);
      gl.uniform1f(u.uRegionMix, input.regionMix);
      const night = input.night && textures.night ? input.night : null;
      gl.uniform1i(u.uNightOn, night ? 1 : 0);
      gl.uniform3f(u.uSun, night?.x ?? 0, night?.y ?? 0, night?.z ?? 1);
      gl.uniform1i(u.uLimb, input.limb ? 1 : 0);
      gl.uniform1i(u.uGlow, input.glow ? 1 : 0);
      gl.uniform1i(u.uDebug, input.debug);
      const bind = (unit: number, tex: WebGLTexture, name: Uniform) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); };
      bind(0, textures.day, 'uDay');
      bind(1, textures.region, 'uRegion');
      bind(2, textures.night ?? textures.day, 'uNight');
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      checkError(gl, 'draw');
    },
    readPixels(x, y, w, h) {
      const flipped = new Uint8Array(w * h * 4);
      gl.readPixels(x, canvas.height - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, flipped);
      const out = new Uint8Array(w * h * 4);
      for (let row = 0; row < h; row++) out.set(flipped.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
      return out;
    },
    bufferSize: () => ({ width: canvas.width, height: canvas.height }),
    loseContext(restoreAfterMs) {
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
      if (ext && restoreAfterMs !== null) setTimeout(() => ext.restoreContext(), restoreAfterMs);
    },
    dispose() {
      if (!gl.isContextLost()) { freeTextures(); gl.deleteBuffer(quad); gl.deleteVertexArray(vao); gl.deleteProgram(program); }
    },
  };
}
```

- [ ] **Step 6: `src/map/texture/testHooks.ts`**

```ts
import type { ViewCtx } from '../geometry';
import { renderHealth } from './health.svelte';
import type { DrawInputs, TextureRenderer } from './renderer';

/*
 * window.__mapTextures in test mode (exposed by src/main.ts): the render tier, pixel probes of what a view's texture
 * layer draws, and the shader's own longitudes/latitudes for comparison with d3 (tests/e2e/texture-webgl.spec.ts).
 */
export interface TextureViewHandle { renderer(): TextureRenderer | null; input(): DrawInputs | null; ctx(): ViewCtx; drawCount(): number }
export interface ProbeResult { avg: [number, number, number]; maxSum: number }

const handles = new Map<'flat' | 'globe', TextureViewHandle>();

export function registerTextureView(view: 'flat' | 'globe', handle: TextureViewHandle): () => void {
  handles.set(view, handle);
  return () => { if (handles.get(view) === handle) handles.delete(view); };
}

function ready(view: 'flat' | 'globe') {
  const h = handles.get(view);
  const r = h?.renderer(), input = h?.input();
  return h && r && input ? { h, r, input } : null;
}

export const textureTestHooks = {
  tier: () => renderHealth.state.tier,
  health: () => JSON.parse(JSON.stringify({ ...renderHealth.state, ready: renderHealth.ready })) as unknown,
  drawCount: (view: 'flat' | 'globe') => handles.get(view)?.drawCount() ?? 0,
  /** Mean colour and brightest pixel (r+g+b) within `radius` CSS px of a place, as drawn by the texture layer. */
  probe(view: 'flat' | 'globe', lat: number, lon: number, radius = 2): ProbeResult | null {
    const s = ready(view);
    const xy = s?.h.ctx().project({ lat, lon });
    if (!s || !xy) return null;
    s.r.draw(s.input);
    const { width, height } = s.r.bufferSize();
    const kx = width / s.input.view.width, ky = height / s.input.view.height;
    const rad = Math.max(1, Math.round(radius * (width / (s.input.view.width / s.h.ctx().px))));
    const x0 = Math.max(0, Math.round(xy[0] * kx) - rad), y0 = Math.max(0, Math.round(xy[1] * ky) - rad);
    const w = Math.min(width - x0, 2 * rad + 1), h = Math.min(height - y0, 2 * rad + 1);
    const px = s.r.readPixels(x0, y0, w, h);
    const sum: [number, number, number] = [0, 0, 0];
    let n = 0, maxSum = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      sum[0] += px[i]!; sum[1] += px[i + 1]!; sum[2] += px[i + 2]!; n++;
      maxSum = Math.max(maxSum, px[i]! + px[i + 1]! + px[i + 2]!);
    }
    return n ? { avg: [sum[0] / n, sum[1] / n, sum[2] / n], maxSum } : null;
  },
  /** For view points (view units): the drawing-buffer pixel each falls in, its centre in view units and the shader's lon/lat there. */
  debugCoords(view: 'flat' | 'globe', points: [number, number][]) {
    const s = ready(view);
    if (!s || s.r.tier !== 'webgl') return [];
    const { width, height } = s.r.bufferSize();
    const read = (debug: 1 | 2) => {
      s.r.draw({ ...s.input, debug });
      return points.map(([x, y]) => {
        const i = Math.min(width - 1, Math.floor((x * width) / s.input.view.width)), j = Math.min(height - 1, Math.floor((y * height) / s.input.view.height));
        const p = s.r.readPixels(i, j, 1, 1);
        return { i, j, alpha: p[3]!, value: (p[0]! * 256 + p[1]!) / 65535 };
      });
    };
    const lon = read(1), lat = read(2);
    s.r.draw(s.input);
    return lon.map((a, k) => a.alpha === 0 ? null : {
      x: ((a.i + 0.5) * s.input.view.width) / width, y: ((a.j + 0.5) * s.input.view.height) / height,
      lon: a.value * 360 - 180, lat: lat[k]!.value * 180 - 90,
    });
  },
  loseContext(view: 'flat' | 'globe', restoreAfterMs: number | null) {
    handles.get(view)?.renderer()?.loseContext?.(restoreAfterMs);
  },
};
```
In `src/main.ts` add `import { textureTestHooks } from './map/texture/testHooks';` and `expose('__mapTextures', textureTestHooks);` next to the other `expose` calls.

- [ ] **Step 7: `src/map/texture/TextureLayer.svelte` (WebGL tier; Task 8 adds the canvas tier, context loss and printing)**

```svelte
<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { isTextureStyle, type TextureStyle } from '../mapStyle';
  import { REGION, REGION_MIN_ZOOM } from '../world';
  import { loadStyleTextures } from './assets';
  import { markReady, renderHealth, reportHealth } from './health.svelte';
  import { regionMix } from './inverse';
  import { RenderFailure, type DrawInputs, type TextureRenderer } from './renderer';
  import { registerTextureView } from './testHooks';
  import { textureView } from './viewParams';
  import { createWebGLRenderer } from './webgl';

  // Physical and Satellite under the SVG of an interactive flat map or globe (Map styles spec §4). Only the shared
  // `mapState` (never a worksheet's StaticMap): paper stays Atlas.
  let { ctx, view }: { ctx: ViewCtx; view: 'flat' | 'globe' } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let cssWidth = $state(0);
  let cssHeight = $state(0);
  let renderer = $state.raw<TextureRenderer | null>(null);
  let loaded = $state<TextureStyle | null>(null);
  let draws = 0;
  let lastInput: DrawInputs | null = null;

  const style = $derived(mapState.mapStyle);
  const tier = $derived(renderHealth.state.tier);
  const active = $derived(isTextureStyle(style) && tier === 'webgl');

  function fail(e: unknown): void {
    console.warn(`map texture (${view}):`, e);
    reportHealth({ type: 'fail', reason: e instanceof RenderFailure ? e.reason : 'render' });
  }

  $effect(() => registerTextureView(view, { renderer: () => renderer, input: () => lastInput, ctx: () => ctx, drawCount: () => draws }));

  // 1. A renderer while a texture style is active.
  $effect(() => {
    const c = canvas;
    if (!c || !active) return;
    let r: TextureRenderer;
    try { r = createWebGLRenderer(c, testFlag('gl')); } catch (e) { fail(e); return; }
    renderer = r;
    return () => { r.dispose(); renderer = null; loaded = null; };
  });

  // 2. The style's images (decoded once per page, shared by both views), no larger than the device allows.
  $effect(() => {
    const r = renderer, s = style, max = renderHealth.state.maxTexture;
    if (!r || !isTextureStyle(s)) return;
    if (r.maxTextureSize < max) { reportHealth({ type: 'fail', reason: 'texture-size' }); return; }
    let cancelled = false;
    renderHealth.loading = s;
    loadStyleTextures(s, max, false).then(
      (t) => { if (cancelled) return; try { r.setTextures(t); loaded = s; markReady(s); } catch (e) { fail(e); } },
      (e) => { if (!cancelled) fail(e); },
    ).finally(() => { if (renderHealth.loading === s) renderHealth.loading = null; });
    return () => { cancelled = true; };
  });

  // 3. Draw whenever the view, the style or the size changes, at most once a frame.
  $effect(() => {
    const r = renderer;
    if (!r || loaded !== style || !isTextureStyle(style)) return;
    const v = textureView(ctx);
    const input: DrawInputs = { view: v, regionMix: regionMix(v, REGION, REGION_MIN_ZOOM), night: null, limb: v.projection === 3, glow: style === 'satellite' && v.projection === 3, quality: 'full', debug: 0 };
    const w = cssWidth, h = cssHeight;
    const frame = requestAnimationFrame(() => {
      try { r.resize(w, h, devicePixelRatio); r.draw(input); lastInput = input; draws++; } catch (e) { fail(e); }
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

{#if isTextureStyle(style) && tier !== 'atlas'}
  <canvas class="texture" class:ready={loaded === style} bind:this={canvas} bind:clientWidth={cssWidth} bind:clientHeight={cssHeight} data-tier={tier} aria-hidden="true"></canvas>
{/if}

<style>
  .texture { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; opacity: 0; }
  .texture.ready { opacity: 1; }
</style>
```

- [ ] **Step 8: Mount the layer and hide the Atlas surfaces under it**

`src/map/FlatMap.svelte`:
- import `TextureLayer from './texture/TextureLayer.svelte'`;
- the frame becomes `<div class="frame" bind:clientWidth data-map-style={mapState.drawnMapStyle}>` with `<TextureLayer {ctx} view="flat" />` as its first child, before `<svg>`;
- CSS: `.frame { position: relative; … }` (add to the existing rule), `svg { position: relative; … }` (add to the existing rule), and `.frame[data-map-style='satellite'] { background: #04070d; }`.

`src/map/Globe.svelte`: the same with `view="globe"` (`.frame { position: relative; … }`, `svg { position: relative; … }`).

`src/map/layers/Land.svelte`:
```ts
  import type { MapStyle } from '../mapStyle';
  let { ctx, style = 'atlas' }: { ctx: ViewCtx; style?: MapStyle } = $props();
  // Atlas draws the sea, land, lakes, rivers and coasts; texture styles show their image instead and keep only the borders.
  const surface = $derived(style === 'atlas');
```
Wrap `<path class="ocean" …/>` and `<path class="land" …/>` in `{#if surface}…{/if}`. In the `region` block keep the `<g class="region" data-detail="central-europe">` wrapper, wrap `mask`, `region-land`, `lakes`, the rivers `{#each}` and `coast` in `{#if surface}…{/if}`, and leave `voivodeships` and `borders` unconditional. Compute `region.mask/land/lakes/coast/rivers` only when `surface` (return empty strings otherwise) so hidden paths cost nothing. Atlas markup must come out exactly as before.

`src/map/layers/Layers.svelte`:
```ts
  import { isTextureStyle } from '../mapStyle';
  const style = $derived(mapState.drawnMapStyle);
```
`<Land {ctx} {style} />`; the globe's sphere shading becomes `{#if ctx.kind === 'globe' && !isTextureStyle(style)}` (the shader draws its own limb shading). Nothing else changes.

- [ ] **Step 9: E2E helpers**

Append to `tests/e2e/helpers.ts`:
```ts
type Win = { __mapState: { chooseMapStyle(s: string): void; mapStyle: string; drawnMapStyle: string }; __mapTextures: { tier(): string; health(): unknown; drawCount(v: string): number; probe(v: string, lat: number, lon: number, r?: number): { avg: [number, number, number]; maxSum: number } | null; debugCoords(v: string, p: [number, number][]): ({ x: number; y: number; lon: number; lat: number } | null)[]; loseContext(v: string, ms: number | null): void } };

/** Chooses a map style through MapState (the page must be opened with ?test). */
export async function setMapStyle(page: Page, style: 'atlas' | 'physical' | 'satellite' | 'political'): Promise<void> {
  await page.evaluate((s) => (window as unknown as Win).__mapState.chooseMapStyle(s), style);
}

/** Waits until a view's texture layer has drawn at least `draws` frames of the chosen texture style. */
export async function waitForTexture(page: Page, view: 'flat' | 'globe', draws = 1): Promise<void> {
  await expect.poll(() => page.evaluate((v) => (window as unknown as Win).__mapTextures.drawCount(v), view), { timeout: 15_000 }).toBeGreaterThanOrEqual(draws);
}

export function probe(page: Page, view: 'flat' | 'globe', lat: number, lon: number, radius = 2) {
  return page.evaluate(([v, la, lo, r]) => (window as unknown as Win).__mapTextures.probe(v as string, la as number, lo as number, r as number), [view, lat, lon, radius] as const);
}

export function textureHooks(page: Page) {
  return {
    tier: () => page.evaluate(() => (window as unknown as Win).__mapTextures.tier()),
    health: () => page.evaluate(() => (window as unknown as Win).__mapTextures.health()),
    debugCoords: (view: 'flat' | 'globe', points: [number, number][]) => page.evaluate(([v, p]) => (window as unknown as Win).__mapTextures.debugCoords(v, p), [view, points] as const),
    loseContext: (view: 'flat' | 'globe', ms: number | null) => page.evaluate(([v, m]) => (window as unknown as Win).__mapTextures.loseContext(v, m), [view, ms] as const),
  };
}
```

- [ ] **Step 10: E2E `tests/e2e/texture-webgl.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { expectNoAxeViolations, openPage, pageErrors, probe, setMapStyle, textureHooks, waitForTexture } from './helpers';

type S = { flat: { center: { lat: number; lon: number }; zoom: number }; flatProjection: 'grid' | 'equal-earth' | 'mercator'; rotate: [number, number]; globeZoom: number; setFlatView(c: { lat: number; lon: number }, z: number): void; chooseProjection(p: string): void };
const state = (page: import('@playwright/test').Page) => page.evaluate(() => { const s = (window as unknown as { __mapState: S }).__mapState; return { flat: s.flat, projection: s.flatProjection, rotate: s.rotate, globeZoom: s.globeZoom }; });

test('the shader\'s inverse projections match d3 to 0.01° on every projection and the globe', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await waitForTexture(page, 'globe');
  const hooks = textureHooks(page);
  const pts = (w: number, h: number): [number, number][] => Array.from({ length: 9 * 5 }, (_, k) => [((k % 9) + 0.37) * (w / 9), (Math.floor(k / 9) + 0.61) * (h / 5)]);
  for (const projection of ['grid', 'equal-earth', 'mercator'] as const) {
    for (const [center, zoom] of [[{ lat: 0, lon: 0 }, 1], [{ lat: 50.26, lon: 19.02 }, 9], [{ lat: 60, lon: 170 }, 2.5]] as const) {
      await page.evaluate(([p, c, z]) => { const s = (window as unknown as { __mapState: S }).__mapState; s.chooseProjection(p as string); s.setFlatView(c as { lat: number; lon: number }, z as number); }, [projection, center, zoom] as const);
      await page.waitForTimeout(150);
      const st = await state(page);
      const ctx = makeFlatCtx(960, 480, st.flat.center, st.flat.zoom, 1, st.projection);
      const got = await hooks.debugCoords('flat', pts(960, 480));
      let compared = 0;
      for (const g of got) {
        const d3 = g && ctx.invert([g.x, g.y]);
        if (!g || !d3) continue;
        compared++;
        expect(Math.abs(g.lat - d3.lat), `${projection} lat at ${g.x},${g.y}`).toBeLessThanOrEqual(0.01);
        expect(Math.abs(((g.lon - d3.lon + 540) % 360) - 180), `${projection} lon at ${g.x},${g.y}`).toBeLessThanOrEqual(0.01);
      }
      expect(compared, `${projection} ${zoom}`).toBeGreaterThan(20);
    }
  }
  for (const [rotate, zoom] of [[[-19, -50], 1], [[170, 30], 3], [[0, -90], 1]] as const) {
    await page.evaluate(([r, z]) => { const s = (window as unknown as { __mapState: S }).__mapState; s.rotate = r as [number, number]; s.globeZoom = z as number; }, [rotate, zoom] as const);
    await page.waitForTimeout(150);
    const st = await state(page);
    const ctx = makeGlobeCtx(500, st.rotate, 1, st.globeZoom);
    const got = await hooks.debugCoords('globe', pts(500, 500));
    for (const g of got) {
      const d3 = g && ctx.invert([g.x, g.y]);
      if (!g || !d3 || Math.abs(d3.lat) > 89.9) continue;
      expect(Math.abs(g.lat - d3.lat)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(((g.lon - d3.lon + 540) % 360) - 180) * Math.cos((d3.lat * Math.PI) / 180)).toBeLessThanOrEqual(0.01);
    }
  }
  expect(pageErrors(page)).toEqual([]);
});

test('Physical: colour probes on the flat map and the globe; Atlas land is hidden under it', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await waitForTexture(page, 'globe');
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'physical');
  await expect(page.locator('.view-flat path.land')).toHaveCount(0);
  await expect(page.locator('.view-flat path.borders').first()).toBeAttached();
  // HYP_50M_SR_W samples measured while planning: Sahara (201,192,173), Baltic (207,225,242).
  const sahara = (await probe(page, 'flat', 23, 12))!;
  expect(sahara.avg[0]).toBeGreaterThan(sahara.avg[2] + 15);
  const baltic = (await probe(page, 'flat', 56.5, 19))!;
  expect(baltic.avg[2]).toBeGreaterThan(baltic.avg[0] + 15);
  await page.evaluate(() => { (window as unknown as { __mapState: S }).__mapState.rotate = [-12, -23]; });
  await page.waitForTimeout(200);
  const globeSahara = (await probe(page, 'globe', 23, 12))!;
  expect(globeSahara.avg[0]).toBeGreaterThan(globeSahara.avg[2] + 15);
  // Deep zoom over the Tatras: the detail tile shows relief (tan) where the Kraków lowland is green.
  await page.evaluate(() => (window as unknown as { __mapState: S }).__mapState.setFlatView({ lat: 49.6, lon: 20 }, 12));
  await page.waitForTimeout(250);
  const tatra = (await probe(page, 'flat', 49.2, 20.0))!;
  const lowland = (await probe(page, 'flat', 50.06, 19.94))!;
  expect(tatra.avg[0]).toBeGreaterThanOrEqual(tatra.avg[1] - 5);
  expect(lowland.avg[1]).toBeGreaterThan(lowland.avg[0] + 10);
  await expectNoAxeViolations(page, 'lab physical');
  expect(pageErrors(page)).toEqual([]);
});

test('Satellite (day): Blue Marble colours; Mercator and Equal Earth leave the outside of the world empty', async ({ page }) => {
  await openPage(page, 'en/topic-9/explore/3', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  const sahara = (await probe(page, 'flat', 23, 12))!;       // (199,160,111)
  expect(sahara.avg[0]).toBeGreaterThan(sahara.avg[2] + 50);
  const baltic = (await probe(page, 'flat', 56.5, 19))!;     // (27,69,127)
  expect(baltic.avg[2]).toBeGreaterThan(baltic.avg[0] + 50);
  expect(await probe(page, 'flat', 86, 0)).toBeNull();        // beyond Mercator's 85°
  expect(pageErrors(page)).toEqual([]);
});

test('a device that allows only 2048 px textures still draws with WebGL, from smaller images', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&gl=small-textures');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  expect(await textureHooks(page).health()).toMatchObject({ tier: 'webgl', maxTexture: 2048 });
  expect((await probe(page, 'flat', 23, 12))!.avg[0]).toBeGreaterThan(100);
});

test('Atlas draws no canvas at all', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('canvas.texture')).toHaveCount(0);
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'atlas');
});
```
The `probe` for 86°N returns null because `ctx.project` returns null beyond Mercator's 85°.

- [ ] **Step 11: Run**

```bash
npx vitest run tests/unit/texture-assets.test.ts
npm run check && npm test
npm run build && npx playwright test tests/e2e/texture-webgl.spec.ts tests/e2e/atlas-baseline.spec.ts tests/e2e/map.spec.ts tests/e2e/lab.spec.ts tests/e2e/offline.spec.ts
```
Expected: all PASS. If the shader fails to compile, `console.warn` in the page shows the info log; read it with `page.on('console')`. If a probe comes back null, the view was not drawn yet: raise the wait, do not loosen colour bounds.

- [ ] **Step 12: Look at it**

With `npm run build`, open `file://…/dist/geo-coordinates.html?test#en/lab` in the Playwright MCP browser or use a small script: choose Physical and Satellite through `__mapState.chooseMapStyle`, zoom into Katowice (`setFlatView({lat:50.26,lon:19.02},12)`) and screenshot at 1366×768. Check: grid, borders and labels line up with the image (the Vistula, the Baltic coast, the Alps); no seam at the 180° meridian on the globe (rotate `[180, 0]`); the detail tile blends without a visible box edge.

- [ ] **Step 13: Commit**

```bash
git add src/map/texture src/map/FlatMap.svelte src/map/Globe.svelte src/map/layers/Layers.svelte src/map/layers/Land.svelte src/main.ts tests/unit/texture-assets.test.ts tests/e2e/helpers.ts tests/e2e/texture-webgl.spec.ts
git commit -m "feat(map): WebGL texture layer for the Physical and Satellite styles"
```

---

### Task 8: Canvas fallback, context loss, error → Atlas

The rest of the fallback chain: a CPU canvas renderer with the same math, WebGL context loss and restore, every failure trigger moving down the chain, the "showing Atlas" note, and print snapshots.

**Files:**
- Create: `src/map/texture/cpuShade.ts`, `src/map/texture/canvas2d.ts`, `src/map/MapStyleNote.svelte`
- Modify: `src/map/texture/TextureLayer.svelte`, `src/map/MapStage.svelte`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`
- Test: `tests/unit/cpu-shade.test.ts`, `tests/e2e/texture-fallback.spec.ts`

**Interfaces:**
- Consumes: `inverseProject`, `TextureView` (Task 6); `DrawInputs`, `StyleTextures`, `TextureRenderer`, `RenderFailure` (Task 7); `fitWithin`, `loadStyleTextures` (Task 7); `renderHealth`, `reportHealth` (Task 5); `styleUnavailable` (Task 5); `testFlag`; test hooks and e2e helpers from Task 7 (`setMapStyle`, `waitForTexture`, `probe`, `textureHooks`).
- Produces:
  ```ts
  // cpuShade.ts
  export interface Sampled { width: number; height: number; data: Uint8ClampedArray }   // RGBA rows top-down
  export interface CpuTextures { day: Sampled; region: Sampled; night: Sampled | null }
  export function shadePixel(input: DrawInputs, t: CpuTextures, x: number, y: number, out: Uint8ClampedArray, at: number): void; // premultiplied RGBA into out[at..at+3]
  // canvas2d.ts
  export function createCanvasRenderer(canvas: HTMLCanvasElement, forced: string | null): TextureRenderer;  // forced: 'off' | 'render-fail'
  // MapStyleNote.svelte: no props; shows t('map.style.fallback') when styleUnavailable(mapState.chosenMapStyle, renderHealth.state)
  // i18n key: map.style.fallback
  // Test-mode URL switches: gl=off|shader-fail|small-textures|render-fail|decode-fail, canvas=off|render-fail, glRestoreMs=<ms>
  ```

- [ ] **Step 1: Failing test `tests/unit/cpu-shade.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { REGION, REGION_MIN_ZOOM } from '../../src/map/world';
import { shadePixel, type Sampled } from '../../src/map/texture/cpuShade';
import { regionMix } from '../../src/map/texture/inverse';
import { sunVector, type DrawInputs } from '../../src/map/texture/renderer';
import { textureView } from '../../src/map/texture/viewParams';

const solid = (w: number, h: number, f: (x: number, y: number) => [number, number, number]): Sampled => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = f(x, y); data.set([r, g, b, 255], (y * w + x) * 4); }
  return { width: w, height: h, data };
};
const px = (input: DrawInputs, t: Parameters<typeof shadePixel>[1], x: number, y: number) => { const out = new Uint8ClampedArray(4); shadePixel(input, t, x, y, out, 0); return [...out]; };
const inputFor = (ctx: ReturnType<typeof makeFlatCtx>, extra: Partial<DrawInputs> = {}): DrawInputs => {
  const view = textureView(ctx);
  return { view, regionMix: regionMix(view, REGION, REGION_MIN_ZOOM), night: null, limb: false, glow: false, quality: 'full', debug: 0, ...extra };
};

describe('the canvas path shades pixels like the shader', () => {
  const westRedEastBlue = solid(64, 32, (x) => (x < 32 ? [255, 0, 0] : [0, 0, 255]));
  const black = solid(8, 4, () => [0, 0, 0]);
  const white = solid(8, 4, () => [255, 255, 255]);

  test('samples the world image where the pixel is (western hemisphere red, eastern blue)', () => {
    const input = inputFor(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid'));
    expect(px(input, { day: westRedEastBlue, region: black, night: null }, 240, 240)).toEqual([255, 0, 0, 255]);
    expect(px(input, { day: westRedEastBlue, region: black, night: null }, 720, 240)).toEqual([0, 0, 255, 255]);
  });

  test('blends the detail tile inside Central Europe from zoom 4, softly at its edge', () => {
    const t = { day: black, region: white, night: null };
    const inside = inputFor(makeFlatCtx(960, 480, { lat: 51, lon: 20 }, 9, 1, 'grid'));
    expect(px(inside, t, 480, 240)[0]).toBe(255);
    const low = inputFor(makeFlatCtx(960, 480, { lat: 51, lon: 20 }, 3.5, 1, 'grid'));
    expect(px(low, t, 480, 240)[0]).toBe(0);
    const ctx = makeFlatCtx(960, 480, { lat: 51, lon: 8 }, 40, 1, 'grid');
    const x = ctx.project({ lat: 51, lon: 8.1 })![0];
    const edge = px(inputFor(ctx), t, x, 240)[0]!;
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  test('outside the world is transparent; the Satellite globe glows just past its rim', () => {
    const t = { day: white, region: black, night: null };
    expect(px(inputFor(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth')), t, 2, 2)).toEqual([0, 0, 0, 0]);
    const globe = makeGlobeCtx(500, [0, 0], 1, 1); // rim at radius 244
    const g = { ...inputFor(globe as never), limb: true, glow: true };
    expect(px(g, t, 250 + 246, 250)[3]).toBeGreaterThan(0);
    expect(px(g, t, 250 + 251, 250)[3]).toBe(0);
    const centre = px(g, t, 250, 250), nearRim = px(g, t, 250 - 240, 250);
    expect(centre[0]!).toBe(255);
    expect(nearRim[0]!).toBeLessThan(240); // limb shading: 0.78–1.0 of the colour
  });

  test('day and night blend across a twilight band from 0° to −6°', () => {
    const t = { day: white, region: black, night: black };
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid');
    const input = inputFor(ctx, { night: sunVector({ lat: 0, lon: 0 }) });
    const at = (lon: number) => px(input, t, ctx.project({ lat: 0, lon })![0], 240)[0]!;
    expect(at(0)).toBe(255);          // Sun overhead
    expect(at(89)).toBe(255);         // Sun 1° up
    expect(at(93)).toBeGreaterThan(0); // Sun 3° down: twilight
    expect(at(93)).toBeLessThan(255);
    expect(at(97)).toBe(0);           // Sun 7° down: night
  });
});
```
Run: `npx vitest run tests/unit/cpu-shade.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/map/texture/cpuShade.ts` (the shader's `main`, on the CPU)**

```ts
import { RAD } from '../geometry';
import { REGION } from '../world';
import { inverseProject } from './inverse';
import type { DrawInputs } from './renderer';

export interface Sampled { width: number; height: number; data: Uint8ClampedArray }
export interface CpuTextures { day: Sampled; region: Sampled; night: Sampled | null }

const W = REGION.west * RAD, S = REGION.south * RAD, E = REGION.east * RAD, N = REGION.north * RAD;
const FEATHER = 0.25 * RAD;
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Bilinear sample at texture coordinates (u, v) ∈ [0, 1]², wrapping u when `wrap`, into rgb[0..2]. */
function sample(s: Sampled, u: number, v: number, wrap: boolean, rgb: Float64Array): void {
  const fx = u * s.width - 0.5, fy = Math.max(0, Math.min(s.height - 1, v * s.height - 0.5));
  let x0 = Math.floor(fx);
  const y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let x1 = x0 + 1;
  const y1 = Math.min(s.height - 1, y0 + 1);
  if (wrap) { x0 = ((x0 % s.width) + s.width) % s.width; x1 = ((x1 % s.width) + s.width) % s.width; }
  else { x0 = Math.max(0, Math.min(s.width - 1, x0)); x1 = Math.max(0, Math.min(s.width - 1, x1)); }
  for (let c = 0; c < 3; c++) {
    const a = s.data[(y0 * s.width + x0) * 4 + c]!, b = s.data[(y0 * s.width + x1) * 4 + c]!;
    const d = s.data[(y1 * s.width + x0) * 4 + c]!, e = s.data[(y1 * s.width + x1) * 4 + c]!;
    rgb[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }
}

const day = new Float64Array(3), other = new Float64Array(3);

export function shadePixel(input: DrawInputs, t: CpuTextures, x: number, y: number, out: Uint8ClampedArray, at: number): void {
  const v = input.view;
  const inv = inverseProject(v, x, y);
  if (!inv) {
    let a = 0;
    if (v.projection === 3 && input.glow) {
      const rho = Math.hypot(x - v.origin[0], y - v.origin[1]) / v.scale;
      const k = Math.max(0, Math.min(1, 1 - ((rho - 1) * v.scale) / 6));
      a = 0.55 * k * k;
    }
    out[at] = 0.45 * a * 255; out[at + 1] = 0.7 * a * 255; out[at + 2] = a * 255; out[at + 3] = a * 255;
    return;
  }
  const { lambda, phi, rho } = inv;
  const u = lambda / (2 * Math.PI) + 0.5, vv = 0.5 - phi / Math.PI;
  sample(t.day, u, vv, true, day);
  if (input.regionMix > 0) {
    const edge = Math.min(lambda - W, E - lambda, phi - S, N - phi);
    const w = smooth(0, FEATHER, edge) * input.regionMix;
    if (w > 0) {
      sample(t.region, (lambda - W) / (E - W), (N - phi) / (N - S), false, other);
      for (let c = 0; c < 3; c++) day[c] = day[c]! * (1 - w) + other[c]! * w;
    }
  }
  if (input.night && t.night) {
    const s = input.night;
    const dot = Math.cos(phi) * Math.cos(lambda) * s.x + Math.cos(phi) * Math.sin(lambda) * s.y + Math.sin(phi) * s.z;
    const w = smooth(-6 * RAD, 0, Math.asin(Math.max(-1, Math.min(1, dot))));
    sample(t.night, u, vv, true, other);
    for (let c = 0; c < 3; c++) day[c] = Math.min(255, other[c]! * 1.15) * (1 - w) + day[c]! * w;
  }
  let alpha = 1;
  if (v.projection === 3) {
    if (input.limb) { const k = 0.78 + 0.22 * Math.pow(Math.sqrt(Math.max(0, 1 - rho * rho)), 0.35); for (let c = 0; c < 3; c++) day[c] = day[c]! * k; }
    alpha = Math.max(0, Math.min(1, (1 - rho) * v.scale + 0.5));
  }
  out[at] = day[0]! * alpha; out[at + 1] = day[1]! * alpha; out[at + 2] = day[2]! * alpha; out[at + 3] = alpha * 255;
}
```
Keep this function and `FRAGMENT_SHADER` in step: any change to one is made to the other in the same commit. (Canvas `ImageData` is not premultiplied; `putImageData` treats it as straight alpha, so the rim anti-aliasing is slightly darker than on WebGL — acceptable, it is one pixel.)

Run: `npx vitest run tests/unit/cpu-shade.test.ts` — Expected: PASS (4 tests). The edge-pixel alpha on the globe uses view units (`uViewPx` is not needed on the CPU because the canvas path shades at view-unit resolution scaled to the buffer).

- [ ] **Step 3: Implement `src/map/texture/canvas2d.ts`**

```ts
import { fitWithin } from './assets';
import { shadePixel, type CpuTextures, type Sampled } from './cpuShade';
import { RenderFailure, type DrawInputs, type StyleTextures, type TextureRenderer } from './renderer';

/** Pixels of an image, at most `max` wide (the CPU path samples 2048 px textures). */
function sampled(bmp: ImageBitmap, max: number): Sampled {
  const { width, height } = fitWithin(bmp.width, bmp.height, max);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new RenderFailure('no-canvas', 'no 2D context for texture pixels');
  try {
    g.drawImage(bmp, 0, 0, width, height);
    return { width, height, data: g.getImageData(0, 0, width, height).data };
  } catch (e) {
    throw new RenderFailure('oom', `texture pixels: ${(e as Error).message}`);
  }
}

/** Map styles spec §4 "Canvas 2D fallback: same math on the CPU; reduced resolution while dragging or zooming, full resolution on release". `forced`: the `?test&canvas=` switch ('off', 'render-fail'). */
export function createCanvasRenderer(canvas: HTMLCanvasElement, forced: string | null): TextureRenderer {
  if (forced === 'off') throw new RenderFailure('no-canvas', 'canvas switched off for a test');
  const g = canvas.getContext('2d');
  if (!g) throw new RenderFailure('no-canvas', 'no 2D canvas context');
  const scratch = document.createElement('canvas');
  let tex: CpuTextures | null = null;
  let failNextDraw = forced === 'render-fail';
  return {
    tier: 'canvas',
    maxTextureSize: 2048,
    resize(cssWidth, cssHeight) {
      // One canvas pixel per CSS pixel: the CPU cost grows with the pixel count.
      const w = Math.max(1, Math.round(cssWidth)), h = Math.max(1, Math.round(cssHeight));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    },
    setTextures(t: StyleTextures) {
      tex = { day: sampled(t.day, 2048), region: sampled(t.region, 1440), night: t.night ? sampled(t.night, 2048) : null };
    },
    draw(input: DrawInputs) {
      if (!tex) return;
      if (failNextDraw) { failNextDraw = false; throw new RenderFailure('render', 'draw failure forced for a test'); }
      const scale = input.quality === 'fast' ? 0.25 : 1;
      const w = Math.max(1, Math.round(canvas.width * scale)), h = Math.max(1, Math.round(canvas.height * scale));
      const img = new ImageData(w, h);
      const v = input.view;
      for (let j = 0; j < h; j++) {
        const y = ((j + 0.5) * v.height) / h;
        for (let i = 0; i < w; i++) shadePixel(input, tex, ((i + 0.5) * v.width) / w, y, img.data, (j * w + i) * 4);
      }
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (scale === 1) { g.putImageData(img, 0, 0); return; }
      scratch.width = w; scratch.height = h;
      scratch.getContext('2d')!.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    },
    readPixels: (x, y, w, h) => new Uint8Array(g.getImageData(x, y, w, h).data.buffer),
    bufferSize: () => ({ width: canvas.width, height: canvas.height }),
    dispose() { tex = null; },
  };
}
```

- [ ] **Step 4: Extend `TextureLayer.svelte` to the whole chain**

Changes to the Task 7 component (keep everything else):

1. Imports: `import { flushSync } from 'svelte';`, `import { createCanvasRenderer } from './canvas2d';`, `import { motionReduced } from '../../app/settings.svelte';` (used by Task 9's fade; import it then, not now).
2. State: `let rebuild = $state(0);` `let printSrc = $state<string | null>(null);` `let lastChange = 0;`
3. `active` becomes `const active = $derived(isTextureStyle(style) && tier !== 'atlas');`
4. Effect 1 (renderer), per tier; reads `rebuild` so a restored context gets a new renderer:
```ts
  $effect(() => {
    const c = canvas, t = tier;
    void rebuild;
    if (!c || !active || renderHealth.state.waitingForRestore) return;
    let r: TextureRenderer;
    try { r = t === 'webgl' ? createWebGLRenderer(c, testFlag('gl')) : createCanvasRenderer(c, testFlag('canvas')); } catch (e) { fail(e); return; }
    renderer = r;
    return () => { r.dispose(); renderer = null; loaded = null; };
  });
```
5. Effect 2 (textures): the size check only applies to WebGL; the canvas path always decodes at 2048:
```ts
    const max = r.tier === 'webgl' ? renderHealth.state.maxTexture : 2048;
    if (r.tier === 'webgl' && r.maxTextureSize < max) { reportHealth({ type: 'fail', reason: 'texture-size' }); return; }
```
6. Effect 3 (draw): on the canvas tier a change within 200 ms of the previous one draws at quarter resolution, and a full-resolution draw follows 220 ms after the last change:
```ts
  $effect(() => {
    const r = renderer;
    if (!r || loaded !== style || !isTextureStyle(style)) return;
    const v = textureView(ctx);
    const base: DrawInputs = { view: v, regionMix: regionMix(v, REGION, REGION_MIN_ZOOM), night: null, limb: v.projection === 3, glow: style === 'satellite' && v.projection === 3, quality: 'full', debug: 0 };
    const w = cssWidth, h = cssHeight;
    const now = performance.now();
    const moving = r.tier === 'canvas' && now - lastChange < 200;
    lastChange = now;
    const paint = (input: DrawInputs) => { try { r.resize(w, h, devicePixelRatio); r.draw(input); lastInput = input; draws++; } catch (e) { fail(e); } };
    const frame = requestAnimationFrame(() => paint(moving ? { ...base, quality: 'fast' } : base));
    const settle = moving ? setTimeout(() => paint(base), 220) : undefined;
    return () => { cancelAnimationFrame(frame); clearTimeout(settle); };
  });
```
7. Context loss (WebGL tier only):
```ts
  $effect(() => {
    const c = canvas;
    if (!c || tier !== 'webgl') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lost = (e: Event) => {
      e.preventDefault(); // allows the browser to restore the context
      renderer = null; loaded = null;
      reportHealth({ type: 'context-lost' });
      timer = setTimeout(() => reportHealth({ type: 'restore-timeout' }), Number(testFlag('glRestoreMs')) || 3000);
    };
    const restored = () => { clearTimeout(timer); reportHealth({ type: 'context-restored' }); rebuild++; };
    c.addEventListener('webglcontextlost', lost);
    c.addEventListener('webglcontextrestored', restored);
    return () => { clearTimeout(timer); c.removeEventListener('webglcontextlost', lost); c.removeEventListener('webglcontextrestored', restored); };
  });
```
8. Printing (spec §4 Print):
```ts
  $effect(() => {
    const before = () => {
      const r = renderer;
      if (!r || !lastInput || !canvas) return;
      try { r.draw(lastInput); printSrc = canvas.toDataURL('image/png'); } catch { printSrc = null; }
      flushSync();
    };
    const after = () => { printSrc = null; };
    addEventListener('beforeprint', before);
    addEventListener('afterprint', after);
    return () => { removeEventListener('beforeprint', before); removeEventListener('afterprint', after); };
  });
```
9. Markup: a new canvas element per tier (a canvas that had a WebGL context cannot give a 2D one), and the print image:
```svelte
{#if active}
  {#key tier}
    <canvas class="texture" class:ready={loaded === style} bind:this={canvas} bind:clientWidth={cssWidth} bind:clientHeight={cssHeight} data-tier={tier} aria-hidden="true"></canvas>
  {/key}
  {#if printSrc}<img class="print-snapshot" src={printSrc} alt="" />{/if}
{/if}
```
CSS additions:
```css
  .print-snapshot { display: none; }
  @media print {
    .texture { display: none; }
    .print-snapshot { display: block; position: absolute; inset: 0; width: 100%; height: 100%; }
  }
```

- [ ] **Step 5: The note — `src/map/MapStyleNote.svelte` and MapStage**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { styleUnavailable } from './texture/fallback';
  import { renderHealth } from './texture/health.svelte';
  // Spec §4 fallback step 3: the chosen style cannot be drawn on this device, so the map shows Atlas and says so once.
  const unavailable = $derived(styleUnavailable(mapState.chosenMapStyle, renderHealth.state));
</script>

<p class="style-note" role="status">{#if unavailable}<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.2v.3" /></svg>{t('map.style.fallback')}{/if}</p>

<style>
  .style-note { margin: 0; display: flex; gap: var(--space-2); align-items: center; color: var(--text-muted); font-size: var(--step--1); }
  .style-note:empty { display: none; }
  svg { flex: none; width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
</style>
```
In `src/map/MapStage.svelte` import it and render `<MapStyleNote />` right after the `.views` `</div>`.

Add to the three message files (next to the other `map.*` keys; edit one file at a time, keep valid JSON):
- en: `"map.style.fallback": "This device can't draw this style; showing Atlas."`
- pl: `"map.style.fallback": "To urządzenie nie może narysować tego stylu, więc pokazujemy Atlas."`
- uk: `"map.style.fallback": "Цей пристрій не може намалювати цей стиль, тому показуємо Атлас."`

- [ ] **Step 6: E2E `tests/e2e/texture-fallback.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, probe, setMapStyle, textureHooks, waitForTexture } from './helpers';

const NOTE = "This device can't draw this style; showing Atlas.";
const styles = (page: Page) => page.evaluate(() => { const s = (window as unknown as { __mapState: { chosenMapStyle: string; mapStyle: string; drawnMapStyle: string } }).__mapState; return [s.chosenMapStyle, s.mapStyle, s.drawnMapStyle]; });

async function open(page: Page, flags: string, style: 'physical' | 'satellite' = 'physical') {
  await openPage(page, 'en/lab', `?test${flags}`);
  await setMapStyle(page, style);
}

async function expectCanvasDrawing(page: Page) {
  await expect.poll(() => textureHooks(page).tier()).toBe('canvas');
  await waitForTexture(page, 'flat');
  await expect(page.locator('.view-flat canvas.texture')).toHaveAttribute('data-tier', 'canvas');
  const sahara = (await probe(page, 'flat', 23, 12))!;
  expect(sahara.avg[0]).toBeGreaterThan(sahara.avg[2] + 15);
  await expect(page.getByText(NOTE)).toHaveCount(0);
}

async function expectAtlasWithNote(page: Page) {
  await expect.poll(() => textureHooks(page).tier()).toBe('atlas');
  await expect(page.getByRole('status').filter({ hasText: NOTE })).toBeVisible();
  expect(await styles(page)).toEqual(['physical', 'atlas', 'atlas']);
  await expect(page.locator('canvas.texture')).toHaveCount(0);
  await expect(page.locator('.view-flat path.land')).toHaveCount(1);
}

test('no WebGL: the same picture from the canvas path, no note', async ({ page }) => {
  await open(page, '&gl=off');
  await expectCanvasDrawing(page);
  expect(pageErrors(page)).toEqual([]);
});

test('a shader that fails to compile: canvas', async ({ page }) => {
  await open(page, '&gl=shader-fail');
  await expectCanvasDrawing(page);
});

test('an exception while drawing with WebGL: canvas', async ({ page }) => {
  await open(page, '&gl=render-fail');
  await expectCanvasDrawing(page);
});

test('no WebGL and no canvas: Atlas with the note, and axe is clean', async ({ page }) => {
  await open(page, '&gl=off&canvas=off');
  await expectAtlasWithNote(page);
  await expectNoAxeViolations(page, 'fallback note');
  expect(pageErrors(page)).toEqual([]);
});

test('an exception while drawing on the canvas: Atlas with the note', async ({ page }) => {
  await open(page, '&gl=off&canvas=render-fail');
  await expectAtlasWithNote(page);
});

test('images that cannot be decoded: Atlas with the note; nothing is remembered after a reload', async ({ page }) => {
  await open(page, '&gl=decode-fail');
  await expectAtlasWithNote(page);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  expect(await textureHooks(page).tier()).toBe('webgl');
});

test('a lost WebGL context that is not restored in time: canvas', async ({ page }) => {
  await open(page, '&glRestoreMs=300');
  await waitForTexture(page, 'flat');
  await textureHooks(page).loseContext('flat', null);
  await expectCanvasDrawing(page);
});

test('a lost WebGL context that comes back: WebGL again, drawing', async ({ page }) => {
  await open(page, '&glRestoreMs=5000');
  await waitForTexture(page, 'flat');
  const before = await page.evaluate(() => (window as unknown as { __mapTextures: { drawCount(v: string): number } }).__mapTextures.drawCount('flat'));
  await textureHooks(page).loseContext('flat', 150);
  await expect.poll(() => textureHooks(page).health()).toMatchObject({ tier: 'webgl', waitingForRestore: false });
  await page.evaluate(() => (window as unknown as { __mapState: { zoomFlat(f: number): void } }).__mapState.zoomFlat(1.5));
  await waitForTexture(page, 'flat', before + 1);
  expect((await probe(page, 'flat', 23, 12))).not.toBeNull();
});

test('printing replaces the canvas with a snapshot of the same picture', async ({ page }) => {
  await open(page, '');
  await waitForTexture(page, 'flat');
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  const src = await page.locator('.view-flat img.print-snapshot').getAttribute('src');
  expect(src?.startsWith('data:image/png;base64,')).toBe(true);
  expect(src!.length).toBeGreaterThan(20_000);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await expect(page.locator('img.print-snapshot')).toHaveCount(0);
});
```

- [ ] **Step 7: Run**

```bash
npx vitest run tests/unit/cpu-shade.test.ts
npm run check && npm test
npm run build && npm run e2e
```
Expected: everything PASS, including `atlas-baseline.spec.ts` (7) and all existing specs unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/map/texture src/map/MapStyleNote.svelte src/map/MapStage.svelte src/i18n/en.json src/i18n/pl.json src/i18n/uk.json tests/unit/cpu-shade.test.ts tests/e2e/texture-fallback.spec.ts
git commit -m "feat(map): canvas fallback, WebGL context loss and any failure falling back to Atlas with a note"
```
