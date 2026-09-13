# Part 4 — Topics 5–7, Test rehearsal, Class quiz (Tasks 15–16)

Read `README.md` first.

---

### Task 15: Topics 5–7 — minutes, differences, distance

**Files:**
- Create: `src/quiz/generators/difference.ts`, `src/quiz/generators/distance.ts`, `src/quiz/answerText.ts`, `src/topics/t5-minutes.ts`, `src/topics/t6-differences.ts`, `src/topics/t7-distance.ts`
- Modify: `src/quiz/registry.ts` (`MODULES`), `src/topics/index.ts`, `src/map/layers/Overlays.svelte` (lat-diff, lon-diff, distance), `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/generators.test.ts` (automatically covers the new modules), `tests/unit/answerText.test.ts`, `tests/e2e/explore.spec.ts` and `tests/e2e/practice.spec.ts` (extend topic loops to 5–7)

**Interfaces:**
- Consumes: `latDifference`, `lonDifference`, `latDifferenceMethod`, `lonDifferenceMethod` (Task 3), `KM_PER_DEGREE`, `meridianDistanceKm` (Task 3), `formatNumber` (Task 5), `parallelLine`, `meridianLine` (Task 8), `NumberInput` (Task 14), quiz types/helpers (Task 13).
- Produces:
  - `difference` module (`type: 'difference'`, `topics: [6]`), `distance` module (`type: 'distance'`, `topics: [7]`). Both use `input: { kind: 'number', unit }`, `answer: { kind: 'number', value }`.
  - `answerText.ts`: `numberText(value: number, unit: 'deg' | 'km' | 'h' | 'min'): Text` (keys `q.answer.deg|km|h|min`), `responseText(q: Question, a: Answer): Text` — renders any response (choice → option text, coords → `q.answer.coords`, number → `numberText`, clock → `q.answer.clock` with `{time}`).
  - `Overlays.svelte` branches for `lat-diff`, `lon-diff`, `distance`.
  - Topic definitions `topic5`, `topic6`, `topic7`.

- [ ] **Step 1: `src/quiz/answerText.ts` — test then implement**

`tests/unit/answerText.test.ts`:
```ts
import { expect, test } from 'vitest';
import { renderText } from '../../src/i18n/text';
import { numberText, responseText } from '../../src/quiz/answerText';
import type { Question } from '../../src/quiz/types';

const q = (input: Question['input']): Question => ({ id: 'x', type: 'difference', topic: 6, difficulty: 'easy', prompt: { key: 'q.read.prompt' }, input, answer: { kind: 'number', value: 1 }, explanation: { key: 'q.read.prompt' }, scene: { views: ['flat'] }, solution: [] });

test('numbers use locale separators and units', () => {
  expect(renderText(numberText(333.6, 'km'), 'pl')).toBe('333,6 km');
  expect(renderText(numberText(25, 'deg'), 'en')).toBe('25°');
  expect(renderText(numberText(2224, 'km'), 'uk')).toBe('2224 км');
});

test('responses render per input kind', () => {
  expect(renderText(responseText(q({ kind: 'coords', precision: 'degree', fields: 'both', mapPick: false }), { kind: 'coords', value: { lat: -10, lon: 20 } }), 'en')).toBe('10°S, 20°E');
  expect(renderText(responseText(q({ kind: 'choice', options: [{ key: 'q.opt.north' }, { key: 'q.opt.south' }] }), { kind: 'choice', index: 1 }), 'en')).toBe('South of it');
  expect(renderText(responseText(q({ kind: 'number', unit: 'km' }), { kind: 'number', value: 1112 }), 'en')).toBe('1112 km');
  expect(renderText(responseText(q({ kind: 'clock' }), { kind: 'clock', minutes: 13 * 60 + 5 }), 'en')).toBe('13:05');
});
```

`src/quiz/answerText.ts`:
```ts
import { formatClock } from '../geo/time';
import type { Text } from '../i18n/text';
import type { Answer, Question } from './types';

export function numberText(value: number, unit: 'deg' | 'km' | 'h' | 'min'): Text {
  return { key: `q.answer.${unit}`, params: { n: value } };
}

export function responseText(q: Question, a: Answer): Text {
  switch (a.kind) {
    case 'choice': return q.input.kind === 'choice' ? (q.input.options[a.index] ?? { key: 'q.answer.none' }) : { key: 'q.answer.none' };
    case 'coords': return { key: 'q.answer.coords', params: { coords: { coord: a.value, axis: q.input.kind === 'coords' ? q.input.fields : 'both', precision: q.input.kind === 'coords' ? q.input.precision : 'degree' } } };
    case 'number': return numberText(a.value, q.input.kind === 'number' ? q.input.unit : 'deg');
    case 'clock': return { key: 'q.answer.clock', params: { time: formatClock(a.minutes) } };
  }
}
```
Keys: `q.answer.deg` "{n}°" (all langs), `q.answer.km` "{n} km" / "{n} km" / "{n} км", `q.answer.h` "{n} h" / "{n} godz." / "{n} год", `q.answer.min` "{n} min" / "{n} min" / "{n} хв", `q.answer.clock` "{time}" (all), `q.answer.none` "—" (all).

- [ ] **Step 2: `src/quiz/generators/difference.ts`**

