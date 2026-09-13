# Part 3 — Topics and practice (Tasks 12–14)

Read `README.md` first.

---

### Task 12: Topic framework, Explore walkthrough and topics 1–4

**Files:**
- Create: `src/topics/types.ts`, `src/topics/index.ts`, `src/topics/t1-grid.ts`, `src/topics/t2-position.ts`, `src/topics/t3-reading.ts`, `src/topics/t4-finding.ts`, `src/app/TopicPage.svelte`, `src/app/Explore.svelte`
- Modify: `src/app/App.svelte`, `src/map/MapStage.svelte` (no change to props), `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/topics.test.ts`, `tests/e2e/explore.spec.ts`

**Interfaces:**
- Consumes: `SceneSpec` (Task 7), `mapState` (Task 7), `MapStage` (Tasks 9–11), `router`, `navigate` (Task 6), `TopicId`, `TOPIC_IDS` (Task 6).
- Produces:
  - `src/topics/types.ts`:
    ```ts
    import type { TopicId } from '../app/ids';
    import type { SceneSpec } from '../map/types';
    import type { QuestionTypeId } from '../quiz/types';
    export interface ExploreStep { id: string; scene: SceneSpec; showPlaces?: boolean }
    export interface TopicDef { id: TopicId; steps: ExploreStep[]; questionTypes: QuestionTypeId[] }
    ```
    Because `src/quiz/types.ts` does not exist until Task 13, this task creates `src/quiz/types.ts` containing **only** the `QuestionTypeId` union from README; Task 13 fills in the rest of that file.
  - `src/topics/index.ts`: `TOPICS: Partial<Record<TopicId, TopicDef>>` (topics 5–8 added in Tasks 15 and 17) and `getTopic(id: TopicId): TopicDef | undefined`.
  - Step text keys: `topic.<n>.step.<stepId>.title` and `topic.<n>.step.<stepId>.body`.
  - `TopicPage.svelte` props `{ topic: TopicId; tab: 'explore' | 'practice'; step: number }` — renders `<h1>` topic title, a `<nav>` with two links (`aria-current="page"` on the active one), then `Explore` or (Task 14) `Practice`, then previous/next topic links. Topics without a definition yet show the home link and a short "coming soon" line (removed once all topics exist in Task 17).
  - `Explore.svelte` props `{ topic: TopicDef; step: number }`.

- [ ] **Step 1: Stub `src/quiz/types.ts`**

```ts
export type QuestionTypeId = 'name-line' | 'further' | 'relative-line' | 'read-coords' | 'place-point' | 'which-place' | 'difference' | 'distance' | 'time';
```

- [ ] **Step 2: Topic definitions**

`src/topics/t1-grid.ts`:
```ts
import type { TopicDef } from './types';

export const topic1: TopicDef = {
  id: 1,
  questionTypes: ['name-line'],
  steps: [
    { id: 'ball', scene: { views: ['globe'], point: null, rotate: [-20, -25], layers: { specialLines: false, places: false, graticuleStep: 30 } } },
    { id: 'equator', scene: { views: ['globe', 'flat'], point: null, rotate: [-20, -15], layers: { specialLines: true, hemispheres: 'ns', places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 0 }] } },
    { id: 'parallels', scene: { views: ['globe', 'flat'], point: null, rotate: [-20, -35], layers: { specialLines: true, graticuleStep: 15, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 30 }, { kind: 'highlight-line', axis: 'lat', value: 60 }] } },
    { id: 'angle', scene: { views: ['cross-section', 'globe'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true, places: false } } },
    { id: 'meridians', scene: { views: ['globe', 'flat'], point: null, rotate: [-30, -20], layers: { specialLines: true, graticuleStep: 15, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 30 }, { kind: 'highlight-line', axis: 'lon', value: -60 }] } },
    { id: 'prime', scene: { views: ['globe', 'flat'], point: null, rotate: [0, -20], layers: { specialLines: true, hemispheres: 'ew', places: false } } },
    { id: 'tropics', scene: { views: ['flat', 'cross-section'], point: { lat: 23, lon: 0 }, layers: { specialLines: true, tropics: true, places: false, pointGuides: false } } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true, tropics: true } } },
  ],
};
```

`src/topics/t2-position.ts`:
```ts
import type { TopicDef } from './types';

export const topic2: TopicDef = {
  id: 2,
  questionTypes: ['further', 'relative-line'],
  steps: [
    { id: 'north-south', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }, { kind: 'marker', p: { lat: 52.23, lon: 21.01 }, tone: 'a', label: '52°N' }, { kind: 'marker', p: { lat: 41.9, lon: 12.5 }, tone: 'b', label: '42°N' }] } },
    { id: 'southern', scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: -20 }, { kind: 'marker', p: { lat: -40, lon: 20 }, tone: 'a', label: '40°S' }, { kind: 'marker', p: { lat: -10, lon: 60 }, tone: 'b', label: '10°S' }] } },
    { id: 'east-west', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 20 }, { kind: 'marker', p: { lat: 50.45, lon: 30.52 }, tone: 'a', label: '31°E' }, { kind: 'marker', p: { lat: 51.51, lon: -0.13 }, tone: 'b', label: '0°' }] } },
    { id: 'western', scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: -60 }, { kind: 'marker', p: { lat: 40, lon: -100 }, tone: 'a', label: '100°W' }, { kind: 'marker', p: { lat: 10, lon: -30 }, tone: 'b', label: '30°W' }] } },
    { id: 'across-zero', scene: { views: ['globe', 'flat'], point: null, rotate: [0, -10], layers: { specialLines: true, hemispheres: 'ew', places: false } } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 10, lon: -10 }, pointEditable: true, layers: { specialLines: true } } },
  ],
};
```

`src/topics/t3-reading.ts`:
```ts
import type { TopicDef } from './types';

export const topic3: TopicDef = {
  id: 3,
  questionTypes: ['read-coords'],
  steps: [
    { id: 'address', scene: { views: ['flat'], flatPreset: 'europe', point: { lat: 52, lon: 21 }, layers: { specialLines: true } } },
    { id: 'latitude', scene: { views: ['flat'], point: { lat: 30, lon: 30 }, showReadout: false, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 30 }] } },
    { id: 'longitude', scene: { views: ['flat'], point: { lat: 30, lon: 30 }, showReadout: false, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 30 }] } },
    { id: 'answer', scene: { views: ['flat'], point: { lat: 30, lon: 30 }, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 30 }, { kind: 'highlight-line', axis: 'lon', value: 30 }] } },
    { id: 'between', scene: { views: ['flat'], flatView: { center: { lat: 45, lon: 15 }, zoom: 4 }, point: { lat: 45, lon: 15 }, layers: { specialLines: true, graticuleStep: 10 }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 40 }, { kind: 'highlight-line', axis: 'lat', value: 50 }] } },
    { id: 'southwest', scene: { views: ['flat'], point: { lat: -30, lon: -60 }, showReadout: false, layers: { specialLines: true, places: false, hemispheres: 'none' } } },
    { id: 'globe', scene: { views: ['globe', 'flat'], point: { lat: -34, lon: 151 }, layers: { specialLines: true } } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true } } },
  ],
};
```

`src/topics/t4-finding.ts`:
```ts
import type { TopicDef } from './types';

export const topic4: TopicDef = {
  id: 4,
  questionTypes: ['place-point', 'which-place'],
  steps: [
    { id: 'plan', scene: { views: ['flat'], flatPreset: 'europe', point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }] } },
    { id: 'meridian', scene: { views: ['flat'], flatPreset: 'europe', point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }, { kind: 'highlight-line', axis: 'lon', value: 30 }] } },
    { id: 'cross', scene: { views: ['flat'], flatPreset: 'europe', point: null, layers: { specialLines: true, places: true }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }, { kind: 'highlight-line', axis: 'lon', value: 30 }, { kind: 'marker', p: { lat: 50, lon: 30 }, tone: 'answer' }] } },
    { id: 'letters', scene: { views: ['globe', 'flat'], point: null, rotate: [150, 0], layers: { specialLines: true, places: true }, overlays: [{ kind: 'marker', p: { lat: -34, lon: 151 }, tone: 'a', label: '34°S, 151°E' }, { kind: 'marker', p: { lat: 34, lon: -151 }, tone: 'b', label: '34°N, 151°W' }] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 0, lon: 0 }, pointEditable: true, layers: { specialLines: true } }, showPlaces: true },
  ],
};
```

`src/topics/index.ts`:
```ts
import type { TopicId } from '../app/ids';
import { topic1 } from './t1-grid';
import { topic2 } from './t2-position';
import { topic3 } from './t3-reading';
import { topic4 } from './t4-finding';
import type { TopicDef } from './types';

export const TOPICS: Partial<Record<TopicId, TopicDef>> = { 1: topic1, 2: topic2, 3: topic3, 4: topic4 };

export function getTopic(id: TopicId): TopicDef | undefined {
  return TOPICS[id];
}
```

- [ ] **Step 3: Step texts.** English below is the source; write PL and UK with the §6.2 terms (PL uses N/S/E/W letters in examples; UK uses «пн. ш.» etc. — e.g. UK "Варшава (52° пн. ш.)"). Keys: `topic.<n>.step.<id>.title` / `.body`.

Topic 1:
- `ball` — **The Earth is a ball** — "To say exactly where a place is on a ball, we draw an imaginary grid on it. The grid has two kinds of lines: parallels and meridians. Drag the globe to turn it."
- `equator` — **The equator** — "The equator goes around the middle of the Earth. It is the longest parallel and its latitude is 0°. It divides the Earth into the Northern Hemisphere and the Southern Hemisphere."
- `parallels` — **Parallels** — "Parallels are circles that run parallel to the equator. The closer to a pole, the shorter they are. They tell us the latitude: from 0° at the equator up to 90°N at the North Pole or 90°S at the South Pole."
- `angle` — **Why degrees?** — "Latitude is an angle! Imagine a line from the centre of the Earth to a place. The angle between that line and the equator is the latitude. Drag the point on the circle and watch the angle change."
- `meridians` — **Meridians** — "Meridians are half-circles that join the North Pole and the South Pole. All meridians are the same length. They tell us the longitude."
- `prime` — **The prime meridian and 180°** — "The prime meridian (0°) goes through Greenwich in London. On the other side of the Earth is the 180° meridian. Together they divide the Earth into the Eastern and Western Hemispheres. Longitude goes from 0° up to 180°E or 180°W."
- `tropics` — **Tropics and polar circles** — "Some parallels have their own names: the Tropic of Cancer (about 23°N), the Tropic of Capricorn (about 23°S), the Arctic Circle (about 66°N) and the Antarctic Circle (about 66°S)."
- `play` — **Try it yourself** — "Drag the point around. When is it in the Northern Hemisphere? When is it in the Western Hemisphere? Find the Tropic of Cancer."

Topic 2:
- `north-south` — **North or south?** — "On a map, north is at the top. Warsaw (52°N) is north of the 50°N parallel. Rome (42°N) is south of it. In the Northern Hemisphere a bigger number means further north."
- `southern` — **Careful in the south!** — "In the Southern Hemisphere a bigger number means further south. 40°S is south of 20°S, and 10°S is north of it."
- `east-west` — **East or west?** — "East is to the right on a map. Kyiv (31°E) is east of the 20°E meridian. London (0°) is west of it. In the Eastern Hemisphere a bigger number means further east."
- `western` — **Careful in the west!** — "In the Western Hemisphere a bigger number means further west. 100°W is west of 60°W, and 30°W is east of it."
- `across-zero` — **Across the lines** — "Every place with N latitude is north of every place with S latitude. Every place with E longitude is east of Greenwich, and every place with W longitude is west of it."
- `play` — **Try it yourself** — "Move the point and say it out loud: is it north or south of the equator? East or west of Greenwich? Then check the coordinates below the map."

Topic 3:
- `address` — **An address in two numbers** — "Coordinates are written as latitude first, then longitude: 52°N, 21°E. That is Warsaw!"
- `latitude` — **Step 1: latitude** — "Find the parallel that goes through the point and read its number at the left edge of the map. Is the point above the equator (N) or below it (S)?"
- `longitude` — **Step 2: longitude** — "Now find the meridian that goes through the point and read its number at the bottom edge. Is the point right of Greenwich (E) or left of it (W)?"
- `answer` — **Put it together** — "The point lies on the 30°N parallel and on the 30°E meridian. Its coordinates are 30°N, 30°E — very close to Cairo."
- `between` — **Between the lines** — "If a point lies between two lines, count the degrees. Halfway between 40° and 50° is 45°."
- `southwest` — **South and west** — "Try this point yourself: which parallel and which meridian go through it? Remember the letters S and W. (Answer: 30°S, 60°W.)"
- `globe` — **On the globe** — "The grid works the same way on the globe. Turn the globe to find the point near Sydney: 34°S, 151°E."
- `play` — **Try it yourself** — "Drag the point, say its coordinates out loud, then check the answer below the map."

