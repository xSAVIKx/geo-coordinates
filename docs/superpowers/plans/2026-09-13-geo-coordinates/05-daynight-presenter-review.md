# Part 5 — Day/night, presenter mode, translation review, final pass (Tasks 17–20)

Read `README.md` first.

---

### Task 17: Day/night lab, topic 8 and time questions

**Files:**
- Create: `src/map/layers/Daylight.svelte`, `src/map/LabControls.svelte`, `src/quiz/generators/time.ts`, `src/quiz/inputs/ClockInput.svelte`, `src/topics/t8-time.ts`
- Modify: `src/map/layers/Layers.svelte` (daylight after graticule), `src/map/layers/Overlays.svelte` (`noon-meridian`), `src/map/MapStage.svelte` (render `LabControls` when `mapState.labControls.length`), `src/map/mapState.svelte.ts` (`setSunNow()`), `src/app/LabPage.svelte`, `src/app/TopicPage.svelte` (remove "coming soon" for defined topics — keep the guard), `src/quiz/registry.ts`, `src/quiz/QuestionCard.svelte` (clock branch), `src/topics/index.ts`, `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/time-generator.test.ts`, `tests/unit/mapState.test.ts` (setSunNow), e2e `tests/e2e/lab.spec.ts`; extend `explore.spec.ts`/`practice.spec.ts` loops to topic 8; rehearsal spec clock branch

**Interfaces:**
- Consumes: `subsolarPoint`, `antisolarPoint`, `solarElevationDeg`, `dateFromDayAndMinutes`, `dayOfYear` (Task 4); `localSolarMinutes`, `solarOffsetMinutes`, `formatClock`, `wrapDayMinutes` (Task 3); `Slider` (Task 10); `PLACES` (Task 7).
- Produces:
  - `MapState.setSunNow(now?: Date): void` — `sun = { utcMinutes, dayOfYear, year }` from `now` (default `new Date()`).
  - `MapState.sunDate(): Date | null` — `dateFromDayAndMinutes(year, dayOfYear, utcMinutes)` or null.
  - `Daylight.svelte` props `{ ctx: ViewCtx }` — when `mapState.layers.daylight && mapState.sun`: twilight band (`geoCircle` radius 90° around the antisolar point, fill `--twilight`), night (radius 84°, fill `--night`), and a sun symbol at the subsolar point when visible.
  - `LabControls.svelte` (no props) — renders the controls listed in `mapState.labControls`.
  - `time` module: `type: 'time'`, `topics: [8]`; variants `later` (choice), `clock` (input `{ kind: 'clock' }`, answer `{ kind: 'clock', minutes }`), `degrees` (number, unit `deg`).
  - `ClockInput.svelte` — one text field, accepts `H:MM`, `HH:MM`, `HH.MM`; value `{ kind: 'clock', minutes }`.

- [ ] **Step 1: MapState sun helpers** — add to `tests/unit/mapState.test.ts`:

```ts
  test('setSunNow and sunDate', () => {
    const s = new MapState();
    s.layers.daylight = true;
    s.setSunNow(new Date('2026-09-23T10:30:00Z'));
    expect(s.sun).toEqual({ utcMinutes: 630, dayOfYear: 266, year: 2026 });
    expect(s.sunDate()!.toISOString()).toBe('2026-09-23T10:30:00.000Z');
  });
```
Implement in `mapState.svelte.ts` (import `dateFromDayAndMinutes`, `dayOfYear` from `../geo/sun`):
```ts
  setSunNow(now: Date = new Date()): void {
    this.sun = { utcMinutes: now.getUTCHours() * 60 + now.getUTCMinutes(), dayOfYear: dayOfYear(now), year: now.getUTCFullYear() };
  }

  sunDate(): Date | null {
    return this.sun ? dateFromDayAndMinutes(this.sun.year, this.sun.dayOfYear, this.sun.utcMinutes) : null;
  }
```

- [ ] **Step 2: i18n keys (UI)**

| key | en | pl | uk |
|---|---|---|---|
| lab.intro | Move the Sun through the day and the year. Watch day and night travel around the Earth and see what time it is in different places. | Przesuwaj Słońce w ciągu dnia i roku. Zobacz, jak dzień i noc wędrują po Ziemi i która jest godzina w różnych miejscach. | Рухай Сонце протягом доби й року. Дивись, як день і ніч мандрують Землею і котра година в різних місцях. |
| lab.time | Time (UTC, Greenwich) | Godzina (UTC, Greenwich) | Час (UTC, Гринвіч) |
| lab.date | Day of the year | Dzień roku | День року |
| lab.now | Now | Teraz | Зараз |
| lab.play | Spin the Earth | Obracaj Ziemię | Обертати Землю |
| lab.pause | Stop | Zatrzymaj | Зупинити |
| lab.clocks | Local solar time | Czas słoneczny | Місцевий сонячний час |
| lab.place | Place | Miejsce | Місце |
| lab.solarTime | Solar time | Czas słoneczny | Сонячний час |
| lab.dayNight | Day or night | Dzień czy noc | День чи ніч |
| lab.day | day | dzień | день |
| lab.night | night | noc | ніч |
| lab.thePoint | The point ({lon}) | Punkt ({lon}) | Точка ({lon}) |
| lab.noon | Noon | Południe | Полудень |
| lab.didYouKnowTitle | Did you know? | Czy wiesz, że…? | Чи знаєш ти? |
| lab.didYouKnow | Our clocks do not show solar time. A whole country uses one time zone, so in Warsaw the Sun is highest at about 11:36 in winter and about 12:36 in summer. | Zegarki nie pokazują czasu słonecznego. Cały kraj ma jedną strefę czasową, dlatego w Warszawie Słońce jest najwyżej zimą około 11:36, a latem około 12:36. | Годинники не показують сонячного часу. Уся країна живе в одному часовому поясі, тому у Варшаві Сонце найвище взимку близько 11:36, а влітку — близько 12:36. |
| map.daylight.label | Day and night on the Earth | Dzień i noc na Ziemi | День і ніч на Землі |

- [ ] **Step 3: `src/map/layers/Daylight.svelte`**

