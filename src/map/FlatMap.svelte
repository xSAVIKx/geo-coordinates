<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { settings } from '../app/settings.svelte';
  import type { LatLon } from '../geo/types';
  import { CLIP_PAD, makeFlatCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { mapState } from './mapState.svelte';
  import type { FlatPreset, FlatProjection } from './types';

  const W = 960, H = 480;
  const uid = `flat-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(W);
  const uiScale = $derived(settings.largeText ? 1.25 : 1);
  const px = $derived((W / Math.max(1, clientWidth)) * uiScale);
  // The live view: pointer and keyboard maths, and the edge numbers.
  const ctx = $derived(makeFlatCtx(W, H, mapState.flat.center, mapState.flat.zoom, px, mapState.flatProjection));

  // Cheap pans. d3's `center()` only shifts a projection (no rotation), so on every flat map a pan
  // just slides the picture: a drag draws the map once around where it began (with a wide pad) and
  // moves it with a translate; paths and labels are rebuilt only when the slide nears the pad's edge
  // and when the drag ends.
  const PAN_PAD = 360;
  let panBase = $state<{ center: LatLon; zoom: number; projection: typeof mapState.flatProjection } | null>(null);
  const base = $derived(panBase && panBase.zoom === mapState.flat.zoom && panBase.projection === mapState.flatProjection ? panBase : null);
  const drawCtx = $derived(base ? makeFlatCtx(W, H, base.center, base.zoom, px, base.projection, PAN_PAD) : ctx);
  const offset = $derived.by<[number, number] | null>(() => {
    if (!base) return null;
    const xy = ctx.projection([base.center.lon, base.center.lat]);
    return xy ? [xy[0] - W / 2, xy[1] - H / 2] : null;
  });
  const startPanBase = () => {
    panBase = { center: { ...mapState.flat.center }, zoom: mapState.flat.zoom, projection: mapState.flatProjection };
  };
  const endPanBase = () => { panBase = null; };

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
      endPanBase();
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
      if (drag.mode === 'maybe-click' && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6 && mapState.canPanFlat) {
        drag.mode = 'pan';
        startPanBase();
      }
      if (drag.mode === 'pan') {
        const [x0, y0] = toView(drag.lastX, drag.lastY);
        const [x1, y1] = toView(e.clientX, e.clientY);
        mapState.panFlatBy(x1 - x0, y1 - y0);
        const o = offset;
        if (o && Math.max(Math.abs(o[0]), Math.abs(o[1])) > PAN_PAD - CLIP_PAD - 8) startPanBase();
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
      drag = { mode: mapState.canPanFlat ? 'pan' : 'idle', startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y };
      if (drag.mode === 'pan') startPanBase();
      return;
    }
    if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
      const ll = ctx.invert(toView(e.clientX, e.clientY));
      if (ll) mapState.userSetPoint(ll, 'map');
    }
    drag = null;
    endPanBase();
  }

  function onpointercancel(e: PointerEvent) { pinch.delete(e.pointerId); drag = null; endPanBase(); }

  function onkeydown(e: KeyboardEvent) {
    const big = e.shiftKey;
    const dirs: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const dir = dirs[e.key];
    if (dir) {
      if (mapState.pointEditable) {
        const s = mapState.stepSize(big);
        mapState.nudge(dir[0] * s, dir[1] * s, 'map');
        e.preventDefault();
      } else if (mapState.canPanFlat) {
        // Panning has no notion of coordinate precision, so the step is a tenth of the view
        // (independent of `stepSize`, which is degree/minute-based and would be ~0.03° under
        // 'minute' precision — effectively no movement at all).
        const mult = big ? 3 : 1;
        mapState.panFlatBy(-dir[1] * W * 0.1 * mult, dir[0] * H * 0.1 * mult);
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
  const PROJECTIONS: FlatProjection[] = ['grid', 'equal-earth', 'mercator'];
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
      style:touch-action={mapState.canPanFlat ? 'none' : 'pan-y'}
      {onpointerdown} {onpointermove} {onpointerup} {onpointercancel} {onkeydown}
    >
      <defs><clipPath id="{uid}-clip"><rect width={W} height={H} /></clipPath></defs>
      <g clip-path="url(#{uid}-clip)"><Layers ctx={drawCtx} edgeCtx={ctx} {offset} idPrefix={uid} /></g>
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
    {#if mapState.projectionOverride === null || mapState.projectionSwitch}
      <div class="projection-group seg" role="group" aria-label={t('map.projection')} aria-describedby="{uid}-projection-hint">
        {#each PROJECTIONS as proj (proj)}
          <button
            type="button"
            class="btn"
            aria-pressed={mapState.flatProjection === proj}
            title={t('map.projection.hint')}
            onclick={() => mapState.chooseProjection(proj)}
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
  /* Three map types wrap on a phone: rows of evenly stretched buttons rather than a ragged group. */
  @media (max-width: 599px) { .projection-group { margin-left: 0; display: flex; width: 100%; } .projection-group .btn { flex: 1 1 auto; } }
</style>
