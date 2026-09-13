<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import Feedback from './Feedback.svelte';
  import ChoiceInput from './inputs/ChoiceInput.svelte';
  import CoordsInput from './inputs/CoordsInput.svelte';
  import NumberInput from './inputs/NumberInput.svelte';
  import type { Answer, CheckResult, Question } from './types';

  // `roundKey` identifies this question *within its round* (e.g. `${seed}:${difficulty}:${index}`
  // from Practice), not `question.id` — generator ids are `${type}-${seedIndex}` and repeat across
  // different seeds/difficulties at the same position, so keying the reset/remount logic on
  // `question.id` would leave a stale selection/typed answer/feedback on screen when, say, the
  // difficulty changes while staying on question 1.
  //
  // `value` and the two `*Draft` props are `$bindable`, owned by Practice rather than local
  // `$state` here. The phone/desktop layout switch (see MapStage's `midContent`) moves this
  // component to a different place in the DOM, which destroys and recreates it — a purely local
  // answer would be lost on every resize across the breakpoint. Because Practice holds the real
  // state, a fresh instance picks the in-progress answer back up from its initial prop values.
  let {
    question, number, total, result, onsubmit, onnext, nextLabel, roundKey,
    value = $bindable(null), coordsDraft = $bindable({ lat: '', lon: '' }), numberDraft = $bindable(''),
    showFeedback = true, big = false,
  }: {
    question: Question; number: number; total: number; result: CheckResult | null;
    onsubmit: (a: Answer) => void; onnext: () => void; nextLabel: string; roundKey: string;
    value?: Answer | null; coordsDraft?: { lat: string; lon: string }; numberDraft?: string;
    showFeedback?: boolean; big?: boolean;
  } = $props();

  let invalid = $state(false);
  let heading: HTMLHeadingElement;
  let feedbackBox = $state<HTMLDivElement>();
  let nextButton = $state<HTMLButtonElement>();
  const uid = `q-${Math.random().toString(36).slice(2, 8)}`;
  const answered = $derived(result !== null);

  // Resetting `value`/the drafts for a new question is Practice's job (it owns them and must do
  // it before this component even mounts on the very first question); this only handles moving
  // focus to the heading on every question after the first.
  let lastKey = '';
  $effect(() => {
    if (roundKey === lastKey) return;
    const first = lastKey === '';
    lastKey = roundKey;
    invalid = false;
    if (!first) queueMicrotask(() => heading?.focus());
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
      <ChoiceInput options={question.input.options} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" {big} />
    {:else if question.input.kind === 'coords'}
      <CoordsInput spec={question.input} bind:value bind:draft={coordsDraft} disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {:else if question.input.kind === 'number'}
      <NumberInput unit={question.input.unit} bind:value bind:draft={numberDraft} disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {/if}
  {/key}

  {#if invalid}<p class="need" role="alert">{t('practice.needAnswer')}</p>{/if}

  {#if !answered}
    <button type="submit" class="btn primary lg">{t('practice.check')}</button>
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
  h2:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; border-radius: 4px; }
  .big h2 { font-size: clamp(1.6rem, 1rem + 3vw, 4rem); }
  .primary { align-self: flex-start; }
  .need { color: var(--bad); font-weight: var(--weight-strong); margin: 0; }
  .fb:focus { outline: none; }
  .fb:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: var(--radius); }
  @media (max-width: 599px) { .card { padding: var(--space-4); gap: var(--space-3); } .primary { align-self: stretch; } }
</style>