Topic 4:
- `plan` — **From numbers to a place** — "Let's find 50°N, 30°E. First find the parallel: 50°N."
- `meridian` — **Then the meridian** — "Now find the meridian 30°E. Remember: E means to the right of Greenwich."
- `cross` — **Where the lines cross** — "The place is where the two lines cross. It is Kyiv!"
- `letters` — **Letters matter** — "34°S, 151°E is Sydney. But 34°N, 151°W is in the middle of the Pacific Ocean! Always check N or S and E or W."
- `play` — **Try it yourself** — "Drag the point to find places, or pick a city from the list and check its coordinates."

UI keys:

| key | en | pl | uk |
|---|---|---|---|
| topic.nav | Topic sections | Części tematu | Розділи теми |
| topic.explore | Learn | Poznaj | Вивчай |
| topic.practice | Practise | Ćwicz | Тренуйся |
| topic.prev | Previous topic: {title} | Poprzedni temat: {title} | Попередня тема: {title} |
| topic.next | Next topic: {title} | Następny temat: {title} | Наступна тема: {title} |
| topic.soon | This topic is coming soon. | Ten temat już wkrótce. | Ця тема незабаром. |
| explore.progress | Step {n} of {total} | Krok {n} z {total} | Крок {n} з {total} |
| explore.prev | Previous | Wstecz | Назад |
| explore.next | Next | Dalej | Далі |
| explore.goto | Go to step {n} | Przejdź do kroku {n} | Перейти до кроку {n} |
| explore.practiceNow | Practise this topic | Poćwicz ten temat | Потренуйся з цієї теми |
| explore.keysHint | Tip: use ← and → keys to change steps. | Wskazówka: klawisze ← i → zmieniają kroki. | Порада: клавіші ← і → перемикають кроки. |

- [ ] **Step 4: Unit test** `tests/unit/topics.test.ts`:

```ts
import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { TOPICS } from '../../src/topics';

test('every step has title and body in every language and a valid scene', () => {
  for (const topic of Object.values(TOPICS)) {
    const ids = new Set<string>();
    expect(topic!.steps.length).toBeGreaterThanOrEqual(4);
    for (const step of topic!.steps) {
      expect(ids.has(step.id)).toBe(false); ids.add(step.id);
      for (const file of [en, pl, uk] as Record<string, string>[]) {
        expect(file).toHaveProperty(`topic.${topic!.id}.step.${step.id}.title`);
        expect(file).toHaveProperty(`topic.${topic!.id}.step.${step.id}.body`);
      }
      expect(step.scene.views.length).toBeGreaterThan(0);
      if (step.scene.point) { expect(Math.abs(step.scene.point.lat)).toBeLessThanOrEqual(90); }
    }
    expect(topic!.steps.at(-1)!.id).toBe('play');
  }
});
```
Run → FAIL until the keys exist; add keys; run → PASS.

- [ ] **Step 5: `src/app/Explore.svelte`**

```svelte
<script lang="ts">
  import { i18n, t } from '../i18n/i18n.svelte';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import type { TopicDef } from '../topics/types';
  import { formatRoute } from './router';
  import { navigate } from './router.svelte';

  let { topic, step }: { topic: TopicDef; step: number } = $props();

  const index = $derived(Math.min(step, topic.steps.length - 1));
  const current = $derived(topic.steps[index]!);
  const total = $derived(topic.steps.length);
  let heading: HTMLHeadingElement;
  let lastApplied = '';

  $effect(() => {
    const key = `${topic.id}:${index}`;
    if (key === lastApplied) return;
    const moveFocus = lastApplied !== '' && lastApplied.startsWith(`${topic.id}:`);
    lastApplied = key;
    mapState.applyScene(current.scene);
    if (step !== index) navigate({ name: 'explore', lang: i18n.lang, topic: topic.id, step: index }, { replace: true });
    if (moveFocus) queueMicrotask(() => heading?.focus());
  });

  function go(i: number) {
    if (i < 0 || i >= total) return;
    navigate({ name: 'explore', lang: i18n.lang, topic: topic.id, step: i }, { replace: true });
  }

  function isInteractive(el: EventTarget | null): boolean {
    if (!(el instanceof Element)) return false;
    return !!el.closest('input, textarea, select, [role="slider"], svg[tabindex], dialog, [contenteditable]');
  }

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isInteractive(e.target)) return;
      if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="explore">
  <div class="stage"><MapStage showPlaces={current.showPlaces ?? false} /></div>
  <aside class="panel" aria-labelledby="step-title">
    <p class="progress">{t('explore.progress', { n: index + 1, total })}</p>
    <h2 id="step-title" tabindex="-1" bind:this={heading}>{t(`topic.${topic.id}.step.${current.id}.title`)}</h2>
    <p class="body">{t(`topic.${topic.id}.step.${current.id}.body`)}</p>
    <div class="nav">
      <button type="button" onclick={() => go(index - 1)} disabled={index === 0}>← {t('explore.prev')}</button>
      {#if index < total - 1}
        <button type="button" class="primary" onclick={() => go(index + 1)}>{t('explore.next')} →</button>
      {:else}
        <a class="primary" href={formatRoute({ name: 'practice', lang: i18n.lang, topic: topic.id })}>{t('explore.practiceNow')} →</a>
      {/if}
    </div>
    <ol class="dots">
      {#each topic.steps as s, i (s.id)}
        <li><button type="button" aria-current={i === index ? 'step' : undefined} aria-label={t('explore.goto', { n: i + 1 })} onclick={() => go(i)}>{i + 1}</button></li>
      {/each}
    </ol>
    <p class="hint">{t('explore.keysHint')}</p>
  </aside>
</div>

<style>
  .explore { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .explore { grid-template-columns: minmax(0, 1fr) 24rem; align-items: start; } .panel { position: sticky; top: 5rem; } }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); }
  .progress { margin: 0; color: var(--text-muted); font-weight: 600; }
  h2 { margin: var(--space-1) 0 var(--space-2); font-size: clamp(1.3rem, 1rem + 1.2vw, 2rem); }
  .body { font-size: clamp(1.05rem, 0.95rem + 0.4vw, 1.35rem); line-height: 1.55; }
  .nav { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: space-between; }
  .nav button, .nav a { display: inline-flex; align-items: center; min-height: var(--tap); padding: 0 var(--space-4); border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); font-weight: 600; text-decoration: none; color: var(--text); }
  .nav .primary { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .nav button:disabled { opacity: 0.55; cursor: not-allowed; }
  .dots { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-1); padding: 0; margin: var(--space-4) 0 0; }
  .dots button { border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2); font-weight: 600; }
  .dots button[aria-current='step'] { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .hint { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0; }
  @media (hover: none) { .hint { display: none; } }
</style>
```
Note: `Explore` renders after `MapStage` in the DOM on phones (map first, text below) as the spec requires; on large screens the panel sits to the right.

- [ ] **Step 6: `src/app/TopicPage.svelte`**

```svelte
<script lang="ts">
  import type { TopicId } from './ids';
  import { TOPIC_IDS } from './ids';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { getTopic } from '../topics';
  import Explore from './Explore.svelte';
  import { formatRoute } from './router';

  let { topic, tab, step }: { topic: TopicId; tab: 'explore' | 'practice'; step: number } = $props();
  const def = $derived(getTopic(topic));
  const prev = $derived(TOPIC_IDS[TOPIC_IDS.indexOf(topic) - 1]);
  const next = $derived(TOPIC_IDS[TOPIC_IDS.indexOf(topic) + 1]);
</script>

<h1 tabindex="-1"><span class="num" aria-hidden="true">{topic}</span> {t(`topic.${topic}.title`)}</h1>
<nav class="tabs" aria-label={t('topic.nav')}>
  <a href={formatRoute({ name: 'explore', lang: i18n.lang, topic, step: 0 })} aria-current={tab === 'explore' ? 'page' : undefined}>{t('topic.explore')}</a>
  <a href={formatRoute({ name: 'practice', lang: i18n.lang, topic })} aria-current={tab === 'practice' ? 'page' : undefined}>{t('topic.practice')}</a>
</nav>

{#if !def}
  <p>{t('topic.soon')}</p>
{:else if tab === 'explore'}
  <Explore topic={def} {step} />
{:else}
  <p>{t('topic.soon')}</p>
{/if}

<nav class="pager" aria-label={t('home.topics')}>
  {#if prev}<a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: prev, step: 0 })}>← {t('topic.prev', { title: t(`topic.${prev}.title`) })}</a>{:else}<span></span>{/if}
  {#if next}<a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: next, step: 0 })}>{t('topic.next', { title: t(`topic.${next}.title`) })} →</a>{/if}
</nav>

<style>
  h1 { display: flex; gap: var(--space-3); align-items: center; font-size: clamp(1.4rem, 1.1rem + 1.5vw, 2.4rem); margin: var(--space-2) 0; }
  .num { width: 2.5rem; height: 2.5rem; border-radius: 50%; display: inline-grid; place-items: center; background: var(--accent); color: var(--accent-contrast); font-size: 1.2rem; flex: none; }
  .tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 2px solid var(--border); }
  .tabs a { display: inline-flex; align-items: center; min-height: var(--tap); padding: 0 var(--space-4); color: var(--text); text-decoration: none; font-weight: 600; border-bottom: 4px solid transparent; margin-bottom: -2px; }
  .tabs a[aria-current='page'] { border-bottom-color: var(--accent); color: var(--accent); }
  .pager { display: flex; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; margin-top: var(--space-8); }
  .pager a { display: inline-flex; align-items: center; min-height: var(--tap); color: var(--accent); font-weight: 600; }
</style>
```
(The `{:else}` practice branch is replaced by `<Practice topic={def} />` in Task 14.)

- [ ] **Step 7: Route wiring** — in `App.svelte` import `TopicPage` and extend the chain:

```svelte
  {#if route.name === 'lab'}
    <LabPage />
  {:else if route.name === 'explore'}
    <TopicPage topic={route.topic} tab="explore" step={route.step} />
  {:else if route.name === 'practice'}
    <TopicPage topic={route.topic} tab="practice" step={0} />
  {:else}
    <Home />
  {/if}
```

