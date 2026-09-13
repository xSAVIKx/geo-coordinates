<script lang="ts">
  import { formatLat, formatLon, parseAngle } from '../../geo/format';
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { mapState } from '../../map/mapState.svelte';
  import type { Answer, InputSpec } from '../types';

  let { spec, value = $bindable(null), disabled = false, invalid = false, describedBy }: {
    spec: Extract<InputSpec, { kind: 'coords' }>; value?: Answer | null; disabled?: boolean; invalid?: boolean; describedBy?: string;
  } = $props();

  const uid = `coords-${Math.random().toString(36).slice(2, 8)}`;
  let latText = $state('');
  let lonText = $state('');
  const exLat = $derived(formatLat(spec.precision === 'minute' ? 52.25 : 52, i18n.lang, spec.precision));
  const exLon = $derived(formatLon(spec.precision === 'minute' ? -21.5 : -21, i18n.lang, spec.precision));
  const latVal = $derived(parseAngle(latText, 'lat'));
  const lonVal = $derived(parseAngle(lonText, 'lon'));

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
        <input id="{uid}-lat" type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={latText} {disabled}
          aria-invalid={invalid && latVal === null} aria-describedby="{uid}-lat-ex {describedBy ?? ''}" />
        <span id="{uid}-lat-ex" class="ex">{invalid && latVal === null ? t('input.invalid', { example: exLat }) : t('input.example', { example: exLat })}</span>
      </div>
    {/if}
    {#if spec.fields !== 'lat'}
      <div class="field">
        <label for="{uid}-lon">{t('input.lon')}</label>
        <input id="{uid}-lon" type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={lonText} {disabled}
          aria-invalid={invalid && lonVal === null} aria-describedby="{uid}-lon-ex {describedBy ?? ''}" />
        <span id="{uid}-lon-ex" class="ex">{invalid && lonVal === null ? t('input.invalid', { example: exLon }) : t('input.example', { example: exLon })}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .fields { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  label { font-weight: 600; }
  input { min-height: var(--tap); font-size: 1.25rem; padding: 0 var(--space-3); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  input[aria-invalid='true'] { border-color: var(--bad); }
  .ex { color: var(--text-muted); font-size: 0.95rem; }
  input[aria-invalid='true'] + .ex { color: var(--bad); font-weight: 600; }
  .hint { margin: 0; font-weight: 600; }
</style>
