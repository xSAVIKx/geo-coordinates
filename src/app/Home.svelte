<script lang="ts">
  import { i18n, t } from '../i18n/i18n.svelte';
  import { TOPIC_IDS } from './ids';
  import { formatRoute } from './router';
  import { getTopic } from '../topics';
  import { bestScore, scoreId } from '../quiz/scores';
  import type { Difficulty } from '../quiz/types';
  import type { TopicId } from './ids';

  const ROUND = 10;
  const DIFFS: Difficulty[] = ['hard', 'medium', 'easy'];
  // Best practice score per topic over all difficulties (the harder level wins a tie). Loaded into state
  // when Home mounts (every visit to Home mounts it again) and reloaded when another tab saves a score, so
  // a round just finished always shows — unlike a bare bestScore() call in the template, which is not reactive.
  type Best = { score: number; difficulty: Difficulty } | null;
  const readBest = (id: TopicId): Best => {
    let best: Best = null;
    for (const d of DIFFS) {
      const s = bestScore(scoreId(id, d));
      if (s !== null && (best === null || s > best.score)) best = { score: s, difficulty: d };
    }
    return best;
  };
  let bests = $state<Partial<Record<TopicId, Best>>>({});
  $effect(() => {
    const load = () => { bests = Object.fromEntries(TOPIC_IDS.map((id) => [id, readBest(id)])); };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  });

  const modes = [
    { key: 'rehearsal', route: 'rehearsal' },
    { key: 'classQuiz', route: 'class-quiz' },
    { key: 'lab', route: 'lab' },
    { key: 'cheatsheet', route: 'cheatsheet' },
  ] as const;
</script>

<section class="hero">
  <div class="hero-text">
    <h1 tabindex="-1">{t('app.title')}</h1>
    <p class="intro">{t('home.intro')}</p>
  </div>
  <svg class="hero-art" viewBox="0 0 240 240" aria-hidden="true">
    <circle cx="120" cy="120" r="104" class="art-sea" />
    <g class="art-grid">
      <ellipse cx="120" cy="120" rx="36" ry="104" />
      <ellipse cx="120" cy="120" rx="74" ry="104" />
      <path d="M120 16v208M30 68h180M18 94h204M30 172h180M18 146h204" />
    </g>
    <path d="M16 120h208" class="art-eq" />
    <circle cx="120" cy="120" r="104" class="art-rim" />
    <path d="M161 81v39M120 81h41" class="art-guide" />
    <circle cx="161" cy="81" r="9" class="art-pt" />
  </svg>
</section>

