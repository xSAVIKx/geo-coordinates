<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { formatNumber } from '../../i18n/text';
  import { bracketModel, labelWidth, type BracketUnit } from '../brackets';
  import { hemisphere, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { labelPlaces, localizeLabel } from '../markerLabel';
  import type { MarkerTone } from '../types';
  let { ctx }: { ctx: ViewCtx } = $props();

  const MARKER_LABEL = 15;
  const fmt = (value: number, unit: BracketUnit) => (unit === 'km' ? t('unit.km', { n: formatNumber(value, i18n.lang) }) : `${formatNumber(value, i18n.lang)}°`);
  // Widest marker label (CSS px), so a bracket that must sit right of the markers clears their labels.
  // Per overlay index: where its marker label goes, clear of earlier labels and of the marker symbols.
  const places = $derived(labelPlaces(mapState.overlays.map((o) => {
    if (o.kind !== 'marker' || !o.label) return null;
    const xy = ctx.project(o.p);
    return xy ? { x: xy[0], y: xy[1], width: labelWidth(localizeLabel(o.label, i18n.lang), MARKER_LABEL, ctx.px) } : null;
  }), MARKER_LABEL, ctx.px, ctx.kind === 'flat' ? ctx.width : Infinity));
  const labelRoom = $derived(Math.max(16, ...mapState.overlays.map((o) => (o.kind === 'marker' && o.label ? labelWidth(localizeLabel(o.label, i18n.lang), MARKER_LABEL, 1) : 0))));

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

{#each mapState.overlays as o, i (`${i}:${o.kind}`)}
  {#if o.kind === 'highlight-region'}
    <path class="hl-region" d={ctx.path(hemisphere(o.region)) ?? ''} />
  {:else if o.kind === 'highlight-line'}
    {@const d = ctx.path(o.axis === 'lat' ? parallelLine(o.value) : meridianLine(o.value)) ?? ''}
    <path class="hl-casing" {d} />
    <path class="hl-line" {d} />
  {:else if o.kind === 'marker'}
    {@const xy = ctx.project(o.p)}
    {#if xy}
      <g transform="translate({xy[0]} {xy[1]})" class="marker tone-{o.tone}">
        <path d={shape(o.tone, 8 * ctx.px)} />
        {#if o.label}<text class="halo" x={(places[i]!.endsWith('right') ? 12 : -12) * ctx.px} y={(places[i]!.startsWith('down') ? 8 + MARKER_LABEL * 0.8 : -10) * ctx.px} text-anchor={places[i]!.endsWith('right') ? 'start' : 'end'} font-size={MARKER_LABEL * ctx.px}>{localizeLabel(o.label, i18n.lang)}</text>{/if}
      </g>
    {/if}
  {:else if o.kind === 'lat-diff' || o.kind === 'lon-diff' || o.kind === 'distance'}
    {@const m = bracketModel(o, ctx, fmt, labelRoom)}
    {#if m}
      <g class="diff">
        {#each m.paths as d, j (j)}<path class="bracket-casing" {d} />{/each}
        {#each m.paths as d, j (j)}<path class="bracket" {d} />{/each}
        {#each m.splits as [cx, cy], j (j)}<circle {cx} {cy} r={5 * ctx.px} class="split" />{/each}
        {#each m.labels as l, j (j)}<text class="halo {l.role}" x={l.x} y={l.y} text-anchor={l.anchor} font-size={l.size * ctx.px}>{l.text}</text>{/each}
      </g>
    {/if}
  {/if}
{/each}

<style>
  .hl-region { fill: var(--accent); fill-opacity: 0.16; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .hl-casing { fill: none; stroke: var(--halo); stroke-width: 9; stroke-opacity: 0.6; vector-effect: non-scaling-stroke; }
  .hl-line { fill: none; stroke: var(--accent); stroke-width: 5; stroke-opacity: 0.9; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .marker path { stroke-width: 3; vector-effect: non-scaling-stroke; stroke: var(--halo); paint-order: stroke; stroke-linejoin: round; }
  .marker text { fill: var(--text); font-weight: 750; }
  .tone-a path { fill: var(--marker-a); } .tone-b path { fill: var(--marker-b); }
  .tone-c path { fill: var(--marker-c); } .tone-d path { fill: var(--marker-d); }
  .tone-answer path { fill: color-mix(in srgb, var(--marker-answer) 18%, transparent); stroke: var(--marker-answer); stroke-width: 4; stroke-linecap: round; }
  .diff { pointer-events: none; }
  .bracket-casing { fill: none; stroke: var(--halo); stroke-width: 8; stroke-opacity: 0.75; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .bracket { fill: none; stroke: var(--marker-c); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .split { fill: var(--surface); stroke: var(--marker-c); stroke-width: 3; vector-effect: non-scaling-stroke; }
  .diff .total { fill: var(--marker-c); font-weight: 800; }
  .diff .part, .diff .sub { fill: var(--text); font-weight: 700; }
  .tone-wrong path { fill: none; stroke: var(--marker-wrong); stroke-width: 4; stroke-linecap: round; }
</style>
