<script lang="ts">
  import type { Snippet } from 'svelte';
  import { announceThrottled } from '../app/announcer.svelte';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { spokenAxis } from '../i18n/spoken';
  import CoordinateControls from './CoordinateControls.svelte';
  import CrossSection from './CrossSection.svelte';
  import FlatMap from './FlatMap.svelte';
  import Globe from './Globe.svelte';
  import LabControls from './LabControls.svelte';
  import { isTextureStyle } from './mapStyle';
  import { mapState } from './mapState.svelte';
  import MapStyleNote from './MapStyleNote.svelte';
  import OrbitView from './OrbitView.svelte';
  import PlaceList from './PlaceList.svelte';
  import SchoolList from './SchoolList.svelte';
  import { renderHealth } from './texture/health.svelte';

  // `midContent`, when given, renders right after the map view(s) and before the coordinate
  // sliders / place list — used by Practice on narrow screens so the question stays visible
  // next to the map instead of being pushed below all of the map's own controls.
  // `showLab = false` leaves the day/night controls to the page (the lab page puts them in a side panel on wide screens).
  let { showPlaces = false, label, midContent, showLab = true }: { showPlaces?: boolean; label?: string; midContent?: Snippet; showLab?: boolean } = $props();
  let width = $state(1024);
  const wide = $derived(width >= 640);
  const shown = $derived(wide ? mapState.views : mapState.views.filter((v) => v === mapState.phoneView));

  let lastAnnounced: string | null = null;

  $effect(() => {
    const p = mapState.point;
    if (!p || mapState.lastChange !== 'map' || !mapState.showReadout) return;
    // Said the way the readout shows the point: letters, or decimal degrees with their degrees and minutes (seconds).
    const sep = mapState.readout === 'letters' ? ', ' : '; ';
    const spoken = `${spokenAxis(p.lat, 'lat', i18n.lang, mapState.precision, mapState.readout)}${sep}${spokenAxis(p.lon, 'lon', i18n.lang, mapState.precision, mapState.readout)}`;
    if (spoken === lastAnnounced) return;
    lastAnnounced = spoken;
    announceThrottled('point', spoken, 700);
  });
</script>

<section class="stage" bind:clientWidth={width} aria-label={label ?? t('map.stage')}>
  {#if !wide && mapState.views.length > 1}
    <div class="switch seg" role="group" aria-label={t('map.chooseView')}>
      {#each mapState.views as v (v)}
        <button type="button" class="btn" aria-pressed={mapState.phoneView === v} onclick={() => (mapState.phoneView = v)}>{t(`map.view.${v}`)}</button>
      {/each}
    </div>
  {/if}
  <div class="views" class:wide style:--count={shown.length}>
    {#each shown as v (v)}
      <div class="view view-{v}">
        {#if v === 'globe'}<Globe />{:else if v === 'flat'}<FlatMap />{:else if v === 'orbit'}<OrbitView />{:else}<CrossSection />{/if}
      </div>
    {/each}
  </div>
  <p class="map-status" role="status">{renderHealth.loading && isTextureStyle(mapState.mapStyle) ? t('map.style.loading') : ''}</p>
  <p class="map-source">{mapState.drawnMapStyle !== 'atlas' ? t(`map.style.source.${mapState.drawnMapStyle}`) : ''}</p>
  <MapStyleNote />
  {#if midContent}{@render midContent()}{/if}
  {#if mapState.point}<CoordinateControls />{/if}
  {#if showLab && mapState.labControls.length}<LabControls />{/if}
  {#if showPlaces && mapState.pointEditable}<PlaceList />{/if}
  {#if mapState.schoolsToggle && mapState.layers.schools}<SchoolList />{/if}
</section>

<style>
  .stage { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .switch { align-self: flex-start; }
  .views { display: grid; gap: var(--space-4) var(--space-5); grid-template-columns: minmax(0, 1fr); align-items: start; }
  .views.wide:has(.view-globe):has(.view-flat) { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
  .views.wide:has(.view-cross-section):not(:has(.view-flat)) { grid-template-columns: repeat(var(--count), minmax(0, 1fr)); }
  /* The orbit takes its own row above globe and map; with the globe alone they share a row. */
  .views.wide:has(.view-orbit):has(.view-flat) .view-orbit { grid-column: 1 / -1; justify-self: center; width: min(100%, 44rem); }
  .views.wide:has(.view-orbit):has(.view-globe):not(:has(.view-flat)) { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
  .map-status { margin: 0; color: var(--text-muted); font-size: var(--step--1); }
  .map-source { margin: 0; color: var(--text-muted); font-size: var(--step--1); }
  .map-source:empty { display: none; }
  /*
   * The live region has to be in the accessibility tree before it has anything to say: `display: none` would take it
   * out of the tree, and a live region that appears only once it is populated reads as a brand-new region, which most
   * screen readers do not announce. So the empty note is taken out of the *flow* instead (the same treatment as
   * .visually-hidden in src/styles/base.css) — it keeps its place in the tree, and an out-of-flow box is not a flex
   * item, so it adds no gap to the stage either.
   */
  .map-status:empty { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