- [ ] **Step 8: E2E** `tests/e2e/explore.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  for (const topic of [1, 2, 3, 4]) {
    test(`topic ${topic} explore in ${lang}: every step renders without axe violations`, async ({ page }) => {
      await openPage(page, `${lang}/topic-${topic}/explore`);
      const total = await page.locator('.dots li').count();
      for (let i = 0; i < total; i++) {
        await page.goto(page.url().replace(/#.*/, `#${lang}/topic-${topic}/explore/${i + 1}`));
        await expect(page.locator('#step-title')).not.toBeEmpty();
        if (i === 0 || i === total - 1) await expectNoAxeViolations(page, `${lang} t${topic} s${i + 1}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }
}

test('next/previous buttons and arrow keys change steps with replace history', async ({ page }) => {
  await openPage(page, 'en/topic-1/explore');
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page).toHaveURL(/#en\/topic-1\/explore\/2$/);
  await expect(page.locator('#step-title')).toHaveText('The equator');
  await page.locator('body').press('ArrowRight');
  await expect(page).toHaveURL(/explore\/3$/);
  await page.locator('body').press('ArrowLeft');
  await expect(page).toHaveURL(/explore\/2$/);
});

test('step beyond the end clamps to the last step', async ({ page }) => {
  await openPage(page, 'en/topic-2/explore/99');
  await expect(page).toHaveURL(/#en\/topic-2\/explore\/6$/);
});

test('topic tabs mark the current page', async ({ page }) => {
  await openPage(page, 'uk/topic-3/explore');
  await expect(page.getByRole('link', { name: 'Вивчай' })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 9: Run and look** — all checks; then `npm run shot -- "en/topic-1/explore/4" t1-angle` and `npm run shot -- "pl/topic-3/explore/2" t3-lat` and view them. Check that texts are readable and the map is not cropped.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(topics): explore walkthrough with topics 1-4 in three languages"
```

---

### Task 13: Quiz core and question generators for topics 1–4

**Files:**
- Modify: `src/quiz/types.ts` (complete it)
- Create: `src/quiz/rng.ts`, `src/quiz/values.ts`, `src/quiz/check.ts`, `src/quiz/registry.ts`, `src/quiz/generators/nameLine.ts`, `src/quiz/generators/further.ts`, `src/quiz/generators/relativeLine.ts`, `src/quiz/generators/readCoords.ts`, `src/quiz/generators/placePoint.ts`, `src/quiz/generators/whichPlace.ts`
- Modify: `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/rng.test.ts`, `tests/unit/check.test.ts`, `tests/unit/generators.test.ts`, `tests/unit/textKeys.ts` (helper)

**Interfaces:**
- Consumes: geo functions (Tasks 2–3), `Text` (Task 5), `Overlay`, `SceneSpec`, `MarkerTone` (Task 7), `PLACES` (Task 7), `TopicId` (Task 6), `TROPIC`, `POLAR` (Task 8).
- Produces:
  - `src/quiz/types.ts` — README block verbatim (with `meta` and `describeAnswer`).
  - `rng.ts`: `createRng(seed: string | number): Rng`, `randomSeed(): string` (8 base-36 chars from `Math.random`).
  - `values.ts`: `LABELS = ['A','B','C','D'] as const`, `TONES: MarkerTone[] = ['a','b','c','d']`, `gridInt(rng, min, max, step): number`, `signed(rng): 1 | -1`, `withMinutes(deg: number, minutes: number): number` (sign of `deg` kept, `|deg| + minutes/60`).
  - `check.ts`: `anglesMatch(a: number, b: number, axis: Axis, precision: Precision): boolean`, `coordsMatch(expected: LatLon, got: LatLon, fields: Axis | 'both', precision: Precision): boolean`, `coordMistake(expected: LatLon, got: LatLon, fields: Axis | 'both', precision: Precision): Text | undefined`, `checkChoice(q: Question, r: Answer): CheckResult`, `checkCoords(q: Question, r: Answer): CheckResult`, `choiceText(q: Question): Text`.
  - `registry.ts`: `getModule(type: QuestionTypeId): QuestionModule`, `modulesForTopic(topic: TopicId): QuestionModule[]`, `checkAnswer(q: Question, r: Answer): CheckResult`, `describeAnswer(q: Question): Text`, `generateSet(seed: string, topics: readonly TopicId[], difficulty: Difficulty, count: number): Question[]`, `MODULES: QuestionModule[]` (Tasks 15 and 17 append their modules to this array).
  - Each generator file exports one `QuestionModule` named after the file (`nameLine`, `further`, …).

- [ ] **Step 1: Complete `src/quiz/types.ts`** with the README "src/quiz/types.ts" block (including `export type { TopicId } from '../app/ids';` and the `Text` import from `../i18n/text`, `LatLon`/`Precision`/`Axis` from `../geo/types`, `Overlay`/`SceneSpec` from `../map/types`).

- [ ] **Step 2: RNG — test then implement**

`tests/unit/rng.test.ts`:
```ts
import { expect, test } from 'vitest';
import { createRng } from '../../src/quiz/rng';

test('deterministic per seed, different across seeds', () => {
  const a = createRng('5b'), b = createRng('5b'), c = createRng('5c');
  const seqA = Array.from({ length: 5 }, () => a.next());
  expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
  expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
});
test('int is inclusive and in range; shuffle is a permutation', () => {
  const r = createRng(1);
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) { const v = r.int(-2, 2); expect(v).toBeGreaterThanOrEqual(-2); expect(v).toBeLessThanOrEqual(2); seen.add(v); }
  expect(seen.size).toBe(5);
  expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
});
```

`src/quiz/rng.ts`:
```ts
import type { Rng } from './types';

function hash(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function createRng(seed: string | number): Rng {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
      return out;
    },
  };
}

export function randomSeed(): string {
  return Math.floor(Math.random() * 36 ** 8).toString(36).padStart(8, '0');
}
```

- [ ] **Step 3: Values and checking — test then implement**

`tests/unit/check.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { anglesMatch, coordMistake, coordsMatch } from '../../src/quiz/check';

describe('matching', () => {
  test('degrees are exact, minutes allow ±1′, longitude wraps', () => {
    expect(anglesMatch(52, 52, 'lat', 'degree')).toBe(true);
    expect(anglesMatch(52, 53, 'lat', 'degree')).toBe(false);
    expect(anglesMatch(52.5, 52.5 + 1 / 60, 'lat', 'minute')).toBe(true);
    expect(anglesMatch(52.5, 52.5 + 2 / 60, 'lat', 'minute')).toBe(false);
    expect(anglesMatch(180, -180, 'lon', 'degree')).toBe(true);
  });
  test('coordsMatch honours fields', () => {
    expect(coordsMatch({ lat: 10, lon: 20 }, { lat: 10, lon: 99 }, 'lat', 'degree')).toBe(true);
    expect(coordsMatch({ lat: 10, lon: 20 }, { lat: 10, lon: 99 }, 'both', 'degree')).toBe(false);
  });
});

describe('mistakes', () => {
  const e = { lat: 30, lon: -60 };
  test.each([
    [{ lat: -30, lon: -60 }, 'q.mistake.nsLetter'],
    [{ lat: 30, lon: 60 }, 'q.mistake.ewLetter'],
    [{ lat: -30, lon: 60 }, 'q.mistake.bothLetters'],
    [{ lat: -60, lon: 30 }, 'q.mistake.swapped'],
    [{ lat: 31, lon: -60 }, undefined],
  ])('%o -> %s', (got, key) => {
    expect(coordMistake(e, got, 'both', 'degree')?.key).toBe(key);
  });
  test('minutes hint when degrees right but minutes wrong', () => {
    expect(coordMistake({ lat: 52.5, lon: 21 }, { lat: 52.25, lon: 21 }, 'both', 'minute')?.key).toBe('q.mistake.minutes');
  });
});
```
(`swapped`: got.lat equals expected.lon **in absolute value** and got.lon equals expected.lat in absolute value — kids swap numbers and usually keep letters attached to the numbers.)

`src/quiz/values.ts`:
```ts
import type { MarkerTone } from '../map/types';
import type { Rng } from './types';

export const LABELS = ['A', 'B', 'C', 'D'] as const;
export const TONES: MarkerTone[] = ['a', 'b', 'c', 'd'];

export function gridInt(rng: Rng, min: number, max: number, step: number): number {
  return rng.int(Math.ceil(min / step), Math.floor(max / step)) * step;
}

export function signed(rng: Rng): 1 | -1 {
  return rng.next() < 0.5 ? 1 : -1;
}

export function withMinutes(deg: number, minutes: number): number {
  const s = deg < 0 ? -1 : 1;
  return s * (Math.abs(deg) + minutes / 60);
}
```

`src/quiz/check.ts`:
```ts
import { lonDifference } from '../geo/compare';
import { toDegMin } from '../geo/format';
import type { Axis, LatLon, Precision } from '../geo/types';
import type { Text } from '../i18n/text';
import type { Answer, CheckResult, Question } from './types';

const EPS = 1e-9;

export function anglesMatch(a: number, b: number, axis: Axis, precision: Precision): boolean {
  const tol = precision === 'minute' ? 1 / 60 + EPS : EPS;
  const d = axis === 'lon' ? lonDifference(a, b) : Math.abs(a - b);
  return d <= tol;
}

export function coordsMatch(expected: LatLon, got: LatLon, fields: Axis | 'both', precision: Precision): boolean {
  const latOk = fields === 'lon' || anglesMatch(expected.lat, got.lat, 'lat', precision);
  const lonOk = fields === 'lat' || anglesMatch(expected.lon, got.lon, 'lon', precision);
  return latOk && lonOk;
}

const absEq = (a: number, b: number, precision: Precision) => Math.abs(Math.abs(a) - Math.abs(b)) <= (precision === 'minute' ? 1 / 60 : 0) + EPS;

export function coordMistake(expected: LatLon, got: LatLon, fields: Axis | 'both', precision: Precision): Text | undefined {
  if (coordsMatch(expected, got, fields, precision)) return undefined;
  if (fields === 'both' && Math.abs(expected.lat) !== Math.abs(expected.lon)
      && absEq(got.lat, expected.lon, precision) && absEq(got.lon, expected.lat, precision)) return { key: 'q.mistake.swapped' };
  const latAbs = fields === 'lon' || absEq(got.lat, expected.lat, precision);
  const lonAbs = fields === 'lat' || absEq(got.lon, expected.lon, precision);
  const latSignWrong = fields !== 'lon' && expected.lat !== 0 && latAbs && Math.sign(got.lat) !== Math.sign(expected.lat);
  const lonSignWrong = fields !== 'lat' && Math.abs(expected.lon) !== 180 && expected.lon !== 0 && lonAbs && Math.sign(got.lon) !== Math.sign(expected.lon);
  const latOk = fields === 'lon' || anglesMatch(expected.lat, got.lat, 'lat', precision);
  const lonOk = fields === 'lat' || anglesMatch(expected.lon, got.lon, 'lon', precision);
  if (latSignWrong && lonSignWrong) return { key: 'q.mistake.bothLetters' };
  if (latSignWrong && lonOk) return { key: 'q.mistake.nsLetter' };
  if (lonSignWrong && latOk) return { key: 'q.mistake.ewLetter' };
  if (precision === 'minute') {
    const sameDeg = (a: number, b: number) => Math.sign(a) === Math.sign(b) && toDegMin(a).deg === toDegMin(b).deg;
    if ((fields === 'lon' || sameDeg(expected.lat, got.lat)) && (fields === 'lat' || sameDeg(expected.lon, got.lon))) return { key: 'q.mistake.minutes' };
  }
  return undefined;
}

export function checkChoice(q: Question, r: Answer): CheckResult {
  return { correct: q.answer.kind === 'choice' && r.kind === 'choice' && r.index === q.answer.index };
}

export function checkCoords(q: Question, r: Answer): CheckResult {
  if (q.answer.kind !== 'coords' || q.input.kind !== 'coords' || r.kind !== 'coords') return { correct: false };
  const correct = coordsMatch(q.answer.value, r.value, q.input.fields, q.input.precision);
  return correct ? { correct } : { correct, mistake: coordMistake(q.answer.value, r.value, q.input.fields, q.input.precision) };
}

export function choiceText(q: Question): Text {
  if (q.input.kind !== 'choice' || q.answer.kind !== 'choice') throw new Error('not a choice question');
  return q.input.options[q.answer.index]!;
}
```

Run `npx vitest run tests/unit/rng.test.ts tests/unit/check.test.ts` → PASS.

- [ ] **Step 4: Generators**

`src/quiz/generators/nameLine.ts`:
```ts
import { hemisphereLat, hemisphereLon } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { POLAR, TROPIC } from '../../map/geometry';
import type { Overlay } from '../../map/types';
import { checkChoice, choiceText } from '../check';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';

type LineKind = 'equator' | 'prime' | 'antimeridian' | 'parallel' | 'meridian' | 'tropicCancer' | 'tropicCapricorn' | 'arcticCircle' | 'antarcticCircle';
const EASY: LineKind[] = ['equator', 'prime', 'parallel', 'meridian'];
const HARD: LineKind[] = [...EASY, 'antimeridian', 'tropicCancer', 'tropicCapricorn', 'arcticCircle', 'antarcticCircle'];
const PARALLEL_KINDS: LineKind[] = ['equator', 'tropicCancer', 'tropicCapricorn', 'arcticCircle', 'antarcticCircle'];
const MERIDIAN_KINDS: LineKind[] = ['prime', 'antimeridian'];

function lineFor(kind: LineKind, rng: Rng): { axis: 'lat' | 'lon'; value: number } {
  switch (kind) {
    case 'equator': return { axis: 'lat', value: 0 };
    case 'prime': return { axis: 'lon', value: 0 };
    case 'antimeridian': return { axis: 'lon', value: 180 };
    case 'tropicCancer': return { axis: 'lat', value: TROPIC };
    case 'tropicCapricorn': return { axis: 'lat', value: -TROPIC };
    case 'arcticCircle': return { axis: 'lat', value: POLAR };
    case 'antarcticCircle': return { axis: 'lat', value: -POLAR };
    case 'parallel': return { axis: 'lat', value: rng.pick([10, 20, 30, 40, 50, 60, 70, 80]) * (rng.next() < 0.5 ? 1 : -1) };
    case 'meridian': return { axis: 'lon', value: rng.pick([30, 60, 90, 120, 150]) * (rng.next() < 0.5 ? 1 : -1) };
  }
}

function base(difficulty: Difficulty, rest: Omit<Question, 'id' | 'type' | 'topic' | 'difficulty'>): Question {
  return { id: '', type: 'name-line', topic: 1, difficulty, ...rest };
}

function lineQuestion(rng: Rng, difficulty: Difficulty): Question {
  const pool = difficulty === 'easy' ? EASY : HARD;
  const kind = rng.pick(pool);
  // A distractor must not also be true: the equator and named parallels ARE parallels, 0° and 180° ARE meridians.
  const forbidden = PARALLEL_KINDS.includes(kind) ? 'parallel' : MERIDIAN_KINDS.includes(kind) ? 'meridian' : null;
  const distractors = rng.shuffle(pool.filter((k) => k !== kind && k !== forbidden)).slice(0, 3);
  const options = rng.shuffle([kind, ...distractors]);
  const { axis, value } = lineFor(kind, rng);
  const overlay: Overlay = { kind: 'highlight-line', axis, value };
  const explainParams = kind === 'parallel' || kind === 'meridian' ? { value: { coord: { lat: value, lon: value }, axis } } : undefined;
  return base(difficulty, {
    prompt: { key: 'q.nameLine.prompt' },
    input: { kind: 'choice', options: options.map((k): Text => ({ key: `q.opt.${k}` })) },
    answer: { kind: 'choice', index: options.indexOf(kind) },
    explanation: { key: `q.nameLine.explain.${kind}`, params: explainParams },
    scene: {
      views: ['globe', 'flat'], point: null,
      rotate: axis === 'lon' ? [-(value === 180 ? 180 : value), -15] : [-20, -Math.max(-60, Math.min(60, value))],
      layers: { specialLines: false, tropics: false, places: false, graticuleStep: 10 },
      overlays: [overlay],
    },
    solution: [],
  });
}

function hemisphereQuestion(rng: Rng, difficulty: Difficulty): Question {
  const regions = ['N', 'S', 'E', 'W'] as const;
  const region = rng.pick(regions);
  const options = rng.shuffle(regions);
  const rotate: Record<typeof region, [number, number]> = { N: [-20, -40], S: [-20, 40], E: [-90, -10], W: [90, -10] };
  return base(difficulty, {
    prompt: { key: 'q.nameLine.promptHemi' },
    input: { kind: 'choice', options: options.map((r): Text => ({ key: `hemi.${r}` })) },
    answer: { kind: 'choice', index: options.indexOf(region) },
    explanation: { key: `q.nameLine.explainHemi.${region}` },
    scene: { views: ['globe', 'flat'], point: null, rotate: rotate[region], layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-region', region }] },
    solution: [],
  });
}

function pointQuestion(rng: Rng, difficulty: Difficulty): Question {
  const p: LatLon = { lat: rng.int(5, 75) * (rng.next() < 0.5 ? 1 : -1), lon: rng.int(5, 175) * (rng.next() < 0.5 ? 1 : -1) };
  const pair = `${hemisphereLat(p.lat)}${hemisphereLon(p.lon)}`;
  const options = rng.shuffle(['NE', 'NW', 'SE', 'SW']);
  return base(difficulty, {
    prompt: { key: 'q.nameLine.promptPoint' },
    input: { kind: 'choice', options: options.map((c): Text => ({ key: `q.opt.pair.${c}` })) },
    answer: { kind: 'choice', index: options.indexOf(pair) },
    explanation: { key: 'q.nameLine.explainPoint', params: { coords: { coord: p }, nsHemi: { text: { key: `hemi.${hemisphereLat(p.lat)}` } }, ewHemi: { text: { key: `hemi.${hemisphereLon(p.lon)}` } } } },
    scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p, tone: 'a', label: 'A' }] },
    solution: [],
  });
}

export const nameLine: QuestionModule = {
  type: 'name-line',
  topics: [1],
  generate(rng, difficulty) {
    const variant = difficulty === 'easy' ? rng.pick(['line', 'hemisphere'] as const) : rng.pick(['line', 'hemisphere', 'point'] as const);
    return variant === 'line' ? lineQuestion(rng, difficulty) : variant === 'hemisphere' ? hemisphereQuestion(rng, difficulty) : pointQuestion(rng, difficulty);
  },
  check: checkChoice,
  describeAnswer: choiceText,
};
```

`src/quiz/generators/further.ts`:
```ts
import { extremeIndex, spansAntimeridian } from '../../geo/compare';
import type { LatLon, Precision } from '../../geo/types';
import type { Text } from '../../i18n/text';
import type { Overlay } from '../../map/types';
import { checkChoice, choiceText } from '../check';
import { LABELS, TONES, gridInt, signed, withMinutes } from '../values';
import type { Question, QuestionModule, Rng, Difficulty, TopicId } from '../types';

type Dir = 'N' | 'S' | 'E' | 'W';
const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

function values(rng: Rng, difficulty: Difficulty, axis: 'lat' | 'lon', n: number, dir: Dir, minutes: boolean): number[] | null {
  const max = axis === 'lat' ? 80 : 170;
  const trapSign = axis === 'lat' ? -1 : -1; // S or W: "bigger number" goes the "wrong" way
  const out: number[] = [];
  if (minutes) {
    const deg = rng.int(1, max - 1) * signed(rng);
    const mins = rng.shuffle([0, 10, 15, 20, 30, 40, 45, 50]).slice(0, n);
    return mins.map((m) => withMinutes(deg, m));
  }
  const sameSign = difficulty === 'easy' || (difficulty === 'hard' && rng.next() < 0.5);
  const sign = difficulty === 'hard' && rng.next() < 0.7 ? trapSign : signed(rng);
  const minGap = difficulty === 'easy' ? 10 : 3;
  for (let tries = 0; out.length < n && tries < 200; tries++) {
    const v = difficulty === 'easy' ? gridInt(rng, 10, max, 10) * sign : (sameSign ? sign : signed(rng)) * rng.int(1, max);
    if (out.every((o) => Math.abs(o - v) >= minGap)) out.push(v);
  }
  void dir;
  return out.length === n ? out : null;
}

function ruleFor(vals: number[], axis: 'lat' | 'lon'): Text {
  const signs = new Set(vals.map(Math.sign));
  if (signs.size > 1 || signs.has(0)) return { key: `q.rule.mixed.${axis}` };
  const positive = vals[0]! > 0;
  const letter = axis === 'lat' ? (positive ? 'N' : 'S') : positive ? 'E' : 'W';
  return { key: `q.rule.bigger.${letter}` };
}

export const further: QuestionModule = {
  type: 'further',
  topics: [2, 5],
  generate(rng, difficulty, topic: TopicId): Question {
    const minutes = topic === 5;
    const precision: Precision = minutes ? 'minute' : 'degree';
    const n = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
    for (;;) {
      const dir = rng.pick(['N', 'S', 'E', 'W'] as const);
      const axis = dir === 'N' || dir === 'S' ? 'lat' : 'lon';
      const vals = values(rng, difficulty, axis, n, dir, minutes);
      if (!vals) continue;
      if (axis === 'lon' && spansAntimeridian(vals)) continue;
      const otherBase = minutes ? (axis === 'lat' ? rng.int(-170, 170) : rng.int(-60, 60)) : 0;
      const points: LatLon[] = vals.map((v, i) => {
        const other = minutes ? otherBase + i * 0.6 : axis === 'lat' ? rng.int(-160, 160) : rng.int(-60, 60);
        return axis === 'lat' ? { lat: v, lon: other } : { lat: other, lon: v };
      });
      const answer = extremeIndex(points, dir);
      const opposite = extremeIndex(points, OPPOSITE[dir]);
      const overlays: Overlay[] = points.map((p, i) => ({ kind: 'marker', p, tone: TONES[i]!, label: LABELS[i] }));
      const centre = points.reduce((acc, p) => ({ lat: acc.lat + p.lat / n, lon: acc.lon + p.lon / n }), { lat: 0, lon: 0 });
      const winner = points[answer]!;
      return {
        id: '', type: 'further', topic, difficulty,
        prompt: { key: `q.further.prompt.${dir}` },
        input: { kind: 'choice', options: points.map((p, i): Text => ({ key: 'q.further.option', params: { label: LABELS[i]!, coord: { coord: p, axis, precision } } })) },
        answer: { kind: 'choice', index: answer },
        explanation: { key: 'q.further.explain', params: { label: LABELS[answer]!, coord: { coord: winner, axis, precision }, dir: { text: { key: `q.dirWord.${dir}` } }, rule: { text: ruleFor(vals, axis) } } },
        scene: {
          views: ['flat'], point: null,
          layers: { specialLines: true, places: false, graticuleStep: minutes ? 1 : 10 },
          flatView: minutes ? { center: centre, zoom: 12 } : undefined,
          overlays,
        },
        solution: [{ kind: 'marker', p: winner, tone: 'answer' }],
        meta: { opposite, dir },
      };
    }
  },
  check(q, r) {
    const res = checkChoice(q, r);
    if (!res.correct && r.kind === 'choice' && r.index === q.meta?.opposite) {
      const dir = q.meta?.dir as Dir;
      res.mistake = { key: 'q.further.mistake.opposite', params: { dir: { text: { key: `q.dirWord.${OPPOSITE[dir]}` } } } };
    }
    return res;
  },
  describeAnswer: choiceText,
};
```
Note: for minute questions, markers share one degree and differ by minutes (e.g. 52°10′N vs 52°45′N); the other coordinate is spread by 0.6° steps so markers do not overlap at zoom 12. `n` never exceeds 4 and 8 minute values are available.

`src/quiz/generators/relativeLine.ts`:
```ts
import { relativeToMeridian, relativeToParallel } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { checkChoice, choiceText } from '../check';
import { gridInt, signed } from '../values';
import type { Question, QuestionModule } from '../types';

export const relativeLine: QuestionModule = {
  type: 'relative-line',
  topics: [2],
  generate(rng, difficulty): Question {
    for (;;) {
      const axis = rng.pick(['lat', 'lon'] as const);
      const max = axis === 'lat' ? 70 : 150;
      let line: number, v: number;
      if (difficulty === 'easy') {
        const s = signed(rng);
        line = gridInt(rng, 10, max, 10) * s;
        v = line + gridInt(rng, 10, 30, 10) * rng.pick([1, -1]);
      } else if (difficulty === 'medium') {
        line = rng.int(-max, max);
        v = line + rng.int(3, 40) * rng.pick([1, -1]);
      } else {
        line = -rng.int(5, max);                        // S or W reference line: the trap
        v = line + rng.int(2, 25) * rng.pick([1, -1]);
      }
      const limit = axis === 'lat' ? 85 : 179;
      if (Math.abs(v) > limit || v === line) continue;
      if (axis === 'lon' && Math.abs(v - line) > 150) continue; // never across 180°
      const p: LatLon = axis === 'lat' ? { lat: v, lon: rng.int(-160, 160) } : { lat: rng.int(-60, 60), lon: v };
      const rel = axis === 'lat' ? relativeToParallel(p.lat, line) : relativeToMeridian(p.lon, line);
      const options = axis === 'lat' ? (['north', 'south'] as const) : (['east', 'west'] as const);
      const index = (options as readonly string[]).indexOf(rel);
      if (index < 0) continue;
      const letter = { north: 'N', south: 'S', east: 'E', west: 'W' }[rel as 'north'];
      const mixed = Math.sign(v) !== Math.sign(line) || v === 0 || line === 0;
      const rule: Text = mixed ? { key: `q.rule.mixed.${axis}` } : { key: `q.rule.bigger.${axis === 'lat' ? (line > 0 ? 'N' : 'S') : line > 0 ? 'E' : 'W'}` };
      const lineCoord = { coord: { lat: line, lon: line }, axis };
      return {
        id: '', type: 'relative-line', topic: 2, difficulty,
        prompt: { key: `q.relative.prompt.${axis}`, params: { point: { coord: p }, line: lineCoord } },
        input: { kind: 'choice', options: options.map((o): Text => ({ key: `q.opt.${o}` })) },
        answer: { kind: 'choice', index },
        explanation: { key: `q.relative.explain.${axis}`, params: { value: { coord: p, axis }, line: lineCoord, dir: { text: { key: `q.dirWord.${letter}` } }, rule: { text: rule } } },
        scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis, value: line }, { kind: 'marker', p, tone: 'a', label: 'A' }] },
        solution: [],
      };
    }
  },
  check: checkChoice,
  describeAnswer: choiceText,
};
```

`src/quiz/generators/coordValues.ts` — shared by reading and placing:
```ts
import type { LatLon, Precision } from '../../geo/types';
import type { Difficulty, Rng } from '../types';
import { gridInt, signed, withMinutes } from '../values';

export interface CoordTask { p: LatLon; precision: Precision; graticuleStep: 1 | 5 | 10; flatView?: { center: LatLon; zoom: number } }

export function coordTask(rng: Rng, difficulty: Difficulty, minutes: boolean): CoordTask {
  if (minutes) {
    const latDeg = rng.int(1, 70) * signed(rng);
    const lonDeg = rng.int(1, 170) * signed(rng);
    let latMin: number, lonMin: number;
    if (difficulty === 'easy') { latMin = 30; lonMin = 0; }
    else if (difficulty === 'medium') { [latMin, lonMin] = rng.pick([[30, 0], [0, 30], [30, 30]] as const); }
    else { latMin = rng.pick([15, 30, 45]); lonMin = rng.pick([15, 30, 45]); }
    const p = { lat: withMinutes(latDeg, latMin), lon: withMinutes(lonDeg, lonMin) };
    return { p, precision: 'minute', graticuleStep: 1, flatView: { center: { lat: p.lat + (rng.next() - 0.5) * 3, lon: p.lon + (rng.next() - 0.5) * 6 }, zoom: 12 } };
  }
  if (difficulty === 'easy') {
    return { p: { lat: gridInt(rng, 10, 70, 10) * signed(rng), lon: gridInt(rng, 10, 170, 10) * signed(rng) }, precision: 'degree', graticuleStep: 10 };
  }
  if (difficulty === 'medium') {
    const p = { lat: gridInt(rng, 5, 75, 5) * signed(rng), lon: gridInt(rng, 5, 175, 5) * signed(rng) };
    return { p, precision: 'degree', graticuleStep: 5, flatView: { center: { lat: p.lat + rng.int(-8, 8), lon: p.lon + rng.int(-15, 15) }, zoom: 3 } };
  }
  let lat: number, lon: number;
  do { lat = rng.int(1, 80) * signed(rng); lon = rng.int(1, 179) * signed(rng); } while (lat % 5 === 0 || lon % 5 === 0);
  const p = { lat, lon };
  return { p, precision: 'degree', graticuleStep: 1, flatView: { center: { lat: lat + rng.int(-3, 3), lon: lon + rng.int(-6, 6) }, zoom: 8 } };
}
```

`src/quiz/generators/readCoords.ts`:
```ts
import { checkCoords } from '../check';
import type { Question, QuestionModule } from '../types';
import { coordTask } from './coordValues';

export const readCoords: QuestionModule = {
  type: 'read-coords',
  topics: [3, 5],
  generate(rng, difficulty, topic): Question {
    const { p, precision, graticuleStep, flatView } = coordTask(rng, difficulty, topic === 5);
    return {
      id: '', type: 'read-coords', topic, difficulty,
      prompt: { key: 'q.read.prompt' },
      input: { kind: 'coords', precision, fields: 'both', mapPick: false },
      answer: { kind: 'coords', value: p },
      explanation: { key: 'q.read.explain', params: { lat: { coord: p, axis: 'lat', precision }, lon: { coord: p, axis: 'lon', precision }, coords: { coord: p, precision } } },
      scene: { views: ['flat'], point: p, pointEditable: false, showReadout: false, precision, flatView, layers: { graticuleStep, specialLines: true, places: false, pointGuides: difficulty !== 'hard' } },
      solution: [{ kind: 'highlight-line', axis: 'lat', value: p.lat }, { kind: 'highlight-line', axis: 'lon', value: p.lon }, { kind: 'marker', p, tone: 'answer' }],
    };
  },
  check: checkCoords,
  describeAnswer: (q) => ({ key: 'q.answer.coords', params: { coords: { coord: (q.answer as { value: { lat: number; lon: number } }).value, precision: q.input.kind === 'coords' ? q.input.precision : 'degree' } } }),
};
```

`src/quiz/generators/placePoint.ts`:
```ts
import { checkCoords } from '../check';
import type { Question, QuestionModule } from '../types';
import { coordTask } from './coordValues';

export const placePoint: QuestionModule = {
  type: 'place-point',
  topics: [4, 5],
  generate(rng, difficulty, topic): Question {
    const minutes = topic === 5;
    const { p, precision, graticuleStep, flatView } = coordTask(rng, difficulty, minutes);
    const start = minutes ? { lat: Math.round(p.lat) + 1, lon: Math.round(p.lon) - 1 } : { lat: 0, lon: 0 };
    return {
      id: '', type: 'place-point', topic, difficulty,
      prompt: { key: 'q.place.prompt', params: { coords: { coord: p, precision } } },
      input: { kind: 'coords', precision, fields: 'both', mapPick: true },
      answer: { kind: 'coords', value: p },
      explanation: { key: 'q.place.explain', params: { lat: { coord: p, axis: 'lat', precision }, lon: { coord: p, axis: 'lon', precision } } },
      scene: {
        views: minutes ? ['flat'] : ['globe', 'flat'], point: start, pointEditable: true, showReadout: true, precision,
        flatView: minutes ? flatView : undefined,
        layers: { graticuleStep: minutes ? 1 : graticuleStep === 1 ? 5 : graticuleStep, specialLines: true, places: false },
      },
      solution: [{ kind: 'marker', p, tone: 'answer' }],
    };
  },
  check: checkCoords,
  describeAnswer: (q) => ({ key: 'q.answer.coords', params: { coords: { coord: (q.answer as { value: { lat: number; lon: number } }).value, precision: q.input.kind === 'coords' ? q.input.precision : 'degree' } } }),
};
```
(If `start` happens to equal `p` — impossible for minutes since `p` has non-zero minutes in one axis, and for degrees `p` never has both coordinates zero.)

`src/quiz/generators/whichPlace.ts`:
```ts
import { lonDifference } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { PLACES } from '../../map/places';
import { checkChoice, choiceText } from '../check';
import { LABELS, TONES, signed } from '../values';
import type { Question, QuestionModule, Rng, Difficulty } from '../types';

type Kind = 'answer' | 'ns' | 'ew' | 'both' | 'swap' | 'random';
const far = (a: LatLon, b: LatLon, d: number) => Math.abs(a.lat - b.lat) >= d || lonDifference(a.lon, b.lon) >= d;

function distractors(rng: Rng, difficulty: Difficulty, p: LatLon): { p: LatLon; kind: Kind }[] | null {
  const out: { p: LatLon; kind: Kind }[] = [];
  if (difficulty === 'hard') {
    const cands: { p: LatLon; kind: Kind }[] = [
      { p: { lat: -p.lat, lon: p.lon }, kind: 'ns' },
      { p: { lat: p.lat, lon: -p.lon }, kind: 'ew' },
      { p: { lat: -p.lat, lon: -p.lon }, kind: 'both' },
    ];
    if (Math.abs(p.lon) <= 85 && p.lat !== p.lon) cands.push({ p: { lat: p.lon, lon: p.lat }, kind: 'swap' });
    return rng.shuffle(cands).slice(0, 3);
  }
  const minDist = difficulty === 'easy' ? 25 : 8;
  for (let tries = 0; out.length < 3 && tries < 300; tries++) {
    const q: LatLon = difficulty === 'easy'
      ? { lat: rng.int(5, 70) * signed(rng), lon: rng.int(5, 175) * signed(rng) }
      : { lat: Math.max(-80, Math.min(80, p.lat + rng.int(-30, 30))), lon: Math.max(-179, Math.min(179, p.lon + rng.int(-40, 40))) };
    if ([p, ...out.map((o) => o.p)].every((x) => far(x, q, minDist))) out.push({ p: q, kind: 'random' });
  }
  return out.length === 3 ? out : null;
}

export const whichPlace: QuestionModule = {
  type: 'which-place',
  topics: [4],
  generate(rng, difficulty): Question {
    for (;;) {
      const place = rng.pick(PLACES.filter((x) => x.kind === 'city'));
      const p: LatLon = { lat: Math.round(place.lat), lon: Math.round(place.lon) };
      if (Math.abs(p.lat) < 5 || Math.abs(p.lon) < 5 || Math.abs(p.lon) > 175) continue; // mirrors would be ambiguous
      const others = distractors(rng, difficulty, p);
      if (!others) continue;
      const all = rng.shuffle([{ p, kind: 'answer' as Kind }, ...others]);
      const index = all.findIndex((x) => x.kind === 'answer');
      const meta: Record<string, string | number> = { placeId: place.id };
      all.forEach((x, i) => { meta[`kind${i}`] = x.kind; });
      return {
        id: '', type: 'which-place', topic: 4, difficulty,
        prompt: { key: 'q.which.prompt', params: { coords: { coord: p } } },
        input: { kind: 'choice', options: all.map((_, i): Text => ({ key: 'q.which.option', params: { label: LABELS[i]! } })) },
        answer: { kind: 'choice', index },
        explanation: { key: 'q.which.explain', params: { label: LABELS[index]!, coords: { coord: p }, place: { place: place.id } } },
        scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: all.map((x, i) => ({ kind: 'marker' as const, p: x.p, tone: TONES[i]!, label: LABELS[i] })) },
        solution: [{ kind: 'marker', p, tone: 'answer' }],
        meta,
      };
    }
  },
  check(q, r) {
    const res = checkChoice(q, r);
    if (!res.correct && r.kind === 'choice') {
      const kind = q.meta?.[`kind${r.index}`];
      const key = { ns: 'q.mistake.nsLetter', ew: 'q.mistake.ewLetter', both: 'q.mistake.bothLetters', swap: 'q.mistake.swapped' }[kind as 'ns'];
      if (key) res.mistake = { key };
    }
    return res;
  },
  describeAnswer: choiceText,
};
```

- [ ] **Step 5: Registry** `src/quiz/registry.ts`:

```ts
import type { TopicId } from '../app/ids';
import type { Text } from '../i18n/text';
import { further } from './generators/further';
import { nameLine } from './generators/nameLine';
import { placePoint } from './generators/placePoint';
import { readCoords } from './generators/readCoords';
import { relativeLine } from './generators/relativeLine';
import { whichPlace } from './generators/whichPlace';
import { createRng } from './rng';
import type { Answer, CheckResult, Difficulty, Question, QuestionModule, QuestionTypeId } from './types';

export const MODULES: QuestionModule[] = [nameLine, further, relativeLine, readCoords, placePoint, whichPlace];

export function getModule(type: QuestionTypeId): QuestionModule {
  const m = MODULES.find((x) => x.type === type);
  if (!m) throw new Error(`No question module for ${type}`);
  return m;
}

export function modulesForTopic(topic: TopicId): QuestionModule[] {
  return MODULES.filter((m) => m.topics.includes(topic));
}

export function checkAnswer(q: Question, r: Answer): CheckResult {
  return getModule(q.type).check(q, r);
}

export function describeAnswer(q: Question): Text {
  return getModule(q.type).describeAnswer(q);
}

export function generateSet(seed: string, topics: readonly TopicId[], difficulty: Difficulty, count: number): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length]!;
    const mods = modulesForTopic(topic);
    if (mods.length === 0) throw new Error(`Topic ${topic} has no question modules`);
    for (let attempt = 0; attempt < 10; attempt++) {
      const mod = mods[(i + attempt) % mods.length]!;
      const q = mod.generate(createRng(`${seed}:${i}:${attempt}`), difficulty, topic);
      const signature = JSON.stringify([q.type, q.prompt, q.answer, q.scene.overlays]);
      if (seen.has(signature) && attempt < 9) continue;
      seen.add(signature);
      out.push({ ...q, id: `${q.type}-${i}` });
      break;
    }
  }
  return out;
}
```
Later tasks register new question types by adding their module to the `MODULES` array.

- [ ] **Step 6: i18n keys** (EN source; PL/UK by implementer with §6.2 terms; keep `{params}` identical):

```
q.nameLine.prompt            What is the highlighted line?
q.nameLine.promptHemi        Which hemisphere is highlighted?
q.nameLine.promptPoint       In which two hemispheres is point A?
q.opt.equator                The equator
q.opt.prime                  The prime meridian (Greenwich)
q.opt.antimeridian           The 180° meridian
q.opt.parallel               A parallel
q.opt.meridian               A meridian
q.opt.tropicCancer           The Tropic of Cancer
q.opt.tropicCapricorn        The Tropic of Capricorn
q.opt.arcticCircle           The Arctic Circle
q.opt.antarcticCircle        The Antarctic Circle
q.opt.pair.NE                Northern and Eastern
q.opt.pair.NW                Northern and Western
q.opt.pair.SE                Southern and Eastern
q.opt.pair.SW                Southern and Western
q.nameLine.explain.equator   The equator is the parallel 0°. It runs around the middle of the Earth.
q.nameLine.explain.prime     The prime meridian is 0°. It goes through Greenwich in London.
q.nameLine.explain.antimeridian  The 180° meridian is on the opposite side of the Earth from Greenwich.
q.nameLine.explain.parallel  This is the parallel {value}. Parallels are circles parallel to the equator.
q.nameLine.explain.meridian  This is the meridian {value}. Meridians join the North Pole and the South Pole.
q.nameLine.explain.tropicCancer     The Tropic of Cancer is the parallel at about 23°N.
q.nameLine.explain.tropicCapricorn  The Tropic of Capricorn is the parallel at about 23°S.
q.nameLine.explain.arcticCircle     The Arctic Circle is the parallel at about 66°N.
q.nameLine.explain.antarcticCircle  The Antarctic Circle is the parallel at about 66°S.
q.nameLine.explainHemi.N     The Northern Hemisphere is everything north of the equator.
q.nameLine.explainHemi.S     The Southern Hemisphere is everything south of the equator.
q.nameLine.explainHemi.E     The Eastern Hemisphere is everything east of the prime meridian, up to 180°.
q.nameLine.explainHemi.W     The Western Hemisphere is everything west of the prime meridian, up to 180°.
q.nameLine.explainPoint      Point A is at {coords}: {nsHemi} and {ewHemi}.
q.dirWord.N                  north
q.dirWord.S                  south
q.dirWord.E                  east
q.dirWord.W                  west
q.further.prompt.N           Which point lies furthest north?
q.further.prompt.S           Which point lies furthest south?
q.further.prompt.E           Which point lies furthest east?
q.further.prompt.W           Which point lies furthest west?
q.further.option             Point {label}: {coord}
q.further.explain            Point {label} ({coord}) lies furthest {dir}. {rule}
q.further.mistake.opposite   That point lies furthest {dir} — the opposite direction!
q.rule.mixed.lat             Any place with N latitude is north of any place with S latitude.
q.rule.mixed.lon             Any place with E longitude is east of any place with W longitude (as long as we do not cross the 180° meridian).
q.rule.bigger.N              In the Northern Hemisphere, a bigger number means further north.
q.rule.bigger.S              In the Southern Hemisphere, a bigger number means further south.
q.rule.bigger.E              In the Eastern Hemisphere, a bigger number means further east.
q.rule.bigger.W              In the Western Hemisphere, a bigger number means further west.
q.relative.prompt.lat        Is point A ({point}) north or south of the parallel {line}?
q.relative.prompt.lon        Is point A ({point}) east or west of the meridian {line}?
q.opt.north                  North of it
q.opt.south                  South of it
q.opt.east                   East of it
q.opt.west                   West of it
q.relative.explain.lat       Point A has latitude {value} and the parallel is {line}, so the point lies {dir} of the parallel. {rule}
q.relative.explain.lon       Point A has longitude {value} and the meridian is {line}, so the point lies {dir} of the meridian. {rule}
q.read.prompt                What are the coordinates of the point?
q.read.explain               The point lies on the parallel {lat} and on the meridian {lon}, so its coordinates are {coords}.
q.place.prompt               Move the point to {coords}.
q.place.explain              First find the parallel {lat}, then the meridian {lon}. The point goes where they cross.
q.which.prompt               Which marker is at {coords}?
q.which.option               Marker {label}
q.which.explain              Marker {label} is at {coords}. That is {place}!
q.answer.coords              {coords}
q.mistake.nsLetter           Check the letter: N means north of the equator, S means south of it.
q.mistake.ewLetter           Check the letter: E means east of Greenwich, W means west of it.
q.mistake.bothLetters        Both letters are the wrong way round. N or S says up or down, E or W says right or left.
q.mistake.swapped            Latitude and longitude are swapped. Latitude (N or S) always comes first.
q.mistake.minutes            Close! Check the minutes: 30′ is half a degree and 15′ is a quarter of a degree.
```
PL/UK notes: `q.dirWord.*` is used after "najdalej"/"найдалі" and before "od"/"від" — PL: "na północ", "na południe", "na wschód", "na zachód"; UK: "на північ", "на південь", "на схід", "на захід". Then e.g. PL `q.relative.explain.lat`: "Punkt A ma szerokość {value}, a równoleżnik to {line}, więc punkt leży {dir} od równoleżnika. {rule}".

- [ ] **Step 7: Generator property tests**

`tests/unit/textKeys.ts`:
```ts
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import type { Text } from '../../src/i18n/text';

const FILES = { en, pl, uk } as Record<string, Record<string, string>>;

export function collectKeys(text: Text, out: string[] = []): string[] {
  out.push(text.key);
  for (const p of Object.values(text.params ?? {})) {
    if (typeof p === 'object' && p !== null) {
      if ('text' in p) collectKeys(p.text, out);
      if ('place' in p) out.push(`place.${p.place}`);
    }
  }
  return out;
}

export function missingKeys(texts: Text[]): string[] {
  const missing: string[] = [];
  for (const t of texts) for (const key of collectKeys(t)) for (const [lang, f] of Object.entries(FILES)) {
    if (!(key in f) && !(`${key}#other` in f)) missing.push(`${lang}:${key}`);
  }
  return missing;
}
```

`tests/unit/generators.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { spansAntimeridian } from '../../src/geo/compare';
import { MODULES, generateSet } from '../../src/quiz/registry';
import { createRng } from '../../src/quiz/rng';
import type { Difficulty, Question } from '../../src/quiz/types';
import { missingKeys } from './textKeys';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = 1000;

