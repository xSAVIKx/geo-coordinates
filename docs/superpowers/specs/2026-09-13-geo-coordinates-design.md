# Geographic Coordinates — Interactive Lesson Page: Design

- **Date:** 2026-09-13
- **Status:** Draft, awaiting review
- **Deadline driver:** 6th-grade geography test on **2026-09-23**

## 1. Purpose

A single, self-contained, highly interactive HTML page that teaches 6th graders (age ~11–12,
Polish school system, mixed Polish- and Ukrainian-speaking class) how geographic coordinates work,
and lets them practise for the test.

It serves two situations:

- **Presenting** — a parent or teacher explains on a very large classroom screen driven by a laptop.
- **Self-practice** — kids use it on their own phones and tablets at home.

### Success criteria

- A child who works through topics 1–4 and 6 can read, place, and compare coordinates on a grid map
  and explain why latitude is measured in degrees.
- The page works fully offline from one file, and from a static host (GitHub Pages).
- The page works in English, Polish, and Ukrainian with correct school terminology and notation.
- The page meets WCAG 2.2 AA (AAA contrast in presenter mode) and every task can be done with
  keyboard only or a screen reader.
- The page is usable at 375 px phone width, on tablets, on laptops, and legible on a 4K projector
  from the back of a classroom.

### Non-goals

- No accounts, no server, no analytics, no collection of children's data.
- No realistic 3D/WebGL rendering or satellite imagery.
- No map zoom beyond what Natural Earth 110m outlines support (country level, not streets).
- Time zones are a "did you know" aside only; tested content is local solar time.

## 2. Content scope

Eight topics. The textbook is unavailable, so all plausible grade-6 content is included; topics 1–4
and 6 are treated as core and built first.

| # | Topic | Key ideas |
|---|-------|-----------|
| 1 | The globe grid | Meridians vs parallels; equator; prime (Greenwich) meridian; 180° meridian; hemispheres N/S/E/W; tropics and polar circles; Earth cross-section showing latitude as an angle at Earth's centre |
| 2 | Relative position | North/south of a parallel; east/west of a meridian; which of two points is further N/S/E/W |
| 3 | Reading coordinates | Read latitude and longitude of a point on globe and grid map; letter order and meaning |
| 4 | Placing a point | Given coordinates, find the location; name the place, country, or continent |
| 5 | Degrees and minutes | 1° = 60′; reading and placing with minutes |
| 6 | Differences in degrees | Latitude and longitude differences; same hemisphere subtract, different hemispheres add; longitude difference > 180° becomes 360° − sum |
| 7 | Distance along a meridian | 1° of meridian arc ≈ 111.2 km (111 accepted); distance from latitude difference |
| 8 | Longitude and time (Day/night lab) | Earth's rotation; 15° = 1 h, 1° = 4 min; further east = later local solar time; day/night terminator; polar day and night across the year |

## 3. User experience

### 3.1 Shell

- Header: title, language switch (**EN / PL / УК**), settings button.
- Language: auto-detected from `navigator.languages` on first visit, then remembered in
  `localStorage`. Switching updates `<html lang>` and all text immediately, without losing state.
- Settings: theme (system / light / dark), larger text, reduced motion (defaults to the
  `prefers-reduced-motion` value).
- Settings, language, and practice scores are stored only in `localStorage`, wrapped in try/catch;
  the page works when storage is unavailable.

### 3.2 Topics: Explore and Practice

Each topic has two tabs.

**Explore** — a guided walkthrough of 4–9 short steps. Each step has one idea in a sentence or two,
plus a map scene configured for it (view, visible layers, point position, allowed interactions,
and optional highlight). The last step is free play. Steps advance with buttons or ← → keys.

**Practice** — rounds of 10 generated questions from that topic.
- Instant feedback per question: correct/incorrect as text + icon (never colour alone), a short
  "why" explanation, and the solution drawn on the map.
- Difficulty selector: easy / medium / hard (see §5.2).
- Best score per topic and difficulty kept on-device.

### 3.3 Cross-topic modes

- **Test rehearsal** — 15 mixed questions across all topics, no per-question feedback, results at
  the end with every mistake explained and linked to its topic.
- **Class quiz (presenter)** — one very large question at a time, optional countdown (off / 15 /
  30 / 60 s), Space reveals the answer with an animation on the map, → goes to the next question.
  No scoring. A seed field lets the whole class share one question set.

### 3.4 Layout

- **Laptop / large screen (≥ 1024 px):** topic list left, map centre, step text and controls right.
- **Tablet (600–1023 px):** topic list in a menu, map on top or left depending on orientation.
- **Phone (< 600 px):** map on top, text and controls below, topics in a menu; globe and flat map
  switch with a toggle instead of side-by-side.
