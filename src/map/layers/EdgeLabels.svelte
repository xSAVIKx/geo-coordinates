<script lang="ts">
  import { formatLat, formatLon } from '../../geo/format';
  import { i18n } from '../../i18n/i18n.svelte';
  import { edgeTicks } from '../edgeTicks';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const FONT = 11;
  const ticks = $derived(edgeTicks(ctx, mapState.flat.center, mapState.flat.zoom, mapState.layers.graticuleStep));
  // edgeTicks keeps ticks ≥ 34 px apart, which suits "40°E" but not "140° зх. д.". Thin the bottom
  // row further to every k-th tick, counted from the one nearest 0° so the prime meridian keeps its
  // label and the gaps stay regular; k comes from the widest label (≈0.62 em per character).
  const lons = $derived.by(() => {
    const items = ticks.lons.map((l) => ({ ...l, text: formatLon(l.value, i18n.lang) }));
    if (items.length < 2) return items;
    const widest = Math.max(...items.map((it) => (it.text.length * 0.62 + 1) * FONT * ctx.px));
    let spacing = Infinity;
    for (let i = 1; i < items.length; i++) spacing = Math.min(spacing, Math.abs(items[i]!.x - items[i - 1]!.x));
    const k = Math.max(1, Math.ceil(widest / spacing));
    let anchor = 0;
    items.forEach((it, i) => { if (Math.abs(it.value) < Math.abs(items[anchor]!.value)) anchor = i; });
    return items.filter((_, i) => (i - anchor) % k === 0);
  });
</script>

<g class="edge" aria-hidden="true">
  {#each ticks.lats.filter((l) => l.y < ctx.height - 18 * ctx.px) as lat (lat.value)}
    <text class="halo" x={4 * ctx.px} y={lat.y + 4 * ctx.px} font-size={FONT * ctx.px}>{formatLat(lat.value, i18n.lang)}</text>
  {/each}
  {#each lons as lon (lon.value)}
    {@const atLeftEdge = lon.x <= 2 * ctx.px}
    {@const atRightEdge = lon.x >= ctx.width - 2 * ctx.px}
    <text
      class="halo"
      x={atLeftEdge ? lon.x + 4 * ctx.px : atRightEdge ? lon.x - 4 * ctx.px : lon.x}
      y={ctx.height - 5 * ctx.px}
      text-anchor={atLeftEdge ? 'start' : atRightEdge ? 'end' : 'middle'}
      font-size={FONT * ctx.px}
    >{lon.text}</text>
  {/each}
</g>

<style>
  .edge text { fill: var(--text); font-weight: 650; font-variant-numeric: tabular-nums; }
</style>
