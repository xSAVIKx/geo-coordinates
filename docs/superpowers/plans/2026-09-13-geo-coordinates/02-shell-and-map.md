# Part 2 — App shell and map (Tasks 6–11)

Read `README.md` first. Svelte 5 runes syntax only (`$props`, `$state`, `$derived`, `$effect`, `onclick=`); no legacy `export let` / `on:click`.

---

### Task 6: App shell — ids, router, settings, announcer, header, home

**Files:**
- Create: `src/app/ids.ts`, `src/app/router.ts`, `src/app/router.svelte.ts`, `src/app/settings.svelte.ts`, `src/app/announcer.svelte.ts`, `src/app/LiveRegion.svelte`, `src/app/Header.svelte`, `src/app/SettingsDialog.svelte`, `src/app/Home.svelte`, `src/app/Footer.svelte`, `src/app/credits.ts`
- Modify: `src/app/App.svelte` (replace), `src/i18n/{en,pl,uk}.json` (add keys), `geo-coordinates.html` (author meta)
- Test: `tests/unit/router.test.ts`, `tests/e2e/helpers.ts` (add axe helper), `tests/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `LANGS`, `LangCode` (Task 2); `i18n`, `t`, `setLang`, `initialLang` (Task 5); `readJSON`, `writeJSON` (Task 5).
- Produces:
  - `src/app/ids.ts`: `export type TopicId = 1|2|3|4|5|6|7|8; export const TOPIC_IDS: readonly TopicId[] = [1,2,3,4,5,6,7,8];` (`src/quiz/types.ts` in Task 13 re-exports `TopicId` from here.)
  - `router.ts`: `Route` union, `parseRoute(hash: string, fallbackLang: LangCode): Route`, `formatRoute(route: Route): string`
  - `router.svelte.ts`: `router: { route: Route }`, `startRouter(): () => void`, `navigate(route: Route, opts?: { replace?: boolean }): void`, `switchLang(lang: LangCode): void`
  - `settings.svelte.ts`: `Settings`, `settings` (state), `initSettings()`, `applySettings()`, `saveSettings()`, `motionReduced(): boolean`
  - `announcer.svelte.ts`: `liveRegion: { polite: string; assertive: string }`, `announce(message: string, politeness?: 'polite' | 'assertive'): void`, `announceThrottled(channel: string, message: string, intervalMs?: number): void`
  - `tests/e2e/helpers.ts`: `expectNoAxeViolations(page: Page, context?: string): Promise<void>`
  - Page convention: every page component renders exactly one `<h1 tabindex="-1">`; `App` focuses it on route changes (not on the first render, not on language-only or step-only changes).

- [ ] **Step 1: Router tests** `tests/unit/router.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { formatRoute, parseRoute, type Route } from '../../src/app/router';

describe('parseRoute', () => {
  test.each<[string, Route]>([
    ['', { name: 'home', lang: 'pl' }],
    ['#', { name: 'home', lang: 'pl' }],
    ['#en/', { name: 'home', lang: 'en' }],
    ['#uk', { name: 'home', lang: 'uk' }],
    ['#en/topic-3', { name: 'explore', lang: 'en', topic: 3, step: 0 }],
    ['#en/topic-3/explore', { name: 'explore', lang: 'en', topic: 3, step: 0 }],
    ['#pl/topic-8/explore/4', { name: 'explore', lang: 'pl', topic: 8, step: 3 }],
    ['#uk/topic-1/practice', { name: 'practice', lang: 'uk', topic: 1 }],
    ['#en/rehearsal', { name: 'rehearsal', lang: 'en' }],
    ['#en/lab', { name: 'lab', lang: 'en' }],
    ['#en/class-quiz', { name: 'class-quiz', lang: 'en', seed: null }],
    ['#en/class-quiz?seed=5b-A', { name: 'class-quiz', lang: 'en', seed: '5b-A' }],
    ['#en/class-quiz?seed=<script>', { name: 'class-quiz', lang: 'en', seed: null }],
    ['#topic-2/practice', { name: 'practice', lang: 'pl', topic: 2 }],
    ['#en/topic-9', { name: 'home', lang: 'en' }],
    ['#en/topic-2/explore/0', { name: 'home', lang: 'en' }],
    ['#en/nonsense/deep', { name: 'home', lang: 'en' }],
    ['#de/topic-1', { name: 'home', lang: 'pl' }],
  ])('%s', (hash, expected) => {
    expect(parseRoute(hash, 'pl')).toEqual(expected);
  });
});

describe('formatRoute', () => {
  test('round trips canonical forms', () => {
    for (const hash of ['#en/', '#pl/topic-3/explore', '#pl/topic-8/explore/4', '#uk/topic-1/practice', '#en/rehearsal', '#en/lab', '#en/class-quiz', '#en/class-quiz?seed=abc']) {
      expect(formatRoute(parseRoute(hash, 'en'))).toBe(hash);
    }
  });
});
```
(`#de/topic-1`: `de` is not a language, so it is treated as a path segment `de` → unknown → home with fallback language.)

- [ ] **Step 2: Run** `npx vitest run tests/unit/router.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/app/ids.ts` and `src/app/router.ts`**

```ts
// src/app/ids.ts
export type TopicId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const TOPIC_IDS: readonly TopicId[] = [1, 2, 3, 4, 5, 6, 7, 8];
```

```ts
// src/app/router.ts
import { LANGS, type LangCode } from '../geo/types';
import { TOPIC_IDS, type TopicId } from './ids';

export type Route =
  | { name: 'home'; lang: LangCode }
  | { name: 'explore'; lang: LangCode; topic: TopicId; step: number }
  | { name: 'practice'; lang: LangCode; topic: TopicId }
  | { name: 'rehearsal'; lang: LangCode }
  | { name: 'class-quiz'; lang: LangCode; seed: string | null }
  | { name: 'lab'; lang: LangCode };

export function parseRoute(hash: string, fallbackLang: LangCode): Route {
  const [pathPart = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const hasLang = (LANGS as readonly string[]).includes(parts[0] ?? '');
  const lang = hasLang ? (parts[0] as LangCode) : fallbackLang;
  const rest = hasLang ? parts.slice(1) : parts;
  const home: Route = { name: 'home', lang };
  if (rest.length === 0) return home;
  const [head, sub, stepRaw] = rest;
  if (rest.length === 1 && head === 'rehearsal') return { name: 'rehearsal', lang };
  if (rest.length === 1 && head === 'lab') return { name: 'lab', lang };
  if (rest.length === 1 && head === 'class-quiz') {
    const seed = new URLSearchParams(query).get('seed');
    return { name: 'class-quiz', lang, seed: seed && /^[\w-]{1,32}$/.test(seed) ? seed : null };
  }
  const m = /^topic-(\d)$/.exec(head ?? '');
  if (!m) return home;
  const n = Number(m[1]);
  if (!(TOPIC_IDS as readonly number[]).includes(n)) return home;
  const topic = n as TopicId;
  if (sub === undefined) return { name: 'explore', lang, topic, step: 0 };
  if (sub === 'practice' && rest.length === 2) return { name: 'practice', lang, topic };
  if (sub === 'explore' && rest.length <= 3) {
    if (stepRaw === undefined) return { name: 'explore', lang, topic, step: 0 };
    const s = Number(stepRaw);
    return Number.isInteger(s) && s >= 1 ? { name: 'explore', lang, topic, step: s - 1 } : home;
  }
  return home;
}

export function formatRoute(r: Route): string {
  switch (r.name) {
    case 'home': return `#${r.lang}/`;
    case 'explore': return `#${r.lang}/topic-${r.topic}/explore${r.step > 0 ? `/${r.step + 1}` : ''}`;
    case 'practice': return `#${r.lang}/topic-${r.topic}/practice`;
    case 'rehearsal': return `#${r.lang}/rehearsal`;
    case 'class-quiz': return `#${r.lang}/class-quiz${r.seed ? `?seed=${r.seed}` : ''}`;
    case 'lab': return `#${r.lang}/lab`;
  }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/router.test.ts` → PASS.

- [ ] **Step 5: Reactive modules**

`src/app/router.svelte.ts`:
```ts
import type { LangCode } from '../geo/types';
import { i18n, initialLang, setLang } from '../i18n/i18n.svelte';
import { formatRoute, parseRoute, type Route } from './router';

export const router = $state<{ route: Route }>({ route: { name: 'home', lang: 'en' } });

function sync(): void {
  const route = parseRoute(location.hash, i18n.lang);
  const canonical = formatRoute(route);
  if (location.hash !== canonical) history.replaceState(history.state, '', canonical);
  if (route.lang !== i18n.lang) setLang(route.lang);
  router.route = route;
}

export function startRouter(): () => void {
  setLang(initialLang());
  sync();
  window.addEventListener('hashchange', sync);
  return () => window.removeEventListener('hashchange', sync);
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const hash = formatRoute(route);
  if (opts.replace) { history.replaceState(history.state, '', hash); sync(); }
  else if (location.hash !== hash) location.hash = hash;
}

export function switchLang(lang: LangCode): void {
  navigate({ ...router.route, lang }, { replace: true });
}
```

`src/app/settings.svelte.ts`:
```ts
import { readJSON, writeJSON } from './storage';

export type Theme = 'system' | 'light' | 'dark';
export interface Settings { theme: Theme; largeText: boolean; reducedMotion: boolean }

const KEY = 'geo-coords:settings';
export const settings = $state<Settings>({ theme: 'system', largeText: false, reducedMotion: false });

function systemReducedMotion(): boolean {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function initSettings(): void {
  const s = readJSON<Partial<Settings>>(KEY, {});
  settings.theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system';
  settings.largeText = s.largeText === true;
  settings.reducedMotion = typeof s.reducedMotion === 'boolean' ? s.reducedMotion : systemReducedMotion();
}

export function applySettings(root: HTMLElement = document.documentElement): void {
  if (settings.theme === 'system') { delete root.dataset.theme; root.style.colorScheme = ''; }
  else { root.dataset.theme = settings.theme; root.style.colorScheme = settings.theme; }
  root.dataset.largeText = String(settings.largeText);
  root.dataset.reducedMotion = String(settings.reducedMotion);
}

export function saveSettings(): void {
  writeJSON(KEY, $state.snapshot(settings));
}

export function motionReduced(): boolean {
  return settings.reducedMotion || systemReducedMotion();
}
```

`src/app/announcer.svelte.ts`:
```ts
export const liveRegion = $state({ polite: '', assertive: '' });

const lastAt = new Map<string, number>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  liveRegion[politeness] = '';
  setTimeout(() => { liveRegion[politeness] = message; }, 30);
}

export function announceThrottled(channel: string, message: string, intervalMs = 500): void {
  const now = Date.now();
  const prev = lastAt.get(channel) ?? 0;
  clearTimeout(pending.get(channel));
  if (now - prev >= intervalMs) { lastAt.set(channel, now); announce(message); return; }
  pending.set(channel, setTimeout(() => { lastAt.set(channel, Date.now()); announce(message); }, intervalMs - (now - prev)));
}
```

`src/app/LiveRegion.svelte`:
```svelte
<script lang="ts">
  import { liveRegion } from './announcer.svelte';
</script>

