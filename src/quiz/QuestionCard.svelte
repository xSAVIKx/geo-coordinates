<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import Feedback from './Feedback.svelte';
  import ChoiceInput from './inputs/ChoiceInput.svelte';
  import ClockInput from './inputs/ClockInput.svelte';
  import CoordsInput from './inputs/CoordsInput.svelte';
  import NumberInput from './inputs/NumberInput.svelte';
  import type { Answer, CheckResult, Question } from './types';

  // `roundKey` identifies this question *within its round* (e.g. `${seed}:${difficulty}:${index}`
  // from Practice), not `question.id` — generator ids are `${type}-${seedIndex}` and repeat across
  // different seeds/difficulties at the same position, so keying the reset/remount logic on
  // `question.id` would leave a stale selection/typed answer/feedback on screen when, say, the
  // difficulty changes while staying on question 1.
  //
  // `value` and the `*Draft` props are `$bindable`, owned by Practice rather than local
  // `$state` here. The phone/desktop layout switch (see MapStage's `midContent`) moves this
  // component to a different place in the DOM, which destroys and recreates it — a purely local
  // answer would be lost on every resize across the breakpoint. Because Practice holds the real
  // state, a fresh instance picks the in-progress answer back up from its initial prop values.
  let {
    question, number, total, result, onsubmit, onnext, nextLabel, roundKey,
    value = $bindable(null), coordsDraft = $bindable({ lat: '', lon: '' }), numberDraft = $bindable(''), clockDraft = $bindable(''),
    showFeedback = true, big = false, hint = false, hinted = false, onhint, focusOnMount = false,
  }: {
    question: Question; number: number; total: number; result: CheckResult | null;
    onsubmit: (a: Answer) => void; onnext: () => void; nextLabel: string; roundKey: string;
    value?: Answer | null; coordsDraft?: { lat: string; lon: string }; numberDraft?: string; clockDraft?: string;
    showFeedback?: boolean; big?: boolean;
    // `hint` offers the Hint button (Practice only). Whether it was used is owned by Practice (like the
    // draft), so the hint stays shown when the phone/desktop switch recreates this card.
    hint?: boolean; hinted?: boolean; onhint?: () => void;
    // `focusOnMount`: the control that brought this card up is gone (Start, New round), so the question's heading takes focus.
    focusOnMount?: boolean;
  } = $props();

  let invalid = $state(false);
  let heading: HTMLHeadingElement;
  let feedbackBox = $state<HTMLDivElement>();
  let nextButton = $state<HTMLButtonElement>();
  const uid = `q-${Math.random().toString(36).slice(2, 8)}`;
  const answered = $derived(result !== null);

  // Resetting `value`/the drafts for a new question is Practice's job (it owns them and must do
  // it before this component even mounts on the very first question); this only handles moving
  // focus to the heading when the round moves on to its next question. A new round started from the
  // difficulty levels keeps focus on the levels (arrow keys go on choosing); on mount, `focusOnMount` decides.
  // (The round is everything in `roundKey` before its last `:`, the question's index.)
  let lastKey = '';
  const roundOf = (k: string) => k.slice(0, k.lastIndexOf(':'));
  $effect(() => {
    if (roundKey === lastKey) return;
    const first = lastKey === '';
    const nextInRound = !first && roundOf(roundKey) === roundOf(lastKey);
    lastKey = roundKey;
    invalid = false;
    if (nextInRound || (first && focusOnMount)) queueMicrotask(() => heading?.focus());
  });

  $effect(() => {
    if (!answered) return;
    queueMicrotask(() => (showFeedback ? feedbackBox : nextButton)?.focus());
  });

  // Once the user has produced a valid answer, drop the "choose or enter an answer" warning
  // instead of leaving it up until the next Check press.
  $effect(() => {
    if (value !== null && invalid) invalid = false;
  });

  function trySubmit(): void {
    if (answered) return onnext();
    if (!value) { invalid = true; return; }
    invalid = false;
    onsubmit(value);
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    trySubmit();
  }

  // For a mapPick coords question, the point is set via the map's coordinate sliders
  // (role="slider" elements rendered by MapStage, outside this <form>), so a native
  // "submit on Enter" never fires there. Listen globally so pressing Enter while a slider
  // is focused submits the answer, matching the behaviour of every other input kind.
  $effect(() => {
    if (answered || question.input.kind !== 'coords' || !question.input.mapPick) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (!(e.target instanceof HTMLElement) || e.target.getAttribute('role') !== 'slider') return;
      e.preventDefault();
      trySubmit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<form class="card" class:big onsubmit={submit} novalidate>
  <div class="top">
    <p class="progress eyebrow">{t('practice.progress', { n: number, total })}</p>
    <ol class="steps" aria-hidden="true">
      {#each { length: total } as _, i (i)}<li class:past={i < number - 1} class:now={i === number - 1}></li>{/each}
    </ol>
  </div>
  <h2 tabindex="-1" bind:this={heading} id="{uid}-prompt">{renderText(question.prompt)}</h2>

  {#key roundKey}
    {#if question.input.kind === 'choice'}
      <!-- The correct index is only ever handed to ChoiceInput once the question is answered *and*
           feedback is being shown for it (Rehearsal runs with showFeedback=false so it never leaks
           the answer while the test is still in progress). -->
      <ChoiceInput options={question.input.options} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" {big}
        correctIndex={answered && showFeedback && question.answer.kind === 'choice' ? question.answer.index : undefined} />
    {:else if question.input.kind === 'coords'}
      <CoordsInput spec={question.input} bind:value bind:draft={coordsDraft} disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {:else if question.input.kind === 'number'}
      <NumberInput unit={question.input.unit} bind:value bind:draft={numberDraft} disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {:else if question.input.kind === 'clock'}
      <ClockInput bind:value bind:draft={clockDraft} disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {/if}
  {/key}

  {#if invalid}<p class="need" role="alert">{t('practice.needAnswer')}</p>{/if}

  {#if hint}
    <!-- Always in the DOM (empty until used), so screen readers announce the hint when it appears. -->
    <div class="hint" aria-live="polite">
      {#if hinted}
        <p class="hint-text"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></svg><span><strong>{t('practice.hint')}:</strong> {t(`q.hint.${question.type}`)}</span></p>
      {/if}
    </div>
  {/if}

  {#if !answered}
    <div class="buttons">
      <button type="submit" class="btn primary lg">{t('practice.check')}</button>
      {#if hint}
        <!-- Stays in place once used (aria-disabled, not removed), so keyboard focus is not dropped. -->
        <button type="button" class="btn lg hint-btn" aria-disabled={hinted} onclick={() => { if (!hinted) onhint?.(); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></svg>
          {t('practice.hint')}
        </button>
      {/if}
    </div>
  {:else}
    {#if showFeedback && result}
      <!-- Focused programmatically after answering (for screen-reader users to hear the
           verdict first). It is a plain div, so the browser will not treat Enter here as an
           implicit form submission the way it does for a focused text field or radio;
           handle it explicitly so keyboard users can press Enter to move on. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -- programmatically focused status text, not a generic interactive widget; Enter is a keyboard convenience for the "move to next question" action already available via the button below -->
      <div tabindex="-1" bind:this={feedbackBox} class="fb" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onnext(); } }}>
        <Feedback {question} {result} />
      </div>
    {/if}
    <button type="submit" class="btn primary lg" bind:this={nextButton}>{nextLabel} <span aria-hidden="true">→</span></button>
  {/if}
</form>

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-2); padding: var(--space-5) var(--space-6) var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2) var(--space-4); }
  .steps { display: flex; gap: 3px; list-style: none; margin: 0; padding: 0; flex: 1 1 8rem; max-width: 14rem; }
  .steps li { flex: 1; height: 6px; border-radius: 3px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border); transition: background-color 300ms var(--ease); }
  .steps li.past { background: color-mix(in srgb, var(--accent) 45%, var(--surface-2)); box-shadow: none; }
  .steps li.now { background: var(--accent); box-shadow: none; }
  h2 { margin: 0; font-size: var(--step-2); font-weight: var(--weight-heavy); line-height: 1.25; }
  h2:focus { outline: none; }
  /* Focused by the page itself (a new step, question or result) for screen readers: a quiet bar at the side, not a frame round the heading. */
  h2:focus-visible { outline: none; box-shadow: -0.35rem 0 0 var(--focus); }
  @media (forced-colors: active) { h2:focus-visible { outline: 2px solid Highlight; } }
  .big h2 { font-size: clamp(1.6rem, 1rem + 3vw, 4rem); }
  .primary { align-self: flex-start; }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
  .hint:empty { position: absolute; } /* out of the card's flex gap while empty, still in the accessibility tree */
  .hint-text { display: flex; gap: var(--space-2); align-items: flex-start; margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius); background: var(--warm-soft); color: var(--text); border: 1px solid color-mix(in srgb, var(--warm) 45%, transparent); }
  .hint-text svg, .hint-btn svg { flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .hint-text svg { margin-top: 0.15rem; color: var(--warm-text); }
  .need { color: var(--bad); font-weight: var(--weight-strong); margin: 0; }
  .fb:focus { outline: none; }
  .fb:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: var(--radius); }
  @media (max-width: 599px) { .card { padding: var(--space-4); gap: var(--space-3); } .primary { align-self: stretch; } .buttons > .btn { flex: 1 1 auto; } }
</style>
