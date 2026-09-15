# Part 3 — Style switch, persistence, class quiz option, halos, credits (spec §9.3)

Read spec §3 "Readability rules", §5 "Controls and experience" first.

Context every task here needs:
- `MapState` (`src/map/mapState.svelte.ts`) has, from Task 5: `stylePreference`, `styleOverride`, `styleChoice`, `runStyle`, getters `chosenMapStyle` (the pick, before fallback), `mapStyle` (after fallback), `drawnMapStyle` (what layers draw now), and `chooseMapStyle(s)` / `setStylePreference(s)`.
- `src/map/mapStyle.ts`: `MapStyle`, `MAP_STYLES` (`['atlas','physical','satellite','political']`), `isTextureStyle`, `parseMapStyle`.
- `src/map/texture/health.svelte.ts`: `renderHealth.loading` is the texture style being decoded (or null).
- The flat map (`src/map/FlatMap.svelte`) and globe (`src/map/Globe.svelte`) each have a `.frame` (now with `data-map-style={mapState.drawnMapStyle}`) and a `.toolbar` below it; the flat toolbar on phones (< 600 px) is one horizontally scrolling row.
- i18n: flat JSON files `src/i18n/{en,pl,uk}.json`; `t(key, params)` from `src/i18n/i18n.svelte.ts`. `tests/unit/i18n.test.ts` fails on untranslated values equal to English unless allow-listed in `scripts/translation-review-lib.ts` (`SAME_OK`), and on Latin words in Ukrainian unless in `LATIN_OK`.
- E2E helpers in `tests/e2e/helpers.ts`: `openPage`, `pageErrors`, `expectNoAxeViolations`, and from Task 7 `setMapStyle`, `waitForTexture`, `probe`, `textureHooks`.

---

### Task 9: Style switch and persistence

**Files:**
- Create: `src/map/MapStyleSwitch.svelte`, `src/map/styleFade.ts`
- Modify: `src/map/mapStyle.ts`, `src/map/mapState.svelte.ts`, `src/map/FlatMap.svelte`, `src/map/Globe.svelte`, `src/map/MapStage.svelte`, `src/app/SettingsDialog.svelte`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`, `scripts/translation-review-lib.ts`
- Test: `tests/unit/mapStyle.test.ts` (extend — it is new in this branch), `tests/unit/mapState-style.test.ts` (extend), `tests/e2e/map-style-switch.spec.ts`

**Interfaces:**
- Consumes: see Context.
- Produces:
  ```ts
  // src/map/mapStyle.ts
  export const MAP_STYLE_KEY = 'geo-coords:map-style';
  export function readMapStyle(): MapStyle;          // parseMapStyle(readString(MAP_STYLE_KEY))
  export function writeMapStyle(s: MapStyle): void;
  // src/map/styleFade.ts — Svelte action: use:styleFade={style}
  export function styleFade(node: HTMLElement, style: string): { update(next: string): void };
  // MapStyleSwitch.svelte props: { idPrefix: string }
  // i18n keys: map.style, map.style.atlas, map.style.physical, map.style.satellite, map.style.political, map.style.hint,
  //   map.style.menu ({style}), map.style.loading, map.style.description.atlas|physical|satellite|political, settings.mapStyle
  ```

- [ ] **Step 1: Failing unit tests**

Append to `tests/unit/mapStyle.test.ts`:
```ts
import { beforeEach } from 'vitest';
import { MAP_STYLE_KEY, readMapStyle, writeMapStyle } from '../../src/map/mapStyle';

describe('the saved style', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage;
  });
  test('written and read back under its own key', () => {
    expect(MAP_STYLE_KEY).toBe('geo-coords:map-style');
    writeMapStyle('satellite');
    expect(store.get('geo-coords:map-style')).toBe('satellite');
    expect(readMapStyle()).toBe('satellite');
  });
  test('missing, corrupted or unknown values read as Atlas', () => {
    expect(readMapStyle()).toBe('atlas');
    for (const raw of ['', 'null', '"satellite"', 'Satellite', 'terrain', '{}']) { store.set(MAP_STYLE_KEY, raw); expect(readMapStyle(), raw).toBe('atlas'); }
  });
  test('storage that throws reads as Atlas and writing does not throw', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(readMapStyle()).toBe('atlas');
    expect(() => writeMapStyle('physical')).not.toThrow();
  });
});
```
(Add `describe` to the existing `vitest` import.)

Append to `tests/unit/mapState-style.test.ts`:
```ts
test('the preference is saved; a new MapState starts with it; scene and run picks are never saved', () => {
  const store = new Map<string, string>();
  globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as unknown as Storage;
  const a = new MapState();
  a.chooseMapStyle('physical');
  expect(store.get('geo-coords:map-style')).toBe('physical');
  expect(new MapState().stylePreference).toBe('physical');
  a.applyScene({ views: ['flat'], mapStyle: 'atlas' });
  a.chooseMapStyle('satellite');
  a.applyScene({ views: ['flat'] });
  a.runStyle = 'political';
  a.chooseMapStyle('satellite');
  expect(store.get('geo-coords:map-style')).toBe('physical');
});
```
Run: `npx vitest run tests/unit/mapStyle.test.ts tests/unit/mapState-style.test.ts` — Expected: FAIL (`readMapStyle` not exported).

- [ ] **Step 2: Storage and MapState**

Append to `src/map/mapStyle.ts`:
```ts
import { readString, writeString } from '../app/storage';

