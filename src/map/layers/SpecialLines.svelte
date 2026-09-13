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
  <path class="line {line.cls}" d={ctx.path(line.geo) ?? ''} />
{/each}
{#each lines as line (line.id)}
  {@const xy = ctx.kind === 'globe'
    ? ctx.project({ lat: line.labelAt.lat, lon: line.cls === 'prime' || line.cls === 'antimeridian' ? line.labelAt.lon : -ctx.projection.rotate()[0] - 35 })
    : ctx.project(line.labelAt)}
  {#if xy}
    <text class="label halo {line.cls}" x={xy[0] + 4 * ctx.px} y={xy[1] - 4 * ctx.px} font-size={12 * ctx.px}
      transform={line.cls === 'prime' || line.cls === 'antimeridian' ? `rotate(-90 ${xy[0] + 4 * ctx.px} ${xy[1] - 4 * ctx.px})` : undefined}>{t(line.labelKey)}</text>
  {/if}
{/each}

<style>
  .line { fill: none; vector-effect: non-scaling-stroke; }
  .equator { stroke: var(--equator); stroke-width: 3; }
  .prime { stroke: var(--prime); stroke-width: 3; stroke-dasharray: 12 5; }
  .antimeridian { stroke: var(--antimeridian); stroke-width: 3; stroke-dasharray: 3 5 12 5; }
  .tropic { stroke: var(--tropics); stroke-width: 2; stroke-dasharray: 2 4; }
  .polar { stroke: var(--tropics); stroke-width: 2; stroke-dasharray: 8 4 2 4; }
  text.equator { fill: var(--equator); } text.prime { fill: var(--prime); } text.antimeridian { fill: var(--antimeridian); }
  text.tropic, text.polar { fill: var(--tropics); }
</style>