<h2 class="section-title">{t('home.topics')}</h2>
<ol class="cards">
  {#each TOPIC_IDS as id (id)}
    <li class="card">
      <span class="badge" aria-hidden="true">{id}</span>
      <div class="card-body">
        <h3><a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: id, step: 0 })}>{t(`topic.${id}.title`)}</a></h3>
        <p>{t(`topic.${id}.summary`)}</p>
        {#if (getTopic(id)?.questionTypes.length ?? 0) > 0}
          {@const best = bests[id]}
          {#if best}
            <p class="progress" class:perfect={best.score === ROUND}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">{#if best.score === ROUND}<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />{:else}<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />{/if}</svg>
              <span aria-hidden="true">{t('home.best', { score: best.score, total: ROUND, level: t(`difficulty.${best.difficulty}`).toLocaleLowerCase(i18n.lang) })}</span>
              <span class="visually-hidden">{t('home.bestLong', { score: best.score, total: ROUND, level: t(`difficulty.${best.difficulty}`).toLocaleLowerCase(i18n.lang) })}</span>
            </p>
          {:else if bests[id] === null}
            <p class="progress none">{t('home.notPractised')}</p>
          {/if}
          <a class="btn practise" href={formatRoute({ name: 'practice', lang: i18n.lang, topic: id })}>{t('home.practice')}<span class="visually-hidden">: {t(`topic.${id}.title`)}</span></a>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<h2 class="section-title">{t('home.more')}</h2>
<ul class="cards modes">
  {#each modes as m (m.key)}
    <li class="card">
      <svg class="mode-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        {#if m.key === 'rehearsal'}<path d="M9 5h10M9 12h10M9 19h10M3.5 5l1.5 1.5L7.5 4M3.5 12l1.5 1.5 2.5-2.5M4 18.2h2.5v2H4z" />
        {:else if m.key === 'classQuiz'}<path d="M3 4.5h18v11H3zM12 15.5V20M8 20h8M8 11l2.5-2.5 2 2L16 7" />
        {:else if m.key === 'cheatsheet'}<path d="M6 2.8h8.5L19 7.3v13.9H6zM14.3 3v4.5H19M9 11h7M9 14.5h7M9 18h4.5" />
        {:else}<circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />{/if}
      </svg>
      <div class="card-body">
        <h3>
          {#if m.route === 'class-quiz'}
            <a href={formatRoute({ name: 'class-quiz', lang: i18n.lang, seed: null })}>{t(`mode.${m.key}.title`)}</a>
          {:else}
            <a href={formatRoute({ name: m.route, lang: i18n.lang })}>{t(`mode.${m.key}.title`)}</a>
          {/if}
        </h3>
        <p>{t(`mode.${m.key}.summary`)}</p>
      </div>
    </li>
  {/each}
</ul>

<style>
  .hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-6); margin: var(--space-2) 0 var(--space-6); padding: var(--space-6) var(--space-10); border-radius: var(--radius-lg); overflow: hidden;
    background: radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 55%), linear-gradient(180deg, var(--surface), color-mix(in srgb, var(--surface) 70%, var(--bg)));
    border: 1px solid var(--border); box-shadow: var(--shadow-2); }
  h1 { font-size: var(--step-4); font-weight: var(--weight-heavy); margin: 0 0 var(--space-3); }
  .intro { font-size: var(--step-1); max-width: var(--measure); color: var(--text-muted); margin: 0; }
  .hero-art { width: clamp(8rem, 13vw, 13rem); height: auto; }
  .art-sea { fill: var(--ocean); }
  .art-grid { fill: none; stroke: var(--grid); stroke-width: 1.5; opacity: 0.6; }
  .art-eq { stroke: var(--equator); stroke-width: 4; stroke-linecap: round; }
  .art-rim { fill: none; stroke: var(--accent); stroke-width: 4; }
  .art-guide { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-dasharray: 6 5; }
  .art-pt { fill: var(--warm); stroke: var(--surface); stroke-width: 4; }
  @media (max-width: 719px) {
    .hero { grid-template-columns: 1fr; padding: var(--space-6) var(--space-5); margin-bottom: var(--space-6); }
    .hero-art { position: absolute; right: -2.5rem; top: -2.5rem; width: 9rem; opacity: 0.35; }
    .hero-text { position: relative; }
  }
  @media (max-width: 479px) { .hero-art { display: none; } }

  .section-title { font-size: var(--step-2); margin: var(--space-8) 0 var(--space-4); }
  /* Nine topics and three modes: one column on phones, two on tablets (an odd last card spans the
     row instead of sitting alone), three from 1024px — a balanced 3×3 of topics over a row of 3 modes. */
  .cards { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 600px) {
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cards > .card:last-child:nth-child(odd) { grid-column: 1 / -1; }
  }
  @media (min-width: 1024px) {
    .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5); }
    .cards > .card:last-child:nth-child(odd) { grid-column: auto; }
    /* Four modes: a row of four, so none sits alone under the topic grid. */
    .modes { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  .card { position: relative; display: flex; gap: var(--space-4); align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-1); transition: box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease), border-color var(--dur) var(--ease); }
  .card:hover { box-shadow: var(--shadow-3); transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
  .card-body { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); min-width: 0; height: 100%; }
  .card h3 { margin: 0; font-size: var(--step-1); font-weight: var(--weight-heavy); }
  .card h3 a { color: var(--text); text-decoration: none; }
  .card h3 a::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius-lg); }
  .card:hover h3 a { color: var(--accent); }
  .card h3 a:focus-visible { outline: none; }
  .card:has(h3 a:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .card p { margin: 0; color: var(--text-muted); flex: 1; }
  .card .progress { flex: none; display: inline-flex; align-items: center; gap: var(--space-1); margin-top: var(--space-1); padding: 0.1rem var(--space-3) 0.1rem var(--space-2); border-radius: var(--radius-pill); background: var(--warm-soft); color: var(--warm-text); font-size: var(--step--1); font-weight: var(--weight-strong); }
  .progress svg { flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .progress.perfect svg { fill: var(--warm); stroke: var(--warm-text); stroke-width: 1.2; }
  .card .progress.none { background: var(--surface-2); color: var(--text-muted); padding-left: var(--space-3); font-weight: 500; }
  .practise { position: relative; z-index: 1; margin-top: var(--space-2); padding: 0 var(--space-4); font-size: var(--step--1); }
  .mode-icon { flex: none; width: 2.5rem; height: 2.5rem; padding: 0.5rem; border-radius: 0.8rem; background: var(--accent-soft); fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>
