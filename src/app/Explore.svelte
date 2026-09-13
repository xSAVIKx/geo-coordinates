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
