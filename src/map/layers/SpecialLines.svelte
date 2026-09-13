<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { POLAR, TROPIC, meridianLine, parallelLine, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  interface Line { id: string; geo: GeoJSON.LineString; cls: string; labelKey: string; labelAt: { lat: number; lon: number } }
  const lines = $derived.by<Line[]>(() => {
    void i18n.lang;
    const out: Line[] = [];
    if (mapState.layers.specialLines) {
      out.push(
        { id: 'eq', geo: parallelLine(0), cls: 'equator', labelKey: 'line.equator', labelAt: { lat: 0, lon: -150 } },
        { id: 'pm', geo: meridianLine(0), cls: 'prime', labelKey: 'line.prime', labelAt: { lat: -50, lon: 0 } },
        { id: 'am', geo: meridianLine(180), cls: 'antimeridian', labelKey: 'line.antimeridian', labelAt: { lat: -50, lon: 180 } },
      );
    }
    if (mapState.layers.tropics) {
      out.push(
        { id: 'tc', geo: parallelLine(TROPIC), cls: 'tropic', labelKey: 'line.tropicCancer', labelAt: { lat: TROPIC, lon: -150 } },
        { id: 'tk', geo: parallelLine(-TROPIC), cls: 'tropic', labelKey: 'line.tropicCapricorn', labelAt: { lat: -TROPIC, lon: -150 } },
        { id: 'ac', geo: parallelLine(POLAR), cls: 'polar', labelKey: 'line.arcticCircle', labelAt: { lat: POLAR, lon: -150 } },
        { id: 'aa', geo: parallelLine(-POLAR), cls: 'polar', labelKey: 'line.antarcticCircle', labelAt: { lat: -POLAR, lon: -150 } },
      );
    }
    return out;
  });
</script>

{#each lines as line (line.id)}
  {@const d = ctx.path(line.geo) ?? ''}
  <path class="casing" {d} />
  <path class="line {line.cls}" {d} />
{/each}
{#each lines as line (line.id)}
  {@const xy = ctx.kind === 'globe'
    ? ctx.project({ lat: line.labelAt.lat, lon: line.cls === 'prime' || line.cls === 'antimeridian' ? line.labelAt.lon : -ctx.projection.rotate()[0] - 35 })
    : ctx.project(line.labelAt)}
  {#if xy}
    <!-- Vertical labels run up the meridian beside it, not across it: rotate(-90) turns the glyphs'
         height to the left of the anchor, so the prime meridian's label anchors to the right of the
         line and the 180° label (often at the flat map's right edge) sits to its left. -->
    {@const vertical = line.cls === 'prime' || line.cls === 'antimeridian'}
    {@const lx = vertical ? xy[0] + (line.cls === 'prime' ? 15 : -5) * ctx.px : xy[0] + 4 * ctx.px}
    {@const ly = xy[1] - 5 * ctx.px}
    <text class="label halo {line.cls}" x={lx} y={ly} font-size={12 * ctx.px}
      transform={vertical ? `rotate(-90 ${lx} ${ly})` : undefined}>{t(line.labelKey)}</text>
  {/if}
{/each}

<style>
  .casing { fill: none; stroke: var(--halo); stroke-width: 6; stroke-opacity: 0.55; vector-effect: non-scaling-stroke; pointer-events: none; }
  .line { fill: none; vector-effect: non-scaling-stroke; stroke-linecap: butt; }
  path.equator { stroke: var(--equator); stroke-width: 3; }
  path.prime { stroke: var(--prime); stroke-width: 3; stroke-dasharray: 12 5; }
  path.antimeridian { stroke: var(--antimeridian); stroke-width: 3; stroke-dasharray: 3 5 12 5; }
  path.tropic { stroke: var(--tropics); stroke-width: 2; stroke-dasharray: 2 4; }
  path.polar { stroke: var(--tropics); stroke-width: 2; stroke-dasharray: 8 4 2 4; }
  .label { font-weight: 750; letter-spacing: 0.01em; }
  text.equator { fill: var(--equator); } text.prime { fill: var(--prime); } text.antimeridian { fill: var(--antimeridian); }
  text.tropic, text.polar { fill: var(--tropics); }
</style>
