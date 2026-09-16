<script lang="ts">
  import { formatLat } from '../geo/format';
  import { dayInfo, polarLimits, splitMinutes } from '../geo/seasons';
  import { dateFromDayAndMinutes } from '../geo/sun';
  import { formatClock } from '../geo/time';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { keepTogether } from '../i18n/text';
  import { mapState } from './mapState.svelte';

  // Spec §6.1 readout for the movable point, at noon UTC of the scene's day, in the lesson's notation.
  const info = $derived.by(() => {
    const s = mapState.sun, p = mapState.point;
    return s && p ? dayInfo(p.lat, dateFromDayAndMinutes(s.year, s.dayOfYear, 720), mapState.realSun) : null;
  });
  const limits = $derived(info ? polarLimits(info.declination) : null);
  const duration = (m: number) => { const { h, m: min } = splitMinutes(m); return t('seasons.duration', { h, m: String(min).padStart(2, '0') }); };
  const lat = (v: number) => keepTogether(formatLat(v, i18n.lang, 'minute'));
</script>

{#if info}
  <section class="seasons" aria-labelledby="seasons-title">
    <h3 id="seasons-title">{t('seasons.readout')}</h3>
    <dl>
      <div><dt>{t('seasons.dayLength')}</dt><dd>{duration(info.dayMinutes)}</dd></div>
      <!-- A <dl> may hold only dt/dd (in plain <div> wrappers), so the polar note goes after the list, not inside it. -->
      {#if info.polar === null}
        <div><dt>{t('seasons.sunrise')}</dt><dd>{formatClock(info.sunrise!)} <span class="unit">({t('seasons.solarTime')})</span></dd></div>
        <div><dt>{t('seasons.sunset')}</dt><dd>{formatClock(info.sunset!)} <span class="unit">({t('seasons.solarTime')})</span></dd></div>
      {/if}
    </dl>
    {#if info.polar === 'day'}<p class="polar">{t('seasons.polarDayHere')}</p>
    {:else if info.polar === 'night'}<p class="polar">{t('seasons.polarNightHere')}</p>{/if}
    <p>{t('seasons.overhead', { lat: lat(info.declination) })}</p>
    {#if limits}
      <p>{t(limits.day.hemisphere === 'N' ? 'seasons.polarDayNorth' : 'seasons.polarDaySouth', { lat: lat(limits.day.hemisphere === 'N' ? limits.day.lat : -limits.day.lat) })}</p>
      <p>{t(limits.night.hemisphere === 'N' ? 'seasons.polarNightNorth' : 'seasons.polarNightSouth', { lat: lat(limits.night.hemisphere === 'N' ? limits.night.lat : -limits.night.lat) })}</p>
    {:else}
      <p>{t('seasons.equinoxNoPolar')}</p>
    {/if}
  </section>
{/if}

<style>
  .seasons { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); min-width: 0; }
  h3 { margin: 0 0 var(--space-2); font-size: var(--step-1); }
  dl { margin: 0; display: grid; gap: var(--space-1); }
  dl div { display: flex; justify-content: space-between; gap: var(--space-3); }
  dt { color: var(--text-muted); }
  dd { margin: 0; font-weight: var(--weight-heavy); font-variant-numeric: tabular-nums; }
  .unit { font-weight: 500; color: var(--text-muted); font-size: var(--step--1); }
  .polar { font-weight: var(--weight-strong); }
  p { margin: var(--space-1) 0 0; }
</style>