```svelte
<script lang="ts">
  import { geoCircle } from 'd3-geo';
  import { antisolarPoint, subsolarPoint } from '../../geo/sun';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const date = $derived(mapState.layers.daylight ? mapState.sunDate() : null);
  const shapes = $derived.by(() => {
    if (!date) return null;
    const anti = antisolarPoint(date);
    const sun = subsolarPoint(date);
    return {
      twilight: ctx.path(geoCircle().center([anti.lon, anti.lat]).radius(90).precision(2)()) ?? '',
      night: ctx.path(geoCircle().center([anti.lon, anti.lat]).radius(84).precision(2)()) ?? '',
      sun: ctx.project(sun),
    };
  });
</script>

{#if shapes}
  <path d={shapes.twilight} class="twilight" />
  <path d={shapes.night} class="night" />
  {#if shapes.sun}
    <g class="sun" transform="translate({shapes.sun[0]} {shapes.sun[1]})">
      {#each Array.from({ length: 8 }, (_, i) => i * 45) as a (a)}
        <line x1="0" y1={-13 * ctx.px} x2="0" y2={-19 * ctx.px} transform="rotate({a})" />
      {/each}
      <circle r={9 * ctx.px} />
    </g>
  {/if}
{/if}

<style>
  .twilight { fill: var(--twilight); }
  .night { fill: var(--night); }
  .sun circle { fill: var(--sun); stroke: var(--text); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .sun line { stroke: var(--sun); stroke-width: 3; stroke-linecap: round; vector-effect: non-scaling-stroke; }
</style>
```
In `Layers.svelte` insert `<Daylight {ctx} />` between `<SpecialLines>` and `<Places>`.

- [ ] **Step 4: `noon-meridian` overlay** — in `Overlays.svelte` (import `subsolarPoint`, `t`):
```svelte
  {:else if o.kind === 'noon-meridian'}
    {@const d = mapState.sunDate()}
    {#if d}
      {@const lon = subsolarPoint(d).lon}
      <path class="noon" d={ctx.path(meridianLine(lon)) ?? ''} />
      {@const xy = ctx.project({ lat: 35, lon })}
      {#if xy}<text class="halo noon-t" x={xy[0] + 6 * ctx.px} y={xy[1]} font-size={15 * ctx.px}>{t('lab.noon')} 12:00</text>{/if}
    {/if}
```
Style: `.noon { fill: none; stroke: var(--sun); stroke-width: 4; stroke-dasharray: 10 6; vector-effect: non-scaling-stroke; } .noon-t { fill: var(--text); font-weight: 800; }`.

- [ ] **Step 5: `src/map/LabControls.svelte`**

```svelte
<script lang="ts">
  import { motionReduced } from '../app/settings.svelte';
  import { formatLon } from '../geo/format';
  import { solarElevationDeg } from '../geo/sun';
  import { formatClock, localSolarMinutes } from '../geo/time';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { placeById } from './places';
  import Slider from './Slider.svelte';

  const CLOCK_PLACES = ['london', 'warsaw', 'kyiv', 'newyork', 'tokyo'];
  let playing = $state(false);

  $effect(() => {
    if (!playing || !mapState.sun) return;
    const id = setInterval(() => {
      if (!mapState.sun) return;
      mapState.sun = { ...mapState.sun, utcMinutes: (mapState.sun.utcMinutes + 10) % 1440 };
    }, 100);
    return () => clearInterval(id);
  });

  const dateLabel = $derived.by(() => {
    const d = mapState.sunDate();
    return d ? new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d) : '';
  });
  const clocks = $derived.by(() => {
    const d = mapState.sunDate();
    if (!d || !mapState.sun) return [];
    const rows = CLOCK_PLACES.map((id) => { const p = placeById(id); return { id, name: t(`place.${id}`), lat: p.lat, lon: p.lon }; });
    if (mapState.point) rows.push({ id: 'point', name: t('lab.thePoint', { lon: formatLon(mapState.point.lon, i18n.lang) }), ...mapState.point });
    return rows.map((r) => ({ ...r, time: formatClock(localSolarMinutes(mapState.sun!.utcMinutes, r.lon)), day: solarElevationDeg(d, r) > 0 }));
  });
</script>

{#if mapState.sun}
  <div class="lab">
    <div class="sliders">
      {#if mapState.labControls.includes('sun-time')}
        <Slider label={t('lab.time')} min={0} max={1439} step={15} bigStep={60} value={mapState.sun.utcMinutes}
          display={formatClock(mapState.sun.utcMinutes)} valueText={`${formatClock(mapState.sun.utcMinutes)} UTC`}
          onchange={(v) => mapState.sun && (mapState.sun = { ...mapState.sun, utcMinutes: Math.round(v) })} />
      {/if}
      {#if mapState.labControls.includes('sun-date')}
        <Slider label={t('lab.date')} min={1} max={365} step={1} bigStep={30} value={mapState.sun.dayOfYear}
          display={dateLabel} valueText={dateLabel}
          onchange={(v) => mapState.sun && (mapState.sun = { ...mapState.sun, dayOfYear: Math.round(v) })} />
      {/if}
    </div>
    <div class="buttons">
      {#if mapState.labControls.includes('now')}
        <button type="button" onclick={() => mapState.setSunNow()}>{t('lab.now')}</button>
      {/if}
      {#if mapState.labControls.includes('sun-time') && !motionReduced()}
        <button type="button" aria-pressed={playing} onclick={() => (playing = !playing)}>{playing ? t('lab.pause') : t('lab.play')}</button>
      {/if}
    </div>
    {#if mapState.labControls.includes('clocks')}
      <table>
        <caption>{t('lab.clocks')}</caption>
        <thead><tr><th scope="col">{t('lab.place')}</th><th scope="col">{t('lab.solarTime')}</th><th scope="col">{t('lab.dayNight')}</th></tr></thead>
        <tbody>
          {#each clocks as c (c.id)}
            <tr><th scope="row">{c.name}</th><td class="time">{c.time}</td><td><span aria-hidden="true">{c.day ? '☀️' : '🌙'}</span> {c.day ? t('lab.day') : t('lab.night')}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
  .lab { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3) var(--space-4); display: grid; gap: var(--space-3); }
  .sliders { display: grid; gap: var(--space-3) var(--space-6); grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .buttons button { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-4); font-weight: 600; }
  .buttons button[aria-pressed='true'] { background: var(--accent); color: var(--accent-contrast); }
  table { border-collapse: collapse; width: 100%; }
  caption { text-align: left; font-weight: 700; padding-bottom: var(--space-2); }
  th, td { text-align: left; padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--border); }
  .time { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 1.15rem; }
</style>
```
In `MapStage.svelte` add `{#if mapState.labControls.length}<LabControls />{/if}` after `CoordinateControls`. Spinning stops automatically when the component unmounts (the effect cleanup clears the interval).

