# Map Styles, Earth Physics and Seasons: Design

- **Date:** 2026-09-15
- **Status:** Approved in brainstorming, awaiting written-spec review
- **Builds on:** `2026-09-13-geo-coordinates-design.md` (the lesson), the released `main` (Pages: https://xsavikx.github.io/geo-coordinates/)
- **Examples:** comparison page with real renders of every style (artifact "Map Realism Options")

## 1. Purpose

Make the maps and the globe richer and more realistic without losing what makes the lesson work: readable coordinates, exact rules, offline use, accessibility.

Four additions, all owner-approved:

1. **Physical** style: school-atlas relief ("mapa fizyczna").
2. **Satellite** style: NASA imagery, with night-side city lights wherever day and night are shown.
3. **Political** style: coloured, named countries in Poland's official border view.
4. **Earth physics:**
   - a Seasons mode in the day and night lab;
   - an explore-only topic 10 "Why we have seasons";
   - an advanced "real Sun" switch in the lab.

### Success criteria

- A pupil can switch the map between Atlas, Physical, Satellite and Political on every map in the lesson, and the choice is remembered.
- A teacher can choose a style for a class quiz run without changing their own saved choice.
- Atlas stays pixel-identical to today; every existing test passes unchanged.
- Dragging the satellite globe stays at 60 fps on a mid-range phone; picking a style draws within 100 ms after the one-time image decode.
- Any failure in the new drawing path leaves a working Atlas map.
- The single file stays under 5 MB and makes no network requests.
- WCAG 2.2 AA on every route in every style, light and dark; AAA contrast in presenter mode.

### Non-goals

- Street-level or satellite imagery beyond the Poland detail tile.
- Live weather or clouds.
- Time zones as a map layer.
- Practice questions about seasons.
- Changing the lessons' mean-Sun rule (15° = 1 hour stays exact everywhere except the lab's advanced switch).

## 2. Owner decisions

| Topic | Decision |
|---|---|
| Styles | Physical, Satellite (+ city lights), Political, Earth physics: all four |
| Delivery | Everything inside one single file; size limit raised from 1 MB to **5 MB**; no download dialog |
| Where the switch appears | Everywhere with a map: explore, lab, free play, practice, rehearsal, class quiz. The class quiz setup has its own style choice. Worksheets and cheat sheet stay Atlas. |
| Borders | Natural Earth **Poland point-of-view** (Crimea, Sevastopol, Donbas in Ukraine; Kosovo a country; Western Sahara in Morocco). Already shipped for world borders in `6588ac1`. |
| Seasons | A Seasons mode in the lab **and** an explore-only topic 10 |
| Rendering | GPU (WebGL) with a canvas fallback |
| Errors | **Any** error in the new path falls back to the existing Atlas rendering |
| Default | Atlas; the chosen style is remembered (like the grid / Equal Earth preference) |
| Real Sun | Lab-only advanced switch, off by default, not saved |

## 3. Styles and data

| Style | Drawn | Data inside the file | Approx. size |
|---|---|---|---|
| **Atlas** | Today's look | unchanged | 0 |
| **Physical** | Hypsometric tints with shaded relief and sea depths, ice; rivers and lakes; ≈25 physical names | World relief texture 4096×2048 (WebP); Central Europe relief tile; rivers + lakes (TopoJSON) | ≈ 1.0 MB |
| **Satellite** | NASA Blue Marble; atmosphere glow on the globe; Black Marble city lights on the night side wherever `daylight` is on | World day 4096×2048 + night 4096×2048 (WebP); Central Europe day tile | ≈ 1.3 MB |
| **Political** | Pastel country fills (neighbours differ), borders, country names (EN/PL/UK via `Intl.DisplayNames`), capitals from the existing places list | Countries at ~50m detail from `ne_10m_admin_0_countries_pol`, simplified | ≈ 0.25 MB |

Total ≈ 3.5 MB (current file ≈ 0.97 MB).

- **Build scripts** follow the pattern of `scripts/build-regional-data.ts` and `scripts/build-world-borders.ts`: a `--download` flag, a git-ignored raw cache, a header naming source URL and version, committed outputs.
- **Sources:**
  - Natural Earth `HYP_50M_SR_W`, rivers and lake centerlines, lakes, admin-0 POL (public domain);
  - NASA Earth Observatory Blue Marble (world.topo.bathy) and Black Marble 2016 (public domain, credit NASA Earth Observatory).