/** Remembered like the grid / Equal Earth choice, under its own key (planning ruling R1). */
export const MAP_STYLE_KEY = 'geo-coords:map-style';
export const readMapStyle = (): MapStyle => parseMapStyle(readString(MAP_STYLE_KEY));
export const writeMapStyle = (s: MapStyle): void => writeString(MAP_STYLE_KEY, s);
```
(Move the import to the top of the file.) In `MapState`: `stylePreference = $state<MapStyle>(readMapStyle());` and
```ts
  setStylePreference(s: MapStyle): void {
    this.stylePreference = s;
    writeMapStyle(s);
  }
```
Run the two unit test files — Expected: PASS.

- [ ] **Step 3: Messages**

Add to the three files (one file at a time; `map.style.*` next to `map.projection.*`, `settings.mapStyle` after `settings.reducedMotion`):

| key | en | pl | uk |
|---|---|---|---|
| `map.style` | Map style | Styl mapy | Стиль карти |
| `map.style.atlas` | Atlas | Atlas | Атлас |
| `map.style.physical` | Physical | Fizyczna | Фізична |
| `map.style.satellite` | Satellite | Satelitarna | Супутникова |
| `map.style.political` | Political | Polityczna | Політична |
| `map.style.hint` | Atlas: the lesson's clear map. Physical: mountains, lowlands and sea depths. Satellite: photos of the Earth from space. Political: countries in colour. | Atlas: przejrzysta mapa z lekcji. Fizyczna: góry, niziny i głębiny mórz. Satelitarna: zdjęcia Ziemi z kosmosu. Polityczna: kolorowe państwa. | Атлас: зрозуміла карта уроку. Фізична: гори, низовини й глибини морів. Супутникова: знімки Землі з космосу. Політична: країни різними кольорами. |
| `map.style.menu` | Map style: {style} | Styl mapy: {style} | Стиль карти: {style} |
| `map.style.loading` | Loading map… | Wczytywanie mapy… | Завантаження карти… |
| `map.style.description.atlas` | The map shows land in beige and the sea in blue. | Mapa pokazuje ląd na beżowo, a morze na niebiesko. | Карта показує суходіл бежевим, а море синім. |
| `map.style.description.physical` | The map shows mountains in brown, lowlands in green, sea depths in shades of blue, and rivers and lakes. | Mapa pokazuje góry na brązowo, niziny na zielono, głębiny morskie w odcieniach niebieskiego oraz rzeki i jeziora. | Карта показує гори коричневим, низовини зеленим, глибини морів відтінками синього, а також річки й озера. |
| `map.style.description.satellite` | The map shows photos of the Earth taken from space; where it is night, city lights glow. | Mapa pokazuje zdjęcia Ziemi zrobione z kosmosu; tam, gdzie jest noc, świecą światła miast. | Карта показує знімки Землі з космосу; там, де ніч, світяться вогні міст. |
| `map.style.description.political` | The map shows countries in different colours, with their names and capitals. | Mapa pokazuje państwa w różnych kolorach, z nazwami i stolicami. | Карта показує країни різними кольорами, з назвами та столицями. |
| `settings.mapStyle` | Map style | Styl mapy | Стиль карти |

In `scripts/translation-review-lib.ts` add to `SAME_OK` `/^map\.style\.atlas$/` and to the comment above it: `//  - map.style.atlas  "Atlas" is the same word in Polish (the style's name)`.
Run: `npx vitest run tests/unit/i18n.test.ts tests/unit/translation-review.test.ts` — Expected: PASS.

- [ ] **Step 4: `src/map/styleFade.ts`**

```ts
import { motionReduced } from '../app/settings.svelte';

/** Spec §5: a short fade-in when the drawn map style changes (planning ruling R12); none with reduced motion. */
export function styleFade(node: HTMLElement, style: string) {
  let current = style;
  return {
    update(next: string) {
      if (next === current) return;
      current = next;
      if (motionReduced() || typeof node.animate !== 'function') return;
      node.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    },
  };
}
```

