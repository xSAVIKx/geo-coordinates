<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import { bordersFor, landFor, sphere } from '../world';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const oceanD = $derived(ctx.path(sphere) ?? '');
  const layers = $derived(landFor(ctx.zoom, ctx.bounds));
  const borderLayers = $derived(mapState.layers.borders ? bordersFor(ctx.zoom, ctx.bounds) : null);
  const landD = $derived(ctx.path(layers.world) ?? '');
  const bordersD = $derived(borderLayers ? (ctx.path(borderLayers.world) ?? '') : '');
  // Central Europe in detail (zoom ≥ 4): a sea-coloured box covers the coarse world land there.
  const region = $derived.by(() => {
    const r = layers.region;
    if (!r) return null;
    return {
      mask: ctx.path(r.mask) ?? '',
      land: ctx.path(r.land) ?? '',
      lakes: ctx.path(r.lakes) ?? '',
      coast: ctx.path(r.coast) ?? '',
      borders: borderLayers?.region ? (ctx.path(borderLayers.region) ?? '') : '',
    };
  });
</script>

<path class="ocean" d={oceanD} />
<path class="land" d={landD} />
{#if bordersD}<path class="borders" d={bordersD} />{/if}
{#if region}
  <g class="region" data-detail="central-europe">
    <path class="mask" d={region.mask} />
    <path class="region-land" d={region.land} />
    <path class="lakes" d={region.lakes} />
    <path class="coast" d={region.coast} />
    {#if region.borders}<path class="borders" d={region.borders} />{/if}
  </g>
{/if}

<style>
  .ocean { fill: var(--ocean); stroke: none; }
  .land { fill: var(--land); stroke: var(--land-stroke); stroke-width: 0.9; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .borders { fill: none; stroke: var(--land-stroke); stroke-width: 0.5; stroke-opacity: 0.55; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .region { pointer-events: none; }
  .mask { fill: var(--ocean); stroke: none; }
  /* The land is clipped to the region box; its outline there is not a coast, so only `.coast` is stroked. */
  .region-land { fill: var(--land); stroke: none; }
  .lakes { fill: var(--ocean); stroke: var(--land-stroke); stroke-width: 0.6; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .coast { fill: none; stroke: var(--land-stroke); stroke-width: 0.9; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .region .borders { stroke-width: 0.8; stroke-opacity: 0.7; }
</style>
