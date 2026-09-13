# Part 2c — Globe zoom (added mid-run at the user's request)

### Task 11c: Zoom in and out on the globe

**Goal:** The globe can be zoomed like the flat map — buttons, Ctrl/⌘ + wheel or trackpad pinch, two-finger pinch on touch screens, and `+`/`-` keys — so kids can look closely at Poland or Ukraine on the globe and zoom back out to see the whole Earth.

**Depends on:** Task 11b (it edits the same `geometry.ts`, `mapState.svelte.ts` and `types.ts`). Run after 11b is committed.

**Files:**
- Modify: `src/map/geometry.ts` (`makeGlobeCtx` gains `zoom`), `src/map/mapState.svelte.ts` (`globeZoom`, `zoomGlobe`, reset in `applyScene`), `src/map/types.ts` (`SceneSpec.globeZoom?: number`), `src/map/Globe.svelte` (buttons, wheel, pinch, keys, clip), `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/geometry.test.ts`, `tests/unit/mapState.test.ts`, `tests/e2e/globe-zoom.spec.ts` (new file, to avoid colliding with other specs)

**Interfaces:**
- `makeGlobeCtx(size: number, rotate: [number, number], px: number, zoom = 1): ViewCtx` — orthographic scale `(size / 2 - 6) * zoom`, same translate; `project` returns null for back-side points (unchanged) — points on the front side but outside the viewBox may return coordinates outside `[0, size]` (the SVG clips them); `invert` returns null outside the visible disc **or** outside the viewBox.
- `MapState.globeZoom = $state(1)`; `GLOBE_MIN_ZOOM = 1`, `GLOBE_MAX_ZOOM = 8` (exported); `zoomGlobe(factor: number): void` clamps to that range; `applyScene` sets `globeZoom = clamp(scene.globeZoom ?? 1)`.
- `SceneSpec.globeZoom?: number` (also add to the README contract block).

**Behaviour (Globe.svelte):**
- Toolbar gains ＋ and − buttons with aria-labels `map.globeZoomIn` / `map.globeZoomOut` (distinct names from the flat map's buttons, because both toolbars appear on the same page), each ×1.5 / ÷1.5; minimum 44×44.
- Ctrl/⌘ + wheel zooms ×1.15 per notch with a non-passive listener (plain wheel still scrolls the page), cleaned up in the effect's teardown.
- Two-finger pinch zooms (same pattern as FlatMap: track two pointers, ratio of distances; when one finger lifts, the remaining one continues rotating — no dead finger, never places the point).
- Keys on the focused globe: `+`/`=` zoom in, `-`/`_` zoom out, `0` resets zoom to 1 (arrow keys unchanged).
- Drag-to-rotate sensitivity divides by zoom, so a zoomed globe does not spin wildly under the finger.
- The SVG gets a `clipPath` rect for the viewBox; the sphere outline and ocean stay clipped when zoomed in.
- The globe hint text (`map.globe.hint`) is extended in all three languages to mention zooming (plus/minus keys, Ctrl + scroll).
- "Show the point" keeps the current zoom.
- Layer label sizes stay constant on screen (they already scale with `ctx.px`, which does not change with zoom).

**i18n keys:**

| key | en | pl | uk |
|---|---|---|---|
| map.globeZoomIn | Zoom in on the globe | Przybliż globus | Наблизити глобус |
| map.globeZoomOut | Zoom out on the globe | Oddal globus | Віддалити глобус |

**Tests:**
- `geometry.test.ts`: at zoom 2 the centre still projects to (size/2, size/2); a front-side point at 30° from the centre is twice as far from the centre as at zoom 1; `invert` of a viewBox corner is null at zoom 1 (outside disc) and non-null at zoom 3 (disc covers corners); `invert` outside the viewBox is null.
- `mapState.test.ts`: `zoomGlobe` clamps to [1, 8]; `applyScene` resets to 1 and honours `scene.globeZoom`.
- `globe-zoom.spec.ts` (`#en/lab?test`): clicking "Zoom in on the globe" three times sets `window.__mapState.globeZoom` to 3.375; "Zoom out on the globe" returns towards 1 and never below; focusing the globe and pressing `+` zooms, `0` resets; Ctrl+wheel over the globe zooms while plain wheel does not; axe clean after zooming; the flat map's "Zoom in" button still exists and is distinct.

**Process:** TDD for geometry/state; implement; build; screenshot at zoom 1 and zoom 4 centred on Warsaw (temporary script using `?test` + `__mapState`), view both with Read (clipping, labels readable, point visible); `npm run check && npm test && npm run build && npm run e2e` green; commit `feat(map): zoom in and out on the globe`.
