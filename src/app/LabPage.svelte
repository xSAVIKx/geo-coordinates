<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import LabControls from '../map/LabControls.svelte';
  import MapStage from '../map/MapStage.svelte';
  import { mapState } from '../map/mapState.svelte';
  import { HOME } from '../map/places';

  onMount(() => {
    mapState.applyScene({ views: ['globe', 'flat'], point: HOME, pointEditable: true, layers: { specialLines: true, tropics: true, daylight: true }, sun: { utcMinutes: 720, dayOfYear: 80 }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'sun-date', 'now', 'clocks'] });
    mapState.setSunNow();
  });

  // On large screens the Sun controls and the clocks sit in a side panel next to the maps, so the whole lab
  // fits one projector screen; below that they follow the maps inside the stage.
  let wide = $state(typeof matchMedia === 'function' ? matchMedia('(min-width: 1280px)').matches : true);
  $effect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(min-width: 1280px)');
    const onChange = (e: MediaQueryListEvent) => (wide = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
</script>

<div class="head">
  <svg class="badge art" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="17" class="art-day" />
    <path d="M24 7a17 17 0 0 1 0 34z" class="art-night" />
    <circle cx="24" cy="24" r="17" class="art-rim" />
  </svg>
  <div>
    <h1 tabindex="-1">{t('mode.lab.title')}</h1>
    <p class="intro">{t('lab.intro')}</p>
  </div>
</div>

<div class="layout" class:wide>
  <div class="main">
    <MapStage showPlaces showLab={!wide} />
    <aside class="dyk" aria-labelledby="dyk-title">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /><path d="M3.5 4.5l2 2M20.5 4.5l-2 2" /></svg>
      <div>
        <h2 id="dyk-title">{t('lab.didYouKnowTitle')}</h2>
        <p>{t('lab.didYouKnow')}</p>
      </div>
    </aside>
  </div>
  {#if wide}
    <div class="panel"><LabControls /></div>
  {/if}
</div>

<style>
  .head { display: flex; gap: var(--space-4); align-items: center; margin: var(--space-1) 0 var(--space-4); }
  h1 { font-size: var(--step-3); font-weight: var(--weight-heavy); margin: 0; }
  .intro { margin: var(--space-1) 0 0; color: var(--text-muted); max-width: var(--measure); }
  .art { width: 3.25rem; height: 3.25rem; padding: 0.3rem; }
  .art-day { fill: var(--sun); }
  .art-night { fill: var(--sky-night, #1c2750); }
  .art-rim { fill: none; stroke: var(--warm-text); stroke-width: 2; }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); }
  .layout.wide { grid-template-columns: minmax(0, 1fr) clamp(26rem, 25vw, 31rem); gap: var(--space-5); align-items: start; }
  .main { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
  .panel { position: sticky; top: calc(var(--header-h) + var(--space-4)); }
  .dyk { display: flex; gap: var(--space-4); align-items: flex-start; background: var(--warm-soft); border: 1px solid color-mix(in srgb, var(--warm) 40%, transparent); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5); max-width: 62rem; }
  .dyk svg { flex: none; width: 2.25rem; height: 2.25rem; fill: none; stroke: var(--warm-text); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .dyk h2 { margin: 0 0 var(--space-1); font-size: var(--step-1); color: var(--warm-text); }
  .dyk p { margin: 0; }
  @media (max-width: 599px) { .art { display: none; } .dyk { padding: var(--space-3) var(--space-4); } }
</style>
