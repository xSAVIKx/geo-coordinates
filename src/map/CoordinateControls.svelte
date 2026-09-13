<script lang="ts">
  import { formatLat, formatLatLon, formatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { spokenLat, spokenLon } from '../i18n/spoken';
  import { mapState } from './mapState.svelte';
  import Slider from './Slider.svelte';

  const p = $derived(mapState.point);
  const prec = $derived(mapState.precision);
</script>

{#if p && mapState.showReadout}
  <div class="controls">
    <p class="readout"><span class="visually-hidden">{t('controls.readout')}: </span><output>{formatLatLon(p, i18n.lang, prec)}</output></p>
    {#if mapState.pointEditable}
      <div class="sliders">
        <Slider label={t('controls.latitude')} min={-90} max={90} value={p.lat}
          step={mapState.stepSize(false)} bigStep={mapState.stepSize(true)}
          display={formatLat(p.lat, i18n.lang, prec)} valueText={spokenLat(p.lat, i18n.lang, prec)}
          onchange={(v) => mapState.userSetPoint({ lat: v, lon: p.lon }, 'slider')} />
        <Slider label={t('controls.longitude')} min={-180} max={180} value={p.lon} wrap
          step={mapState.stepSize(false)} bigStep={mapState.stepSize(true)}
          display={formatLon(p.lon, i18n.lang, prec)} valueText={spokenLon(p.lon, i18n.lang, prec)}
          onchange={(v) => mapState.userSetPoint({ lat: p.lat, lon: v }, 'slider')} />
      </div>
    {/if}
  </div>
{/if}

<style>
  .controls { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3) var(--space-4); }
  .readout { margin: 0 0 var(--space-2); font-size: clamp(1.4rem, 1rem + 2vw, 2.4rem); font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; }
  .sliders { display: grid; gap: var(--space-3) var(--space-6); grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
</style>