<div class="visually-hidden" aria-live="polite" aria-atomic="true">{liveRegion.polite}</div>
<div class="visually-hidden" aria-live="assertive" aria-atomic="true">{liveRegion.assertive}</div>
```

- [ ] **Step 6: i18n keys.** Add to all three files (values given for every language):

| key | en | pl | uk |
|---|---|---|---|
| header.language | Language | Język | Мова |
| header.settings | Settings | Ustawienia | Налаштування |
| header.home | Home | Strona główna | Головна |
| settings.title | Settings | Ustawienia | Налаштування |
| settings.theme | Colour theme | Motyw kolorów | Колірна тема |
| settings.theme.system | Same as device | Jak w urządzeniu | Як на пристрої |
| settings.theme.light | Light | Jasny | Світла |
| settings.theme.dark | Dark | Ciemny | Темна |
| settings.largeText | Larger text | Większy tekst | Більший текст |
| settings.reducedMotion | Reduce motion | Ogranicz animacje | Менше анімації |
| settings.close | Close | Zamknij | Закрити |
| home.intro | Every place on Earth has its own address made of two numbers: latitude and longitude. Let's learn how to read it! | Każde miejsce na Ziemi ma swój adres z dwóch liczb: szerokości i długości geograficznej. Nauczmy się go czytać! | Кожне місце на Землі має свою адресу з двох чисел: широти й довготи. Навчімося її читати! |
| home.topics | Topics | Tematy | Теми |
| home.more | Test yourself and explore | Sprawdź się i odkrywaj | Перевір себе й досліджуй |
| home.explore | Learn | Poznaj | Вивчай |
| home.practice | Practise | Ćwicz | Тренуйся |
| topic.1.title | The globe grid | Siatka geograficzna | Градусна сітка |
| topic.1.summary | Meridians, parallels, the equator and hemispheres | Południki, równoleżniki, równik i półkule | Меридіани, паралелі, екватор і півкулі |
| topic.2.title | Where is it? | Gdzie to jest? | Де це? |
| topic.2.summary | North or south of a parallel, east or west of a meridian | Na północ czy na południe od równoleżnika, na wschód czy na zachód od południka | Північніше чи південніше паралелі, східніше чи західніше меридіана |
| topic.3.title | Reading coordinates | Odczytywanie współrzędnych | Визначення координат |
| topic.3.summary | Find the latitude and longitude of a point | Odczytaj szerokość i długość geograficzną punktu | Визнач широту й довготу точки |
| topic.4.title | Finding a place | Szukanie miejsca | Пошук місця |
| topic.4.summary | Put a point on the map from its coordinates | Zaznacz punkt na mapie według współrzędnych | Познач точку на карті за координатами |
| topic.5.title | Degrees and minutes | Stopnie i minuty | Градуси й хвилини |
| topic.5.summary | One degree has 60 minutes | Jeden stopień ma 60 minut | Один градус має 60 хвилин |
| topic.6.title | How many degrees apart? | Ile stopni różnicy? | На скільки градусів різниця? |
| topic.6.summary | Differences in latitude and longitude | Różnica szerokości i długości geograficznej | Різниця широт і довгот |
| topic.7.title | Distance along a meridian | Odległość wzdłuż południka | Відстань уздовж меридіана |
| topic.7.summary | One degree is about 111.2 km | Jeden stopień to około 111,2 km | Один градус — це приблизно 111,2 км |
| topic.8.title | Longitude and time | Długość geograficzna a czas | Довгота і час |
| topic.8.summary | Day, night and local solar time | Dzień, noc i czas słoneczny | День, ніч і місцевий сонячний час |
| mode.rehearsal.title | Test rehearsal | Próbny sprawdzian | Пробна контрольна |
| mode.rehearsal.summary | 15 mixed questions, like a real test | 15 różnych pytań, jak na prawdziwym sprawdzianie | 15 різних запитань, як на справжній контрольній |
| mode.classQuiz.title | Class quiz | Quiz dla klasy | Вікторина для класу |
| mode.classQuiz.summary | Big questions on the big screen for the whole class | Duże pytania na dużym ekranie dla całej klasy | Великі запитання на великому екрані для всього класу |
| mode.lab.title | Day and night lab | Laboratorium dnia i nocy | Лабораторія дня і ночі |
| mode.lab.summary | Move the Sun and watch the time change | Przesuwaj Słońce i patrz, jak zmienia się czas | Рухай Сонце й дивись, як змінюється час |
| footer.madeBy | Made by {name} | Autor: {name} | Автор: {name} |
| footer.mapData | Map data: {source} | Dane mapy: {source} | Дані карти: {source} |
| footer.label | About this page | O tej stronie | Про цю сторінку |

- [ ] **Step 7: Components**

`src/app/App.svelte` (replaces the placeholder; later tasks add route branches in the marked `{#if}` chain):
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import Home from './Home.svelte';
  import Footer from './Footer.svelte';
  import LiveRegion from './LiveRegion.svelte';
  import { router, startRouter } from './router.svelte';
  import { applySettings, initSettings, saveSettings, settings } from './settings.svelte';
  import { t } from '../i18n/i18n.svelte';

  initSettings();
  onMount(() => startRouter());

  $effect(() => {
    void settings.theme; void settings.largeText; void settings.reducedMotion;
    applySettings();
    saveSettings();
  });
  $effect(() => { document.title = t('app.title'); });

  let main: HTMLElement;
  const route = $derived(router.route);
  const focusKey = $derived(`${route.name}:${'topic' in route ? route.topic : ''}`);
  let previousKey: string | null = null;
  $effect(() => {
    const key = focusKey;
    if (previousKey !== null && previousKey !== key) {
      queueMicrotask(() => main?.querySelector<HTMLElement>('h1')?.focus());
    }
    previousKey = key;
  });

  function skip(e: MouseEvent) {
    e.preventDefault();
    main.querySelector<HTMLElement>('h1')?.focus();
  }
</script>

<a class="skip" href="#main" onclick={skip}>{t('app.skip')}</a>
<Header />
<main id="main" bind:this={main}>
  {#if route.name === 'home'}
    <Home />
  {:else}
    <Home />
  {/if}
</main>
<Footer />
<LiveRegion />

<style>
  .skip { position: absolute; left: var(--space-2); top: -100px; z-index: 100; background: var(--surface); color: var(--text); padding: var(--space-3) var(--space-4); border-radius: var(--radius); border: 2px solid var(--focus); }
  .skip:focus { top: var(--space-2); }
  main { padding: var(--space-4); max-width: 1600px; margin-inline: auto; }
  @media (max-width: 599px) { main { padding: var(--space-2); } }
</style>
```

`src/app/Header.svelte`:
```svelte
<script lang="ts">
  import { LANGS, type LangCode } from '../geo/types';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { formatRoute } from './router';
  import { switchLang } from './router.svelte';
  import SettingsDialog from './SettingsDialog.svelte';

  const NAMES: Record<LangCode, string> = { en: 'English', pl: 'Polski', uk: 'Українська' };
  const SHORT: Record<LangCode, string> = { en: 'EN', pl: 'PL', uk: 'УК' };
  let settingsOpen = $state(false);
</script>

<header class="bar">
  <a class="brand" href={formatRoute({ name: 'home', lang: i18n.lang })}>
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M2 12h20M4 7h16M4 17h16" stroke="currentColor" stroke-width="1.5" />
    </svg>
    <span>{t('app.title')}</span>
  </a>
  <div class="actions">
    <div class="langs" role="group" aria-label={t('header.language')}>
      {#each LANGS as l (l)}
        <button type="button" lang={l} aria-pressed={i18n.lang === l} onclick={() => switchLang(l)}>
          <span aria-hidden="true">{SHORT[l]}</span><span class="visually-hidden">{SHORT[l]} – {NAMES[l]}</span>
        </button>
      {/each}
    </div>
    <button type="button" class="icon-btn" aria-haspopup="dialog" onclick={() => (settingsOpen = true)}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4L10.7 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>
      <span class="label">{t('header.settings')}</span>
    </button>
  </div>
</header>
<SettingsDialog bind:open={settingsOpen} />

<style>
  .bar { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-4); background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
  .brand { display: inline-flex; gap: var(--space-2); align-items: center; color: var(--text); text-decoration: none; font-weight: 700; font-size: 1.15rem; min-height: var(--tap); }
  .actions { display: flex; gap: var(--space-2); align-items: center; }
  .langs { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .langs button { border: 0; background: transparent; padding: 0 var(--space-3); font-weight: 600; }
  .langs button[aria-pressed='true'] { background: var(--accent); color: var(--accent-contrast); }
  .icon-btn { display: inline-flex; gap: var(--space-2); align-items: center; background: transparent; border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-3); }
  @media (max-width: 599px) { .icon-btn .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); } .brand span { font-size: 1rem; } }
</style>
```

`src/app/SettingsDialog.svelte`:
```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { settings, type Theme } from './settings.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dialog: HTMLDialogElement;
  const THEMES: Theme[] = ['system', 'light', 'dark'];

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} aria-labelledby="settings-title" onclose={() => (open = false)}>
  <h2 id="settings-title">{t('settings.title')}</h2>
  <fieldset>
    <legend>{t('settings.theme')}</legend>
    {#each THEMES as theme (theme)}
      <label class="row"><input type="radio" name="theme" value={theme} bind:group={settings.theme} /> {t(`settings.theme.${theme}`)}</label>
    {/each}
  </fieldset>
  <label class="row"><input type="checkbox" bind:checked={settings.largeText} /> {t('settings.largeText')}</label>
  <label class="row"><input type="checkbox" bind:checked={settings.reducedMotion} /> {t('settings.reducedMotion')}</label>
  <form method="dialog"><button class="primary">{t('settings.close')}</button></form>
</dialog>

<style>
  dialog { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); padding: var(--space-6); width: min(26rem, calc(100vw - 2rem)); }
  dialog::backdrop { background: rgb(0 0 0 / 0.45); }
  fieldset { border: 1px solid var(--border); border-radius: var(--radius); margin: 0 0 var(--space-4); }
  .row { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap); }
  .row input { width: 1.25rem; height: 1.25rem; }
  .primary { margin-top: var(--space-4); background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 0 var(--space-6); font-weight: 600; }
</style>
```

`src/app/Home.svelte`:
```svelte
<script lang="ts">
  import { i18n, t } from '../i18n/i18n.svelte';
  import { TOPIC_IDS } from './ids';
  import { formatRoute } from './router';

  const modes = [
    { key: 'rehearsal', route: 'rehearsal' },
    { key: 'classQuiz', route: 'class-quiz' },
    { key: 'lab', route: 'lab' },
  ] as const;
</script>

<h1 tabindex="-1">{t('app.title')}</h1>
<p class="intro">{t('home.intro')}</p>

<h2>{t('home.topics')}</h2>
<ol class="cards">
  {#each TOPIC_IDS as id (id)}
    <li class="card">
      <span class="num" aria-hidden="true">{id}</span>
      <h3><a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: id, step: 0 })}>{t(`topic.${id}.title`)}</a></h3>
      <p>{t(`topic.${id}.summary`)}</p>
      <a class="secondary" href={formatRoute({ name: 'practice', lang: i18n.lang, topic: id })}>{t('home.practice')}<span class="visually-hidden">: {t(`topic.${id}.title`)}</span></a>
    </li>
  {/each}
</ol>

<h2>{t('home.more')}</h2>
<ul class="cards">
  {#each modes as m (m.key)}
    <li class="card">
      <h3>
        {#if m.route === 'class-quiz'}
          <a href={formatRoute({ name: 'class-quiz', lang: i18n.lang, seed: null })}>{t(`mode.${m.key}.title`)}</a>
        {:else}
          <a href={formatRoute({ name: m.route, lang: i18n.lang })}>{t(`mode.${m.key}.title`)}</a>
        {/if}
      </h3>
      <p>{t(`mode.${m.key}.summary`)}</p>
    </li>
  {/each}
</ul>

<style>
  h1 { font-size: clamp(1.6rem, 1.2rem + 2vw, 2.6rem); margin: var(--space-4) 0 var(--space-2); }
  .intro { font-size: 1.15rem; max-width: 60ch; color: var(--text-muted); }
  .cards { list-style: none; padding: 0; display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); }
  .card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4); padding-left: 3.75rem; }
  .card h3 { margin: 0 0 var(--space-1); font-size: 1.15rem; }
  .card h3 a { color: var(--text); text-decoration: none; }
  .card h3 a::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius); }
  .card h3 a:focus-visible { outline: none; }
  .card:has(h3 a:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .card p { margin: 0 0 var(--space-2); color: var(--text-muted); }
  .num { position: absolute; left: var(--space-4); top: var(--space-4); width: 2.25rem; height: 2.25rem; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-contrast); font-weight: 700; }
  ul.cards .card { padding-left: var(--space-4); }
  .secondary { position: relative; z-index: 1; display: inline-flex; align-items: center; min-height: var(--tap); color: var(--accent); font-weight: 600; }
</style>
```

**Attribution (the page will be published on GitHub Pages).** `src/app/credits.ts` is the single place holding author data, so a link can be added later without touching components:
```ts
export const AUTHOR = { name: 'Yurii Serhiichuk', url: null as string | null };
export const MAP_DATA = { name: 'Natural Earth', url: 'https://www.naturalearthdata.com/' };
```
`src/app/Footer.svelte`:
```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { AUTHOR, MAP_DATA } from './credits';
  const year = new Date().getFullYear();
</script>

