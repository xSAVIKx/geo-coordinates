<script lang="ts">
  import type { TopicId } from './ids';
  import { TOPIC_IDS } from './ids';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { getTopic } from '../topics';
  import Explore from './Explore.svelte';
  import Practice from '../quiz/Practice.svelte';
  import { formatRoute } from './router';

  let { topic, tab, step }: { topic: TopicId; tab: 'explore' | 'practice'; step: number } = $props();
  const def = $derived(getTopic(topic));
  const prev = $derived(TOPIC_IDS[TOPIC_IDS.indexOf(topic) - 1]);
  const next = $derived(TOPIC_IDS[TOPIC_IDS.indexOf(topic) + 1]);
</script>

<div class="head">
  <h1 tabindex="-1"><span class="badge" aria-hidden="true">{topic}</span> {t(`topic.${topic}.title`)}</h1>
  <nav class="tabs" aria-label={t('topic.nav')}>
    <a href={formatRoute({ name: 'explore', lang: i18n.lang, topic, step: 0 })} aria-current={tab === 'explore' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5.5c2.7-1 5.3-1 8 .8 2.7-1.8 5.3-1.8 8-.8v13c-2.7-1-5.3-1-8 .8-2.7-1.8-5.3-1.8-8-.8zM12 6.3v13" /></svg>
      {t('topic.explore')}
    </a>
    <a href={formatRoute({ name: 'practice', lang: i18n.lang, topic })} aria-current={tab === 'practice' ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></svg>
      {t('topic.practice')}
    </a>
  </nav>
</div>

{#if !def}
  <p>{t('topic.soon')}</p>
{:else if tab === 'explore'}
  <Explore topic={def} {step} />
{:else}
  <Practice topic={def} />
{/if}

<nav class="pager" aria-label={t('home.topics')}>
  {#if prev}<a class="btn quiet" href={formatRoute({ name: 'explore', lang: i18n.lang, topic: prev, step: 0 })}>← {t('topic.prev', { title: t(`topic.${prev}.title`) })}</a>{:else}<span></span>{/if}
  {#if next}<a class="btn quiet" href={formatRoute({ name: 'explore', lang: i18n.lang, topic: next, step: 0 })}>{t('topic.next', { title: t(`topic.${next}.title`) })} →</a>{/if}
</nav>

<style>
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2) var(--space-6); margin: var(--space-1) 0 var(--space-4); }
  h1 { display: flex; gap: var(--space-3); align-items: center; font-size: var(--step-3); font-weight: var(--weight-heavy); margin: 0; min-width: 0; }
  h1 .badge { width: 2.75rem; height: 2.75rem; font-size: var(--step-1); letter-spacing: 0; }
  .tabs { display: inline-flex; gap: 2px; padding: 3px; background: var(--surface-2); border: 1px solid var(--border); border-radius: calc(var(--radius-sm) + 3px); }
  .tabs a { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-5); color: var(--text); text-decoration: none; font-weight: var(--weight-strong); border-radius: var(--radius-sm); border: 1px solid transparent; transition: background-color var(--dur) var(--ease); }
  .tabs a:hover { background: var(--surface); }
  .tabs svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; opacity: 0.8; }
  .tabs a[aria-current='page'] { background: var(--surface); border-color: var(--border-strong); box-shadow: var(--shadow-1), inset 0 -3px 0 var(--accent); }
  .tabs a[aria-current='page'] svg { stroke: var(--accent); opacity: 1; }
  @media (max-width: 599px) {
    .head { gap: var(--space-3); margin-bottom: var(--space-3); }
    .tabs { display: flex; width: 100%; }
    .tabs a { flex: 1 1 0; min-width: 0; justify-content: center; padding: 0 var(--space-2); text-align: center; }
    h1 .badge { width: 2.25rem; height: 2.25rem; }
  }
  @media (max-width: 399px) { .tabs svg { display: none; } }
  .pager { display: flex; justify-content: space-between; gap: var(--space-2) var(--space-4); flex-wrap: wrap; margin-top: var(--space-8); padding-top: var(--space-4); border-top: 1px solid var(--border); }
  .pager a { color: var(--accent); justify-content: flex-start; text-align: left; padding: var(--space-2) var(--space-3); }
  .pager a:last-child { margin-left: auto; text-align: right; }
</style>
