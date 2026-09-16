<script lang="ts">
  import { AXIS, angleFromScreen, dayForAngle, earthOnOrbit, eventDay, eventOnDay, litOutline, orbitAngle, sunSeenFromEarth, type SeasonEvent } from '../geo/orbit';
  import { dateFromDayAndMinutes, daysInYear } from '../geo/sun';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';

  // Spec §6.1: the Sun in the middle, the Earth on its orbit seen from slightly above, its axis tilted 23½° and fixed
  // in space. Dragging the Earth (or the keys) sets the lab's date; the globe and the flat map follow.
  const W = 640, H = 350, CX = 320, CY = 196, R = 250, EARTH = 26, SUN = 34;
  const uid = `orbit-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  /** The drawn width in CSS px, so the Earth's grab area can stay a 44 px touch target however small the view is. */
  let cssW = $state(W);

  const year = $derived(mapState.sun?.year ?? new Date().getUTCFullYear());
  const lastDay = $derived(daysInYear(year));
  const day = $derived(Math.min(lastDay, mapState.sun?.dayOfYear ?? 1));
  const angle = $derived(orbitAngle(dateFromDayAndMinutes(year, day, 720)));
  const screen = (v: readonly number[]): [number, number] => [CX + v[0]!, CY - v[1]!];
  const earth = $derived(earthOnOrbit(angle, R));
  const earthXY = $derived(screen(earth));
  const behindSun = $derived(earth[2] < 0);
  const orbitD = $derived(`M${Array.from({ length: 121 }, (_, i) => screen(earthOnOrbit((i * 360) / 120, R)).map((n) => n.toFixed(1)).join(' ')).join('L')}Z`);
  const litD = $derived.by(() => {
    const pts = litOutline(sunSeenFromEarth(angle));
    return pts.length ? `M${pts.map(([x, y]) => `${(earthXY[0] + x * EARTH).toFixed(1)} ${(earthXY[1] - y * EARTH).toFixed(1)}`).join('L')}Z` : '';
  });
  const axisEnd = (k: number): [number, number] => [earthXY[0] + AXIS[0] * EARTH * k, earthXY[1] - AXIS[1] * EARTH * k];
  /** View units per CSS px: what a phone-sized view has to scale the grab area, the labels and the focus ring by. */
  const unit = $derived(W / Math.max(1, cssW));
  // 23 CSS px, not 22: `clientWidth` is rounded to whole pixels, and the extra one keeps the drawn diameter
  // above 44 CSS px either way. Never smaller than the Earth's own circle plus its axis label.
  const hitR = $derived(Math.max(34, 23 * unit));
  /** Labels never fall below about 13 CSS px, and the focus ring never below 3, however narrow the view is. */
  const fontSize = $derived(Math.max(15, 13 * unit));
  const focusWidth = $derived(Math.max(3, 3 * unit));

  const fmtDate = (d: number, month: 'long' | 'short') => new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month, timeZone: 'UTC' }).format(dateFromDayAndMinutes(year, d, 720));
  const event = $derived(eventOnDay(year, day));
  const valueText = $derived(event ? t('seasons.dateEvent', { date: fmtDate(day, 'long'), event: t(`seasons.event.${event}`) }) : fmtDate(day, 'long'));
  const EVENTS: SeasonEvent[] = ['march', 'june', 'september', 'december'];
  // A mark the Earth is standing on would only be scribbled over, and the caption already names that date.
  const marks = $derived(EVENTS.map((e) => { const d = eventDay(year, e); const p = earthOnOrbit(orbitAngle(dateFromDayAndMinutes(year, d, 720)), R); return { e, xy: screen(p), label: fmtDate(d, 'short') }; })
    .filter((m) => Math.hypot(m.xy[0] - earthXY[0], m.xy[1] - earthXY[1]) > EARTH + 16));

  function setDay(d: number) {
    const s = mapState.sun;
    if (s) mapState.sun = { ...s, dayOfYear: Math.max(1, Math.min(lastDay, Math.round(d))) };
  }
  /** One month keeps the day of the month where it can (31 January → 28 February), and never leaves the year. */
  function monthStep(delta: number) {
    const date = dateFromDayAndMinutes(year, day, 720);
    const target = new Date(Date.UTC(year, date.getUTCMonth() + delta, 1));
    if (target.getUTCFullYear() !== year) { setDay(delta > 0 ? lastDay : 1); return; }
    const dim = new Date(Date.UTC(year, target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), dim));
    setDay(Math.floor((target.getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1);
  }
  function onkeydown(e: KeyboardEvent) {
    const act: Record<string, () => void> = {
      ArrowRight: () => setDay(day + 1), ArrowUp: () => setDay(day + 1), ArrowLeft: () => setDay(day - 1), ArrowDown: () => setDay(day - 1),
      PageUp: () => monthStep(1), PageDown: () => monthStep(-1), Home: () => setDay(1), End: () => setDay(lastDay),
    };
    const f = act[e.key];
    if (!f) return;
    e.preventDefault();
    f();
  }
  let dragging = false;
  function fromPointer(e: PointerEvent) {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    setDay(dayForAngle(angleFromScreen(p.x - CX, CY - p.y), year));
  }
</script>

<figure class="orbit" aria-labelledby="{uid}-title">
  <p id="{uid}-title" class="visually-hidden">{t('seasons.orbit.label')}</p>
  <p id="{uid}-hint" class="visually-hidden">{t('seasons.orbit.hint')}</p>
  <!-- svelte-ignore a11y_no_static_element_interactions -- pointer drag on the orbit moves the Earth; the Earth itself is the keyboard slider -->
  <svg bind:this={svg} bind:clientWidth={cssW} viewBox="0 0 {W} {H}" role="group" aria-labelledby="{uid}-title" style:font-size="{fontSize}px"
    onpointerdown={(e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromPointer(e); }}
    onpointermove={(e) => dragging && fromPointer(e)} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
    <defs>
      <radialGradient id="{uid}-glow">
        <stop offset="0" stop-color="var(--sun)" stop-opacity="0.4" />
        <stop offset="1" stop-color="var(--sun)" stop-opacity="0" />
      </radialGradient>
    </defs>
    <path class="orbit-path" d={orbitD} />
    {#each marks as m (m.e)}<g class="mark"><circle cx={m.xy[0]} cy={m.xy[1]} r="4" /><text class="halo" x={m.xy[0]} y={m.xy[1] + (m.e === 'september' ? 22 : -12)} text-anchor="middle">{m.label}</text></g>{/each}
    <!--
      Painter's order: at the back of the orbit the Sun is drawn after the Earth, so it hides it. The Sun moves between
      the two branches, never the Earth — the Earth's <g> is the keyboard slider, and re-creating it would drop focus
      mid-drag (the branch changes as the Earth passes behind the Sun).
    -->
    {#snippet sunGroup()}
      <g class="sun" aria-hidden="true"><circle class="glow" cx={CX} cy={CY} r={SUN * 2.6} fill="url(#{uid}-glow)" /><circle class="disc" cx={CX} cy={CY} r={SUN} /><text class="halo" x={CX} y={CY + 5} text-anchor="middle">{t('seasons.sun')}</text></g>
    {/snippet}
    {#if !behindSun}{@render sunGroup()}{/if}
    <g class="earth" role="slider" tabindex="0" aria-label={t('seasons.orbit.slider')} aria-describedby="{uid}-hint"
      aria-valuemin={1} aria-valuemax={lastDay} aria-valuenow={day} aria-valuetext={valueText} {onkeydown}>
      <circle class="hit" cx={earthXY[0]} cy={earthXY[1]} r={hitR} />
      <line class="axis back" x1={axisEnd(-1.6)[0]} y1={axisEnd(-1.6)[1]} x2={earthXY[0]} y2={earthXY[1]} />
      <circle class="night-side" cx={earthXY[0]} cy={earthXY[1]} r={EARTH} />
      {#if litD}<path class="day-side" d={litD} />{/if}
      <circle class="rim" cx={earthXY[0]} cy={earthXY[1]} r={EARTH} />
      <line class="axis" x1={earthXY[0]} y1={earthXY[1]} x2={axisEnd(1.7)[0]} y2={axisEnd(1.7)[1]} />
      <text class="halo pole" x={axisEnd(1.7)[0] + 4} y={axisEnd(1.7)[1] - 4}>N</text>
      <circle class="focus-ring" cx={earthXY[0]} cy={earthXY[1]} r={hitR + 2} stroke-width={focusWidth} />
    </g>
    {#if behindSun}{@render sunGroup()}{/if}
    <text class="halo polaris" x={W - 16} y="26" text-anchor="end">↑ N · {t('seasons.polaris')}</text>
  </svg>
  <figcaption class="date" aria-hidden="true">{valueText}</figcaption>
</figure>

<style>
  .orbit { margin: 0; min-width: 0; display: grid; gap: var(--space-1); }
  .orbit svg { display: block; width: 100%; height: auto; touch-action: none; }
  .orbit-path { fill: none; stroke: var(--grid); stroke-width: 2; stroke-dasharray: 6 5; }
  text { fill: var(--text); }
  .night-side { fill: #22324a; }
  .day-side { fill: #9cc6ef; }
  .rim { fill: none; stroke: var(--text); stroke-width: 1.5; }
  .axis { stroke: var(--text); stroke-width: 2.2; stroke-linecap: round; }
  .axis.back { opacity: 0.55; stroke-dasharray: 4 4; }
  .pole { font-weight: 800; }
  .hit { fill: transparent; cursor: grab; }
  .focus-ring { fill: none; stroke: var(--focus); opacity: 0; }
  .earth:focus { outline: none; }
  .earth:focus-visible .focus-ring { opacity: 1; }
  .sun .disc { fill: var(--sun); stroke: var(--sun-stroke); stroke-width: 2; }
  .sun .glow { pointer-events: none; }
  /* The disc is amber in both themes, so its label keeps one dark ink (and a light halo) instead of following --text. */
  .sun text { font-weight: 700; fill: #3b2606; stroke: rgb(255 255 255 / 0.55); }
  .mark circle { fill: var(--text-muted); }
  .mark text { fill: var(--text-muted); font-size: 0.92em; }
  .polaris { fill: var(--text-muted); font-size: 0.92em; }
  .date { text-align: center; font-weight: var(--weight-heavy); font-size: var(--step-1); }
  @media (forced-colors: active) {
    .night-side { fill: Canvas; }
    .day-side { fill: Highlight; }
    .rim, .axis { stroke: CanvasText; }
  }
</style>