<footer aria-label={t('footer.label')}>
  <p>
    {#if AUTHOR.url}
      © {year} <a href={AUTHOR.url} rel="author">{t('footer.madeBy', { name: AUTHOR.name })}</a>
    {:else}
      © {year} {t('footer.madeBy', { name: AUTHOR.name })}
    {/if}
    <span aria-hidden="true"> · </span>
    {t('footer.mapData', { source: '' })}<a href={MAP_DATA.url} rel="noopener">{MAP_DATA.name}</a>
  </p>
</footer>

<style>
  footer { border-top: 1px solid var(--border); margin-top: var(--space-8); padding: var(--space-4); color: var(--text-muted); text-align: center; font-size: 0.95rem; }
  footer p { margin: 0; }
  footer a { color: inherit; display: inline-flex; align-items: center; min-height: var(--tap); }
</style>
```
(`footer.mapData` renders "Map data: " with an empty `{source}` followed by the link — keep the `{source}` param at the end of the string in all languages.) Links in the footer are the only external links on the page; they are ordinary navigations, not runtime requests, so the no-network constraint holds. In `geo-coordinates.html` add `<meta name="author" content="Yurii Serhiichuk" />` after the viewport meta. Presenter mode (Task 18) hides the footer: `:root[data-presenter="true"] footer { display: none; }`.

- [ ] **Step 8: E2E — axe helper and shell spec**

Append to `tests/e2e/helpers.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

export async function expectNoAxeViolations(page: Page, context = ''): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`);
  expect(summary, `axe violations ${context}`).toEqual([]);
}
```
(Move the new imports to the top of the file.)

`tests/e2e/shell.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  test(`home renders in ${lang} with no axe violations`, async ({ page }) => {
    await openPage(page, `${lang}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('ol.cards > li')).toHaveCount(8);
    await expectNoAxeViolations(page, lang);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('language switch updates lang, hash and text', async ({ page }) => {
  await openPage(page, 'en/');
  await page.getByRole('button', { name: /PL/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page).toHaveURL(/#pl\/$/);
  await expect(page.locator('h1')).toHaveText('Współrzędne na kuli ziemskiej');
});

test('footer credits the author and the map data', async ({ page }) => {
  await openPage(page, 'pl/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Autor: Yurii Serhiichuk');
  await expect(footer.getByRole('link', { name: 'Natural Earth' })).toHaveAttribute('href', 'https://www.naturalearthdata.com/');
  await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Yurii Serhiichuk');
});

test('unknown route falls back to home', async ({ page }) => {
  await openPage(page, 'en/nope/nope');
  await expect(page).toHaveURL(/#en\/$/);
});

test('settings dialog switches theme and is keyboard operable', async ({ page }) => {
  await openPage(page, 'en/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoAxeViolations(page, 'dark settings');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'uk/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

- [ ] **Step 9: Run everything**

Run: `npm run check && npm test && npm run build && npm run e2e`
Expected: all pass. Fix contrast or labelling issues axe reports in the components (not by disabling rules).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(app): shell with hash router, language switch, settings dialog, home page"
```

---

### Task 7: Map types, world data, places and MapState

**Files:**
- Create: `src/map/types.ts`, `src/map/world.ts`, `src/map/places.ts`, `src/map/mapState.svelte.ts`
- Modify: `src/i18n/{en,pl,uk}.json` (place and label names)
- Test: `tests/unit/mapState.test.ts`, `tests/unit/places.test.ts`

**Interfaces:**
- Consumes: `LatLon`, `Precision` (Task 2); `clampLat`, `normalizeLon`, `roundTo` (Task 2).
- Produces:
  - `src/map/types.ts`: the README block (already includes `LayerFlags.pointGuides`, `graticuleStep: 1` for minute questions, `SceneSpec.showReadout` — default `true`, `false` hides readout and sliders so reading questions do not reveal the answer — and `SceneSpec.flatView`, which overrides `flatPreset` with an explicit centre and zoom).
  - `world.ts`: `land: GeoJSON.Feature | GeoJSON.FeatureCollection`, `borders: GeoJSON.MultiLineString`, `sphere: { type: 'Sphere' }`
  - `places.ts`: `interface Place { id: string; lat: number; lon: number; kind: 'city' | 'pole'; featured: boolean }`, `PLACES: readonly Place[]`, `placeById(id: string): Place`, `interface MapLabel { id: string; lat: number; lon: number; kind: 'continent' | 'ocean' }`, `MAP_LABELS: readonly MapLabel[]`
  - `mapState.svelte.ts`: `DEFAULT_LAYERS: LayerFlags`, `FLAT_PRESETS: Record<FlatPreset, { center: LatLon; zoom: number }>`, `class MapState` with fields `views`, `layers`, `point`, `pointEditable`, `precision`, `showReadout`, `rotate`, `flat`, `overlays`, `sun`, `labControls`, `phoneView`, `lastChange` and methods `applyScene(scene: SceneSpec): void`, `setPoint(p: LatLon, source?: ChangeSource): void`, `userSetPoint(p: LatLon, source: 'map' | 'slider'): boolean`, `nudge(dLat: number, dLon: number, source: 'map' | 'slider'): boolean`, `stepSize(big: boolean): number`, `addOverlays(o: Overlay[]): void`, `centerGlobeOn(p: LatLon): void`, `setFlatPreset(p: FlatPreset): void`, `zoomFlat(factor: number): void`, `panFlat(dLat: number, dLon: number): void`; `type ChangeSource = 'map' | 'slider' | 'program'`; singleton `export const mapState = new MapState()`.

- [ ] **Step 1: `src/map/types.ts`** — copy the README `src/map/types.ts` block; `LayerFlags` and `SceneSpec` must read exactly:

```ts
export interface LayerFlags {
  graticuleStep: 1 | 5 | 10 | 15 | 30;
  specialLines: boolean;
  tropics: boolean;
  hemispheres: 'none' | 'ns' | 'ew';
  places: boolean;
  borders: boolean;
  daylight: boolean;
  pointGuides: boolean;
}
export interface SceneSpec {
  views: ViewId[];
  layers?: Partial<LayerFlags>;
  point?: LatLon | null;
  pointEditable?: boolean;
  precision?: Precision;
  showReadout?: boolean;
  rotate?: [number, number];
  flatPreset?: FlatPreset;
  flatView?: { center: LatLon; zoom: number };
  overlays?: Overlay[];
  sun?: { utcMinutes: number; dayOfYear: number } | null;
  labControls?: LabControl[];
}
```

- [ ] **Step 2: `src/map/world.ts`**

```ts
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import topoJson from 'world-atlas/countries-110m.json';

const topo = topoJson as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;

export const land = feature(topo, topo.objects.land);
export const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
export const sphere = { type: 'Sphere' } as const;
```
If `topojson-specification` types are not resolvable, `npm i -D @types/topojson-specification`.

- [ ] **Step 3: `src/map/places.ts`**

```ts
export interface Place { id: string; lat: number; lon: number; kind: 'city' | 'pole'; featured: boolean }
export interface MapLabel { id: string; lat: number; lon: number; kind: 'continent' | 'ocean' }

const p = (id: string, lat: number, lon: number, featured = false, kind: Place['kind'] = 'city'): Place => ({ id, lat, lon, kind, featured });

export const PLACES: readonly Place[] = [
  p('warsaw', 52.23, 21.01, true), p('krakow', 50.06, 19.94), p('gdansk', 54.35, 18.65), p('wroclaw', 51.11, 17.03), p('poznan', 52.41, 16.93),
  p('kyiv', 50.45, 30.52, true), p('lviv', 49.84, 24.03), p('odesa', 46.48, 30.72), p('kharkiv', 49.99, 36.23),
  p('london', 51.51, -0.13, true), p('paris', 48.86, 2.35), p('berlin', 52.52, 13.4), p('rome', 41.9, 12.5), p('madrid', 40.42, -3.7),
  p('reykjavik', 64.15, -21.94), p('oslo', 59.91, 10.75), p('istanbul', 41.01, 28.98),
  p('cairo', 30.04, 31.24, true), p('nairobi', -1.29, 36.82), p('capetown', -33.92, 18.42, true), p('lagos', 6.52, 3.38), p('dakar', 14.72, -17.47),
  p('newyork', 40.71, -74.01, true), p('losangeles', 34.05, -118.24), p('mexicocity', 19.43, -99.13), p('anchorage', 61.22, -149.9), p('honolulu', 21.31, -157.86),
  p('rio', -22.91, -43.17, true), p('buenosaires', -34.6, -58.38, true), p('lima', -12.05, -77.04), p('quito', -0.18, -78.47),
  p('tokyo', 35.68, 139.69, true), p('beijing', 39.9, 116.4), p('delhi', 28.61, 77.21, true), p('singapore', 1.35, 103.82), p('jakarta', -6.21, 106.85), p('dubai', 25.2, 55.27),
  p('sydney', -33.87, 151.21, true), p('auckland', -36.85, 174.76), p('suva', -18.14, 178.44),
  p('northpole', 90, 0, false, 'pole'), p('southpole', -90, 0, false, 'pole'),
];

export function placeById(id: string): Place {
  const place = PLACES.find((x) => x.id === id);
  if (!place) throw new Error(`Unknown place ${id}`);
  return place;
}

export const MAP_LABELS: readonly MapLabel[] = [
  { id: 'europe', lat: 47, lon: 8, kind: 'continent' }, { id: 'asia', lat: 50, lon: 90, kind: 'continent' },
  { id: 'africa', lat: 8, lon: 20, kind: 'continent' }, { id: 'northamerica', lat: 45, lon: -100, kind: 'continent' },
  { id: 'southamerica', lat: -12, lon: -58, kind: 'continent' }, { id: 'australia', lat: -25, lon: 134, kind: 'continent' },
  { id: 'antarctica', lat: -80, lon: 20, kind: 'continent' },
  { id: 'pacific', lat: -10, lon: -140, kind: 'ocean' }, { id: 'atlantic', lat: 25, lon: -40, kind: 'ocean' },
  { id: 'indian', lat: -20, lon: 80, kind: 'ocean' }, { id: 'arctic', lat: 82, lon: 0, kind: 'ocean' },
];
```

- [ ] **Step 4: Names in i18n files** — keys `place.<id>` and `label.<id>`:

| id | en | pl | uk |
|---|---|---|---|
| warsaw | Warsaw | Warszawa | Варшава |
| krakow | Kraków | Kraków | Краків |
| gdansk | Gdańsk | Gdańsk | Гданськ |
| wroclaw | Wrocław | Wrocław | Вроцлав |
| poznan | Poznań | Poznań | Познань |
| kyiv | Kyiv | Kijów | Київ |
| lviv | Lviv | Lwów | Львів |
| odesa | Odesa | Odessa | Одеса |
| kharkiv | Kharkiv | Charków | Харків |
| london | London | Londyn | Лондон |
| paris | Paris | Paryż | Париж |
| berlin | Berlin | Berlin | Берлін |
| rome | Rome | Rzym | Рим |
| madrid | Madrid | Madryt | Мадрид |
| reykjavik | Reykjavík | Reykjavík | Рейк'явік |
| oslo | Oslo | Oslo | Осло |
| istanbul | Istanbul | Stambuł | Стамбул |
| cairo | Cairo | Kair | Каїр |
| nairobi | Nairobi | Nairobi | Найробі |
| capetown | Cape Town | Kapsztad | Кейптаун |
| lagos | Lagos | Lagos | Лагос |
| dakar | Dakar | Dakar | Дакар |
| newyork | New York | Nowy Jork | Нью-Йорк |
| losangeles | Los Angeles | Los Angeles | Лос-Анджелес |
| mexicocity | Mexico City | Meksyk | Мехіко |
| anchorage | Anchorage | Anchorage | Анкоридж |
| honolulu | Honolulu | Honolulu | Гонолулу |
| rio | Rio de Janeiro | Rio de Janeiro | Ріо-де-Жанейро |
| buenosaires | Buenos Aires | Buenos Aires | Буенос-Айрес |
| lima | Lima | Lima | Ліма |
| quito | Quito | Quito | Кіто |
| tokyo | Tokyo | Tokio | Токіо |
| beijing | Beijing | Pekin | Пекін |
| delhi | Delhi | Delhi | Делі |
| singapore | Singapore | Singapur | Сінгапур |
| jakarta | Jakarta | Dżakarta | Джакарта |
| dubai | Dubai | Dubaj | Дубай |
| sydney | Sydney | Sydney | Сідней |
| auckland | Auckland | Auckland | Окленд |
| suva | Suva (Fiji) | Suva (Fidżi) | Сува (Фіджі) |
| northpole | North Pole | Biegun Północny | Північний полюс |
| southpole | South Pole | Biegun Południowy | Південний полюс |
| label.europe | Europe | Europa | Європа |
| label.asia | Asia | Azja | Азія |
| label.africa | Africa | Afryka | Африка |
| label.northamerica | North America | Ameryka Północna | Північна Америка |
| label.southamerica | South America | Ameryka Południowa | Південна Америка |
| label.australia | Australia | Australia | Австралія |
| label.antarctica | Antarctica | Antarktyda | Антарктида |
| label.pacific | Pacific Ocean | Ocean Spokojny | Тихий океан |
| label.atlantic | Atlantic Ocean | Ocean Atlantycki | Атлантичний океан |
| label.indian | Indian Ocean | Ocean Indyjski | Індійський океан |
| label.arctic | Arctic Ocean | Ocean Arktyczny | Північний Льодовитий океан |

(Rows without a `label.` prefix are `place.<id>` keys.)

- [ ] **Step 5: Failing tests**

`tests/unit/places.test.ts`:
```ts
import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import { MAP_LABELS, PLACES, placeById } from '../../src/map/places';

test('ids unique, coordinates in range, names exist', () => {
  const ids = new Set<string>();
  for (const p of PLACES) {
    expect(ids.has(p.id)).toBe(false); ids.add(p.id);
    expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
    expect(p.lon).toBeGreaterThan(-180); expect(p.lon).toBeLessThanOrEqual(180);
    expect(en).toHaveProperty(`place.${p.id}`);
  }
  for (const l of MAP_LABELS) expect(en).toHaveProperty(`label.${l.id}`);
  expect(PLACES.filter((p) => p.featured).length).toBeGreaterThanOrEqual(8);
});

test('placeById throws on unknown', () => {
  expect(placeById('warsaw').lat).toBe(52.23);
  expect(() => placeById('atlantis')).toThrow();
});
```

`tests/unit/mapState.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { DEFAULT_LAYERS, MapState } from '../../src/map/mapState.svelte';

describe('MapState', () => {
  test('applyScene fills defaults', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], layers: { tropics: true }, point: { lat: 10, lon: 20 } });
    expect(s.views).toEqual(['flat']);
    expect(s.layers).toEqual({ ...DEFAULT_LAYERS, tropics: true });
    expect(s.point).toEqual({ lat: 10, lon: 20 });
    expect(s.pointEditable).toBe(false);
    expect(s.precision).toBe('degree');
    expect(s.showReadout).toBe(true);
    expect(s.overlays).toEqual([]);
    expect(s.phoneView).toBe('flat');
    expect(s.rotate).toEqual([-20, -10]);
  });
  test('flatView overrides preset and is clamped', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], flatPreset: 'europe', flatView: { center: { lat: 89, lon: 21 }, zoom: 6 } });
    expect(s.flat.zoom).toBe(6);
    expect(s.flat.center).toEqual({ lat: 75, lon: 21 });
  });
  test('scene without point hides it; globe first becomes phone view', () => {
    const s = new MapState();
    s.applyScene({ views: ['globe', 'cross-section'] });
    expect(s.point).toBeNull();
    expect(s.phoneView).toBe('globe');
  });
  test('setPoint snaps, clamps and normalizes', () => {
    const s = new MapState();
    s.setPoint({ lat: 95.4, lon: 190.6 });
    expect(s.point).toEqual({ lat: 90, lon: -169 });
    s.precision = 'minute';
    s.setPoint({ lat: 52.2334, lon: 21.0 });
    expect(s.point!.lat).toBeCloseTo(52 + 14 / 60, 9);
  });
  test('userSetPoint respects editability and records source', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], point: { lat: 0, lon: 0 }, pointEditable: false });
    expect(s.userSetPoint({ lat: 5, lon: 5 }, 'map')).toBe(false);
    expect(s.point).toEqual({ lat: 0, lon: 0 });
    s.pointEditable = true;
    expect(s.userSetPoint({ lat: 5, lon: 5 }, 'map')).toBe(true);
    expect(s.lastChange).toBe('map');
  });
  test('nudge and step sizes', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], point: { lat: 89, lon: 179 }, pointEditable: true });
    expect(s.stepSize(false)).toBe(1); expect(s.stepSize(true)).toBe(10);
    s.nudge(s.stepSize(true), s.stepSize(false), 'slider');
    expect(s.point).toEqual({ lat: 90, lon: 180 });
    s.nudge(0, 1, 'slider');
    expect(s.point).toEqual({ lat: 90, lon: -179 });
    s.precision = 'minute';
    expect(s.stepSize(false)).toBeCloseTo(1 / 60, 12); expect(s.stepSize(true)).toBe(1);
  });
  test('flat zoom clamps and pan keeps the view inside the world', () => {
    const s = new MapState();
    s.zoomFlat(100);
    expect(s.flat.zoom).toBe(12);
    s.zoomFlat(0.001);
    expect(s.flat.zoom).toBe(1);
    expect(s.flat.center).toEqual({ lat: 0, lon: 0 });
    s.zoomFlat(2);
    s.panFlat(80, 0);
    expect(s.flat.center.lat).toBe(45); // half-height at zoom 2 is 45°
  });
});
```

- [ ] **Step 6: Run** `npx vitest run tests/unit/mapState.test.ts tests/unit/places.test.ts` → FAIL.

- [ ] **Step 7: Implement `src/map/mapState.svelte.ts`**

```ts
import { clampLat, normalizeLon, roundTo } from '../geo/format';
import type { LatLon, Precision } from '../geo/types';
import type { FlatPreset, LabControl, LayerFlags, Overlay, SceneSpec, ViewId } from './types';