- **Presenter mode** (button or **P**): requests fullscreen, scales the UI with viewport-based
  type sizes for reading from far away, AAA contrast, thicker lines, ← → for steps, and an optional
  pointer highlight ("laser") that follows the cursor. **Esc** leaves it.

### 3.5 Routing

Hash routes, so every screen has a shareable link (useful for QR codes on a board) and Back works:

```
#<lang>/                      home (topic overview)
#<lang>/topic-<n>/explore[/<step>]
#<lang>/topic-<n>/practice
#<lang>/rehearsal
#<lang>/class-quiz[?seed=<s>]
#<lang>/lab                   Day/night lab free play
```

An unknown route falls back to home without an error.

## 4. Map and globe

### 4.1 Views

One shared map state (point position, rotation, visible layers, sun time/date) drives:

- **Globe** — orthographic projection; drag to rotate; buttons to rotate by 15° for non-drag users.
- **Flat map** — equirectangular projection with a rectangular grid, matching atlas maps; zoom and
  pan with pinch, wheel, and +/− buttons; presets "Poland", "Europe", "World".
- **Earth cross-section** — a side-view diagram showing the equatorial plane and the latitude angle
  at Earth's centre, used in topics 1 and 3.

On wide screens globe and flat map sit side by side; on phones one is shown at a time.

### 4.2 Layers

- Land and country outlines (Natural Earth 110m via `world-atlas`).
- Graticule at 10° by default; 5°, 15°, or 30° when a scene or question requires it; labelled
  degree values along the edges of the flat map.
- Emphasised lines: equator, prime meridian, 180° meridian — each with a text label and a distinct
  line style in addition to colour. Tropics and polar circles as an optional layer.
- Hemisphere shading with pattern fills in addition to colour.
- ~40 labelled places including Warszawa, Kraków, Gdańsk, Kyiv, Lviv, Odesa, London, Paris, Rome,
  Cairo, Nairobi, Cape Town, New York, Rio de Janeiro, Buenos Aires, Tokyo, Beijing, Delhi,
  Sydney, Reykjavík, plus continent and ocean labels. Coordinates stored to 0.01°; place names
  localised in all three languages.
- Teaching overlays: difference brackets (topic 6), distance ruler (topic 7), day/night terminator
  with twilight band, noon meridian, and meridian clocks (topic 8).

### 4.3 The movable point

- Drag with mouse or touch.
- Keyboard: arrow keys move 1°, Shift+arrow 10°. In minute mode (topic 5) arrows move 1′ and
  Shift+arrow 1°. (Alt+arrow is avoided because it means browser Back/Forward.)
- Snaps to whole degrees, or to minutes in topic 5.
- Live readout in the current language's notation (§6.2), e.g. **52°N, 21°E** or
  **52° пн. ш., 21° сх. д.**
- Boundary rules: latitude 0° has no N/S letter; longitude 0° and 180° have no E/W letter.
  Latitude is clamped to [−90°, 90°]; longitude wraps across 180°.

### 4.4 Day/night lab (topic 8)

- Subsolar point computed from date and UTC time using the NOAA solar position approximation;
  the terminator and a twilight band (sun 0° to −6° below the horizon) are drawn on both views.
- **Time slider** (UTC, 0–24 h): night moves westward; the noon meridian is highlighted.
- **Meridian clocks:** the user pins meridians or places; each shows local solar time
  (UTC + longitude / 15°), making "further east = later" visible.
- **Date slider** (day of year): shows polar day and polar night, linked to the polar circles
  from topic 1.
- **Now** button: sets the real current date and time.
- "Did you know" aside: the difference between solar time and time zones (why solar noon in
  Warsaw is not at 12:00).
- With reduced motion enabled, sliders update the scene without animated transitions.

## 5. Practice engine

### 5.1 Question generators

Each question type is a pure function:

```ts
type Generator = (rng: Rng, difficulty: Difficulty) => Question

interface Question {
  type: QuestionTypeId
  topic: TopicId
  promptKey: string               // i18n key
  promptParams: Record<string, unknown>
  input: InputSpec                // how the answer is given (see below)
  answer: AnswerSpec              // canonical correct answer
  check: (response: unknown) => CheckResult
  explanation: ExplanationSpec    // i18n key + params + map overlay to show
  scene: SceneSpec                // initial map configuration
}
```

Question types:

1. **Name the line / hemisphere** — pick which highlighted line or region it is (topic 1).
2. **Which is further** — which of 2–4 points lies further N/S/E/W (topic 2).
3. **Relative to a line** — is point P north/south of parallel X, or east/west of meridian Y
   (topic 2).
