<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { MAP_LABELS, PLACES } from '../places';
  let { ctx }: { ctx: ViewCtx } = $props();

  const showAllNames = $derived(ctx.kind === 'flat' && mapState.flat.zoom >= 2.5);
  const places = $derived(mapState.layers.places ? PLACES.filter((p) => p.kind === 'city') : []);
</script>

{#if mapState.layers.places}
  {#each MAP_LABELS as l (l.id)}
    {@const xy = ctx.project(l)}
    {#if xy && !(ctx.kind === 'flat' && mapState.flat.zoom > 4)}
      <text class="halo map-label {l.kind}" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={(l.kind === 'ocean' ? 12 : 13) * ctx.px} lang={i18n.lang}>{t(`label.${l.id}`)}</text>
    {/if}
  {/each}
  {#each places as p (p.id)}
    {@const xy = ctx.project(p)}
    {#if xy}
      <circle class="place" cx={xy[0]} cy={xy[1]} r={3.5 * ctx.px} />
      {#if p.featured || showAllNames}
        <text class="halo place-name" x={xy[0] + 6 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={12 * ctx.px}>{t(`place.${p.id}`)}</text>
      {/if}
    {/if}
  {/each}
{/if}

<style>
  .place { fill: var(--text); stroke: var(--surface); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .place-name { fill: var(--text); }
  .map-label { fill: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; }
  .map-label.ocean { font-style: italic; text-transform: none; }
</style>