export type ChangeSource = 'map' | 'slider' | 'program';

export const DEFAULT_LAYERS: LayerFlags = {
  graticuleStep: 10, specialLines: true, tropics: false, hemispheres: 'none',
  places: true, borders: true, daylight: false, pointGuides: true,
};

export const FLAT_PRESETS: Record<FlatPreset, { center: LatLon; zoom: number }> = {
  world: { center: { lat: 0, lon: 0 }, zoom: 1 },
  europe: { center: { lat: 52, lon: 15 }, zoom: 3.5 },
  poland: { center: { lat: 52, lon: 19 }, zoom: 9 },
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

export class MapState {
  views = $state<ViewId[]>(['globe', 'flat']);
  layers = $state<LayerFlags>({ ...DEFAULT_LAYERS });
  point = $state<LatLon | null>({ lat: 52, lon: 21 });
  pointEditable = $state(true);
  precision = $state<Precision>('degree');
  showReadout = $state(true);
  rotate = $state<[number, number]>([-21, -30]);
  flat = $state<{ center: LatLon; zoom: number }>({ center: { lat: 0, lon: 0 }, zoom: 1 });
  overlays = $state<Overlay[]>([]);
  sun = $state<{ utcMinutes: number; dayOfYear: number; year: number } | null>(null);
  labControls = $state<LabControl[]>([]);
  phoneView = $state<ViewId>('flat');
  lastChange = $state<ChangeSource>('program');

  applyScene(scene: SceneSpec): void {
    this.views = [...scene.views];
    this.layers = { ...DEFAULT_LAYERS, ...scene.layers };
    this.precision = scene.precision ?? 'degree';
    this.pointEditable = scene.pointEditable ?? false;
    this.showReadout = scene.showReadout ?? true;
    this.point = null;
    if (scene.point) this.setPoint(scene.point, 'program');
    const p = this.point as LatLon | null;
    this.rotate = scene.rotate ? [...scene.rotate] : p ? [-p.lon, -Math.max(-60, Math.min(60, p.lat))] : [0, -20];
    const view = scene.flatView ?? FLAT_PRESETS[scene.flatPreset ?? 'world'];
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom));
    this.flat = { zoom, center: this.clampCenter(view.center, zoom) };
    this.overlays = [...(scene.overlays ?? [])];
    this.sun = scene.sun ? { ...scene.sun, year: new Date().getUTCFullYear() } : null;
    this.labControls = [...(scene.labControls ?? [])];
    this.phoneView = scene.views.includes('flat') ? 'flat' : (scene.views[0] ?? 'flat');
    this.lastChange = 'program';
  }

  setPoint(p: LatLon, source: ChangeSource = 'program'): void {
    this.point = { lat: clampLat(roundTo(p.lat, this.precision)), lon: normalizeLon(roundTo(p.lon, this.precision)) };
    this.lastChange = source;
  }

  userSetPoint(p: LatLon, source: 'map' | 'slider'): boolean {
    if (!this.pointEditable) return false;
    this.setPoint(p, source);
    return true;
  }

  stepSize(big: boolean): number {
    if (this.precision === 'minute') return big ? 1 : 1 / 60;
    return big ? 10 : 1;
  }

  nudge(dLat: number, dLon: number, source: 'map' | 'slider'): boolean {
    const cur = this.point ?? { lat: 0, lon: 0 };
    return this.userSetPoint({ lat: cur.lat + dLat, lon: cur.lon + dLon }, source);
  }

  addOverlays(o: Overlay[]): void {
    this.overlays = [...this.overlays, ...o];
  }

  centerGlobeOn(p: LatLon): void {
    this.rotate = [-p.lon, -Math.max(-60, Math.min(60, p.lat))];
  }

  setFlatPreset(preset: FlatPreset): void {
    const v = FLAT_PRESETS[preset];
    this.flat = { center: { ...v.center }, zoom: v.zoom };
  }

  zoomFlat(factor: number): void {
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.flat.zoom * factor));
    this.flat = { zoom, center: this.clampCenter(this.flat.center, zoom) };
  }

  panFlat(dLat: number, dLon: number): void {
    const c = this.flat.center;
    this.flat = { zoom: this.flat.zoom, center: this.clampCenter({ lat: c.lat + dLat, lon: c.lon + dLon }, this.flat.zoom) };
  }

  private clampCenter(c: LatLon, zoom: number): LatLon {
    const halfLat = 90 / zoom;
    const halfLon = 180 / zoom;
    return {
      lat: Math.max(-90 + halfLat, Math.min(90 - halfLat, c.lat)),
      lon: Math.max(-180 + halfLon, Math.min(180 - halfLon, c.lon)),
    };
  }
}

export const mapState = new MapState();
```
Note the nudge test expects `lat 89 + 10 → 90` (clamped) and `lon 179 + 1 → 180`, then `180 + 1 → -179` (normalized).

- [ ] **Step 8: Run tests** → PASS. `npm run check && npm test`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(map): scene types, world data, places and MapState"
```

---

### Task 8: View geometry, shared layers and the flat map

**Files:**
- Create: `src/map/geometry.ts`, `src/map/layers/Layers.svelte`, `src/map/layers/Land.svelte`, `src/map/layers/Graticule.svelte`, `src/map/layers/SpecialLines.svelte`, `src/map/layers/Hemispheres.svelte`, `src/map/layers/Places.svelte`, `src/map/layers/EdgeLabels.svelte`, `src/map/layers/PointMarker.svelte`, `src/map/layers/Overlays.svelte`, `src/map/FlatMap.svelte`
- Modify: `src/i18n/{en,pl,uk}.json`
- Test: `tests/unit/geometry.test.ts`

**Interfaces:**
- Consumes: `mapState`, `LayerFlags`, `Overlay` (Task 7); `land`, `borders`, `sphere`, `PLACES`, `MAP_LABELS` (Task 7); `formatLat`, `formatLon` (Task 2); `t`, `i18n` (Task 5); `settings` (Task 6).
- Produces:
  - `geometry.ts`:
    ```ts
    export interface ViewCtx {
      kind: 'flat' | 'globe';
      width: number; height: number;
      projection: GeoProjection;
      path: GeoPath;
      px: number;                                    // viewBox units per CSS pixel (includes UI scale)
      isVisible(p: LatLon): boolean;
      project(p: LatLon): [number, number] | null;   // null when hidden (globe back side)
      invert(xy: [number, number]): LatLon | null;
    }
    export const TROPIC = 23.44; export const POLAR = 66.56;
    export function parallelLine(lat: number, step?: number): GeoJSON.LineString;
    export function meridianLine(lon: number, step?: number, fromLat?: number, toLat?: number): GeoJSON.LineString;
    export function hemisphere(region: 'N' | 'S' | 'E' | 'W'): GeoJSON.Polygon;
    export function makeFlatCtx(width: number, height: number, center: LatLon, zoom: number, px: number): ViewCtx;
    export function makeGlobeCtx(size: number, rotate: [number, number], px: number): ViewCtx;
    ```
  - `Layers.svelte` props `{ ctx: ViewCtx; idPrefix: string }` — renders every layer in order: ocean/sphere, hemispheres, land, borders, graticule, special lines (+ tropics), [daylight slot added in Task 17], place labels, map labels, edge labels (flat only), overlays, point marker. Every layer component takes `{ ctx: ViewCtx }` (plus `idPrefix` where SVG ids are needed).
  - `FlatMap.svelte` (no props) — reads/writes `mapState`.
  - Point handle element carries `data-point-handle` (used by pointer logic in FlatMap and Globe).

- [ ] **Step 1: Failing test** `tests/unit/geometry.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { hemisphere, makeFlatCtx, makeGlobeCtx, meridianLine, parallelLine } from '../../src/map/geometry';

describe('flat ctx', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1);
  test('projects corners and centre', () => {
    expect(ctx.project({ lat: 0, lon: 0 })).toEqual([480, 240]);
    const [x, y] = ctx.project({ lat: 90, lon: -180 })!;
    expect(x).toBeCloseTo(0, 6); expect(y).toBeCloseTo(0, 6);
  });
  test('invert round-trips and rejects outside', () => {
    const ll = ctx.invert([720, 120])!;
    expect(ll.lon).toBeCloseTo(90, 6); expect(ll.lat).toBeCloseTo(45, 6);
    expect(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1).invert([-50, 10])).toBeNull();
  });
  test('zoom centres the view', () => {
    const z = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 9, 1);
    const [x, y] = z.project({ lat: 52, lon: 19 })!;
    expect(x).toBeCloseTo(480, 6); expect(y).toBeCloseTo(240, 6);
  });
});

describe('globe ctx', () => {
  const ctx = makeGlobeCtx(500, [-21, -52], 1);
  test('front and back visibility', () => {
    expect(ctx.isVisible({ lat: 52, lon: 21 })).toBe(true);
    expect(ctx.isVisible({ lat: -52, lon: -159 })).toBe(false);
    expect(ctx.project({ lat: -52, lon: -159 })).toBeNull();
  });
  test('centre of view projects to the middle', () => {
    const [x, y] = ctx.project({ lat: 52, lon: 21 })!;
    expect(x).toBeCloseTo(250, 6); expect(y).toBeCloseTo(250, 6);
  });
  test('invert outside the disc is null', () => { expect(ctx.invert([2, 2])).toBeNull(); });
});

describe('lines', () => {
  test('parallel is dense and closed around the globe', () => {
    const l = parallelLine(50, 2);
    expect(l.coordinates[0]).toEqual([-180, 50]);
    expect(l.coordinates.at(-1)).toEqual([180, 50]);
    expect(l.coordinates.length).toBe(181);
  });
  test('meridian spans pole to pole', () => {
    const m = meridianLine(21, 2);
    expect(m.coordinates[0]).toEqual([21, -90]);
    expect(m.coordinates.at(-1)).toEqual([21, 90]);
  });
  test('hemisphere polygons exist', () => {
    for (const r of ['N', 'S', 'E', 'W'] as const) expect(hemisphere(r).coordinates[0]!.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `src/map/geometry.ts`**

```ts
import { geoCircle, geoDistance, geoEquirectangular, geoOrthographic, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import type { LatLon } from '../geo/types';

export interface ViewCtx {
  kind: 'flat' | 'globe';
  width: number;
  height: number;
  projection: GeoProjection;
  path: GeoPath;
  px: number;
  isVisible(p: LatLon): boolean;
  project(p: LatLon): [number, number] | null;
  invert(xy: [number, number]): LatLon | null;
}

export const TROPIC = 23.44;
export const POLAR = 66.56;
const RAD = Math.PI / 180;

export function parallelLine(lat: number, step = 2): GeoJSON.LineString {
  const coordinates: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += step) coordinates.push([lon, lat]);
  return { type: 'LineString', coordinates };
}

export function meridianLine(lon: number, step = 2, fromLat = -90, toLat = 90): GeoJSON.LineString {
  const coordinates: [number, number][] = [];
  const dir = toLat >= fromLat ? 1 : -1;
  for (let lat = fromLat; dir > 0 ? lat < toLat : lat > toLat; lat += step * dir) coordinates.push([lon, lat]);
  coordinates.push([lon, toLat]);
  return { type: 'LineString', coordinates };
}

const CENTERS: Record<'N' | 'S' | 'E' | 'W', [number, number]> = { N: [0, 90], S: [0, -90], E: [90, 0], W: [-90, 0] };
export function hemisphere(region: 'N' | 'S' | 'E' | 'W'): GeoJSON.Polygon {
  return geoCircle().center(CENTERS[region]).radius(90).precision(2)();
}

function inRange(ll: [number, number] | null | undefined): LatLon | null {
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
  const [lon, lat] = ll;
  if (Math.abs(lat) > 90 + 1e-9 || Math.abs(lon) > 180 + 1e-9) return null;
  return { lat, lon };
}

export function makeFlatCtx(width: number, height: number, center: LatLon, zoom: number, px: number): ViewCtx {
  const projection = geoEquirectangular()
    .scale((width / (2 * Math.PI)) * zoom)
    .translate([width / 2, height / 2])
    .center([center.lon, center.lat])
    .precision(0.5);
  const path = geoPath(projection);
  return {
    kind: 'flat', width, height, projection, path, px,
    isVisible: () => true,
    project: (p) => projection([p.lon, p.lat]) as [number, number],
    invert: (xy) => inRange(projection.invert?.(xy)),
  };
}