- [ ] **Step 5: `src/map/MapStyleSwitch.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { MAP_STYLES, type MapStyle } from './mapStyle';

  // Spec §5: Atlas · Physical · Satellite · Political on every map toolbar; below 480 px a compact disclosure menu.
  let { idPrefix }: { idPrefix: string } = $props();

  const query = '(max-width: 479px)';
  let compact = $state(typeof matchMedia === 'function' && matchMedia(query).matches);
  $effect(() => {
    const mq = matchMedia(query);
    const on = (e: MediaQueryListEvent) => { compact = e.matches; open = false; };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });

  let open = $state(false);
  let button = $state<HTMLButtonElement>();
  let panel = $state<HTMLDivElement>();
  let place = $state({ top: 0, left: 0 });

  function toggle() {
    if (!open && button) {
      // Fixed to the viewport, so the phone's sideways-scrolling tool row cannot clip it.
      const r = button.getBoundingClientRect();
      place = { top: r.bottom + 4, left: Math.max(8, Math.min(r.left, innerWidth - 8 - 232)) };
    }
    open = !open;
    if (open) queueMicrotask(() => panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus());
  }
  function close(refocus: boolean) { open = false; if (refocus) button?.focus(); }
  function pick(s: MapStyle) {
    mapState.chooseMapStyle(s);
    if (compact) close(true);
  }
  $effect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!panel?.contains(e.target as Node) && !button?.contains(e.target as Node)) close(false); };
    const away = () => close(false);
    addEventListener('pointerdown', outside, true);
    addEventListener('resize', away);
    addEventListener('scroll', away, true);
    return () => { removeEventListener('pointerdown', outside, true); removeEventListener('resize', away); removeEventListener('scroll', away, true); };
  });
</script>

{#snippet choices()}
  {#each MAP_STYLES as s (s)}
    <button type="button" class="btn" aria-pressed={mapState.chosenMapStyle === s} onclick={() => pick(s)}>{t(`map.style.${s}`)}</button>
  {/each}
{/snippet}

{#if !compact}
  <div class="style-group seg" role="group" aria-label={t('map.style')} aria-describedby="{idPrefix}-style-hint">{@render choices()}</div>
{:else}
  <button bind:this={button} type="button" class="btn style-menu" aria-expanded={open} aria-controls="{idPrefix}-style-panel" aria-describedby="{idPrefix}-style-hint" onclick={toggle}>
    {t('map.style.menu', { style: t(`map.style.${mapState.chosenMapStyle}`) })}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -- Esc closes the menu; the buttons inside are the controls -->
    <div bind:this={panel} id="{idPrefix}-style-panel" class="style-panel" role="group" aria-label={t('map.style')}
      style:top="{place.top}px" style:left="{place.left}px"
      onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }}>
      {@render choices()}
    </div>
  {/if}
{/if}
<p id="{idPrefix}-style-hint" class="visually-hidden">{t('map.style.hint')}</p>

<style>
  .style-group { flex-wrap: nowrap; }
  .style-menu { gap: var(--space-1); white-space: nowrap; }
  .style-menu svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .style-panel { position: fixed; z-index: 30; width: 14.5rem; display: grid; gap: var(--space-1); padding: var(--space-2); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow-3); }
  .style-panel .btn { justify-content: flex-start; }
</style>
```

- [ ] **Step 6: Place the switch, the description, the fade and the loading status**

`src/map/FlatMap.svelte`:
- import `MapStyleSwitch` and `styleFade`;
- frame: `<div class="frame" bind:clientWidth data-map-style={mapState.drawnMapStyle} use:styleFade={mapState.drawnMapStyle}>`;
- in `.toolbar`, right before the projection group's `{#if …}`: `<MapStyleSwitch idPrefix={uid} />`;
- svg: `aria-describedby="{uid}-hint {uid}-style-desc"` and after the hint paragraph `<p id="{uid}-style-desc" class="visually-hidden">{t(`map.style.description.${mapState.drawnMapStyle}`)}</p>`.
- The projection group keeps `margin-left: auto`; the style group sits just left of it.

`src/map/Globe.svelte`: the same frame attributes, description and `aria-describedby`; `<MapStyleSwitch idPrefix={uid} />` as the last child of `.toolbar`.

`src/map/MapStage.svelte`: right before `<MapStyleNote />` add
```svelte
  <p class="map-status" role="status">{renderHealth.loading && isTextureStyle(mapState.mapStyle) ? t('map.style.loading') : ''}</p>
```
with `import { renderHealth } from './texture/health.svelte'; import { isTextureStyle } from './mapStyle';` and CSS `.map-status { margin: 0; color: var(--text-muted); font-size: var(--step--1); } .map-status:empty { display: none; }`.

