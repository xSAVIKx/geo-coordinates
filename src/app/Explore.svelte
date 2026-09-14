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
    <p class="progress eyebrow">{t('explore.progress', { n: index + 1, total })}</p>
    <h2 id="step-title" tabindex="-1" bind:this={heading}>{t(`topic.${topic.id}.step.${current.id}.title`)}</h2>
    {#key index}<p class="body">{t(`topic.${topic.id}.step.${current.id}.body`)}</p>{/key}
    {#if current.illustration === 'map-pin'}
      <!-- Decorative (the step text says it all): a generic map pin with a decimal coordinate pair under it — no app's look. -->
      <svg class="illustration" viewBox="0 0 240 132" aria-hidden="true">
        <rect x="1" y="1" width="238" height="130" rx="14" class="ill-map" />
        <path d="M1 44h238M1 88h238M60 1v130M120 1v130M180 1v130" class="ill-grid" />
        <path d="M120 70c-17-18-25-30-25-41a25 25 0 0 1 50 0c0 11-8 23-25 41z" class="ill-pin" />
        <circle cx="120" cy="29" r="9" class="ill-dot" />
        <rect x="18" y="84" width="204" height="34" rx="17" class="ill-chip" />
        <!-- textLength pins the text to the chip's inner width, whatever font the system picks. -->
        <text x="120" y="106" text-anchor="middle" textLength="176" lengthAdjust="spacingAndGlyphs" class="ill-text">50.2649, 19.0238</text>
      </svg>
    {/if}
    <div class="nav">
      <button type="button" class="btn" onclick={() => go(index - 1)} disabled={index === 0}>← {t('explore.prev')}</button>
      {#if index < total - 1}
        <button type="button" class="btn primary" onclick={() => go(index + 1)}>{t('explore.next')} →</button>
      {:else if topic.questionTypes.length > 0}
        <a class="btn primary" href={formatRoute({ name: 'practice', lang: i18n.lang, topic: topic.id })}>{t('explore.practiceNow')} →</a>
      {:else}
        <a class="btn primary" href={formatRoute({ name: 'home', lang: i18n.lang })}>{t('explore.backHome')}</a>
      {/if}
    </div>
    <ol class="dots">
      {#each topic.steps as s, i (s.id)}
        <li><button type="button" class:done={i < index} aria-current={i === index ? 'step' : undefined} aria-label={t('explore.goto', { n: i + 1 })} onclick={() => go(i)}>{i + 1}</button></li>
      {/each}
    </ol>
    <p class="hint">{t('explore.keysHint')}</p>
  </aside>
</div>

<style>
  .explore { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 1024px) {
    .explore { grid-template-columns: minmax(0, 1fr) clamp(20rem, 20vw, 25rem); gap: var(--space-5); align-items: start; }
    .panel { position: sticky; top: calc(var(--header-h) + var(--space-4)); }

    /* Presenter type is a quarter of the viewport bigger: the step panel widens with it so a title keeps to a line or two. */
    :global(:root[data-presenter='true']) .explore { grid-template-columns: minmax(0, 1fr) min(30rem, 32vw); }
  }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-5) var(--space-6) var(--space-4); }
  h2 { margin: var(--space-1) 0 var(--space-3); font-size: var(--step-3); font-weight: var(--weight-heavy); }
  h2:focus { outline: none; }
  /* Focused by the page itself (a new step, question or result) for screen readers: a quiet bar at the side, not a frame round the heading. */
  h2:focus-visible { outline: none; box-shadow: -0.35rem 0 0 var(--focus); }
  @media (forced-colors: active) { h2:focus-visible { outline: 2px solid Highlight; } }
  .body { margin: 0 0 var(--space-5); font-size: var(--step-1); line-height: 1.55; max-width: var(--measure); animation: rise 260ms var(--ease) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .illustration { display: block; width: min(100%, 15rem); height: auto; margin: 0 0 var(--space-5); }
  .ill-map { fill: var(--ocean); stroke: var(--border); stroke-width: 2; }
  .ill-grid { fill: none; stroke: var(--grid); stroke-width: 1.5; opacity: 0.6; }
  .ill-pin { fill: var(--warm); stroke: var(--halo); stroke-width: 3; }
  .ill-dot { fill: var(--surface); }
  .ill-chip { fill: var(--surface); stroke: var(--border-strong); stroke-width: 1.5; }
  .ill-text { fill: var(--text); font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .nav { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: space-between; }
  .nav .primary { margin-left: auto; }
  .dots { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-1); padding: var(--space-4) 0 0; margin: var(--space-4) 0 0; border-top: 1px solid var(--border); }
  .dots button { border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-weight: var(--weight-strong); font-size: var(--step--1); font-variant-numeric: tabular-nums; transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease); }
  .dots button:hover { border-color: var(--border-strong); color: var(--text); }
  .dots button.done { background: var(--accent-soft); color: var(--text); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
  .dots button[aria-current='step'] { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  @media (forced-colors: active) { .dots button[aria-current='step'] { background: Highlight; color: HighlightText; forced-color-adjust: none; } }
  .hint { color: var(--text-muted); font-size: var(--step--1); margin: var(--space-3) 0 0; }
  @media (hover: none) { .hint { display: none; } }
  @media (max-width: 599px) { .panel { padding: var(--space-4); } }
</style>
