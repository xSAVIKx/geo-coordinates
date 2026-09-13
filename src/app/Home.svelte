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
