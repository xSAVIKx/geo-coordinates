<script lang="ts">
  import type { ViewCtx } from '../geometry';
  import Daylight from './Daylight.svelte';
  import { sphere } from '../world';
  import EdgeLabels from './EdgeLabels.svelte';
  import Graticule from './Graticule.svelte';
  import Hemispheres from './Hemispheres.svelte';
  import Land from './Land.svelte';
  import Overlays from './Overlays.svelte';
  import Political from './Political.svelte';
  import { reportHealth } from '../texture/health.svelte';
  import { useMapState } from '../mapStateContext';
  import { isTextureStyle, type MapStyle } from '../mapStyle';
  import { badgeBox, guidesUnderLabel, layoutSchools } from '../chosenLabel';
  import Places from './Places.svelte';
  import PointMarker from './PointMarker.svelte';
  import Schools from './Schools.svelte';
  import SpecialLines from './SpecialLines.svelte';
  const mapState = useMapState();
  // While the flat map is dragged, `ctx` is the view where the drag began (drawn with a wide pad) and
  // `offset` slides it to where the map is now; `edgeCtx` is the live view, for the edge numbers.
  // `style`: normally whatever this map's MapState draws; a view with no texture layer under it (StaticMap, on paper)
  // passes 'atlas' so it keeps drawing the sea, land and coasts itself.
  let { ctx, idPrefix, edgeCtx, offset = null, style: styleProp }: { ctx: ViewCtx; idPrefix: string; edgeCtx?: ViewCtx; offset?: [number, number] | null; style?: MapStyle } = $props();
  const sphereD = $derived(ctx.kind === 'globe' ? (ctx.path(sphere) ?? '') : '');
  // Physical and Satellite draw the sphere themselves (the texture layer under this SVG): only the borders and the
  // lesson's own marks stay in SVG over them.
  const style = $derived(styleProp ?? mapState.drawnMapStyle);
  // Grouped in the drawing's coordinates, so the badges slide with everything else while the flat
  // map is dragged; the flat grouping itself is cached per zoom (see schools.ts), so a pan never regroups.
  // The school chosen from a list is left out of the groups and drawn alone, named.
  // Its name goes first, inside the view and clear of badges (they step aside) — see chosenLabel.ts.
  const schools = $derived(mapState.layers.schools ? layoutSchools(ctx, mapState.chosenSchool, mapState.point, mapState.layers.pointGuides) : null);
  const schoolClusters = $derived(schools?.clusters ?? []);
  // While a chosen school's name is shown, the point's guide along the axis that would strike through it is left out.
  const guideSkip = $derived(schools?.label && mapState.point && mapState.layers.pointGuides ? guidesUnderLabel(ctx, schools.label.box, mapState.point, ctx.px) : { lat: false, lon: false });
  const chosenBoxes = $derived(schools?.label && schools.chosen ? [schools.label.box, { left: schools.chosen.x - 12 * ctx.px, right: schools.chosen.x + 12 * ctx.px, top: schools.chosen.y - 12 * ctx.px, bottom: schools.chosen.y + 12 * ctx.px }] : []);
  // Count badges and the chosen school are drawn over line names: every layer that places or avoids those names gets the same boxes to keep clear of.
  const lineAvoid = $derived([...schoolClusters.filter((c) => c.members.length > 1).map((c) => badgeBox(c, ctx.px)), ...chosenBoxes]);
  // Spec §4 "any error → Atlas": an exception in a style's vector layer shows Atlas with the note.
  function vectorFailed(error: unknown) {
    console.warn('map style layer:', error);
    queueMicrotask(() => reportHealth({ type: 'vector-fail' }));
  }
</script>

<g class="geo" transform={offset ? `translate(${offset[0]} ${offset[1]})` : undefined}>
<Land {ctx} {style} />
{#if style === 'political'}
  <svelte:boundary onerror={vectorFailed}><Political {ctx} /></svelte:boundary>
{/if}
{#if ctx.kind === 'globe' && !isTextureStyle(style)}
  <!-- Decorative sphere shading: a soft highlight up-left and a darker limb, so the disc reads as a ball. -->
  <defs>
    <radialGradient id="{idPrefix}-shade" cx="0.38" cy="0.32" r="0.72">
      <stop offset="0" stop-color="var(--ocean-light)" stop-opacity="0.34" />
      <stop offset="0.55" stop-color="var(--ocean-light)" stop-opacity="0" />
      <stop offset="0.86" stop-color="var(--ocean-deep)" stop-opacity="0.12" />
      <stop offset="1" stop-color="var(--ocean-deep)" stop-opacity="0.42" />
    </radialGradient>
  </defs>
  <path class="shade" d={sphereD} fill="url(#{idPrefix}-shade)" />
{/if}
<Hemispheres {ctx} {idPrefix} />
<Graticule {ctx} />
<!-- Night shading dims land and the grid but not the equator/meridian lines and their names, nor places and overlays. -->
<Daylight {ctx} />
<SpecialLines {ctx} part="lines" />
<!-- A school's square goes under a city's dot and name; count badges and the chosen school go over them, so the digits stay readable. -->
{#if mapState.layers.schools}<Schools {ctx} clusters={schoolClusters} part="squares" />{/if}
<!-- The noon meridian and the point's dashed guides run under line, place and river names: a name keeps its halo instead of being struck through. -->
<Overlays {ctx} part="lines" {lineAvoid} />
<PointMarker {ctx} part="guides" skip={guideSkip} />
<SpecialLines {ctx} part="labels" {lineAvoid} />
<Places {ctx} {schoolClusters} {chosenBoxes} {lineAvoid} />
{#if schools}<Schools {ctx} clusters={schoolClusters} chosen={schools.chosen} label={schools.label} part="badges" />{/if}
<Overlays {ctx} part="marks" {lineAvoid} />
<PointMarker {ctx} part="handle" />
{#if schools?.label}<Schools {ctx} clusters={[]} label={schools.label} part="label" />{/if}
</g>
<!-- Degree numbers last so guides and overlays never cover them; they ignore the pointer, so the point handle stays grabbable. -->
{#if ctx.kind === 'flat'}<EdgeLabels ctx={edgeCtx ?? ctx} />{/if}
{#if ctx.kind === 'globe'}<path class="rim" d={sphereD} />{/if}

<style>
  .shade { pointer-events: none; }
  .rim { fill: none; stroke: var(--grid); stroke-width: calc(1.5px * var(--stroke-scale)); stroke-opacity: 0.9; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
