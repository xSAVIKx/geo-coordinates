<script lang="ts">
  import { geoGraticule } from 'd3-geo';
  import { MERCATOR_MAX_LAT, type ViewCtx } from '../geometry';
  import { gridExtent, resolveGridStep } from '../gridStep';
  import { useMapState } from '../mapStateContext';
  import type { MapStyle } from '../mapStyle';
  const mapState = useMapState();
  // `style` comes from Layers.svelte, the one place that decides what this map draws: a view with no texture
  // layer under it (StaticMap, on paper) is handed 'atlas' there and must keep Atlas's grid, whatever style the
  // page is showing. Reading the shared MapState here instead would quietly ignore that.
  let { ctx, style }: { ctx: ViewCtx; style: MapStyle } = $props();
  const step = $derived(resolveGridStep(mapState.layers.graticuleStep, ctx));
  // Over relief, photos and country colours the thin grid needs a halo (spec §3); Atlas stays as it was.
  const styled = $derived(style !== 'atlas');
  const d = $derived.by(() => {
    // Only the visible part of the grid: a 1′ grid over the whole world would be 21 600 meridians.
    const extent = gridExtent(ctx.bounds, step);
    // Mercator has no latitudes past ±85° (beyond the pole d3 would make NaN): stop the lines there.
    if (ctx.flatProjection === 'mercator') { extent[0][1] = Math.max(extent[0][1], -MERCATOR_MAX_LAT); extent[1][1] = Math.min(extent[1][1], MERCATOR_MAX_LAT); }
    const span = Math.max(extent[1][0] - extent[0][0], extent[1][1] - extent[0][1]);
    return ctx.path(geoGraticule().step([step, step]).extent(extent).precision(Math.min(2, span / 60))()) ?? '';
  });
</script>

{#if styled}<path class="grid-casing" d={d} />{/if}
<path class="grid" d={d} />

<style>
  /* The casing separates a thin line from the picture under it; it is not the line. At 2.75 px under a 0.75 px
     grid it was five-sixths casing, and on a phone that reads as a dark rope, not as a hairline with a halo
     (the owner's photographs). 1.8 px leaves about half a pixel of casing showing on each side of the widest
     grid line any style draws (Political's 0.95 px) — enough to carry it over bright ice and city lights, which
     tests/e2e/map-style-readability.spec.ts measures against real pixels. The special lines keep their own 6 px
     casing at full strength (SpecialLines.svelte, base.css), so the hierarchy between them widens. */
  .grid-casing { fill: none; stroke: var(--map-casing); stroke-width: calc(1.8px * var(--stroke-scale)); stroke-opacity: 0.7; vector-effect: non-scaling-stroke; pointer-events: none; }
  /* Weight and opacity come from tokens (--grid-width / --grid-ink): Atlas's values are :root's, a style drawn
     over a picture takes the heavier pair in base.css, and dark-theme Political goes heavier still. */
  .grid { fill: none; stroke: var(--grid); stroke-width: calc(var(--grid-width) * var(--stroke-scale)); stroke-opacity: var(--grid-ink); vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
