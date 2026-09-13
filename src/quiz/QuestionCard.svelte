<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import Feedback from './Feedback.svelte';
  import ChoiceInput from './inputs/ChoiceInput.svelte';
  import CoordsInput from './inputs/CoordsInput.svelte';
  import NumberInput from './inputs/NumberInput.svelte';
  import type { Answer, CheckResult, Question } from './types';

  let { question, number, total, result, onsubmit, onnext, nextLabel, showFeedback = true, big = false }: {
    question: Question; number: number; total: number; result: CheckResult | null;
    onsubmit: (a: Answer) => void; onnext: () => void; nextLabel: string; showFeedback?: boolean; big?: boolean;
  } = $props();

  let value = $state<Answer | null>(null);
  let invalid = $state(false);
  let heading: HTMLHeadingElement;
  let feedbackBox = $state<HTMLDivElement>();
  let nextButton = $state<HTMLButtonElement>();
  const uid = `q-${Math.random().toString(36).slice(2, 8)}`;
  const answered = $derived(result !== null);

  let lastId = '';
  $effect(() => {
    if (question.id === lastId) return;
    const first = lastId === '';
    lastId = question.id;
    value = null;
    invalid = false;
    if (!first) queueMicrotask(() => heading?.focus());
  });

  $effect(() => {
    if (!answered) return;
    queueMicrotask(() => (showFeedback ? feedbackBox : nextButton)?.focus());
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
  <p class="progress">{t('practice.progress', { n: number, total })}</p>
  <h2 tabindex="-1" bind:this={heading} id="{uid}-prompt">{renderText(question.prompt)}</h2>

  {#key question.id}
    {#if question.input.kind === 'choice'}
      <ChoiceInput options={question.input.options} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" {big} />
    {:else if question.input.kind === 'coords'}
      <CoordsInput spec={question.input} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {:else if question.input.kind === 'number'}
      <NumberInput unit={question.input.unit} bind:value disabled={answered} {invalid} describedBy="{uid}-prompt" />
    {/if}
  {/key}

  {#if invalid}<p class="need" role="alert">{t('practice.needAnswer')}</p>{/if}

  {#if !answered}
    <button type="submit" class="primary">{t('practice.check')}</button>
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
    <button type="submit" class="primary" bind:this={nextButton}>{nextLabel}</button>
  {/if}
</form>

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4) var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
  .progress { margin: 0; color: var(--text-muted); font-weight: 600; }
  h2 { margin: 0; font-size: clamp(1.2rem, 1rem + 1vw, 1.8rem); line-height: 1.3; }
  .big h2 { font-size: clamp(1.6rem, 1rem + 3vw, 4rem); }
  .primary { align-self: flex-start; background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 0 var(--space-6); font-weight: 700; font-size: 1.1rem; }
  .need { color: var(--bad); font-weight: 600; margin: 0; }
  .fb:focus { outline: none; }
  .fb:focus-visible { outline: 3px solid var(--focus); border-radius: var(--radius); }
</style>
