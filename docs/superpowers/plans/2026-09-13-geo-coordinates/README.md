# Geographic Coordinates Lesson Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one self-contained, offline-capable HTML page (EN/PL/UK) that teaches 6th graders geographic coordinates with an interactive globe and flat map, guided Explore steps, generated Practice questions, a Test rehearsal, a Class quiz, and a Day/night lab.

**Architecture:** Svelte 5 + TypeScript app bundled by Vite into a single HTML file. Pure, unit-tested modules (`src/geo`, `src/quiz/generators`) hold all geography math and question logic; `src/map` renders SVG views with d3-geo from one shared rune-based `MapState`; topics are data (`SceneSpec` + i18n keys) consumed by generic Explore/Practice screens.

**Tech Stack:** Node 24, npm 11, Vite 8.0.x, Svelte 5.57.x, @sveltejs/vite-plugin-svelte 7.x, TypeScript 6.0.x, svelte-check 4.x, vite-plugin-singlefile 2.3.x, d3-geo 3.1.x, topojson-client 3.1.x, world-atlas 2.0.x, Vitest 5.x, @playwright/test 1.63.0, @axe-core/playwright 4.x.

**Spec:** `docs/superpowers/specs/2026-09-13-geo-coordinates-design.md` — read it before any task.

The plan is split into files because of its size. Execute tasks in numeric order.

| File | Tasks |
|---|---|
| `01-foundation.md` | 1 Scaffold · 2 Coordinate formatting & parsing · 3 Comparison, distance, time math · 4 Sun position · 5 i18n core |
| `02-shell-and-map.md` | 6 App shell, router, settings · 7 Map data & MapState · 8 Flat map · 9 Globe & MapStage · 10 Coordinate controls, announcer, place list · 11 Cross-section |
| `03-topics-and-practice.md` | 12 Topic framework + topics 1–4 Explore · 13 Quiz core + generators for topics 1–4 · 14 Practice UI (milestone 1 build) |
| `04-advanced-topics-and-modes.md` | 15 Topics 5–7 (minutes, differences, distance) · 16 Test rehearsal & Class quiz |
| `05-daynight-presenter-review.md` | 17 Day/night lab & topic 8 · 18 Presenter mode · 19 Translation review sheet · 20 E2E a11y/responsive suite & final pass |

## Global Constraints

- Output: one file `dist/geo-coordinates.html`, all JS/CSS/data inlined, **< 1 MB** (1,048,576 bytes); committed to git.
- **No runtime network requests** of any kind (no CDN, no fonts, no fetch). System font stack only.
- Languages: `en`, `pl`, `uk` — identical i18n key sets; a test enforces parity.
- Notation (spec §6.2): EN/PL `52°N, 21°E`, with minutes `52°14′N`; UK `52° пн. ш., 21° сх. д.`, with minutes `52°14′ пн. ш.`; S/W → UK `пд. ш.` / `зх. д.`
- Latitude 0° has no N/S letter; longitude 0° and 180° have no E/W letter. Latitude ∈ [−90, 90]; longitude normalized to (−180, 180].
- 1° of meridian = **111.2 km** (111 also accepted in answers, with a note). 15° = 1 h; 1° = 4 min; east = later.
- Accessibility: WCAG 2.2 AA; AAA contrast in presenter mode; touch targets ≥ 44×44 CSS px; no drag-only interactions; colour never the only signal; respect `prefers-reduced-motion` and the in-app setting; no horizontal page scroll at 320 CSS px.
- Breakpoints: phone `< 600px`, tablet `600–1023px`, large `≥ 1024px`.
- `localStorage` access always wrapped in try/catch via `src/app/storage.ts`; storage keys prefixed `geo-coords:`.
- Hash routes exactly as spec §3.5; unknown route → home.
- Commit identity is preconfigured in the repo (Yurii Serhiichuk <yurii@serhiichuk.dev>); do not change it. No attribution trailers in commits.
- If a command under `/srv/work` fails with EPERM / EAFNOSUPPORT / sandbox-looking errors, load the `agent-session-failures` skill before improvising.
- Polish and Ukrainian texts are written by the implementer using the terminology table in spec §6.2 and natural school-level language for 11–12-year-olds (short sentences, "you" form: PL „ty”, UK «ти»). English text given in this plan is the source of truth for meaning.

## File Map

