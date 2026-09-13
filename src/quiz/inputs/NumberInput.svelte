<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import type { Answer } from '../types';

  let { unit, value = $bindable(null), disabled = false, invalid = false, describedBy }: {
    unit: 'deg' | 'km' | 'h' | 'min'; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string;
  } = $props();
  const uid = `num-${Math.random().toString(36).slice(2, 8)}`;
  let text = $state('');

  $effect(() => {
    if (disabled) return;
    const cleaned = text.trim().replace(/\s+/g, '').replace(',', '.').replace(/°$/, '');
    const n = cleaned === '' ? NaN : Number(cleaned);
    value = Number.isFinite(n) ? { kind: 'number', value: n } : null;
  });
</script>

<div class="field">
  <label for={uid}>{t('input.number')}</label>
  <div class="row">
    <input id={uid} type="text" inputmode="decimal" autocomplete="off" bind:value={text} {disabled}
      aria-invalid={invalid} aria-describedby="{uid}-err {describedBy ?? ''}" />
    <span class="unit">{t(`unit.label.${unit}`)}</span>
  </div>
  {#if invalid}<span id="{uid}-err" class="err">{t('input.numberInvalid')}</span>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  label { font-weight: 600; }
  .row { display: flex; gap: var(--space-2); align-items: center; }
  input { min-height: var(--tap); width: 10rem; font-size: 1.35rem; padding: 0 var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  input[aria-invalid='true'] { border-color: var(--bad); }
  .unit { font-size: 1.25rem; font-weight: 700; }
  .err { color: var(--bad); font-weight: 600; }
</style>