`src/app/SettingsDialog.svelte`: after the theme fieldset:
```svelte
  <fieldset>
    <legend>{t('settings.mapStyle')}</legend>
    {#each MAP_STYLES as s (s)}
      <label class="row"><input type="radio" name="map-style" value={s} checked={mapState.stylePreference === s} onchange={() => mapState.setStylePreference(s)} /> {t(`map.style.${s}`)}</label>
    {/each}
  </fieldset>
```
with `import { mapState } from '../map/mapState.svelte'; import { MAP_STYLES } from '../map/mapStyle';`.

- [ ] **Step 7: E2E `tests/e2e/map-style-switch.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, waitForTexture } from './helpers';

test('every map toolbar offers the four styles; a choice is drawn, described and remembered', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flatGroup = page.locator('.view-flat').getByRole('group', { name: 'Map style' });
  const globeGroup = page.locator('.view-globe').getByRole('group', { name: 'Map style' });
  await expect(flatGroup.getByRole('button')).toHaveText(['Atlas', 'Physical', 'Satellite', 'Political']);
  await expect(globeGroup.getByRole('button')).toHaveCount(4);
  await expect(flatGroup.getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-pressed', 'true');

  await flatGroup.getByRole('button', { name: 'Physical' }).click();
  await expect(globeGroup.getByRole('button', { name: 'Physical' })).toHaveAttribute('aria-pressed', 'true');
  await waitForTexture(page, 'flat');
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'physical');
  await expect(page.getByRole('group', { name: 'World map with parallels and meridians' })).toHaveAccessibleDescription(/mountains in brown/);
  await expect(page.locator('.map-status')).toBeEmpty();
  await expectNoAxeViolations(page, 'lab physical switch');

  await page.reload();
  await page.waitForSelector('#main');
  await expect(page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Physical' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('geo-coords:map-style'))).toBe('physical');
  expect(pageErrors(page)).toEqual([]);
});

test('the choice is shared by every map in the lesson and shown in Settings, which can change it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'political'));
  await openPage(page, 'en/topic-3/practice');
  await expect(page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Political' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: 'Political' })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Atlas' }).check();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard only: Tab to the switch, Enter picks a style', async ({ page }) => {
  await openPage(page, 'en/topic-1/explore/9');
  const satellite = page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Satellite' });
  for (let i = 0; i < 60 && !(await satellite.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(satellite).toHaveAttribute('aria-pressed', 'true');
});

test('below 480 px the switch is a compact menu: open, choose, Esc returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'pl/lab');
  const menu = page.locator('.view-flat').getByRole('button', { name: 'Styl mapy: Atlas' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  const panel = page.getByRole('group', { name: 'Styl mapy' });
  await expect(panel.getByRole('button')).toHaveText(['Atlas', 'Fizyczna', 'Satelitarna', 'Polityczna']);
  await expect(panel.getByRole('button', { name: 'Atlas' })).toBeFocused();
  await expectNoAxeViolations(page, 'compact style menu');
  await panel.getByRole('button', { name: 'Satelitarna' }).click();
  await expect(page.locator('.view-flat').getByRole('button', { name: 'Styl mapy: Satelitarna' })).toBeFocused();
  await page.locator('.view-flat').getByRole('button', { name: /Styl mapy/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Styl mapy' })).toHaveCount(0);
  await expect(page.locator('.view-flat').getByRole('button', { name: /Styl mapy/ })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

for (const width of [320, 480, 600, 1024, 1366]) {
  test(`no horizontal page scroll with the style switch at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const hash of ['uk/lab', 'en/topic-1/explore', 'pl/topic-3/practice']) {
      await openPage(page, hash);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${hash} at ${width}`).toBeLessThanOrEqual(width);
    }
  });
}

test('reduced motion: changing the style does not animate the map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Political' }).click();
  expect(await page.locator('.view-flat .frame').evaluate((f) => f.getAnimations().length)).toBe(0);
});
```
`en/topic-1/explore/9` is topic 1's `play` step (a flat map with a toolbar).

- [ ] **Step 8: Run and look**

```bash
npm run check && npm test
npm run build && npx playwright test tests/e2e/map-style-switch.spec.ts tests/e2e/responsive.spec.ts tests/e2e/atlas-baseline.spec.ts tests/e2e/schools.spec.ts tests/e2e/map.spec.ts tests/e2e/presenter.spec.ts
npm run shot -- en/lab lab-switch
```
Expected: PASS. Look at `shots/lab-switch-375x667.png` and `-1366x768.png`: the style group sits next to the projection group on wide screens, the compact menu button fits the phone's tool row, nothing overlaps.

- [ ] **Step 9: Commit**

```bash
git add src/map/MapStyleSwitch.svelte src/map/styleFade.ts src/map/mapStyle.ts src/map/mapState.svelte.ts src/map/FlatMap.svelte src/map/Globe.svelte src/map/MapStage.svelte src/app/SettingsDialog.svelte src/i18n scripts/translation-review-lib.ts tests/unit/mapStyle.test.ts tests/unit/mapState-style.test.ts tests/e2e/map-style-switch.spec.ts
git commit -m "feat(map): map style switch on every map toolbar and in Settings, remembered"
```

---

### Task 10: Class quiz style for the run; worksheets stay Atlas

**Files:**
- Modify: `src/quiz/ClassQuiz.svelte`, `src/quiz/paper.ts`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`
- Test: `tests/unit/paper.test.ts` is NOT edited; add `tests/unit/paper-style.test.ts`; `tests/e2e/class-quiz-style.spec.ts`

**Interfaces:**
- Consumes: `mapState.runStyle`, `mapState.chosenMapStyle`, `mapState.stylePreference` (Task 5/9); `MAP_STYLES`, `MapStyle` (`src/map/mapStyle.ts`); `SceneSpec.mapStyle` (Task 5); `paperScene(q: Question): SceneSpec` (`src/quiz/paper.ts`).
- Produces: i18n key `classQuiz.mapStyle`; `paperScene(q).mapStyle === 'atlas'` for every question.

- [ ] **Step 1: Failing unit test `tests/unit/paper-style.test.ts`**

```ts
import { expect, test } from 'vitest';
import { paperScene } from '../../src/quiz/paper';
import { generateSet } from '../../src/quiz/registry';

test('worksheet maps are always Atlas, whatever style the pupil chose', () => {
  const qs = generateSet('sheet:style', [1, 2, 3, 4, 5, 6, 7, 8], 'hard', 40);
  for (const q of qs) expect(paperScene(q).mapStyle, q.id).toBe('atlas');
});
```
Run: `npx vitest run tests/unit/paper-style.test.ts` — Expected: FAIL (`undefined` is not `'atlas'`).

- [ ] **Step 2: `paperScene` forces Atlas**

In `src/quiz/paper.ts`, in the object returned by `paperScene`, add after `flatProjection: 'grid',`:
```ts
    // Spec §5: worksheets and the cheat sheet are Atlas, whatever style is chosen for the screen.
    mapStyle: 'atlas',
```
Run the test — Expected: PASS. Run `npx vitest run tests/unit/paper.test.ts` — Expected: PASS (unchanged).

- [ ] **Step 3: Message**

| key | en | pl | uk |
|---|---|---|---|
| `classQuiz.mapStyle` | Map style for the class | Styl mapy dla klasy | Стиль карти для класу |

- [ ] **Step 4: The setup option and the run style in `src/quiz/ClassQuiz.svelte`**

Script additions:
```ts
  import { MAP_STYLES, type MapStyle } from '../map/mapStyle';
  // Spec §5: the teacher picks a style for this run (default: the style in use); it never changes the saved choice.
  let runStyle = $state<MapStyle>(untrack(() => mapState.chosenMapStyle));
  // Leaving the class quiz page (any route) ends the run style too.
  $effect(() => () => { mapState.runStyle = null; });
```
In `start(e)`, right before `phase = 'run';`: `mapState.runStyle = runStyle;`
In `end()`, first line: `mapState.runStyle = null;`

Markup: inside the setup form, after the `<div class="pair">…</div>` and before the Start button:
```svelte
    <fieldset>
      <legend>{t('classQuiz.mapStyle')}</legend>
      <div class="seg">
        {#each MAP_STYLES as s (s)}<label><input type="radio" name="cq-style" value={s} bind:group={runStyle} /> {t(`map.style.${s}`)}</label>{/each}
      </div>
    </fieldset>
```
The existing `.setup fieldset` and `.setup .seg > label` styles apply; on a 320 px phone the four labels wrap (check `.seg` wraps; if it does not, add `.setup .seg { flex-wrap: wrap; }` scoped to this fieldset with a class `styles`).

- [ ] **Step 5: E2E `tests/e2e/class-quiz-style.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const s = (window as unknown as { __mapState: { chosenMapStyle: string; runStyle: string | null; stylePreference: string } }).__mapState;
  return { chosen: s.chosenMapStyle, run: s.runStyle, saved: localStorage.getItem('geo-coords:map-style') };
});