```
package.json, tsconfig.json, svelte.config.js, vite.config.ts, vitest.config.ts,
playwright.config.ts, geo-coordinates.html, .gitignore
src/
  main.ts                         mounts App
  app/
    App.svelte                    shell: header, skip link, route outlet, live region
    Header.svelte                 title, language switch, settings & presenter buttons
    SettingsDialog.svelte         theme / large text / reduced motion
    Home.svelte                   topic cards + rehearsal / class quiz / lab entries
    TopicPage.svelte              tabs Explore | Practice
    Explore.svelte                step walkthrough
    router.ts                     parseRoute / formatRoute (pure)
    router.svelte.ts              reactive current route + navigate()
    settings.svelte.ts            persisted settings state
    storage.ts                    safe localStorage
    announcer.svelte.ts           announce() + LiveRegion state
    LiveRegion.svelte
    presenter.svelte.ts           presenter state, key handling
    Laser.svelte
  geo/
    types.ts                      LatLon, Precision, LangCode
    format.ts                     normalize, formatLat/Lon/LatLon, parseAngle
    compare.ts                    hemispheres, relative position, differences
    distance.ts                   meridian distance
    time.ts                       solar time
    sun.ts                        subsolar point, elevation
  i18n/
    en.json, pl.json, uk.json
    i18n.svelte.ts                lang state, t(), tn(), detectLang(), setLang()
    spoken.ts                     spoken coordinate strings for aria-valuetext
    text.ts                       Text type + renderText()
  map/
    types.ts                      SceneSpec, LayerFlags, Overlay, FlatPreset
    mapState.svelte.ts            MapState class + singleton
    world.ts                      land + borders GeoJSON from world-atlas
    places.ts                     place list
    MapStage.svelte               arranges views + controls
    FlatMap.svelte, Globe.svelte, CrossSection.svelte
    CoordinateControls.svelte     two role=slider controls + readout
    PlaceList.svelte
    layers/ Graticule.svelte, SpecialLines.svelte, Hemispheres.svelte, Land.svelte,
            Places.svelte, PointMarker.svelte, Overlays.svelte, Daylight.svelte,
            EdgeLabels.svelte
    LabControls.svelte            sun time/date sliders, Now, clocks (Task 17)
  quiz/
    types.ts, rng.ts, registry.ts, check.ts, scores.ts
    generators/ nameLine.ts, further.ts, relativeLine.ts, readCoords.ts, placePoint.ts,
                whichPlace.ts, difference.ts, distance.ts, time.ts
    QuestionCard.svelte, Feedback.svelte, Practice.svelte, Rehearsal.svelte, ClassQuiz.svelte
    inputs/ ChoiceInput.svelte, CoordsInput.svelte, NumberInput.svelte, ClockInput.svelte
  topics/
    types.ts, index.ts, t1-grid.ts … t8-time.ts
  styles/
    tokens.css, base.css
scripts/
  translation-review.ts
tests/
  unit/  *.test.ts
  e2e/   *.spec.ts, helpers.ts
```

The map above lists the main files; small helpers introduced by tasks (`src/app/ids.ts`, `src/app/testMode.ts`, `src/app/LabPage.svelte`, `src/map/geometry.ts`, `src/map/Slider.svelte`, `src/quiz/values.ts`, `src/quiz/answerText.ts`, `src/quiz/generators/coordValues.ts`, `src/quiz/Countdown.svelte`, `scripts/size-check.ts`, `scripts/shot.ts`, `scripts/translation-review-lib.ts`) are specified in their tasks.

## Shared contracts (defined in early tasks, used everywhere)

These are copied verbatim into the task that creates them. Later tasks must use these exact names.