export function makeGlobeCtx(size: number, rotate: [number, number], px: number): ViewCtx {
  const projection = geoOrthographic()
    .scale(size / 2 - 6)
    .translate([size / 2, size / 2])
    .rotate(rotate)
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection);
  const centre: [number, number] = [-rotate[0], -rotate[1]];
  const isVisible = (p: LatLon) => geoDistance([p.lon, p.lat], centre) < Math.PI / 2 - 1e-6;
  return {
    kind: 'globe', width: size, height: size, projection, path, px, isVisible,
    project: (p) => (isVisible(p) ? (projection([p.lon, p.lat]) as [number, number]) : null),
    invert: (xy) => {
      const r = size / 2 - 6;
      if (Math.hypot(xy[0] - size / 2, xy[1] - size / 2) > r) return null;
      return inRange(projection.invert?.(xy));
    },
  };
}
export { RAD };
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/geometry.test.ts` → PASS.

- [ ] **Step 5: i18n keys** (EN given; PL/UK use exactly these terms):

| key | en | pl | uk |
|---|---|---|---|
| map.stage | Map | Mapa | Карта |
| map.chooseView | Choose view | Wybierz widok | Оберіть вигляд |
| map.view.globe | Globe | Globus | Глобус |
| map.view.flat | Map | Mapa | Карта |
| map.view.cross-section | Cross-section | Przekrój | Переріз |
| map.flat.label | World map with parallels and meridians | Mapa świata z równoleżnikami i południkami | Карта світу з паралелями й меридіанами |
| map.flat.hint | Arrow keys move the point (Shift: 10 times further). Plus and minus zoom. | Strzałki przesuwają punkt (Shift: 10 razy dalej). Plus i minus przybliżają. | Стрілки рухають точку (Shift — у 10 разів далі). Плюс і мінус змінюють масштаб. |
| map.zoomIn | Zoom in | Przybliż | Наблизити |
| map.zoomOut | Zoom out | Oddal | Віддалити |
| map.zoomHint | Hold Ctrl and scroll to zoom | Przytrzymaj Ctrl i przewiń, aby przybliżyć | Утримуйте Ctrl і прокрутіть, щоб змінити масштаб |
| map.preset.world | World | Świat | Світ |
| map.preset.europe | Europe | Europa | Європа |
| map.preset.poland | Poland | Polska | Польща |
| line.equator | Equator 0° | Równik 0° | Екватор 0° |
| line.prime | Prime meridian 0° (Greenwich) | Południk zerowy 0° (Greenwich) | Нульовий меридіан 0° (Гринвіч) |
| line.antimeridian | Meridian 180° | Południk 180° | Меридіан 180° |
| line.tropicCancer | Tropic of Cancer | Zwrotnik Raka | Тропік Рака |
| line.tropicCapricorn | Tropic of Capricorn | Zwrotnik Koziorożca | Тропік Козерога |
| line.arcticCircle | Arctic Circle | Koło podbiegunowe północne | Північне полярне коло |
| line.antarcticCircle | Antarctic Circle | Koło podbiegunowe południowe | Південне полярне коло |
| hemi.N | Northern Hemisphere | Półkula północna | Північна півкуля |
| hemi.S | Southern Hemisphere | Półkula południowa | Південна півкуля |
| hemi.E | Eastern Hemisphere | Półkula wschodnia | Східна півкуля |
| hemi.W | Western Hemisphere | Półkula zachodnia | Західна півкуля |
| unit.km | {n} km | {n} km | {n} км |

- [ ] **Step 6: Layer components**

`src/map/layers/Land.svelte`:
```svelte
<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import { borders, land, sphere } from '../world';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const oceanD = $derived(ctx.path(sphere) ?? '');
  const landD = $derived(ctx.path(land) ?? '');
  const bordersD = $derived(mapState.layers.borders ? (ctx.path(borders) ?? '') : '');
</script>

