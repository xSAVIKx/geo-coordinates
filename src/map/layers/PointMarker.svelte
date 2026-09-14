<script lang="ts">
  import { meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { useMapState } from '../mapStateContext';
  const mapState = useMapState();
  // `part`: 'guides' draws the dashed parallel and meridian (under place names, so they never strike
  // through one); 'handle' draws the point itself, on top of everything.
  // `skip`: guides left out along an axis (Layers.svelte: the one that would run under a chosen school's name).
  let { ctx, part = 'all', skip = { lat: false, lon: false } }: { ctx: ViewCtx; part?: 'all' | 'guides' | 'handle'; skip?: { lat: boolean; lon: boolean } } = $props();
  const p = $derived(mapState.point);
  const xy = $derived(p ? ctx.project(p) : null);
  // A highlight-line overlay on the same parallel/meridian is the lesson's focus; the dashed guide
  // (and its light casing) drawn above it would wash it out, so skip the guide along that axis.
  const highlighted = (axis: 'lat' | 'lon', value: number) =>
    mapState.overlays.some((o) => o.kind === 'highlight-line' && o.axis === axis && Math.abs(o.value - value) < 1e-6);
</script>

{#if p}
  {#if part !== 'handle' && mapState.layers.pointGuides}
    {@const lat = skip.lat || highlighted('lat', p.lat) ? '' : (ctx.path(parallelLine(p.lat)) ?? '')}
    {@const lon = skip.lon || highlighted('lon', p.lon) ? '' : (ctx.path(meridianLine(p.lon)) ?? '')}
    {#if lat}<path class="guide-casing" d={lat} />{/if}
    {#if lon}<path class="guide-casing" d={lon} />{/if}
    {#if lat}<path class="guide" d={lat} />{/if}
    {#if lon}<path class="guide" d={lon} />{/if}
  {/if}
  {#if part !== 'guides' && xy}
    <g class="point" class:editable={mapState.pointEditable} data-point-handle transform="translate({xy[0]} {xy[1]})">
      <circle class="hit" r={22 * ctx.px} />
      <circle class="halo-ring" r={9 * ctx.px} />
      <circle class="ring" r={9 * ctx.px} />
      <circle class="dot" r={3.2 * ctx.px} />
    </g>
  {/if}
{/if}

<style>
  .guide-casing { fill: none; stroke: var(--halo); stroke-width: calc(4px * var(--stroke-scale)); stroke-opacity: 0.6; vector-effect: non-scaling-stroke; pointer-events: none; }
  .guide { fill: none; stroke: var(--accent); stroke-width: calc(1.75px * var(--stroke-scale)); stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; pointer-events: none; }
  .hit { fill: transparent; }
  .halo-ring { fill: none; stroke: var(--halo); stroke-width: calc(7px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .ring { fill: var(--accent); fill-opacity: 0.22; stroke: var(--accent); stroke-width: calc(3px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .dot { fill: var(--accent); }
  .editable { cursor: grab; touch-action: none; }
  .editable .ring { animation: breathe 2.4s ease-in-out 2; transform-box: fill-box; transform-origin: center; }
  .editable:active { cursor: grabbing; }
  @keyframes breathe { 50% { fill-opacity: 0.4; } }
</style>