function texts(q: Question, mod = MODULES.find((m) => m.type === q.type)!) {
  const list = [q.prompt, q.explanation, mod.describeAnswer(q)];
  if (q.input.kind === 'choice') list.push(...q.input.options);
  return list;
}

for (const mod of MODULES) {
  for (const topic of mod.topics) {
    describe(`${mod.type} (topic ${topic})`, () => {
      for (const d of DIFFS) {
        test(`${d}: ${SEEDS} seeds produce valid, answerable questions`, () => {
          const missing = new Set<string>();
          for (let s = 0; s < SEEDS; s++) {
            const q = mod.generate(createRng(`${mod.type}:${topic}:${d}:${s}`), d, topic);
            expect(q.type).toBe(mod.type);
            expect(mod.check(q, q.answer).correct, `seed ${s}`).toBe(true);
            missingKeys(texts(q, mod)).forEach((k) => missing.add(k));
            if (q.input.kind === 'choice' && q.answer.kind === 'choice') {
              expect(q.answer.index).toBeGreaterThanOrEqual(0);
              expect(q.answer.index).toBeLessThan(q.input.options.length);
              expect(new Set(q.input.options.map((o) => JSON.stringify(o))).size).toBe(q.input.options.length);
              q.input.options.forEach((_, j) => { if (j !== (q.answer as { index: number }).index) expect(mod.check(q, { kind: 'choice', index: j }).correct).toBe(false); });
            }
            if (q.answer.kind === 'coords') {
              const v = q.answer.value;
              expect(Math.abs(v.lat)).toBeLessThanOrEqual(90);
              expect(Math.abs(v.lon)).toBeLessThanOrEqual(180);
              const precision = q.input.kind === 'coords' ? q.input.precision : 'degree';
              const off = precision === 'minute' ? 2 / 60 : 1;
              expect(mod.check(q, { kind: 'coords', value: { lat: v.lat + (v.lat > 80 ? -off : off), lon: v.lon } }).correct).toBe(false);
              if (precision === 'minute') expect(mod.check(q, { kind: 'coords', value: { lat: v.lat + 1 / 60, lon: v.lon } }).correct).toBe(true);
            }
            for (const o of q.scene.overlays ?? []) if (o.kind === 'marker') { expect(Math.abs(o.p.lat)).toBeLessThanOrEqual(90); expect(Math.abs(o.p.lon)).toBeLessThanOrEqual(180); }
            if (q.type === 'further') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              const dir = q.meta?.dir;
              const vals = markers.map((m) => (dir === 'N' || dir === 'S' ? m.p.lat : m.p.lon));
              expect(new Set(vals).size).toBe(vals.length);
              if (dir === 'E' || dir === 'W') expect(spansAntimeridian(vals)).toBe(false);
            }
            if (q.type === 'which-place') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              expect(new Set(markers.map((m) => `${m.p.lat},${m.p.lon}`)).size).toBe(4);
            }
          }
          expect([...missing]).toEqual([]);
        });
      }
    });
  }
}