```ts
// src/geo/types.ts (Task 2)
export type LangCode = 'en' | 'pl' | 'uk';
export const LANGS: readonly LangCode[] = ['en', 'pl', 'uk'];
export interface LatLon { lat: number; lon: number }
export type Precision = 'degree' | 'minute';
export type Axis = 'lat' | 'lon';

// src/i18n/text.ts (Task 5)
export type TextParam = string | number | { coord: LatLon; axis?: Axis | 'both'; precision?: Precision } | { place: string } | { text: Text };
export interface Text { key: string; params?: Record<string, TextParam>; count?: number }

// src/map/types.ts (Task 7)
export type ViewId = 'globe' | 'flat' | 'cross-section';
export type FlatPreset = 'world' | 'europe' | 'poland';
export interface LayerFlags {
  graticuleStep: 1 | 5 | 10 | 15 | 30;
  specialLines: boolean;      // equator, prime meridian, 180°
  tropics: boolean;           // tropics + polar circles
  hemispheres: 'none' | 'ns' | 'ew';
  places: boolean;
  borders: boolean;
  daylight: boolean;
  pointGuides: boolean;       // dashed parallel + meridian through the point
}
export type MarkerTone = 'a' | 'b' | 'c' | 'd' | 'answer' | 'wrong';
export type Overlay =
  | { kind: 'marker'; p: LatLon; tone: MarkerTone; label?: string }
  | { kind: 'highlight-line'; axis: Axis; value: number }
  | { kind: 'highlight-region'; region: 'N' | 'S' | 'E' | 'W' }
  | { kind: 'lat-diff'; a: LatLon; b: LatLon }
  | { kind: 'lon-diff'; a: LatLon; b: LatLon }
  | { kind: 'distance'; a: LatLon; b: LatLon }
  | { kind: 'noon-meridian' };
export type LabControl = 'sun-time' | 'sun-date' | 'clocks' | 'now';
export interface SceneSpec {
  views: ViewId[];                       // views shown, in order
  layers?: Partial<LayerFlags>;
  point?: LatLon | null;                 // null hides the movable point
  pointEditable?: boolean;
  precision?: Precision;
  showReadout?: boolean;                 // default true; false hides readout + sliders
  rotate?: [number, number];             // globe rotation [lambda, phi] in degrees
  globeZoom?: number;                    // globe zoom factor; default 1
  flatPreset?: FlatPreset;
  flatView?: { center: LatLon; zoom: number }; // overrides flatPreset
  overlays?: Overlay[];
  sun?: { utcMinutes: number; dayOfYear: number } | null;
  labControls?: LabControl[];
}

// src/quiz/types.ts (Task 13)
export type Difficulty = 'easy' | 'medium' | 'hard';
export type { TopicId } from '../app/ids';   // TopicId is defined in src/app/ids.ts (Task 6)
export type QuestionTypeId = 'name-line' | 'further' | 'relative-line' | 'read-coords' | 'place-point' | 'which-place' | 'difference' | 'distance' | 'time';
export type Answer =
  | { kind: 'choice'; index: number }
  | { kind: 'coords'; value: LatLon }
  | { kind: 'number'; value: number }
  | { kind: 'clock'; minutes: number };
export type InputSpec =
  | { kind: 'choice'; options: Text[] }
  | { kind: 'coords'; precision: Precision; fields: Axis | 'both'; mapPick: boolean }
  | { kind: 'number'; unit: 'deg' | 'km' | 'h' | 'min' }
  | { kind: 'clock' };
export interface Question {
  id: string;                  // `${type}-${seedIndex}`
  type: QuestionTypeId;
  topic: TopicId;
  difficulty: Difficulty;
  prompt: Text;
  input: InputSpec;
  answer: Answer;
  explanation: Text;
  scene: SceneSpec;            // shown while answering
  solution: Overlay[];         // added to the scene after answering
  meta?: Record<string, string | number>; // generator-private data used by check()
}
export interface CheckResult { correct: boolean; mistake?: Text; note?: Text }
export interface Rng { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T; shuffle<T>(items: readonly T[]): T[] }
export interface QuestionModule {
  type: QuestionTypeId;
  topics: TopicId[];
  generate(rng: Rng, difficulty: Difficulty, topic: TopicId): Question;
  check(q: Question, response: Answer): CheckResult;
  describeAnswer(q: Question): Text;   // the correct answer as text, for feedback
}

// src/topics/types.ts (Task 12)
export interface ExploreStep { id: string; scene: SceneSpec; showPlaces?: boolean }  // text: `topic.<n>.step.<id>.title` / `.body`
export interface TopicDef { id: TopicId; steps: ExploreStep[]; questionTypes: QuestionTypeId[] }
```

## Execution notes for the controller

- After Task 14, `npm run build` must produce a usable milestone-1 page; commit `dist/`.
- After every task: `npm run check && npm test` must pass before commit (from Task 1 on).
- Tasks 8, 9, 11, 17, 18 are visual: the implementer takes Playwright screenshots (`npm run shot -- <hash> <name>`, script defined in Task 1) at 375×667 and 1366×768 and looks at them before reporting done.