test('the class quiz style applies to the run only; the saved choice is untouched', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('geo-coords:map-style', 'physical'); sessionStorage.setItem('seeded', '1'); } });
  await openPage(page, 'en/class-quiz', '?test');
  const group = page.getByRole('group', { name: 'Map style for the class' });
  await expect(group.getByRole('radio', { name: 'Physical' })).toBeChecked();
  await group.getByRole('radio', { name: 'Political' }).check();
  await expectNoAxeViolations(page, 'class quiz setup with style');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  expect(await read(page)).toEqual({ chosen: 'political', run: 'political', saved: 'physical' });
  await expect(page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Political' })).toHaveAttribute('aria-pressed', 'true');

  // A pick on the toolbar during the run changes the run, not the saved choice.
  await page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Satellite' }).click();
  expect(await read(page)).toEqual({ chosen: 'satellite', run: 'satellite', saved: 'physical' });
  await page.locator('body').press('ArrowRight');
  expect((await read(page)).chosen).toBe('satellite');

  await page.getByRole('button', { name: 'End quiz' }).click();
  expect(await read(page)).toEqual({ chosen: 'physical', run: null, saved: 'physical' });
  expect(pageErrors(page)).toEqual([]);
});

test('leaving a running quiz for another page ends the run style', async ({ page }) => {
  await openPage(page, 'en/class-quiz', '?test');
  await page.getByRole('group', { name: 'Map style for the class' }).getByRole('radio', { name: 'Satellite' }).check();
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.goto(page.url().replace(/#.*/, '#en/lab'));
  await page.waitForSelector('.view-flat');
  expect(await read(page)).toEqual({ chosen: 'atlas', run: null, saved: null });
});

test('worksheets and the cheat sheet stay Atlas with no style switch', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'satellite'));
  await openPage(page, 'en/worksheet');
  await expect(page.locator('.paper svg path.land').first()).toBeAttached();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Map style' })).toHaveCount(0);
  await openPage(page, 'en/cheatsheet');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Map style' })).toHaveCount(0);
});
```
Check the worksheet's paper container class in `src/app/Worksheet.svelte` (`.paper`); if it differs, use the real one.

- [ ] **Step 6: Run and commit**

```bash
npm run check && npm test
npm run build && npx playwright test tests/e2e/class-quiz-style.spec.ts tests/e2e/class-quiz.spec.ts tests/e2e/class-quiz-fit.spec.ts tests/e2e/class-quiz-navigation.spec.ts tests/e2e/print-pages.spec.ts tests/e2e/explore.spec.ts
git add src/quiz/ClassQuiz.svelte src/quiz/paper.ts src/i18n tests/unit/paper-style.test.ts tests/e2e/class-quiz-style.spec.ts
git commit -m "feat(quiz): a map style for the class quiz run; worksheets always Atlas"
```
Expected: all PASS (`class-quiz.spec.ts` "topic list has 8 checkboxes" still holds: the style choices are radios).

---

### Task 11: Readability halos, presenter mode, credits

Grid, special lines, point guides, markers and all labels keep a halo over relief, photos and country colours; Satellite uses light map inks; presenter mode strengthens halos; credits name Natural Earth relief and NASA Earth Observatory.

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/base.css`, `src/map/layers/Graticule.svelte`, `src/map/MapStage.svelte`, `src/map/MapStyleSwitch.svelte`, `src/app/credits.ts`, `src/app/Footer.svelte`, `LICENSE-CONTENT.md`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`, `scripts/translation-review-lib.ts`
- Test: `tests/e2e/map-style-readability.spec.ts`

**Interfaces:**
- Consumes: `.frame[data-map-style]` on flat maps and globes (Task 7), `mapState.drawnMapStyle`, `setMapStyle`/`waitForTexture` e2e helpers.
- Produces: CSS custom properties scoped to `.frame[data-map-style="satellite"]` (light inks, dark halo); class `grid-casing`; i18n keys `footer.imagery` ({source}), `map.style.source.physical`, `map.style.source.satellite`, `map.style.source.political`; `IMAGERY` in `src/app/credits.ts`.

- [ ] **Step 1: Failing e2e `tests/e2e/map-style-readability.spec.ts`**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

/** WCAG contrast of each map ink against the halo it sits on, read from the frame's own computed tokens. */
const inks = (page: Page, view: 'flat' | 'globe') => page.locator(`.view-${view} .frame`).evaluate((frame) => {
  const cs = getComputedStyle(frame);
  const rgb = (v: string) => { const c = document.createElement('canvas').getContext('2d')!; c.fillStyle = v.trim(); const h = c.fillStyle as string; return h.startsWith('#') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : (h.match(/\d+/g) ?? []).slice(0, 3).map(Number); };
  const lum = (v: string) => { const [r, g, b] = rgb(v).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
  const halo = cs.getPropertyValue('--halo');
  return Object.fromEntries(['--text', '--map-label', '--ocean-label', '--equator-text', '--prime-text', '--antimeridian-text', '--tropics-text', '--river-label'].map((t) => [t, ratio(cs.getPropertyValue(t), halo)]));
});

for (const scheme of ['light', 'dark'] as const) {
  test(`Satellite (${scheme}): light inks on a dark halo, AA normally and AAA in presenter mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'satellite');
    await waitForTexture(page, 'flat');
    for (const [token, r] of Object.entries(await inks(page, 'flat'))) expect(r, `${token}`).toBeGreaterThanOrEqual(4.5);
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    for (const [token, r] of Object.entries(await inks(page, 'flat'))) expect(r, `presenter ${token}`).toBeGreaterThanOrEqual(7);
    const enhanced = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
    expect(enhanced.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('every non-Atlas style draws halos under the grid and full-strength halos behind map text; Atlas unchanged', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('.view-flat path.grid-casing')).toHaveCount(0);
  for (const style of ['physical', 'satellite', 'political'] as const) {
    await setMapStyle(page, style);
    if (style !== 'political') await waitForTexture(page, 'flat');
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', style);
    await expect(page.locator('.view-flat path.grid-casing')).toHaveCount(1);
    const halo = await page.locator('.view-flat text.halo').first().evaluate((t) => { const cs = getComputedStyle(t); return [cs.strokeOpacity, cs.strokeWidth]; });
    expect(halo).toEqual(['1', '4px']);
  }
});

