<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import { visibleCityBox } from '../cityBoxes';
  import type { ViewCtx } from '../geometry';
  import { useMapState } from '../mapStateContext';
  import type { MapStyle } from '../mapStyle';
  import { i18n } from '../../i18n/i18n.svelte';
  import { onStreetsLoaded, streetFade, streetsDisabled, streetsFor } from '../streets';
  const mapState = useMapState();
  // Drawn above the photo and below the graticule, in all four styles: in Atlas and Political the street map
  // appears without a photo, which suits those styles (Places up close spec §5, planning ruling R14). `style`
  // comes from Layers.svelte, the one place that decides what this map draws.
  let { ctx, style }: { ctx: ViewCtx; style: MapStyle } = $props();
  const box = $derived(mapState.closeUps ? visibleCityBox(ctx.bounds, ctx.zoom) : null);
  // The box's data block is inflated off the main thread (streets.ts), so the first view of a box draws nothing;
  // this counter re-runs the layer when the streets arrive.
  let unpacked = $state(0);
  $effect(() => onStreetsLoaded(() => unpacked++));
  const layers = $derived.by(() => {
    // `streetsDisabled` covers the case where the *names* failed first (Places.svelte): one failure, one layer off.
    if (!box || streetsDisabled()) return null;
    // `vector=fail` breaks all three vector layers at once, as Political.svelte and PhysicalWater.svelte read it
    // too; `streets=fail` breaks this one alone, which is how the e2e proves a street failure leaves the other
    // two — and the chosen style — untouched.
    if (testFlag('vector') === 'fail' || testFlag('streets') === 'fail') throw new Error('street layer failure forced for a test');
    void unpacked;
    return streetsFor(box, ctx.zoom, ctx.bounds, i18n.lang);
  });
  const fade = $derived(streetFade(ctx.zoom));
  const d = (g: GeoJSON.Geometry) => ctx.regionPath(g) ?? '';
  const greenD = $derived(layers ? d(layers.green) : '');
  const waterD = $derived(layers ? d(layers.water) : '');
  const waterwaysD = $derived(layers ? d(layers.waterways) : '');
  const railD = $derived(layers ? d(layers.rail) : '');
  const roads = $derived(layers ? layers.roads.map((r) => ({ cls: r.cls, d: d(r.line) })).filter((r) => r.d) : []);
  // Political already paints its own country colours; a green wash over them reads as a third colour, so the
  // area fills are left out there and only the lines are drawn.
  const areas = $derived(style !== 'political');
  // Nothing at all until the box has something to draw: an empty <g> inside every box would make the e2e and the
  // eye disagree about whether the layer is there.
  const drawn = $derived(layers !== null && fade > 0 && (roads.length > 0 || railD !== '' || waterwaysD !== ''));
</script>

<!-- Decorative: the names that matter are text, placed with everything else by Places.svelte (planning ruling R19). -->
{#if drawn}
  <g class="streets" data-city-box={box?.id} style:opacity={fade} aria-hidden="true">
    {#if areas}
      <path class="green" d={greenD} />
      <path class="water" d={waterD} />
    {/if}
    <path class="waterway" d={waterwaysD} />
    <path class="rail" d={railD} />
    <!-- Casings first, all of them, then the fills: a junction then reads as roads crossing, not as a pile of strokes. -->
    {#each roads as r (r.cls)}<path class="road-casing c{r.cls}" d={r.d} />{/each}
    {#each roads as r (r.cls)}<path class="road c{r.cls}" d={r.d} />{/each}
  </g>
{/if}

<style>
  /*
   * Every stroke here is `its own px x --stroke-scale x --street-weight`. The last factor is 1 on a drawn map
   * (Atlas, Political), where these weights were drawn to be the map, and 0.9 over an aerial photo (base.css),
   * where they are drawn *on* the thing the pupil came to look at. At full weight the near-white casings closed
   * over the photo: at Katowice's fit zoom the layer paints 657 residential segments and at Tokyo's 1 899, each
   * with a 3.4 px light casing under a 1.8 px core, and the roofs, yards and tracks underneath stopped showing
   * between them. The factor is on the whole ladder, not on the small classes alone, so the hierarchy a pupil
   * reads the map by — motorway widest, footway thinnest — is exactly the same picture, nine tenths the ink.
   */
  .streets { pointer-events: none; }
  .green { fill: var(--street-green); stroke: none; }
  .water { fill: var(--street-water); stroke: none; }
  .waterway { fill: none; stroke: var(--street-water); stroke-width: calc(1.6px * var(--stroke-scale) * var(--street-weight)); stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .rail { fill: none; stroke: var(--street-rail); stroke-width: calc(1.4px * var(--stroke-scale) * var(--street-weight)); stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; }
  /* Not `.casing`: base.css gives that class — the special lines', the point guides', the marker rims' — its own
     weight over a picture, and those marks must stay the most prominent things on the map. */
  .road-casing { fill: none; stroke: var(--street-casing); stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .road { fill: none; stroke: var(--street-ink); stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  /* Motorways widest, footways thinnest; the casing is 2 px wider than its road at every class. */
  .road-casing.c0 { stroke-width: calc(8px * var(--stroke-scale) * var(--street-weight)); } .road.c0 { stroke-width: calc(6px * var(--stroke-scale) * var(--street-weight)); stroke: var(--street-major); }
  .road-casing.c1 { stroke-width: calc(6.5px * var(--stroke-scale) * var(--street-weight)); } .road.c1 { stroke-width: calc(4.5px * var(--stroke-scale) * var(--street-weight)); stroke: var(--street-major); }
  .road-casing.c2 { stroke-width: calc(5.5px * var(--stroke-scale) * var(--street-weight)); } .road.c2 { stroke-width: calc(3.5px * var(--stroke-scale) * var(--street-weight)); }
  .road-casing.c3 { stroke-width: calc(4.5px * var(--stroke-scale) * var(--street-weight)); } .road.c3 { stroke-width: calc(2.6px * var(--stroke-scale) * var(--street-weight)); }
  .road-casing.c4 { stroke-width: calc(3.4px * var(--stroke-scale) * var(--street-weight)); } .road.c4 { stroke-width: calc(1.8px * var(--stroke-scale) * var(--street-weight)); }
  .road-casing.c5 { stroke-width: calc(2.4px * var(--stroke-scale) * var(--street-weight)); } .road.c5 { stroke-width: calc(1.1px * var(--stroke-scale) * var(--street-weight)); stroke-dasharray: 3 3; }
</style>
