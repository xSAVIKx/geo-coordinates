<script lang="ts">
  import { TOPIC_IDS, type TopicId } from '../app/ids';
  import { formatRoute } from '../app/router';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import { responseText } from './answerText';
  import Celebration from './Celebration.svelte';
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

  // Set for a moment when Start (which then disappears) brings up the first question, so its heading takes focus;
  // not on a later remount (a rotation across the 1024px layout switch), which would pull focus out of an answer.
  let focusQuestion = $state(false);
  function start() {
    focusQuestion = true;
    setTimeout(() => (focusQuestion = false), 0);
    seed = randomSeed();
    index = 0;
    answers = [];
    results = [];
    applied = '';
    phase = 'run';
  }

  // Back to the setup: the button pressed is gone, so the page's heading takes focus.
  function again() {
    phase = 'setup';
    queueMicrotask(() => document.querySelector<HTMLElement>('#main h1')?.focus());
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
    onsubmit={submit} onnext={next} nextLabel={index < COUNT - 1 ? t('rehearsal.submitNext') : t('rehearsal.finish')} {roundKey} focusOnMount={focusQuestion} />
{/snippet}

{#if phase === 'setup'}
  <section class="card setup">
    <svg class="setup-art" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10M9 12h10M9 19h10M3.5 5l1.5 1.5L7.5 4M3.5 12l1.5 1.5 2.5-2.5M4 18.2h2.5v2H4z" /></svg>
    <p class="intro">{t('rehearsal.intro')}</p>
    <fieldset class="difficulty">
      <legend>{t('practice.difficulty')}</legend>
      <div class="seg levels">
        {#each DIFFS as d, i (d)}
          <label><input type="radio" name="rehearsal-difficulty" value={d} bind:group={difficulty} /><span class="pips" aria-hidden="true">{#each DIFFS as _, j (j)}<i class:on={j <= i}></i>{/each}</span> {t(`difficulty.${d}`)}</label>
        {/each}
      </div>
    </fieldset>
    {#if bestScore(scoreId('rehearsal', difficulty)) !== null}
      <p class="best">{t('practice.best', { best: bestScore(scoreId('rehearsal', difficulty))!, total: COUNT })}</p>
    {/if}
    <button type="button" class="btn primary lg" onclick={start}>{t('rehearsal.start')} <span aria-hidden="true">→</span></button>
  </section>
{:else if phase === 'run'}
  <div class="layout">
    <div class="stage"><MapStage midContent={wide ? undefined : questionCard} /></div>
    {#if wide}
      <div class="panel">{@render questionCard()}</div>
    {/if}
  </div>
{:else}
  <section class="card results" aria-labelledby="rehearsal-results">
    <div class="summary-head">
      <svg class="meter" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" class="meter-track" />
        <circle cx="32" cy="32" r="27" class="meter-fill" pathLength="100" stroke-dasharray="{(score / COUNT) * 100} 100" />
        <text x="32" y="38" text-anchor="middle" class="meter-t">{score}</text>
      </svg>
      <div>
        <h2 id="rehearsal-results" tabindex="-1" bind:this={heading}>{t('rehearsal.results')}</h2>
        <p class="score">{t('practice.score', { score, total: COUNT })}</p>
        {#if best !== null}<p class="best">{t('practice.best', { best, total: COUNT })}</p>{/if}
        {#if score === COUNT}<div><Celebration /></div>{/if}
      </div>
    </div>
    <ol class="review">
      {#each questions as q, i (q.id)}
        {@const ok = results[i]?.correct}
        <li class:ok>
          <p class="prompt"><span class="mark" aria-hidden="true">{#if ok}<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{:else}<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" /></svg>{/if}</span><span class="n" aria-hidden="true">{i + 1}.</span><span class="visually-hidden">{ok ? t('practice.resultCorrect') : t('practice.resultWrong')}: </span>{renderText(q.prompt)}</p>
          {#if !ok}
            <div class="detail">
              <p class="yours">{t('rehearsal.yourAnswer', { answer: answers[i] ? renderText(responseText(q, answers[i]!)) : '—' })}</p>
              {#if results[i]?.mistake}<p class="mistake">{renderText(results[i]!.mistake!)}</p>{/if}
              <p class="answer">{t('practice.correctAnswer', { answer: renderText(describeAnswer(q)) })}</p>
              <p class="why">{renderText(q.explanation)}</p>
              <p class="links">
                <a class="btn quiet" href={formatRoute({ name: 'explore', lang: i18n.lang, topic: q.topic, step: 0 })}>{t('rehearsal.learn', { title: t(`topic.${q.topic}.title`) })}</a>
                <a class="btn quiet" href={formatRoute({ name: 'practice', lang: i18n.lang, topic: q.topic })}>{t('rehearsal.practise', { title: t(`topic.${q.topic}.title`) })}</a>
              </p>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <button type="button" class="btn primary lg" onclick={again}>{t('rehearsal.again')}</button>
  </section>
{/if}

<style>
  .card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-6); max-width: 56rem; }
  .setup { max-width: 44rem; display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-5); }
  .setup-art { width: 3rem; height: 3rem; padding: 0.6rem; border-radius: 0.9rem; background: var(--accent-soft); fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .intro { margin: 0; font-size: var(--step-1); max-width: var(--measure); }
  .difficulty { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; border: 0; margin: 0; padding: 0; min-width: 0; }
  .difficulty legend { float: left; font-weight: var(--weight-strong); color: var(--text-muted); padding: 0; margin-right: var(--space-1); }
  .levels label { gap: var(--space-2); padding: 0 var(--space-4); }
  .pips { display: inline-flex; align-items: flex-end; gap: 2px; height: 0.9rem; }
  .pips i { display: block; width: 4px; border-radius: 1px; background: var(--border-strong); opacity: 0.45; }
  .pips i:nth-child(1) { height: 40%; } .pips i:nth-child(2) { height: 70%; } .pips i:nth-child(3) { height: 100%; }
  .pips i.on { background: var(--accent); opacity: 1; }
  .best { display: inline-flex; align-items: center; min-height: 2.25rem; margin: 0; padding: 0 var(--space-3); border-radius: var(--radius-pill); background: var(--warm-soft); color: var(--warm-text); font-weight: var(--weight-strong); font-size: var(--step--1); }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 1024px) {
    .layout { grid-template-columns: minmax(0, 1fr) clamp(22rem, 22vw, 27rem); gap: var(--space-5); align-items: start; }
    .panel { position: sticky; top: calc(var(--header-h) + var(--space-4)); }
  }

  .summary-head { display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-5); }
  .summary-head .best { margin-top: var(--space-2); }
  .meter { flex: none; width: clamp(5rem, 10vw, 7rem); height: auto; }
  .meter-track { fill: none; stroke: var(--surface-2); stroke-width: 7; }
  .meter-fill { fill: none; stroke: var(--ok); stroke-width: 7; stroke-linecap: round; transform: rotate(-90deg); transform-origin: center; transition: stroke-dasharray 600ms var(--ease); }
  .meter-t { fill: var(--text); font-size: 22px; font-weight: 800; font-family: var(--font); }
  h2 { margin: 0; font-size: var(--step-3); font-weight: var(--weight-heavy); }
  h2:focus { outline: none; }
  /* Focused by the page itself (a new step, question or result) for screen readers: a quiet bar at the side, not a frame round the heading. */
  h2:focus-visible { outline: none; box-shadow: -0.35rem 0 0 var(--focus); }
  @media (forced-colors: active) { h2:focus-visible { outline: 2px solid Highlight; } }
  .score { font-size: var(--step-2); font-weight: var(--weight-heavy); margin: var(--space-1) 0 0; }

  .review { display: grid; gap: var(--space-2); padding: 0; margin: 0 0 var(--space-6); list-style: none; grid-template-columns: minmax(0, 1fr); overflow-wrap: anywhere; }
  .review li { padding: var(--space-3) var(--space-4); border-radius: var(--radius); background: var(--bad-soft); border: 1px solid color-mix(in srgb, var(--bad) 25%, transparent); }
  .review li.ok { background: transparent; border-color: transparent; box-shadow: inset 0 -1px 0 var(--border); border-radius: 0; padding-block: var(--space-2); }
  .review p { margin: 0; }
  .prompt { display: flex; gap: var(--space-2); align-items: flex-start; font-weight: var(--weight-strong); }
  .n { flex: none; min-width: 1.6rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .mark { flex: none; display: grid; place-items: center; width: 1.6rem; height: 1.6rem; margin-top: 0.05rem; border-radius: 50%; background: var(--bad); color: var(--surface); }
  .ok .mark { background: var(--ok); }
  .mark svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .detail { display: grid; gap: var(--space-1); margin: var(--space-2) 0 0 calc(3.2rem + var(--space-4)); }
  .yours { color: var(--text-muted); }
  .mistake { font-weight: var(--weight-strong); color: var(--bad); }
  .answer { font-weight: var(--weight-heavy); }
  .links { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); margin-top: var(--space-1) !important; margin-left: calc(-1 * var(--space-3)) !important; }
  .links .btn { color: var(--accent); font-size: var(--step--1); padding: 0 var(--space-3); justify-content: flex-start; text-align: left; }
  @media (max-width: 599px) {
    .card { padding: var(--space-4); }
    /* As in Practice: the levels share one full-width row, the "Difficulty" word stays for screen readers. */
    .difficulty { align-self: stretch; }
    .difficulty legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .levels { display: flex; flex-wrap: nowrap; width: 100%; }
    .levels label { flex: 1 1 0; min-width: 0; padding: 0 var(--space-2); }
    .detail { margin-left: 0; }
    .summary-head { gap: var(--space-4); }
    .setup .btn.lg { align-self: stretch; }
  }
  /* A very narrow phone (or larger text on one): the level names alone, wrapping to a second row rather than overlapping. */
  @media (max-width: 399px) { .levels .pips { display: none; } .levels { flex-wrap: wrap; } .levels label { flex: 1 1 auto; padding: 0 var(--space-2); } }
  /* The score ring and the heading share a row while the heading fits beside it; a long word moves the text under the ring. */
  .summary-head { flex-wrap: wrap; }
  .summary-head > div { flex: 1 1 11rem; min-width: 0; }
</style>
