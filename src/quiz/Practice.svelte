<script lang="ts">
  import { announce } from '../app/announcer.svelte';
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
  let best = $state<number | null>(null);

  const questions = $derived(generateSet(seed, [topic.id], difficulty, ROUND));
  const question = $derived(questions[index]!);
  const result = $derived(results[index] ?? null);
  const score = $derived(results.filter((r) => r.correct).length);

  let applied = '';
  $effect(() => {
    const key = `${seed}:${difficulty}:${index}`;
    if (key === applied || finished) return;
    applied = key;
    mapState.applyScene(question.scene);
    expose('__practice', { question, answer: question.answer });
  });

  function submit(answer: Answer) {
    const res = checkAnswer(question, answer);
    results[index] = res;
    mapState.pointEditable = false;
    const extra: Overlay[] = !res.correct && answer.kind === 'coords' ? [{ kind: 'marker', p: answer.value, tone: 'wrong' }] : [];
    mapState.addOverlays([...question.solution, ...extra]);
    announce(res.correct ? t('practice.correct') : t('practice.incorrect'), 'assertive');
  }

  function next() {
    if (index < ROUND - 1) { index += 1; return; }
    finished = true;
    best = recordScore(scoreId(topic.id, difficulty), score);
  }

  function newRound(d: Difficulty = difficulty) {
    difficulty = d;
    writeString('geo-coords:difficulty', d);
    seed = randomSeed();
    index = 0;
    results = [];
    finished = false;
  }

  let summaryHeading = $state<HTMLHeadingElement>();
  $effect(() => { if (finished) queueMicrotask(() => summaryHeading?.focus()); });
</script>

<div class="practice">
  <fieldset class="difficulty">
    <legend>{t('practice.difficulty')}</legend>
    {#each DIFFS as d (d)}
      <label><input type="radio" name="difficulty-{topic.id}" checked={difficulty === d} onchange={() => newRound(d)} /> {t(`difficulty.${d}`)}</label>
    {/each}
    {#if bestScore(scoreId(topic.id, difficulty)) !== null}
      <span class="best">{t('practice.best', { best: bestScore(scoreId(topic.id, difficulty))!, total: ROUND })}</span>
    {/if}
  </fieldset>

  {#if !finished}
    <div class="layout">
      <div class="stage"><MapStage /></div>
      <div class="panel">
        <QuestionCard {question} number={index + 1} total={ROUND} {result} onsubmit={submit} onnext={next}
          nextLabel={index < ROUND - 1 ? t('practice.next') : t('practice.results')} />
      </div>
    </div>
  {:else}
    <section class="summary" aria-labelledby="summary-title">
      <h2 id="summary-title" tabindex="-1" bind:this={summaryHeading}>{t('practice.done')}</h2>
      <p class="score">{t('practice.score', { score, total: ROUND })}</p>
      {#if best !== null}<p>{t('practice.best', { best, total: ROUND })}</p>{/if}
      <h3>{t('practice.review')}</h3>
      <ol class="review">
        {#each questions as q, i (q.id)}
          <li class:ok={results[i]?.correct}>
            <span class="mark" aria-hidden="true">{results[i]?.correct ? '✓' : '✗'}</span>
            <span class="visually-hidden">{results[i]?.correct ? t('practice.resultCorrect') : t('practice.resultWrong')}: </span>
            {renderText(q.prompt)}
          </li>
        {/each}
      </ol>
      <div class="actions">
        <button type="button" class="primary" onclick={() => newRound()}>{t('practice.newRound')}</button>
        {#if difficulty !== 'hard'}
          <button type="button" onclick={() => newRound(difficulty === 'easy' ? 'medium' : 'hard')}>{t('practice.harder')}</button>
        {/if}
        <a href={formatRoute({ name: 'explore', lang: i18n.lang, topic: topic.id, step: 0 })}>{t('practice.backToLearn')}</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .practice { display: flex; flex-direction: column; gap: var(--space-4); }
  .difficulty { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-2) var(--space-4); background: var(--surface); }
  .difficulty legend { font-weight: 700; padding: 0 var(--space-1); }
  .difficulty label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: var(--tap); }
  .difficulty input { width: 1.2rem; height: 1.2rem; }
  .best { margin-left: auto; color: var(--text-muted); }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
  @media (min-width: 1024px) { .layout { grid-template-columns: minmax(0, 1fr) 26rem; align-items: start; } .panel { position: sticky; top: 5rem; } }
  .summary { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); }
  .score { font-size: 2rem; font-weight: 800; margin: 0; }
  .review { display: grid; gap: var(--space-2); padding-left: 1.5rem; }
  .review li { padding: var(--space-1) 0; }
  .mark { display: inline-block; width: 1.5rem; font-weight: 800; color: var(--bad); }
  .ok .mark { color: var(--ok); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; margin-top: var(--space-4); }
  .actions button, .actions a { min-height: var(--tap); display: inline-flex; align-items: center; padding: 0 var(--space-4); border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); font-weight: 600; color: var(--text); }
  .actions .primary { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
</style>
