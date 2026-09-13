<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { settings } from '../app/settings.svelte';
  import { makeFlatCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { mapState } from './mapState.svelte';
  import type { FlatPreset } from './types';

  const W = 960, H = 480;
  const uid = `flat-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(W);
  const uiScale = $derived(settings.largeText ? 1.25 : 1);
  const ctx = $derived(makeFlatCtx(W, H, mapState.flat.center, mapState.flat.zoom, (W / Math.max(1, clientWidth)) * uiScale));

  type Drag = { mode: 'point' | 'pan' | 'maybe-click'; startX: number; startY: number; lastX: number; lastY: number };
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
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
  }

  function onpointercancel(e: PointerEvent) { pinch.delete(e.pointerId); drag = null; }

  function onkeydown(e: KeyboardEvent) {
    const big = e.shiftKey;
    const s = mapState.stepSize(big);
    const arrows: Record<string, [number, number]> = { ArrowUp: [s, 0], ArrowDown: [-s, 0], ArrowLeft: [0, -s], ArrowRight: [0, s] };
    const delta = arrows[e.key];
    if (delta) {
      if (mapState.pointEditable) mapState.nudge(delta[0], delta[1], 'map');
      else if (mapState.flat.zoom > 1) mapState.panFlat(delta[0] * 2, delta[1] * 2);
      else return;
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') { mapState.zoomFlat(1.5); e.preventDefault(); }
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
  <div class="toolbar" role="toolbar" aria-label={t('map.view.flat')}>
    <button type="button" onclick={() => mapState.zoomFlat(1.5)} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>＋</button>
    <button type="button" onclick={() => mapState.zoomFlat(1 / 1.5)} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>−</button>
    {#each PRESETS as p (p)}
      <button type="button" onclick={() => mapState.setFlatPreset(p)}>{t(`map.preset.${p}`)}</button>
    {/each}
  </div>
</figure>

<style>
  .flat { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--ocean); }
  svg { display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
  svg:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .toolbar button { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-3); font-weight: 600; }
</style>
