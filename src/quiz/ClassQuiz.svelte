<script lang="ts">
  import { untrack } from 'svelte';
  import { announce } from '../app/announcer.svelte';
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
  let prompt = $state<HTMLHeadingElement>();

  // Questions with `pointEditable` (place-point) show read-only in class mode until reveal, which
  // adds the answer marker via `question.solution`; read-coords questions hide the readout until
  // reveal is set below.
  let lastIndex = -1;
  $effect(() => {
    if (phase !== 'run' || !question) return;
    void index;
    mapState.applyScene({ ...question.scene, pointEditable: false });
    revealed = false;
    timeUp = false;
    // The first question of a run gets focus from the normal flow (the Start button click, or the
    // page's own route-change focus handling); only a later navigation needs to move focus and
    // announce the new position explicitly.
    const first = lastIndex === -1;
    lastIndex = index;
    if (!first) {
      queueMicrotask(() => prompt?.focus());
      announce(t('practice.progress', { n: index + 1, total: questions.length }), 'polite');
    }
  });

  function start(e: SubmitEvent) {
    e.preventDefault();
    if (chosen.length === 0) { noTopics = true; return; }
    noTopics = false;
    const clean = seed.trim().replace(/[^\w-]/g, '').slice(0, 32) || 'class';
    seed = clean;
    navigate({ name: 'class-quiz', lang: i18n.lang, seed: clean }, { replace: true });
    index = 0;
    lastIndex = -1;
    phase = 'run';
  }

  function reveal() {
    if (!question || revealed) return;
    revealed = true;
    mapState.showReadout = true;
    mapState.addOverlays(question.solution, { animate: true });
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
    <div class="setup-head">
      <svg class="setup-art" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5h18v11H3zM12 15.5V20M8 20h8M8 11l2.5-2.5 2 2L16 7" /></svg>
      <h2>{t('classQuiz.setup')}</h2>
    </div>
    <label class="field">{t('classQuiz.seed')}<input type="text" bind:value={seed} maxlength="32" autocomplete="off" spellcheck="false" /></label>
    <fieldset>
      <legend>{t('practice.difficulty')}</legend>
      <div class="seg">
        {#each ['easy', 'medium', 'hard'] as d (d)}
          <label><input type="radio" name="cq-difficulty" value={d} bind:group={difficulty} /> {t(`difficulty.${d}`)}</label>
        {/each}
      </div>
    </fieldset>
    <fieldset aria-describedby={noTopics ? 'cq-no-topics' : undefined}>
      <legend>{t('classQuiz.topics')}</legend>
      <div class="topics">
        {#each available as id (id)}
          <label class="topic"><input type="checkbox" value={id} bind:group={chosen} /><span class="num" aria-hidden="true">{id}</span><span class="visually-hidden">{id}.</span> {t(`topic.${id}.title`)}</label>
        {/each}
      </div>
      {#if noTopics}<p id="cq-no-topics" class="err" role="alert">{t('classQuiz.noTopics')}</p>{/if}
    </fieldset>
    <div class="pair">
      <fieldset>
        <legend>{t('classQuiz.count')}</legend>
        <div class="seg">
          {#each [5, 10, 15] as n (n)}<label><input type="radio" name="cq-count" value={n} bind:group={count} /> {n}</label>{/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('classQuiz.timer')}</legend>
        <div class="seg">
          {#each [0, 15, 30, 60] as s (s)}<label><input type="radio" name="cq-timer" value={s} bind:group={timer} /> {s === 0 ? t('classQuiz.timerOff') : t('classQuiz.seconds', { n: s })}</label>{/each}
        </div>
      </fieldset>
    </div>
    <button type="submit" class="btn primary lg">{t('classQuiz.start')} <span aria-hidden="true">→</span></button>
  </form>
{:else if question}
  <section class="run" aria-labelledby="cq-prompt">
    <div class="top">
      <p class="progress eyebrow">{t('practice.progress', { n: index + 1, total: questions.length })}</p>
      {#if timer > 0}{#key index}<Countdown seconds={timer} running={!revealed} ondone={() => (timeUp = true)} />{/key}{/if}
    </div>
    <h2 id="cq-prompt" class="prompt" tabindex="-1" bind:this={prompt}>{renderText(question.prompt)}</h2>
    {#if timeUp && !revealed}<p class="timeup">{t('classQuiz.timeUp')}</p>{/if}
    <div class="body">
      <div class="map"><MapStage /></div>
      <div class="side">
        {#if question.input.kind === 'choice'}
          <ol class="options">
            {#each question.input.options as o, i (i)}
              {@const correct = revealed && question.answer.kind === 'choice' && question.answer.index === i}
              <li class:correct class:dim={revealed && !correct}><span class="letter" aria-hidden="true">{letters[i]}</span> <span class="opt">{renderText(o)}</span>{#if correct} <span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span><span class="visually-hidden">({t('practice.resultCorrect')})</span>{/if}</li>
            {/each}
          </ol>
        {/if}
        <div aria-live="polite">
          {#if revealed}
            <div class="reveal">
              <p class="answer"><svg class="answer-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>{t('classQuiz.answer', { answer: renderText(describeAnswer(question)) })}</p>
              <p class="why">{renderText(question.explanation)}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="controls">
      <button type="button" class="btn lg" onclick={() => go(-1)} disabled={index === 0}>← {t('classQuiz.prev')}</button>
      <button type="button" class="btn primary lg" onclick={reveal} disabled={revealed}>{t('classQuiz.reveal')}</button>
      <button type="button" class="btn lg" onclick={() => go(1)} disabled={index === questions.length - 1}>{t('classQuiz.next')} →</button>
      <button type="button" class="btn quiet lg end" onclick={() => (phase = 'setup')}>{t('classQuiz.end')}</button>
    </div>
    <p class="keys">{t('classQuiz.keys')}</p>
  </section>
{/if}

<style>
  /* ---------- Setup ---------- */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-6); max-width: 56rem; }
  .setup { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-5); }
  .setup-head { display: flex; align-items: center; gap: var(--space-3); }
  .setup-art { flex: none; width: 3rem; height: 3rem; padding: 0.6rem; border-radius: 0.9rem; background: var(--accent-soft); fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .setup h2 { margin: 0; font-size: var(--step-2); font-weight: var(--weight-heavy); }
  .setup fieldset { border: 0; margin: 0; padding: 0; min-width: 0; max-width: 100%; }
  .setup fieldset:has(.topics) { align-self: stretch; }
  .setup legend { padding: 0; margin-bottom: var(--space-2); font-weight: var(--weight-strong); color: var(--text-muted); }
  .setup .seg > label { padding: 0 var(--space-4); }
  .pair { display: flex; flex-wrap: wrap; gap: var(--space-5) var(--space-8); }
  .field { display: flex; flex-direction: column; font-weight: var(--weight-strong); color: var(--text-muted); gap: var(--space-2); }
  .field input { min-height: 3rem; width: 12rem; max-width: 100%; font-size: var(--step-2); font-weight: var(--weight-heavy); letter-spacing: 0.06em; color: var(--text); padding: 0 var(--space-4); border: 2px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); }
  .field input:focus-visible { outline: 2px solid transparent; outline-offset: 2px; border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus); }
  .topics { display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); }
  .topic { display: flex; align-items: center; gap: var(--space-3); min-height: var(--tap); padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); cursor: pointer; font-weight: 550; line-height: 1.25; transition: border-color var(--dur) var(--ease), background-color var(--dur) var(--ease); }
  .topic:hover { border-color: var(--border-strong); }
  .topic:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
  .topic:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .topic input { flex: none; width: 1.25rem; height: 1.25rem; margin: 0 0 0 var(--space-1); accent-color: var(--accent); }
  .topic input:focus-visible { outline: none; }
  .num { flex: none; display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 0.55rem; background: var(--warm-soft); color: var(--warm-text); font-size: var(--step--1); font-weight: var(--weight-heavy); font-variant-numeric: tabular-nums; }
  .err { color: var(--bad); font-weight: var(--weight-strong); width: 100%; margin: var(--space-2) 0 0; }
  @media (max-width: 599px) { .card { padding: var(--space-4); } .setup .btn.lg { align-self: stretch; } }

  /* ---------- Big-screen run ----------
   * Sizes follow the viewport (clamp + vw), so the same layout reads from the back of a classroom on a
   * 1920×1080 projector and on a 3840×2160 screen; the run also lifts the page's max width. */
  :global(#main:has(> .run)) { max-width: none; }
  :global(#main > h1:has(+ .run)) { font-size: clamp(1rem, 0.7rem + 0.6vw, 1.8rem); color: var(--text-muted); margin: 0 0 var(--space-2); }
  .run { display: flex; flex-direction: column; gap: clamp(0.75rem, 0.4rem + 0.6vw, 2rem); }
  .top { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  .progress { margin: 0; font-size: clamp(1rem, 0.6rem + 0.8vw, 2.2rem); }
  .prompt { font-size: clamp(1.6rem, 0.9rem + 2.6vw, 7rem); line-height: 1.12; margin: 0; font-weight: var(--weight-heavy); max-width: 40ch; }
  .prompt:focus { outline: none; }
  .prompt:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; border-radius: 4px; }
  .timeup { align-self: flex-start; display: inline-flex; align-items: center; color: var(--bad); background: var(--bad-soft); border-radius: var(--radius-pill); padding: 0.2em 0.8em; font-weight: var(--weight-heavy); font-size: clamp(1.1rem, 0.6rem + 1.2vw, 3rem); margin: 0; animation: pop 300ms var(--ease) both; }
  @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: none; opacity: 1; } }
  .body { display: grid; gap: clamp(1rem, 0.5rem + 1vw, 3rem); grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 1024px) { .body { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: start; } }
  .options { list-style: none; padding: 0; margin: 0; display: grid; gap: clamp(0.5rem, 0.3rem + 0.5vw, 1.5rem); }
  .options li { display: flex; gap: 0.6em; align-items: center; font-size: clamp(1.15rem, 0.7rem + 1.2vw, 3.6rem); line-height: 1.2; font-weight: 600; padding: 0.45em 0.6em; border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-1); transition: border-color 300ms var(--ease), background-color 300ms var(--ease), opacity 300ms var(--ease); }
  .opt { flex: 1; min-width: 0; }
  .options li.correct { border-color: var(--ok); background: var(--ok-soft); font-weight: var(--weight-heavy); animation: pop 400ms var(--ease) both; }
  .options li.dim { color: var(--text-muted); background: color-mix(in srgb, var(--surface) 55%, transparent); box-shadow: none; }
  .letter { flex: none; width: 1.7em; height: 1.7em; border-radius: var(--radius-sm); display: grid; place-items: center; background: var(--surface-2); border: 1px solid var(--border-strong); font-size: 0.8em; font-weight: var(--weight-heavy); }
  .correct .letter { background: var(--ok); border-color: var(--ok); color: var(--surface); }
  .tick { flex: none; display: grid; place-items: center; width: 1.3em; height: 1.3em; border-radius: 50%; background: var(--ok); color: var(--surface); }
  .tick svg, .answer-icon { width: 70%; height: 70%; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .reveal { margin-top: clamp(0.75rem, 0.4rem + 0.6vw, 2rem); padding: 0.8em 1em; border-radius: var(--radius); background: var(--ok-soft); border: 1px solid color-mix(in srgb, var(--ok) 45%, transparent); border-left: 6px solid var(--ok); font-size: clamp(1rem, 0.7rem + 0.7vw, 2.4rem); animation: rise 300ms var(--ease) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .answer { display: flex; gap: 0.5em; align-items: center; font-size: 1.35em; line-height: 1.2; font-weight: var(--weight-heavy); color: var(--ok); margin: 0 0 0.35em; }
  .answer-icon { flex: none; width: 1.3em; height: 1.3em; padding: 0.22em; border-radius: 50%; background: var(--ok); color: var(--surface); }
  .why { margin: 0; line-height: 1.45; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .controls .btn { font-size: clamp(1.1rem, 0.8rem + 0.5vw, 2rem); min-height: clamp(3.25rem, 2.4rem + 1.2vw, 5.5rem); padding: 0 1.1em; }
  .controls .end { margin-left: auto; color: var(--text-muted); }
  .keys { color: var(--text-muted); margin: 0; font-size: clamp(0.85rem, 0.7rem + 0.3vw, 1.4rem); }
  @media (hover: none) { .keys { display: none; } }
  @media (max-width: 599px) { .controls .btn { flex: 1 1 auto; } .controls .end { margin-left: 0; } }
</style>
