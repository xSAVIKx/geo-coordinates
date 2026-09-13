<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import FlatMap from './FlatMap.svelte';
  import Globe from './Globe.svelte';
  import { mapState } from './mapState.svelte';

  let { showPlaces = false, label }: { showPlaces?: boolean; label?: string } = $props();
  let width = $state(1024);
  const wide = $derived(width >= 640);
  const shown = $derived(wide ? mapState.views : mapState.views.filter((v) => v === mapState.phoneView));
</script>

<section class="stage" bind:clientWidth={width} aria-label={label ?? t('map.stage')}>
  {#if !wide && mapState.views.length > 1}
    <div class="switch" role="group" aria-label={t('map.chooseView')}>
      {#each mapState.views as v (v)}
        <button type="button" aria-pressed={mapState.phoneView === v} onclick={() => (mapState.phoneView = v)}>{t(`map.view.${v}`)}</button>
      {/each}
    </div>
  {/if}
  <div class="views" class:wide style:--count={shown.length}>
    {#each shown as v (v)}
      <div class="view view-{v}">
        {#if v === 'globe'}<Globe />{:else if v === 'flat'}<FlatMap />{/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .stage { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
  .switch { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; align-self: flex-start; }
  .switch button { border: 0; background: var(--surface); padding: 0 var(--space-4); font-weight: 600; }
  .switch button[aria-pressed='true'] { background: var(--accent); color: var(--accent-contrast); }
  .views { display: grid; gap: var(--space-4); grid-template-columns: 1fr; align-items: start; }
  .views.wide:has(.view-globe):has(.view-flat) { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
  .views.wide:has(.view-cross-section):not(:has(.view-flat)) { grid-template-columns: repeat(var(--count), minmax(0, 1fr)); }
</style>