- [ ] **Step 6: Lab page** — `src/app/LabPage.svelte` scene becomes:
```ts
    mapState.applyScene({ views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true, daylight: true }, sun: { utcMinutes: 720, dayOfYear: 80 }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'sun-date', 'now', 'clocks'] });
    mapState.setSunNow();
```
and below `MapStage` add:
```svelte
<aside class="dyk"><h2>{t('lab.didYouKnowTitle')}</h2><p>{t('lab.didYouKnow')}</p></aside>
<style>.dyk { margin-top: var(--space-4); background: var(--surface-2); border-radius: var(--radius); padding: var(--space-3) var(--space-4); max-width: 60ch; } .dyk h2 { margin: 0 0 var(--space-1); font-size: 1.15rem; }</style>
```
Replace `lab.intro` usage (already the key) — text updated in Step 2.

- [ ] **Step 7: Topic 8** — `src/topics/t8-time.ts`:

```ts
import type { TopicDef } from './types';

const equinoxNoon = { utcMinutes: 720, dayOfYear: 80 };
export const topic8: TopicDef = {
  id: 8,
  questionTypes: ['time'],
  steps: [
    { id: 'rotation', scene: { views: ['globe', 'flat'], point: null, rotate: [0, -20], sun: equinoxNoon, layers: { specialLines: true, daylight: true, places: false }, labControls: ['sun-time'] } },
    { id: 'noon', scene: { views: ['globe', 'flat'], point: null, rotate: [0, -20], sun: equinoxNoon, layers: { specialLines: true, daylight: true, places: false }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time'] } },
    { id: 'fifteen', scene: { views: ['flat'], point: null, sun: equinoxNoon, layers: { specialLines: true, daylight: true, graticuleStep: 15, places: false }, overlays: [{ kind: 'noon-meridian' }, { kind: 'highlight-line', axis: 'lon', value: 15 }], labControls: ['sun-time'] } },
    { id: 'east-later', scene: { views: ['flat'], point: null, flatPreset: 'europe', sun: equinoxNoon, layers: { specialLines: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'clocks'] } },
    { id: 'calculate', scene: { views: ['flat'], point: null, flatPreset: 'europe', sun: { utcMinutes: 636, dayOfYear: 80 }, layers: { specialLines: true, daylight: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 21 }, { kind: 'highlight-line', axis: 'lon', value: 31 }, { kind: 'marker', p: { lat: 52, lon: 21 }, tone: 'a', label: '12:00' }, { kind: 'marker', p: { lat: 50, lon: 31 }, tone: 'b', label: '12:40' }], labControls: ['clocks'] } },
    { id: 'seasons', scene: { views: ['globe', 'flat'], point: null, rotate: [-20, -55], sun: { utcMinutes: 720, dayOfYear: 172 }, layers: { specialLines: true, tropics: true, daylight: true, places: false }, labControls: ['sun-date', 'sun-time'] } },
    { id: 'zones', scene: { views: ['flat'], point: null, flatPreset: 'europe', sun: { utcMinutes: 636, dayOfYear: 20 }, layers: { specialLines: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'clocks'] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, sun: equinoxNoon, layers: { specialLines: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'sun-date', 'now', 'clocks'] } },
  ],
};
```
Register `8: topic8` in `TOPICS`. The `equinoxNoon` (day 80) solar noon at Greenwich is ~12:07 UTC — the noon overlay uses the real subsolar longitude, so the line sits ~2° west of 0° at 12:00 UTC; that is correct and the "zones" step explains why clocks differ from the Sun.

Step texts (EN source):
- `rotation` — **The Earth spins** — "The Earth turns once a day, from west to east. The half facing the Sun has day, the other half has night. Drag the time slider and watch night move."
- `noon` — **Noon on a meridian** — "When the Sun is at its highest over a meridian, it is noon — 12:00 local solar time — along that whole meridian, from pole to pole."
- `fifteen` — **15° every hour** — "The Earth turns 360° in 24 hours. That is 15° every hour, and 1° every 4 minutes."
- `east-later` — **East is later** — "The Sun rises in the east, so places further east have a later solar time. When it is 12:00 in London (0°), it is about 13:24 in Warsaw (21°E): 21 × 4 min = 84 min."
- `calculate` — **Let's calculate** — "Warsaw (21°E) and Kyiv (31°E) are 10° apart, which is 10 × 4 = 40 minutes. When it is 12:00 solar time in Warsaw, it is 12:40 in Kyiv, because Kyiv is further east."
- `seasons` — **Polar day and polar night** — "The Earth's axis is tilted. Move the date: around 21 June the area around the North Pole has day all the time, and around 21 December it has night all the time."
- `zones` — **Did you know? Time zones** — "Clocks do not show solar time. A whole country uses one time zone, so in Warsaw the Sun is highest at about 11:36 in winter and about 12:36 in summer."
- `play` — **Day and night lab** — "Move the time, the date and the point. Watch the clocks and the line of noon."

- [ ] **Step 8: Time generator — tests**

`tests/unit/time-generator.test.ts`:
```ts
import { expect, test } from 'vitest';
import { time } from '../../src/quiz/generators/time';
import { createRng } from '../../src/quiz/rng';

test('clock answers follow "east is later" and wrap around midnight', () => {
  for (let s = 0; s < 500; s++) {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const q = time.generate(createRng(`t${s}`), d, 8);
      if (q.answer.kind !== 'clock') continue;
      const m = q.meta as { lonA: number; lonB: number; minutesA: number };
      const expected = ((m.minutesA + (((m.lonB - m.lonA + 540) % 360) - 180) * 4) % 1440 + 1440) % 1440;
      expect(q.answer.minutes).toBe(expected);
      const wrongWay = ((m.minutesA - (((m.lonB - m.lonA + 540) % 360) - 180) * 4) % 1440 + 1440) % 1440;
      if (wrongWay !== expected) expect(time.check(q, { kind: 'clock', minutes: wrongWay }).mistake?.key).toBe('q.time.mistake.direction');
    }
  }
});
```
(`generators.test.ts` covers answerability and keys automatically once the module is registered.)

- [ ] **Step 9: `src/quiz/generators/time.ts`**