4. **Read coordinates** — type or select the latitude and longitude of a marked point (topics 3, 5).
5. **Place the point** — put the point at given coordinates, by dragging or with inputs
   (topics 4, 5).
6. **Which place is at** — given coordinates, choose the place (topic 4).
7. **Difference** — latitude or longitude difference between two points (topic 6).
8. **Distance** — distance along a meridian from a latitude difference, or the reverse (topic 7).
9. **Time** — local solar time at a place given the time at another, or the longitude difference
   from a time difference (topic 8).

Randomness uses a seeded PRNG so a seed reproduces a question set exactly.

### 5.2 Difficulty

- **Easy:** multiples of 10°; one hemisphere; no boundary crossings. (Exception: "which place is at"
  questions use real cities rounded to whole degrees.)
- **Medium:** any whole degree; crossings of the equator and the prime meridian. (Reading and placing
  coordinates at medium use multiples of 5°, so values can be read exactly on the 5° grid; any whole
  degree is used at hard with a 1° grid.)
- **Hard:** crossings of the 180° meridian, minutes (topic 5), multi-step questions. (Hard difference and
  distance questions in topics 6–7 use whole degrees; their difficulty comes from equator, prime-meridian
  and 180° crossings.)

Generators reject and redraw ambiguous cases: two points on the same meridian for an E/W question,
points exactly on the reference line, or points at a pole. East/west comparison questions never
span the 180° meridian ("further east" is ambiguous there); 180° crossings appear only in
difference, distance, and time questions.

### 5.3 Answer checking

- Every map-input question also accepts inputs from latitude/longitude fields or a list, so it is
  answerable without pointer precision.
- Typed coordinates accept flexible formats: `52N`, `52 N`, `52°N`, `52° N`, `52° пн. ш.`,
  `52°14′N`, `52 14 N`; letters in either the Latin or localised form.
- Placement answers must hit the exact whole degree (the point snaps, so this is achievable);
  minute questions accept ±1′.
- Distance answers accept values computed with 111 km or 111.2 km per degree, with a note when
  111 was used.
- Common mistakes get a targeted explanation: wrong letter (N vs S), subtracting instead of adding
  across a line, forgetting 360° − sum, earlier vs later in time questions.

## 6. Internationalisation

### 6.1 Structure

- `src/i18n/en.json`, `pl.json`, `uk.json` with identical key sets; ICU-style parameters and plural
  rules via `Intl.PluralRules` (Polish and Ukrainian have several plural forms).
- A test fails when any key is missing, extra, or has mismatched parameters in any language.
- Place names are in the same files.

### 6.2 Terminology and notation

| Concept | EN | PL | UK |
|---|---|---|---|
| Latitude | latitude | szerokość geograficzna | географічна широта |
| Longitude | longitude | długość geograficzna | географічна довгота |
| Meridian | meridian | południk | меридіан |
| Parallel | parallel | równoleżnik | паралель |
| Equator | equator | równik | екватор |
| Prime meridian | prime (Greenwich) meridian | południk zerowy (Greenwich) | нульовий (Гринвіцький) меридіан |
| Notation | 52°N, 21°E | 52°N, 21°E | 52° пн. ш., 21° сх. д. |
| S / W | 34°S, 58°W | 34°S, 58°W | 34° пд. ш., 58° зх. д. |

The Ukrainian version uses Ukrainian school notation with the same lesson content as the Polish
version.

### 6.3 Translation review

A build step generates `dist/translation-review.html`: a table with every key and its text in
all three languages side by side, for a native speaker to check. The project owner reviews the
Ukrainian and Polish texts before the page is shown to the class.

## 7. Accessibility

Target: **WCAG 2.2 AA**, and AAA contrast in presenter mode.

- **Equivalent input:** the map is never the only way to perceive or answer anything. Every visual
  has a text equivalent; every map task has input fields or a list of choices.
- **Point semantics:** the movable point is exposed as two `role="slider"` controls (latitude,
  longitude) with `aria-valuetext` like "52 degrees north". Value changes are announced through a
  polite live region, throttled to at most one announcement per 500 ms.
- **Places:** a real list of buttons that moves focus to and selects the place on the map.
- **Colour:** never the only signal. Lines use labels and dash patterns, and hemispheres use
  patterns. The palette is checked for colour-blindness (protanopia, deuteranopia, tritanopia).
- **Focus and targets:** visible focus on every interactive element, logical tab order, a skip link
  to main content, touch targets ≥ 44×44 px, and no drag-only interactions (WCAG 2.5.7).
