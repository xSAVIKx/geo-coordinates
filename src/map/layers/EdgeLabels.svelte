<script lang="ts">
  import { formatLat, formatLon } from '../../geo/format';
  import { i18n } from '../../i18n/i18n.svelte';
  import { edgeTicks } from '../edgeTicks';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const ticks = $derived(edgeTicks(ctx, mapState.flat.center, mapState.flat.zoom, mapState.layers.graticuleStep));
</script>

<g class="edge" aria-hidden="true">
  {#each ticks.lats as lat (lat.value)}
    <text class="halo" x={4 * ctx.px} y={lat.y + 4 * ctx.px} font-size={11 * ctx.px}>{formatLat(lat.value, i18n.lang)}</text>
  {/each}
  {#each ticks.lons as lon (lon.value)}
    {@const atLeftEdge = lon.x <= 2 * ctx.px}
    {@const atRightEdge = lon.x >= ctx.width - 2 * ctx.px}
    <text
      class="halo"
      x={atLeftEdge ? lon.x + 4 * ctx.px : atRightEdge ? lon.x - 4 * ctx.px : lon.x}
      y={ctx.height - 5 * ctx.px}
      text-anchor={atLeftEdge ? 'start' : atRightEdge ? 'end' : 'middle'}
      font-size={11 * ctx.px}
    >{formatLon(lon.value, i18n.lang)}</text>
  {/each}
</g>

<style>
  .edge text { fill: var(--text); }
</style>
