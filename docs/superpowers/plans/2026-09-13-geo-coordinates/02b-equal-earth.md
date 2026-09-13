# Part 2b — Equal Earth projection variant (added mid-run at the user's request)

### Task 11b: Equal Earth as a second flat-map projection

**Goal:** The flat map can be drawn either as the school "grid" map (equirectangular, straight meridians) or as **Equal Earth** (equal-area, curved meridians). The viewer chooses; a scene can force one (e.g. a topic-1 step comparing them).

**Files:**
- Modify: `src/map/types.ts` (`FlatProjection`, `SceneSpec.flatProjection`), `src/map/mapState.svelte.ts`, `src/map/geometry.ts` (`makeFlatCtx` gains a projection argument), `src/map/FlatMap.svelte` (projection switch in the toolbar), `src/map/layers/EdgeLabels.svelte` (labels follow curved meridians/visible edges), `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/geometry.test.ts`, `tests/unit/mapState.test.ts`, `tests/e2e/map.spec.ts`

**Interfaces:**
- `export type FlatProjection = 'grid' | 'equal-earth';` in `src/map/types.ts`; `SceneSpec.flatProjection?: FlatProjection` — when set, forces that projection for the scene; when absent, the viewer's preference applies.
- `MapState`: `projectionPreference = $state<FlatProjection>` (initialised from `readString('geo-coords:projection')`, default `'grid'`), `projectionOverride = $state<FlatProjection | null>` (set by `applyScene` from `scene.flatProjection ?? null`), getter `get flatProjection(): FlatProjection` (override ?? preference), `setProjectionPreference(p: FlatProjection): void` (sets preference, persists via `writeString`, clears nothing else). The preference survives `applyScene`.
- `makeFlatCtx(width, height, center, zoom, px, projection: FlatProjection = 'grid')`. For `'equal-earth'` use d3 `geoEqualEarth()`: base scale from `fitWidth(width, sphere)` (or `fitSize([width, height], sphere)`), multiplied by `zoom`, `.center([center.lon, center.lat])` (Equal Earth supports `center`; if not exact, translate so that `project(center)` lands at the viewport middle), same `invert` viewport bounds check as grid. `isVisible` stays `() => true`. Existing grid behaviour must not change.
- Pan/zoom clamping (`clampCenter`) keeps its current degree-based limits for both projections (Equal Earth's world is roughly 2:1, so the same limits are acceptable); note any visible edge gaps in the report.

**Behaviour:**
- FlatMap toolbar gets a two-button segmented control ("Grid map" / "Equal Earth", `aria-pressed`) shown only when the scene does not force a projection. Switching keeps the point, zoom and centre.
- Tooltip/`title` or a short visually-hidden description explains the difference: grid map = meridians straight, easy to read coordinates; Equal Earth = true sizes of countries, meridians curved.
- `EdgeLabels`: latitude labels at the left edge use the projected y of each parallel (parallels are straight horizontal lines in both projections); longitude labels at the bottom edge are placed at the projected x of each meridian at the lowest visible latitude, so they sit under their curved meridians. Keep the ≥ 34 px spacing rule and the edge anchors fix from Task 9.
- Globe and cross-section are unaffected.

**i18n keys:**

| key | en | pl | uk |
|---|---|---|---|
| map.projection | Map type | Rodzaj mapy | Тип карти |
| map.projection.grid | Grid map | Mapa z siatką | Карта-сітка |
| map.projection.equal-earth | Equal Earth | Equal Earth | Equal Earth |
| map.projection.hint | Grid map: straight meridians, easy to read coordinates. Equal Earth: countries keep their true size, meridians are curved. | Mapa z siatką: proste południki, łatwo odczytać współrzędne. Equal Earth: państwa mają prawdziwą wielkość, południki są wygięte. | Карта-сітка: прямі меридіани, легко визначати координати. Equal Earth: країни мають справжній розмір, меридіани вигнуті. |

("Equal Earth" is a proper name and stays untranslated; Task 19's sanity check must allow-list `map.projection.equal-earth`.)

**Tests:**
- `geometry.test.ts`: Equal Earth ctx — `project({lat:0, lon:0})` is the viewport centre at zoom 1; `invert(project(p))` round-trips within 1e-6 for several points including (60°N, 150°W) and (−40°, 170°E); a meridian at lon 90 projects to different x at lat 0 vs lat 60 (curved); grid ctx unchanged (existing tests still pass).
- `mapState.test.ts`: preference persists through `applyScene`; a scene with `flatProjection: 'equal-earth'` overrides and the next scene without it restores the preference; `setProjectionPreference` writes storage (use the in-memory localStorage stub pattern from scores tests or a local stub).
- `map.spec.ts`: on `#en/lab`, click "Equal Earth" → button pressed, the map still shows the point handle, a keyboard nudge still moves it, axe clean; reload → preference remembered.

**Process:** TDD for geometry and state; build; `npm run shot -- "en/lab" lab-equal-earth` after selecting Equal Earth (temporary Playwright step or set `localStorage['geo-coords:projection']='equal-earth'` via `page.addInitScript` in a temporary script) and look at the PNG: land shape correct, graticule curved, labels under meridians, point and guides correct. `npm run check && npm test && npm run build && npm run e2e` green; commit `feat(map): Equal Earth projection as a second flat-map variant`.
