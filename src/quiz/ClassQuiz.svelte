<script lang="ts">
  import { untrack } from 'svelte';
  import { TOPIC_IDS, type TopicId } from '../app/ids';
  import { navigate } from '../app/router.svelte';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import Countdown from './Countdown.svelte';
  import { describeAnswer, generateSet, modulesForTopic } from './registry';
  import type { Difficulty } from './types';

  let { seed: routeSeed }: { seed: string | null } = $props();

  const available = TOPIC_IDS.filter((id) => modulesForTopic(id).length > 0);
  let phase = $state<'setup' | 'run'>('setup');
  // Only the seed the route was opened with seeds the editable setup field; a later change to
  // routeSeed (e.g. the URL's `?seed=` after Start navigates with `replace`) must not overwrite
  // whatever the operator is typing, so this deliberately captures the initial value only.
  let seed = $state(untrack(() => routeSeed) ?? Math.random().toString(36).slice(2, 6));
  let difficulty = $state<Difficulty>('medium');
  let chosen = $state<TopicId[]>([...available]);
  let count = $state(10);
  let timer = $state(0);
  let index = $state(0);
  let revealed = $state(false);
  let timeUp = $state(false);
  let noTopics = $state(false);

  const questions = $derived(phase === 'run' ? generateSet(seed, chosen, difficulty, count) : []);
  const question = $derived(questions[index]);
  const letters = ['A', 'B', 'C', 'D'];

  // Questions with `pointEditable` (place-point) show read-only in class mode until reveal, which
  // adds the answer marker via `question.solution`; read-coords questions hide the readout until
  // reveal is set below.
  $effect(() => {
    if (phase !== 'run' || !question) return;
    void index;
    mapState.applyScene({ ...question.scene, pointEditable: false });
    revealed = false;
    timeUp = false;
  });

  function start(e: SubmitEvent) {
    e.preventDefault();
    if (chosen.length === 0) { noTopics = true; return; }
    noTopics = false;
    const clean = seed.trim().replace(/[^\w-]/g, '').slice(0, 32) || 'class';
    seed = clean;
    navigate({ name: 'class-quiz', lang: i18n.lang, seed: clean }, { replace: true });
    index = 0;
    phase = 'run';
  }

  function reveal() {
    if (!question || revealed) return;
    revealed = true;
    mapState.showReadout = true;
    mapState.addOverlays(question.solution);
  }

  function go(delta: number) {
    const n = index + delta;
    if (n >= 0 && n < questions.length) index = n;
  }

  $effect(() => {
    if (phase !== 'run') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      if (el?.closest('input, [role="slider"], svg[tabindex], dialog')) return;
      if (e.key === ' ' || e.key === 'Enter') { if (el?.closest('button, a')) return; e.preventDefault(); reveal(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); phase = 'setup'; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if phase === 'setup'}
  <form class="card setup" onsubmit={start}>
    <h2>{t('classQuiz.setup')}</h2>
    <label class="field">{t('classQuiz.seed')}<input type="text" bind:value={seed} maxlength="32" autocomplete="off" /></label>
    <fieldset>
      <legend>{t('practice.difficulty')}</legend>
      {#each ['easy', 'medium', 'hard'] as d (d)}
        <label><input type="radio" name="cq-difficulty" value={d} bind:group={difficulty} /> {t(`difficulty.${d}`)}</label>
      {/each}
    </fieldset>
    <fieldset aria-describedby={noTopics ? 'cq-no-topics' : undefined}>
      <legend>{t('classQuiz.topics')}</legend>
      {#each available as id (id)}
        <label><input type="checkbox" value={id} bind:group={chosen} /> {id}. {t(`topic.${id}.title`)}</label>
      {/each}
      {#if noTopics}<p id="cq-no-topics" class="err" role="alert">{t('classQuiz.noTopics')}</p>{/if}
    </fieldset>
    <fieldset>
      <legend>{t('classQuiz.count')}</legend>
      {#each [5, 10, 15] as n (n)}<label><input type="radio" name="cq-count" value={n} bind:group={count} /> {n}</label>{/each}
    </fieldset>
    <fieldset>
      <legend>{t('classQuiz.timer')}</legend>
      {#each [0, 15, 30, 60] as s (s)}<label><input type="radio" name="cq-timer" value={s} bind:group={timer} /> {s === 0 ? t('classQuiz.timerOff') : t('classQuiz.seconds', { n: s })}</label>{/each}
    </fieldset>
    <button type="submit" class="btn primary lg">{t('classQuiz.start')}</button>
  </form>
{:else if question}
  <section class="run" aria-labelledby="cq-prompt">
    <div class="top">
      <p class="progress eyebrow">{t('practice.progress', { n: index + 1, total: questions.length })}</p>
      {#if timer > 0}{#key index}<Countdown seconds={timer} running={!revealed} ondone={() => (timeUp = true)} />{/key}{/if}
    </div>
    <h2 id="cq-prompt" class="prompt">{renderText(question.prompt)}</h2>
    {#if timeUp && !revealed}<p class="timeup">{t('classQuiz.timeUp')}</p>{/if}
    <div class="body">
      <div class="map"><MapStage /></div>
      <div class="side">
        {#if question.input.kind === 'choice'}
          <ol class="options">
            {#each question.input.options as o, i (i)}
              {@const correct = revealed && question.answer.kind === 'choice' && question.answer.index === i}
              <li class:correct><span class="letter" aria-hidden="true">{letters[i]}</span> {renderText(o)}{#if correct} <span class="tick">✓</span><span class="visually-hidden">({t('practice.resultCorrect')})</span>{/if}</li>
            {/each}
          </ol>
        {/if}
        <div aria-live="polite">
          {#if revealed}
            <p class="answer">{t('classQuiz.answer', { answer: renderText(describeAnswer(question)) })}</p>
            <p class="why">{renderText(question.explanation)}</p>
          {/if}
        </div>
      </div>
    </div>
    <div class="controls">
      <button type="button" class="btn lg" onclick={() => go(-1)} disabled={index === 0}>← {t('classQuiz.prev')}</button>
      <button type="button" class="btn primary lg" onclick={reveal} disabled={revealed}>{t('classQuiz.reveal')}</button>
      <button type="button" class="btn lg" onclick={() => go(1)} disabled={index === questions.length - 1}>{t('classQuiz.next')} →</button>
      <button type="button" class="btn quiet lg" onclick={() => (phase = 'setup')}>{t('classQuiz.end')}</button>
    </div>
    <p class="keys">{t('classQuiz.keys')}</p>
  </section>
{/if}

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-5) var(--space-6) var(--space-6); max-width: 48rem; }
  .setup h2 { margin: 0 0 var(--space-2); font-size: var(--step-2); font-weight: var(--weight-heavy); }
  .setup fieldset { border: 1px solid var(--border); border-radius: var(--radius); margin: var(--space-3) 0; padding: var(--space-2) var(--space-4); display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
  .setup label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: var(--tap); }
  .field { display: flex !important; flex-direction: column; align-items: stretch !important; font-weight: var(--weight-strong); gap: var(--space-1); margin: var(--space-3) 0; }
  .field input { min-height: var(--tap); font-size: var(--step-1); padding: 0 var(--space-3); border: 2px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); max-width: 16rem; }
  .field input:focus-visible { outline: 2px solid transparent; outline-offset: 2px; border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus); }
  .err { color: var(--bad); font-weight: var(--weight-strong); width: 100%; margin: 0; }

  .run { display: flex; flex-direction: column; gap: var(--space-3); }
  .top { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  .progress { margin: 0; font-size: clamp(1rem, 1.5vw, 1.6rem); }
  .prompt { font-size: clamp(1.6rem, 1rem + 3vw, 4.5rem); line-height: 1.15; margin: 0; font-weight: var(--weight-heavy); }
  .timeup { color: var(--bad); font-weight: var(--weight-heavy); font-size: clamp(1.2rem, 2vw, 2.4rem); margin: 0; }
  .body { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .body { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; } }
  .options { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
  .options li { display: flex; gap: var(--space-3); align-items: center; font-size: clamp(1.2rem, 0.8rem + 1.8vw, 2.6rem); padding: var(--space-3) var(--space-4); border: 3px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .options li.correct { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, var(--surface)); font-weight: var(--weight-heavy); }
  .letter { flex: none; width: 1.8em; height: 1.8em; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); border: 2px solid var(--border-strong); font-weight: var(--weight-heavy); }
  .tick { color: var(--ok); }
  .answer { font-size: clamp(1.3rem, 0.9rem + 2vw, 3rem); font-weight: var(--weight-heavy); color: var(--ok); margin: var(--space-3) 0 var(--space-1); }
  .why { font-size: clamp(1.05rem, 0.8rem + 1vw, 1.8rem); margin: 0; }
  .controls { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .keys { color: var(--text-muted); margin: 0; }
  @media (hover: none) { .keys { display: none; } }
</style>
