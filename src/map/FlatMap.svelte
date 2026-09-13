<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { settings } from '../app/settings.svelte';
  import { makeFlatCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { mapState } from './mapState.svelte';
  import type { FlatPreset, FlatProjection } from './types';

  const W = 960, H = 480;
  const uid = `flat-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(W);
  const uiScale = $derived(settings.largeText ? 1.25 : 1);
  const ctx = $derived(
    makeFlatCtx(W, H, mapState.flat.center, mapState.flat.zoom, (W / Math.max(1, clientWidth)) * uiScale, mapState.flatProjection),
  );

  type Drag = { mode: 'point' | 'pan' | 'maybe-click' | 'idle'; startX: number; startY: number; lastX: number; lastY: number };
  let drag: Drag | null = null;
  let pinch = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  function toView(clientX: number, clientY: number): [number, number] {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
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
      if (pinchDist > 0) mapState.zoomFlat(d / pinchDist);
      pinchDist = d;
      return;
    }
    if (!drag) return;
    if (drag.mode === 'point') {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    } else {
      if (drag.mode === 'maybe-click' && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6 && mapState.flat.zoom > 1) drag.mode = 'pan';
      if (drag.mode === 'pan') {
        const [x0, y0] = toView(drag.lastX, drag.lastY);
        const [x1, y1] = toView(e.clientX, e.clientY);
        const dpu = 360 / (W * mapState.flat.zoom);
        mapState.panFlat((y1 - y0) * dpu, -(x1 - x0) * dpu);
      }
    }
    drag.lastX = e.clientX; drag.lastY = e.clientY;
  }

  function onpointerup(e: PointerEvent) {
    pinch.delete(e.pointerId);
    if (pinch.size < 2) pinchDist = 0;
    if (pinch.size === 1) {
      // One finger remains after a pinch: hand off to a pan (or stay inert at zoom 1) from where it
      // currently is, rather than leaving it dead or letting it fire a click-to-place on release.
      const pos = [...pinch.values()][0]!;
      drag = { mode: mapState.flat.zoom > 1 ? 'pan' : 'idle', startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y };
      return;
    }
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
  }

  function onpointercancel(e: PointerEvent) { pinch.delete(e.pointerId); drag = null; }

  function onkeydown(e: KeyboardEvent) {
    const big = e.shiftKey;
    const dirs: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const dir = dirs[e.key];
    if (dir) {
      if (mapState.pointEditable) {
        const s = mapState.stepSize(big);
        mapState.nudge(dir[0] * s, dir[1] * s, 'map');
        e.preventDefault();
      } else if (mapState.flat.zoom > 1) {
        // Panning has no notion of coordinate precision, so the step is a fraction of the
        // currently visible span (independent of `stepSize`, which is degree/minute-based
        // and would be ~0.03° under 'minute' precision — effectively no movement at all).
        const mult = big ? 3 : 1;
        const latStep = (180 / mapState.flat.zoom) * 0.1 * mult;
        const lonStep = (360 / mapState.flat.zoom) * 0.1 * mult;
        mapState.panFlat(dir[0] * latStep, dir[1] * lonStep);
        e.preventDefault();
      }
      return;
    }
    if (e.key === '+' || e.key === '=') { mapState.zoomFlat(1.5); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { mapState.zoomFlat(1 / 1.5); e.preventDefault(); }
    else if (e.key === '0') { mapState.setFlatPreset('world'); e.preventDefault(); }
  }

  $effect(() => {
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      mapState.zoomFlat(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  });

  const PRESETS: FlatPreset[] = ['world', 'europe', 'poland'];
  const PROJECTIONS: FlatProjection[] = ['grid', 'equal-earth'];
</script>

<figure class="flat">
  <div class="frame" bind:clientWidth>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- keyboard-operable map (spec §7): the SVG is a compound control (pan/zoom/point), not static content -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- pointer/keyboard handlers drive map pan/zoom/point editing per spec §7 -->
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      role="group"
      aria-roledescription={t('map.view.flat')}
      aria-label={t('map.flat.label')}
      aria-describedby="{uid}-hint"
      tabindex="0"
      style:touch-action={mapState.flat.zoom > 1 ? 'none' : 'pan-y'}
      {onpointerdown} {onpointermove} {onpointerup} {onpointercancel} {onkeydown}
    >
      <defs><clipPath id="{uid}-clip"><rect width={W} height={H} /></clipPath></defs>
      <g clip-path="url(#{uid}-clip)"><Layers {ctx} idPrefix={uid} /></g>
    </svg>
  </div>
  <p id="{uid}-hint" class="visually-hidden">{t('map.flat.hint')}</p>
  <div class="toolbar">
    <div class="btn-group" role="group" aria-label={t('map.zoomGroup')}>
      <button type="button" class="btn icon" onclick={() => mapState.zoomFlat(1.5)} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" class="btn icon" onclick={() => mapState.zoomFlat(1 / 1.5)} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
    </div>
    <div class="btn-group" role="group" aria-label={t('map.presetGroup')}>
      {#each PRESETS as p (p)}
        <button type="button" class="btn" onclick={() => mapState.setFlatPreset(p)}>{t(`map.preset.${p}`)}</button>
      {/each}
    </div>
    {#if mapState.projectionOverride === null}
      <div class="projection-group seg" role="group" aria-label={t('map.projection')} aria-describedby="{uid}-projection-hint">
        {#each PROJECTIONS as proj (proj)}
          <button
            type="button"
            class="btn"
            aria-pressed={mapState.flatProjection === proj}
            title={t('map.projection.hint')}
            onclick={() => mapState.setProjectionPreference(proj)}
          >{t(`map.projection.${proj}`)}</button>
        {/each}
      </div>
      <p id="{uid}-projection-hint" class="visually-hidden">{t('map.projection.hint')}</p>
    {/if}
  </div>
</figure>

<style>
  .flat { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--ocean); box-shadow: var(--shadow-2); }
  svg { display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
  svg:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .toolbar .btn { padding: 0 var(--space-3); font-size: var(--step--1); }
  .toolbar .btn.icon { padding: 0; }
  .toolbar svg { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
  .projection-group { margin-left: auto; }
  @media (max-width: 599px) { .projection-group { margin-left: 0; } }
</style>