test('the source of each style is named under the map; the footer credits NASA Earth Observatory', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('.map-source')).toBeEmpty();
  await setMapStyle(page, 'physical');
  await expect(page.locator('.map-source')).toHaveText('Relief and sea depths: Natural Earth.');
  await setMapStyle(page, 'satellite');
  await expect(page.locator('.map-source')).toHaveText('Images: NASA Earth Observatory (Blue Marble, Black Marble).');
  await setMapStyle(page, 'political');
  await expect(page.locator('.map-source')).toHaveText("Borders: Natural Earth, in Poland's official view.");
  await expect(page.locator('footer').getByRole('link', { name: 'NASA Earth Observatory' })).toHaveAttribute('href', 'https://earthobservatory.nasa.gov/');
  await expect(page.locator('footer')).toContainText('Satellite images: NASA Earth Observatory');
});
```
Run: `npm run build && npx playwright test tests/e2e/map-style-readability.spec.ts` — Expected: FAIL (no `grid-casing`, no `.map-source`, contrast below 4.5 on the light theme).

- [ ] **Step 2: Tokens and halo rules**

Append to `src/styles/tokens.css` (after the presenter blocks):
```css
/* Map styles (spec §3 "Readability rules"). Satellite photos are dark in every theme, so map inks take light values and
 * halos go dark; a lighter grid. Presenter mode raises them to AAA (7:1 against the halo). */
