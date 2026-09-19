# Places Up Close: City-Scale Maps — Design

- **Date:** 2026-09-19
- **Status:** Approved in brainstorming, awaiting written-spec review
- **Builds on:** `2026-09-15-map-styles-and-seasons-design.md` (map styles, textures, the image layer) and the released `main` (live: https://xsavikx.github.io/geo-coordinates/)

## 1. Purpose

Let a pupil zoom from the globe down to their own school — and to eleven other places — and still see a real map: an aerial photo with streets, water and buildings drawn over it, sharp enough to point at a building and read its coordinates.

Today the sharpest imagery is the Central Europe tile at about 1.9 km per pixel, so deep zoom dissolves into colour. This adds a third level of detail inside twelve small boxes.

### Success criteria

- From the globe, a pupil reaches their school's street in one tap from the places list, and the map is legible when they arrive.
- At a city box the coordinate readout, point marker, grid and edge labels behave exactly as they do now, so "what are the coordinates of the school gate?" is answerable to the minute.
- Three of the twelve places show a coordinate line painted on the ground: the Greenwich meridian strip, the equator monument at Mitad del Mundo, the Arctic Circle marker at Rovaniemi.
- Outside the twelve boxes nothing changes, at any zoom or style.
- The single file stays under **8 MiB** (8,388,608 B), still offline, still no runtime network requests.
- WCAG 2.2 AA holds on every route × style × theme; AAA in presenter mode.

### Non-goals

- Worldwide street data. Only the twelve boxes.
- Live or updatable imagery. The photos are baked in at build time.
- Practice questions at city scale; the test uses plain maps, and questions, rehearsal and worksheets stay on them.
- Routing, search, or anything resembling a navigation app.

## 2. Owner decisions (brainstorm, 2026-09-19)

| Topic | Decision |
|---|---|
| Purpose | Find their own school **and** famous places |
| Detail | Aerial photo **under** street lines, like a phone map |
| Budget | Raise the single-file limit from 5 MiB to **8 MiB**; about twelve places at full detail |
| The twelve | The school and Katowice; Greenwich Observatory; Mitad del Mundo (Ecuador); the Arctic Circle marker at Rovaniemi; Warsaw; Kraków; Paris; Manhattan; Delhi; Sydney; Tokyo; Giza |
| Where it appears | Free play, the lab, and topic 9's "find coordinates in a map app" step. Not in questions, rehearsal or worksheets |

## 3. The twelve boxes

Each box is about 6 × 4 km, centred on the named feature, and carries a photo, vector streets and a short label.

| # | Place | Centre (approx.) | Why it is here |
|---|---|---|---|
| 1 | **Katowice — Maple Bear school** | 50.26 N, 19.02 E | The pupils' own ground; the schools list already centres here |
| 2 | Greenwich, Royal Observatory | 51.4779 N, 0.0015 W | The prime meridian is painted on the courtyard |
| 3 | Mitad del Mundo, Ecuador | 0.0022 S, 78.4558 W | The equator monument; 0° latitude on the ground |
| 4 | Rovaniemi, Arctic Circle | 66.5436 N, 25.8475 E | The Arctic Circle line is marked across the site |
| 5 | Warsaw | 52.2297 N, 21.0122 E | Capital; already in the places list |
| 6 | Kraków | 50.0647 N, 19.9450 E | Nearby, and used in topic 4's example |
| 7 | Paris | 48.8584 N, 2.2945 E | Eiffel Tower |
| 8 | Manhattan | 40.7484 N, 73.9857 W | The US classmate's city; grid streets read beautifully from above |
| 9 | Delhi | 28.6129 N, 77.2295 E | The Indian classmate's city |
| 10 | Sydney | 33.8568 S, 151.2153 E | Southern hemisphere, negative latitude |
| 11 | Tokyo | 35.6595 N, 139.7004 E | Far east longitude |
| 12 | Giza | 29.9792 N, 31.1342 E | Pyramids; recognisable from above |

Exact boxes are fixed in the build script and listed in the data manifest.

## 4. Data and licensing

- **Photo: Copernicus Sentinel-2 L2A**, 10 m per pixel, via the open AWS catalogue (Earth Search STAC, verified reachable). The build picks the clearest recent scene per box, crops the box, colour-corrects lightly and writes WebP.
  - Credit: "Contains modified Copernicus Sentinel data [year]" in the footer, the README, `LICENSE-CONTENT.md` and the built file's licence comment.
- **Streets: OpenStreetMap** via Overpass, per box: roads by class, railways, water, parks and building outlines, plus street and place names. Simplified, quantized and stored as TopoJSON.
  - Credit: "© OpenStreetMap contributors" with an ODbL note, in the same four places.
  - Build-time only, cached; Overpass is queried once per box with an identifying User-Agent and a polite delay.
- **Names** are the local ones from OSM (`name`), with `name:en` kept where present; our own labels stay in the pupil's language.
- Nothing is fetched at runtime; every byte is in the file.

## 5. Rendering

- **Photo:** a third level in the existing texture layer, which already blends a sharper Central Europe tile over the world image. A city box is the same mechanism with a tighter bounding box and a higher zoom threshold. No new rendering path, no new shader — the region-blend uniform becomes a list of up to two boxes (region, city).
  - Photo levels appear in **Physical** and **Satellite** only.
- **Streets:** a new SVG vector layer drawn above the photo and below the graticule, active only inside a box and only above its zoom threshold. In **Atlas** and **Political** the street map appears without a photo, which suits those styles.
- **Labels:** street and place names go through the existing label-collision helper, in the map-label ink with the per-style casing, and never displace the lesson's own labels (places, schools, the point).
- **Thresholds:** the city photo fades in from about zoom 40 and the streets from about zoom 24, tuned per box so a box never appears as a sharp rectangle against blur at its edge.
- **Fallback:** everything obeys the existing chain — any failure in the texture path falls back to Atlas; a failure in the street layer disables that layer only, as the other vector layers do.

## 6. Controls and experience

- **The places list** (the existing schools and places disclosure) gains a "Places up close" group with the twelve, each centring the map and setting the zoom so the box fills the view.
- **A short note** appears for the three teaching places, e.g. "The prime meridian is painted across this courtyard — you are standing on 0° longitude." EN/PL/UK.
- **Topic 9's `find` step** gains one sentence pointing at the feature, since that is the step about reading coordinates from a phone map.
- **No new toggle.** The close-ups are part of the map, not a mode.
- Accessibility: the list entries are ordinary buttons; the new layer is decorative for screen readers except the names, which follow the existing map-label rules; the map's text description gains one sentence when a city box is on screen.

## 7. Constraints

- Single file < **8,388,608 B**; `scripts/size-check.ts` limit raised, with the per-asset breakdown listing each place.
- No runtime network requests; works offline from disk.
- Atlas at desktop stays pixel-identical outside the boxes (the 7 baselines stand); inside a box, Atlas gains the street map, which is a deliberate, owner-approved change.
- Mean Sun, Poland point-of-view borders, EN/PL/UK parity, 44 px targets, keyboard operable: unchanged.
- Svelte 5 runes, TypeScript strict; build scripts follow `scripts/build-textures.py` and `scripts/build-political.ts`.

## 8. Testing

- **Unit:** box maths (which box a view is in, blend factors at the thresholds), the data builds (sizes, dimensions, bounds, sources recorded), the street-layer level of detail, label placement inside a box.
- **E2E:** each of the twelve reached from the list lands with the box filling the view; a pixel probe inside the box differs from the same point at the previous zoom (the photo really sharpened); the street layer appears in all four styles with the right combination of photo and lines; the three teaching places show their note; axe on the routes involved; no horizontal scroll at 320 px.
- **Visual:** a contact sheet of all twelve at phone and desktop size, reviewed by eye before commit, kept as evidence.
- **Performance:** first draw after entering a box, and drag frame time inside one, measured with the existing perf harness.

## 9. Order of work

1. Data build: photos for the twelve boxes (script, manifest, credits).
2. Data build: street vectors for the twelve boxes (script, simplification, names).
3. Size budget to 8 MiB with a per-place breakdown; embed the new assets.
4. Texture layer: the third blend level and its thresholds.
5. Street layer and its labels, in all four styles.
6. Places list entries, the three teaching notes, topic 9's sentence, EN/PL/UK strings.
7. Design, UX and accessibility pass across the twelve; release prep and docs.

## 10. Risks

- **Cloud cover** over a box in every recent scene: the build picks the clearest and I inspect all twelve; a box may end up in a different season.
- **Overpass rate limits** or outages at build time: cached raw responses, one query per box, polite delay; the build must not depend on it after the data is committed.
- **8 MB first load** on mobile data: one-time and cached; the classroom case is Wi-Fi.
- **OSM data quality** varies by place; building outlines are dense in Europe and sparse elsewhere, so each box is inspected rather than assumed.
- **Label clutter** at city scale: street names must not bury the lesson's own labels; the design pass checks this specifically.
