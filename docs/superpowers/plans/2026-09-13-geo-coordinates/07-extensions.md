# Part 7 — Extensions requested by the owner (approved 2026-09-13)

Execution order: 17b → 17c → 23a (data research, can run in parallel with 17b/21) → 21 → 22 → 23b → D2 → 18 → 19 → 20.

---

### Task 17b: UX batch

Small behaviour/markup improvements proposed by the design pass and the Task 16 review.

1. **Show the correct answer after checking** (ChoiceInput): once answered, the correct option gets a ✓ badge + "correct answer" visually-hidden text; a wrong chosen option gets a ✗ badge. Needs the correct index passed as a prop from QuestionCard (only after answering; never before). Feedback box unchanged.
2. **Place-label collision** (Places layer): a small greedy pass that hides lower-priority place names (non-featured first, then by distance to the view centre) whose label boxes overlap an already placed label or a special-line label. Pure helper `src/map/labelLayout.ts` with unit tests; dots stay visible.
3. **Short app title on phones**: new i18n key `app.shortTitle` (EN "Coordinates", PL "Współrzędne", UK "Координати") shown next to the logo below 480px.
4. **Map toolbars**: remove `role="toolbar"` (no roving focus needed; groups keep `role="group"` + label).
5. **Class quiz reveal animation**: overlays added after a reveal animate in (markers scale/fade in, lines and brackets draw in via stroke-dashoffset, ~500ms); no animation when reduced motion is on. Implement as an opt-in `animateIn` flag on MapState overlays added with `addOverlays(o, { animate: true })`, used by ClassQuiz reveal and Practice solution.
6. **Class quiz question change**: move focus to the prompt heading and announce "Question n of total" politely.

Tests: unit tests for labelLayout; e2e: after a wrong answer the correct option shows the ✓ badge and accessible text; `app.shortTitle` visible at 375px; reduced-motion run shows overlays without animation classes.

---

### Task 17c: Neutral example places (owner request, refined)

The owner's rule: Kyiv stays on the world map (featured label unchanged) and may appear in examples **together with another city** (e.g. Warsaw and Kyiv, London and Kyiv). An example where a Ukrainian city is **the single highlighted answer** should use a neutral place instead.

- Topic 4 `plan` / `meridian` / `cross` (the only example where Kyiv is alone): 50°N, 30°E → 50°N, 20°E (Kraków): "Let's find 50°N, 20°E …", "Now find the meridian 20°E …", "… It is Kraków!"; overlays/markers updated to lat 50 / lon 20. PL/UK texts updated accordingly (Kraków/Краків).
- Topic 2 `east-west` (Kyiv with London), topic 6 `same-lon` (Kyiv with Warsaw), topic 8 `calculate` (Warsaw with Kyiv) and the lab clocks: unchanged.
- Generated "which marker is at …" questions (whichPlace): the answer city is never `kyiv`, `lviv`, `odesa` or `kharkiv` (exclusion flag or list); other generators don't name cities.
- Tests: unit test that whichPlace never picks the excluded ids as the answer (1000 seeds × difficulties); e2e/explore expectations updated for topic 4 if they check text.

### Task 23a: Maple Bear schools dataset (research)

Produce `src/map/data/maple-bear-schools.json`:

```json
{
  "source": "…official URLs used…",
  "retrieved": "2026-09-13",
  "note": "Locations are approximate (city level) unless precision is 'address'.",
  "schools": [
    { "id": "pl-katowice", "name": "Maple Bear Katowice", "city": "Katowice", "country": "PL", "lat": 50.26, "lon": 19.02, "precision": "address" | "city", "url": "…" }
  ]
}
```
- All schools worldwide listed on official Maple Bear websites (global site and country sites). No invented entries; each entry traceable to a listing.
- Coordinates: address-level when a public address is listed and can be located reliably; otherwise the city centre. Use knowledge of city coordinates or public geodata; if using OpenStreetMap Nominatim, respect its usage policy (≤ 1 request/second, identifying User-Agent, cache results).
- Country as ISO 3166-1 alpha-2. Names as listed by Maple Bear.
- A validation script `scripts/validate-schools.ts` (lat/lon ranges, unique ids, required fields, country codes) and a unit test running it.
- Report: counts per country, sources, how coordinates were obtained, gaps.

---

### Task 21: Katowice, detailed Central Europe and deep zoom