```ts
import { latDifference, latDifferenceMethod, lonDifference, lonDifferenceMethod } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { numberText } from '../answerText';
import { gridInt, signed } from '../values';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';

function pickValues(rng: Rng, d: Difficulty, axis: 'lat' | 'lon'): [number, number] {
  const max = axis === 'lat' ? 80 : 170;
  for (;;) {
    let a: number, b: number;
    if (d === 'easy') {
      const s = signed(rng);
      a = gridInt(rng, 10, max, 10) * s; b = gridInt(rng, 10, max, 10) * s;
    } else if (d === 'medium') {
      a = rng.int(1, max) * signed(rng); b = rng.int(1, max) * signed(rng);
      if (rng.next() < 0.6) b = -Math.sign(a) * Math.abs(b); // mostly opposite hemispheres
      if (rng.next() < 0.1) b = 0;
      if (axis === 'lon' && Math.abs(a) + Math.abs(b) > 180) continue;
    } else {
      if (axis === 'lon' && rng.next() < 0.6) {
        a = rng.int(100, 179); b = -rng.int(Math.max(1, 181 - a), 179); // sum > 180
        if (rng.next() < 0.5) [a, b] = [b, a];
      } else {
        a = rng.int(1, max) * signed(rng); b = rng.int(1, max) * signed(rng);
      }
    }
    if (a !== b) return [a, b];
  }
}

export const difference: QuestionModule = {
  type: 'difference',
  topics: [6],
  generate(rng, difficulty): Question {
    const axis = rng.pick(['lat', 'lon'] as const);
    const [va, vb] = pickValues(rng, difficulty, axis);
    const other = () => (axis === 'lat' ? rng.int(-150, 150) : rng.int(-60, 60));
    const A: LatLon = axis === 'lat' ? { lat: va, lon: other() } : { lat: other(), lon: va };
    const B: LatLon = axis === 'lat' ? { lat: vb, lon: A.lon + rng.int(-20, 20) } : { lat: A.lat + rng.int(-20, 20), lon: vb };
    const result = axis === 'lat' ? latDifference(va, vb) : lonDifference(va, vb);
    const method = axis === 'lat' ? latDifferenceMethod(va, vb) : lonDifferenceMethod(va, vb);
    const x = Math.abs(va), y = Math.abs(vb);
    const line: Text = { key: axis === 'lat' ? 'q.line.equator' : 'q.line.prime' };
    let explanation: Text;
    switch (method) {
      case 'same-subtract': explanation = { key: 'q.diff.explain.same', params: { big: Math.max(x, y), small: Math.min(x, y), result } }; break;
      case 'opposite-add': explanation = { key: 'q.diff.explain.opposite', params: { x, y, result, line: { text: line } } }; break;
      case 'opposite-over-180': explanation = { key: 'q.diff.explain.over180', params: { x, y, sum: x + y, result } }; break;
      default: explanation = { key: 'q.diff.explain.zero', params: { result, line: { text: line } } };
    }
    const overlay = axis === 'lat' ? ({ kind: 'lat-diff', a: A, b: B } as const) : ({ kind: 'lon-diff', a: A, b: B } as const);
    return {
      id: '', type: 'difference', topic: 6, difficulty,
      prompt: { key: `q.diff.prompt.${axis}`, params: { a: { coord: A, axis }, b: { coord: B, axis } } },
      input: { kind: 'number', unit: 'deg' },
      answer: { kind: 'number', value: result },
      explanation,
      scene: { views: axis === 'lon' && method === 'opposite-over-180' ? ['globe', 'flat'] : ['flat'], point: null, rotate: [180, -20], layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: A, tone: 'a', label: 'A' }, { kind: 'marker', p: B, tone: 'b', label: 'B' }] },
      solution: [overlay],
      meta: { method, x, y },
    };
  },
  check(q, r) {
    if (r.kind !== 'number' || q.answer.kind !== 'number') return { correct: false };
    const correct = Math.abs(r.value - q.answer.value) < 1e-9;
    if (correct) return { correct };
    const { method, x, y } = q.meta as { method: string; x: number; y: number };
    if ((method === 'opposite-add' || method === 'opposite-over-180') && Math.abs(r.value - Math.abs(x - y)) < 1e-9) return { correct, mistake: { key: 'q.diff.mistake.subtracted' } };
    if (method === 'same-subtract' && Math.abs(r.value - (x + y)) < 1e-9) return { correct, mistake: { key: 'q.diff.mistake.added' } };
    if (method === 'opposite-over-180' && Math.abs(r.value - (x + y)) < 1e-9) return { correct, mistake: { key: 'q.diff.mistake.over180' } };
    return { correct };
  },
  describeAnswer: (q) => numberText((q.answer as { value: number }).value, 'deg'),
};
```

- [ ] **Step 3: `src/quiz/generators/distance.ts`**

```ts
import { latDifference, latDifferenceMethod } from '../../geo/compare';
import { KM_PER_DEGREE } from '../../geo/distance';
import type { LatLon } from '../../geo/types';
import { numberText } from '../answerText';
import { gridInt, signed } from '../values';
import type { Question, QuestionModule } from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

export const distance: QuestionModule = {
  type: 'distance',
  topics: [7],
  generate(rng, difficulty): Question {
    const reverse = difficulty === 'hard' && rng.next() < 0.5;
    let a: number, b: number;
    for (;;) {
      if (difficulty === 'easy') { const s = signed(rng); a = gridInt(rng, 0, 80, 10) * s; b = gridInt(rng, 0, 80, 10) * s; }
      else if (difficulty === 'medium') { a = rng.int(1, 60); b = -rng.int(1, 60); if (rng.next() < 0.5) [a, b] = [b, a]; }
      else { a = rng.int(-89, 89); b = rng.pick([90, -90, rng.int(-89, 89)]); }
      if (a !== b) break;
    }
    const lon = rng.int(-170, 170);
    const A: LatLon = { lat: a, lon }, B: LatLon = { lat: b, lon };
    const deg = latDifference(a, b);
    const km = round1(deg * KM_PER_DEGREE);
    const common = {
      id: '', type: 'distance' as const, topic: 7 as const, difficulty,
      scene: { views: ['flat' as const], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker' as const, p: A, tone: 'a' as const, label: 'A' }, { kind: 'marker' as const, p: B, tone: 'b' as const, label: 'B' }, { kind: 'highlight-line' as const, axis: 'lon' as const, value: lon }] },
      solution: [{ kind: 'distance' as const, a: A, b: B }],
    };
    if (reverse) {
      return {
        ...common,
        prompt: { key: 'q.dist.promptReverse', params: { km } },
        input: { kind: 'number', unit: 'deg' },
        answer: { kind: 'number', value: deg },
        explanation: { key: 'q.dist.explainReverse', params: { km, deg } },
        meta: { mode: 'reverse', deg, method: latDifferenceMethod(a, b) },
      };
    }
    return {
      ...common,
      prompt: { key: 'q.dist.prompt', params: { a: { coord: A, axis: 'lat' }, b: { coord: B, axis: 'lat' } } },
      input: { kind: 'number', unit: 'km' },
      answer: { kind: 'number', value: km },
      explanation: { key: 'q.dist.explain', params: { deg, km } },
      meta: { mode: 'forward', deg, x: Math.abs(a), y: Math.abs(b), method: latDifferenceMethod(a, b) },
    };
  },
  check(q, r) {
    if (r.kind !== 'number' || q.answer.kind !== 'number') return { correct: false };
    const m = q.meta as { mode: string; deg: number; x?: number; y?: number; method: string };
    if (m.mode === 'reverse') {
      const correct = Math.abs(r.value - m.deg) <= 0.1;
      return { correct };
    }
    if (Math.abs(r.value - m.deg * KM_PER_DEGREE) <= 1) return { correct: true };
    if (Math.abs(r.value - m.deg * 111) <= 1) return { correct: true, note: { key: 'q.dist.note111' } };
    if (Math.abs(r.value - m.deg) < 1e-9) return { correct: false, mistake: { key: 'q.dist.mistake.degrees' } };
    const wrongDeg = m.method === 'same-subtract' ? (m.x ?? 0) + (m.y ?? 0) : Math.abs((m.x ?? 0) - (m.y ?? 0));
    if (m.method !== 'zero-line' && Math.abs(r.value - wrongDeg * KM_PER_DEGREE) <= 1) {
      return { correct: false, mistake: { key: m.method === 'same-subtract' ? 'q.diff.mistake.added' : 'q.diff.mistake.subtracted' } };
    }
    return { correct: false };
  },
  describeAnswer: (q) => numberText((q.answer as { value: number }).value, q.input.kind === 'number' ? q.input.unit : 'km'),
};
```
Note: the generator property test submits `q.answer` (e.g. `2224` or `deg`) — both pass. `note` is shown in Feedback when present.

