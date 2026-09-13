<script lang="ts">
  import { meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();
  const p = $derived(mapState.point);
  const xy = $derived(p ? ctx.project(p) : null);
</script>

{#if p}
  {#if mapState.layers.pointGuides}
    {@const lat = ctx.path(parallelLine(p.lat)) ?? ''}
    {@const lon = ctx.path(meridianLine(p.lon)) ?? ''}
    <path class="guide-casing" d={lat} />
    <path class="guide-casing" d={lon} />
    <path class="guide" d={lat} />
    <path class="guide" d={lon} />
  {/if}
  {#if xy}
    <g class="point" class:editable={mapState.pointEditable} data-point-handle transform="translate({xy[0]} {xy[1]})">
      <circle class="hit" r={22 * ctx.px} />
      <circle class="halo-ring" r={9 * ctx.px} />
      <circle class="ring" r={9 * ctx.px} />
      <circle class="dot" r={3.2 * ctx.px} />
    </g>
  {/if}
{/if}

<style>
  .guide-casing { fill: none; stroke: var(--halo); stroke-width: 4; stroke-opacity: 0.6; vector-effect: non-scaling-stroke; pointer-events: none; }
  .guide { fill: none; stroke: var(--accent); stroke-width: 1.75; stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; pointer-events: none; }
  .hit { fill: transparent; }
  .halo-ring { fill: none; stroke: var(--halo); stroke-width: 7; vector-effect: non-scaling-stroke; }
  .ring { fill: var(--accent); fill-opacity: 0.22; stroke: var(--accent); stroke-width: 3; vector-effect: non-scaling-stroke; }
  .dot { fill: var(--accent); }
  .editable { cursor: grab; touch-action: none; }
  .editable .ring { animation: breathe 2.4s ease-in-out 2; transform-box: fill-box; transform-origin: center; }
  .editable:active { cursor: grabbing; }
  @keyframes breathe { 50% { fill-opacity: 0.4; } }
</style>
