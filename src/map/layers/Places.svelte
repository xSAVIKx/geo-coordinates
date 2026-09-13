<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { MAP_LABELS, PLACES } from '../places';
  let { ctx }: { ctx: ViewCtx } = $props();

  const showAllNames = $derived(ctx.kind === 'flat' && mapState.flat.zoom >= 2.5);
  const places = $derived(mapState.layers.places ? PLACES.filter((p) => p.kind === 'city') : []);
  // Label density follows how big the whole world is actually drawn, in CSS px (a small phone map
  // cannot carry the same labels as a projected one). The globe shows half the world at once.
  const worldPx = $derived(ctx.kind === 'flat' ? (ctx.width / ctx.px) * mapState.flat.zoom : (2 * ctx.width / ctx.px) * mapState.globeZoom);
  const roomy = $derived(worldPx >= 560);
</script>

{#if mapState.layers.places}
  {#if roomy}
    {#each MAP_LABELS as l (l.id)}
      {@const xy = ctx.project(l)}
      {#if xy && !(ctx.kind === 'flat' && mapState.flat.zoom > 4)}
        <text class="halo map-label {l.kind}" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={(l.kind === 'ocean' ? 12 : 11.5) * ctx.px} lang={i18n.lang}>{t(`label.${l.id}`)}</text>
      {/if}
    {/each}
  {/if}
  {#each places as p (p.id)}
    {@const xy = ctx.project(p)}
    {@const named = p.featured || showAllNames}
    {#if xy}
      <circle class="place" class:minor={!named} cx={xy[0]} cy={xy[1]} r={(named ? 3.2 : 2.2) * ctx.px} />
      {#if named}
        <text class="halo place-name" x={xy[0] + 6 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={(roomy ? 12 : 10.5) * ctx.px}>{t(`place.${p.id}`)}</text>
      {/if}
    {/if}
  {/each}
{/if}

<style>
  .place { fill: var(--text); stroke: var(--halo); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .place.minor { fill: var(--map-label); fill-opacity: 0.55; stroke-width: 1; }
  .place-name { fill: var(--text); }
  .map-label { fill: var(--map-label); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .map-label.ocean { fill: var(--ocean-label); font-style: italic; font-weight: 500; letter-spacing: 0.04em; text-transform: none; }
</style>