- [ ] **Step 4: Register modules** — in `src/quiz/registry.ts` import both and set `MODULES = [nameLine, further, relativeLine, readCoords, placePoint, whichPlace, difference, distance]`.

- [ ] **Step 5: Overlay branches** — in `src/map/layers/Overlays.svelte` add imports `formatNumber` from `../../i18n/text`, `latDifference`, `lonDifference` from `../../geo/compare`, `KM_PER_DEGREE` from `../../geo/distance`, `i18n`, `t` from `../../i18n/i18n.svelte`, and a helper in the script:

```ts
  function lonSegments(a: number, b: number): [number, number][] {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return hi - lo <= 180 ? [[lo, hi]] : [[hi, 180], [-180, lo]];
  }
  function parallelSegment(lat: number, from: number, to: number): GeoJSON.LineString {
    const coordinates: [number, number][] = [];
    for (let lon = from; lon < to; lon += 1) coordinates.push([lon, lat]);
    coordinates.push([to, lat]);
    return { type: 'LineString', coordinates };
  }
```
and these branches before `{/if}`:

```svelte
  {:else if o.kind === 'lat-diff' || o.kind === 'distance'}
    {@const lonX = o.kind === 'distance' ? o.a.lon : Math.max(o.a.lon, o.b.lon) + 6}
    {@const lo = Math.min(o.a.lat, o.b.lat)}
    {@const hi = Math.max(o.a.lat, o.b.lat)}
    <path class="bracket" d={ctx.path(meridianLine(lonX, 1, lo, hi)) ?? ''} />
    {#each [lo, hi] as endLat (endLat)}
      <path class="bracket" d={ctx.path(parallelSegment(endLat, lonX - 2, lonX + 2)) ?? ''} />
    {/each}
    {#if lo < 0 && hi > 0}
      {@const eq = ctx.project({ lat: 0, lon: lonX })}
      {#if eq}<circle cx={eq[0]} cy={eq[1]} r={4 * ctx.px} class="split" />{/if}
      {#each [[hi / 2, hi], [lo / 2, -lo]] as [mid, part] (mid)}
        {@const xy = ctx.project({ lat: mid, lon: lonX + 2 })}
        {#if xy}<text class="halo part" x={xy[0] + 4 * ctx.px} y={xy[1]} font-size={13 * ctx.px}>{formatNumber(part, i18n.lang)}°</text>{/if}
      {/each}
    {/if}
    {@const mid = ctx.project({ lat: (lo + hi) / 2, lon: lonX - 2 })}
    {#if mid}
      <text class="halo total" x={mid[0] - 6 * ctx.px} y={mid[1]} text-anchor="end" font-size={17 * ctx.px}>
        {o.kind === 'distance' ? t('unit.km', { n: formatNumber(Math.round(latDifference(lo, hi) * KM_PER_DEGREE * 10) / 10, i18n.lang) }) : `${formatNumber(latDifference(lo, hi), i18n.lang)}°`}
      </text>
    {/if}
  {:else if o.kind === 'lon-diff'}
    {@const latY = Math.min(80, Math.max(o.a.lat, o.b.lat) + 6)}
    {#each lonSegments(o.a.lon, o.b.lon) as [from, to] (from)}
      <path class="bracket" d={ctx.path(parallelSegment(latY, from, to)) ?? ''} />
    {/each}
    {#each [o.a.lon, o.b.lon] as endLon (endLon)}
      <path class="bracket" d={ctx.path(meridianLine(endLon, 1, latY - 2, latY + 2)) ?? ''} />
    {/each}
    {@const segs = lonSegments(o.a.lon, o.b.lon)}
    {@const crossesZero = segs.length === 1 && segs[0]![0] < 0 && segs[0]![1] > 0}
    {#if crossesZero}
      {@const z = ctx.project({ lat: latY, lon: 0 })}
      {#if z}<circle cx={z[0]} cy={z[1]} r={4 * ctx.px} class="split" />{/if}
    {/if}
    {@const midLon = segs.length === 1 ? (segs[0]![0] + segs[0]![1]) / 2 : 180}
    {@const mid = ctx.project({ lat: latY + 3, lon: midLon })}
    {#if mid}<text class="halo total" x={mid[0]} y={mid[1]} text-anchor="middle" font-size={17 * ctx.px}>{formatNumber(lonDifference(o.a.lon, o.b.lon), i18n.lang)}°</text>{/if}
```
Styles:
```css
  .bracket { fill: none; stroke: var(--marker-c); stroke-width: 4; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .split { fill: var(--surface); stroke: var(--marker-c); stroke-width: 3; vector-effect: non-scaling-stroke; }
  .total { fill: var(--marker-c); font-weight: 800; }
  .part { fill: var(--text); font-weight: 700; }
```
(Svelte 5 allows `{@const}` directly inside `{:else if}` blocks. If svelte-check complains about `{@const}` placement after other markup, wrap each branch's contents in a `<g>`.)

- [ ] **Step 6: i18n keys for the generators** (EN source):

```
q.line.equator             the equator
q.line.prime               the prime meridian
q.diff.prompt.lat          What is the difference in latitude between A ({a}) and B ({b})?
q.diff.prompt.lon          What is the difference in longitude between A ({a}) and B ({b})?
q.diff.explain.same        Both points are on the same side, so subtract: {big} − {small} = {result}°.
q.diff.explain.opposite    The points are on different sides of {line}, so add: {x} + {y} = {result}°.
q.diff.explain.over180     Add: {x} + {y} = {sum}°. That is more than 180°, so take the shorter way across the 180° meridian: 360 − {sum} = {result}°.
q.diff.explain.zero        One point lies on {line}, so the difference is simply {result}°.
q.diff.mistake.subtracted  You subtracted, but the points are on different sides of the line — add the numbers.
q.diff.mistake.added       You added, but both points are on the same side — subtract the smaller number from the bigger one.
q.diff.mistake.over180     The sum is more than 180°. Take the shorter way: 360° minus the sum.
q.dist.prompt              Points A ({a}) and B ({b}) lie on the same meridian. How far apart are they in kilometres?
q.dist.promptReverse       Two places on the same meridian are {km} km apart. How many degrees of latitude apart are they?
q.dist.explain             The difference in latitude is {deg}°. One degree along a meridian is about 111.2 km, so {deg} × 111.2 = {km} km.
q.dist.explainReverse      Divide by 111.2: {km} ÷ 111.2 = {deg}°.
q.dist.note111             Correct! You used 111 km per degree. The more exact value is 111.2 km.
q.dist.mistake.degrees     That is the number of degrees. Multiply it by 111.2 to get kilometres.
```
UK note: `q.dist.promptReverse` — "Два місця на одному меридіані розташовані на відстані {km} км. На скільки градусів широти вони відрізняються?"; km unit in UK is «км».

- [ ] **Step 7: Topic definitions**

`src/topics/t5-minutes.ts`:
```ts
import type { TopicDef } from './types';

const warsaw = { lat: 52 + 14 / 60, lon: 21 + 1 / 60 };
export const topic5: TopicDef = {
  id: 5,
  questionTypes: ['read-coords', 'place-point', 'further'],
  steps: [
    { id: 'sixty', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21 }, zoom: 12 }, point: { lat: 52.5, lon: 21 }, precision: 'minute', layers: { graticuleStep: 1, specialLines: true, places: false } } },
    { id: 'quarters', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21.5 }, zoom: 12 }, point: { lat: 52.25, lon: 21.75 }, precision: 'minute', layers: { graticuleStep: 1, specialLines: true, places: false } } },
    { id: 'warsaw', scene: { views: ['flat'], flatView: { center: warsaw, zoom: 12 }, point: warsaw, precision: 'minute', layers: { graticuleStep: 1, specialLines: true, places: true } } },
    { id: 'compare', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21 }, zoom: 12 }, point: null, precision: 'minute', layers: { graticuleStep: 1, places: false }, overlays: [{ kind: 'marker', p: { lat: 52.75, lon: 20.5 }, tone: 'a', label: '52°45′N' }, { kind: 'marker', p: { lat: 52.25, lon: 21.5 }, tone: 'b', label: '52°15′N' }] } },
    { id: 'play', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21 }, zoom: 12 }, point: { lat: 52.5, lon: 21 }, pointEditable: true, precision: 'minute', layers: { graticuleStep: 1, specialLines: true } } },
  ],
};
```

`src/topics/t6-differences.ts`:
```ts
import type { TopicDef } from './types';

const warsaw = { lat: 52, lon: 21 }, cairo = { lat: 30, lon: 31 }, capetown = { lat: -34, lon: 18 }, kyiv = { lat: 50, lon: 31 }, newyork = { lat: 41, lon: -74 }, tokyo = { lat: 36, lon: 140 }, honolulu = { lat: 21, lon: -158 };
export const topic6: TopicDef = {
  id: 6,
  questionTypes: ['difference'],
  steps: [
    { id: 'same-lat', scene: { views: ['flat'], point: null, layers: { specialLines: true }, overlays: [{ kind: 'marker', p: warsaw, tone: 'a', label: '52°N' }, { kind: 'marker', p: cairo, tone: 'b', label: '30°N' }, { kind: 'lat-diff', a: warsaw, b: cairo }] } },
    { id: 'opposite-lat', scene: { views: ['flat'], point: null, layers: { specialLines: true }, overlays: [{ kind: 'marker', p: cairo, tone: 'a', label: '30°N' }, { kind: 'marker', p: capetown, tone: 'b', label: '34°S' }, { kind: 'lat-diff', a: cairo, b: capetown }] } },
    { id: 'same-lon', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true }, overlays: [{ kind: 'marker', p: kyiv, tone: 'a', label: '31°E' }, { kind: 'marker', p: warsaw, tone: 'b', label: '21°E' }, { kind: 'lon-diff', a: kyiv, b: warsaw }] } },
    { id: 'opposite-lon', scene: { views: ['flat'], point: null, layers: { specialLines: true }, overlays: [{ kind: 'marker', p: newyork, tone: 'a', label: '74°W' }, { kind: 'marker', p: warsaw, tone: 'b', label: '21°E' }, { kind: 'lon-diff', a: newyork, b: warsaw }] } },
    { id: 'over-180', scene: { views: ['globe', 'flat'], point: null, rotate: [180, -20], layers: { specialLines: true }, overlays: [{ kind: 'marker', p: tokyo, tone: 'a', label: '140°E' }, { kind: 'marker', p: honolulu, tone: 'b', label: '158°W' }, { kind: 'lon-diff', a: tokyo, b: honolulu }] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 0, lon: 0 }, pointEditable: true, layers: { specialLines: true }, overlays: [{ kind: 'marker', p: warsaw, tone: 'b', label: '52°N, 21°E' }] } },
  ],
};
```

`src/topics/t7-distance.ts`:
```ts
import type { TopicDef } from './types';

export const topic7: TopicDef = {
  id: 7,
  questionTypes: ['distance'],
  steps: [
    { id: 'degree-length', scene: { views: ['globe', 'cross-section'], point: { lat: 1, lon: 21 }, rotate: [-21, -20], layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 21 }] } },
    { id: 'example', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true, places: false }, overlays: [{ kind: 'distance', a: { lat: 50, lon: 20 }, b: { lat: 40, lon: 20 } }] } },
    { id: 'across-equator', scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'distance', a: { lat: 10, lon: 20 }, b: { lat: -20, lon: 20 } }] } },
    { id: 'reverse', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true, places: false }, overlays: [{ kind: 'distance', a: { lat: 55, lon: 20 }, b: { lat: 50, lon: 20 } }] } },
    { id: 'only-meridians', scene: { views: ['globe'], point: null, rotate: [-20, -40], layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 60 }, { kind: 'highlight-line', axis: 'lat', value: 0 }] } },
    { id: 'play', scene: { views: ['flat', 'cross-section'], point: { lat: 30, lon: 20 }, pointEditable: true, layers: { specialLines: true } } },
  ],
};
```
Add `5: topic5, 6: topic6, 7: topic7` to `TOPICS` in `src/topics/index.ts`.

Step texts (EN source):

Topic 5:
- `sixty` — **A degree has 60 minutes** — "One degree is divided into 60 minutes, written with the sign ′. So 52°30′N is exactly halfway between 52°N and 53°N."
- `quarters` — **Halves and quarters** — "30′ is half a degree. 15′ is a quarter of a degree and 45′ is three quarters. This point is at 52°15′N, 21°45′E."
- `warsaw` — **Warsaw, exactly** — "The centre of Warsaw is at about 52°14′N, 21°01′E. On a school map we often round it to 52°N, 21°E."
- `compare` — **Which is further north?** — "52°45′N is north of 52°15′N: the degrees are the same, but it has more minutes. In the Southern Hemisphere more minutes means further south."
- `play` — **Try it yourself** — "Each arrow key press moves the point by 1′, and with Shift by 1°. Find 52°30′N, 20°45′E."

Topic 6:
- `same-lat` — **Same side: subtract** — "Warsaw is at 52°N and Cairo at 30°N. Both are north of the equator, so we subtract: 52 − 30 = 22°."
- `opposite-lat` — **Different sides: add** — "Cairo is at 30°N and Cape Town at 34°S. The equator lies between them, so we add: 30 + 34 = 64°."
- `same-lon` — **Longitude works the same way** — "Kyiv is at 31°E and Warsaw at 21°E. Both are east of Greenwich: 31 − 21 = 10°."
- `opposite-lon` — **Across Greenwich: add** — "New York is at 74°W and Warsaw at 21°E. Greenwich lies between them: 74 + 21 = 95°."
- `over-180` — **More than 180°? Go the other way** — "Tokyo is at 140°E and Honolulu at 158°W. 140 + 158 = 298°, which is more than 180°. The shorter way crosses the 180° meridian: 360 − 298 = 62°."
- `play` — **Try it yourself** — "Drag the point. How many degrees of latitude and longitude is it from Warsaw (52°N, 21°E)?"

Topic 7:
- `degree-length` — **How long is one degree?** — "A meridian runs from pole to pole: about 20,000 km and 180°. So one degree along a meridian is about 111.2 km."
- `example` — **Degrees into kilometres** — "Two points on the same meridian, at 50°N and 40°N, are 10° apart: 10 × 111.2 = 1112 km."
- `across-equator` — **Across the equator** — "From 10°N to 20°S along a meridian: 10 + 20 = 30°, so 30 × 111.2 = 3336 km."
- `reverse` — **Kilometres into degrees** — "If two places on one meridian are 556 km apart, divide: 556 ÷ 111.2 = 5°."
- `only-meridians` — **Why only along meridians?** — "Parallels get shorter towards the poles, so one degree along a parallel is shorter than 111.2 km (except on the equator). That is why we use this rule along meridians."
- `play` — **Try it yourself** — "Move the point along the meridian. Its distance from the equator is its latitude × 111.2 km."

- [ ] **Step 8: Extend e2e loops** — in `tests/e2e/explore.spec.ts` change `[1, 2, 3, 4]` to `[1, 2, 3, 4, 5, 6, 7]`. In `tests/e2e/practice.spec.ts`:
  - change the topic loop to `[1, 2, 3, 4, 5, 6, 7]`;
  - in `answerCorrectlyWithKeyboard`, add a `number` branch: focus `page.getByRole('textbox')`, type `String(a.value)`;
  - in the coords text branch format minutes: `const fmt = (n: number, pos: string, neg: string) => { const abs = Math.abs(n); const d = Math.floor(abs + 1e-9); const m = Math.round((abs - d) * 60); const body = m ? `${d}°${String(m).padStart(2, '0')}′` : `${d}`; return n === 0 || abs === 180 ? body : `${body}${n > 0 ? pos : neg}`; };`
  - in the slider branch (minute precision), compare with tolerance `Math.abs(p.lat - v.lat) > 1e-6` and press with Shift when the gap is ≥ 1°: `page.keyboard.press(`${gap >= 1 ? 'Shift+' : ''}ArrowUp`)`.

- [ ] **Step 9: Run and look**

Run: `npm run check && npm test && npm run build && npm run e2e`
Shots: `npm run shot -- "en/topic-6/explore/5" t6-over180`, `npm run shot -- "pl/topic-5/explore/2" t5-quarters`, `npm run shot -- "uk/topic-7/explore/3" t7-equator`. Verify brackets, split dots and labels are readable and not clipped.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(topics): minutes, degree differences and meridian distance with brackets and generators"
```

---

### Task 16: Test rehearsal and Class quiz

**Files:**
- Create: `src/quiz/Rehearsal.svelte`, `src/quiz/ClassQuiz.svelte`, `src/quiz/Countdown.svelte`
- Modify: `src/app/App.svelte` (routes), `src/i18n/{en,pl,uk}.json`
- Test: `tests/e2e/rehearsal.spec.ts`, `tests/e2e/class-quiz.spec.ts`

**Interfaces:**
- Consumes: `generateSet`, `checkAnswer`, `describeAnswer`, `modulesForTopic` (Task 13), `responseText` (Task 15), `QuestionCard`, `Feedback` (Task 14), `scores` (Task 14), `MapStage`, `mapState`, `router`/`navigate` (Task 6), `motionReduced` (Task 6), `createRng`, `randomSeed` (Task 13).
- Produces:
  - `Rehearsal.svelte` (no props) — `#<lang>/rehearsal`. Setup: difficulty (default medium) + Start. Run: 15 questions from all topics that have modules, order `createRng(seed).shuffle(availableTopics)` repeated to 15; `QuestionCard` with `showFeedback={false}`; no solution overlays while running. Results: score, best, and a review list: every question with ✓/✗, prompt, "Your answer", "Correct answer", explanation, and links to that topic's Learn and Practise pages.
  - `ClassQuiz.svelte` props `{ seed: string | null }` — `#<lang>/class-quiz[?seed=]`. Setup form: seed (text, default random 4 chars), difficulty, topics (checkbox per available topic, all checked), count (5/10/15), timer (off/15/30/60 s). Start → `navigate({ name: 'class-quiz', lang, seed }, { replace: true })` and enter run mode. Run mode shows a large prompt, big lettered options for choice questions (not selectable), the map, countdown, and buttons Reveal / Previous / Next / End. Keys: Space or Enter → reveal; → next; ← previous; Escape → back to setup. Reveal: highlight correct option with ✓ and text, show `describeAnswer` and the explanation, add `question.solution` overlays, set `mapState.showReadout = true` for coordinate questions.
  - `Countdown.svelte` props `{ seconds: number; running: boolean; ondone: () => void }` — shows remaining seconds as large text inside a ring; ring animation disabled when `motionReduced()`; announces "Time's up" once (polite) at zero.

- [ ] **Step 1: i18n keys**

| key | en | pl | uk |
|---|---|---|---|
| rehearsal.intro | 15 questions from all topics. You will see the answers at the end, just like after a real test. | 15 pytań ze wszystkich tematów. Odpowiedzi zobaczysz na końcu, jak po prawdziwym sprawdzianie. | 15 запитань з усіх тем. Відповіді побачиш у кінці, як після справжньої контрольної. |
| rehearsal.start | Start | Zaczynamy | Почати |
| rehearsal.submitNext | Save and continue | Zapisz i dalej | Зберегти й далі |
| rehearsal.finish | Finish the test | Zakończ sprawdzian | Завершити контрольну |
| rehearsal.results | Your results | Twoje wyniki | Твої результати |
| rehearsal.yourAnswer | Your answer: {answer} | Twoja odpowiedź: {answer} | Твоя відповідь: {answer} |
| rehearsal.learn | Learn: {title} | Poznaj: {title} | Вивчай: {title} |
| rehearsal.practise | Practise: {title} | Ćwicz: {title} | Тренуйся: {title} |
| rehearsal.again | Try another test | Spróbuj kolejnego sprawdzianu | Спробуй ще одну контрольну |
| classQuiz.setup | Set up the quiz | Ustaw quiz | Налаштуй вікторину |
| classQuiz.seed | Quiz code (the same code gives the same questions) | Kod quizu (ten sam kod = te same pytania) | Код вікторини (той самий код = ті самі запитання) |
| classQuiz.topics | Topics | Tematy | Теми |
| classQuiz.count | Number of questions | Liczba pytań | Кількість запитань |
| classQuiz.timer | Time to think | Czas do namysłu | Час на роздуми |
| classQuiz.timerOff | No timer | Bez limitu | Без таймера |
| classQuiz.seconds | {n} s | {n} s | {n} с |
| classQuiz.start | Start the quiz | Rozpocznij quiz | Почати вікторину |
| classQuiz.reveal | Show the answer | Pokaż odpowiedź | Показати відповідь |
| classQuiz.prev | Previous | Poprzednie | Попереднє |
| classQuiz.next | Next | Następne | Наступне |
| classQuiz.end | End quiz | Zakończ quiz | Завершити вікторину |
| classQuiz.keys | Space: show answer · →: next · ←: previous · Esc: end | Spacja: odpowiedź · →: dalej · ←: wstecz · Esc: koniec | Пробіл: відповідь · →: далі · ←: назад · Esc: кінець |
| classQuiz.timeUp | Time's up! | Koniec czasu! | Час вийшов! |
| classQuiz.answer | Answer: {answer} | Odpowiedź: {answer} | Відповідь: {answer} |
| classQuiz.noTopics | Choose at least one topic. | Wybierz co najmniej jeden temat. | Обери принаймні одну тему. |

- [ ] **Step 2: `src/quiz/Countdown.svelte`**

```svelte
<script lang="ts">
  import { announce } from '../app/announcer.svelte';
  import { motionReduced } from '../app/settings.svelte';
  import { t } from '../i18n/i18n.svelte';

  let { seconds, running, ondone }: { seconds: number; running: boolean; ondone: () => void } = $props();
  let left = $state(0);
  let key = $state(0);

  $effect(() => {
    void seconds; void key;
    left = seconds;
  });

  $effect(() => {
    if (!running || left <= 0) return;
    const id = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(id); announce(t('classQuiz.timeUp')); ondone(); }
    }, 1000);
    return () => clearInterval(id);
  });

  export function restart() { key += 1; }
  const frac = $derived(seconds > 0 ? left / seconds : 0);
</script>

<div class="countdown" class:done={left <= 0} aria-hidden="true">
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="44" class="track" />
    <circle cx="50" cy="50" r="44" class="ring" class:animate={!motionReduced()} style:stroke-dashoffset={276.5 * (1 - frac)} />
  </svg>
  <span>{left > 0 ? left : '0'}</span>
</div>

<style>
  .countdown { position: relative; width: clamp(4rem, 8vw, 9rem); aspect-ratio: 1; }
  svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--surface-2); stroke-width: 8; }
  .ring { fill: none; stroke: var(--accent); stroke-width: 8; stroke-dasharray: 276.5; stroke-linecap: round; }
  .ring.animate { transition: stroke-dashoffset 1s linear; }
  span { position: absolute; inset: 0; display: grid; place-items: center; font-size: clamp(1.5rem, 3vw, 3.5rem); font-weight: 800; font-variant-numeric: tabular-nums; }
  .done span { color: var(--bad); }
</style>
```
The countdown is `aria-hidden`; the only spoken event is "Time's up". Parents re-key the component (`{#key index}`) to restart it for each question, so `restart()` is optional.

- [ ] **Step 3: `src/quiz/Rehearsal.svelte`**

```svelte
<script lang="ts">
  import { TOPIC_IDS, type TopicId } from '../app/ids';
  import { formatRoute } from '../app/router';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import { responseText } from './answerText';
  import QuestionCard from './QuestionCard.svelte';
  import { checkAnswer, describeAnswer, generateSet, modulesForTopic } from './registry';
  import { createRng, randomSeed } from './rng';
  import { bestScore, recordScore, scoreId } from './scores';
  import type { Answer, CheckResult, Difficulty } from './types';

  const COUNT = 15;
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
  let phase = $state<'setup' | 'run' | 'results'>('setup');
  let difficulty = $state<Difficulty>('medium');
  let seed = $state(randomSeed());
  let index = $state(0);
  let answers = $state<Answer[]>([]);
  let results = $state<CheckResult[]>([]);
  let best = $state<number | null>(null);

  const topics = $derived.by<TopicId[]>(() => {
    const available = TOPIC_IDS.filter((id) => modulesForTopic(id).length > 0);
    const order = createRng(seed).shuffle(available);
    return Array.from({ length: COUNT }, (_, i) => order[i % order.length]!);
  });
  const questions = $derived(generateSet(seed, topics, difficulty, COUNT));
  const question = $derived(questions[index]!);
  const score = $derived(results.filter((r) => r.correct).length);

  let applied = '';
  $effect(() => {
    if (phase !== 'run') return;
    const key = `${seed}:${index}`;
    if (key === applied) return;
    applied = key;
    mapState.applyScene(question.scene);
  });

  let heading = $state<HTMLHeadingElement>();
  $effect(() => { if (phase === 'results') queueMicrotask(() => heading?.focus()); });

  function start() { seed = randomSeed(); index = 0; answers = []; results = []; applied = ''; phase = 'run'; }
  function submit(a: Answer) {
    answers[index] = a;
    results[index] = checkAnswer(question, a);
    mapState.pointEditable = false;
  }
  function next() {
    if (index < COUNT - 1) { index += 1; return; }
    best = recordScore(scoreId('rehearsal', difficulty), score);
    phase = 'results';
  }
</script>

{#if phase === 'setup'}
  <section class="card">
    <p>{t('rehearsal.intro')}</p>
    <fieldset class="difficulty">
      <legend>{t('practice.difficulty')}</legend>
      {#each DIFFS as d (d)}
        <label><input type="radio" name="rehearsal-difficulty" value={d} bind:group={difficulty} /> {t(`difficulty.${d}`)}</label>
      {/each}
    </fieldset>
    {#if bestScore(scoreId('rehearsal', difficulty)) !== null}
      <p>{t('practice.best', { best: bestScore(scoreId('rehearsal', difficulty))!, total: COUNT })}</p>
    {/if}
    <button type="button" class="primary" onclick={start}>{t('rehearsal.start')}</button>
  </section>
{:else if phase === 'run'}
  <div class="layout">
    <div><MapStage /></div>
    <div class="panel">
      <QuestionCard {question} number={index + 1} total={COUNT} result={results[index] ?? null} showFeedback={false}
        onsubmit={submit} onnext={next} nextLabel={index < COUNT - 1 ? t('rehearsal.submitNext') : t('rehearsal.finish')} />
    </div>
  </div>
{:else}
  <section class="card" aria-labelledby="rehearsal-results">
    <h2 id="rehearsal-results" tabindex="-1" bind:this={heading}>{t('rehearsal.results')}</h2>
    <p class="score">{t('practice.score', { score, total: COUNT })}</p>
    {#if best !== null}<p>{t('practice.best', { best, total: COUNT })}</p>{/if}
    <ol class="review">
      {#each questions as q, i (q.id)}
        {@const ok = results[i]?.correct}
        <li class:ok>
          <p class="prompt"><span class="mark" aria-hidden="true">{ok ? '✓' : '✗'}</span><span class="visually-hidden">{ok ? t('practice.resultCorrect') : t('practice.resultWrong')}: </span>{renderText(q.prompt)}</p>
          {#if !ok}
            <p>{t('rehearsal.yourAnswer', { answer: answers[i] ? renderText(responseText(q, answers[i]!)) : '—' })}</p>
            {#if results[i]?.mistake}<p class="mistake">{renderText(results[i]!.mistake!)}</p>{/if}
            <p class="answer">{t('practice.correctAnswer', { answer: renderText(describeAnswer(q)) })}</p>
            <p>{renderText(q.explanation)}</p>
            <p class="links">
              <a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: q.topic, step: 0 })}>{t('rehearsal.learn', { title: t(`topic.${q.topic}.title`) })}</a>
              <a href={formatRoute({ name: 'practice', lang: i18n.lang, topic: q.topic })}>{t('rehearsal.practise', { title: t(`topic.${q.topic}.title`) })}</a>
            </p>
          {/if}
        </li>
      {/each}
    </ol>
    <button type="button" class="primary" onclick={() => (phase = 'setup')}>{t('rehearsal.again')}</button>
  </section>
{/if}

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); }
  .difficulty { display: flex; flex-wrap: wrap; gap: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); margin: var(--space-4) 0; }
  .difficulty label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: var(--tap); }
  .primary { background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 0 var(--space-6); font-weight: 700; }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .layout { grid-template-columns: minmax(0, 1fr) 26rem; align-items: start; } .panel { position: sticky; top: 5rem; } }
  .score { font-size: 2rem; font-weight: 800; margin: 0; }
  .review { display: grid; gap: var(--space-4); padding-left: 1.5rem; }
  .review p { margin: var(--space-1) 0; }
  .prompt { font-weight: 700; }
  .mark { display: inline-block; width: 1.5rem; color: var(--bad); }
  .ok .mark { color: var(--ok); }
  .mistake, .answer { font-weight: 600; }
  .links { display: flex; flex-wrap: wrap; gap: var(--space-4); }
  .links a { display: inline-flex; align-items: center; min-height: var(--tap); color: var(--accent); font-weight: 600; }
</style>
```

- [ ] **Step 4: `src/quiz/ClassQuiz.svelte`**

```svelte
<script lang="ts">
  import { TOPIC_IDS, type TopicId } from '../app/ids';
  import { navigate } from '../app/router.svelte';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import Countdown from './Countdown.svelte';
  import { describeAnswer, generateSet, modulesForTopic } from './registry';
  import type { Difficulty } from './types';

  let { seed: routeSeed }: { seed: string | null } = $props();

  const available = TOPIC_IDS.filter((id) => modulesForTopic(id).length > 0);
  let phase = $state<'setup' | 'run'>('setup');
  let seed = $state(routeSeed ?? Math.random().toString(36).slice(2, 6));
  let difficulty = $state<Difficulty>('medium');
  let chosen = $state<TopicId[]>([...available]);
  let count = $state(10);
  let timer = $state(0);
  let index = $state(0);
  let revealed = $state(false);
  let timeUp = $state(false);
  let noTopics = $state(false);

  const questions = $derived(phase === 'run' ? generateSet(seed, chosen, difficulty, count) : []);
  const question = $derived(questions[index]);
  const letters = ['A', 'B', 'C', 'D'];

  $effect(() => {
    if (phase !== 'run' || !question) return;
    void index;
    mapState.applyScene({ ...question.scene, pointEditable: false });
    revealed = false;
    timeUp = false;
  });

  function start(e: SubmitEvent) {
    e.preventDefault();
    if (chosen.length === 0) { noTopics = true; return; }
    noTopics = false;
    const clean = seed.trim().replace(/[^\w-]/g, '').slice(0, 32) || 'class';
    seed = clean;
    navigate({ name: 'class-quiz', lang: i18n.lang, seed: clean }, { replace: true });
    index = 0;
    phase = 'run';
  }

  function reveal() {
    if (!question || revealed) return;
    revealed = true;
    mapState.showReadout = true;
    mapState.addOverlays(question.solution);
  }
  function go(delta: number) {
    const n = index + delta;
    if (n >= 0 && n < questions.length) index = n;
  }

  $effect(() => {
    if (phase !== 'run') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      if (el?.closest('input, [role="slider"], svg[tabindex], dialog')) return;
      if (e.key === ' ' || e.key === 'Enter') { if (el?.closest('button, a')) return; e.preventDefault(); reveal(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); phase = 'setup'; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if phase === 'setup'}
  <form class="card setup" onsubmit={start}>
    <h2>{t('classQuiz.setup')}</h2>
    <label class="field">{t('classQuiz.seed')}<input type="text" bind:value={seed} maxlength="32" autocomplete="off" /></label>
    <fieldset>
      <legend>{t('practice.difficulty')}</legend>
      {#each ['easy', 'medium', 'hard'] as d (d)}
        <label><input type="radio" name="cq-difficulty" value={d} bind:group={difficulty} /> {t(`difficulty.${d}`)}</label>
      {/each}
    </fieldset>
    <fieldset aria-describedby={noTopics ? 'cq-no-topics' : undefined}>
      <legend>{t('classQuiz.topics')}</legend>
      {#each available as id (id)}
        <label><input type="checkbox" value={id} bind:group={chosen} /> {id}. {t(`topic.${id}.title`)}</label>
      {/each}
      {#if noTopics}<p id="cq-no-topics" class="err" role="alert">{t('classQuiz.noTopics')}</p>{/if}
    </fieldset>
    <fieldset>
      <legend>{t('classQuiz.count')}</legend>
      {#each [5, 10, 15] as n (n)}<label><input type="radio" name="cq-count" value={n} bind:group={count} /> {n}</label>{/each}
    </fieldset>
    <fieldset>
      <legend>{t('classQuiz.timer')}</legend>
      {#each [0, 15, 30, 60] as s (s)}<label><input type="radio" name="cq-timer" value={s} bind:group={timer} /> {s === 0 ? t('classQuiz.timerOff') : t('classQuiz.seconds', { n: s })}</label>{/each}
    </fieldset>
    <button type="submit" class="primary">{t('classQuiz.start')}</button>
  </form>
{:else if question}
  <section class="run" aria-labelledby="cq-prompt">
    <div class="top">
      <p class="progress">{t('practice.progress', { n: index + 1, total: questions.length })}</p>
      {#if timer > 0}{#key index}<Countdown seconds={timer} running={!revealed} ondone={() => (timeUp = true)} />{/key}{/if}
    </div>
    <h2 id="cq-prompt" class="prompt">{renderText(question.prompt)}</h2>
    {#if timeUp && !revealed}<p class="timeup">{t('classQuiz.timeUp')}</p>{/if}
    <div class="body">
      <div class="map"><MapStage /></div>
      <div class="side">
        {#if question.input.kind === 'choice'}
          <ol class="options">
            {#each question.input.options as o, i (i)}
              {@const correct = revealed && question.answer.kind === 'choice' && question.answer.index === i}
              <li class:correct><span class="letter" aria-hidden="true">{letters[i]}</span> {renderText(o)}{#if correct} <span class="tick">✓</span><span class="visually-hidden">({t('practice.resultCorrect')})</span>{/if}</li>
            {/each}
          </ol>
        {/if}
        <div aria-live="polite">
          {#if revealed}
            <p class="answer">{t('classQuiz.answer', { answer: renderText(describeAnswer(question)) })}</p>
            <p class="why">{renderText(question.explanation)}</p>
          {/if}
        </div>
      </div>
    </div>
    <div class="controls">
      <button type="button" onclick={() => go(-1)} disabled={index === 0}>← {t('classQuiz.prev')}</button>
      <button type="button" class="primary" onclick={reveal} disabled={revealed}>{t('classQuiz.reveal')}</button>
      <button type="button" onclick={() => go(1)} disabled={index === questions.length - 1}>{t('classQuiz.next')} →</button>
      <button type="button" onclick={() => (phase = 'setup')}>{t('classQuiz.end')}</button>
    </div>
    <p class="keys">{t('classQuiz.keys')}</p>
  </section>
{/if}

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); max-width: 48rem; }
  .setup fieldset { border: 1px solid var(--border); border-radius: var(--radius); margin: var(--space-3) 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
  .setup label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: var(--tap); }
  .field { display: flex !important; flex-direction: column; align-items: stretch !important; font-weight: 600; }
  .field input { min-height: var(--tap); font-size: 1.2rem; padding: 0 var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); max-width: 16rem; }
  .err { color: var(--bad); font-weight: 600; width: 100%; }
  .primary { background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 0 var(--space-6); font-weight: 700; }
  .run { display: flex; flex-direction: column; gap: var(--space-3); }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .progress { margin: 0; font-weight: 700; color: var(--text-muted); font-size: clamp(1rem, 1.5vw, 1.6rem); }
  .prompt { font-size: clamp(1.6rem, 1rem + 3vw, 4.5rem); line-height: 1.15; margin: 0; }
  .timeup { color: var(--bad); font-weight: 800; font-size: clamp(1.2rem, 2vw, 2.4rem); margin: 0; }
  .body { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .body { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; } }
  .options { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
  .options li { display: flex; gap: var(--space-3); align-items: center; font-size: clamp(1.2rem, 0.8rem + 1.8vw, 2.6rem); padding: var(--space-3) var(--space-4); border: 3px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .options li.correct { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, var(--surface)); font-weight: 800; }
  .letter { flex: none; width: 1.8em; height: 1.8em; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); border: 2px solid var(--border); font-weight: 800; }
  .tick { color: var(--ok); }
  .answer { font-size: clamp(1.3rem, 0.9rem + 2vw, 3rem); font-weight: 800; color: var(--ok); margin: var(--space-3) 0 var(--space-1); }
  .why { font-size: clamp(1.05rem, 0.8rem + 1vw, 1.8rem); }
  .controls { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .controls button { min-height: 3rem; padding: 0 var(--space-6); border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); font-weight: 700; font-size: 1.1rem; }
  .controls .primary { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .controls button:disabled { opacity: 0.5; }
  .keys { color: var(--text-muted); margin: 0; }
  @media (hover: none) { .keys { display: none; } }
</style>
```
Scene note: questions with `pointEditable` (place-point) are shown read-only in class mode; the reveal adds the answer marker. Read-coords questions hide the readout until reveal.

- [ ] **Step 5: Routes** — in `App.svelte`:

```svelte
  {:else if route.name === 'rehearsal'}
    <h1 tabindex="-1">{t('mode.rehearsal.title')}</h1>
    <Rehearsal />
  {:else if route.name === 'class-quiz'}
    <h1 tabindex="-1">{t('mode.classQuiz.title')}</h1>
    <ClassQuiz seed={route.seed} />
```

- [ ] **Step 6: E2E**

`tests/e2e/rehearsal.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('rehearsal runs 15 questions without feedback and reviews mistakes', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/rehearsal', '?test');
  await page.getByLabel('Easy').check();
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 15; i++) {
    await expect(page.getByText(`Question ${i + 1} of 15`)).toBeVisible();
    const radios = page.getByRole('radio');
    const textboxes = page.getByRole('textbox');
    const boxes = await textboxes.count();
    if (await radios.count() > 0) await radios.first().check();
    else if (boxes === 1) await textboxes.first().fill('1');                       // number or clock input
    else if (boxes === 2) { await textboxes.nth(0).fill('1N'); await textboxes.nth(1).fill('1E'); } // coordinates
    // boxes === 0: map-pick question; the current point is a valid (probably wrong) answer
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Correct!')).toHaveCount(0);
    await page.getByRole('button', { name: i < 14 ? 'Save and continue' : 'Finish the test' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your results' })).toBeFocused();
  await expect(page.getByText(/You got \d+ out of 15/)).toBeVisible();
  await expectNoAxeViolations(page, 'rehearsal results');
  expect(pageErrors(page)).toEqual([]);
});
```
The rehearsal answers are deliberately arbitrary; the test checks the flow, not the score. A clock input (Task 17) is one textbox, so `'1'` must be rejected or accepted consistently — Task 17 updates this branch to fill `'12:00'` for clock questions.

`tests/e2e/class-quiz.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('class quiz: same code gives same questions; keyboard reveals and navigates', async ({ page }) => {
  await openPage(page, 'en/class-quiz');
  await page.getByLabel(/Quiz code/).fill('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page).toHaveURL(/class-quiz\?seed=5b$/);
  const first = await page.locator('#cq-prompt').textContent();
  await page.locator('body').press('Space');
  await expect(page.getByText(/^Answer:/)).toBeVisible();
  await expectNoAxeViolations(page, 'class quiz revealed');
  await page.locator('body').press('ArrowRight');
  await expect(page.getByText('Question 2 of 10')).toBeVisible();
  await expect(page.getByText(/^Answer:/)).toHaveCount(0);
  await page.locator('body').press('Escape');

  await openPage(page, 'en/class-quiz?seed=5b');
  await expect(page.getByLabel(/Quiz code/)).toHaveValue('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page.locator('#cq-prompt')).toHaveText(first!);
});

test('class quiz timer counts down and says time is up', async ({ page }) => {
  test.setTimeout(40_000);
  await openPage(page, 'uk/class-quiz');
  await page.getByLabel('15 с').check();
  await page.getByRole('button', { name: 'Почати вікторину' }).click();
  await expect(page.getByText('Час вийшов!').first()).toBeVisible({ timeout: 20_000 });
});
```
Note: `generateSet` is a pure function of `(seed, topics, difficulty, count)`, so identical settings reproduce the set exactly.

- [ ] **Step 7: Run and look** — all checks; `npm run shot -- "en/class-quiz?seed=abc" class-quiz` shows the setup page only; to see run mode, add a temporary Playwright script in the spec that screenshots after starting at 1920×1080 into `shots/`, view it, remove the screenshot line.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(quiz): test rehearsal with review and big-screen class quiz with timer"
```