```ts
import { lonDifference } from '../../geo/compare';
import { normalizeLon } from '../../geo/format';
import { formatClock, solarOffsetMinutes, wrapDayMinutes } from '../../geo/time';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { numberText } from '../answerText';
import { checkChoice, choiceText } from '../check';
import { gridInt, signed } from '../values';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';

function lons(rng: Rng, d: Difficulty): [number, number] {
  for (;;) {
    let a: number, b: number;
    if (d === 'easy') { const s = signed(rng); a = gridInt(rng, 0, 165, 15) * s; b = gridInt(rng, 0, 165, 15) * s; }
    else if (d === 'medium') { a = rng.int(-90, 90); b = a + rng.int(5, 90) * signed(rng); }
    else { a = rng.int(120, 179) * signed(rng); b = -Math.sign(a) * rng.int(120, 179); } // across 180°
    b = normalizeLon(b);
    const diff = lonDifference(a, b);
    if (diff > 0 && diff < 180) return [a, b];
  }
}

const duration = (min: number): Text => ({ key: 'q.time.duration', params: { h: Math.floor(Math.abs(min) / 60), m: Math.abs(min) % 60 } });

export const time: QuestionModule = {
  type: 'time',
  topics: [8],
  generate(rng, difficulty): Question {
    const [lonA, lonB] = lons(rng, difficulty);
    const A: LatLon = { lat: rng.int(-50, 60), lon: lonA }, B: LatLon = { lat: rng.int(-50, 60), lon: lonB };
    const offset = solarOffsetMinutes(lonA, lonB); // positive → B is east → later
    const diffDeg = lonDifference(lonA, lonB);
    const variant = difficulty === 'easy' ? rng.pick(['later', 'clock'] as const) : rng.pick(['later', 'clock', 'clock', 'degrees'] as const);
    const scene = {
      views: ['flat' as const], point: null,
      layers: { specialLines: true, places: false, graticuleStep: 15 as const },
      overlays: [{ kind: 'highlight-line' as const, axis: 'lon' as const, value: lonA }, { kind: 'highlight-line' as const, axis: 'lon' as const, value: lonB }, { kind: 'marker' as const, p: A, tone: 'a' as const, label: 'A' }, { kind: 'marker' as const, p: B, tone: 'b' as const, label: 'B' }],
    };
    const base = { id: '', type: 'time' as const, topic: 8 as const, difficulty, scene, solution: [] };
    const dir = offset > 0 ? 'east' : 'west';

    if (variant === 'later') {
      return {
        ...base,
        prompt: { key: 'q.time.prompt.later', params: { a: { coord: A, axis: 'lon' }, b: { coord: B, axis: 'lon' } } },
        input: { kind: 'choice', options: [{ key: 'q.time.opt.a' }, { key: 'q.time.opt.b' }] },
        answer: { kind: 'choice', index: offset > 0 ? 1 : 0 },
        explanation: { key: `q.time.explain.later.${dir}` },
      };
    }
    if (variant === 'degrees') {
      const minutes = Math.abs(offset);
      return {
        ...base,
        prompt: { key: 'q.time.prompt.degrees', params: { duration: { text: duration(minutes) } } },
        input: { kind: 'number', unit: 'deg' },
        answer: { kind: 'number', value: diffDeg },
        explanation: { key: 'q.time.explain.degrees', params: { min: minutes, deg: diffDeg } },
        meta: { lonA, lonB },
      };
    }
    const minutesA = difficulty === 'easy' ? rng.int(6, 18) * 60 : rng.int(0, 95) * 15;
    const minutesB = wrapDayMinutes(minutesA + offset);
    return {
      ...base,
      prompt: { key: 'q.time.prompt.clock', params: { time: formatClock(minutesA), a: { coord: A, axis: 'lon' }, b: { coord: B, axis: 'lon' } } },
      input: { kind: 'clock' },
      answer: { kind: 'clock', minutes: minutesB },
      explanation: { key: `q.time.explain.clock.${dir}`, params: { deg: diffDeg, min: Math.abs(offset), timeA: formatClock(minutesA), timeB: formatClock(minutesB) } },
      meta: { lonA, lonB, minutesA },
    };
  },
  check(q, r) {
    if (q.input.kind === 'choice') return checkChoice(q, r);
    if (q.answer.kind === 'number') return { correct: r.kind === 'number' && Math.abs(r.value - q.answer.value) < 1e-9 };
    if (q.answer.kind !== 'clock' || r.kind !== 'clock') return { correct: false };
    if (r.minutes === q.answer.minutes) return { correct: true };
    const m = q.meta as { lonA: number; lonB: number; minutesA: number };
    const wrongWay = wrapDayMinutes(m.minutesA - solarOffsetMinutes(m.lonA, m.lonB));
    return { correct: false, mistake: r.minutes === wrongWay ? { key: 'q.time.mistake.direction' } : undefined };
  },
  describeAnswer(q) {
    if (q.input.kind === 'choice') return choiceText(q);
    if (q.answer.kind === 'number') return numberText(q.answer.value, 'deg');
    return { key: 'q.answer.clock', params: { time: formatClock((q.answer as { minutes: number }).minutes) } };
  },
};
```
Register in `MODULES`.

Generator keys (EN source):
```
q.time.prompt.later        Where is the local solar time later: at A ({a}) or at B ({b})?
q.time.opt.a               At A
q.time.opt.b               At B
q.time.explain.later.east  B lies further east than A. The Sun reaches places in the east earlier, so their time is later.
q.time.explain.later.west  A lies further east than B. The Sun reaches places in the east earlier, so their time is later.
q.time.prompt.clock        At A ({a}) it is {time} local solar time. What is the local solar time at B ({b})?
q.time.explain.clock.east  The meridians are {deg}° apart: {deg} × 4 min = {min} min. B is further east, so its time is later: {timeA} + {min} min = {timeB}.
q.time.explain.clock.west  The meridians are {deg}° apart: {deg} × 4 min = {min} min. B is further west, so its time is earlier: {timeA} − {min} min = {timeB}.
q.time.prompt.degrees      The difference in local solar time between two places is {duration}. How many degrees of longitude apart are they?
q.time.explain.degrees     Every 4 minutes is 1°: {min} ÷ 4 = {deg}°.
q.time.duration            {h} h {m} min
q.time.mistake.direction   Wrong direction! Further east means a later time, further west means an earlier time.
```
PL `q.time.duration` "{h} godz. {m} min", UK "{h} год {m} хв". The `clock` explanations cross midnight naturally ("23:30 + 80 min = 00:50").

- [ ] **Step 10: `src/quiz/inputs/ClockInput.svelte`** and QuestionCard branch

