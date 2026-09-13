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