.frame[data-map-style="satellite"] {
  --halo: #0b1622; --text: #f3f6f9; --map-label: #e6edf3; --ocean-label: #bfdcf2; --grid: #dbe7f2; --land-stroke: #e8e2c8;
  --equator: #fb923c; --prime: #c4b5fd; --antimeridian: #5eead4; --tropics: #facc15;
  --equator-text: #fdba74; --prime-text: #ddd6fe; --antimeridian-text: #99f6e4; --tropics-text: #fde047;
  --river: #7dbbef; --river-label: #d6ecfb; --school-text: #f9a8d4;
  --marker-a: #82b1ff; --marker-b: #fb923c; --marker-c: #c4b5fd; --marker-d: #5eead4; --marker-answer: #6fdd8b; --marker-wrong: #ff8a80;
  --accent: #9cc2ff;
}
:root[data-presenter="true"] .frame[data-map-style="satellite"] {
  --text: #ffffff; --map-label: #ffffff; --ocean-label: #e1f0fb; --grid: #eef4fa;
  --equator-text: #ffe3c2; --prime-text: #ede9fe; --antimeridian-text: #ccfbf1; --tropics-text: #fef08a; --river-label: #e6f3fc;
}
```
Append to `src/styles/base.css` (after the `svg text.halo` rule):
```css
/* Over relief, photos and country colours every map text keeps a full, slightly wider halo (spec §3); presenter wider still. */
.frame[data-map-style]:not([data-map-style="atlas"]) svg text.halo { stroke-opacity: 1; stroke-width: 4px; }
:root[data-presenter="true"] .frame[data-map-style]:not([data-map-style="atlas"]) svg text.halo { stroke-width: 5.5px; }
.frame[data-map-style]:not([data-map-style="atlas"]) .guide-casing,
.frame[data-map-style]:not([data-map-style="atlas"]) .casing { stroke-opacity: 0.9; }
```
(`.casing` is the special lines' halo, `.guide-casing` the point guides'; both exist.) Markers already draw white rims and `text.halo` labels; confirm by reading `src/map/layers/Overlays.svelte` and add the same `stroke-opacity: 0.9` override for any casing class it uses (e.g. `.noon-casing`).

- [ ] **Step 3: A halo under the grid in non-Atlas styles**

`src/map/layers/Graticule.svelte`:
```svelte
<script lang="ts">
  …existing…
  // Over relief, photos and country colours the thin grid needs a halo (spec §3); Atlas stays as it was.
  const styled = $derived(mapState.drawnMapStyle !== 'atlas');