```svelte
<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import type { Answer } from '../types';

  let { value = $bindable(null), disabled = false, invalid = false, describedBy }: { value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string } = $props();
  const uid = `clock-${Math.random().toString(36).slice(2, 8)}`;
  let text = $state('');

  $effect(() => {
    if (disabled) return;
    const m = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/.exec(text);
    const h = m ? Number(m[1]) : NaN, min = m ? Number(m[2]) : NaN;
    value = m && h <= 23 && min <= 59 ? { kind: 'clock', minutes: h * 60 + min } : null;
  });
</script>

<div class="field">
  <label for={uid}>{t('input.clock')}</label>
  <input id={uid} type="text" inputmode="numeric" autocomplete="off" placeholder="12:00" bind:value={text} {disabled}
    aria-invalid={invalid} aria-describedby="{uid}-ex {describedBy ?? ''}" />
  <span id="{uid}-ex" class:err={invalid}>{invalid ? t('input.clockInvalid') : t('input.example', { example: '13:24' })}</span>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  label { font-weight: 600; }
  input { min-height: var(--tap); width: 8rem; font-size: 1.5rem; font-variant-numeric: tabular-nums; padding: 0 var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  input[aria-invalid='true'] { border-color: var(--bad); }
  .err { color: var(--bad); font-weight: 600; }
</style>
```
Keys: `input.clock` "Time (hours:minutes)" / "Godzina (godz.:min)" / "Час (год:хв)"; `input.clockInvalid` "Write the time like 13:24" / "Wpisz godzinę tak: 13:24" / "Запиши час так: 13:24".
In `QuestionCard.svelte` add `{:else if question.input.kind === 'clock'}<ClockInput bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" />`.

- [ ] **Step 11: E2E**

`tests/e2e/lab.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab: time slider moves night and updates clocks', async ({ page }) => {
  await openPage(page, 'en/lab');
  const time = page.getByRole('slider', { name: 'Time (UTC, Greenwich)' });
  await time.focus();
  await page.keyboard.press('Home');
  await expect(time).toHaveAttribute('aria-valuetext', '00:00 UTC');
  const warsaw = page.getByRole('row', { name: /Warsaw/ });
  await expect(warsaw).toContainText('01:24');
  await expect(warsaw).toContainText('night');
  await page.keyboard.press('PageUp'); // +60 min
  await expect(warsaw).toContainText('02:24');
  await expectNoAxeViolations(page, 'lab');
  expect(pageErrors(page)).toEqual([]);
});

test('lab: date slider shows polar night in December at the North Pole', async ({ page }) => {
  await openPage(page, 'pl/lab');
  const date = page.getByRole('slider', { name: 'Dzień roku' });
  await date.focus();
  await page.keyboard.press('End');
  await expect(date).toHaveAttribute('aria-valuetext', /grudnia/);
});

test('reduced motion hides the spin button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/lab');
  await expect(page.getByRole('button', { name: 'Spin the Earth' })).toHaveCount(0);
});
```
Extend loops: `explore.spec.ts` and `practice.spec.ts` topic lists to `[1..8]`; in `answerCorrectlyWithKeyboard` add a `clock` branch: `const m = a.minutes!; await page.getByRole('textbox').first().fill(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)`. In `rehearsal.spec.ts`, for one textbox, fill `'12:00'` when the textbox's label is "Time (hours:minutes)", else `'1'`.

- [ ] **Step 12: Run and look** — all checks; screenshots `npm run shot -- "en/lab" lab-daynight`, `npm run shot -- "uk/topic-8/explore/6" t8-seasons dark`. Verify: night shading visible but land still readable underneath, sun symbol, noon line label, clocks table fits at 375 px.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(time): day/night lab with real sun position, topic 8 and solar time questions"
```

---

### Task 18: Presenter mode

**Files:**
- Create: `src/app/presenter.svelte.ts`, `src/app/Laser.svelte`
- Modify: `src/app/App.svelte`, `src/app/Header.svelte` (presenter + laser buttons), `src/styles/tokens.css`, `src/styles/base.css`, `src/map/FlatMap.svelte` and `src/map/Globe.svelte` (`uiScale`), `src/map/layers/*.svelte` (stroke widths via `--stroke-scale`), `src/i18n/{en,pl,uk}.json`
- Test: `tests/e2e/presenter.spec.ts`

**Interfaces:**
- Produces:
  - `presenter.svelte.ts`: `presenter: { on: boolean; laser: boolean }` (`$state`), `togglePresenter(): Promise<void>`, `toggleLaser(): void`, `installPresenterKeys(): () => void` (global `P` toggles presenter, `L` toggles laser while presenting; ignored when focus is in an input/textarea/select/`[role=slider]`/dialog). Applies `data-presenter="true|false"` on `<html>`. Entering requests fullscreen (errors ignored); leaving fullscreen via Esc turns presenter off (listen to `fullscreenchange`).
  - `uiScale` in maps: `(settings.largeText ? 1.25 : 1) * (presenter.on ? 1.6 : 1)`.

- [ ] **Step 1: i18n keys**

| key | en | pl | uk |
|---|---|---|---|
| header.presenter | Presenter mode | Tryb prezentacji | Режим презентації |
| header.laser | Pointer highlight | Wskaźnik | Указка |
| presenter.hint | P: presenter mode · L: pointer · ← →: steps · Esc: exit | P: prezentacja · L: wskaźnik · ← →: kroki · Esc: wyjście | P: презентація · L: указка · ← →: кроки · Esc: вихід |

- [ ] **Step 2: `src/app/presenter.svelte.ts`**

```ts
export const presenter = $state({ on: false, laser: false });

function apply(): void {
  document.documentElement.dataset.presenter = String(presenter.on);
}

export async function togglePresenter(): Promise<void> {
  presenter.on = !presenter.on;
  if (!presenter.on) presenter.laser = false;
  apply();
  try {
    if (presenter.on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!presenter.on && document.fullscreenElement) await document.exitFullscreen();
  } catch { /* fullscreen not allowed; presenter styling still applies */ }
}

export function toggleLaser(): void {
  if (presenter.on) presenter.laser = !presenter.laser;
}

export function installPresenterKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as Element | null;
    if (el?.closest('input, textarea, select, [role="slider"], dialog, [contenteditable]')) return;
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); void togglePresenter(); }
    else if ((e.key === 'l' || e.key === 'L') && presenter.on) { e.preventDefault(); toggleLaser(); }
  };
  const onFs = () => { if (!document.fullscreenElement && presenter.on) { presenter.on = false; presenter.laser = false; apply(); } };
  window.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', onFs);
  apply();
  return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); };
}
```

- [ ] **Step 3: `src/app/Laser.svelte`**

```svelte
<script lang="ts">
  import { presenter } from './presenter.svelte';
  let x = $state(-100), y = $state(-100);
  $effect(() => {
    if (!presenter.laser) return;
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  });
</script>

