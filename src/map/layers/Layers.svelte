<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import { sphere } from '../world';
  import EdgeLabels from './EdgeLabels.svelte';
  import Graticule from './Graticule.svelte';
  import Hemispheres from './Hemispheres.svelte';
  import Land from './Land.svelte';
  import Overlays from './Overlays.svelte';
  import Places from './Places.svelte';
  import PointMarker from './PointMarker.svelte';
  import SpecialLines from './SpecialLines.svelte';
  let { ctx, idPrefix }: { ctx: ViewCtx; idPrefix: string } = $props();
  const sphereD = $derived(ctx.kind === 'globe' ? (ctx.path(sphere) ?? '') : '');
</script>

<Land {ctx} />
{#if ctx.kind === 'globe'}
  <!-- Decorative sphere shading: a soft highlight up-left and a darker limb, so the disc reads as a ball. -->
  <defs>
    <radialGradient id="{idPrefix}-shade" cx="0.38" cy="0.32" r="0.72">
      <stop offset="0" stop-color="var(--ocean-light)" stop-opacity="0.34" />
      <stop offset="0.55" stop-color="var(--ocean-light)" stop-opacity="0" />
      <stop offset="0.86" stop-color="var(--ocean-deep)" stop-opacity="0.12" />
      <stop offset="1" stop-color="var(--ocean-deep)" stop-opacity="0.42" />
    </radialGradient>
  </defs>
  <path class="shade" d={sphereD} fill="url(#{idPrefix}-shade)" />
{/if}
<Hemispheres {ctx} {idPrefix} />
<Graticule {ctx} />
<SpecialLines {ctx} />
<Places {ctx} />
{#if ctx.kind === 'flat'}<EdgeLabels {ctx} />{/if}
<Overlays {ctx} />
<PointMarker {ctx} />
{#if ctx.kind === 'globe'}<path class="rim" d={sphereD} />{/if}

<style>
  .shade { pointer-events: none; }
  .rim { fill: none; stroke: var(--grid); stroke-width: 1.5; stroke-opacity: 0.9; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
