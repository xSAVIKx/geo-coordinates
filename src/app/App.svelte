<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import Home from './Home.svelte';
  import CheatSheet from './CheatSheet.svelte';
  import LabPage from './LabPage.svelte';
  import TopicPage from './TopicPage.svelte';
  import Worksheet from './Worksheet.svelte';
  import Footer from './Footer.svelte';
  import LiveRegion from './LiveRegion.svelte';
  import Laser from './Laser.svelte';
  import Rehearsal from '../quiz/Rehearsal.svelte';
  import ClassQuiz from '../quiz/ClassQuiz.svelte';
  import { router, startRouter } from './router.svelte';
  import { applySettings, initSettings, saveSettings, settings } from './settings.svelte';
  import { installPresenter, presenter } from './presenter.svelte';
  import { layout } from './layout.svelte';
  import { t } from '../i18n/i18n.svelte';

  initSettings();
  onMount(() => {
    const stopRouter = startRouter();
    const stopPresenter = installPresenter();
    return () => { stopRouter(); stopPresenter(); };
  });

  $effect(() => {
    void settings.theme; void settings.largeText; void settings.reducedMotion;
    applySettings();
    saveSettings();
  });
  $effect(() => {
    document.title = t('app.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'));
  });

  let main: HTMLElement;
  const route = $derived(router.route);
  const focusKey = $derived(`${route.name}:${'topic' in route ? route.topic : ''}`);
  // previousKey starts null so the very first run (whatever route that is, including a deep
  // link) never focuses the h1 — router.route is initialised synchronously at module load
  // (see router.svelte.ts) with the real route, so this first run already sees the correct
  // value and there is no later "correction" from onMount that could be mistaken for a change.
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

<a class="skip no-print" href="#main" onclick={skip}>{t('app.skip')}</a>
<Header />
<main id="main" bind:this={main} data-wide={layout.wide || undefined}>
  {#if route.name === 'lab'}
    <LabPage />
  {:else if route.name === 'explore'}
    <TopicPage topic={route.topic} tab="explore" step={route.step} />
  {:else if route.name === 'practice'}
    <TopicPage topic={route.topic} tab="practice" step={0} />
  {:else if route.name === 'rehearsal'}
    <h1 tabindex="-1">{t('mode.rehearsal.title')}</h1>
    <Rehearsal />
  {:else if route.name === 'cheatsheet'}
    <CheatSheet />
  {:else if route.name === 'worksheet'}
    <Worksheet />
  {:else if route.name === 'class-quiz'}
    <h1 tabindex="-1">{t('mode.classQuiz.title')}</h1>
    <ClassQuiz seed={route.seed} />
  {:else}
    <Home />
  {/if}
  {#if presenter.on}<p class="presenter-hint no-print">{t('presenter.hint')}</p>{/if}
</main>
<!-- Presenter mode shows the lesson only: the credits stay on the normal page. -->
{#if !presenter.on}<Footer />{/if}
<LiveRegion />
<Laser />

<style>
  .skip { position: absolute; left: var(--space-2); top: -12rem; z-index: 100; background: var(--surface); color: var(--text); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); border: 2px solid var(--focus); box-shadow: var(--shadow-3); font-weight: var(--weight-strong); }
  .skip:focus { top: var(--space-2); }
  main { flex: 1 0 auto; width: 100%; max-width: var(--page-max); margin-inline: auto; padding: var(--space-4) var(--space-6) var(--space-8); }
  .presenter-hint { margin: var(--space-6) 0 0; color: var(--text-muted); font-size: var(--step--1); text-align: end; }
  @media (hover: none) { .presenter-hint { display: none; } }
  /* A class quiz run: the whole window, with the page title reduced to a quiet line above the question. */
  main[data-wide] { max-width: none; }
  main[data-wide] > h1 { font-size: clamp(1rem, 0.7rem + 0.6vw, 1.8rem); color: var(--text-muted); margin: 0 0 var(--space-2); }
  @media (max-width: 599px) { main { padding: var(--space-3) var(--space-3) var(--space-6); } }
</style>
