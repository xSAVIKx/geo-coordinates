<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import { borders, land, sphere } from '../world';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const oceanD = $derived(ctx.path(sphere) ?? '');
  const landD = $derived(ctx.path(land) ?? '');
  const bordersD = $derived(mapState.layers.borders ? (ctx.path(borders) ?? '') : '');
</script>

<path class="ocean" d={oceanD} />
<path class="land" d={landD} />
{#if bordersD}<path class="borders" d={bordersD} />{/if}

<style>
  .ocean { fill: var(--ocean); stroke: none; }
  .land { fill: var(--land); stroke: var(--land-stroke); stroke-width: 0.9; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .borders { fill: none; stroke: var(--land-stroke); stroke-width: 0.5; stroke-opacity: 0.55; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
