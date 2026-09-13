<script lang="ts">
  import { formatLat } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { spokenLat } from '../i18n/spoken';
  import { POLAR, TROPIC } from './geometry';
  import { mapState } from './mapState.svelte';

  const S = 400, C = 200, R = 140;
  const uid = `cross-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let dragging = false;

  const lat = $derived(mapState.point?.lat ?? 0);
  const rad = $derived((lat * Math.PI) / 180);
  const px = $derived(C + R * Math.cos(rad));
  const py = $derived(C - R * Math.sin(rad));
  const arcR = 55;
  const arc = $derived(`M ${C + arcR} ${C} A ${arcR} ${arcR} 0 0 ${lat >= 0 ? 0 : 1} ${C + arcR * Math.cos(rad)} ${C - arcR * Math.sin(rad)}`);
  const labelRad = $derived(rad / 2);

  function chordY(l: number) { return C - R * Math.sin((l * Math.PI) / 180); }
  function chordHalf(l: number) { return R * Math.cos((l * Math.PI) / 180); }

  function setFromPointer(e: PointerEvent) {
    const m = svg.getScreenCTM();
    if (!m || !mapState.point) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const angle = (Math.atan2(C - pt.y, Math.abs(pt.x - C)) * 180) / Math.PI;
    mapState.userSetPoint({ lat: angle, lon: mapState.point.lon }, 'map');
  }

  function onpointerdown(e: PointerEvent) {
    if (!mapState.pointEditable) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    setFromPointer(e);
  }

  function onpointermove(e: PointerEvent) {
    if (dragging) setFromPointer(e);
  }

  function onkeydown(e: KeyboardEvent) {
    if (!mapState.point || !mapState.pointEditable) return;
    const s = mapState.stepSize(e.shiftKey);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      mapState.nudge(e.key === 'ArrowUp' ? s : -s, 0, 'map');
    }
  }
</script>

<figure class="cross">
  <div class="frame">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- keyboard-operable cross-section (spec §7): latitude can be changed from the diagram when editable -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- pointer/keyboard handlers drive latitude editing per spec §7; the sliders remain the primary accessible control -->
    <svg
      bind:this={svg}
      viewBox="0 0 {S} {S}"
      role="group"
      aria-roledescription={t('map.view.cross-section')}
      aria-label={t('cross.label')}
      aria-describedby="{uid}-hint"
      tabindex={mapState.pointEditable ? 0 : -1}
      {onkeydown}
      {onpointerdown}
      {onpointermove}
      onpointerup={() => (dragging = false)}
      onpointercancel={() => (dragging = false)}
    >
      <circle cx={C} cy={C} r={R} class="earth" />
      {#if mapState.layers.tropics}
        {#each [TROPIC, -TROPIC, POLAR, -POLAR] as l (l)}
          <line x1={C - chordHalf(l)} x2={C + chordHalf(l)} y1={chordY(l)} y2={chordY(l)} class="tropic" />
        {/each}
      {/if}
      <line x1={C - R - 30} x2={C + R + 30} y1={C} y2={C} class="equator" />
      <text x={C - R - 28} y={C - 8} class="halo lbl equator-t" font-size="14">{t('line.equator')}</text>
      <line x1={C} x2={C} y1={C - R - 24} y2={C + R + 24} class="axis" />
      <text x={C + 6} y={C - R - 10} class="halo lbl" font-size="16">{t('cross.northPole')}</text>
      <text x={C + 6} y={C + R + 22} class="halo lbl" font-size="16">{t('cross.southPole')}</text>
      <text x={C - 6} y={C - R - 8} class="halo lbl small" font-size="12" text-anchor="end">{t('cross.axis')}</text>
      <text x={C - 6} y={C + 18} class="halo lbl small" font-size="12" text-anchor="end">{t('cross.centre')}</text>
      <line x1={C - chordHalf(lat)} x2={px} y1={py} y2={py} class="parallel" />
      <text x={C - chordHalf(lat) + 4} y={py - 6} class="halo lbl small" font-size="12">{t('cross.parallel')}</text>
      <line x1={C} y1={C} x2={px} y2={py} class="radius" />
      <path d={arc} class="angle" />
      <text
        x={C + (arcR + 30) * Math.cos(labelRad)}
        y={C - (arcR + 30) * Math.sin(labelRad) + 6}
        class="halo angle-t"
        font-size="20"
        text-anchor="middle">{formatLat(lat, i18n.lang, mapState.precision)}</text>
      <circle cx={C} cy={C} r="4" class="centre" />
      <g transform="translate({px} {py})" class:editable={mapState.pointEditable}>
        <circle r="22" fill="transparent" />
        <circle r="9" class="pt" />
      </g>
    </svg>
  </div>
  <p id="{uid}-hint" class="visually-hidden">{t('cross.desc', { value: spokenLat(lat, i18n.lang, mapState.precision) })}</p>
</figure>

<style>
  .cross { margin: 0; min-width: 0; }
  .frame { min-width: 0; }
  svg { display: block; width: 100%; max-width: min(100%, 60vh); margin-inline: auto; height: auto; touch-action: none; }
  svg:focus-visible { outline: 3px solid var(--focus); border-radius: var(--radius); }
  .earth { fill: var(--ocean); stroke: var(--land-stroke); stroke-width: 2; }
  .equator { stroke: var(--equator); stroke-width: 3; }
  .axis { stroke: var(--text-muted); stroke-width: 2; stroke-dasharray: 8 6; }
  .tropic { stroke: var(--tropics); stroke-width: 1.5; stroke-dasharray: 2 4; }
  .parallel { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 4; }
  .radius { stroke: var(--accent); stroke-width: 3; }
  .angle { fill: none; stroke: var(--marker-b); stroke-width: 4; }
  .angle-t { fill: var(--marker-b); font-weight: 800; }
  .lbl { fill: var(--text); }
  .equator-t { fill: var(--equator); }
  .centre { fill: var(--text); }
  .pt { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
  .editable { cursor: grab; }
</style>