describe('generateSet', () => {
  test('deterministic, right size, unique ids, alternates types', () => {
    const a = generateSet('abc', [2], 'medium', 10);
    const b = generateSet('abc', [2], 'medium', 10);
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(new Set(a.map((q) => q.id)).size).toBe(10);
    expect(new Set(a.map((q) => q.type))).toEqual(new Set(['further', 'relative-line']));
  });
  test('mixed topics cycle through the given topic list', () => {
    const set = generateSet('mix', [1, 2, 3, 4], 'easy', 8);
    expect(set.map((q) => q.topic)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });
});
```
Note: `further` is registered for topics 2 **and** 5; the topic-5 run exercises minute values. Topic 5 has no Explore content until Task 15 — that is fine for unit tests.

- [ ] **Step 8: Run** `npx vitest run tests/unit/generators.test.ts` → iterate until PASS. A failure here is a generator bug (ambiguous question, missing key, unanswerable answer); fix the generator, never loosen the test. Expected runtime: a few seconds.

- [ ] **Step 9: Commit**

```bash
npm run check && npm test
git add -A
git commit -m "feat(quiz): seeded question generators for topics 1-4 with property tests"
```

---

### Task 14: Practice UI, scores and milestone-1 build

**Files:**
- Create: `src/app/testMode.ts`, `src/quiz/scores.ts`, `src/quiz/inputs/ChoiceInput.svelte`, `src/quiz/inputs/CoordsInput.svelte`, `src/quiz/inputs/NumberInput.svelte`, `src/quiz/Feedback.svelte`, `src/quiz/QuestionCard.svelte`, `src/quiz/Practice.svelte`
- Modify: `src/main.ts` (use `testMode.ts`), `src/app/TopicPage.svelte` (practice branch), `src/i18n/{en,pl,uk}.json`, `dist/geo-coordinates.html` (build output, committed)
- Test: `tests/unit/scores.test.ts`, `tests/e2e/practice.spec.ts`

**Interfaces:**
- Consumes: `generateSet`, `checkAnswer`, `describeAnswer` (Task 13), `randomSeed` (Task 13), `renderText` (Task 5), `parseAngle`, `formatLat`, `formatLon` (Task 2), `mapState` (Task 7), `MapStage` (Tasks 9–11), `announce` (Task 6), `readString`/`writeString`/`readJSON`/`writeJSON` (Task 5).
- Produces:
  - `testMode.ts`: `TEST_MODE: boolean` (true when the URL has `?test`), `expose(name: string, value: unknown): void` (sets `window[name]` only in test mode or dev).
  - `scores.ts`: `bestScore(id: string): number | null`, `recordScore(id: string, score: number): number` (returns the new best), `scoreId(topic: TopicId | 'rehearsal', difficulty: Difficulty): string` → `"topic-3-easy"` / `"rehearsal-medium"`.
  - Input components, each with `value = $bindable<Answer | null>()`, `disabled: boolean`, `invalid: boolean`, and `describedBy?: string`:
    - `ChoiceInput` props `{ options: Text[]; big?: boolean }`
    - `CoordsInput` props `{ spec: Extract<InputSpec, { kind: 'coords' }> }` — for `mapPick` it mirrors `mapState.point` into `value`; otherwise two text fields parsed with `parseAngle`.
    - `NumberInput` props `{ unit: 'deg' | 'km' | 'h' | 'min' }` (used from Task 15).
  - `QuestionCard.svelte` props `{ question: Question; number: number; total: number; result: CheckResult | null; onsubmit: (a: Answer) => void; onnext: () => void; nextLabel: string; showFeedback?: boolean }`. It renders the prompt as `<h2 tabindex="-1">`, the matching input, a submit button, and (after answering, when `showFeedback`) `Feedback` followed by the next button. `ClockInput` is added to its input switch in Task 17.
  - `Feedback.svelte` props `{ question: Question; result: CheckResult }`.
  - `Practice.svelte` props `{ topic: TopicDef }`. Round length `ROUND = 10`. On each answer: `mapState.pointEditable = false`; `mapState.addOverlays(q.solution)` plus a `wrong` marker at the response for wrong coordinate answers. Exposes `__practice = { question, answer }` via `expose` for e2e tests.

- [ ] **Step 1: `src/app/testMode.ts`** and refactor `main.ts`

```ts
export const TEST_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

export function expose(name: string, value: unknown): void {
  if (TEST_MODE || import.meta.env.DEV) (window as unknown as Record<string, unknown>)[name] = value;
}
```
In `src/main.ts` replace the Task 11 hook with `expose('__mapState', mapState);`.

- [ ] **Step 2: Scores — test then implement**

`tests/unit/scores.test.ts`:
```ts
import { beforeEach, expect, test } from 'vitest';
import { bestScore, recordScore, scoreId } from '../../src/quiz/scores';

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

test('records the best score per id', () => {
  const id = scoreId(3, 'easy');
  expect(id).toBe('topic-3-easy');
  expect(bestScore(id)).toBeNull();
  expect(recordScore(id, 6)).toBe(6);
  expect(recordScore(id, 4)).toBe(6);
  expect(recordScore(id, 9)).toBe(9);
  expect(bestScore(id)).toBe(9);
  expect(bestScore(scoreId('rehearsal', 'hard'))).toBeNull();
});

test('works when storage throws', () => {
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  expect(recordScore('x', 5)).toBe(5);
  expect(bestScore('x')).toBeNull();
});
```

`src/quiz/scores.ts`:
```ts
import type { TopicId } from '../app/ids';
import { readJSON, writeJSON } from '../app/storage';
import type { Difficulty } from './types';

const KEY = 'geo-coords:scores';

export function scoreId(topic: TopicId | 'rehearsal', difficulty: Difficulty): string {
  return topic === 'rehearsal' ? `rehearsal-${difficulty}` : `topic-${topic}-${difficulty}`;
}

export function bestScore(id: string): number | null {
  const all = readJSON<Record<string, number>>(KEY, {});
  return typeof all[id] === 'number' ? all[id]! : null;
}

export function recordScore(id: string, score: number): number {
  const all = readJSON<Record<string, number>>(KEY, {});
  const best = Math.max(all[id] ?? 0, score);
  all[id] = best;
  writeJSON(KEY, all);
  return best;
}
```
Run `npx vitest run tests/unit/scores.test.ts` → PASS.

- [ ] **Step 3: i18n keys**

| key | en | pl | uk |
|---|---|---|---|
| practice.difficulty | Difficulty | Poziom trudności | Рівень складності |
| difficulty.easy | Easy | Łatwy | Легкий |
| difficulty.medium | Medium | Średni | Середній |
| difficulty.hard | Hard | Trudny | Складний |
| practice.progress | Question {n} of {total} | Pytanie {n} z {total} | Запитання {n} з {total} |
| practice.check | Check | Sprawdź | Перевірити |
| practice.next | Next question | Następne pytanie | Наступне запитання |
| practice.results | See results | Zobacz wynik | Переглянути результат |
| practice.correct | Correct! | Dobrze! | Правильно! |
| practice.incorrect | Not quite | Nie całkiem | Не зовсім |
| practice.correctAnswer | Correct answer: {answer} | Poprawna odpowiedź: {answer} | Правильна відповідь: {answer} |
| practice.done | Round complete | Koniec rundy | Раунд завершено |
| practice.score | You got {score} out of {total} | Masz {score} na {total} | Ти маєш {score} з {total} |
| practice.best | Your best: {best} out of {total} | Twój najlepszy wynik: {best} na {total} | Твій найкращий результат: {best} з {total} |
| practice.newRound | New round | Nowa runda | Новий раунд |
| practice.harder | Try harder questions | Spróbuj trudniejszych pytań | Спробуй складніші запитання |
| practice.review | Your answers | Twoje odpowiedzi | Твої відповіді |
| practice.backToLearn | Back to learning | Wróć do nauki | Повернутися до навчання |
| practice.needAnswer | Choose or enter an answer first. | Najpierw wybierz lub wpisz odpowiedź. | Спершу обери або введи відповідь. |
| practice.resultCorrect | correct | dobrze | правильно |
| practice.resultWrong | wrong | źle | неправильно |
| input.chooseOne | Choose one answer | Wybierz jedną odpowiedź | Обери одну відповідь |
| input.lat | Latitude | Szerokość geograficzna | Географічна широта |
| input.lon | Longitude | Długość geograficzna | Географічна довгота |
| input.example | For example: {example} | Na przykład: {example} | Наприклад: {example} |
| input.invalid | Write it like this: {example} | Wpisz tak: {example} | Запиши так: {example} |
| input.usePoint | Move the point on the map (or use the sliders), then press Check. | Przesuń punkt na mapie (albo użyj suwaków) i naciśnij Sprawdź. | Перемісти точку на карті (або скористайся повзунками) і натисни «Перевірити». |
| input.number | Your answer | Twoja odpowiedź | Твоя відповідь |
| input.numberInvalid | Enter a number, for example 25 | Wpisz liczbę, na przykład 25 | Введи число, наприклад 25 |
| unit.label.deg | ° | ° | ° |
| unit.label.km | km | km | км |
| unit.label.h | h | godz. | год |
| unit.label.min | min | min | хв |

- [ ] **Step 4: Inputs**

`src/quiz/inputs/ChoiceInput.svelte`:
```svelte
<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import { renderText, type Text } from '../../i18n/text';
  import type { Answer } from '../types';

  let { options, value = $bindable(null), disabled = false, invalid = false, describedBy, big = false }: {
    options: Text[]; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string; big?: boolean;
  } = $props();
  const name = `choice-${Math.random().toString(36).slice(2, 8)}`;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const selected = $derived(value?.kind === 'choice' ? value.index : -1);
</script>

<fieldset class="choices" class:big aria-invalid={invalid} aria-describedby={describedBy}>
  <legend class="visually-hidden">{t('input.chooseOne')}</legend>
  {#each options as option, i (i)}
    <label class="choice" class:checked={selected === i}>
      <input type="radio" {name} value={i} checked={selected === i} {disabled} onchange={() => (value = { kind: 'choice', index: i })} />
      <span class="letter" aria-hidden="true">{letters[i]}</span>
      <span class="text">{renderText(option)}</span>
    </label>
  {/each}
</fieldset>

<style>
  .choices { border: 0; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
  .choices.big { grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--space-4); }
  .choice { display: flex; align-items: center; gap: var(--space-3); min-height: var(--tap); padding: var(--space-2) var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); cursor: pointer; }
  .big .choice { font-size: clamp(1.2rem, 0.9rem + 1.4vw, 2.2rem); padding: var(--space-4); }
  .choice.checked { border-color: var(--accent); background: var(--surface-2); }
  .choice:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .choice input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .letter { flex: none; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); border: 2px solid var(--border); font-weight: 700; }
  .checked .letter { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .choice:has(input:disabled) { cursor: default; }
</style>
```

`src/quiz/inputs/CoordsInput.svelte`:
```svelte
<script lang="ts">
  import { formatLat, formatLon, parseAngle } from '../../geo/format';
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { mapState } from '../../map/mapState.svelte';
  import type { Answer, InputSpec } from '../types';

  let { spec, value = $bindable(null), disabled = false, invalid = false, describedBy }: {
    spec: Extract<InputSpec, { kind: 'coords' }>; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string;
  } = $props();

  const uid = `coords-${Math.random().toString(36).slice(2, 8)}`;
  let latText = $state('');
  let lonText = $state('');
  const exLat = $derived(formatLat(spec.precision === 'minute' ? 52.25 : 52, i18n.lang, spec.precision));
  const exLon = $derived(formatLon(spec.precision === 'minute' ? -21.5 : -21, i18n.lang, spec.precision));
  const latVal = $derived(parseAngle(latText, 'lat'));
  const lonVal = $derived(parseAngle(lonText, 'lon'));

  $effect(() => {
    if (disabled) return;
    if (spec.mapPick) {
      const p = mapState.point;
      value = p ? { kind: 'coords', value: { ...p } } : null;
      return;
    }
    const needLat = spec.fields !== 'lon', needLon = spec.fields !== 'lat';
    if ((needLat && latVal === null) || (needLon && lonVal === null)) { value = null; return; }
    value = { kind: 'coords', value: { lat: latVal ?? 0, lon: lonVal ?? 0 } };
  });
</script>

{#if spec.mapPick}
  <p class="hint" id="{uid}-hint">{t('input.usePoint')}</p>
{:else}
  <div class="fields">
    {#if spec.fields !== 'lon'}
      <div class="field">
        <label for="{uid}-lat">{t('input.lat')}</label>
        <input id="{uid}-lat" type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={latText} {disabled}
          aria-invalid={invalid && latVal === null} aria-describedby="{uid}-lat-ex {describedBy ?? ''}" />
        <span id="{uid}-lat-ex" class="ex">{invalid && latVal === null ? t('input.invalid', { example: exLat }) : t('input.example', { example: exLat })}</span>
      </div>
    {/if}
    {#if spec.fields !== 'lat'}
      <div class="field">
        <label for="{uid}-lon">{t('input.lon')}</label>
        <input id="{uid}-lon" type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={lonText} {disabled}
          aria-invalid={invalid && lonVal === null} aria-describedby="{uid}-lon-ex {describedBy ?? ''}" />
        <span id="{uid}-lon-ex" class="ex">{invalid && lonVal === null ? t('input.invalid', { example: exLon }) : t('input.example', { example: exLon })}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .fields { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  label { font-weight: 600; }
  input { min-height: var(--tap); font-size: 1.25rem; padding: 0 var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  input[aria-invalid='true'] { border-color: var(--bad); }
  .ex { color: var(--text-muted); font-size: 0.95rem; }
  input[aria-invalid='true'] + .ex { color: var(--bad); font-weight: 600; }
  .hint { margin: 0; font-weight: 600; }
</style>
```

`src/quiz/inputs/NumberInput.svelte`:
```svelte
<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import type { Answer } from '../types';

  let { unit, value = $bindable(null), disabled = false, invalid = false, describedBy }: {
    unit: 'deg' | 'km' | 'h' | 'min'; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string;
  } = $props();
  const uid = `num-${Math.random().toString(36).slice(2, 8)}`;
  let text = $state('');

  $effect(() => {
    if (disabled) return;
    const cleaned = text.trim().replace(/\s+/g, '').replace(',', '.').replace(/°$/, '');
    const n = cleaned === '' ? NaN : Number(cleaned);
    value = Number.isFinite(n) ? { kind: 'number', value: n } : null;
  });
</script>

<div class="field">
  <label for={uid}>{t('input.number')}</label>
  <div class="row">
    <input id={uid} type="text" inputmode="decimal" autocomplete="off" bind:value={text} {disabled}
      aria-invalid={invalid} aria-describedby="{uid}-err {describedBy ?? ''}" />
    <span class="unit">{t(`unit.label.${unit}`)}</span>
  </div>
  {#if invalid}<span id="{uid}-err" class="err">{t('input.numberInvalid')}</span>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  label { font-weight: 600; }
  .row { display: flex; gap: var(--space-2); align-items: center; }
  input { min-height: var(--tap); width: 10rem; font-size: 1.35rem; padding: 0 var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  input[aria-invalid='true'] { border-color: var(--bad); }
  .unit { font-size: 1.25rem; font-weight: 700; }
  .err { color: var(--bad); font-weight: 600; }
</style>
```

- [ ] **Step 5: `src/quiz/Feedback.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import { describeAnswer } from './registry';
  import type { CheckResult, Question } from './types';

  let { question, result }: { question: Question; result: CheckResult } = $props();
</script>

<div class="feedback" class:ok={result.correct} class:bad={!result.correct}>
  <p class="verdict">
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      {#if result.correct}<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      {:else}<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />{/if}
    </svg>
    {result.correct ? t('practice.correct') : t('practice.incorrect')}
  </p>
  {#if result.mistake}<p class="mistake">{renderText(result.mistake)}</p>{/if}
  {#if !result.correct}<p class="answer">{t('practice.correctAnswer', { answer: renderText(describeAnswer(question)) })}</p>{/if}
  {#if result.note}<p>{renderText(result.note)}</p>{/if}
  <p class="why">{renderText(question.explanation)}</p>
</div>

<style>
  .feedback { border-radius: var(--radius); padding: var(--space-3) var(--space-4); border: 2px solid; margin-top: var(--space-4); }
  .ok { border-color: var(--ok); } .bad { border-color: var(--bad); }
  .verdict { display: flex; gap: var(--space-2); align-items: center; font-size: 1.4rem; font-weight: 800; margin: 0 0 var(--space-2); }
  .ok .verdict { color: var(--ok); } .bad .verdict { color: var(--bad); }
  .mistake { font-weight: 600; }
  .answer { font-weight: 700; }
  p { margin: var(--space-1) 0; }
</style>
```

- [ ] **Step 6: `src/quiz/QuestionCard.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import Feedback from './Feedback.svelte';
  import ChoiceInput from './inputs/ChoiceInput.svelte';
  import CoordsInput from './inputs/CoordsInput.svelte';
  import NumberInput from './inputs/NumberInput.svelte';
  import type { Answer, CheckResult, Question } from './types';

  let { question, number, total, result, onsubmit, onnext, nextLabel, showFeedback = true, big = false }: {
    question: Question; number: number; total: number; result: CheckResult | null;
    onsubmit: (a: Answer) => void; onnext: () => void; nextLabel: string; showFeedback?: boolean; big?: boolean;
  } = $props();

  let value = $state<Answer | null>(null);
  let invalid = $state(false);
  let heading: HTMLHeadingElement;
  let feedbackBox = $state<HTMLDivElement>();
  let nextButton = $state<HTMLButtonElement>();
  const uid = `q-${Math.random().toString(36).slice(2, 8)}`;
  const answered = $derived(result !== null);

  let lastId = '';
  $effect(() => {
    if (question.id === lastId) return;
    const first = lastId === '';
    lastId = question.id;
    value = null;
    invalid = false;
    if (!first) queueMicrotask(() => heading?.focus());
  });

  $effect(() => {
    if (!answered) return;
    queueMicrotask(() => (showFeedback ? feedbackBox : nextButton)?.focus());
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (answered) return onnext();
    if (!value) { invalid = true; return; }
    invalid = false;
    onsubmit(value);
  }
</script>

<form class="card" class:big onsubmit={submit} novalidate>
  <p class="progress">{t('practice.progress', { n: number, total })}</p>
  <h2 tabindex="-1" bind:this={heading} id="{uid}-prompt">{renderText(question.prompt)}</h2>

  {#key question.id}
    {#if question.input.kind === 'choice'}
      <ChoiceInput options={question.input.options} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" {big} />
    {:else if question.input.kind === 'coords'}
      <CoordsInput spec={question.input} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {:else if question.input.kind === 'number'}
      <NumberInput unit={question.input.unit} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {/if}
  {/key}

  {#if invalid}<p class="need" role="alert">{t('practice.needAnswer')}</p>{/if}

  {#if !answered}
    <button type="submit" class="primary">{t('practice.check')}</button>
  {:else}
    {#if showFeedback && result}
      <div tabindex="-1" bind:this={feedbackBox} class="fb"><Feedback {question} {result} /></div>
    {/if}
    <button type="submit" class="primary" bind:this={nextButton}>{nextLabel}</button>
  {/if}
</form>

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
  .progress { margin: 0; color: var(--text-muted); font-weight: 600; }
  h2 { margin: 0; font-size: clamp(1.2rem, 1rem + 1vw, 1.8rem); line-height: 1.3; }
  .big h2 { font-size: clamp(1.6rem, 1rem + 3vw, 4rem); }
  .primary { align-self: flex-start; background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 0 var(--space-6); font-weight: 700; font-size: 1.1rem; }
  .need { color: var(--bad); font-weight: 600; margin: 0; }
  .fb:focus { outline: none; }
  .fb:focus-visible { outline: 3px solid var(--focus); border-radius: var(--radius); }
</style>
```

- [ ] **Step 7: `src/quiz/Practice.svelte`**

```svelte
<script lang="ts">
  import { announce } from '../app/announcer.svelte';
  import { formatRoute } from '../app/router';
  import { readString, writeString } from '../app/storage';
  import { expose } from '../app/testMode';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import type { Overlay } from '../map/types';
  import type { TopicDef } from '../topics/types';
  import QuestionCard from './QuestionCard.svelte';
  import { checkAnswer, generateSet } from './registry';
  import { randomSeed } from './rng';
  import { bestScore, recordScore, scoreId } from './scores';
  import type { Answer, CheckResult, Difficulty } from './types';

  let { topic }: { topic: TopicDef } = $props();
  const ROUND = 10;
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
  const stored = readString('geo-coords:difficulty');
  let difficulty = $state<Difficulty>(DIFFS.includes(stored as Difficulty) ? (stored as Difficulty) : 'easy');
  let seed = $state(randomSeed());
  let index = $state(0);
  let results = $state<CheckResult[]>([]);
  let finished = $state(false);
  let best = $state<number | null>(null);

  const questions = $derived(generateSet(seed, [topic.id], difficulty, ROUND));
  const question = $derived(questions[index]!);
  const result = $derived(results[index] ?? null);
  const score = $derived(results.filter((r) => r.correct).length);

  let applied = '';
  $effect(() => {
    const key = `${seed}:${difficulty}:${index}`;
    if (key === applied || finished) return;
    applied = key;
    mapState.applyScene(question.scene);
    expose('__practice', { question, answer: question.answer });
  });

  function submit(answer: Answer) {
    const res = checkAnswer(question, answer);
    results[index] = res;
    mapState.pointEditable = false;
    const extra: Overlay[] = !res.correct && answer.kind === 'coords' ? [{ kind: 'marker', p: answer.value, tone: 'wrong' }] : [];
    mapState.addOverlays([...question.solution, ...extra]);
    announce(res.correct ? t('practice.correct') : t('practice.incorrect'), 'assertive');
  }

  function next() {
    if (index < ROUND - 1) { index += 1; return; }
    finished = true;
    best = recordScore(scoreId(topic.id, difficulty), score);
  }

  function newRound(d: Difficulty = difficulty) {
    difficulty = d;
    writeString('geo-coords:difficulty', d);
    seed = randomSeed();
    index = 0;
    results = [];
    finished = false;
  }

  let summaryHeading = $state<HTMLHeadingElement>();
  $effect(() => { if (finished) queueMicrotask(() => summaryHeading?.focus()); });
</script>

<div class="practice">
  <fieldset class="difficulty">
    <legend>{t('practice.difficulty')}</legend>
    {#each DIFFS as d (d)}
      <label><input type="radio" name="difficulty-{topic.id}" checked={difficulty === d} onchange={() => newRound(d)} /> {t(`difficulty.${d}`)}</label>
    {/each}
    {#if bestScore(scoreId(topic.id, difficulty)) !== null}
      <span class="best">{t('practice.best', { best: bestScore(scoreId(topic.id, difficulty))!, total: ROUND })}</span>
    {/if}
  </fieldset>

  {#if !finished}
    <div class="layout">
      <div class="stage"><MapStage /></div>
      <div class="panel">
        <QuestionCard {question} number={index + 1} total={ROUND} {result} onsubmit={submit} onnext={next}
          nextLabel={index < ROUND - 1 ? t('practice.next') : t('practice.results')} />
      </div>
    </div>
  {:else}
    <section class="summary" aria-labelledby="summary-title">
      <h2 id="summary-title" tabindex="-1" bind:this={summaryHeading}>{t('practice.done')}</h2>
      <p class="score">{t('practice.score', { score, total: ROUND })}</p>
      {#if best !== null}<p>{t('practice.best', { best, total: ROUND })}</p>{/if}
      <h3>{t('practice.review')}</h3>
      <ol class="review">
        {#each questions as q, i (q.id)}
          <li class:ok={results[i]?.correct}>
            <span class="mark" aria-hidden="true">{results[i]?.correct ? '✓' : '✗'}</span>
            <span class="visually-hidden">{results[i]?.correct ? t('practice.resultCorrect') : t('practice.resultWrong')}: </span>
            {renderText(q.prompt)}
          </li>
        {/each}
      </ol>
      <div class="actions">
        <button type="button" class="primary" onclick={() => newRound()}>{t('practice.newRound')}</button>
        {#if difficulty !== 'hard'}
          <button type="button" onclick={() => newRound(difficulty === 'easy' ? 'medium' : 'hard')}>{t('practice.harder')}</button>
        {/if}
        <a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: topic.id, step: 0 })}>{t('practice.backToLearn')}</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .practice { display: flex; flex-direction: column; gap: var(--space-4); }
  .difficulty { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-2) var(--space-4); background: var(--surface); }
  .difficulty legend { font-weight: 700; padding: 0 var(--space-1); }
  .difficulty label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: var(--tap); }
  .difficulty input { width: 1.2rem; height: 1.2rem; }
  .best { margin-left: auto; color: var(--text-muted); }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .layout { grid-template-columns: minmax(0, 1fr) 26rem; align-items: start; } .panel { position: sticky; top: 5rem; } }
  .summary { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); }
  .score { font-size: 2rem; font-weight: 800; margin: 0; }
  .review { display: grid; gap: var(--space-2); padding-left: 1.5rem; }
  .review li { padding: var(--space-1) 0; }
  .mark { display: inline-block; width: 1.5rem; font-weight: 800; color: var(--bad); }
  .ok .mark { color: var(--ok); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; margin-top: var(--space-4); }
  .actions button, .actions a { min-height: var(--tap); display: inline-flex; align-items: center; padding: 0 var(--space-4); border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); font-weight: 600; color: var(--text); }
  .actions .primary { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
</style>
```
Phone order: on narrow screens the map comes first and the question card below it. For choice questions whose map is small, that is acceptable; for keyboard/screen-reader users the question card follows the map controls in DOM order.

- [ ] **Step 8: Wire into `TopicPage.svelte`** — import `Practice` and replace the practice `{:else}` branch body with `<Practice topic={def} />`.

- [ ] **Step 9: E2E** `tests/e2e/practice.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

type Practice = { question: { type: string; input: { kind: string }; answer: { kind: string; index?: number; value?: { lat: number; lon: number } } } };
const current = (page: Page) => page.evaluate(() => (window as unknown as { __practice: Practice }).__practice);

async function answerCorrectlyWithKeyboard(page: Page) {
  const { question } = await current(page);
  const a = question.answer;
  if (a.kind === 'choice') {
    const radios = page.getByRole('radio');
    await radios.nth(0).focus();
    for (let i = 0; i < a.index!; i++) await page.keyboard.press('ArrowDown');
    if (a.index === 0) await page.keyboard.press('Space');
  } else if (a.kind === 'coords' && question.input.kind === 'coords') {
    const v = a.value!;
    const text = (n: number, pos: string, neg: string) => (n === 0 || Math.abs(n) === 180 ? `${Math.abs(n)}` : `${Math.abs(n)}${n > 0 ? pos : neg}`);
    const inputs = page.getByRole('textbox');
    if (await inputs.count() > 0) {
      await inputs.nth(0).focus();
      await page.keyboard.type(text(v.lat, 'N', 'S'));
      await page.keyboard.press('Tab');
      await page.keyboard.type(text(v.lon, 'E', 'W'));
    } else {
      const lat = page.getByRole('slider', { name: 'Latitude' });
      const lon = page.getByRole('slider', { name: 'Longitude' });
      const now = await current(page);
      void now;
      const readPoint = () => page.evaluate(() => (window as unknown as { __mapState: { point: { lat: number; lon: number } } }).__mapState.point);
      let p = await readPoint();
      await lat.focus();
      while (Math.round(p.lat) !== v.lat) { await page.keyboard.press(p.lat < v.lat ? 'ArrowUp' : 'ArrowDown'); p = await readPoint(); }
      await lon.focus();
      while (Math.round(p.lon) !== v.lon) { await page.keyboard.press(p.lon < v.lon ? 'ArrowRight' : 'ArrowLeft'); p = await readPoint(); }
    }
  }
  await page.keyboard.press('Enter');
}

for (const topic of [1, 2, 3, 4]) {
  test(`topic ${topic}: a full keyboard-only round scores 10/10`, async ({ page }) => {
    test.setTimeout(120_000);
    await openPage(page, `en/topic-${topic}/practice`, '?test');
    for (let i = 0; i < 10; i++) {
      await answerCorrectlyWithKeyboard(page);
      await expect(page.getByText('Correct!', { exact: true })).toBeVisible();
      if (i === 0) await expectNoAxeViolations(page, `topic ${topic} feedback`);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('heading', { name: 'Round complete' })).toBeFocused();
    await expect(page.getByText('You got 10 out of 10')).toBeVisible();
    expect(pageErrors(page)).toEqual([]);
  });
}

test('a wrong answer shows the mistake and the correct answer', async ({ page }) => {
  await openPage(page, 'en/topic-3/practice', '?test');
  const { question } = await current(page);
  const v = question.answer.value!;
  const inputs = page.getByRole('textbox');
  await inputs.nth(0).fill(`${Math.abs(v.lat)}${v.lat > 0 ? 'S' : 'N'}`);
  await inputs.nth(1).fill(`${Math.abs(v.lon)}${v.lon > 0 ? 'E' : 'W'}`);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Not quite')).toBeVisible();
  await expect(page.getByText(/Check the letter: N means north/)).toBeVisible();
  await expect(page.getByText(/^Correct answer:/)).toBeVisible();
});

test('submitting without an answer asks for one', async ({ page }) => {
  await openPage(page, 'pl/topic-2/practice', '?test');
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  await expect(page.getByRole('alert')).toHaveText('Najpierw wybierz lub wpisz odpowiedź.');
});
```
Notes for the implementer:
- In the choice branch, `ArrowDown` on a radio group moves **and selects**; pressing `Space` is only needed for the first option.
- Latitudes of exactly 0 or longitudes of 0/180 are typed without a letter — the parser accepts that (Task 2).
- `Enter` inside a text field submits the form; `Enter` on a focused radio also submits because the radios are inside the `<form>`.
- If a practice round hits a degree value near 180 on the slider path, the `while` loop may need to go the short way: accept that the loop presses `ArrowRight`/`ArrowLeft` up to 360 times — fine for a test.

- [ ] **Step 10: Run everything**

Run: `npm run check && npm test && npm run build && npm run e2e`
Expected: all green. Then screenshots: `npm run shot -- "en/topic-3/practice" practice-read` and `npm run shot -- "uk/topic-4/practice" practice-place`; view them.

- [ ] **Step 11: Commit milestone 1 (including the build)**

```bash
git add -A
git commit -m "feat(quiz): practice rounds with feedback, scores and difficulty; milestone 1 build"
```