- **Detail tile:** inside the Central Europe box (`REGION`, lon 8–32°E, lat 44–58°N), from zoom 4, a sharper tile is blended in (≈ 60 px per degree); outside it deep zoom shows the softer world texture.
- **Lazy decoding:** images are embedded as data (base64 WebP) and decoded only when a style is first chosen.
- **Physical names** (e.g. Tatry, Sudety, Karpaty/Carpathians, Alpy/Alps, Sahara, Himalaje/Himalayas, Andy/Andes, Morze Bałtyckie/Baltic Sea, Morze Śródziemne/Mediterranean Sea): new i18n keys in EN/PL/UK, listed on the translation review sheet.
- **Credits:** footer, README and `LICENSE-CONTENT.md` gain Natural Earth relief and NASA Earth Observatory lines; the style hint names the source.

### Readability rules

- Grid, special lines, point guides, markers and all labels get a halo in every non-Atlas style.
- Satellite uses a lighter grid colour.
- Presenter mode strengthens halos so AAA contrast holds.
- Hemisphere, region and answer highlights stay semi-transparent overlays above the texture.
- Colour is never the only signal (existing dash patterns and marker shapes stay).

## 4. Rendering

### Layer order

1. **Texture layer** (new): one `<canvas>` per view, under the SVG. Absent for Atlas and Political.
2. **Existing SVG layers**, unchanged: land (Atlas only), Political fills (Political only), graticule, hemispheres, daylight shading (Atlas / Physical / Political; Satellite does its own), special lines, rivers and lakes (Physical only), overlays, places, schools, point, edge labels.

### Single source of truth

- The texture layer reads projection, rotation, zoom and pan from `MapState` exactly as the SVG layers do.
- A pure module computes the same view parameters for both, so the image and the vectors cannot drift.

### WebGL path

- A full-view quad; the fragment shader inverse-projects each pixel to longitude/latitude:
  - grid (equirectangular);
  - Equal Earth (inverse by Newton iterations, matching d3 to ≤ 0.01°);
  - Mercator;
  - orthographic with rotation and clip.
- It samples the world texture, blends to the detail tile inside `REGION` from zoom 4, and draws the atmosphere glow around the globe.
- **Satellite day/night:** per-pixel solar elevation from the scene's Sun (mean Sun, or the real Sun when the lab switch is on). Day and night textures are blended across a twilight band (0° to −6°).
- **Loss and recovery:** redraw on `MapState` change via `requestAnimationFrame`. Handle `webglcontextlost` / `restored` by rebuilding.

### Fallback chain (owner rule: any error → existing solution)

1. **WebGL.**
2. **Canvas 2D fallback:** same math on the CPU; reduced resolution while dragging or zooming, full resolution on release.
3. **Atlas:** the SVG land layer is re-enabled and the style switch shows a one-line note ("This device can't draw this style; showing Atlas").

Triggers that move down the chain: no WebGL, shader compile/link failure, texture larger than `MAX_TEXTURE_SIZE`, image decode failure, out-of-memory, context lost without restore, any exception in the render loop.

- A device limited to 2048 px textures uses a 2048 px downscale made at decode time. Only if that fails does it fall back to canvas.
- Failures are not persisted beyond the page session.

### Political and Physical vectors

- Political fills, borders and names are SVG, clipped and simplified like the existing land.
- Names use label collision (`labelLayout.ts`) and tier visibility by zoom.
- Physical rivers, lakes and names follow the regional LOD rules (`REGION_MIN_ZOOM`, `REGION_DETAIL_ZOOM`).

### Print

- Worksheet and cheat sheet always render Atlas.
- Other printed pages include a canvas snapshot.

## 5. Controls and experience

- **Map style group** (`role="group"`, `aria-pressed` buttons: Atlas · Physical · Satellite · Political) on every map toolbar next to the projection switch, flat and globe. On phones below 480 px it is a compact disclosure menu. It is also in the Settings dialog.
- **Persistence:** saved in settings (validated like other settings). A scene may force a style when its text depends on it (`SceneSpec.mapStyle?`), e.g. topic 10 steps.
- **Class quiz:** the setup gains "Map style for the class" (defaults to the current style); it applies to that run only.
- **Worksheets and cheat sheet:** Atlas, no switch.
- **Loading:** "Loading map…" status (polite live region) during the first decode.
- **Map description:** the text alternative gains one sentence per style.
- **Reduced motion:** no crossfade between styles.
- **Presenter mode:** all styles; stronger halos.
- **New i18n** (EN/PL/UK): style names, hint, loading and fallback notes, class-quiz option, credits, physical names, topic 10, seasons mode, real-Sun switch and note.

## 6. Earth physics

### 6.1 Seasons mode (lab)

- **Control:** a new lab control `seasons` next to `sun-time` / `sun-date`.
- **Orbit view:** a new view `orbit` (SVG). The Sun sits in the centre; Earth is on its orbit seen from slightly above. The axis is tilted 23½° and fixed in space (towards Polaris).
  - Drag Earth along the orbit, or use arrow keys / PageUp-PageDown by day/month, to set the lab date.
  - For screen readers it is a slider with value text, e.g. "21 June, June solstice".
