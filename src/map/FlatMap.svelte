<script lang="ts">
  import { untrack } from 'svelte';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { ui } from '../app/presenter.svelte';
  import type { LatLon } from '../geo/types';
  import { CLIP_PAD, makeFlatCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { FLAT_MAX_ZOOM, mapState } from './mapState.svelte';
  import { clusterClick, type School } from './schools';
  import SchoolPopover from './SchoolPopover.svelte';
  import SchoolsToggle from './SchoolsToggle.svelte';
  import type { FlatPreset, FlatProjection } from './types';

  const W = 960, H = 480;
  const uid = `flat-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;
  let clientWidth = $state(W);
  // Map text, markers and hit areas grow with the interface (large text, big screens, presenter mode).
  const uiScale = $derived(ui.scale);
  const px = $derived((W / Math.max(1, clientWidth)) * uiScale);
  // The live view: pointer and keyboard maths, and the edge numbers.
  const ctx = $derived(makeFlatCtx(W, H, mapState.flat.center, mapState.flat.zoom, px, mapState.flatProjection));
  // For choosing a school from the list: how close to zoom in depends on how big the map is drawn.
  $effect(() => {
    mapState.viewPx.flat = px;
    return () => { mapState.viewPx.flat = null; };
  });

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

  // `cluster`: the key of the school count badge the press began on — a click on it zooms in on the group.
  type Drag = { mode: 'point' | 'pan' | 'maybe-click' | 'idle'; startX: number; startY: number; lastX: number; lastY: number; cluster?: string };
  let drag: Drag | null = null;
  let pinch = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  // The list of a count badge that zooming in cannot pull apart (see SchoolPopover.svelte), placed
  // at the press (in the figure's CSS px) within the map's frame. It closes when the view moves or the scene changes.
  let figure: HTMLElement;
  let popover = $state<{ members: School[]; x: number; y: number; bottom: number } | null>(null);
  function openPopover(clientX: number, clientY: number, members: School[]) {
    const r = figure.getBoundingClientRect();
    const map = figure.querySelector('.frame')!.getBoundingClientRect();
    popover = { members, x: clientX - r.left, y: clientY - r.top, bottom: map.bottom - r.top };
  }
  function closePopover(refocus: boolean) {
    popover = null;
    if (refocus) svg.focus();
  }
  $effect(() => {
    void [mapState.flat, mapState.flatProjection, mapState.sceneVersion, mapState.layers.schools];
    untrack(() => { popover = null; });
  });

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
    const cluster = (e.target as Element).closest('[data-school-cluster]')?.getAttribute('data-school-cluster') ?? undefined;
    drag = { mode: onPoint && mapState.pointEditable ? 'point' : 'maybe-click', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, cluster };
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
    const hit = drag?.mode === 'maybe-click' && drag.cluster ? clusterClick(ctx, drag.cluster, FLAT_MAX_ZOOM, mapState.chosenSchool, i18n.lang) : null;
    if (hit?.kind === 'list') {
      openPopover(e.clientX, e.clientY, hit.members);
    } else if (hit) {
      mapState.setFlatView(hit.center, hit.zoom);
    } else if (drag?.mode === 'maybe-click' && mapState.pointEditable) {
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

<figure class="flat" bind:this={figure}>
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
    <!-- The schools switch comes before the presets: on a phone's scrolling tool row it is in view without scrolling. -->
    <SchoolsToggle />
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
  {#if popover}<SchoolPopover members={popover.members} x={popover.x} y={popover.y} mapBottom={popover.bottom} onclose={closePopover} />{/if}
</figure>

<style>
  .flat { position: relative; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .frame { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--ocean); box-shadow: var(--shadow-2); }
  svg { display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
  svg:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .toolbar .btn { padding: 0 var(--space-3); font-size: var(--step--1); }
  .toolbar .btn.icon { padding: 0; }
  .toolbar svg { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
  .projection-group { margin-left: auto; }
  /* On a phone the tools are one row that scrolls sideways (every button stays in reach, none hidden),
     instead of three wrapped rows pushing the question or step text a screen lower. The fade at the
     right edge says there is more; the end padding lets the last button scroll clear of it. */
  @media (max-width: 599px) {
    .toolbar { flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; margin: -4px calc(-1 * var(--space-3)) 0; padding: 4px var(--space-8) 4px var(--space-3); scroll-padding-inline: var(--space-3);
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 var(--space-3), #000 calc(100% - var(--space-8)), transparent);
      mask-image: linear-gradient(90deg, transparent, #000 var(--space-3), #000 calc(100% - var(--space-8)), transparent); }
    .toolbar::-webkit-scrollbar { display: none; }
    .toolbar > :global(*) { flex: none; }
    .toolbar :global(.btn) { white-space: nowrap; }
    .projection-group { margin-left: 0; flex-wrap: nowrap; }
  }
</style>
