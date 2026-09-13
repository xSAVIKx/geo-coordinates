<script lang="ts">
  import { formatLat, formatLon, parseAngle } from '../../geo/format';
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { mapState } from '../../map/mapState.svelte';
  import type { Answer, InputSpec } from '../types';

  // `draft` holds the raw, possibly-unparsable typed text for both fields. It is `$bindable` so
  // a parent (Practice) can keep it alive across a remount of this component — e.g. when the
  // phone/desktop layout swap moves the question card to a different place in the DOM — instead
  // of the typed text being lost the way a purely-local `$state` would be.
  let { spec, value = $bindable(null), draft = $bindable({ lat: '', lon: '' }), disabled = false, invalid = false, describedBy }: {
    spec: Extract<InputSpec, { kind: 'coords' }>; value?: Answer | null; draft?: { lat: string; lon: string }; disabled?: boolean; invalid?: boolean; describedBy?: string;
  } = $props();

  const uid = `coords-${Math.random().toString(36).slice(2, 8)}`;
  const exLat = $derived(formatLat(spec.precision === 'minute' ? 52.25 : 52, i18n.lang, spec.precision));
  const exLon = $derived(formatLon(spec.precision === 'minute' ? -21.5 : -21, i18n.lang, spec.precision));
  const latVal = $derived(parseAngle(draft.lat, 'lat'));
  const lonVal = $derived(parseAngle(draft.lon, 'lon'));

  $effect(() => {
    if (disabled) return;
    if (spec.mapPick) {
      const p = mapState.point;
      value = p ? { kind: 'coords', value: { ...p } } : null;
      return;
    }
    const needLat = spec.fields !== 'lon', needLon = spec.fields !== 'lat';
    if ((needLat && latVal === null) || (needLon && lonVal === null)) { value = null; return; }
    value = { kind: 'coords', value: { lat: latVal ?? 0, lon: lonVal ?? 0 } };
  });
</script>

{#if spec.mapPick}
  <p class="hint" id="{uid}-hint">{t('input.usePoint')}</p>
{:else}
  <div class="fields">
    {#if spec.fields !== 'lon'}
      <div class="field">
        <label for="{uid}-lat">{t('input.lat')}</label>
        <input id="{uid}-lat" type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={draft.lat} {disabled}
          aria-invalid={invalid && latVal === null} aria-describedby="{uid}-lat-ex {describedBy ?? ''}" />
        <span id="{uid}-lat-ex" class="ex">{invalid && latVal === null ? t('input.invalid', { example: exLat }) : t('input.example', { example: exLat })}</span>
      </div>
    {/if}
    {#if spec.fields !== 'lat'}
      <div class="field">
        <label for="{uid}-lon">{t('input.lon')}</label>
        <input id="{uid}-lon" type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={draft.lon} {disabled}
          aria-invalid={invalid && lonVal === null} aria-describedby="{uid}-lon-ex {describedBy ?? ''}" />
        <span id="{uid}-lon-ex" class="ex">{invalid && lonVal === null ? t('input.invalid', { example: exLon }) : t('input.example', { example: exLon })}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .fields { display: grid; gap: var(--space-3) var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
  .field { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  label { font-weight: var(--weight-strong); }
  input { min-height: 3rem; font-size: var(--step-1); font-weight: 600; font-variant-numeric: tabular-nums; padding: 0 var(--space-3); border: 2px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.05); transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
  input:hover:not(:disabled) { border-color: var(--text-muted); }
  input:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus); }
  input:disabled { background: var(--surface-2); color: var(--text); opacity: 1; }
  input[aria-invalid='true'] { border-color: var(--bad); background: var(--bad-soft); }
  .ex { color: var(--text-muted); font-size: var(--step--1); }
  input[aria-invalid='true'] + .ex { color: var(--bad); font-weight: var(--weight-strong); }
  .hint { margin: 0; font-weight: var(--weight-strong); display: flex; gap: var(--space-2); align-items: flex-start; padding: var(--space-3) var(--space-4); border-radius: var(--radius); background: var(--accent-soft); }
</style>
