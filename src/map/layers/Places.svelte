<script lang="ts">
  import { formatLat } from '../../geo/format';
  import { i18n, t } from '../../i18n/i18n.svelte';
  import { labelWidth } from '../brackets';
  import { edgeTicks } from '../edgeTicks';
  import type { ViewCtx } from '../geometry';
  import { gridUsesMinutes, resolveGridStep } from '../gridStep';
  import { meanSunPoint } from '../../geo/sun';
  import { createLabelMemory, overlaps, placeLabelOptions, pointBox, selectStablePlacements, textBox, type LabelBox, type PlaceLabelOption } from '../labelLayout';
  import { lineLabelSpecs } from '../lineLabels';
  import { mapState } from '../mapState.svelte';
  import { bracketBoxes, LINE_LABEL, markerLayout, noonLabel, NOON_LABEL, placeLineLabels } from '../overlayLayout';
  import { bracketFmt, markerText, noonText } from '../overlayText';
  import { MAP_LABELS, PLACES, tierVisible, tierZoom } from '../places';
  import { SCHOOL_BADGE_H, schoolBadgeWidth, type SchoolCluster } from '../schools';
  import { LABELLED_RIVERS, REGION_DETAIL_ZOOM, regionActive, riverLabelPoints } from '../world';
  // `chosenBoxes`: the chosen school's name and square (drawn on top by Schools.svelte), kept clear by every name here.
  let { ctx, schoolClusters = [], chosenBoxes = [] }: { ctx: ViewCtx; schoolClusters?: SchoolCluster[]; chosenBoxes?: LabelBox[] } = $props();

  // Which place labels were visible the *previous* time this ran, for the hysteresis bonus in
  // `visibleIds` — per scene: a new scene (MapState.sceneVersion) starts without any bonus. Plain,
  // non-reactive memory, so remembering the result cannot itself re-trigger the derived.
  const labelMemory = createLabelMemory();
  const schoolLabelMemory = createLabelMemory();

  // `ctx.zoom` is flat-map zoom (the globe reports its flat equivalent): non-featured names from
  // Europe-sized views, and places of the `region`/`local` tiers only once zoomed in that far.
  const showAllNames = $derived(ctx.kind === 'flat' ? ctx.zoom >= 2.5 : ctx.zoom >= 4);
  // Which tiers show follows the zoom *and* how wide the map is drawn (see `tierZoom`).
  const places = $derived(mapState.layers.places ? PLACES.filter((p) => p.kind === 'city' && tierVisible(p.tier, tierZoom(ctx.zoom, ctx.width / ctx.px))) : []);
  // Label density follows how big the whole world is actually drawn, in CSS px (a small phone map
  // cannot carry the same labels as a projected one). The globe shows half the world at once.
  const worldPx = $derived((ctx.width / ctx.px) * ctx.zoom);
  const roomy = $derived(worldPx >= 560);
  const showContinents = $derived(roomy && ctx.zoom <= (ctx.kind === 'flat' ? 4 : 8));

  // Everything the overlay layers write (marker symbols and labels, brackets, "Noon 12:00") and the
  // special-line labels, placed exactly as Overlays.svelte and SpecialLines.svelte place them (shared in
  // overlayLayout.ts): a place name, an ocean or a continent name never covers one.
  const overlayObstacles = $derived.by<LabelBox[]>(() => {
    const m = markerLayout(mapState.overlays, ctx, markerText);
    const brackets = bracketBoxes(mapState.overlays, ctx, bracketFmt, m.room);
    const out = [...m.symbols, ...m.labels, ...brackets];
    const date = mapState.overlays.some((o) => o.kind === 'noon-meridian') ? mapState.sunDate() : null;
    const noon = date ? noonLabel(ctx, meanSunPoint(date).lon, labelWidth(noonText(), NOON_LABEL, ctx.px), [...out, ...lineObstacles]) : null;
    return noon ? [...out, noon.box] : out;
  });
  const lineObstacles = $derived.by<LabelBox[]>(() => {
    const m = markerLayout(mapState.overlays, ctx, markerText);
    const avoid = [...bracketBoxes(mapState.overlays, ctx, bracketFmt, m.room), ...m.labels];
    return placeLineLabels(lineLabelSpecs(mapState.layers), { kind: ctx.kind, width: ctx.width, height: ctx.height, px: ctx.px, project: (p) => ctx.project(p), rotateLambda: ctx.projection.rotate()[0] },
      (spec) => labelWidth(t(spec.labelKey), LINE_LABEL, ctx.px), avoid).map((l) => l.box);
  });
  // Continent and ocean names that fit: wholly inside the view (not cut at a map's side or the globe's
  // edge) and clear of overlay texts and the point's ring (a marker's "Greenland" label wins over "Arctic Ocean").
  const continents = $derived.by(() => {
    if (!showContinents) return [];
    return MAP_LABELS.flatMap((l) => {
      const xy = ctx.project(l);
      if (!xy) return [];
      const size = (l.kind === 'ocean' ? 12 : 11.5) * ctx.px;
      const box = textBox(xy[0], xy[1], labelWidth(t(`label.${l.id}`), l.kind === 'ocean' ? 12 : 11.5, ctx.px), size, 'middle');
      const inside = box.left >= 0 && box.right <= ctx.width && box.top >= 0 && box.bottom <= ctx.height && (ctx.kind === 'flat'
        || Math.hypot(Math.max(Math.abs(box.left - ctx.width / 2), Math.abs(box.right - ctx.width / 2)), Math.max(Math.abs(box.top - ctx.height / 2), Math.abs(box.bottom - ctx.height / 2))) <= ctx.projection.scale() + 2 * ctx.px);
      if (!inside || [...overlayObstacles, ...pointObstacles].some((o) => overlaps(box, o))) return [];
      return [{ l, xy, box }];
    });
  });
  const continentObstacles = $derived(continents.map((c) => c.box));

  // The flat map's degree numbers along the left and bottom edges (EdgeLabels.svelte) stay readable:
  // a place name never covers a latitude label or the band of longitude labels at the bottom, and a
  // name that would run off the map is left out rather than cut (the dot still shows).
  const edgeObstacles = $derived.by<LabelBox[]>(() => {
    const far = 1e7;
    // Names on the globe stay inside its square view too, rather than being cut at the side.
    if (ctx.kind !== 'flat') return [
      { left: -far, right: 0, top: -far, bottom: far }, { left: ctx.width, right: far, top: -far, bottom: far },
      { left: -far, right: far, top: -far, bottom: 0 }, { left: -far, right: far, top: ctx.height, bottom: far },
    ];
    const step = resolveGridStep(mapState.layers.graticuleStep, ctx);
    const precision = gridUsesMinutes(step) ? 'minute' : 'degree';
    const out: LabelBox[] = [
      { left: 0, right: ctx.width, top: ctx.height - 18 * ctx.px, bottom: far },
      { left: -far, right: 0, top: -far, bottom: far },
      { left: ctx.width, right: far, top: -far, bottom: far },
      { left: -far, right: far, top: -far, bottom: 0 },
    ];
    for (const lat of edgeTicks(ctx, ctx.center, ctx.zoom, step).lats) {
      out.push(textBox(4 * ctx.px, lat.y + 4 * ctx.px, labelWidth(formatLat(lat.value, i18n.lang, precision), 11, ctx.px), 11 * ctx.px, 'start'));
    }
    return out;
  });

  // The movable point is an obstacle too: names move aside (or hide) rather than sit under its ring.
  const pointObstacles = $derived.by<LabelBox[]>(() => {
    const p = mapState.point;
    const xy = p ? ctx.project(p) : null;
    return xy ? [pointBox(xy[0], xy[1], ctx.px)] : [];
  });
  // Every named place (dot always stays visible; only the text label is at risk), with the boxes its
  // name may take (see `placeLabelOptions`: right, left, above, below — close to the dot — and, when the
  // dot is under the point's ring or a school mark, the same sides just past it) and how far it sits
  // from what the view is currently centred on.
  interface Candidate { id: string; featured: boolean; xy: [number, number]; options: PlaceLabelOption[]; distance: number }
  const degreesFromCentre = (p: { lat: number; lon: number }) => Math.hypot(p.lat - ctx.center.lat, ((p.lon - ctx.center.lon + 540) % 360) - 180);
  const candidates = $derived.by<Candidate[]>(() => {
    const size = roomy ? 12 : 10.5;
    const marks = [...pointObstacles, ...schoolMarks];
    return places.flatMap((p): Candidate[] => {
      if (!(p.featured || showAllNames)) return [];
      const xy = ctx.project(p);
      if (!xy) return [];
      const width = labelWidth(t(`place.${p.id}`), size, ctx.px);
      return [{ id: p.id, featured: p.featured, xy, options: placeLabelOptions(xy, width, size * ctx.px, ctx.px, marks), distance: degreesFromCentre(p) }];
    });
  });
  // Featured places always outrank non-featured ones; among non-featured places, one already
  // showing keeps its priority bonus over one that wasn't (so a tiny pan/zoom doesn't flicker
  // labels in and out), and distance-to-centre (bucketed, so small shifts don't reorder ties) is
  // only the final tiebreaker among places at the same tier.
  // With the schools layer on, school squares and count badges are drawn over names, so a name never
  // takes a spot one of them covers: it goes to another side (or past its own city's badge), or stays unnamed.
  const schoolMarks = $derived(schoolClusters.map((c): LabelBox => {
    const halfW = (c.members.length === 1 ? 6 : schoolBadgeWidth(c.members.length) / 2 + 1) * ctx.px;
    const halfH = (c.members.length === 1 ? 6 : SCHOOL_BADGE_H / 2 + 1) * ctx.px;
    return { left: c.x - halfW, right: c.x + halfW, top: c.y - halfH, bottom: c.y + halfH };
  }));
  const placements = $derived.by<Map<string, PlaceLabelOption>>(() => {
    const previousVisible = labelMemory.previous(mapState.sceneVersion);
    const chosen = selectStablePlacements(
      candidates,
      (c) => c.options.map((o) => o.box),
      (c) => c.featured,
      (c) => c.distance,
      (c) => previousVisible.has(c.id),
      [...lineObstacles, ...continentObstacles, ...edgeObstacles, ...pointObstacles, ...overlayObstacles, ...schoolMarks, ...chosenBoxes],
    );
    const out = new Map<string, PlaceLabelOption>();
    candidates.forEach((c, i) => { if (chosen[i]! >= 0) out.set(c.id, c.options[chosen[i]!]!); });
    labelMemory.remember(new Set(out.keys()));
    return out;
  });

  // River names (Wisła, Odra) from zoom 6, after the place names: each is written at the point of
  // the river nearest the middle of the view whose label box is free (clear of place names, line
  // and edge labels, and the other river's name); a river with no free spot goes unnamed.
  const RIVER_FONT = 11.5;
  const riverLabels = $derived.by(() => {
    if (!mapState.layers.places || ctx.zoom < REGION_DETAIL_ZOOM || !regionActive(ctx.zoom, ctx.bounds)) return [];
    const placed: LabelBox[] = [...lineObstacles, ...continentObstacles, ...edgeObstacles, ...pointObstacles, ...overlayObstacles, ...[...placements.values()].map((o) => o.box)];
    const out: { id: string; x: number; y: number }[] = [];
    for (const id of LABELLED_RIVERS) {
      const width = labelWidth(t(`river.${id}`), RIVER_FONT, ctx.px);
      const spots = riverLabelPoints(id)
        .map((p) => ctx.project(p))
        .filter((xy): xy is [number, number] => xy !== null && xy[0] >= 0 && xy[0] <= ctx.width && xy[1] >= 0 && xy[1] <= ctx.height)
        .sort((a, b) => Math.hypot(a[0] - ctx.width / 2, a[1] - ctx.height / 2) - Math.hypot(b[0] - ctx.width / 2, b[1] - ctx.height / 2));
      for (const [x, y] of spots) {
        const box = textBox(x + 5 * ctx.px, y - 5 * ctx.px, width, RIVER_FONT * ctx.px, 'start');
        if (placed.some((b) => overlaps(box, b))) continue;
        placed.push(box);
        out.push({ id, x: x + 5 * ctx.px, y: y - 5 * ctx.px });
        break;
      }
    }
    return out;
  });

  // Names of Maple Bear schools that stand alone (no count badge), from Europe-sized views on and
  // only where they fit: after place names, river names and every other label, clear of the school
  // squares and badges. Same sides as place names, a little further out: the square is wider than a
  // dot, and a school chosen from the list has the point (snapped to a minute) right on top of it.
  const SCHOOL_FONT = 11.5;
  // A long school name that cannot go centred above or below may still fit starting or ending there.
  type SchoolSide = 'right' | 'left' | 'above' | 'below' | 'above-right' | 'above-left' | 'below-right' | 'below-left';
  const SCHOOL_SIDES: readonly SchoolSide[] = ['right', 'left', 'above', 'below', 'above-right', 'above-left', 'below-right', 'below-left'];
  const schoolSideAnchor = (x: number, y: number, side: SchoolSide, px: number): { x: number; y: number; anchor: 'start' | 'end' | 'middle' } => {
    const dy = side.startsWith('above') ? -19 : side.startsWith('below') ? 26 : 4;
    if (side === 'right') return { x: x + 9 * px, y: y + dy * px, anchor: 'start' };
    if (side === 'left') return { x: x - 9 * px, y: y + dy * px, anchor: 'end' };
    if (side.endsWith('right')) return { x: x - 6 * px, y: y + dy * px, anchor: 'start' };
    if (side.endsWith('left')) return { x: x + 6 * px, y: y + dy * px, anchor: 'end' };
    return { x, y: y + dy * px, anchor: 'middle' };
  };
  const schoolLabels = $derived.by(() => {
    if (!schoolClusters.length || ctx.zoom < 3 || !roomy) return [];
    const singles = schoolClusters.filter((c) => c.members.length === 1 && c.x >= 0 && c.x <= ctx.width && c.y >= 0 && c.y <= ctx.height);
    if (!singles.length) return [];
    const placed: LabelBox[] = [
      ...lineObstacles, ...continentObstacles, ...edgeObstacles, ...pointObstacles, ...schoolMarks,
      ...chosenBoxes,
      // The view's edges: a school's name is left out rather than cut (the globe's names too).
      { left: -1e7, right: 0, top: -1e7, bottom: 1e7 }, { left: ctx.width, right: 1e7, top: -1e7, bottom: 1e7 },
      { left: -1e7, right: 1e7, top: -1e7, bottom: 0 }, { left: -1e7, right: 1e7, top: ctx.height, bottom: 1e7 },
      ...overlayObstacles,
      ...[...placements.values()].map((o) => o.box),
      ...riverLabels.map((r) => textBox(r.x, r.y, labelWidth(t(`river.${r.id}`), RIVER_FONT, ctx.px), RIVER_FONT * ctx.px, 'start')),
    ];
    const items = singles.map((c) => {
      const school = c.members[0]!;
      const width = labelWidth(school.name, SCHOOL_FONT, ctx.px);
      const boxes = SCHOOL_SIDES.map((side) => {
        const a = schoolSideAnchor(c.x, c.y, side, ctx.px);
        return textBox(a.x, a.y, width, SCHOOL_FONT * ctx.px, a.anchor);
      });
      return { c, school, boxes };
    });
    const previousVisible = schoolLabelMemory.previous(mapState.sceneVersion);
    const chosen = selectStablePlacements(
      items,
      (i) => i.boxes,
      () => false,
      (i) => Math.hypot(i.c.x - ctx.width / 2, i.c.y - ctx.height / 2) / ctx.px,
      (i) => previousVisible.has(i.school.id),
      placed,
      40,
    );
    const out = items.flatMap((item, k) => (chosen[k]! >= 0 ? [{ id: item.school.id, name: item.school.name, ...schoolSideAnchor(item.c.x, item.c.y, SCHOOL_SIDES[chosen[k]!]!, ctx.px) }] : []));
    schoolLabelMemory.remember(new Set(out.map((l) => l.id)));
    return out;
  });
