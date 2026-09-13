<script lang="ts">
  import { geoGraticule } from 'd3-geo';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const d = $derived.by(() => {
    const s = mapState.layers.graticuleStep;
    return ctx.path(geoGraticule().step([s, s]).extent([[-180, -90], [180, 90.0001]]).precision(2)()) ?? '';
  });
</script>

<path class="grid" d={d} />

<style>
  .grid { fill: none; stroke: var(--grid); stroke-width: 0.8; stroke-opacity: 0.75; vector-effect: non-scaling-stroke; }
</style>
