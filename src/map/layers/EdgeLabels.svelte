<script lang="ts">
  import { formatLat, formatLon } from '../../geo/format';
  import { i18n } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const ticks = $derived.by(() => {
    const base = mapState.layers.graticuleStep;
    const degPerPx = (360 / (ctx.width * mapState.flat.zoom)) * ctx.px;
    let step = base;
    while (step / degPerPx < 34) step *= 2; // keep labels at least 34 CSS px apart
    const c = mapState.flat.center;
    const halfLat = 90 / mapState.flat.zoom, halfLon = 180 / mapState.flat.zoom;
    const lats: number[] = [], lons: number[] = [];
    for (let v = -90; v <= 90; v += step) if (v >= c.lat - halfLat && v <= c.lat + halfLat) lats.push(v);
    for (let v = -180; v <= 180; v += step) if (v >= c.lon - halfLon && v <= c.lon + halfLon) lons.push(v);
    return { lats, lons };
  });
</script>

<g class="edge" aria-hidden="true">
  {#each ticks.lats as lat (lat)}
    {@const xy = ctx.project({ lat, lon: mapState.flat.center.lon })}
    {#if xy && Math.abs(lat) < 90}<text class="halo" x={4 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={11 * ctx.px}>{formatLat(lat, i18n.lang)}</text>{/if}
  {/each}
  {#each ticks.lons as lon (lon)}
    {@const xy = ctx.project({ lat: mapState.flat.center.lat, lon })}
    {#if xy}<text class="halo" x={xy[0]} y={ctx.height - 5 * ctx.px} text-anchor="middle" font-size={11 * ctx.px}>{formatLon(lon, i18n.lang)}</text>{/if}
  {/each}
</g>

<style>
  .edge text { fill: var(--text); }
</style>