</script>

{#if mapState.layers.places}
  {#each continents as { l, xy } (l.id)}
    <text class="halo map-label {l.kind}" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={(l.kind === 'ocean' ? 12 : 11.5) * ctx.px} lang={i18n.lang}>{t(`label.${l.id}`)}</text>
  {/each}
  {#each places as p (p.id)}
    {@const xy = ctx.project(p)}
    {@const named = p.featured || showAllNames}
    {#if xy}
      {@const a = named ? placements.get(p.id) : undefined}
      <!-- A dot whose name did not fit is drawn small and soft, so crowded areas stay calm. -->
      <circle class="place" class:minor={!a} cx={xy[0]} cy={xy[1]} r={(a ? 3.2 : 2.2) * ctx.px} />
      {#if a}
        <text class="halo place-name" x={a.x} y={a.y} text-anchor={a.anchor} font-size={(roomy ? 12 : 10.5) * ctx.px}>{t(`place.${p.id}`)}</text>
      {/if}
    {/if}
  {/each}
  {#each riverLabels as r (r.id)}
    <text class="halo river-name" data-river={r.id} x={r.x} y={r.y} font-size={RIVER_FONT * ctx.px}>{t(`river.${r.id}`)}</text>
  {/each}
{/if}
{#each schoolLabels as l (l.id)}
  <text class="halo school-name" data-school={l.id} x={l.x} y={l.y} text-anchor={l.anchor} font-size={SCHOOL_FONT * ctx.px}>{l.name}</text>
{/each}

<style>
  .place { fill: var(--text); stroke: var(--halo); stroke-width: calc(1.5px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .place.minor { fill: var(--map-label); fill-opacity: 0.55; stroke-width: calc(1px * var(--stroke-scale)); }
  .place-name { fill: var(--text); }
  .school-name { fill: var(--school-text); font-weight: 650; }
  .river-name { fill: var(--river-label); font-style: italic; font-weight: 650; letter-spacing: 0.02em; }
  .map-label { fill: var(--map-label); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .map-label.ocean { fill: var(--ocean-label); font-style: italic; font-weight: 500; letter-spacing: 0.04em; text-transform: none; }
</style>
