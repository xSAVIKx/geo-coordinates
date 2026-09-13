<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { formatNumber } from '../../i18n/text';
  import { bracketModel, labelWidth, type BracketUnit } from '../brackets';
  import { hemisphere, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { meanSunPoint } from '../../geo/sun';
  import { mapState } from '../mapState.svelte';
  import { labelPlaces, localizeLabel } from '../markerLabel';
  import type { MarkerTone } from '../types';
  let { ctx }: { ctx: ViewCtx } = $props();

  const MARKER_LABEL = 15;
  /** A marker's label text: a translated `labelKey`, or `label` in the language's notation. */
  const markerText = (o: { label?: string; labelKey?: string }): string => (o.labelKey ? t(o.labelKey) : o.label ? localizeLabel(o.label, i18n.lang) : '');
  const fmt = (value: number, unit: BracketUnit) => (unit === 'km' ? t('unit.km', { n: formatNumber(value, i18n.lang) }) : `${formatNumber(value, i18n.lang)}°`);
  // Widest marker label (CSS px), so a bracket that must sit right of the markers clears their labels.
  // Per overlay index: where its marker label goes, clear of earlier labels and of the marker symbols.
  const places = $derived(labelPlaces(mapState.overlays.map((o) => {
    if (o.kind !== 'marker' || !markerText(o)) return null;
    const xy = ctx.project(o.p);
    return xy ? { x: xy[0], y: xy[1], width: labelWidth(markerText(o), MARKER_LABEL, ctx.px) } : null;
  }), MARKER_LABEL, ctx.px, ctx.kind === 'flat' ? ctx.width : Infinity));
  const labelRoom = $derived(Math.max(16, ...mapState.overlays.map((o) => (o.kind === 'marker' && markerText(o) ? labelWidth(markerText(o), MARKER_LABEL, 1) : 0))));

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
    <path class="hl-casing" class:draw={o.animate} {d} pathLength={o.animate ? 100 : undefined} />
    <path class="hl-line" class:draw={o.animate} {d} pathLength={o.animate ? 100 : undefined} />
  {:else if o.kind === 'noon-meridian'}
    {@const date = mapState.sunDate()}
    {#if date}
      {@const lon = meanSunPoint(date).lon}
      {@const d = ctx.path(meridianLine(lon)) ?? ''}
      <path class="noon-casing" {d} />
      <path class="noon" {d} />
      {@const xy = [35, 15, 55, 0, -20].map((lat) => ctx.project({ lat, lon })).find((p) => p && p[1] > 24 * ctx.px && p[1] < ctx.height - 12 * ctx.px)}
      {#if xy}
        {@const flip = xy[0] > ctx.width - 110 * ctx.px}
        <text class="halo noon-t" x={xy[0] + (flip ? -8 : 8) * ctx.px} y={xy[1]} text-anchor={flip ? 'end' : 'start'} font-size={15 * ctx.px}>{t('lab.noon')} 12:00</text>
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
  .hl-region { fill: var(--accent); fill-opacity: 0.16; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .hl-casing { fill: none; stroke: var(--halo); stroke-width: 9; stroke-opacity: 0.6; vector-effect: non-scaling-stroke; }
  .noon-casing { fill: none; stroke: var(--halo); stroke-width: 8; stroke-opacity: 0.7; vector-effect: non-scaling-stroke; pointer-events: none; }
  .noon { fill: none; stroke: var(--noon); stroke-width: 4; stroke-dasharray: 10 6; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
  .noon-t { fill: var(--text); font-weight: 800; }
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
