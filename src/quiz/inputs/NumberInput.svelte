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
  label { font-weight: var(--weight-strong); }
  input { min-height: 3rem; width: 10rem; max-width: 100%; font-size: var(--step-1); font-weight: 600; font-variant-numeric: tabular-nums; padding: 0 var(--space-3); border: 2px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.05); transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
  input:hover:not(:disabled) { border-color: var(--text-muted); }
  input:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus); }
  input:disabled { background: var(--surface-2); color: var(--text); opacity: 1; }
  input[aria-invalid='true'] { border-color: var(--bad); background: var(--bad-soft); }
  .row { display: flex; gap: var(--space-2); align-items: center; }
  .unit { font-size: var(--step-1); font-weight: var(--weight-heavy); color: var(--text-muted); }
  .err { color: var(--bad); font-weight: var(--weight-strong); }
</style>
