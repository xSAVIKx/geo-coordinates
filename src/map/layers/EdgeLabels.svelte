<script lang="ts">
  import { formatLat, formatLon } from '../../geo/format';
  import { i18n } from '../../i18n/i18n.svelte';
  import { edgeTicks } from '../edgeTicks';
  import type { ViewCtx } from '../geometry';
  import { gridUsesMinutes, resolveGridStep } from '../gridStep';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const FONT = 11;
  const step = $derived(resolveGridStep(mapState.layers.graticuleStep, ctx));
  // Below 1° the grid is in minutes, and so are its labels (in the current language's notation).
  const precision = $derived(gridUsesMinutes(step) ? 'minute' : 'degree');
  const ticks = $derived(edgeTicks(ctx, ctx.center, ctx.zoom, step));
  // edgeTicks keeps ticks ≥ 34 px apart, which suits "40°E" but not "140° зх. д.". Thin the bottom
  // row further to every k-th tick, counted from the one nearest 0° so the prime meridian keeps its
  // label and the gaps stay regular; k comes from the widest label (≈0.62 em per character).
  const lons = $derived.by(() => {
    const items = ticks.lons.map((l) => ({ ...l, text: formatLon(l.value, i18n.lang, precision) }));
    if (items.length < 2) return items;
    const widest = Math.max(...items.map((it) => (it.text.length * 0.62 + 1) * FONT * ctx.px));
    let spacing = Infinity;
    for (let i = 1; i < items.length; i++) spacing = Math.min(spacing, Math.abs(items[i]!.x - items[i - 1]!.x));
    const k = Math.max(1, Math.ceil(widest / spacing));
    let anchor = 0;
    items.forEach((it, i) => { if (Math.abs(it.value) < Math.abs(items[anchor]!.value)) anchor = i; });
    // Labels centred on a tick within half a label of the map side would be clipped; drop those
    // (ticks exactly at a side are kept and anchored inwards below).
    const edge = 2 * ctx.px;
    const half = (t: string) => ((t.length * 0.62 + 0.4) * FONT * ctx.px) / 2 + 2 * ctx.px;
    const kept = items.filter((it, i) => {
      if ((i - anchor) % k !== 0) return false;
      if (it.x <= edge || it.x >= ctx.width - edge) return true;
      return it.x - half(it.text) >= 0 && it.x + half(it.text) <= ctx.width;
    });
    // A label anchored inwards at a side spans a whole label width; drop it if it would run into
    // its neighbour (e.g. "180°" against "160°W").
    const first = kept[0], second = kept[1];
    if (first && second && first.x <= edge && first.x + 4 * ctx.px + 2 * half(first.text) > second.x - half(second.text)) kept.shift();
    const last = kept[kept.length - 1], prev = kept[kept.length - 2];
    if (last && prev && last.x >= ctx.width - edge && last.x - 4 * ctx.px - 2 * half(last.text) < prev.x + half(prev.text)) kept.pop();
    return kept;
  });
</script>

<g class="edge" aria-hidden="true">
  {#each ticks.lats.filter((l) => l.y < ctx.height - 18 * ctx.px) as lat (lat.value)}
    <text class="halo" x={4 * ctx.px} y={lat.y + 4 * ctx.px} font-size={FONT * ctx.px}>{formatLat(lat.value, i18n.lang, precision)}</text>
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
  .edge { pointer-events: none; }
  .edge text { fill: var(--text); font-weight: 650; font-variant-numeric: tabular-nums; }
</style>
