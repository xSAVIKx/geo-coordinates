<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import type { ViewCtx } from '../geometry';
  import { eyeVector, globeLevel, politicalFor } from '../political';
  let { ctx }: { ctx: ViewCtx } = $props();
  // On a globe the view's own box reaches right round the world, so the countries on the far side are culled by
  // where the viewer is standing instead (political.ts): d3 would otherwise project all 210 of them every frame
  // and clip half of them away afterwards.
  const eye = $derived(ctx.kind === 'globe' ? eyeVector(ctx.center.lon, ctx.center.lat) : null);
  const layers = $derived.by(() => {
    if (testFlag('vector') === 'fail') throw new Error('political layer failure forced for a test');
    return politicalFor(ctx.kind === 'globe' ? globeLevel(ctx.zoom, ctx.width / ctx.px) : ctx.zoom, ctx.bounds, eye);
  });
  const fills = $derived(layers.fills.map((f) => ({ id: f.id, colour: f.colour, d: ctx.path(f.geometry) ?? '' })).filter((f) => f.d));
  const coastD = $derived(ctx.path(layers.coast) ?? '');
  const bordersD = $derived(ctx.path(layers.borders) ?? '');
</script>

<!-- Decorative: which country a shape is is told by its name (Places.svelte), never by its colour alone. -->
<g class="political" aria-hidden="true">
  {#each fills as f (f.id)}<path class="country c{f.colour}" data-country={f.id} d={f.d} />{/each}
  <path class="coast" d={coastD} />
  <path class="borders" d={bordersD} />
</g>

<style>
  .political { pointer-events: none; }
  .country { stroke: none; }
  .c0 { fill: var(--pol-0); } .c1 { fill: var(--pol-1); } .c2 { fill: var(--pol-2); } .c3 { fill: var(--pol-3); } .c4 { fill: var(--pol-4); } .c5 { fill: var(--pol-5); }
  .coast { fill: none; stroke: var(--pol-coast); stroke-width: calc(0.9px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .borders { fill: none; stroke: var(--pol-border); stroke-width: calc(1.1px * var(--stroke-scale)); stroke-linejoin: round; vector-effect: non-scaling-stroke; }
</style>