- **Feedback:** correctness shown as text + icon and announced via a live region.
- **Motion:** globe rotation, transitions, and reveal animations respect `prefers-reduced-motion`
  and the in-app setting.
- **Reflow and zoom:** no horizontal page scroll at 320 CSS px; usable at 200% text size and
  400% zoom.
- **Language:** `lang` attributes are correct, including on place names shown in another language.
- **Themes:** light and dark palettes both meet contrast requirements, and SVG map colours come
  from the same CSS custom properties.

## 8. Architecture

### 8.1 Stack

- **Vite + TypeScript (strict) + Svelte 5.**
- **d3-geo** for projections and paths; **topojson-client** + **world-atlas** `countries-110m`
  for land data; data inlined into the bundle.
- **vite-plugin-singlefile** to produce one HTML file with all JS, CSS, and data inlined.
- System font stack (covers Latin Extended and Cyrillic, zero bytes).
- No runtime network requests of any kind.

### 8.2 Layout of the source

```
src/
  geo/          pure math, no DOM
                  format.ts      coordinate formatting + parsing per locale
                  compare.ts     relative position, differences, 360° − sum rule
                  distance.ts    meridian distance
                  time.ts        local solar time from longitude
                  sun.ts         subsolar point, terminator, twilight
  i18n/         en.json, pl.json, uk.json, store + t() helper, plural rules
  map/          MapState store, Globe.svelte, FlatMap.svelte, CrossSection.svelte,
                MovablePoint.svelte, layers/ (graticule, lines, hemispheres, places,
                overlays), places.ts (place data)
  quiz/         rng.ts, generators/ (one file per type), check.ts,
                Practice.svelte, Rehearsal.svelte, ClassQuiz.svelte, QuestionCard.svelte
  topics/       01-grid/ … 08-time/  each: steps.ts (scene configs) + optional scene components
  app/          App.svelte, router.ts, Settings.svelte, Presenter.svelte, Home.svelte
  styles/       tokens.css (colours, spacing, type scale for normal + presenter)
scripts/
  translation-review.ts
tests/
  unit/         Vitest
  e2e/          Playwright
dist/
  geo-coordinates.html        committed build output
  translation-review.html
```

Boundaries:
- `geo/` and `quiz/generators/` import no UI code and are fully unit-testable.
- Topics describe scenes as data (`SceneSpec`) consumed by `map/`, so topics do not reach into
  map internals.
- Only `i18n/` knows about languages; `geo/format.ts` receives a locale and returns strings.

### 8.3 Delivery

- `npm run build` writes `dist/geo-coordinates.html` (size budget **< 1 MB**, enforced by a test)
  and `dist/translation-review.html`; both are committed.
- The repository will later be pushed to GitHub and published with GitHub Pages; the single file
  works there as-is. Deployment workflow setup is out of scope for this spec.

## 9. Testing

### 9.1 Unit (Vitest)

- `geo/`: formatting and parsing in all locales, boundary cases (0°, ±90°, 180°, −180°), relative
  position, differences within and across hemispheres and across 180°, distances, solar time,
  and subsolar point against NOAA reference values within 0.5°.
- Generators: for each type and difficulty, 1,000 seeds produce questions whose canonical answer
  passes `check`, whose values are in range, which avoid the rejected ambiguous cases, and whose
  explanation keys exist in all locales.
- Seed determinism: same seed produces the same set.
- i18n: identical key sets and parameters across locales.

### 9.2 End-to-end (Playwright, against the built single file)

- Opened via `file://` with all network requests blocked, to prove it works offline.
- Every route × 3 languages × light/dark: no console errors, and an **axe-core** scan with zero
  violations.
- A keyboard-only practice round completed from start to finish.
- Screenshots at 375×667, 768×1024, 1366×768, and 3840×2160 (presenter mode), reviewed manually.
- Build size stays under the budget.

### 9.3 Manual

- Screen reader spot checks of the movable point, the place list, and question feedback.
- Real-device check on at least one phone and one tablet.

## 10. Milestones

| Target | Deliverable |
|---|---|
| ~2026-09-16 | Shell, routing, i18n, globe and flat map, movable point, topics 1–4 with Explore and Practice, in all three languages |
| ~2026-09-18 | Topics 5–7, Test rehearsal, Class quiz |
| ~2026-09-19 | Topic 8, Day/night lab |
| ~2026-09-20 | Translation review sheet, accessibility and screen-size pass, fixes |

Each milestone ends with a committed, working `dist/geo-coordinates.html`, so a usable version
exists early even if later milestones slip.