<path class="ocean" d={oceanD} />
<path class="land" d={landD} />
{#if bordersD}<path class="borders" d={bordersD} />{/if}

<style>
  .ocean { fill: var(--ocean); stroke: var(--grid); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .land { fill: var(--land); stroke: var(--land-stroke); stroke-width: 0.8; vector-effect: non-scaling-stroke; }
  .borders { fill: none; stroke: var(--land-stroke); stroke-width: 0.5; stroke-opacity: 0.7; vector-effect: non-scaling-stroke; }
</style>
```

`src/map/layers/Graticule.svelte`:
```svelte
<script lang="ts">
  import { geoGraticule } from 'd3-geo';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const d = $derived.by(() => {
    const s = mapState.layers.graticuleStep;
    return ctx.path(geoGraticule().step([s, s]).extent([[-180, -90], [180, 90.0001]]).precision(2)()) ?? '';
  });
</script>

<path class="grid" d={d} />

<style>
  .grid { fill: none; stroke: var(--grid); stroke-width: 0.8; stroke-opacity: 0.75; vector-effect: non-scaling-stroke; }
</style>
```

`src/map/layers/SpecialLines.svelte` — labelled lines, each with its own dash pattern so colour is not the only cue:
```svelte
<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { POLAR, TROPIC, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  interface Line { id: string; geo: GeoJSON.LineString; cls: string; labelKey: string; labelAt: { lat: number; lon: number } }
  const lines = $derived.by<Line[]>(() => {
    void i18n.lang;
    const out: Line[] = [];
    if (mapState.layers.specialLines) {
      out.push(
        { id: 'eq', geo: parallelLine(0), cls: 'equator', labelKey: 'line.equator', labelAt: { lat: 0, lon: -150 } },
        { id: 'pm', geo: meridianLine(0), cls: 'prime', labelKey: 'line.prime', labelAt: { lat: -50, lon: 0 } },
        { id: 'am', geo: meridianLine(180), cls: 'antimeridian', labelKey: 'line.antimeridian', labelAt: { lat: -50, lon: 180 } },
      );
    }
    if (mapState.layers.tropics) {
      out.push(
        { id: 'tc', geo: parallelLine(TROPIC), cls: 'tropic', labelKey: 'line.tropicCancer', labelAt: { lat: TROPIC, lon: -150 } },
        { id: 'tk', geo: parallelLine(-TROPIC), cls: 'tropic', labelKey: 'line.tropicCapricorn', labelAt: { lat: -TROPIC, lon: -150 } },
        { id: 'ac', geo: parallelLine(POLAR), cls: 'polar', labelKey: 'line.arcticCircle', labelAt: { lat: POLAR, lon: -150 } },
        { id: 'aa', geo: parallelLine(-POLAR), cls: 'polar', labelKey: 'line.antarcticCircle', labelAt: { lat: -POLAR, lon: -150 } },
      );
    }
    return out;
  });
</script>

{#each lines as line (line.id)}
  <path class="line {line.cls}" d={ctx.path(line.geo) ?? ''} />
{/each}
{#each lines as line (line.id)}
  {@const xy = ctx.kind === 'globe'
    ? ctx.project({ lat: line.labelAt.lat, lon: line.cls === 'prime' || line.cls === 'antimeridian' ? line.labelAt.lon : -ctx.projection.rotate()[0] - 35 })
    : ctx.project(line.labelAt)}
  {#if xy}
    <text class="label halo {line.cls}" x={xy[0] + 4 * ctx.px} y={xy[1] - 4 * ctx.px} font-size={12 * ctx.px}
      transform={line.cls === 'prime' || line.cls === 'antimeridian' ? `rotate(-90 ${xy[0] + 4 * ctx.px} ${xy[1] - 4 * ctx.px})` : undefined}>{t(line.labelKey)}</text>
  {/if}
{/each}

<style>
  .line { fill: none; vector-effect: non-scaling-stroke; }
  .equator { stroke: var(--equator); stroke-width: 3; }
  .prime { stroke: var(--prime); stroke-width: 3; stroke-dasharray: 12 5; }
  .antimeridian { stroke: var(--antimeridian); stroke-width: 3; stroke-dasharray: 3 5 12 5; }
  .tropic { stroke: var(--tropics); stroke-width: 2; stroke-dasharray: 2 4; }
  .polar { stroke: var(--tropics); stroke-width: 2; stroke-dasharray: 8 4 2 4; }
  text.equator { fill: var(--equator); } text.prime { fill: var(--prime); } text.antimeridian { fill: var(--antimeridian); }
  text.tropic, text.polar { fill: var(--tropics); }
</style>
```
Add to `src/styles/base.css` (shared by all SVG text):
```css
svg text.halo { paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round; font-weight: 600; font-family: var(--font); }
```
Note: `text` colours for lines must meet 3:1 against the map; if axe or manual contrast checks fail on `--tropics` in light mode, darken the token in `tokens.css`.

`src/map/layers/Hemispheres.svelte` — colour tint **plus** a pattern:
```svelte
<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import { hemisphere, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx, idPrefix }: { ctx: ViewCtx; idPrefix: string } = $props();

  const regions = $derived(
    mapState.layers.hemispheres === 'ns' ? (['N', 'S'] as const) : mapState.layers.hemispheres === 'ew' ? (['E', 'W'] as const) : ([] as const),
  );
  const LABEL_AT = { N: { lat: 45, lon: -120 }, S: { lat: -45, lon: -120 }, E: { lat: 60, lon: 90 }, W: { lat: 60, lon: -90 } } as const;
</script>

<defs>
  <pattern id="{idPrefix}-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="8" height="8" fill="var(--hemi-a)" /><line x1="0" y1="0" x2="0" y2="8" stroke="var(--marker-a)" stroke-width="1.5" stroke-opacity="0.35" />
  </pattern>
  <pattern id="{idPrefix}-dots" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="10" height="10" fill="var(--hemi-b)" /><circle cx="5" cy="5" r="1.6" fill="var(--marker-b)" fill-opacity="0.45" />
  </pattern>
</defs>
{#each regions as r, i (r)}
  <path d={ctx.path(hemisphere(r)) ?? ''} fill="url(#{idPrefix}-{i === 0 ? 'stripes' : 'dots'})" />
{/each}
{#each regions as r (r)}
  {@const xy = ctx.project(ctx.kind === 'globe' ? { lat: LABEL_AT[r].lat > 0 ? 35 : -35, lon: r === 'E' || r === 'W' ? (r === 'E' ? 90 : -90) : -ctx.projection.rotate()[0] } : LABEL_AT[r])}
  {#if xy}<text class="halo hemi-label" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={15 * ctx.px}>{t(`hemi.${r}`)}</text>{/if}
{/each}

<style>
  .hemi-label { fill: var(--text); }
</style>
```

`src/map/layers/Places.svelte` — place dots and names, plus continent/ocean labels:
```svelte
<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { MAP_LABELS, PLACES } from '../places';
  let { ctx }: { ctx: ViewCtx } = $props();

  const showAllNames = $derived(ctx.kind === 'flat' && mapState.flat.zoom >= 2.5);
  const places = $derived(mapState.layers.places ? PLACES.filter((p) => p.kind === 'city') : []);
</script>

{#if mapState.layers.places}
  {#each MAP_LABELS as l (l.id)}
    {@const xy = ctx.project(l)}
    {#if xy && !(ctx.kind === 'flat' && mapState.flat.zoom > 4)}
      <text class="halo map-label {l.kind}" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={(l.kind === 'ocean' ? 12 : 13) * ctx.px} lang={i18n.lang}>{t(`label.${l.id}`)}</text>
    {/if}
  {/each}
  {#each places as p (p.id)}
    {@const xy = ctx.project(p)}
    {#if xy}
      <circle class="place" cx={xy[0]} cy={xy[1]} r={3.5 * ctx.px} />
      {#if p.featured || showAllNames}
        <text class="halo place-name" x={xy[0] + 6 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={12 * ctx.px}>{t(`place.${p.id}`)}</text>
      {/if}
    {/if}
  {/each}
{/if}

<style>
  .place { fill: var(--text); stroke: var(--surface); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .place-name { fill: var(--text); }
  .map-label { fill: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; }
  .map-label.ocean { font-style: italic; text-transform: none; }
</style>
```

`src/map/layers/EdgeLabels.svelte` (flat only) — degree numbers along left and bottom edges:
```svelte
<script lang="ts">
  import { formatLat, formatLon } from '../../geo/format';
  import { i18n } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const ticks = $derived.by(() => {
    const base = mapState.layers.graticuleStep;
    const degPerPx = (360 / (ctx.width * mapState.flat.zoom)) * ctx.px;
    let step = base;
    while (step / degPerPx < 34) step *= 2; // keep labels at least 34 CSS px apart
    const c = mapState.flat.center;
    const halfLat = 90 / mapState.flat.zoom, halfLon = 180 / mapState.flat.zoom;
    const lats: number[] = [], lons: number[] = [];
    for (let v = -90; v <= 90; v += step) if (v >= c.lat - halfLat && v <= c.lat + halfLat) lats.push(v);
    for (let v = -180; v <= 180; v += step) if (v >= c.lon - halfLon && v <= c.lon + halfLon) lons.push(v);
    return { lats, lons };
  });
</script>

<g class="edge" aria-hidden="true">
  {#each ticks.lats as lat (lat)}
    {@const xy = ctx.project({ lat, lon: mapState.flat.center.lon })}
    {#if xy && Math.abs(lat) < 90}<text class="halo" x={4 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={11 * ctx.px}>{formatLat(lat, i18n.lang)}</text>{/if}
  {/each}
  {#each ticks.lons as lon (lon)}
    {@const xy = ctx.project({ lat: mapState.flat.center.lat, lon })}
    {#if xy}<text class="halo" x={xy[0]} y={ctx.height - 5 * ctx.px} text-anchor="middle" font-size={11 * ctx.px}>{formatLon(lon, i18n.lang)}</text>{/if}
  {/each}
</g>

<style>
  .edge text { fill: var(--text); }
</style>
```

`src/map/layers/PointMarker.svelte`:
```svelte
<script lang="ts">
  import { meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const p = $derived(mapState.point);
  const xy = $derived(p ? ctx.project(p) : null);
</script>

{#if p}
  {#if mapState.layers.pointGuides}
    <path class="guide" d={ctx.path(parallelLine(p.lat)) ?? ''} />
    <path class="guide" d={ctx.path(meridianLine(p.lon)) ?? ''} />
  {/if}
  {#if xy}
    <g class="point" class:editable={mapState.pointEditable} data-point-handle transform="translate({xy[0]} {xy[1]})">
      <circle class="hit" r={22 * ctx.px} />
      <circle class="ring" r={9 * ctx.px} />
      <circle class="dot" r={3 * ctx.px} />
    </g>
  {/if}
{/if}

<style>
  .guide { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 4; vector-effect: non-scaling-stroke; }
  .hit { fill: transparent; }
  .ring { fill: var(--accent); fill-opacity: 0.25; stroke: var(--accent); stroke-width: 3; vector-effect: non-scaling-stroke; }
  .dot { fill: var(--accent); }
  .editable { cursor: grab; touch-action: none; }
  .editable:active { cursor: grabbing; }
</style>
```

`src/map/layers/Overlays.svelte` — this task implements `marker`, `highlight-line`, `highlight-region`; Tasks 15 and 17 add the other kinds as extra `{:else if}` branches. Marker tones use distinct **shapes**:
```svelte
<script lang="ts">
  import { hemisphere, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import type { MarkerTone } from '../types';
  let { ctx }: { ctx: ViewCtx } = $props();

  function shape(tone: MarkerTone, r: number): string {
    switch (tone) {
      case 'a': return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
      case 'b': return `M${-r},${-r}h${2 * r}v${2 * r}h${-2 * r}z`;
      case 'c': return `M0,${-r * 1.2}L${r * 1.1},${r * 0.8}H${-r * 1.1}z`;
      case 'd': return `M0,${-r * 1.3}L${r * 1.3},0L0,${r * 1.3}L${-r * 1.3},0z`;
      case 'answer': return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0M${-r * 0.5},0l${r * 0.35},${r * 0.4}l${r * 0.65},${-r * 0.8}`;
      case 'wrong': return `M${-r},${-r}L${r},${r}M${r},${-r}L${-r},${r}`;
    }
  }
</script>

{#each mapState.overlays as o, i (i)}
  {#if o.kind === 'highlight-region'}
    <path class="hl-region" d={ctx.path(hemisphere(o.region)) ?? ''} />
  {:else if o.kind === 'highlight-line'}
    <path class="hl-line" d={ctx.path(o.axis === 'lat' ? parallelLine(o.value) : meridianLine(o.value)) ?? ''} />
  {:else if o.kind === 'marker'}
    {@const xy = ctx.project(o.p)}
    {#if xy}
      <g transform="translate({xy[0]} {xy[1]})" class="marker tone-{o.tone}">
        <path d={shape(o.tone, 8 * ctx.px)} />
        {#if o.label}<text class="halo" x={12 * ctx.px} y={-10 * ctx.px} font-size={15 * ctx.px}>{o.label}</text>{/if}
      </g>
    {/if}
  {/if}
{/each}

<style>
  .hl-region { fill: var(--accent); fill-opacity: 0.18; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .hl-line { fill: none; stroke: var(--accent); stroke-width: 6; stroke-opacity: 0.85; vector-effect: non-scaling-stroke; }
  .marker path { stroke-width: 3; vector-effect: non-scaling-stroke; stroke: var(--surface); paint-order: stroke; }
  .marker text { fill: var(--text); font-weight: 700; }
  .tone-a path { fill: var(--marker-a); } .tone-b path { fill: var(--marker-b); }
  .tone-c path { fill: var(--marker-c); } .tone-d path { fill: var(--marker-d); }
  .tone-answer path { fill: none; stroke: var(--marker-answer); stroke-width: 4; }
  .tone-wrong path { fill: none; stroke: var(--marker-wrong); stroke-width: 4; }
</style>
```

`src/map/layers/Layers.svelte`:
```svelte
<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import EdgeLabels from './EdgeLabels.svelte';
  import Graticule from './Graticule.svelte';
  import Hemispheres from './Hemispheres.svelte';
  import Land from './Land.svelte';
  import Overlays from './Overlays.svelte';
  import Places from './Places.svelte';
  import PointMarker from './PointMarker.svelte';
  import SpecialLines from './SpecialLines.svelte';
  let { ctx, idPrefix }: { ctx: ViewCtx; idPrefix: string } = $props();
</script>

<Land {ctx} />
<Hemispheres {ctx} {idPrefix} />
<Graticule {ctx} />
<SpecialLines {ctx} />
<Places {ctx} />
{#if ctx.kind === 'flat'}<EdgeLabels {ctx} />{/if}
<Overlays {ctx} />
<PointMarker {ctx} />
```
(Hemispheres render after land with semi-transparent patterns so the continents remain visible beneath.)

- [ ] **Step 7: `src/map/FlatMap.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { settings } from '../app/settings.svelte';
  import { makeFlatCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { mapState } from './mapState.svelte';
  import type { FlatPreset } from './types';

  const W = 960, H = 480;
  const uid = `flat-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(W);
  const uiScale = $derived(settings.largeText ? 1.25 : 1);
  const ctx = $derived(makeFlatCtx(W, H, mapState.flat.center, mapState.flat.zoom, (W / Math.max(1, clientWidth)) * uiScale));

  type Drag = { mode: 'point' | 'pan' | 'maybe-click'; startX: number; startY: number; lastX: number; lastY: number };
  let drag: Drag | null = null;
  let pinch = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  function toView(clientX: number, clientY: number): [number, number] {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  }

  function onpointerdown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      drag = null;
      return;
    }
    const onPoint = (e.target as Element).closest('[data-point-handle]') !== null;
    drag = { mode: onPoint && mapState.pointEditable ? 'point' : 'maybe-click', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY };
    svg.setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    if (pinch.has(e.pointerId)) pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist > 0) mapState.zoomFlat(d / pinchDist);
      pinchDist = d;
      return;
    }
    if (!drag) return;
    if (drag.mode === 'point') {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    } else {
      if (drag.mode === 'maybe-click' && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6 && mapState.flat.zoom > 1) drag.mode = 'pan';
      if (drag.mode === 'pan') {
        const [x0, y0] = toView(drag.lastX, drag.lastY);
        const [x1, y1] = toView(e.clientX, e.clientY);
        const dpu = 360 / (W * mapState.flat.zoom);
        mapState.panFlat((y1 - y0) * dpu, -(x1 - x0) * dpu);
      }
    }
    drag.lastX = e.clientX; drag.lastY = e.clientY;
  }

  function onpointerup(e: PointerEvent) {
    pinch.delete(e.pointerId);
    if (pinch.size < 2) pinchDist = 0;
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
  }

  function onpointercancel(e: PointerEvent) { pinch.delete(e.pointerId); drag = null; }

  function onkeydown(e: KeyboardEvent) {
    const big = e.shiftKey;
    const s = mapState.stepSize(big);
    const arrows: Record<string, [number, number]> = { ArrowUp: [s, 0], ArrowDown: [-s, 0], ArrowLeft: [0, -s], ArrowRight: [0, s] };
    const delta = arrows[e.key];
    if (delta) {
      if (mapState.pointEditable) mapState.nudge(delta[0], delta[1], 'map');
      else if (mapState.flat.zoom > 1) mapState.panFlat(delta[0] * 2, delta[1] * 2);
      else return;
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') { mapState.zoomFlat(1.5); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { mapState.zoomFlat(1 / 1.5); e.preventDefault(); }
    else if (e.key === '0') { mapState.setFlatPreset('world'); e.preventDefault(); }
  }

  $effect(() => {
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      mapState.zoomFlat(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  });

  const PRESETS: FlatPreset[] = ['world', 'europe', 'poland'];
</script>

<figure class="flat">
  <div class="frame" bind:clientWidth>
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      role="group"
      aria-roledescription={t('map.view.flat')}
      aria-label={t('map.flat.label')}
      aria-describedby="{uid}-hint"
      tabindex="0"
      style:touch-action={mapState.flat.zoom > 1 ? 'none' : 'pan-y'}
      {onpointerdown} {onpointermove} {onpointerup} {onpointercancel} {onkeydown}
    >
      <defs><clipPath id="{uid}-clip"><rect width={W} height={H} /></clipPath></defs>
      <g clip-path="url(#{uid}-clip)"><Layers {ctx} idPrefix={uid} /></g>
    </svg>
  </div>
  <p id="{uid}-hint" class="visually-hidden">{t('map.flat.hint')}</p>
  <div class="toolbar" role="toolbar" aria-label={t('map.view.flat')}>
    <button type="button" onclick={() => mapState.zoomFlat(1.5)} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>＋</button>
    <button type="button" onclick={() => mapState.zoomFlat(1 / 1.5)} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>−</button>
    {#each PRESETS as p (p)}
      <button type="button" onclick={() => mapState.setFlatPreset(p)}>{t(`map.preset.${p}`)}</button>
    {/each}
  </div>
</figure>

<style>
  .flat { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--ocean); }
  svg { display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
  svg:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .toolbar button { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-3); font-weight: 600; }
</style>
```

- [ ] **Step 8: Check** — `npm run check && npm test`. FlatMap is not mounted by any page yet; it is exercised visually in Task 9.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(map): projection contexts, shared SVG layers and interactive flat map"
```

---

### Task 9: Globe, MapStage and a free-play Lab page

**Files:**
- Create: `src/map/Globe.svelte`, `src/map/MapStage.svelte`, `src/app/LabPage.svelte`
- Modify: `src/app/App.svelte` (add `lab` branch), `src/i18n/{en,pl,uk}.json`
- Test: `tests/e2e/map.spec.ts`

**Interfaces:**
- Consumes: `makeGlobeCtx`, `Layers` (Task 8); `mapState` (Task 7); `motionReduced` (Task 6).
- Produces:
  - `Globe.svelte` (no props).
  - `MapStage.svelte` props `{ showPlaces?: boolean; label?: string }`; shows the views listed in `mapState.views`, side by side when the stage is ≥ 640 CSS px wide, otherwise one view at a time with a segmented view switch (`aria-pressed` buttons). Tasks 10 and 11 add controls, place list and cross-section into this component.
  - `LabPage.svelte` — `#<lang>/lab`; on mount applies the free-play scene `{ views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true } }`. Task 17 extends it with sun controls.

- [ ] **Step 1: i18n keys**

| key | en | pl | uk |
|---|---|---|---|
| map.globe.label | Globe that you can turn | Globus, który możesz obracać | Глобус, який можна обертати |
| map.globe.hint | Drag to turn the globe. Arrow keys move the point, or turn the globe when the point cannot move. | Przeciągnij, aby obrócić globus. Strzałki przesuwają punkt albo obracają globus, gdy punktu nie można przesuwać. | Перетягніть, щоб обернути глобус. Стрілки рухають точку або обертають глобус, коли точку рухати не можна. |
| map.turnWest | Turn globe to show the west | Obróć globus na zachód | Оберніть глобус на захід |
| map.turnEast | Turn globe to show the east | Obróć globus na wschód | Оберніть глобус на схід |
| map.turnNorth | Tilt globe to show the north | Pochyl globus na północ | Нахиліть глобус на північ |
| map.turnSouth | Tilt globe to show the south | Pochyl globus na południe | Нахиліть глобус на південь |
| map.showPoint | Show the point | Pokaż punkt | Показати точку |
| lab.intro | Move the point anywhere on Earth and watch its coordinates change. | Przesuń punkt w dowolne miejsce na Ziemi i patrz, jak zmieniają się jego współrzędne. | Перемістіть точку будь-куди на Землі й дивіться, як змінюються її координати. |

- [ ] **Step 2: `src/map/Globe.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { settings } from '../app/settings.svelte';
  import { makeGlobeCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { mapState } from './mapState.svelte';

  const SIZE = 500;
  const uid = `globe-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(SIZE);
  const uiScale = $derived(settings.largeText ? 1.25 : 1);
  const ctx = $derived(makeGlobeCtx(SIZE, mapState.rotate, (SIZE / Math.max(1, clientWidth)) * uiScale));

  type Drag = { mode: 'point' | 'rotate' | 'maybe-click'; startX: number; startY: number; lastX: number; lastY: number };
  let drag: Drag | null = null;
  let frame = 0;

  function toView(clientX: number, clientY: number): [number, number] {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  }

  function rotateBy(dLambda: number, dPhi: number) {
    const [l, p] = mapState.rotate;
    mapState.rotate = [((l + dLambda + 540) % 360) - 180, Math.max(-90, Math.min(90, p + dPhi))];
  }

  function onpointerdown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const onPoint = (e.target as Element).closest('[data-point-handle]') !== null;
    drag = { mode: onPoint && mapState.pointEditable ? 'point' : 'maybe-click', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY };
    svg.setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    if (d.mode === 'maybe-click' && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.mode = 'rotate';
    const cx = e.clientX, cy = e.clientY;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (d.mode === 'point') {
        const ll = ctx.invert(toView(cx, cy));
        if (ll) mapState.userSetPoint(ll, 'map');
      } else if (d.mode === 'rotate') {
        const k = (180 / (SIZE - 12)) * (SIZE / Math.max(1, clientWidth));
        rotateBy((cx - d.lastX) * k, -(cy - d.lastY) * k);
      }
      d.lastX = cx; d.lastY = cy;
    });
  }

  function onpointerup(e: PointerEvent) {
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
  }

  function onkeydown(e: KeyboardEvent) {
    const s = mapState.stepSize(e.shiftKey);
    const arrows: Record<string, [number, number]> = { ArrowUp: [s, 0], ArrowDown: [-s, 0], ArrowLeft: [0, -s], ArrowRight: [0, s] };
    const delta = arrows[e.key];
    if (!delta) return;
    e.preventDefault();
    if (mapState.pointEditable) mapState.nudge(delta[0], delta[1], 'map');
    else rotateBy(-delta[1] * (e.shiftKey ? 3 : 15), -delta[0] * (e.shiftKey ? 3 : 15));
  }

  // Keep the point in view when it moves off the visible side by keyboard, sliders or program.
  $effect(() => {
    const p = mapState.point;
    if (!p || mapState.lastChange === 'map') return;
    if (!makeGlobeCtx(SIZE, mapState.rotate, 1).isVisible(p)) mapState.centerGlobeOn(p);
  });
</script>

<figure class="globe">
  <div class="frame" bind:clientWidth>
    <svg
      bind:this={svg}
      viewBox="0 0 {SIZE} {SIZE}"
      role="group"
      aria-roledescription={t('map.view.globe')}
      aria-label={t('map.globe.label')}
      aria-describedby="{uid}-hint"
      tabindex="0"
      {onpointerdown} {onpointermove} {onpointerup} onpointercancel={() => (drag = null)} {onkeydown}
    >
      <Layers {ctx} idPrefix={uid} />
    </svg>
  </div>
  <p id="{uid}-hint" class="visually-hidden">{t('map.globe.hint')}</p>
  <div class="toolbar" role="toolbar" aria-label={t('map.view.globe')}>
    <button type="button" onclick={() => rotateBy(15, 0)} aria-label={t('map.turnWest')} title={t('map.turnWest')}>←</button>
    <button type="button" onclick={() => rotateBy(-15, 0)} aria-label={t('map.turnEast')} title={t('map.turnEast')}>→</button>
    <button type="button" onclick={() => rotateBy(0, -15)} aria-label={t('map.turnNorth')} title={t('map.turnNorth')}>↑</button>
    <button type="button" onclick={() => rotateBy(0, 15)} aria-label={t('map.turnSouth')} title={t('map.turnSouth')}>↓</button>
    {#if mapState.point}
      <button type="button" onclick={() => mapState.point && mapState.centerGlobeOn(mapState.point)}>{t('map.showPoint')}</button>
    {/if}
  </div>
</figure>

<style>
  .globe { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { max-width: min(100%, 70vh); margin-inline: auto; width: 100%; }
  svg { display: block; width: 100%; height: auto; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
  svg:active { cursor: grabbing; }
  svg:focus-visible { outline: 3px solid var(--focus); border-radius: 50%; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
  .toolbar button { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-3); font-weight: 600; }
</style>
```
Direction check for `rotateBy`: d3 rotation λ increases → the globe spins so that more **western** longitudes come into view (the centre longitude is −λ). "Turn west" therefore adds +15 to λ; "turn north" subtracts from φ (centre latitude is −φ).

Globe `touch-action: none` is acceptable on phones because only one view is shown at a time and the page remains scrollable outside the globe frame; the globe never exceeds `70vh`.

- [ ] **Step 3: `src/map/MapStage.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import FlatMap from './FlatMap.svelte';
  import Globe from './Globe.svelte';
  import { mapState } from './mapState.svelte';

  let { showPlaces = false, label }: { showPlaces?: boolean; label?: string } = $props();
  let width = $state(1024);
  const wide = $derived(width >= 640);
  const shown = $derived(wide ? mapState.views : mapState.views.filter((v) => v === mapState.phoneView));
</script>

<section class="stage" bind:clientWidth={width} aria-label={label ?? t('map.stage')}>
  {#if !wide && mapState.views.length > 1}
    <div class="switch" role="group" aria-label={t('map.chooseView')}>
      {#each mapState.views as v (v)}
        <button type="button" aria-pressed={mapState.phoneView === v} onclick={() => (mapState.phoneView = v)}>{t(`map.view.${v}`)}</button>
      {/each}
    </div>
  {/if}
  <div class="views" class:wide style:--count={shown.length}>
    {#each shown as v (v)}
      <div class="view view-{v}">
        {#if v === 'globe'}<Globe />{:else if v === 'flat'}<FlatMap />{/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .stage { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .switch { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; align-self: flex-start; }
  .switch button { border: 0; background: var(--surface); padding: 0 var(--space-4); font-weight: 600; }
  .switch button[aria-pressed='true'] { background: var(--accent); color: var(--accent-contrast); }
  .views { display: grid; gap: var(--space-4); grid-template-columns: 1fr; align-items: start; }
  .views.wide:has(.view-globe):has(.view-flat) { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
  .views.wide:has(.view-cross-section):not(:has(.view-flat)) { grid-template-columns: repeat(var(--count), minmax(0, 1fr)); }
</style>
```

- [ ] **Step 4: `src/app/LabPage.svelte` and route**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';

  onMount(() => {
    mapState.applyScene({ views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true } });
  });
</script>

<h1 tabindex="-1">{t('mode.lab.title')}</h1>
<p>{t('lab.intro')}</p>
<MapStage showPlaces />
```

In `src/app/App.svelte` import `LabPage` and replace the `{#if}` chain with:
```svelte
  {#if route.name === 'lab'}
    <LabPage />
  {:else}
    <Home />
  {/if}
```

- [ ] **Step 5: E2E** `tests/e2e/map.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab shows globe and flat map side by side on desktop', async ({ page }) => {
  await openPage(page, 'en/lab');
  await expect(page.getByRole('group', { name: 'World map with parallels and meridians' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Globe that you can turn' })).toBeVisible();
  await expectNoAxeViolations(page, 'lab desktop');
  expect(pageErrors(page)).toEqual([]);
});

test('phone shows one view with a switch', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'pl/lab');
  await expect(page.getByRole('group', { name: 'Globus, który możesz obracać' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Globus' }).click();
  await expect(page.getByRole('group', { name: 'Globus, który możesz obracać' })).toBeVisible();
  await expectNoAxeViolations(page, 'lab phone');
});

test('clicking the flat map moves the point', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const box = (await map.boundingBox())!;
  // x = 75% of width → lon 90°E; y = 25% of height → lat 45°N
  await map.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  const handle = map.locator('[data-point-handle]');
  const hb = (await handle.boundingBox())!;
  expect(Math.abs(hb.x + hb.width / 2 - (box.x + box.width * 0.75))).toBeLessThan(6);
});

test('keyboard moves the point on the flat map', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const before = (await map.locator('[data-point-handle]').boundingBox())!;
  await map.focus();
  await page.keyboard.press('Shift+ArrowRight');
  const after = (await map.locator('[data-point-handle]').boundingBox())!;
  expect(after.x).toBeGreaterThan(before.x + 5);
});
```

- [ ] **Step 6: Build, test and look**

Run: `npm run check && npm test && npm run build && npm run e2e`
Then: `npm run shot -- "en/lab" lab` and `npm run shot -- "uk/lab" lab-dark dark`; open the PNGs with the Read tool and check: land visible, grid and labelled equator/Greenwich/180°, point with guides, featured city names readable, nothing overflowing at 375 px. Fix what looks wrong before committing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(map): draggable globe, responsive map stage and free-play lab page"
```

---

### Task 10: Coordinate controls, point announcements and place list

**Files:**
- Create: `src/map/Slider.svelte`, `src/map/CoordinateControls.svelte`, `src/map/PlaceList.svelte`
- Modify: `src/map/MapStage.svelte`, `src/i18n/{en,pl,uk}.json`
- Test: `tests/e2e/controls.spec.ts`

**Interfaces:**
- Consumes: `mapState` (Task 7); `formatLat`, `formatLon`, `formatLatLon` (Task 2); `spokenLat`, `spokenLon` (Task 5); `announceThrottled` (Task 6); `PLACES` (Task 7).
- Produces:
  - `Slider.svelte` props `{ label: string; min: number; max: number; value: number; step: number; bigStep: number; valueText: string; display: string; onchange: (v: number) => void; wrap?: boolean }` — `role="slider"` element with full keyboard support (Arrow keys ± step, Shift+Arrow ± bigStep, PageUp/PageDown ± bigStep, Home/End min/max), a draggable track, and −/+ buttons (44 px).
  - `CoordinateControls.svelte` (no props) — readout + latitude/longitude sliders; hidden when `mapState.showReadout` is false; sliders only when `mapState.pointEditable`.
  - `PlaceList.svelte` props `{ onselect?: (id: string) => void; showCoords?: boolean; ids?: readonly string[]; title?: string }`.
  - `MapStage` now renders `CoordinateControls` when `mapState.point` is set, and `PlaceList` when `showPlaces && mapState.pointEditable`; it announces point changes that come from map dragging/clicking (`lastChange === 'map'`) via `announceThrottled('point', …, 700)`.

- [ ] **Step 1: i18n keys**

| key | en | pl | uk |
|---|---|---|---|
| controls.latitude | Latitude | Szerokość geograficzna | Географічна широта |
| controls.longitude | Longitude | Długość geograficzna | Географічна довгота |
| controls.readout | Point coordinates | Współrzędne punktu | Координати точки |
| controls.decrease | Decrease {name} | Zmniejsz: {name} | Зменшити: {name} |
| controls.increase | Increase {name} | Zwiększ: {name} | Збільшити: {name} |
| places.title | Places | Miejsca | Місця |
| places.goTo | Move the point to {place} | Przenieś punkt do: {place} | Перемістити точку: {place} |

- [ ] **Step 2: `src/map/Slider.svelte`**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';

  let { label, min, max, value, step, bigStep, valueText, display, onchange, wrap = false }: {
    label: string; min: number; max: number; value: number; step: number; bigStep: number;
    valueText: string; display: string; onchange: (v: number) => void; wrap?: boolean;
  } = $props();

  let track: HTMLDivElement;
  let dragging = false;
  const pct = $derived(((value - min) / (max - min)) * 100);

  function set(v: number) {
    if (wrap) { const span = max - min; while (v > max) v -= span; while (v <= min) v += span; }
    onchange(Math.max(min, Math.min(max, v)));
  }

  function onkeydown(e: KeyboardEvent) {
    const map: Record<string, () => number> = {
      ArrowUp: () => value + (e.shiftKey ? bigStep : step), ArrowRight: () => value + (e.shiftKey ? bigStep : step),
      ArrowDown: () => value - (e.shiftKey ? bigStep : step), ArrowLeft: () => value - (e.shiftKey ? bigStep : step),
      PageUp: () => value + bigStep, PageDown: () => value - bigStep, Home: () => min, End: () => max,
    };
    const f = map[e.key];
    if (!f) return;
    e.preventDefault();
    set(f());
  }

  function fromPointer(e: PointerEvent) {
    const r = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onchange(min + ratio * (max - min));
  }
</script>

<div class="slider">
  <div class="head"><span class="name" aria-hidden="true">{label}</span><span class="value" aria-hidden="true">{display}</span></div>
  <div class="row">
    <button type="button" class="step" aria-label={t('controls.decrease', { name: label })} onclick={() => set(value - step)}>−</button>
    <div class="track" bind:this={track}
      onpointerdown={(e) => { dragging = true; track.setPointerCapture(e.pointerId); fromPointer(e); }}
      onpointermove={(e) => dragging && fromPointer(e)}
      onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
      <div class="fill" style:width="{pct}%"></div>
      <div class="thumb" style:left="{pct}%" role="slider" tabindex="0" aria-label={label}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value * 100) / 100} aria-valuetext={valueText}
        {onkeydown}></div>
    </div>
    <button type="button" class="step" aria-label={t('controls.increase', { name: label })} onclick={() => set(value + step)}>+</button>
  </div>
</div>

<style>
  .slider { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .head { display: flex; justify-content: space-between; gap: var(--space-2); font-weight: 600; }
  .value { font-variant-numeric: tabular-nums; }
  .row { display: flex; align-items: center; gap: var(--space-2); }
  .step { background: var(--surface); border: 1px solid var(--border); border-radius: 50%; font-size: 1.3rem; font-weight: 700; flex: none; }
  .track { position: relative; flex: 1; height: var(--tap); touch-action: none; cursor: pointer; }
  .track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--border); }
  .fill { position: absolute; left: 0; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px; background: var(--accent); }
  .thumb { position: absolute; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: var(--accent); border: 3px solid var(--surface); box-shadow: 0 0 0 1px var(--accent); }
  .thumb:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
</style>
```

- [ ] **Step 3: `src/map/CoordinateControls.svelte`**

```svelte
<script lang="ts">
  import { formatLat, formatLatLon, formatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { spokenLat, spokenLon } from '../i18n/spoken';
  import { mapState } from './mapState.svelte';
  import Slider from './Slider.svelte';

  const p = $derived(mapState.point);
  const prec = $derived(mapState.precision);
</script>

{#if p && mapState.showReadout}
  <div class="controls">
    <p class="readout"><span class="visually-hidden">{t('controls.readout')}: </span><output>{formatLatLon(p, i18n.lang, prec)}</output></p>
    {#if mapState.pointEditable}
      <div class="sliders">
        <Slider label={t('controls.latitude')} min={-90} max={90} value={p.lat}
          step={mapState.stepSize(false)} bigStep={mapState.stepSize(true)}
          display={formatLat(p.lat, i18n.lang, prec)} valueText={spokenLat(p.lat, i18n.lang, prec)}
          onchange={(v) => mapState.userSetPoint({ lat: v, lon: p.lon }, 'slider')} />
        <Slider label={t('controls.longitude')} min={-180} max={180} value={p.lon} wrap
          step={mapState.stepSize(false)} bigStep={mapState.stepSize(true)}
          display={formatLon(p.lon, i18n.lang, prec)} valueText={spokenLon(p.lon, i18n.lang, prec)}
          onchange={(v) => mapState.userSetPoint({ lat: p.lat, lon: v }, 'slider')} />
      </div>
    {/if}
  </div>
{/if}

<style>
  .controls { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3) var(--space-4); }
  .readout { margin: 0 0 var(--space-2); font-size: clamp(1.4rem, 1rem + 2vw, 2.4rem); font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; }
  .sliders { display: grid; gap: var(--space-3) var(--space-6); grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
</style>
```

- [ ] **Step 4: `src/map/PlaceList.svelte`**

```svelte
<script lang="ts">
  import { formatLatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { PLACES } from './places';

  let { onselect, showCoords = true, ids, title }: { onselect?: (id: string) => void; showCoords?: boolean; ids?: readonly string[]; title?: string } = $props();

  const items = $derived.by(() => {
    const collator = new Intl.Collator(i18n.lang);
    return PLACES.filter((p) => (ids ? ids.includes(p.id) : true))
      .map((p) => ({ ...p, name: t(`place.${p.id}`) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  });

  function choose(id: string) {
    if (onselect) return onselect(id);
    const place = PLACES.find((p) => p.id === id)!;
    mapState.userSetPoint(place, 'slider');
    mapState.centerGlobeOn(place);
  }
</script>

<details class="places">
  <summary>{title ?? t('places.title')}</summary>
  <ul>
    {#each items as p (p.id)}
      <li>
        <button type="button" onclick={() => choose(p.id)} aria-label={onselect ? p.name : t('places.goTo', { place: p.name })}>
          <span class="name">{p.name}</span>
          {#if showCoords}<span class="coords" aria-hidden={!onselect}>{formatLatLon(p, i18n.lang)}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</details>

<style>
  .places { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  summary { min-height: var(--tap); display: flex; align-items: center; padding: 0 var(--space-4); cursor: pointer; font-weight: 600; }
  ul { list-style: none; margin: 0; padding: var(--space-2); display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); max-height: 22rem; overflow: auto; }
  button { width: 100%; display: flex; justify-content: space-between; gap: var(--space-2); align-items: center; text-align: left; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-1) var(--space-3); }
  .coords { color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
```
Note: when `onselect` is not given, the aria-label names the action and the visible coordinates are marked `aria-hidden`, so the label contains the visible name (WCAG 2.5.3) without repeating numbers.

- [ ] **Step 5: Wire into `MapStage.svelte`** — add imports and, after the `.views` div:

```svelte
  {#if mapState.point}<CoordinateControls />{/if}
  {#if showPlaces && mapState.pointEditable}<PlaceList />{/if}
```
and in the script:
```ts
  import { announceThrottled } from '../app/announcer.svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { spokenLat, spokenLon } from '../i18n/spoken';
  import CoordinateControls from './CoordinateControls.svelte';
  import PlaceList from './PlaceList.svelte';

  $effect(() => {
    const p = mapState.point;
    if (!p || mapState.lastChange !== 'map' || !mapState.showReadout) return;
    announceThrottled('point', `${spokenLat(p.lat, i18n.lang, mapState.precision)}, ${spokenLon(p.lon, i18n.lang, mapState.precision)}`, 700);
  });
```

- [ ] **Step 6: E2E** `tests/e2e/controls.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('latitude slider is keyboard operable and speaks values', async ({ page }) => {
  await openPage(page, 'en/lab');
  const lat = page.getByRole('slider', { name: 'Latitude' });
  await expect(lat).toHaveAttribute('aria-valuetext', '52 degrees north');
  await lat.focus();
  await page.keyboard.press('ArrowUp');
  await expect(lat).toHaveAttribute('aria-valuetext', '53 degrees north');
  await expect(page.locator('output')).toHaveText('53°N, 21°E');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('output')).toHaveText('43°N, 21°E');
  await page.keyboard.press('End');
  await expect(page.locator('output')).toHaveText('90°N, 21°E');
});

test('longitude wraps across 180° with the plus button', async ({ page }) => {
  await openPage(page, 'uk/lab');
  const lon = page.getByRole('slider', { name: 'Географічна довгота' });
  await lon.focus();
  await page.keyboard.press('End');
  await expect(page.locator('output')).toHaveText('52° пн. ш., 180°');
  await page.getByRole('button', { name: 'Збільшити: Географічна довгота' }).click();
  await expect(page.locator('output')).toHaveText('52° пн. ш., 179° зх. д.');
});

test('place list moves the point', async ({ page }) => {
  await openPage(page, 'pl/lab');
  await page.getByText('Miejsca').click();
  await page.getByRole('button', { name: 'Przenieś punkt do: Kijów' }).click();
  await expect(page.locator('output')).toHaveText('50°N, 31°E');
  await expectNoAxeViolations(page, 'places open');
});
```
(Kyiv 50.45, 30.52 rounds to 50°N, 31°E.)

- [ ] **Step 7: Run** `npm run check && npm test && npm run build && npm run e2e` → PASS; `npm run shot -- "en/lab" lab-controls` and look at both sizes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(map): accessible coordinate sliders, live announcements and place list"
```

---

### Task 11: Earth cross-section view

**Files:**
- Create: `src/map/CrossSection.svelte`
- Modify: `src/map/MapStage.svelte` (render `cross-section`), `src/i18n/{en,pl,uk}.json`
- Test: `tests/e2e/cross-section.spec.ts`

**Interfaces:**
- Consumes: `mapState` (Task 7); `TROPIC`, `POLAR` (Task 8); `formatLat` (Task 2); `spokenLat` (Task 5).
- Produces: `CrossSection.svelte` (no props). Shows Earth as a circle cut through a meridian: equator plane (horizontal), axis (vertical, N/S poles), a radius from the centre to the point at the current latitude, the angle arc between the equator plane and that radius labelled with the latitude, and the point's parallel drawn as a dashed chord. Dragging the point along the circle or pressing ↑/↓ while focused changes latitude when `pointEditable`.

- [ ] **Step 1: i18n keys**

| key | en | pl | uk |
|---|---|---|---|
| cross.label | Cross-section of the Earth showing latitude as an angle | Przekrój Ziemi pokazujący szerokość geograficzną jako kąt | Переріз Землі, що показує широту як кут |
| cross.desc | Latitude is the angle between the equator plane and the line from the centre of the Earth to the point: {value}. | Szerokość geograficzna to kąt między płaszczyzną równika a linią od środka Ziemi do punktu: {value}. | Географічна широта — це кут між площиною екватора і лінією від центру Землі до точки: {value}. |
| cross.centre | centre of the Earth | środek Ziemi | центр Землі |
| cross.axis | Earth's axis | oś Ziemi | земна вісь |
| cross.parallel | parallel | równoleżnik | паралель |
| cross.northPole | N | N | Пн. |
| cross.southPole | S | S | Пд. |

- [ ] **Step 2: `src/map/CrossSection.svelte`**

```svelte
<script lang="ts">
  import { formatLat } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { spokenLat } from '../i18n/spoken';
  import { POLAR, TROPIC } from './geometry';
  import { mapState } from './mapState.svelte';

  const S = 400, C = 200, R = 140;
  const uid = `cross-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let dragging = false;

  const lat = $derived(mapState.point?.lat ?? 0);
  const rad = $derived((lat * Math.PI) / 180);
  const px = $derived(C + R * Math.cos(rad));
  const py = $derived(C - R * Math.sin(rad));
  const arcR = 55;
  const arc = $derived(`M ${C + arcR} ${C} A ${arcR} ${arcR} 0 0 ${lat >= 0 ? 0 : 1} ${C + arcR * Math.cos(rad)} ${C - arcR * Math.sin(rad)}`);
  const labelRad = $derived(rad / 2);

  function chordY(l: number) { return C - R * Math.sin((l * Math.PI) / 180); }
  function chordHalf(l: number) { return R * Math.cos((l * Math.PI) / 180); }

  function setFromPointer(e: PointerEvent) {
    const m = svg.getScreenCTM();
    if (!m || !mapState.point) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const angle = (Math.atan2(C - pt.y, Math.abs(pt.x - C)) * 180) / Math.PI;
    mapState.userSetPoint({ lat: angle, lon: mapState.point.lon }, 'map');
  }

  function onkeydown(e: KeyboardEvent) {
    if (!mapState.point) return;
    const s = mapState.stepSize(e.shiftKey);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      mapState.nudge(e.key === 'ArrowUp' ? s : -s, 0, 'map');
    }
  }
</script>

<figure class="cross">
  <svg bind:this={svg} viewBox="0 0 {S} {S}" role="img" aria-labelledby="{uid}-t {uid}-d" tabindex={mapState.pointEditable ? 0 : -1} {onkeydown}
    onpointerdown={(e) => { if (!mapState.pointEditable) return; dragging = true; svg.setPointerCapture(e.pointerId); setFromPointer(e); }}
    onpointermove={(e) => dragging && setFromPointer(e)}
    onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
    <title id="{uid}-t">{t('cross.label')}</title>
    <desc id="{uid}-d">{t('cross.desc', { value: spokenLat(lat, i18n.lang, mapState.precision) })}</desc>

    <circle cx={C} cy={C} r={R} class="earth" />
    {#if mapState.layers.tropics}
      {#each [TROPIC, -TROPIC, POLAR, -POLAR] as l (l)}
        <line x1={C - chordHalf(l)} x2={C + chordHalf(l)} y1={chordY(l)} y2={chordY(l)} class="tropic" />
      {/each}
    {/if}
    <line x1={C - R - 30} x2={C + R + 30} y1={C} y2={C} class="equator" />
    <text x={C - R - 28} y={C - 8} class="halo lbl equator-t" font-size="14">{t('line.equator')}</text>
    <line x1={C} x2={C} y1={C - R - 24} y2={C + R + 24} class="axis" />
    <text x={C + 6} y={C - R - 10} class="halo lbl" font-size="16">{t('cross.northPole')}</text>
    <text x={C + 6} y={C + R + 22} class="halo lbl" font-size="16">{t('cross.southPole')}</text>
    <line x1={C - chordHalf(lat)} x2={px} y1={py} y2={py} class="parallel" />
    <text x={C - chordHalf(lat) + 4} y={py - 6} class="halo lbl small" font-size="12">{t('cross.parallel')}</text>
    <line x1={C} y1={C} x2={px} y2={py} class="radius" />
    <path d={arc} class="angle" />
    <text x={C + (arcR + 30) * Math.cos(labelRad)} y={C - (arcR + 30) * Math.sin(labelRad) + 6} class="halo angle-t" font-size="20" text-anchor="middle">{formatLat(lat, i18n.lang, mapState.precision)}</text>
    <circle cx={C} cy={C} r="4" class="centre" />
    <g transform="translate({px} {py})" class:editable={mapState.pointEditable}>
      <circle r="22" fill="transparent" />
      <circle r="9" class="pt" />
    </g>
  </svg>
</figure>

<style>
  .cross { margin: 0; min-width: 0; }
  svg { display: block; width: 100%; max-width: min(100%, 60vh); margin-inline: auto; height: auto; touch-action: none; }
  svg:focus-visible { outline: 3px solid var(--focus); border-radius: var(--radius); }
  .earth { fill: var(--ocean); stroke: var(--land-stroke); stroke-width: 2; }
  .equator { stroke: var(--equator); stroke-width: 3; }
  .axis { stroke: var(--text-muted); stroke-width: 2; stroke-dasharray: 8 6; }
  .tropic { stroke: var(--tropics); stroke-width: 1.5; stroke-dasharray: 2 4; }
  .parallel { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 4; }
  .radius { stroke: var(--accent); stroke-width: 3; }
  .angle { fill: none; stroke: var(--marker-b); stroke-width: 4; }
  .angle-t { fill: var(--marker-b); font-weight: 800; }
  .lbl { fill: var(--text); } .equator-t { fill: var(--equator); }
  .centre { fill: var(--text); }
  .pt { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
  .editable { cursor: grab; }
</style>
```

- [ ] **Step 3: MapStage** — import `CrossSection` and extend the view branch: `{#if v === 'globe'}<Globe />{:else if v === 'flat'}<FlatMap />{:else}<CrossSection />{/if}`.

- [ ] **Step 4: E2E** `tests/e2e/cross-section.spec.ts` — no page shows the cross-section until Task 12, and the lab must stay globe + flat, so tests drive `mapState` through a test hook. In `src/main.ts` add a static import and:

```ts
import { mapState } from './map/mapState.svelte';

if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
  (window as unknown as { __mapState: typeof mapState }).__mapState = mapState;
}
```
Real visitors never load the page with `?test`. `helpers.openPage` gains an optional `query` argument (`file://…?test#hash`). Then:

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('cross-section shows the latitude angle and follows the point', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => {
    const s = (window as any).__mapState;
    s.applyScene({ views: ['cross-section'], point: { lat: 52, lon: 21 }, pointEditable: true });
  });
  const img = page.getByRole('img', { name: /Cross-section of the Earth/ });
  await expect(img).toBeVisible();
  await expect(img.locator('text.angle-t')).toHaveText('52°N');
  await img.focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(img.locator('text.angle-t')).toHaveText('42°N');
  await expectNoAxeViolations(page, 'cross-section');
});
```
Update `openPage(page, hash = 'en/', query = '')` to navigate to `` `file://${DIST_FILE}${query}#${hash}` ``.

- [ ] **Step 5: Run** all checks; `npm run shot` is not needed (scene set by script) — instead add `await page.screenshot({ path: 'shots/cross-section.png' })` temporarily in the spec, look at it, then remove the line.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(map): Earth cross-section view showing latitude as an angle"
```
