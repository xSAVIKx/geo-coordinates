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
  const ctx = $derived(makeGlobeCtx(SIZE, mapState.rotate, (SIZE / Math.max(1, clientWidth)) * uiScale));

  type Drag = { mode: 'point' | 'rotate' | 'maybe-click'; startX: number; startY: number; lastX: number; lastY: number };
  let drag: Drag | null = null;
  let frame = 0;

  function toView(clientX: number, clientY: number): [number, number] {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  }

  function rotateBy(dLambda: number, dPhi: number) {
    const [l, p] = mapState.rotate;
    mapState.rotate = [((l + dLambda + 540) % 360) - 180, Math.max(-90, Math.min(90, p + dPhi))];
  }

  function onpointerdown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const onPoint = (e.target as Element).closest('[data-point-handle]') !== null;
    drag = { mode: onPoint && mapState.pointEditable ? 'point' : 'maybe-click', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY };
    svg.setPointerCapture(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
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
        const k = (180 / (SIZE - 12)) * (SIZE / Math.max(1, clientWidth));
        rotateBy((cx - d.lastX) * k, -(cy - d.lastY) * k);
      }
      d.lastX = cx; d.lastY = cy;
    });
  }

  function onpointerup(e: PointerEvent) {
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
  }

  function onpointercancel() {
    cancelAnimationFrame(frame);
    drag = null;
  }

  function onkeydown(e: KeyboardEvent) {
    const s = mapState.stepSize(e.shiftKey);
    const arrows: Record<string, [number, number]> = { ArrowUp: [s, 0], ArrowDown: [-s, 0], ArrowLeft: [0, -s], ArrowRight: [0, s] };
    const delta = arrows[e.key];
    if (!delta) return;
    e.preventDefault();
    if (mapState.pointEditable) mapState.nudge(delta[0], delta[1], 'map');
    else rotateBy(-delta[1] * (e.shiftKey ? 3 : 15), -delta[0] * (e.shiftKey ? 3 : 15));
  }

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
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- keyboard-operable globe (spec §7): the SVG is a compound control (rotate/point), not static content -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -- pointer/keyboard handlers drive globe rotation and point editing per spec §7 -->
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
      <Layers {ctx} idPrefix={uid} />
    </svg>
  </div>
  <p id="{uid}-hint" class="visually-hidden">{t('map.globe.hint')}</p>
  <div class="toolbar" role="toolbar" aria-label={t('map.view.globe')}>
    <button type="button" onclick={() => rotateBy(15, 0)} aria-label={t('map.turnWest')} title={t('map.turnWest')}>←</button>
    <button type="button" onclick={() => rotateBy(-15, 0)} aria-label={t('map.turnEast')} title={t('map.turnEast')}>→</button>
    <button type="button" onclick={() => rotateBy(0, -15)} aria-label={t('map.turnNorth')} title={t('map.turnNorth')}>↑</button>
    <button type="button" onclick={() => rotateBy(0, 15)} aria-label={t('map.turnSouth')} title={t('map.turnSouth')}>↓</button>
    {#if mapState.point}
      <button type="button" onclick={() => mapState.point && mapState.centerGlobeOn(mapState.point)}>{t('map.showPoint')}</button>
    {/if}
  </div>
</figure>

<style>
  .globe { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { max-width: min(100%, 70vh); margin-inline: auto; width: 100%; }
  svg { display: block; width: 100%; height: auto; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
  svg:active { cursor: grabbing; }
  svg:focus-visible { outline: 3px solid var(--focus); border-radius: 50%; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
  .toolbar button { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-3); font-weight: 600; }
</style>
