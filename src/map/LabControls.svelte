<script module lang="ts">
  import { DEFAULT_SPIN_SPEED } from './spinSpeeds';
  // Kept while the page is open, so the chosen speed survives moving between the lab and lesson steps.
  const spin = $state({ speed: DEFAULT_SPIN_SPEED });
  type Light = 'day' | 'dawn' | 'dusk' | 'night';
</script>

<script lang="ts">
  import { motionReduced } from '../app/settings.svelte';
  import { formatLon } from '../geo/format';
  import { dayLightMinutes, dayOfYear, daysInYear, elevationFrom, solarParams, sunPoint as sunPointAt } from '../geo/sun';
  import { apparentSolarMinutes, formatClock, localSolarMinutes } from '../geo/time';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { placeById } from './places';
  import Slider from './Slider.svelte';
  import { SPIN_SPEEDS, minutesPerMs, speedFactor } from './spinSpeeds';

  // Rows below are re-sorted by longitude (west to east) before rendering, so this list's order
  // doesn't matter for display. Katowice is the lesson's home city.
  const CLOCK_PLACES = ['newyork', 'london', 'katowice', 'kyiv', 'delhi', 'tokyo'];
  const GREENWICH_LAT = 51.48;

  const has = (c: (typeof mapState.labControls)[number]) => mapState.labControls.includes(c);
  let playing = $state(false);

  // A new scene (another explore step, the lab opening) starts with the Earth standing still.
  $effect(() => {
    void mapState.labControls;
    playing = false;
  });
  $effect(() => {
    if (playing && motionReduced()) playing = false;
  });

  // Spinning moves the Sun westward over the flat map; the globe turns with it, west to east, so the Sun stays
  // put in its view and the continents travel under day and night — the way the real Earth turns.
  $effect(() => {
    if (!playing) return;
    let last = performance.now();
    let pending = 0;
    let frame = requestAnimationFrame(function tick(now) {
      const sun = mapState.sun;
      if (!sun) { playing = false; return; }
      // Read every frame, so a new speed takes effect while the Earth is spinning.
      pending += (now - last) * minutesPerMs(SPIN_SPEEDS[spin.speed]!);
      last = now;
      const step = Math.floor(pending);
      if (step > 0) {
        pending -= step;
        mapState.sun = { ...sun, utcMinutes: (sun.utcMinutes + step) % 1440 };
        if (mapState.views.includes('globe')) {
          const [lambda, phi] = mapState.rotate;
          mapState.rotate = [((lambda + step / 4 + 540) % 360) - 180, phi];
        }
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  });

  const date = $derived(mapState.sunDate());
  const sunHere = $derived(date ? sunPointAt(date, mapState.realSun) : null);
  const dateLabel = $derived(date ? new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date) : '');

  // The time slider's track is the sky over Greenwich on the chosen day: night, dawn, day, dusk, night.
  const skyTrack = $derived.by(() => {
    if (!sunHere) return undefined;
    const light = dayLightMinutes(GREENWICH_LAT, sunHere.lat);
    const pct = (m: number) => `${Math.max(0, Math.min(100, (m / 1440) * 100)).toFixed(1)}%`;
    const rise = 720 - light / 2, set = 720 + light / 2;
    return `linear-gradient(90deg, var(--sky-night) ${pct(rise - 50)}, var(--sky-dawn) ${pct(rise)}, var(--sky-day) ${pct(rise + 70)}, var(--sky-noon) 50%, var(--sky-day) ${pct(set - 70)}, var(--sky-dawn) ${pct(set)}, var(--sky-night) ${pct(set + 50)})`;
  });

  const year = $derived(mapState.sun?.year ?? new Date().getUTCFullYear());
  const lastDay = $derived(daysInYear(year));
  const keyDates = $derived(([['march', 2, 20], ['june', 5, 21], ['september', 8, 23], ['december', 11, 21]] as const).map(([id, month, day]) => {
    const d = new Date(Date.UTC(year, month, day));
    return { id, day: dayOfYear(d), label: new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d) };
  }));

  const clocks = $derived.by(() => {
    const sun = mapState.sun;
    if (!sun || !sunHere || !has('clocks')) return [];
    const eq = mapState.realSun && date ? solarParams(date).eqTimeMin : 0;
    // Whole-degree meridians, as in the lesson's sums: London 0°, Katowice 19°E, Kyiv 31°E.
    const rows = CLOCK_PLACES.map((id) => {
      const p = placeById(id);
      return { id, name: t(`place.${id}`), lat: p.lat, lon: Math.round(p.lon) + 0 };
    });
    if (mapState.point) rows.push({ id: 'point', name: t('lab.thePoint', { lon: formatLon(mapState.point.lon, i18n.lang) }), lat: mapState.point.lat, lon: Math.round(mapState.point.lon) + 0 });
    return rows
      .map((r) => {
        const minutes = mapState.realSun ? apparentSolarMinutes(sun.utcMinutes, r.lon, eq) : localSolarMinutes(sun.utcMinutes, r.lon);
        const elevation = elevationFrom(sunHere, r);
        const light: Light = elevation > 0 ? 'day' : elevation > -6 ? (minutes < 720 ? 'dawn' : 'dusk') : 'night';
        return { ...r, minutes, time: formatClock(minutes), light, lonText: formatLon(r.lon, i18n.lang) };
      })
      .sort((a, b) => a.lon - b.lon || (a.id === 'point' ? 1 : -1));
  });

  const unitText = (i: number, unitDisplay: 'short' | 'long') => {
    const s = SPIN_SPEEDS[i]!;
    return new Intl.NumberFormat(i18n.lang, { style: 'unit', unit: s.unit, unitDisplay }).format(s.amount);
  };
  const speedHint = $derived.by(() => {
    const s = SPIN_SPEEDS[spin.speed]!;
    const factor = speedFactor(s);
    return factor === 1 ? t('lab.speedHintReal') : t('lab.speedHint', { duration: unitText(spin.speed, 'long'), factor: new Intl.NumberFormat(i18n.lang).format(factor) });
  });

  const hand = (deg: number, length: number) => `M12 12L${12 + length * Math.sin((deg * Math.PI) / 180)} ${12 - length * Math.cos((deg * Math.PI) / 180)}`;
</script>

{#snippet lightIcon(light: Light)}
  <svg class="light-icon {light}" viewBox="0 0 24 24" aria-hidden="true">
    {#if light === 'day'}
      <circle cx="12" cy="12" r="4.6" class="sun-fill" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" class="sun-rays" />
    {:else if light === 'night'}
      <path d="M15.8 3.6a8.6 8.6 0 1 0 4.6 12.9 7 7 0 0 1-4.6-12.9z" class="moon-fill" />
    {:else}
      <path d="M6.2 16.5a5.8 5.8 0 0 1 11.6 0z" class="sun-fill" /><path d="M2.5 16.5h19M2.5 20h19M12 5.2v2.4M4.6 8.6l1.6 1.6M19.4 8.6l-1.6 1.6" class="sun-rays" />
    {/if}
  </svg>
{/snippet}

{#if mapState.sun}
  <div class="lab-box"><div class="lab" class:has-clocks={has('clocks')}>
    {#if mapState.layers.daylight || has('sun-time') || has('sun-date') || has('now')}
    <div class="controls">
      {#if mapState.layers.daylight}
      <div class="legend" role="group" aria-label={t('map.daylight.label')}>
        {#if mapState.drawnMapStyle === 'satellite'}
          <!-- Satellite shows the night side as NASA's city lights instead of the three shades of the SVG wash. -->
          <span class="swatch lights"><i aria-hidden="true"></i>{t('lab.cityLights')}</span>
        {:else}
          <span class="swatch day"><i aria-hidden="true"></i>{t('lab.day')}</span>
          <span class="swatch twilight"><i aria-hidden="true"></i>{t('lab.twilight')}</span>
          <span class="swatch night"><i aria-hidden="true"></i>{t('lab.night')}</span>
        {/if}
      </div>
      {/if}
      {#if has('sun-time')}
        <Slider label={t('lab.time')} min={0} max={1439} step={15} bigStep={60} value={mapState.sun.utcMinutes}
          display={`${formatClock(mapState.sun.utcMinutes)} UTC`} valueText={`${formatClock(mapState.sun.utcMinutes)} UTC`} track={skyTrack}
          onchange={(v) => mapState.sun && (mapState.sun = { ...mapState.sun, utcMinutes: Math.round(v) })} />
      {/if}
      {#if has('sun-date')}
        <Slider label={t('lab.date')} min={1} max={lastDay} step={1} bigStep={30} value={Math.min(lastDay, mapState.sun.dayOfYear)}
          display={dateLabel} valueText={dateLabel}
          onchange={(v) => mapState.sun && (mapState.sun = { ...mapState.sun, dayOfYear: Math.round(v) })} />
        <div class="key-dates" role="group" aria-label={t('lab.keyDates')}>
          {#each keyDates as k (k.id)}
            <button type="button" class="btn" aria-pressed={mapState.sun.dayOfYear === k.day}
              onclick={() => mapState.sun && (mapState.sun = { ...mapState.sun, dayOfYear: k.day })}>
              <span class="kd-date">{k.label}</span><span class="kd-name">{t(`lab.keyDate.${k.id}`)}</span>
            </button>
          {/each}
        </div>
      {/if}
      {#if has('now') || (has('sun-time') && !motionReduced())}
        <div class="buttons">
          {#if has('sun-time') && !motionReduced()}
            <button type="button" class="btn spin" class:primary={!playing} onclick={() => (playing = !playing)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{#if playing}<path d="M8 5.5v13M16 5.5v13" />{:else}<path d="M20 12a8 8 0 1 1-2.35-5.65M20 4.5v4h-4" />{/if}</svg>
              {playing ? t('lab.pause') : t('lab.play')}
            </button>
          {/if}
          {#if has('now')}
            <button type="button" class="btn" onclick={() => mapState.setSunNow()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></svg>
              {t('lab.now')}
            </button>
          {/if}
        </div>
        {#if has('sun-time') && !motionReduced()}
          <div class="speed">
            <span class="speed-label" id="spin-speed-label">{t('lab.speed')}</span>
            <div class="speed-options" role="group" aria-labelledby="spin-speed-label" aria-describedby="spin-speed-hint">
              {#each SPIN_SPEEDS as _, i (i)}
                <button type="button" class="btn" aria-pressed={spin.speed === i} onclick={() => (spin.speed = i)}>{unitText(i, 'short')}</button>
              {/each}
            </div>
            <p class="speed-hint" id="spin-speed-hint">{speedHint}</p>
          </div>
        {/if}
      {/if}
    </div>
    {/if}
    {#if has('clocks')}
      <div class="clocks-wrap">
        <table class="clocks">
          <caption><span class="cap">{t('lab.clocks')}</span><span class="hint">{t('lab.clocksHint')}</span></caption>
          <thead><tr><th scope="col">{t('lab.place')}</th><th scope="col">{t('lab.solarTime')}</th><th scope="col">{t('lab.dayNight')}</th></tr></thead>
          <tbody>
            {#each clocks as c (c.id)}
              <tr class={c.light} class:point={c.id === 'point'}>
                <th scope="row"><span class="name">{c.name}</span>{#if c.id !== 'point'} <span class="lon">{c.lonText}</span>{/if}</th>
                <td class="time">
                  <svg class="face" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10.5" class="rim" />
                    <path d={hand(((c.minutes % 720) / 720) * 360, 5.2)} class="hour" />
                    <path d={hand(((c.minutes % 60) / 60) * 360, 8)} class="minute" />
                    <circle cx="12" cy="12" r="1.3" class="pin" />
                  </svg>
                  <span class="digits">{c.time}</span>
                </td>
                <td class="state">{@render lightIcon(c.light)}<span>{t(`lab.${c.light}`)}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div></div>
{/if}

<style>
  .lab-box { container-type: inline-size; min-width: 0; }
  .lab {
    --sky-night: #1c2750; --sky-dawn: #f4a261; --sky-day: #8ecdf7; --sky-noon: #cfeafe;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1);
    padding: var(--space-4) var(--space-5); display: grid; gap: var(--space-4) var(--space-8); grid-template-columns: minmax(0, 1fr);
  }
  @container (min-width: 52rem) { .lab.has-clocks { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
  .controls { display: grid; gap: var(--space-3); min-width: 0; }

  .legend { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); font-size: var(--step--1); color: var(--text-muted); font-weight: var(--weight-strong); }
  .swatch { display: inline-flex; align-items: center; gap: var(--space-2); }
  .swatch i { width: 1.6rem; height: 0.9rem; border-radius: 0.3rem; box-shadow: inset 0 0 0 1px var(--border-strong); }
  .swatch.day i { background: linear-gradient(var(--daylit), var(--daylit)), var(--land); }
  .swatch.twilight i { background: linear-gradient(var(--twilight), var(--twilight)), var(--land); }
  .swatch.night i { background: linear-gradient(var(--night), var(--night)), linear-gradient(var(--twilight), var(--twilight)), var(--land); }
  .swatch.lights i { background: radial-gradient(circle at 30% 60%, #ffd98a 0 2px, transparent 3px), radial-gradient(circle at 70% 40%, #ffe7b0 0 1.5px, transparent 2.5px), #0b1020; }

  .key-dates { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-1); }
  .key-dates .btn { flex-direction: column; gap: 0; padding: var(--space-1) var(--space-2); line-height: 1.15; min-width: 0; }
  .kd-date { font-weight: var(--weight-heavy); font-variant-numeric: tabular-nums; }
  .kd-name { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-wrap: balance; }
  @media (max-width: 599px) { .key-dates { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  .buttons { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .speed { display: grid; gap: var(--space-1); }
  .speed-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(4.2rem, 1fr)); gap: var(--space-1); }
  .speed-label { font-size: var(--step--1); font-weight: var(--weight-strong); color: var(--text-muted); }
  .speed-options .btn { padding-inline: var(--space-1); min-width: 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .speed-hint { margin: 0; font-size: var(--step--1); color: var(--text-muted); }
  .buttons svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

  .clocks-wrap { min-width: 0; }
  .clocks { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  caption { text-align: left; padding-bottom: var(--space-2); }
  .cap { display: block; font-size: var(--step-1); font-weight: var(--weight-heavy); }
  .hint { display: block; color: var(--text-muted); font-size: var(--step--1); }
  thead th { font-size: var(--step--1); font-weight: var(--weight-strong); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; padding: var(--space-1) var(--space-2); border-bottom: 2px solid var(--border); }
  th, td { text-align: left; padding: var(--space-1) var(--space-2); min-height: var(--tap); height: 2.9rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tbody th { font-weight: var(--weight-strong); }
  .name { margin-right: var(--space-2); }
  .lon { display: inline-block; color: var(--text-muted); font-size: var(--step--1); font-weight: 600; }
  tr.point th .name { color: var(--accent); }
  tr.point { box-shadow: inset 4px 0 0 var(--accent); }
  .time { white-space: nowrap; }
  .digits { font-size: var(--step-2); font-weight: var(--weight-heavy); letter-spacing: -0.01em; vertical-align: middle; }
  .face { width: 1.7rem; height: 1.7rem; vertical-align: middle; margin-right: var(--space-2); }
  .face .rim { fill: var(--surface); stroke: var(--border-strong); stroke-width: 1.5; }
  .face .hour, .face .minute { stroke: var(--text); stroke-linecap: round; }
  .face .hour { stroke-width: 2.4; } .face .minute { stroke-width: 1.6; }
  .face .pin { fill: var(--text); }
  tr.night .face .rim { fill: var(--sky-night); stroke: var(--sky-night); }
  tr.night .face .hour, tr.night .face .minute { stroke: #f1f4ff; } tr.night .face .pin { fill: #f1f4ff; }
  tr.dawn .face .rim, tr.dusk .face .rim { fill: color-mix(in srgb, var(--sky-dawn) 45%, var(--surface)); }
  .state { white-space: nowrap; font-weight: var(--weight-strong); }
  .state span { vertical-align: middle; }
  .light-icon { width: 1.5rem; height: 1.5rem; vertical-align: middle; margin-right: var(--space-2); }
  .sun-fill { fill: var(--sun); stroke: var(--sun-stroke); stroke-width: 1.2; }
  .sun-rays { fill: none; stroke: var(--sun-stroke); stroke-width: 1.8; stroke-linecap: round; }
  .moon-fill { fill: var(--moon); }
  @media (max-width: 599px) {
    .lab { padding: var(--space-3); }
    th, td { padding: var(--space-2) var(--space-1); }
    .face { display: none; }
    .digits { font-size: var(--step-1); }
  }
  @container (max-width: 21rem) {
    .clocks { font-size: var(--step--1); }
    thead th { letter-spacing: 0; text-transform: none; overflow-wrap: anywhere; }
    th, td { padding-inline: 2px; }
    .state { white-space: normal; font-size: var(--step--1); }
    .light-icon { display: block; margin: 0 0 2px; width: 1.3rem; height: 1.3rem; }
    .digits { font-size: var(--step-0); }
    .lon { display: block; }
  }
  @media (forced-colors: active) { .swatch i { forced-color-adjust: none; } }
</style>
