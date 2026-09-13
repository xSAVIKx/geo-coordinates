<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import { renderText, type Text } from '../../i18n/text';
  import type { Answer } from '../types';

  let { options, value = $bindable(null), disabled = false, invalid = false, describedBy, big = false }: {
    options: Text[]; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string; big?: boolean;
  } = $props();
  const name = `choice-${Math.random().toString(36).slice(2, 8)}`;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const selected = $derived(value?.kind === 'choice' ? value.index : -1);
</script>

<fieldset class="choices" class:big role="radiogroup" aria-invalid={invalid} aria-describedby={describedBy}>
  <legend class="visually-hidden">{t('input.chooseOne')}</legend>
  {#each options as option, i (i)}
    <label class="choice" class:checked={selected === i}>
      <input type="radio" {name} value={i} checked={selected === i} {disabled} onchange={() => (value = { kind: 'choice', index: i })} />
      <span class="letter" aria-hidden="true">{letters[i]}</span>
      <span class="text">{renderText(option)}</span>
    </label>
  {/each}
</fieldset>

<style>
  .choices { border: 0; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
  .choices.big { grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--space-4); }
  .choice { display: flex; align-items: center; gap: var(--space-3); min-height: var(--tap); padding: var(--space-2) var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); cursor: pointer; }
  .big .choice { font-size: clamp(1.2rem, 0.9rem + 1.4vw, 2.2rem); padding: var(--space-4); }
  .choice.checked { border-color: var(--accent); background: var(--surface-2); }
  .choice:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .choice input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .letter { flex: none; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); border: 2px solid var(--border); font-weight: 700; }
  .checked .letter { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .choice:has(input:disabled) { cursor: default; }
</style>
