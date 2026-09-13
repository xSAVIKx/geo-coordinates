<script lang="ts">
  import { formatClock, parseClock } from '../../geo/time';
  import { t } from '../../i18n/i18n.svelte';
  import type { Answer } from '../types';

  // `draft` holds the raw typed text and is `$bindable`, like NumberInput's, so Practice can keep it across the
  // remount that happens when the phone/desktop layout switch moves the question card.
  let { value = $bindable(null), draft = $bindable(''), disabled = false, invalid = false, describedBy }: {
    value?: Answer | null; draft?: string; disabled?: boolean; invalid?: boolean; describedBy?: string;
  } = $props();
  const uid = `clock-${Math.random().toString(36).slice(2, 8)}`;
  const minutes = $derived(parseClock(draft));

  $effect(() => {
    if (disabled) return;
    value = minutes === null ? null : { kind: 'clock', minutes };
  });
</script>

<div class="field">
  <label for={uid}>{t('input.clock')}</label>
  <div class="row">
    <svg class="clock" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 6.8V12l3.4 2.1" /></svg>
    <!-- inputmode="decimal": a phone keypad then offers "." (or ","), which numeric keypads leave out. -->
    <input id={uid} type="text" inputmode="decimal" autocomplete="off" placeholder="--:--" maxlength="5" bind:value={draft} {disabled}
      aria-invalid={invalid} aria-describedby="{uid}-ex {describedBy ?? ''}" />
    {#if minutes !== null && !/^\s*\d{1,2}:\d{2}\s*$/.test(draft)}<span class="as" aria-hidden="true">= {formatClock(minutes)}</span>{/if}
  </div>
  <span id="{uid}-ex" class="ex" class:err={invalid}>{invalid ? t('input.clockInvalid') : t('input.example', { example: '13:24' })}</span>
</div>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  label { font-weight: var(--weight-strong); }
  .row { display: flex; gap: var(--space-2); align-items: center; }
  .clock { width: 1.6rem; height: 1.6rem; flex: none; fill: none; stroke: var(--text-muted); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  input { min-height: 3rem; width: 7.5rem; max-width: 100%; font-size: var(--step-2); font-weight: var(--weight-heavy); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; text-align: center; padding: 0 var(--space-3); border: 2px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.05); transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
  input::placeholder { color: var(--text-muted); opacity: 0.6; }
  input:hover:not(:disabled) { border-color: var(--text-muted); }
  input:focus-visible { outline: 2px solid transparent; outline-offset: 2px; border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus); }
  @media (forced-colors: active) { input:focus-visible { outline-color: Highlight; } }
  input:disabled { background: var(--surface-2); color: var(--text); opacity: 1; }
  input[aria-invalid='true'] { border-color: var(--bad); background: var(--bad-soft); }
  .as { font-size: var(--step-1); font-weight: var(--weight-strong); color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .ex { color: var(--text-muted); font-size: var(--step--1); }
  .err { color: var(--bad); font-weight: var(--weight-strong); font-size: var(--step-0); }
</style>
