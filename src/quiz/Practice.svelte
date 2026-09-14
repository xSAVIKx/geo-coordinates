<script lang="ts">
  import { announce } from '../app/announcer.svelte';
  import type { TopicId } from '../app/ids';
  import { formatRoute } from '../app/router';
  import { readString, writeString } from '../app/storage';
  import { expose } from '../app/testMode';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import type { Overlay } from '../map/types';
  import type { TopicDef } from '../topics/types';
  import QuestionCard from './QuestionCard.svelte';
  import { checkAnswer, generateSet } from './registry';
  import { randomSeed } from './rng';
  import { bestScore, recordScore, scoreId } from './scores';
  import type { Answer, CheckResult, Difficulty } from './types';

  let { topic }: { topic: TopicDef } = $props();
  const ROUND = 10;
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
  const stored = readString('geo-coords:difficulty');
  let difficulty = $state<Difficulty>(DIFFS.includes(stored as Difficulty) ? (stored as Difficulty) : 'easy');
  let seed = $state(randomSeed());
  let index = $state(0);
  let results = $state<CheckResult[]>([]);
  let finished = $state(false);

  // The in-progress (not yet submitted) answer for the current question, lifted up from
  // QuestionCard/CoordsInput/NumberInput so it survives those components being torn down and
  // recreated — which happens whenever the phone/desktop layout switch (`wide`, below) moves the
  // question card to a different place in the DOM. `coordsText`/`numberText`/`clockText` hold the raw typed
  // text (which may not parse to a valid `value` yet); reset together, synchronously, everywhere
  // the round position changes so a fresh question never inherits a previous one's draft.
  interface Draft { value: Answer | null; coordsText: { lat: string; lon: string }; numberText: string; clockText: string }
  const emptyDraft = (): Draft => ({ value: null, coordsText: { lat: '', lon: '' }, numberText: '', clockText: '' });
  let draft = $state<Draft>(emptyDraft());
  // The best score for the *currently selected* difficulty — shown both beside the difficulty
  // selector and in the round summary. Loaded on init, reloaded whenever `difficulty` (or the
  // topic) changes, and updated the moment a round finishes, so it never goes stale like a plain
  // `bestScore(...)` call in the template would (that read isn't reactive to state changes).
  let currentBest = $state<number | null>(null);
  $effect(() => {
    currentBest = bestScore(scoreId(topic.id, difficulty));
  });

  const questions = $derived(generateSet(seed, [topic.id], difficulty, ROUND));
  const question = $derived(questions[index]!);
  const result = $derived(results[index] ?? null);
  const score = $derived(results.filter((r) => r.correct).length);
  // Identifies the current question *within its round*; `question.id` alone repeats across
  // different seeds/difficulties at the same position, so QuestionCard uses this (not
  // `question.id`) to know when to reset/remount its input.
  const roundKey = $derived(`${topic.id}:${seed}:${difficulty}:${index}`);

  // TopicPage doesn't remount Practice when navigating between topics while staying on the
  // Practice tab (only the `topic` prop changes), so start a fresh round for the new topic
  // instead of carrying over the previous topic's index/results/scene.
  let lastTopicId: TopicId | null = null;
  $effect(() => {
    if (topic.id === lastTopicId) return;
    const first = lastTopicId === null;
    lastTopicId = topic.id;
    if (first) return;
    seed = randomSeed();
    index = 0;
    results = [];
    finished = false;
    draft = emptyDraft();
  });

  let applied = '';
  $effect(() => {
    if (roundKey === applied || finished) return;
    applied = roundKey;
    mapState.applyScene(question.scene);
    expose('__practice', { question, answer: question.answer });
  });

  function submit(answer: Answer) {
    const res = checkAnswer(question, answer);
    results[index] = res;
    mapState.pointEditable = false;
    const extra: Overlay[] = !res.correct && answer.kind === 'coords' ? [{ kind: 'marker', p: answer.value, tone: 'wrong' }] : [];
    mapState.addOverlays([...question.solution, ...extra], { animate: true });
    announce(res.correct ? t('practice.correct') : t('practice.incorrect'), 'assertive');
  }

  function next() {
    if (index < ROUND - 1) { index += 1; draft = emptyDraft(); return; }
    finished = true;
    currentBest = recordScore(scoreId(topic.id, difficulty), score);
  }

  function newRound(d: Difficulty = difficulty) {
    difficulty = d;
    writeString('geo-coords:difficulty', d);
    seed = randomSeed();
    index = 0;
    results = [];
    finished = false;
    draft = emptyDraft();
  }

  let summaryHeading = $state<HTMLHeadingElement>();
  $effect(() => { if (finished) queueMicrotask(() => summaryHeading?.focus()); });

  // On phones (<1024px) the question card is rendered right after the map view(s) — inside
  // MapStage, above the coordinate sliders/place list — so the prompt (and, for a mapPick
  // question, the map holding the target) stay on screen together; at >=1024px it moves to the
  // sticky side panel instead. Only one of the two ever actually renders the snippet below, so
  // there is never more than one QuestionCard mounted at once.
  let wide = $state(typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)').matches : true);
  $effect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => (wide = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
</script>

{#snippet questionCard()}
  <QuestionCard {question} number={index + 1} total={ROUND} {result} onsubmit={submit} onnext={next}
    nextLabel={index < ROUND - 1 ? t('practice.next') : t('practice.results')} {roundKey}
    bind:value={draft.value} bind:coordsDraft={draft.coordsText} bind:numberDraft={draft.numberText} bind:clockDraft={draft.clockText} />
{/snippet}

<div class="practice">
  <fieldset class="difficulty">
    <legend>{t('practice.difficulty')}</legend>
    <div class="seg levels">
      {#each DIFFS as d, i (d)}
        <label><input type="radio" name="difficulty-{topic.id}" checked={difficulty === d} onchange={() => newRound(d)} /><span class="pips" aria-hidden="true">{#each DIFFS as _, j (j)}<i class:on={j <= i}></i>{/each}</span> {t(`difficulty.${d}`)}</label>
      {/each}
    </div>
    {#if currentBest !== null}
      <span class="best"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" /></svg>{t('practice.best', { best: currentBest, total: ROUND })}</span>
    {/if}
  </fieldset>

  {#if !finished}
    <div class="layout">
      <div class="stage"><MapStage midContent={wide ? undefined : questionCard} /></div>
      {#if wide}
        <div class="panel">
          {@render questionCard()}
        </div>
      {/if}
    </div>
  {:else}
    <section class="summary" aria-labelledby="summary-title">
      <div class="summary-head">
        <svg class="meter" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" class="meter-track" />
          <circle cx="32" cy="32" r="27" class="meter-fill" pathLength="100" stroke-dasharray="{(score / ROUND) * 100} 100" />
          <text x="32" y="38" text-anchor="middle" class="meter-t">{score}</text>
        </svg>
        <div>
          <h2 id="summary-title" tabindex="-1" bind:this={summaryHeading}>{t('practice.done')}</h2>
          <p class="score">{t('practice.score', { score, total: ROUND })}</p>
          {#if currentBest !== null}<p class="best-line">{t('practice.best', { best: currentBest, total: ROUND })}</p>{/if}
        </div>
      </div>
      <h3>{t('practice.review')}</h3>
      <ol class="review">
        {#each questions as q, i (q.id)}
          <li class:ok={results[i]?.correct}>
            <span class="mark" aria-hidden="true">{#if results[i]?.correct}<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{:else}<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" /></svg>{/if}</span>
            <span class="visually-hidden">{results[i]?.correct ? t('practice.resultCorrect') : t('practice.resultWrong')}: </span>
            {renderText(q.prompt)}
          </li>
        {/each}
      </ol>
      <div class="actions">
        <button type="button" class="btn primary" onclick={() => newRound()}>{t('practice.newRound')}</button>
        {#if difficulty !== 'hard'}
          <button type="button" class="btn" onclick={() => newRound(difficulty === 'easy' ? 'medium' : 'hard')}>{t('practice.harder')}</button>
        {/if}
        <a class="btn quiet" href={formatRoute({ name: 'explore', lang: i18n.lang, topic: topic.id, step: 0 })}>{t('practice.backToLearn')}</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .practice { display: flex; flex-direction: column; gap: var(--space-4); }
  .difficulty { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; border: 0; margin: 0; padding: 0; min-width: 0; }
  .difficulty legend { float: left; font-weight: var(--weight-strong); color: var(--text-muted); padding: 0; margin-right: var(--space-1); }
  .levels label { gap: var(--space-2); padding: 0 var(--space-4); }
  .pips { display: inline-flex; align-items: flex-end; gap: 2px; height: 0.9rem; }
  .pips i { display: block; width: 4px; border-radius: 1px; background: var(--border-strong); opacity: 0.45; }
  .pips i:nth-child(1) { height: 40%; } .pips i:nth-child(2) { height: 70%; } .pips i:nth-child(3) { height: 100%; }
  .pips i.on { background: var(--accent); opacity: 1; }
  .best { margin-left: auto; display: inline-flex; align-items: center; gap: var(--space-2); min-height: 2.25rem; padding: 0 var(--space-3); border-radius: var(--radius-pill); background: var(--warm-soft); color: var(--warm-text); font-weight: var(--weight-strong); font-size: var(--step--1); }
  .best svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 1024px) {
    .layout { grid-template-columns: minmax(0, 1fr) clamp(22rem, 22vw, 27rem); gap: var(--space-5); align-items: start; }
    .panel { position: sticky; top: calc(var(--header-h) + var(--space-4)); }
  }
  /* Phones: the pips and level names speak for themselves, so the "Difficulty" word is kept for screen readers only and the levels share one full-width row. */
  @media (max-width: 599px) {
    .best { margin-left: 0; }
    .difficulty legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .levels { display: flex; flex-wrap: nowrap; width: 100%; }
    .levels label { flex: 1 1 0; min-width: 0; padding: 0 var(--space-2); }
  }
  .summary { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-6); max-width: 56rem; }
  .summary-head { display: flex; align-items: center; gap: var(--space-5); }
  .summary h2 { margin: 0; font-size: var(--step-3); }
  .summary h2:focus { outline: none; }
  .summary h2:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; border-radius: 4px; }
  .meter { flex: none; width: clamp(5rem, 10vw, 7rem); height: auto; }
  .meter-track { fill: none; stroke: var(--surface-2); stroke-width: 7; }
  .meter-fill { fill: none; stroke: var(--ok); stroke-width: 7; stroke-linecap: round; transform: rotate(-90deg); transform-origin: center; transition: stroke-dasharray 600ms var(--ease); }
  .meter-t { fill: var(--text); font-size: 22px; font-weight: 800; font-family: var(--font); }
  .score { font-size: var(--step-2); font-weight: var(--weight-heavy); margin: var(--space-1) 0 0; }
  .best-line { margin: var(--space-1) 0 0; color: var(--text-muted); }
  .summary h3 { font-size: var(--step-1); margin: var(--space-6) 0 var(--space-2); }
  .review { display: grid; gap: var(--space-1); padding: 0; margin: 0; list-style: none; }
  .review li { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--bad-soft); }
  .review li.ok { background: transparent; box-shadow: inset 0 -1px 0 var(--border); border-radius: 0; }
  .mark { flex: none; display: grid; place-items: center; width: 1.6rem; height: 1.6rem; margin-top: 0.05rem; border-radius: 50%; background: var(--bad); color: var(--surface); }
  .ok .mark { background: var(--ok); }
  .mark svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; margin-top: var(--space-6); }
</style>
