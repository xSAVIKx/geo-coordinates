<script lang="ts">
  import { geoCircle } from 'd3-geo';
  import { normalizeLon } from '../../geo/format';
  import { sunPoint } from '../../geo/sun';
  import type { ViewCtx } from '../geometry';
  import { useMapState } from '../mapStateContext';
  const mapState = useMapState();
  let { ctx }: { ctx: ViewCtx } = $props();

  // Night is everything more than 90° from the point under the Sun, i.e. within 90° of the opposite point.
  // Twilight (Sun 0°–6° below the horizon) is the ring between 84° and 90° from that opposite point; an extra
  // ring at 87° softens the edge, and a faint warm wash marks the lit half (it matters most on the dark theme's dark land) so the terminator reads as dusk fading into night.
  const date = $derived(mapState.layers.daylight ? mapState.sunDate() : null);
  const shapes = $derived.by(() => {
    if (!date) return null;
    const sun = sunPoint(date, mapState.realSun);
    const anti: [number, number] = [normalizeLon(sun.lon + 180), -sun.lat];
    const circle = (radius: number) => ctx.path(geoCircle().center(anti).radius(radius).precision(1.5)()) ?? '';
    const day = ctx.path(geoCircle().center([sun.lon, sun.lat]).radius(90).precision(1.5)()) ?? '';
    return { day, twilight: circle(90), dusk: circle(87), night: circle(84), sun: ctx.project(sun) };
  });
</script>

{#if shapes}
  <g class="daylight" aria-hidden="true">
    <path d={shapes.day} class="day" />
    <path d={shapes.twilight} class="twilight" />
    <path d={shapes.dusk} class="twilight" />
    <path d={shapes.night} class="night" />
    {#if shapes.sun}
      <g class="sun" transform="translate({shapes.sun[0]} {shapes.sun[1]})">
        <circle class="glow" r={22 * ctx.px} />
        <g class="rays">
          {#each Array.from({ length: 8 }, (_, i) => i * 45) as a (a)}
            <line x1="0" y1={-13 * ctx.px} x2="0" y2={-19 * ctx.px} transform="rotate({a})" />
          {/each}
        </g>
        <circle class="disc" r={9 * ctx.px} />
      </g>
    {/if}
  </g>
{/if}

<style>
  .daylight { pointer-events: none; }
  .day { fill: var(--daylit); }
  .twilight { fill: var(--twilight); }
  .night { fill: var(--night); }
  .glow { fill: var(--sun); fill-opacity: 0.22; }
  .disc { fill: var(--sun); stroke: var(--sun-stroke); stroke-width: calc(1.5px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .rays line { stroke: var(--sun); stroke-width: calc(3px * var(--stroke-scale)); stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .rays { animation: spin 24s linear infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
