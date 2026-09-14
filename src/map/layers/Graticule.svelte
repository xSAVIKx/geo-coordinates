<script lang="ts">
  import { geoGraticule } from 'd3-geo';
  import { MERCATOR_MAX_LAT, type ViewCtx } from '../geometry';
  import { gridExtent, resolveGridStep } from '../gridStep';
  import { useMapState } from '../mapStateContext';
  const mapState = useMapState();
  let { ctx }: { ctx: ViewCtx } = $props();
  const step = $derived(resolveGridStep(mapState.layers.graticuleStep, ctx));
  const d = $derived.by(() => {
    // Only the visible part of the grid: a 1′ grid over the whole world would be 21 600 meridians.
    const extent = gridExtent(ctx.bounds, step);
    // Mercator has no latitudes past ±85° (beyond the pole d3 would make NaN): stop the lines there.
    if (ctx.flatProjection === 'mercator') { extent[0][1] = Math.max(extent[0][1], -MERCATOR_MAX_LAT); extent[1][1] = Math.min(extent[1][1], MERCATOR_MAX_LAT); }
    const span = Math.max(extent[1][0] - extent[0][0], extent[1][1] - extent[0][1]);
    return ctx.path(geoGraticule().step([step, step]).extent(extent).precision(Math.min(2, span / 60))()) ?? '';
  });
</script>

<path class="grid" d={d} />

<style>
  .grid { fill: none; stroke: var(--grid); stroke-width: calc(0.75px * var(--stroke-scale)); stroke-opacity: 0.5; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
