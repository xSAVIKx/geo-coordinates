<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import EdgeLabels from './EdgeLabels.svelte';
  import Graticule from './Graticule.svelte';
  import Hemispheres from './Hemispheres.svelte';
  import Land from './Land.svelte';
  import Overlays from './Overlays.svelte';
  import Places from './Places.svelte';
  import PointMarker from './PointMarker.svelte';
  import SpecialLines from './SpecialLines.svelte';
  let { ctx, idPrefix }: { ctx: ViewCtx; idPrefix: string } = $props();
</script>

<Land {ctx} />
<Hemispheres {ctx} {idPrefix} />
<Graticule {ctx} />
<SpecialLines {ctx} />
<Places {ctx} />
{#if ctx.kind === 'flat'}<EdgeLabels {ctx} />{/if}
<Overlays {ctx} />
<PointMarker {ctx} />
