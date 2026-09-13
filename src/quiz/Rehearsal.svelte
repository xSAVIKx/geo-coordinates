<script lang="ts">
  import { TOPIC_IDS, type TopicId } from '../app/ids';
  import { formatRoute } from '../app/router';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import { responseText } from './answerText';
  import QuestionCard from './QuestionCard.svelte';
  import { checkAnswer, describeAnswer, generateSet, modulesForTopic } from './registry';
  import { createRng, randomSeed } from './rng';
  import { bestScore, recordScore, scoreId } from './scores';
  import type { Answer, CheckResult, Difficulty } from './types';

  const COUNT = 15;
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
  let phase = $state<'setup' | 'run' | 'results'>('setup');
  let difficulty = $state<Difficulty>('medium');
  let seed = $state(randomSeed());
  let index = $state(0);
  let answers = $state<Answer[]>([]);
  let results = $state<CheckResult[]>([]);
  let best = $state<number | null>(null);

  // Every available topic contributes questions, shuffled so a rehearsal doesn't always start
  // with topic 1 — repeated (mod length) to fill all 15 slots.
  const topics = $derived.by<TopicId[]>(() => {
    const available = TOPIC_IDS.filter((id) => modulesForTopic(id).length > 0);
    const order = createRng(seed).shuffle(available);
    return Array.from({ length: COUNT }, (_, i) => order[i % order.length]!);
  });
  const questions = $derived(generateSet(seed, topics, difficulty, COUNT));
  const question = $derived(questions[index]!);
  const score = $derived(results.filter((r) => r.correct).length);
  // Identifies the current question *within its round*, not `question.id` (which repeats across
  // different seeds/difficulties at the same position) — see QuestionCard's own note.
  const roundKey = $derived(`${seed}:${difficulty}:${index}`);

  let applied = '';
  $effect(() => {
    if (phase !== 'run') return;
    if (roundKey === applied) return;
    applied = roundKey;
    mapState.applyScene(question.scene);
  });

  let heading = $state<HTMLHeadingElement>();
  $effect(() => { if (phase === 'results') queueMicrotask(() => heading?.focus()); });

  function start() {
    seed = randomSeed();
    index = 0;
    answers = [];
    results = [];
    applied = '';
    phase = 'run';
  }

  function submit(a: Answer) {
    answers[index] = a;
    results[index] = checkAnswer(question, a);
    mapState.pointEditable = false;
  }

  function next() {
    if (index < COUNT - 1) { index += 1; return; }
    best = recordScore(scoreId('rehearsal', difficulty), score);
    phase = 'results';
  }

  // Mirrors Practice's layout: on phones (<1024px) the question card renders right after the
  // map view(s), inside MapStage's midContent slot, so the prompt stays next to the map; at
  // >=1024px it moves to the sticky side panel. Only one of the two ever renders the snippet.
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
  <QuestionCard {question} number={index + 1} total={COUNT} result={results[index] ?? null} showFeedback={false}
    onsubmit={submit} onnext={next} nextLabel={index < COUNT - 1 ? t('rehearsal.submitNext') : t('rehearsal.finish')} {roundKey} />
{/snippet}

{#if phase === 'setup'}
  <section class="card">
    <p>{t('rehearsal.intro')}</p>
    <fieldset class="difficulty">
      <legend>{t('practice.difficulty')}</legend>
      {#each DIFFS as d (d)}
        <label><input type="radio" name="rehearsal-difficulty" value={d} bind:group={difficulty} /> {t(`difficulty.${d}`)}</label>
      {/each}
    </fieldset>
    {#if bestScore(scoreId('rehearsal', difficulty)) !== null}
      <p class="best">{t('practice.best', { best: bestScore(scoreId('rehearsal', difficulty))!, total: COUNT })}</p>
    {/if}
    <button type="button" class="btn primary lg" onclick={start}>{t('rehearsal.start')}</button>
  </section>
{:else if phase === 'run'}
  <div class="layout">
    <div class="stage"><MapStage midContent={wide ? undefined : questionCard} /></div>
    {#if wide}
      <div class="panel">{@render questionCard()}</div>
    {/if}
  </div>
{:else}
  <section class="card" aria-labelledby="rehearsal-results">
    <h2 id="rehearsal-results" tabindex="-1" bind:this={heading}>{t('rehearsal.results')}</h2>
    <p class="score">{t('practice.score', { score, total: COUNT })}</p>
    {#if best !== null}<p class="best">{t('practice.best', { best, total: COUNT })}</p>{/if}
    <ol class="review">
      {#each questions as q, i (q.id)}
        {@const ok = results[i]?.correct}
        <li class:ok>
          <p class="prompt"><span class="mark" aria-hidden="true">{ok ? '✓' : '✗'}</span><span class="visually-hidden">{ok ? t('practice.resultCorrect') : t('practice.resultWrong')}: </span>{renderText(q.prompt)}</p>
          {#if !ok}
            <p>{t('rehearsal.yourAnswer', { answer: answers[i] ? renderText(responseText(q, answers[i]!)) : '—' })}</p>
            {#if results[i]?.mistake}<p class="mistake">{renderText(results[i]!.mistake!)}</p>{/if}
            <p class="answer">{t('practice.correctAnswer', { answer: renderText(describeAnswer(q)) })}</p>
            <p>{renderText(q.explanation)}</p>
            <p class="links">
              <a class="btn quiet" href={formatRoute({ name: 'explore', lang: i18n.lang, topic: q.topic, step: 0 })}>{t('rehearsal.learn', { title: t(`topic.${q.topic}.title`) })}</a>
              <a class="btn quiet" href={formatRoute({ name: 'practice', lang: i18n.lang, topic: q.topic })}>{t('rehearsal.practise', { title: t(`topic.${q.topic}.title`) })}</a>
            </p>
          {/if}
        </li>
      {/each}
    </ol>
    <button type="button" class="btn primary lg" onclick={() => (phase = 'setup')}>{t('rehearsal.again')}</button>
  </section>
{/if}

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-5) var(--space-6) var(--space-6); max-width: 56rem; }
  .difficulty { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; border: 1px solid var(--border); border-radius: var(--radius); margin: var(--space-4) 0; padding: var(--space-2) var(--space-4); }
  .difficulty label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: var(--tap); }
  .best { color: var(--text-muted); font-weight: var(--weight-strong); }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 1024px) {
    .layout { grid-template-columns: minmax(0, 1fr) clamp(22rem, 22vw, 27rem); gap: var(--space-5); align-items: start; }
    .panel { position: sticky; top: calc(var(--header-h) + var(--space-4)); }
  }
  .score { font-size: var(--step-3); font-weight: var(--weight-heavy); margin: var(--space-2) 0 0; }
  .review { display: grid; gap: var(--space-4); padding: 0 0 0 1.5rem; margin: var(--space-4) 0; }
  .review p { margin: var(--space-1) 0; }
  .prompt { font-weight: var(--weight-strong); }
  .mark { display: inline-block; width: 1.5rem; color: var(--bad); }
  .ok .mark { color: var(--ok); }
  .mistake, .answer { font-weight: var(--weight-strong); }
  .links { display: flex; flex-wrap: wrap; gap: var(--space-2); }
</style>
