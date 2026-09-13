<script lang="ts">
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { labelWidth } from '../brackets';
  import type { ViewCtx } from '../geometry';
  import { type LabelBox, selectVisibleLabels, textBox } from '../labelLayout';
  import { lineLabelPoint, lineLabelSpecs } from '../lineLabels';
  import { mapState } from '../mapState.svelte';
  import { MAP_LABELS, PLACES, type Place } from '../places';
  let { ctx }: { ctx: ViewCtx } = $props();

  const showAllNames = $derived(ctx.kind === 'flat' && mapState.flat.zoom >= 2.5);
  const places = $derived(mapState.layers.places ? PLACES.filter((p) => p.kind === 'city') : []);
  // Label density follows how big the whole world is actually drawn, in CSS px (a small phone map
  // cannot carry the same labels as a projected one). The globe shows half the world at once.
  const worldPx = $derived(ctx.kind === 'flat' ? (ctx.width / ctx.px) * mapState.flat.zoom : (2 * ctx.width / ctx.px) * mapState.globeZoom);
  const roomy = $derived(worldPx >= 560);
  const showContinents = $derived(roomy && !(ctx.kind === 'flat' && mapState.flat.zoom > 4));

  // Special-line labels (equator, tropics…) are drawn by a sibling layer, but their exact
  // position is shared via lineLabels.ts so they can act as fixed obstacles here: a place name
  // never covers one. Vertical (rotated) labels — prime meridian, antimeridian — are left out of
  // the obstacle set; they sit far south of the crowded areas and a precise rotated box isn't
  // worth the complexity.
  const lineObstacles = $derived.by<LabelBox[]>(() => {
    const out: LabelBox[] = [];
    for (const spec of lineLabelSpecs(mapState.layers)) {
      if (spec.vertical) continue;
      const xy = ctx.project(lineLabelPoint(spec, ctx.kind, ctx.projection.rotate()[0]));
      if (!xy) continue;
      const size = 12 * ctx.px;
      out.push(textBox(xy[0] + 4 * ctx.px, xy[1] - 5 * ctx.px, labelWidth(t(spec.labelKey), 12, ctx.px), size, 'start'));
    }
    return out;
  });
  const continentObstacles = $derived.by<LabelBox[]>(() => {
    if (!showContinents) return [];
    const out: LabelBox[] = [];
    for (const l of MAP_LABELS) {
      const xy = ctx.project(l);
      if (!xy) continue;
      const size = (l.kind === 'ocean' ? 12 : 11.5) * ctx.px;
      out.push(textBox(xy[0], xy[1], labelWidth(t(`label.${l.id}`), l.kind === 'ocean' ? 12 : 11.5, ctx.px), size, 'middle'));
    }
    return out;
  });

  // Every named place (dot always stays visible; only the text label is at risk), with the box
  // it would occupy and how far it sits from what the view is currently centred on.
  interface Candidate { place: Place; xy: [number, number]; box: LabelBox; rank: number }
  const centre = $derived(ctx.kind === 'flat' ? mapState.flat.center : { lat: -mapState.rotate[1], lon: -mapState.rotate[0] });
  const candidates = $derived.by<Candidate[]>(() => {
    const size = roomy ? 12 : 10.5;
    return places.flatMap((p): Candidate[] => {
      if (!(p.featured || showAllNames)) return [];
      const xy = ctx.project(p);
      if (!xy) return [];
      const box = textBox(xy[0] + 6 * ctx.px, xy[1] + 4 * ctx.px, labelWidth(t(`place.${p.id}`), size, ctx.px), size * ctx.px, 'start');
      const dLat = p.lat - centre.lat, dLon = ((p.lon - centre.lon + 540) % 360) - 180;
      const distance = Math.hypot(dLat, dLon);
      return [{ place: p, xy, box, rank: (p.featured ? 0 : 1e6) + distance }];
    });
  });
  // Non-featured labels are dropped before featured ones (rank offsets them by 1e6), and within
  // the same tier the ones farther from the view centre go first — a crowded map keeps the names
  // most relevant to what's currently on screen.
  const visibleIds = $derived.by<Set<string>>(() => {
    const visible = selectVisibleLabels(candidates, (c) => c.box, (c) => c.rank, [...lineObstacles, ...continentObstacles]);
    const ids = new Set<string>();
    candidates.forEach((c, i) => { if (visible[i]) ids.add(c.place.id); });
    return ids;
  });
</script>

{#if mapState.layers.places}
  {#if showContinents}
    {#each MAP_LABELS as l (l.id)}
      {@const xy = ctx.project(l)}
      {#if xy}
        <text class="halo map-label {l.kind}" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={(l.kind === 'ocean' ? 12 : 11.5) * ctx.px} lang={i18n.lang}>{t(`label.${l.id}`)}</text>
      {/if}
    {/each}
  {/if}
  {#each places as p (p.id)}
    {@const xy = ctx.project(p)}
    {@const named = p.featured || showAllNames}
    {#if xy}
      <circle class="place" class:minor={!named} cx={xy[0]} cy={xy[1]} r={(named ? 3.2 : 2.2) * ctx.px} />
      {#if named && visibleIds.has(p.id)}
        <text class="halo place-name" x={xy[0] + 6 * ctx.px} y={xy[1] + 4 * ctx.px} font-size={(roomy ? 12 : 10.5) * ctx.px}>{t(`place.${p.id}`)}</text>
      {/if}
    {/if}
  {/each}
{/if}

<style>
  .place { fill: var(--text); stroke: var(--halo); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .place.minor { fill: var(--map-label); fill-opacity: 0.55; stroke-width: 1; }
  .place-name { fill: var(--text); }
  .map-label { fill: var(--map-label); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .map-label.ocean { fill: var(--ocean-label); font-style: italic; font-weight: 500; letter-spacing: 0.04em; text-transform: none; }
</style>
