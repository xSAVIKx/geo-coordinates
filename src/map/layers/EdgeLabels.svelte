<script lang="ts">
  import { formatLat, formatLon } from '../../geo/format';
  import { i18n } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx }: { ctx: ViewCtx } = $props();

  const ticks = $derived.by(() => {
    const base = mapState.layers.graticuleStep;
    const c = mapState.flat.center;
    const halfLat = 90 / mapState.flat.zoom, halfLon = 180 / mapState.flat.zoom;
    // Longitude labels sit under the meridian's position at the bottom of the visible area,
    // not at the map's centre latitude — with curved meridians (Equal Earth) those differ.
    const bottomLat = Math.max(-90, Math.min(90, c.lat - halfLat));

    // Measure real projected pixel spacing rather than assuming a uniform degrees-per-pixel
    // ratio: with curved meridians (Equal Earth) longitude spacing shrinks a lot near the
    // poles, so the step that keeps labels >= 34 CSS px apart there differs from the centre.
    function pxSpacing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number | null {
      const pa = ctx.project(a), pb = ctx.project(b);
      if (!pa || !pb) return null;
      return Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / ctx.px;
    }
    let latStep = base;
    while (latStep < 90 && (pxSpacing({ lat: c.lat, lon: c.lon }, { lat: c.lat + latStep, lon: c.lon }) ?? Infinity) < 34) latStep *= 2;
    let lonStep = base;
    while (lonStep < 180 && (pxSpacing({ lat: bottomLat, lon: c.lon }, { lat: bottomLat, lon: c.lon + lonStep }) ?? Infinity) < 34) lonStep *= 2;

    const lats: number[] = [], lons: number[] = [];
    for (let v = -90; v <= 90; v += latStep) if (v >= c.lat - halfLat && v <= c.lat + halfLat) lats.push(v);
    for (let v = -180; v <= 180; v += lonStep) if (v >= c.lon - halfLon && v <= c.lon + halfLon) lons.push(v);
    return { lats, lons, bottomLat };
  });
</script>

<g class="edge" aria-hidden="true">
  {#each ticks.lats as lat (lat)}
    {@const xy = ctx.project({ lat, lon: mapState.flat.center.lon })}
    {#if xy && Math.abs(lat) < 90}<text class="halo" x={4 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={11 * ctx.px}>{formatLat(lat, i18n.lang)}</text>{/if}
  {/each}
  {#each ticks.lons as lon (lon)}
    {@const xy = ctx.project({ lat: ticks.bottomLat, lon })}
    {#if xy}
      {@const atLeftEdge = xy[0] <= 2 * ctx.px}
      {@const atRightEdge = xy[0] >= ctx.width - 2 * ctx.px}
      <text
        class="halo"
        x={atLeftEdge ? xy[0] + 4 * ctx.px : atRightEdge ? xy[0] - 4 * ctx.px : xy[0]}
        y={ctx.height - 5 * ctx.px}
        text-anchor={atLeftEdge ? 'start' : atRightEdge ? 'end' : 'middle'}
        font-size={11 * ctx.px}
      >{formatLon(lon, i18n.lang)}</text>
    {/if}
  {/each}
</g>

<style>
  .edge text { fill: var(--text); }
</style>
