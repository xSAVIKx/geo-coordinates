<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import { bordersFor, detailFor, landFor, sphere } from '../world';
  import { useMapState } from '../mapStateContext';
  const mapState = useMapState();
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
    const path = ctx.regionPath;
    // From zoom 6: rivers, and the voivodeships as thin dashed lines (with the other borders).
    const detail = detailFor(ctx.zoom, ctx.bounds);
    return {
      rivers: detail ? detail.rivers.map((river) => ({ id: river.id, d: path(river.line) ?? '' })) : [],
      voivodeships: detail && mapState.layers.borders ? (path(detail.voivodeships) ?? '') : '',
      mask: path(r.mask) ?? '',
      land: path(r.land) ?? '',
      lakes: path(r.lakes) ?? '',
      coast: path(r.coast) ?? '',
      borders: borderLayers?.region ? (path(borderLayers.region) ?? '') : '',
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
    {#each region.rivers as river (river.id)}<path class="river" data-river={river.id} d={river.d} />{/each}
    <path class="coast" d={region.coast} />
    {#if region.voivodeships}<path class="voivodeships" d={region.voivodeships} />{/if}
    {#if region.borders}<path class="borders" d={region.borders} />{/if}
  </g>
{/if}

<style>
  .ocean { fill: var(--ocean); stroke: none; }
  .land { fill: var(--land); stroke: var(--land-stroke); stroke-width: calc(0.9px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .borders { fill: none; stroke: var(--land-stroke); stroke-width: calc(0.5px * var(--stroke-scale)); stroke-opacity: 0.55; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .region { pointer-events: none; }
  .mask { fill: var(--ocean); stroke: none; }
  /* The land is clipped to the region box; its outline there is not a coast, so only `.coast` is stroked. */
  .region-land { fill: var(--land); stroke: none; }
  .lakes { fill: var(--ocean); stroke: var(--land-stroke); stroke-width: calc(0.6px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .coast { fill: none; stroke: var(--land-stroke); stroke-width: calc(0.9px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .region .borders { stroke-width: calc(0.8px * var(--stroke-scale)); stroke-opacity: 0.7; }
  .river { fill: none; stroke: var(--river); stroke-width: calc(1.6px * var(--stroke-scale)); stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .voivodeships { fill: none; stroke: var(--land-stroke); stroke-width: calc(0.7px * var(--stroke-scale)); stroke-opacity: 0.75; stroke-dasharray: 5 3; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
