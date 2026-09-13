<script lang="ts">
  import { geoGraticule } from 'd3-geo';
  import type { ViewCtx } from '../geometry';
  import { gridExtent, resolveGridStep } from '../gridStep';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const step = $derived(resolveGridStep(mapState.layers.graticuleStep, ctx));
  const d = $derived.by(() => {
    // Only the visible part of the grid: a 1′ grid over the whole world would be 21 600 meridians.
    const extent = gridExtent(ctx.bounds, step);
    const span = Math.max(extent[1][0] - extent[0][0], extent[1][1] - extent[0][1]);
    return ctx.path(geoGraticule().step([step, step]).extent(extent).precision(Math.min(2, span / 60))()) ?? '';
  });
</script>

<path class="grid" d={d} />

<style>
  .grid { fill: none; stroke: var(--grid); stroke-width: 0.75; stroke-opacity: 0.5; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
