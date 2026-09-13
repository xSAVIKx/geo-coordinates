<script lang="ts">
  import type { Snippet } from 'svelte';
  import { announceThrottled } from '../app/announcer.svelte';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { spokenLat, spokenLon } from '../i18n/spoken';
  import CoordinateControls from './CoordinateControls.svelte';
  import CrossSection from './CrossSection.svelte';
  import FlatMap from './FlatMap.svelte';
  import Globe from './Globe.svelte';
  import { mapState } from './mapState.svelte';
  import PlaceList from './PlaceList.svelte';

  // `midContent`, when given, renders right after the map view(s) and before the coordinate
  // sliders / place list — used by Practice on narrow screens so the question stays visible
  // next to the map instead of being pushed below all of the map's own controls.
  let { showPlaces = false, label, midContent }: { showPlaces?: boolean; label?: string; midContent?: Snippet } = $props();
  let width = $state(1024);
  const wide = $derived(width >= 640);
  const shown = $derived(wide ? mapState.views : mapState.views.filter((v) => v === mapState.phoneView));

  let lastAnnounced: string | null = null;

  $effect(() => {
    const p = mapState.point;
    if (!p || mapState.lastChange !== 'map' || !mapState.showReadout) return;
    const spoken = `${spokenLat(p.lat, i18n.lang, mapState.precision)}, ${spokenLon(p.lon, i18n.lang, mapState.precision)}`;
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
        {#if v === 'globe'}<Globe />{:else if v === 'flat'}<FlatMap />{:else}<CrossSection />{/if}
      </div>
    {/each}
  </div>
  {#if midContent}{@render midContent()}{/if}
  {#if mapState.point}<CoordinateControls />{/if}
  {#if showPlaces && mapState.pointEditable}<PlaceList />{/if}
</section>

<style>
  .stage { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .switch { align-self: flex-start; }
  .views { display: grid; gap: var(--space-4) var(--space-5); grid-template-columns: minmax(0, 1fr); align-items: start; }
  .views.wide:has(.view-globe):has(.view-flat) { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
  .views.wide:has(.view-cross-section):not(:has(.view-flat)) { grid-template-columns: repeat(var(--count), minmax(0, 1fr)); }
</style>
