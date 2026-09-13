<script lang="ts">
  import { meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const p = $derived(mapState.point);
  const xy = $derived(p ? ctx.project(p) : null);
</script>

{#if p}
  {#if mapState.layers.pointGuides}
    <path class="guide" d={ctx.path(parallelLine(p.lat)) ?? ''} />
    <path class="guide" d={ctx.path(meridianLine(p.lon)) ?? ''} />
  {/if}
  {#if xy}
    <g class="point" class:editable={mapState.pointEditable} data-point-handle transform="translate({xy[0]} {xy[1]})">
      <circle class="hit" r={22 * ctx.px} />
      <circle class="ring" r={9 * ctx.px} />
      <circle class="dot" r={3 * ctx.px} />
    </g>
  {/if}
{/if}

<style>
  .guide { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 4; vector-effect: non-scaling-stroke; }
  .hit { fill: transparent; }
  .ring { fill: var(--accent); fill-opacity: 0.25; stroke: var(--accent); stroke-width: 3; vector-effect: non-scaling-stroke; }
  .dot { fill: var(--accent); }
  .editable { cursor: grab; touch-action: none; }
  .editable:active { cursor: grabbing; }
</style>
