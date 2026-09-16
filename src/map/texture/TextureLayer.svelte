<script lang="ts">
  import { flushSync } from 'svelte';
  import { testFlag } from '../../app/testMode';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { isTextureStyle, type TextureStyle } from '../mapStyle';
  import { REGION, REGION_MIN_ZOOM } from '../world';
  import { loadStyleTextures } from './assets';
  import { createCanvasRenderer } from './canvas2d';
  import { markReady, renderHealth, reportHealth } from './health.svelte';
  import { regionMix } from './inverse';
  import { RenderFailure, sunVector, type DrawInputs, type TextureRenderer } from './renderer';
  import { registerTextureView } from './testHooks';
  import { textureView } from './viewParams';
  import { createWebGLRenderer } from './webgl';

  // Physical and Satellite under the SVG of an interactive flat map or globe (Map styles spec §4). Only the shared
  // `mapState` (never a worksheet's StaticMap): paper stays Atlas.
  let { ctx, view }: { ctx: ViewCtx; view: 'flat' | 'globe' } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let cssWidth = $state(0);
  let cssHeight = $state(0);
  let renderer = $state.raw<TextureRenderer | null>(null);
  let loaded = $state<TextureStyle | null>(null);
  /** Whether the textures the renderer holds include the night image (it is decoded only when a scene needs it). */
  let loadedNight = $state(false);
  /** Bumped when a restored WebGL context needs a renderer built on it again. */
  let rebuild = $state(0);
  /** A PNG of the last frame, shown in place of the canvas while the page prints (spec §4 Print). */
  let printSrc = $state<string | null>(null);
  let draws = 0;
  let lastChange = 0;
  let lastInput: DrawInputs | null = null;
  // The view the last frame was drawn from: what a test probe has to project through to hit the pixels on screen.
  let lastCtx: ViewCtx | null = null;

  const style = $derived(mapState.mapStyle);
  const tier = $derived(renderHealth.state.tier);
  const active = $derived(isTextureStyle(style) && tier !== 'atlas');

  // Spec §4: city lights on the night side wherever `daylight` is on. Satellite draws its own day and night from the
  // two NASA images (Daylight.svelte leaves the SVG shading out in this style); every other style, and any scene
  // without a Sun, keeps the day image everywhere.
  const nightSun = $derived.by(() => {
    if (style !== 'satellite' || !mapState.layers.daylight) return null;
    const p = mapState.sunPoint();
    return p ? sunVector(p) : null;
  });
  const withNight = $derived(nightSun !== null);

  // Nothing is drawing this style any more, so the SVG layers go back to Atlas (the owner's "any error falls back to
  // the existing rendering") until a tier has uploaded its own textures and marked the style ready again.
  function unready(): void {
    if (isTextureStyle(style)) renderHealth.ready[style] = false;
  }

  function fail(e: unknown): void {
    console.warn(`map texture (${view}):`, e);
    unready();
    reportHealth({ type: 'fail', reason: e instanceof RenderFailure ? e.reason : 'render' });
  }

  $effect(() => registerTextureView(view, { renderer: () => renderer, input: () => lastInput, ctx: () => lastCtx ?? ctx, drawCount: () => draws }));

  // 1. A renderer for the current tier while a texture style is active. A lost context waits for its own canvas: a
  // canvas that has held a WebGL context can never give a 2D one, so the element itself is keyed on the tier.
  $effect(() => {
    const c = canvas, t = tier;
    void rebuild;
    if (!c || !active || renderHealth.state.waitingForRestore) return;
    let r: TextureRenderer;
    try { r = t === 'webgl' ? createWebGLRenderer(c, testFlag('gl')) : createCanvasRenderer(c, testFlag('canvas')); } catch (e) { fail(e); return; }
    renderer = r;
    return () => { r.dispose(); renderer = null; loaded = null; loadedNight = false; };
  });

  // 2. The style's images (decoded once per page, shared by both views), no larger than the device allows. The size
  // check is a WebGL one: the CPU path samples its own 2048 px copies whatever the GPU would have allowed.
  $effect(() => {
    const r = renderer, s = style;
    if (!r || !isTextureStyle(s)) return;
    const max = r.tier === 'webgl' ? renderHealth.state.maxTexture : 2048;
    if (r.tier === 'webgl' && r.maxTextureSize < max) { reportHealth({ type: 'fail', reason: 'texture-size' }); return; }
    let cancelled = false;
    renderHealth.loading = s;
    // Re-runs when a scene first asks for the night side: the day images come back from the decode cache, the Black
    // Marble is decoded once and added. The style stays `loaded` throughout, so the day picture never blinks.
    loadStyleTextures(s, max, withNight).then(
      (t) => { if (cancelled) return; try { r.setTextures(t); loaded = s; loadedNight = t.night !== null; markReady(s); } catch (e) { fail(e); } },
      (e) => { if (!cancelled) fail(e); },
    ).finally(() => { if (renderHealth.loading === s) renderHealth.loading = null; });
    return () => { cancelled = true; };
  });

  /**
   * The newest frame waiting to be painted and the one animation-frame request that will paint it.
   *
   * A pending request is never cancelled and replaced, only re-aimed: a view that changes inside an animation frame
   * of its own (the lab spinning the Earth moves the Sun, and the globe's rotation, every frame) would otherwise
   * cancel its own request each time before the browser ever reached it, and the layer would never paint again while
   * the animation ran — the city lights and the globe's image would stand still under a turning grid.
   */
  let queued: { input: DrawInputs; w: number; h: number; ctx: ViewCtx } | null = null;
  let frame = 0;

  function paintQueued(): void {
    frame = 0;
    const q = queued, r = renderer;
    queued = null;
    // Before the canvas has been laid out its size is 0: drawing then would leave a 1 x 1 buffer and count as a
    // frame (tests wait for the count), so wait for the layout instead.
    if (!q || !r || !q.w || !q.h) return;
    try { r.resize(q.w, q.h, devicePixelRatio); r.draw(q.input); lastInput = q.input; lastCtx = q.ctx; draws++; } catch (e) { fail(e); }
  }

  function queue(input: DrawInputs, w: number, h: number, c: ViewCtx): void {
    queued = { input, w, h, ctx: c };
    if (!frame) frame = requestAnimationFrame(paintQueued);
  }

  // 3. Draw whenever the view, the style, the Sun or the size changes, at most once a frame. The canvas tier shades
  // every pixel on the CPU, so a change that follows hard on the last one draws at a quarter of the resolution and a
  // full-resolution frame follows once the view has settled (spec §4 "reduced resolution while dragging or zooming").
  $effect(() => {
    const r = renderer;
    if (!r || loaded !== style || !isTextureStyle(style)) { queued = null; return; }
    const v = textureView(ctx);
    const base: DrawInputs = { view: v, regionMix: regionMix(v, REGION, REGION_MIN_ZOOM), night: nightSun && loadedNight ? nightSun : null, limb: v.projection === 3, glow: style === 'satellite' && v.projection === 3, quality: 'full', debug: 0 };
    const w = cssWidth, h = cssHeight;
    const c = ctx;
    const now = performance.now();
    const moving = r.tier === 'canvas' && now - lastChange < 200;
    lastChange = now;
    queue(moving ? { ...base, quality: 'fast' } : base, w, h, c);
    const settle = moving ? setTimeout(() => queue(base, w, h, c), 220) : undefined;
    return () => clearTimeout(settle);
  });

  // 4. A lost WebGL context: Atlas while the browser tries to give the context back, and the next tier down if it
  // does not come back in time (spec §4 fallback chain).
  $effect(() => {
    const c = canvas;
    if (!c || tier !== 'webgl') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lost = (e: Event) => {
      e.preventDefault(); // allows the browser to restore the context
      renderer = null; loaded = null;
      unready();
      reportHealth({ type: 'context-lost' });
      timer = setTimeout(() => reportHealth({ type: 'restore-timeout' }), Number(testFlag('glRestoreMs')) || 3000);
    };
    const restored = () => { clearTimeout(timer); reportHealth({ type: 'context-restored' }); rebuild++; };
    c.addEventListener('webglcontextlost', lost);
    c.addEventListener('webglcontextrestored', restored);
    return () => { clearTimeout(timer); c.removeEventListener('webglcontextlost', lost); c.removeEventListener('webglcontextrestored', restored); };
  });

  // 5. Printing (spec §4 Print): a canvas is not always printed, so the page prints a PNG of the same frame instead.
  $effect(() => {
    const before = () => {
      const r = renderer;
      if (!r || !lastInput || !canvas) return;
      // Full resolution even if the last frame on screen was a moving one, and the canvas stays on paper if the
      // snapshot cannot be taken: a printed canvas is better than an empty frame.
      try { r.draw({ ...lastInput, quality: 'full' }); printSrc = canvas.toDataURL('image/png'); } catch { printSrc = null; }
      flushSync();
    };
    const after = () => { printSrc = null; };
    addEventListener('beforeprint', before);
    addEventListener('afterprint', after);
    return () => { removeEventListener('beforeprint', before); removeEventListener('afterprint', after); };
  });
</script>

{#if active}
  {#key tier}
    <canvas class="texture" class:ready={loaded === style} class:snapshot={printSrc !== null} bind:this={canvas} bind:clientWidth={cssWidth} bind:clientHeight={cssHeight} data-tier={tier} aria-hidden="true"></canvas>
  {/key}
  {#if printSrc}<img class="print-snapshot" src={printSrc} alt="" />{/if}
{/if}

<style>
  .texture { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; opacity: 0; }
  .texture.ready { opacity: 1; }
  .print-snapshot { display: none; }
  @media print {
    .texture.snapshot { display: none; }
    .print-snapshot { display: block; position: absolute; inset: 0; width: 100%; height: 100%; }
  }
</style>
