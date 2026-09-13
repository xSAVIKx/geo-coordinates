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
    <p class="readout"><span class="visually-hidden">{t('controls.readout')}: </span><output aria-live="off">{formatLatLon(p, i18n.lang, prec)}</output></p>
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
  .controls { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); padding: var(--space-3) var(--space-5) var(--space-4); }
  .readout { margin: 0 0 var(--space-2); font-size: var(--step-4); font-weight: var(--weight-heavy); letter-spacing: -0.01em; line-height: 1.15; font-variant-numeric: tabular-nums; text-align: center; }
  .readout:last-child { margin: 0; }
  .sliders { display: grid; gap: var(--space-3) var(--space-8); grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
  @media (max-width: 599px) { .controls { padding: var(--space-3) var(--space-4); } .readout { font-size: var(--step-3); } }
</style>