- **Places:** add Katowice, Łódź, Szczecin, Lublin, Białystok, Rzeszów, Bydgoszcz, Olsztyn, Zakopane, and neighbour capitals Berlin (exists), Prague, Bratislava, Vienna, Budapest, Vilnius, Riga; localized names in EN/PL/UK. A new `tier` field: `world` (shown at world zoom), `region` (zoom ≥ 3), `local` (zoom ≥ 8). Katowice is `region`.
- **Regional data:** Natural Earth 10m land + country borders + admin-1 (Polish voivodeships only) + major rivers (Vistula/Wisła, Oder/Odra, Warta, Bug, Dnieper/Dnipro, Danube) + lakes, clipped to lon 8–32°E, lat 44–58°N, simplified and quantized with `topojson-server`/`topojson-simplify`/`topojson-client` in a build-time script `scripts/build-regional-data.ts` whose output `src/map/data/central-europe.json` is committed (the script documents the download source; the downloaded raw files are not committed). If Natural Earth downloads are blocked in this environment, report NEEDS_CONTEXT.
- **Level of detail:** `world.ts` exposes `landFor(zoom, view)`/`bordersFor(...)`: world 110m below zoom 4; regional 10m features drawn on top when the view intersects the region bbox and zoom ≥ 4 (world land still drawn underneath outside the bbox). Voivodeship borders (thin, dashed) and rivers (blue lines, labelled Wisła/Odra at zoom ≥ 6) appear at zoom ≥ 6 in the region.
- **Deep zoom:** flat `MAX_ZOOM` 12 → 80; globe `GLOBE_MAX_ZOOM` 8 → 60. Wheel/pinch/keys scale unchanged. Pan clamping still keeps the view within the world.
- **Adaptive grid:** when a scene does not force a step, the graticule step adapts to zoom so that lines are 40–120 CSS px apart, choosing from 30°, 15°, 10°, 5°, 1°, 30′, 10′, 5′, 1′; edge labels show minutes when the step is below 1° (using the current language's notation). Scenes that set `graticuleStep` explicitly keep it (questions rely on it). `LayerFlags.graticuleStep` gains `'auto'` (default for lab/free-play scenes).
- **Size budget:** build stays < 1 MB (report the regional data size).
- Tests: unit tests for the adaptive step chooser and tier visibility; geometry tests at zoom 80; e2e: zoom into Katowice on the lab page (Poland preset + zoom in) shows the Katowice label and minute edge labels; axe clean.

---

### Task 22: Mercator option and topic 9 "Coordinates in your phone"

- **Formats:** `src/geo/format.ts` gains `formatDecimal(p: LatLon, digits = 4): string` → `"50.2649, 19.0238"` (always `.` decimal separator and comma+space, like map apps, in every language) and `formatDMS(value, axis, lang)` → `50°15′54″N` / UK `50°15′54″ пн. ш.`; `parseDecimalPair(input)` accepting `50.2649, 19.0238`, `50.2649 19.0238`, `-33.87,151.21`. Unit tests incl. rounding of seconds (carry 60″).
- **Mercator:** `FlatProjection` gains `'mercator'` (d3 `geoMercator`, latitude clipped to ±85°); the projection switch shows three options (Grid map / Equal Earth / Map app (Mercator)); invert/edge ticks work (tick spacing test extended). Keys `map.projection.mercator`, hint text updated.
- **Readout:** `SceneSpec.readout?: 'letters' | 'decimal' | 'both'` (default `letters`); CoordinateControls shows the decimal pair (and DMS when `both`) in topic 9.
- **Topic 9 (Explore only, no Practise):** `TopicId` 9 added; Home card; TopicPage hides the Practise tab and pager handles 9; rehearsal and class quiz exclude it automatically (no question modules). Steps (EN source; PL/UK natural):
  1. `gps` — **Your phone knows where it is** — "Phones get their position from satellites (GPS and similar systems). All of them use the same latitude and longitude that you are learning — the WGS 84 system."
  2. `decimal` — **Coordinates as decimals** — "Map apps such as Google Maps write coordinates as two decimal numbers: latitude first, then longitude. Katowice is about 50.2649, 19.0238."
  3. `signs` — **A minus instead of a letter** — "Decimal coordinates have no letters. A minus sign means south (for latitude) or west (for longitude). Sydney is −33.8688, 151.2093 and New York is 40.7128, −74.0060."
  4. `dms` — **Degrees, minutes, seconds** — "One degree has 60 minutes and one minute has 60 seconds. 50.2649° = 50°15′54″N. Move the point and compare both ways of writing it."
  5. `find` — **Find coordinates in a map app** — "In Google Maps, press and hold a spot on the map (on a computer: right-click). The coordinates appear — tap them to copy. You can also type coordinates into the search box to find a place."
  6. `mercator` — **Why Greenland looks huge** — "Map apps use a map called Mercator. It keeps shapes and directions right near you, but stretches everything near the poles. On Mercator Greenland looks as big as Africa; in reality Africa is 14 times bigger. Compare with Equal Earth and the globe."
  7. `swap` — **Careful with the order** — "If you swap the two numbers, you land somewhere else: 19.0238, 50.2649 is not Katowice but a place in Saudi Arabia. Latitude always comes first."
  8. `play` — **Try it yourself** — "Move the point and read its coordinates as letters, as decimals and in degrees-minutes-seconds. Turn on the Maple Bear schools layer and find a school."
  No Google logos or app screenshots; step 5 may show a simple generic illustration drawn in SVG ("a map pin with coordinates below it").
- Verify factual claims in step texts (Africa/Greenland area ratio ≈ 14; the swapped Katowice point location) with the geo helpers before committing; adjust text if needed.
- Tests: unit tests for formats; topic texts parity test; explore e2e loop includes topic 9 in 3 languages; TopicPage shows no Practise tab for topic 9; rehearsal/class quiz topic lists exclude 9.

---

### Task 23b: Maple Bear schools layer

- `LayerFlags.schools: boolean` (default false); toggle button "Maple Bear schools" (keys `map.schools`, `map.schools.hint`, `map.schools.count` plural) in the flat map and globe toolbars on the lab page and topic 9 play step (scene flag `schoolsToggle?: boolean` controls whether the toggle is offered).
- Rendering: school markers (maple-leaf-free neutral icon: small rounded square in a dedicated `--school` token colour with a white border; not colour-only — shape differs from place dots and answer markers). Clustering by screen distance (grid clustering in CSS px; clusters show a count badge; clicking/Enter on a cluster zooms in on it). At zoom where a school is alone, show its name label (subject to label collision from Task 17b).
- Accessibility: schools are not individually focusable on the map; the PlaceList-like "Schools" disclosure lists schools grouped by country (localized country names via `Intl.DisplayNames`) with buttons that centre the map on the school and set the point (when editable) — mirroring PlaceList patterns.
- Footer/README note: "School locations: Maple Bear websites (retrieved 2026-09-13), approximate."
- Tests: unit test for clustering (cluster counts at world zoom, single markers at high zoom); e2e: toggle on lab → count badge visible; list → "Maple Bear Katowice" centres the map and shows its label; axe clean.