{#if presenter.laser}
  <div class="laser" aria-hidden="true" style:transform="translate({x}px, {y}px)"></div>
{/if}

<style>
  .laser { position: fixed; left: -28px; top: -28px; width: 56px; height: 56px; border-radius: 50%; pointer-events: none; z-index: 1000;
    background: radial-gradient(circle, rgb(255 30 30 / 0.95) 0 22%, rgb(255 30 30 / 0.35) 45%, transparent 70%); }
</style>
```

- [ ] **Step 4: Wire up** — `App.svelte`: `onMount(() => { const stop = startRouter(); const keys = installPresenterKeys(); return () => { stop(); keys(); }; });`, render `<Laser />` after `<LiveRegion />`, and when `presenter.on` render `<p class="presenter-hint">{t('presenter.hint')}</p>` at the end of `main` (hidden on `hover: none` devices). `Header.svelte`: add before the settings button:
```svelte
    <button type="button" class="icon-btn" aria-pressed={presenter.on} onclick={() => togglePresenter()}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 4h18v12H3zM5 6v8h14V6zM11 17h2v2h4v2H7v-2h4z"/></svg>
      <span class="label">{t('header.presenter')}</span>
    </button>
    {#if presenter.on}
      <button type="button" class="icon-btn" aria-pressed={presenter.laser} onclick={toggleLaser}><span aria-hidden="true">🔴</span><span class="label">{t('header.laser')}</span></button>
    {/if}
```
Map components: import `presenter` and change `uiScale` as described.

- [ ] **Step 5: Presenter styles** — append to `tokens.css`:

```css
:root { --stroke-scale: 1; }
:root[data-presenter="true"] {
  --stroke-scale: 1.6;
  --text: #0b0f14; --text-muted: #26303b; --border: #56616e; --accent: #0842a0; --focus: #0842a0;
  --grid: #3e5264; --land-stroke: #5e5238; --ok: #0f5c26; --bad: #8c1d18;
  --equator: #9a3208; --prime: #4c1d95; --antimeridian: #0b5750; --tropics: #6b4104;
}
@media (prefers-color-scheme: dark) {
  :root[data-presenter="true"]:not([data-theme="light"]) {
    --text: #ffffff; --text-muted: #e3e9f0; --border: #9aa8b8; --accent: #b3d0ff; --focus: #b3d0ff;
    --grid: #b8c7d6; --ok: #9ff0b3; --bad: #ffb3ab; --equator: #ffb27a; --prime: #ddd2ff; --antimeridian: #9ff5e6; --tropics: #ffe38a;
  }
}
:root[data-presenter="true"][data-theme="dark"] {
  --text: #ffffff; --text-muted: #e3e9f0; --border: #9aa8b8; --accent: #b3d0ff; --focus: #b3d0ff;
  --grid: #b8c7d6; --ok: #9ff0b3; --bad: #ffb3ab; --equator: #ffb27a; --prime: #ddd2ff; --antimeridian: #9ff5e6; --tropics: #ffe38a;
}
```
Append to `base.css`:
```css
:root[data-presenter="true"] { font-size: clamp(18px, 1.3vw, 44px); }
:root[data-presenter="true"] .skip { display: none; }
.presenter-hint { position: fixed; bottom: 0.5rem; right: 1rem; margin: 0; color: var(--text-muted); font-size: 0.8rem; }
@media (hover: none) { .presenter-hint { display: none; } }
```
In every layer component replace fixed `stroke-width: N` on map lines with `stroke-width: calc(Npx * var(--stroke-scale))` (keep `vector-effect: non-scaling-stroke`). Explore/Practice panels already use `rem`/`clamp`, so they grow with the root font size. The accent colours above give ≥ 7:1 against `--surface` (white / #18202a); verify with axe's `color-contrast-enhanced` rule in Step 6 and adjust tokens (not rules) if it fails.

- [ ] **Step 6: E2E** `tests/e2e/presenter.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openPage } from './helpers';

for (const scheme of ['light', 'dark'] as const) {
  test(`presenter mode (${scheme}) scales up and meets AAA contrast`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/topic-3/explore/4');
    const before = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    const after = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(after).toBeGreaterThan(before * 1.4);
    const results = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
    expect(results.violations.map((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
    await page.locator('body').press('l');
    await page.mouse.move(600, 400);
    await expect(page.locator('.laser')).toBeVisible();
    await page.screenshot({ path: `shots/presenter-${scheme}-1920.png` });
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.screenshot({ path: `shots/presenter-${scheme}-3840.png` });
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
  });
}

test('P typed into a text field does not toggle presenter mode', async ({ page }) => {
  await openPage(page, 'en/topic-3/practice');
  await page.getByRole('textbox').first().fill('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
});
```
View `shots/presenter-*.png`: text must be readable from "the back of a classroom" (headline ≥ ~60 px tall at 3840 wide), map lines visibly thicker.

- [ ] **Step 7: Run and commit**

```bash
npm run check && npm test && npm run build && npm run e2e
git add -A
git commit -m "feat(app): presenter mode with fullscreen, AAA contrast, scaled UI and pointer highlight"
```

---

### Task 19: Translation review sheet and language sanity checks

**Files:**
- Create: `scripts/translation-review-lib.ts`, `scripts/translation-review.ts`
- Modify: `package.json` (`build` runs the review script), `tests/unit/i18n.test.ts` (script sanity checks)
- Test: `tests/unit/translation-review.test.ts`

**Interfaces:**
- Produces:
  - `buildReviewHtml(messages: Record<'en' | 'pl' | 'uk', Record<string, string>>): string` — full standalone HTML page: title, short instructions, filter box (plain inline JS), one table grouped by key prefix (`app`, `topic.3`, `q`, …) with columns Key / English / Polski / Українська, cells carrying `lang`. Rows are flagged (yellow background + text "check") when PL or UK text equals EN text, when UK contains 3+ consecutive Latin letters (allow-list: `UTC`, `Greenwich` is **not** allowed — UK uses «Гринвіч»), or when PL contains Cyrillic.
  - `findSuspicious(messages): { key: string; lang: 'pl' | 'uk'; reason: 'same-as-en' | 'latin-in-uk' | 'cyrillic-in-pl' }[]` with an allow-list for legitimately identical strings (`q.answer.*`, `unit.label.deg`, `place.*` identical names like Berlin/Oslo, `classQuiz.seconds` in PL, `{n} km`, strings that are only params/symbols).
  - `dist/translation-review.html` produced by `npm run build`.

- [ ] **Step 1: Test** `tests/unit/translation-review.test.ts`:

```ts
import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { buildReviewHtml, findSuspicious } from '../../scripts/translation-review-lib';

test('flags suspicious strings', () => {
  const found = findSuspicious({
    en: { 'a.one': 'Hello', 'a.two': 'North', 'place.oslo': 'Oslo' },
    pl: { 'a.one': 'Hello', 'a.two': 'Północ', 'place.oslo': 'Oslo' },
    uk: { 'a.one': 'Привіт', 'a.two': 'North пн', 'place.oslo': 'Осло' },
  });
  expect(found).toEqual([
    { key: 'a.one', lang: 'pl', reason: 'same-as-en' },
    { key: 'a.two', lang: 'uk', reason: 'latin-in-uk' },
  ]);
});

test('real message files have no suspicious strings', () => {
  expect(findSuspicious({ en, pl, uk })).toEqual([]);
});

test('review page lists every key with lang attributes', () => {
  const html = buildReviewHtml({ en, pl, uk });
  for (const key of Object.keys(en)) expect(html).toContain(`data-key="${key}"`);
  expect(html).toContain('lang="uk"');
  expect(html).toContain('<title>');
});
```

- [ ] **Step 2: Implement `scripts/translation-review-lib.ts`**

```ts
type Lang = 'en' | 'pl' | 'uk';
type Messages = Record<Lang, Record<string, string>>;
export interface Suspicious { key: string; lang: 'pl' | 'uk'; reason: 'same-as-en' | 'latin-in-uk' | 'cyrillic-in-pl' }

const SAME_OK = [/^q\.answer\./, /^unit\.label\.deg$/, /^place\./, /^label\.australia$/, /^classQuiz\.seconds$/, /^unit\.km$/, /^spoken\./, /^q\.further\.option$/];
const onlySymbols = (s: string) => s.replace(/\{\w+\}/g, '').replace(/[\s\d°′:.,()\-–—·←→#%]/g, '') === '';
const LATIN_OK = /\b(UTC|N|S|E|W|A|B|C|D|P|L|Esc)\b/g;

export function findSuspicious(m: Messages): Suspicious[] {
  const out: Suspicious[] = [];
  for (const key of Object.keys(m.en)) {
    const en = m.en[key]!;
    for (const lang of ['pl', 'uk'] as const) {
      const v = m[lang][key];
      if (v === undefined) continue;
      if (v === en && !onlySymbols(v) && !SAME_OK.some((r) => r.test(key))) out.push({ key, lang, reason: 'same-as-en' });
      else if (lang === 'uk' && /[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, '').replace(LATIN_OK, ''))) out.push({ key, lang, reason: 'latin-in-uk' });
      else if (lang === 'pl' && /[Ѐ-ӿ]/.test(v)) out.push({ key, lang, reason: 'cyrillic-in-pl' });
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildReviewHtml(m: Messages): string {
  const flagged = new Set(findSuspicious(m).map((s) => `${s.key}|${s.lang}`));
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(m.en).sort()) {
    const parts = key.split('.');
    const group = parts[0] === 'topic' ? parts.slice(0, 2).join('.') : parts[0]!;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  const rows = [...groups.entries()].map(([group, keys]) => `
    <tbody><tr class="group"><th colspan="4">${esc(group)}</th></tr>
    ${keys.map((k) => `<tr data-key="${esc(k)}"><td class="key">${esc(k)}</td>${(['en', 'pl', 'uk'] as const).map((l) => `<td lang="${l}"${flagged.has(`${k}|${l}`) ? ' class="flag"' : ''}>${esc(m[l][k] ?? '— MISSING —')}${flagged.has(`${k}|${l}`) ? ' <strong>check</strong>' : ''}</td>`).join('')}</tr>`).join('')}
    </tbody>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Translation review — Coordinates</title>
<style>body{font:15px/1.45 system-ui,sans-serif;margin:1rem;color:#1b2430}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c9d1db;padding:.35rem .5rem;vertical-align:top;text-align:left}.key{font:12px ui-monospace,monospace;color:#4a5666;white-space:nowrap}.group th{background:#eef2f6;font-size:1.05rem}.flag{background:#fff3c4}input{font:inherit;padding:.4rem;width:min(30rem,100%);margin:.5rem 0 1rem}</style></head>
<body><h1>Translation review</h1><p>Every text in the lesson page, side by side. Yellow cells marked <strong>check</strong> may be untranslated or use the wrong alphabet. Filter by key or text:</p>
<input id="f" type="search" aria-label="Filter"><table><thead><tr><th>Key</th><th>English</th><th>Polski</th><th>Українська</th></tr></thead>${rows}</table>
<script>document.getElementById('f').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('tr[data-key]').forEach(r=>{r.hidden=q&&!r.textContent.toLowerCase().includes(q)})})</script>
</body></html>`;
}
```

`scripts/translation-review.ts`:
```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildReviewHtml } from './translation-review-lib.ts';

const load = (l: string) => JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8')) as Record<string, string>;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/translation-review.html', buildReviewHtml({ en: load('en'), pl: load('pl'), uk: load('uk') }));
console.log('wrote dist/translation-review.html');
```
`package.json` → `"build": "vite build && node --experimental-strip-types scripts/size-check.ts && node --experimental-strip-types scripts/translation-review.ts"`.

- [ ] **Step 3: Run** `npx vitest run tests/unit/translation-review.test.ts`. The "real message files" test will likely flag real strings: fix the **translations** (a PL string left in English, a UK string with Latin words). Only extend the allow-list for strings that are legitimately identical (e.g. "Nairobi", "Lima", "Sydney" are under `place.` already).

- [ ] **Step 4: Build and commit**

```bash
npm run check && npm test && npm run build
git add -A
git commit -m "feat(i18n): translation review sheet and alphabet sanity checks"
```

---

### Task 20: Full accessibility/responsive E2E sweep, final polish and README

**Files:**
- Create: `tests/e2e/routes.spec.ts`, `tests/e2e/responsive.spec.ts`, `README.md`
- Modify: whatever the sweep reveals; `dist/*` (final build)

**Interfaces:**
- Consumes: everything.
- Produces: final `dist/geo-coordinates.html` and `dist/translation-review.html`; project `README.md`.

- [ ] **Step 1: `tests/e2e/routes.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const ROUTES = [
  '', 'lab', 'rehearsal', 'class-quiz',
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [`topic-${n}/explore`, `topic-${n}/practice`]),
];

for (const scheme of ['light', 'dark'] as const) {
  for (const lang of ['en', 'pl', 'uk'] as const) {
    test(`all routes · ${lang} · ${scheme}: no axe violations, no errors`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openPage(page, `${lang}/`);
      for (const r of ROUTES) {
        await page.evaluate((h) => { location.hash = h; }, `${lang}/${r}`);
        await expect(page.locator('h1')).toBeVisible();
        await page.waitForTimeout(150);
        await expectNoAxeViolations(page, `${lang}/${r} ${scheme}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }
}

test('size budget', async () => {
  const { statSync } = await import('node:fs');
  expect(statSync('dist/geo-coordinates.html').size).toBeLessThan(1_048_576);
});

test('first visit with reduced-motion preference turns the setting on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
});

test('Polish browser gets Polish on first visit; choice is remembered', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'pl-PL' });
  const page = await context.newPage();
  await openPage(page, '');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await page.getByRole('button', { name: /УК/ }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await context.close();
});
```
Note on the last test: `openPage(page, '')` loads `#` which the router canonicalises to the stored/detected language; after reload the URL already has `#uk/`, which also proves persistence via the hash. To prove `localStorage` persistence, additionally navigate to the bare file URL (no hash) and expect `uk`.

- [ ] **Step 2: `tests/e2e/responsive.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { openPage } from './helpers';

const SIZES = [[320, 640], [375, 667], [768, 1024], [1024, 768], [1366, 768]] as const;
const KEY_ROUTES = ['en/', 'pl/topic-1/explore/4', 'uk/topic-3/practice', 'en/topic-6/explore/5', 'pl/lab', 'uk/rehearsal', 'en/class-quiz'];

for (const [w, h] of SIZES) {
  test(`no horizontal page scroll at ${w}×${h}; screenshots`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await openPage(page, 'en/');
    for (const r of KEY_ROUTES) {
      await page.evaluate((hash) => { location.hash = hash; }, r);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${r} at ${w}px`).toBeLessThanOrEqual(0);
      if (w !== 320) await page.screenshot({ path: `shots/responsive-${w}x${h}-${r.replace(/[/#?=]/g, '_')}.png`, fullPage: true });
    }
  });
}

test('touch targets are at least 44×44 on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'en/topic-4/explore/5');
  const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button, a[href], input[type=radio], input[type=checkbox], [role=slider], summary')]
    .filter((el) => el.offsetParent !== null && !el.closest('.visually-hidden'))
    .map((el) => { const r = (el.closest('label') ?? el).getBoundingClientRect(); return { html: el.outerHTML.slice(0, 80), w: r.width, h: r.height }; })
    .filter((r) => r.w < 44 || r.h < 44)
    .filter((r) => !/role="slider"/.test(r.html)));   // slider thumbs sit on a 44px-high track
  expect(small).toEqual([]);
});
```
(Inline text links inside paragraphs are exempt under WCAG 2.5.8; if the test catches such links, exclude elements whose parent is a `p`.)

- [ ] **Step 3: Run the full suite, then review screenshots**

Run: `npm run check && npm test && npm run build && npm run e2e`
Open (Read tool) at least: every `shots/responsive-375x667-*.png`, `shots/responsive-768x1024-*.png`, `shots/responsive-1366x768-*.png`, and `shots/presenter-*-3840.png`. Make a list of visual problems (overlaps, clipped labels, cramped panels, unreadable text on night shading, controls wrapping badly) and fix them one by one, re-running the affected specs after each fix.

- [ ] **Step 3b: Colour-blindness check** — add to `responsive.spec.ts`:
```ts
for (const type of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const) {
  test(`vision deficiency screenshots: ${type}`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
    for (const r of ['en/topic-1/explore/6', 'en/topic-2/explore/1', 'en/topic-6/explore/5', 'en/lab']) {
      await openPage(page, r);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `shots/vision-${type}-${r.replace(/[/#?=]/g, '_')}.png` });
    }
  });
}
```
View them: the equator, prime meridian and 180° line must remain distinguishable by label and dash pattern; hemispheres by pattern; markers A–D by shape and letter; day/night by shading; feedback by icon and text. Fix tokens or add patterns where they are not.

- [ ] **Step 4: Manual screen-reader sanity pass (scripted)** — using Playwright's accessibility snapshot, dump the tree for `en/lab` and `uk/topic-3/practice`:
```ts
// temporary script scripts/a11y-tree.ts, run with node --experimental-strip-types, delete afterwards
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
const b = await chromium.launch(); const p = await b.newPage();
for (const h of ['en/lab', 'uk/topic-3/practice']) {
  await p.goto(`file://${resolve('dist/geo-coordinates.html')}#${h}`); await p.waitForTimeout(300);
  console.log(h, await p.locator('body').ariaSnapshot());
}
await b.close();
```
Check: sliders announce "52 degrees north"-style values, the map groups have labels and hints, radio options read in order, feedback text is reachable right after the Check button. Fix issues found.

- [ ] **Step 5: `README.md`**

```markdown
# Coordinates on the globe · Współrzędne · Координати

An interactive lesson about geographic coordinates for 6th graders, in English, Polish and Ukrainian.
One self-contained file — works offline, on phones, tablets, laptops and big classroom screens.

## Use it

Open `dist/geo-coordinates.html` in any modern browser (double-click works — no internet needed).

- **Learn**: 8 topics with step-by-step interactive explanations.
- **Practise**: 10-question rounds with instant feedback (easy / medium / hard).
- **Test rehearsal**: 15 mixed questions with a review at the end.
- **Class quiz**: big-screen questions; the same quiz code gives the same questions.
- **Day and night lab**: real sun position, local solar time.
- **Presenter mode**: press `P` (fullscreen, larger text, higher contrast); `L` toggles a pointer highlight.

Share a topic directly with a link such as `geo-coordinates.html#pl/topic-3/explore`.

## Translations

`dist/translation-review.html` lists every text side by side for native-speaker review.
Texts live in `src/i18n/{en,pl,uk}.json`; tests fail if a key is missing in any language.

## Develop

    npm install
    npm run dev          # local dev server
    npm test             # unit tests (geography math, generators, i18n)
    npm run build        # dist/geo-coordinates.html + dist/translation-review.html
    npm run e2e          # Playwright + axe accessibility tests against the built file

## Author

Created by **Yurii Serhiichuk**. Author details for the page footer live in `src/app/credits.ts`.

Map data: [Natural Earth](https://www.naturalearthdata.com/) (public domain).

## Publishing

The built file is static. For GitHub Pages, publish `dist/` and link to `geo-coordinates.html`
(or copy it to `index.html`).
```

- [ ] **Step 6: Final build and commit**

```bash
npm run check && npm test && npm run build && npm run e2e
git add -A
git commit -m "test: full accessibility and responsive sweep; final polish, README and build"
```

- [ ] **Step 7: Report** — summarise to the controller: test counts, bundle size, known limitations (e.g. screen-reader checks were scripted, not with a real screen reader), and the list of screenshots reviewed.
