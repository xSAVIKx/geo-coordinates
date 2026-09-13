<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import { settings } from '../app/settings.svelte';
  import { makeGlobeCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { mapState } from './mapState.svelte';

  const SIZE = 500;
  const uid = `globe-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(SIZE);
  const uiScale = $derived(settings.largeText ? 1.25 : 1);
  const ctx = $derived(makeGlobeCtx(SIZE, mapState.rotate, (SIZE / Math.max(1, clientWidth)) * uiScale, mapState.globeZoom));

  type Drag = { mode: 'point' | 'rotate' | 'maybe-click'; startX: number; startY: number; lastX: number; lastY: number };
  let drag: Drag | null = null;
  let frame = 0;
  let pinch = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  function toView(clientX: number, clientY: number): [number, number] {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  }

  // Turning steps shrink as the globe zooms in, so a press moves the view by the same share of what is visible.
  const turnStep = (big: boolean) => (big ? 3 : 15) / mapState.globeZoom;

  function rotateBy(dLambda: number, dPhi: number) {
    const [l, p] = mapState.rotate;
    mapState.rotate = [((l + dLambda + 540) % 360) - 180, Math.max(-90, Math.min(90, p + dPhi))];
  }

  function onpointerdown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      drag = null;
      return;
    }
    const onPoint = (e.target as Element).closest('[data-point-handle]') !== null;
    drag = { mode: onPoint && mapState.pointEditable ? 'point' : 'maybe-click', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY };
    svg.setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    if (pinch.has(e.pointerId)) pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist > 0) mapState.zoomGlobe(d / pinchDist);
      pinchDist = d;
      return;
    }
    if (!drag) return;
    const d = drag;
    if (d.mode === 'maybe-click' && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.mode = 'rotate';
    const cx = e.clientX, cy = e.clientY;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (d.mode === 'point') {
        const ll = ctx.invert(toView(cx, cy));
        if (ll) mapState.userSetPoint(ll, 'map');
      } else if (d.mode === 'rotate') {
        const k = ((180 / (SIZE - 12)) * (SIZE / Math.max(1, clientWidth))) / mapState.globeZoom;
        rotateBy((cx - d.lastX) * k, -(cy - d.lastY) * k);
      }
      d.lastX = cx; d.lastY = cy;
    });
  }

  function onpointerup(e: PointerEvent) {
    pinch.delete(e.pointerId);
    if (pinch.size < 2) pinchDist = 0;
    if (pinch.size === 1) {
      // One finger remains after a pinch: hand off to rotation from where it currently is,
      // rather than leaving it dead or letting it fire a click-to-place on release.
      const pos = [...pinch.values()][0]!;
      drag = { mode: 'rotate', startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y };
      return;
    }
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
  }

  function onpointercancel(e: PointerEvent) {
    pinch.delete(e.pointerId);
    cancelAnimationFrame(frame);
    drag = null;
  }

  function onkeydown(e: KeyboardEvent) {
    const s = mapState.stepSize(e.shiftKey);
    const arrows: Record<string, [number, number]> = { ArrowUp: [s, 0], ArrowDown: [-s, 0], ArrowLeft: [0, -s], ArrowRight: [0, s] };
    const delta = arrows[e.key];
    if (delta) {
      e.preventDefault();
      if (mapState.pointEditable) mapState.nudge(delta[0], delta[1], 'map');
      else rotateBy(-delta[1] * turnStep(e.shiftKey), -delta[0] * turnStep(e.shiftKey));
      return;
    }
    if (e.key === '+' || e.key === '=') { mapState.zoomGlobe(1.5); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { mapState.zoomGlobe(1 / 1.5); e.preventDefault(); }
    else if (e.key === '0') { mapState.globeZoom = 1; e.preventDefault(); }
  }

  $effect(() => {
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      mapState.zoomGlobe(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  });

  // Keep the point in view when it moves off the visible side by keyboard, sliders or program.
  // Depends only on the point and its change source, never on mapState.rotate — otherwise this
  // would re-run (and snap the view back onto the point) on every manual drag/turn rotation.
  $effect(() => {
    const p = mapState.point;
    const change = mapState.lastChange;
    untrack(() => {
      if (!p || change === 'map') return;
      if (!makeGlobeCtx(SIZE, mapState.rotate, 1).isVisible(p)) mapState.centerGlobeOn(p);
    });
  });
</script>

<figure class="globe">
  <div class="frame" bind:clientWidth>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- keyboard-operable globe (spec §7): the SVG is a compound control (rotate/point/zoom), not static content -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- pointer/keyboard handlers drive globe rotation, point editing and zoom per spec §7 -->
    <svg
      bind:this={svg}
      viewBox="0 0 {SIZE} {SIZE}"
      role="group"
      aria-roledescription={t('map.view.globe')}
      aria-label={t('map.globe.label')}
      aria-describedby="{uid}-hint"
      tabindex="0"
      {onpointerdown} {onpointermove} {onpointerup} {onpointercancel} {onkeydown}
    >
      <defs><clipPath id="{uid}-clip"><rect width={SIZE} height={SIZE} /></clipPath></defs>
      <g clip-path="url(#{uid}-clip)"><Layers {ctx} idPrefix={uid} /></g>
    </svg>
  </div>
  <p id="{uid}-hint" class="visually-hidden">{t('map.globe.hint')}</p>
  <div class="toolbar">
    <div class="btn-group" role="group" aria-label={t('map.turnGroup')}>
      <button type="button" class="btn icon" onclick={() => rotateBy(turnStep(false), 0)} aria-label={t('map.turnWest')} title={t('map.turnWest')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button>
      <button type="button" class="btn icon" onclick={() => rotateBy(-turnStep(false), 0)} aria-label={t('map.turnEast')} title={t('map.turnEast')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      <button type="button" class="btn icon" onclick={() => rotateBy(0, -turnStep(false))} aria-label={t('map.turnNorth')} title={t('map.turnNorth')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
      <button type="button" class="btn icon" onclick={() => rotateBy(0, turnStep(false))} aria-label={t('map.turnSouth')} title={t('map.turnSouth')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg></button>
      <button type="button" class="btn icon zoom-start" onclick={() => mapState.zoomGlobe(1.5)} aria-label={t('map.globeZoomIn')} title={t('map.globeZoomIn')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
      <button type="button" class="btn icon" onclick={() => mapState.zoomGlobe(1 / 1.5)} aria-label={t('map.globeZoomOut')} title={t('map.globeZoomOut')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
    </div>
    {#if mapState.point}
      <button type="button" class="btn show-point" onclick={() => mapState.point && mapState.centerGlobeOn(mapState.point)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>
        {t('map.showPoint')}
      </button>
    {/if}
  </div>
</figure>

<style>
  .globe { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { max-width: min(100%, 70vh); margin-inline: auto; width: 100%; }
  svg { display: block; width: 100%; height: auto; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; overflow: visible; }
  svg:active { cursor: grabbing; }
  svg:focus-visible { outline: 3px solid var(--focus); border-radius: 50%; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-1); justify-content: center; }
  .toolbar .btn { padding: 0 var(--space-2); font-size: var(--step--1); gap: var(--space-1); }
  .toolbar .btn.icon { padding: 0; }
  .toolbar .zoom-start { border-left-width: 3px; border-left-style: double; }
  .show-point svg { width: 1.1rem; height: 1.1rem; }
  @media (max-width: 1439px) { .show-point svg { display: none; } }
  .toolbar svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
</style>