- **Linked views:** the globe and flat map show day and night for that date.
- **Readout for the movable point:**
  - day length;
  - sunrise and sunset in local mean solar time;
  - the subsolar latitude ("Sun overhead at 23°26′N");
  - polar day/night notes ("Polar day north of 66½°N").
- **Numbers:** as text, in the lesson's notation.

### 6.2 Topic 10 "Why we have seasons" (explore only)

Like topic 9: a home card, no Practise tab, excluded from rehearsal, class quiz and worksheet. Steps:

1. **`orbit`: Around the Sun in a year.**
2. **`tilt`: A tilted axis.** 23½°, always pointing towards the North Star.
3. **`june`: June solstice.** The Northern Hemisphere leans towards the Sun (summer, long days). The Sun is overhead at the Tropic of Cancer, and there is polar day inside the Arctic Circle.
4. **`december`: December solstice.** Mirrored; links to the tropics and polar circles from topic 1.
5. **`equinox`: Equinoxes.** The Sun is over the equator; day and night are about 12 h everywhere; 23 September is an equinox.
6. **`katowice`: Seasons in Katowice.** Day length in June vs December, and Sydney as a Southern Hemisphere example.
7. **`play`: Try it yourself.**

Every number in step texts is verified by a unit test against `src/geo/sun.ts` before commit.

### 6.3 Real Sun (lab only)

- **Switch:** "Advanced: real Sun", off by default, not saved.
- **When on:** the lab's daylight, noon line, Satellite day/night and clocks use apparent solar time (equation of time, declination from the date).
- **Note:** "The real Sun can be up to 16 minutes ahead of or behind clock time during the year, so noon moves up to 4° from the 12:00 meridian. Lessons use the average Sun."
- **Elsewhere:** lessons, questions and topic 8 always use the mean Sun.
- **Tilt:** shown as 23½° (as in topic 1 and school books); calculations use 23.44°.

## 7. Constraints

- Single file < 5,242,880 B (`scripts/size-check.ts` limit raised, with a per-asset breakdown on failure). No runtime network requests.
- No new runtime dependencies beyond what the shader and decoding need (none expected).
- Atlas pixel-identical to today; existing tests unchanged.
- WCAG 2.2 AA on every route × style × theme; AAA in presenter mode; 44 px targets; keyboard-only operable.
- Svelte 5 runes, TypeScript strict; follow existing module boundaries (`MapState`, layers, scenes as data).

## 8. Testing

- **Unit:**
  - inverse projections vs d3 (≤ 0.01°) for grid, Equal Earth, Mercator and orthographic, including rotation and clip edges;
  - equation of time and declination against published values;
  - day length and subsolar latitude used in topic 10;
  - political colouring (neighbours differ; Crimea inside Ukraine);
  - data build outputs (sizes, texture dimensions, sources recorded);
  - the style setting's validation;
  - the fallback chain as a pure state machine.
- **E2E (Playwright, software GL):**
  - pixel colour probes per style at known points (Sahara, Baltic Sea, Tatra relief, city lights over India at 17:00 UTC on 23 Sep), on flat and globe;
  - switch persistence;
  - the class quiz style is run-only;
  - worksheets stay Atlas;
  - forced failures (no WebGL, shader failure, decode failure, context loss) → Atlas plus the note;
  - topic 10 and Seasons mode by keyboard, with axe;
  - no horizontal scroll at 320–1366 px;
  - presenter contrast.
- **Performance smoke:** globe drag frame time in Satellite with CPU throttle ×4; first draw after style change.

## 9. Order of work

Each part is reviewed, tested and committed on its own.

1. Data builds (textures, detail tiles, rivers/lakes, political shapes, size check at 5 MB).
2. Texture layer: WebGL, canvas fallback, error fallback to Atlas.
3. Style switch, persistence, class quiz option, presenter halos, credits.
4. Political and Physical vector layers and labels.
5. Satellite day/night with city lights; real-Sun switch.
6. Seasons mode and topic 10.
7. Design/UX/accessibility pass across styles; final review; publish.

## 10. Risks

- **Old GPUs rejecting 4096 px textures:** 2048 px downscale, then canvas, then Atlas.
- **File grows to ≈ 3.5 MB:** fine on Wi-Fi, ≈ 3 MB once on mobile data.
- **Busy Physical/Satellite maps under the grid:** halo and contrast rules; design pass verifies.
- **≈ 60 new strings:** owner reviews Ukrainian and Polish on the translation sheet.
- **Software GL in CI differs from real GPUs:** probe colours with tolerance; manual check on a phone and the classroom projector.

## 11. Delivered separately

The lab **spin speed** control was requested during this brainstorm and is delivered first, independently.
