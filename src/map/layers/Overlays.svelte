<script lang="ts">
  import { bracketModel, labelWidth } from '../brackets';
  import { hemisphere, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { sunPoint } from '../../geo/sun';
  import type { LabelBox } from '../labelLayout';
  import { useMapState } from '../mapStateContext';
  import { bracketBoxes, markerLayout, noonLabel, NOON_LABEL } from '../overlayLayout';
  import { bracketFmt as fmt, markerText, noonText, sceneLineLabels } from '../overlayText';
  import type { MarkerTone } from '../types';
  const mapState = useMapState();
  // `part`: 'lines' draws only the noon meridian's line (under place names, so it never strikes through
  // one); 'marks' draws everything else (markers, brackets, highlights and the noon label) above them.
  let { ctx, part = 'all', lineAvoid = [] }: { ctx: ViewCtx; part?: 'all' | 'lines' | 'marks'; lineAvoid?: LabelBox[] } = $props();
  const lines = $derived(part !== 'marks');
  const marks = $derived(part !== 'lines');

  // Per overlay index: where its marker label goes, clear of earlier labels and of the marker symbols.
  const markers = $derived(markerLayout(mapState.overlays, ctx, markerText));
  const MARKER_LABEL = $derived(markers.size);
  const places = $derived(markers.places);
  // Widest marker label (CSS px), so a bracket that must sit right of the markers clears their labels.
  const labelRoom = $derived(markers.room);
  // "Noon 12:00" keeps clear of the markers, their labels and the brackets.
  const noon = $derived.by(() => {
    if (!marks || !mapState.overlays.some((o) => o.kind === 'noon-meridian')) return null;
    const date = mapState.sunDate();
    if (!date) return null;
    const brackets = bracketBoxes(mapState.overlays, ctx, fmt, labelRoom);
    const lineLabels = sceneLineLabels(ctx, mapState.layers, mapState.overlays, lineAvoid).map((l) => l.box);
    const obstacles = [...markers.symbols, ...markers.labels, ...brackets, ...lineLabels, ...lineAvoid];
    return noonLabel(ctx, sunPoint(date, mapState.realSun).lon, labelWidth(noonText(), NOON_LABEL, ctx.px), obstacles);
  });

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
  {#if o.kind !== 'noon-meridian' && !marks}
    <!-- drawn by the 'marks' pass -->
  {:else if o.kind === 'highlight-region'}
    <path class="hl-region" d={ctx.path(hemisphere(o.region)) ?? ''} />
  {:else if o.kind === 'highlight-line'}
    {@const d = ctx.path(o.axis === 'lat' ? parallelLine(o.value) : meridianLine(o.value)) ?? ''}
    <path class="hl-casing" class:draw={o.animate} {d} pathLength={o.animate ? 100 : undefined} />
    <path class="hl-line" class:draw={o.animate} {d} pathLength={o.animate ? 100 : undefined} />
  {:else if o.kind === 'noon-meridian'}
    {@const date = mapState.sunDate()}
    {#if date}
      {#if lines}
        {@const d = ctx.path(meridianLine(sunPoint(date, mapState.realSun).lon)) ?? ''}
        <path class="noon-casing" {d} />
        <path class="noon" {d} />
      {/if}
      {#if noon}
        <text class="halo noon-t" x={noon.x} y={noon.y} text-anchor={noon.anchor} font-size={NOON_LABEL * ctx.px}>{noonText()}</text>
      {/if}
    {/if}
  {:else if o.kind === 'marker'}
    {@const xy = ctx.project(o.p)}
    {#if xy}
      <g transform="translate({xy[0]} {xy[1]})" class="marker tone-{o.tone}">
        <g class:reveal={o.animate}>
          <path d={shape(o.tone, 8 * ctx.px)} />
          {#if markerText(o)}<text class="halo" x={(places[i]!.endsWith('right') ? 12 : -12) * ctx.px} y={(places[i]!.startsWith('down') ? 8 + MARKER_LABEL * 0.8 : -10) * ctx.px} text-anchor={places[i]!.endsWith('right') ? 'start' : 'end'} font-size={MARKER_LABEL * ctx.px}>{markerText(o)}</text>{/if}
        </g>
      </g>
    {/if}
  {:else if o.kind === 'lat-diff' || o.kind === 'lon-diff' || o.kind === 'distance'}
    {@const m = bracketModel(o, ctx, fmt, labelRoom)}
    {#if m}
      <g class="diff" class:reveal={o.animate}>
        {#each m.paths as d, j (j)}<path class="bracket-casing" class:draw={o.animate} {d} pathLength={o.animate ? 100 : undefined} />{/each}
        {#each m.paths as d, j (j)}<path class="bracket" class:draw={o.animate} {d} pathLength={o.animate ? 100 : undefined} />{/each}
        {#each m.splits as [cx, cy], j (j)}<circle {cx} {cy} r={5 * ctx.px} class="split" />{/each}
        {#each m.labels as l, j (j)}<text class="halo {l.role}" x={l.x} y={l.y} text-anchor={l.anchor} font-size={l.size * ctx.px}>{l.text}</text>{/each}
      </g>
    {/if}
  {/if}
{/each}

<style>
  .hl-region { fill: var(--accent); fill-opacity: 0.16; stroke: var(--accent); stroke-width: calc(2px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .hl-casing { fill: none; stroke: var(--map-casing); stroke-width: calc(9px * var(--stroke-scale)); stroke-opacity: 0.6; vector-effect: non-scaling-stroke; }
  .noon-casing { fill: none; stroke: var(--map-casing); stroke-width: calc(8px * var(--stroke-scale)); stroke-opacity: 0.7; vector-effect: non-scaling-stroke; pointer-events: none; }
  .noon { fill: none; stroke: var(--noon); stroke-width: calc(4px * var(--stroke-scale)); stroke-dasharray: 10 6; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
  .noon-t { fill: var(--text); font-weight: 800; }
  .hl-line { fill: none; stroke: var(--accent); stroke-width: calc(5px * var(--stroke-scale)); stroke-opacity: 0.9; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .marker path { stroke-width: calc(3px * var(--stroke-scale)); vector-effect: non-scaling-stroke; stroke: var(--map-casing); paint-order: stroke; stroke-linejoin: round; }
  .marker text { fill: var(--text); font-weight: 750; }
  .tone-a path { fill: var(--marker-a); } .tone-b path { fill: var(--marker-b); }
  .tone-c path { fill: var(--marker-c); } .tone-d path { fill: var(--marker-d); }
  .tone-answer path { fill: color-mix(in srgb, var(--marker-answer) 18%, transparent); stroke: var(--marker-answer); stroke-width: calc(4px * var(--stroke-scale)); stroke-linecap: round; }
  .diff { pointer-events: none; }
  .bracket-casing { fill: none; stroke: var(--map-casing); stroke-width: calc(8px * var(--stroke-scale)); stroke-opacity: 0.75; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .bracket { fill: none; stroke: var(--marker-c); stroke-width: calc(4px * var(--stroke-scale)); stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .split { fill: var(--surface); stroke: var(--marker-c); stroke-width: calc(3px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .diff .total { fill: var(--marker-c); font-weight: 800; }
  .diff .part, .diff .sub { fill: var(--text); font-weight: 700; }
  .tone-wrong path { fill: none; stroke: var(--marker-wrong); stroke-width: calc(4px * var(--stroke-scale)); stroke-linecap: round; }

  /* Reveal animation for overlays added with `addOverlays(o, { animate: true })` (a class-quiz
     reveal or a Practice solution): markers scale/fade in, lines and brackets draw in via
     stroke-dashoffset. `MapState.addOverlays` never sets `animate` when reduced motion is on, so
     these classes are simply absent then — nothing here needs its own reduced-motion check. */
  .marker .reveal { transform-origin: 0 0; animation: marker-in 500ms var(--ease) both; }
  @keyframes marker-in { from { opacity: 0; transform: scale(0.35); } to { opacity: 1; transform: none; } }
  path.draw { stroke-dasharray: 100; animation: line-draw 500ms var(--ease) both; }
  @keyframes line-draw { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
  .diff.reveal .split, .diff.reveal text { animation: fade-in 500ms var(--ease) both; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
</style>
