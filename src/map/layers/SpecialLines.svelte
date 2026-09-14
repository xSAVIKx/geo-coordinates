<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { labelWidth } from '../brackets';
  import { POLAR, TROPIC, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { lineLabelSpecs, type LineLabelSpec } from '../lineLabels';
  import { mapState } from '../mapState.svelte';
  import { bracketBoxes, LINE_LABEL, markerLayout, placeLineLabels } from '../overlayLayout';
  import { bracketFmt, markerText } from '../overlayText';
  // `part`: 'lines' draws the lines, 'labels' their names — drawn later, above the noon meridian and the point's guides.
  let { ctx, part = 'all' }: { ctx: ViewCtx; part?: 'all' | 'lines' | 'labels' } = $props();

  interface Line extends LineLabelSpec { geo: GeoJSON.LineString }
  const GEO: Record<string, () => GeoJSON.LineString> = {
    eq: () => parallelLine(0), pm: () => meridianLine(0), am: () => meridianLine(180),
    tc: () => parallelLine(TROPIC), tk: () => parallelLine(-TROPIC), ac: () => parallelLine(POLAR), aa: () => parallelLine(-POLAR),
  };
  const lines = $derived.by<Line[]>(() => {
    void i18n.lang;
    return lineLabelSpecs(mapState.layers).map((spec) => ({ ...spec, geo: GEO[spec.id]!() }));
  });
  // Labels share their placement with Places.svelte (which keeps names clear of them): inside a flat
  // map's view, and a vertical one beside its meridian on the side that no bracket or marker label takes.
  const avoid = $derived.by(() => {
    const m = markerLayout(mapState.overlays, ctx, markerText);
    return [...bracketBoxes(mapState.overlays, ctx, bracketFmt, m.room), ...m.labels];
  });
  const labels = $derived(part === 'lines' ? [] : placeLineLabels(lines, { kind: ctx.kind, width: ctx.width, height: ctx.height, px: ctx.px, project: (p) => ctx.project(p), rotateLambda: ctx.projection.rotate()[0] }, (spec) => labelWidth(t(spec.labelKey), LINE_LABEL, ctx.px), avoid));
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
    <text class="label halo {l.spec.cls}" x={l.x} y={l.y} font-size={LINE_LABEL * ctx.px}
      transform={l.vertical ? `rotate(-90 ${l.x} ${l.y})` : undefined}>{t(l.spec.labelKey)}</text>
  {/each}
{/if}

<style>
  .casing { fill: none; stroke: var(--halo); stroke-width: calc(6px * var(--stroke-scale)); stroke-opacity: 0.55; vector-effect: non-scaling-stroke; pointer-events: none; }
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