</script>

{#if styled}<path class="grid-casing" d={d} />{/if}
<path class="grid" d={d} />

<style>
  .grid-casing { fill: none; stroke: var(--halo); stroke-width: calc(2.75px * var(--stroke-scale)); stroke-opacity: 0.55; vector-effect: non-scaling-stroke; pointer-events: none; }
  .grid { …unchanged… }
</style>
```
Also add `:global(.frame[data-map-style]:not([data-map-style="atlas"])) .grid { stroke-opacity: 0.8; }` so the grid itself is firmer over images.

- [ ] **Step 4: Sources under the map and in the footer**

Messages:

| key | en | pl | uk |
|---|---|---|---|
| `map.style.source.physical` | Relief and sea depths: Natural Earth. | Rzeźba terenu i głębiny: Natural Earth. | Рельєф і глибини: Natural Earth. |
| `map.style.source.satellite` | Images: NASA Earth Observatory (Blue Marble, Black Marble). | Zdjęcia: NASA Earth Observatory (Blue Marble, Black Marble). | Знімки: NASA Earth Observatory (Blue Marble, Black Marble). |
| `map.style.source.political` | Borders: Natural Earth, in Poland's official view. | Granice: Natural Earth, zgodnie z oficjalnym stanowiskiem Polski. | Кордони: Natural Earth, як їх офіційно визнає Польща. |
| `footer.imagery` | Satellite images: {source} | Zdjęcia satelitarne: {source} | Супутникові знімки: {source} |

In `scripts/translation-review-lib.ts` add to `LATIN_OK`: `'NASA', 'Observatory', 'Blue', 'Black', 'Marble', 'Natural'`, and to its comment: `//  - NASA, Observatory, Blue, Black, Marble, Natural  names of the image and data sources (NASA Earth Observatory, Blue Marble, Black Marble, Natural Earth), kept as published`.

`src/app/credits.ts`: add `export const IMAGERY = { name: 'NASA Earth Observatory', url: 'https://earthobservatory.nasa.gov/' };`

`src/app/Footer.svelte`, first paragraph, after the Natural Earth link:
```svelte
    <span class="sep" aria-hidden="true"> · </span>
    {t('footer.imagery', { source: '' })}<a href={IMAGERY.url} rel="noopener">{IMAGERY.name}</a>
```

`src/map/MapStage.svelte`, after the loading status paragraph:
```svelte
  <p class="map-source">{mapState.drawnMapStyle !== 'atlas' ? t(`map.style.source.${mapState.drawnMapStyle}`) : ''}</p>
```
CSS: `.map-source { margin: 0; color: var(--text-muted); font-size: var(--step--1); } .map-source:empty { display: none; }`.

The style hint names the source too (spec §3 "Credits"): in `src/map/MapStyleSwitch.svelte` the hidden hint becomes `{t('map.style.hint')} {mapState.drawnMapStyle !== 'atlas' ? t(`map.style.source.${mapState.drawnMapStyle}`) : ''}`, and each style button gets `title={s === 'atlas' ? undefined : t(`map.style.source.${s}`)}`.

`LICENSE-CONTENT.md`, "Third-party data": add a bullet after the map data bullet:
```markdown
- **Relief and satellite images** — the Physical map style uses Natural Earth's
  "Cross Blended Hypso with Shaded Relief and Water" (`HYP_50M_SR_W`, public
  domain). The Satellite map style uses NASA Earth Observatory's Blue Marble
  Next Generation (July 2004) and Black Marble 2016 images, which are not
  subject to copyright in the United States; credit: NASA Earth Observatory.
  The Political map style's country shapes are Natural Earth's Poland
  point-of-view admin-0 countries (`ne_10m_admin_0_countries_pol`, public domain).
```

- [ ] **Step 5: Run, look, commit**

```bash
npm run check && npm test
npm run build && npx playwright test tests/e2e/map-style-readability.spec.ts tests/e2e/presenter.spec.ts tests/e2e/theme.spec.ts tests/e2e/atlas-baseline.spec.ts tests/e2e/schools.spec.ts
npm run e2e
```
Expected: PASS. Look at the lab in Satellite at 1366×768, light and dark, and in presenter mode (press `P`): every label, line name and the point readable on land, sea and night; then Physical over the Alps and Sahara.
If a contrast value fails, change only the satellite token (never an Atlas token).
```bash
git add src/styles/tokens.css src/styles/base.css src/map/layers/Graticule.svelte src/map/MapStage.svelte src/app/credits.ts src/app/Footer.svelte LICENSE-CONTENT.md src/i18n scripts/translation-review-lib.ts tests/e2e/map-style-readability.spec.ts
git commit -m "feat(map): halos and light inks over images, stronger in presenter mode; relief and NASA credits"
```
