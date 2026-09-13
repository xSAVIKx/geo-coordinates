<script lang="ts">
  import { hemisphere, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import type { MarkerTone } from '../types';
  let { ctx }: { ctx: ViewCtx } = $props();

  function shape(tone: MarkerTone, r: number): string {
    switch (tone) {
      case 'a': return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
      case 'b': return `M${-r},${-r}h${2 * r}v${2 * r}h${-2 * r}z`;
      case 'c': return `M0,${-r * 1.2}L${r * 1.1},${r * 0.8}H${-r * 1.1}z`;
      case 'd': return `M0,${-r * 1.3}L${r * 1.3},0L0,${r * 1.3}L${-r * 1.3},0z`;
      case 'answer': return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0M${-r * 0.5},0l${r * 0.35},${r * 0.4}l${r * 0.65},${-r * 0.8}`;
      case 'wrong': return `M${-r},${-r}L${r},${r}M${r},${-r}L${-r},${r}`;
    }
  }
</script>

{#each mapState.overlays as o, i (i)}
  {#if o.kind === 'highlight-region'}
    <path class="hl-region" d={ctx.path(hemisphere(o.region)) ?? ''} />
  {:else if o.kind === 'highlight-line'}
    <path class="hl-line" d={ctx.path(o.axis === 'lat' ? parallelLine(o.value) : meridianLine(o.value)) ?? ''} />
  {:else if o.kind === 'marker'}
    {@const xy = o.p ? ctx.project(o.p) : null}
    {#if xy}
      <g transform="translate({xy[0]} {xy[1]})" class="marker tone-{o.tone}">
        <path d={shape(o.tone, 8 * ctx.px)} />
        {#if o.label}<text class="halo" x={12 * ctx.px} y={-10 * ctx.px} font-size={15 * ctx.px}>{o.label}</text>{/if}
      </g>
    {/if}
  {/if}
{/each}

<style>
  .hl-region { fill: var(--accent); fill-opacity: 0.18; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .hl-line { fill: none; stroke: var(--accent); stroke-width: 6; stroke-opacity: 0.85; vector-effect: non-scaling-stroke; }
  .marker path { stroke-width: 3; vector-effect: non-scaling-stroke; stroke: var(--surface); paint-order: stroke; }
  .marker text { fill: var(--text); font-weight: 700; }
  .tone-a path { fill: var(--marker-a); } .tone-b path { fill: var(--marker-b); }
  .tone-c path { fill: var(--marker-c); } .tone-d path { fill: var(--marker-d); }
  .tone-answer path { fill: none; stroke: var(--marker-answer); stroke-width: 4; }
  .tone-wrong path { fill: none; stroke: var(--marker-wrong); stroke-width: 4; }
</style>
