<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import Home from './Home.svelte';
  import LabPage from './LabPage.svelte';
  import TopicPage from './TopicPage.svelte';
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

<a class="skip" href="#main" onclick={skip}>{t('app.skip')}</a>
<Header />
<main id="main" bind:this={main}>
  {#if route.name === 'lab'}
    <LabPage />
  {:else if route.name === 'explore'}
    <TopicPage topic={route.topic} tab="explore" step={route.step} />
  {:else if route.name === 'practice'}
    <TopicPage topic={route.topic} tab="practice" step={0} />
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
