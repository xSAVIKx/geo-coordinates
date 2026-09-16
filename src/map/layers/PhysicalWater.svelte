<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import type { ViewCtx } from '../geometry';
  import { physicalWaterFor } from '../physical';
  import { detailFor, landFor } from '../world';
  let { ctx }: { ctx: ViewCtx } = $props();
  const water = $derived.by(() => {
    if (testFlag('vector') === 'fail') throw new Error('physical water layer failure forced for a test');
    return physicalWaterFor(ctx.zoom, ctx.bounds);
  });
  const lakesD = $derived(ctx.path(water.lakes) ?? '');
  const riversD = $derived(ctx.path(water.rivers) ?? '');
  // Central Europe: the detailed lakes from zoom 4, the detailed rivers from zoom 6 (world.ts level of detail).
  const regionLakesD = $derived.by(() => { const r = landFor(ctx.zoom, ctx.bounds).region; return r ? (ctx.regionPath(r.lakes) ?? '') : ''; });
  const regionRivers = $derived((detailFor(ctx.zoom, ctx.bounds)?.rivers ?? []).map((r) => ({ id: r.id, d: ctx.regionPath(r.line) ?? '' })));
</script>

<!-- Decorative: the rivers and lakes the relief already shows; the names that matter are text (Places.svelte). -->
<g class="physical-water" aria-hidden="true">
  <path class="lake" d={lakesD} />
  {#if regionLakesD}<path class="lake" d={regionLakesD} />{/if}
  <path class="river" d={riversD} />
  {#each regionRivers as r (r.id)}<path class="river" data-river={r.id} d={r.d} />{/each}
</g>

<style>
  .physical-water { pointer-events: none; }
  .lake { fill: var(--physical-water); stroke: var(--physical-water-edge); stroke-width: calc(0.6px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .river { fill: none; stroke: var(--physical-water-edge); stroke-width: calc(1.2px * var(--stroke-scale)); stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
