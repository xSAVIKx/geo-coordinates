<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import { renderText, type Text } from '../../i18n/text';
  import type { Answer } from '../types';

  let { options, value = $bindable(null), disabled = false, invalid = false, describedBy, big = false, correctIndex }: {
    options: Text[]; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string; big?: boolean;
    // The correct option's index — only ever passed once the question has been answered *and*
    // feedback is being shown (Practice's ChoiceInput call site enforces both); passing it earlier
    // would leak the answer while the question is still live.
    correctIndex?: number;
  } = $props();
  const name = `choice-${Math.random().toString(36).slice(2, 8)}`;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const selected = $derived(value?.kind === 'choice' ? value.index : -1);
</script>

<fieldset class="choices" class:big role="radiogroup" aria-invalid={invalid} aria-describedby={describedBy}>
  <legend class="visually-hidden">{t('input.chooseOne')}</legend>
  {#each options as option, i (i)}
    {@const isCorrect = correctIndex === i}
    {@const isWrongChosen = disabled && selected === i && correctIndex !== undefined && !isCorrect}
    <label class="choice" class:checked={selected === i} class:correct={isCorrect} class:wrong={isWrongChosen}>
      <input type="radio" {name} value={i} checked={selected === i} {disabled} onchange={() => (value = { kind: 'choice', index: i })} />
      <span class="letter" aria-hidden="true">{letters[i]}</span>
      <span class="text">{renderText(option)}</span>
      {#if isCorrect}
        <span class="badge ok" aria-hidden="true">✓</span><span class="visually-hidden">({t('practice.resultCorrect')})</span>
      {:else if isWrongChosen}
        <span class="badge bad" aria-hidden="true">✗</span><span class="visually-hidden">({t('practice.resultWrong')})</span>
      {:else}
        <svg class="tick" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      {/if}
    </label>
  {/each}
</fieldset>

<style>
  .choices { border: 0; padding: 0; margin: 0; display: grid; gap: var(--space-2); min-width: 0; }
  .choices.big { grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--space-4); }
  .choice { position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 3.25rem; padding: var(--space-2) var(--space-4) var(--space-2) var(--space-2); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); cursor: pointer; font-size: var(--step-0); transition: border-color var(--dur) var(--ease), background-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
  .choice:hover { border-color: var(--border-strong); box-shadow: var(--shadow-1); }
  .big .choice { font-size: clamp(1.2rem, 0.9rem + 1.4vw, 2.2rem); padding: var(--space-4); }
  .choice.checked { border-color: var(--accent); background: var(--accent-soft); box-shadow: none; }
  .choice:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .choice input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .letter { flex: none; width: 2.25rem; height: 2.25rem; border-radius: var(--radius-sm); display: grid; place-items: center; background: var(--surface-2); border: 1px solid var(--border-strong); font-weight: var(--weight-heavy); font-size: var(--step--1); transition: background-color var(--dur) var(--ease); }
  .checked .letter { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .text { flex: 1; font-weight: 550; }
  .tick { flex: none; fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transform: scale(0.6); transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease); }
  .checked .tick { opacity: 1; transform: none; }
  .choice:has(input:disabled) { cursor: default; }
  /* After checking, the tick would read as "right" even when the answer was wrong: the feedback box carries the verdict. */
  .choice:has(input:disabled) .tick { display: none; }
  .choice:has(input:disabled):not(.checked) { opacity: 0.7; box-shadow: none; }
  .choice:has(input:disabled):hover { border-color: var(--border); }
  .choice.checked:has(input:disabled):hover { border-color: var(--accent); }
  /* Once answered, the correct option is always highlighted (even if it wasn't picked) and the
     chosen wrong one gets its own colour, on top of the .checked/dimmed rules above. */
  .choice.correct:has(input:disabled) { opacity: 1; border-color: var(--ok); background: var(--ok-soft); box-shadow: none; }
  .choice.correct .letter { background: var(--ok); color: var(--surface); border-color: var(--ok); }
  .choice.wrong:has(input:disabled) { opacity: 1; border-color: var(--bad); background: var(--bad-soft); box-shadow: none; }
  .choice.wrong .letter { background: var(--bad); color: var(--surface); border-color: var(--bad); }
  .badge { flex: none; display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; font-weight: var(--weight-heavy); font-size: 0.85em; line-height: 1; }
  .badge.ok { background: var(--ok); color: var(--surface); }
  .badge.bad { background: var(--bad); color: var(--surface); }
</style>
