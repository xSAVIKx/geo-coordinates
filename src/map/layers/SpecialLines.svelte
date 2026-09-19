<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { POLAR, TROPIC, meridianLine, parallelLine, parallelStep, type ViewCtx } from '../geometry';
  import { lineLabelSpecs, type LineLabelSpec } from '../lineLabels';
  import { useMapState } from '../mapStateContext';
  import type { LabelBox } from '../labelLayout';
  import { sceneLineLabels } from '../overlayText';
  const mapState = useMapState();
  // `part`: 'lines' draws the lines, 'labels' their names — drawn later, above the noon meridian and the point's guides.
  // `lineAvoid`: school badges and the chosen school (see Layers.svelte), which the names keep clear of.
  let { ctx, part = 'all', lineAvoid = [] }: { ctx: ViewCtx; part?: 'all' | 'lines' | 'labels'; lineAvoid?: LabelBox[] } = $props();

  interface Line extends LineLabelSpec { geo: GeoJSON.LineString }
  // The parallels' vertex step depends on the view (see `parallelStep`), so it is derived, not baked into GEO.
  const step = $derived(parallelStep(ctx.zoom));
  const GEO: Record<string, (s: number) => GeoJSON.LineString> = {
    eq: (s) => parallelLine(0, s), pm: () => meridianLine(0), am: () => meridianLine(180),
    tc: (s) => parallelLine(TROPIC, s), tk: (s) => parallelLine(-TROPIC, s),
    ac: (s) => parallelLine(POLAR, s), aa: (s) => parallelLine(-POLAR, s),
  };
  const lines = $derived.by<Line[]>(() => {
    void i18n.lang;
    return lineLabelSpecs(mapState.layers).map((spec) => ({ ...spec, geo: GEO[spec.id]!(step) }));
  });
  // Labels share their placement with Places.svelte and Overlays.svelte (see `sceneLineLabels`).
  const labels = $derived.by(() => { void i18n.lang; return part === 'lines' ? [] : sceneLineLabels(ctx, mapState.layers, mapState.overlays, lineAvoid); });
</script>

{#if part !== 'labels'}
  {#each lines as line (line.id)}
    {@const d = ctx.path(line.geo) ?? ''}
    <path class="casing" {d} />
    <path class="line {line.cls}" {d} />
  {/each}
{/if}
<!-- Vertical labels run up the meridian beside it, not across it: rotate(-90) turns the glyphs' height to the left of the anchor. -->
{#if part !== 'lines'}
  {#each labels as l (l.spec.id)}
    <text class="label halo {l.spec.cls}" x={l.x} y={l.y} font-size={l.size * ctx.px}
      transform={l.vertical ? `rotate(-90 ${l.x} ${l.y})` : undefined}>{#each l.lines as line, i (i)}<tspan x={l.x} dy={i === 0 ? 0 : l.lineStep}>{line}</tspan>{/each}</text>
  {/each}
{/if}

<style>
  .casing { fill: none; stroke: var(--map-casing); stroke-width: calc(6px * var(--stroke-scale)); stroke-opacity: 0.55; vector-effect: non-scaling-stroke; pointer-events: none; }
  .line { fill: none; vector-effect: non-scaling-stroke; stroke-linecap: butt; }
  path.equator { stroke: var(--equator); stroke-width: calc(3px * var(--stroke-scale)); }
  path.prime { stroke: var(--prime); stroke-width: calc(3px * var(--stroke-scale)); stroke-dasharray: 12 5; }
  path.antimeridian { stroke: var(--antimeridian); stroke-width: calc(3px * var(--stroke-scale)); stroke-dasharray: 3 5 12 5; }
  path.tropic { stroke: var(--tropics); stroke-width: calc(2px * var(--stroke-scale)); stroke-dasharray: 2 4; }
  path.polar { stroke: var(--tropics); stroke-width: calc(2px * var(--stroke-scale)); stroke-dasharray: 8 4 2 4; }
  /* A full-strength, slightly wider halo than other map text: line names often sit on night shading or hemisphere tints. */
  .label { font-weight: 750; letter-spacing: 0.01em; stroke-width: var(--line-halo-width); stroke-opacity: 1; }
  text.equator { fill: var(--equator-text); } text.prime { fill: var(--prime-text); } text.antimeridian { fill: var(--antimeridian-text); }
  text.tropic, text.polar { fill: var(--tropics-text); }
</style>
