<script lang="ts">
  import { testFlag } from '../../app/testMode';
  import type { ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  import { isTextureStyle, type TextureStyle } from '../mapStyle';
  import { REGION, REGION_MIN_ZOOM } from '../world';
  import { loadStyleTextures } from './assets';
  import { markReady, renderHealth, reportHealth } from './health.svelte';
  import { regionMix } from './inverse';
  import { RenderFailure, type DrawInputs, type TextureRenderer } from './renderer';
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
  let draws = 0;
  let lastInput: DrawInputs | null = null;

  const style = $derived(mapState.mapStyle);
  const tier = $derived(renderHealth.state.tier);
  const active = $derived(isTextureStyle(style) && tier === 'webgl');

  function fail(e: unknown): void {
    console.warn(`map texture (${view}):`, e);
    // Nothing is drawing this style any more, so the SVG layers go back to Atlas (the owner's "any error falls back to
    // the existing rendering") until the next tier has uploaded its own textures and marked the style ready again.
    if (isTextureStyle(style)) renderHealth.ready[style] = false;
    reportHealth({ type: 'fail', reason: e instanceof RenderFailure ? e.reason : 'render' });
  }

  $effect(() => registerTextureView(view, { renderer: () => renderer, input: () => lastInput, ctx: () => ctx, drawCount: () => draws }));

  // 1. A renderer while a texture style is active.
  $effect(() => {
    const c = canvas;
    if (!c || !active) return;
    let r: TextureRenderer;
    try { r = createWebGLRenderer(c, testFlag('gl')); } catch (e) { fail(e); return; }
    renderer = r;
    return () => { r.dispose(); renderer = null; loaded = null; };
  });

  // 2. The style's images (decoded once per page, shared by both views), no larger than the device allows.
  $effect(() => {
    const r = renderer, s = style, max = renderHealth.state.maxTexture;
    if (!r || !isTextureStyle(s)) return;
    if (r.maxTextureSize < max) { reportHealth({ type: 'fail', reason: 'texture-size' }); return; }
    let cancelled = false;
    renderHealth.loading = s;
    loadStyleTextures(s, max, false).then(
      (t) => { if (cancelled) return; try { r.setTextures(t); loaded = s; markReady(s); } catch (e) { fail(e); } },
      (e) => { if (!cancelled) fail(e); },
    ).finally(() => { if (renderHealth.loading === s) renderHealth.loading = null; });
    return () => { cancelled = true; };
  });

  // 3. Draw whenever the view, the style or the size changes, at most once a frame.
  $effect(() => {
    const r = renderer;
    if (!r || loaded !== style || !isTextureStyle(style)) return;
    const v = textureView(ctx);
    const input: DrawInputs = { view: v, regionMix: regionMix(v, REGION, REGION_MIN_ZOOM), night: null, limb: v.projection === 3, glow: style === 'satellite' && v.projection === 3, quality: 'full', debug: 0 };
    const w = cssWidth, h = cssHeight;
    const frame = requestAnimationFrame(() => {
      try { r.resize(w, h, devicePixelRatio); r.draw(input); lastInput = input; draws++; } catch (e) { fail(e); }
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

{#if isTextureStyle(style) && tier !== 'atlas'}
  <canvas class="texture" class:ready={loaded === style} bind:this={canvas} bind:clientWidth={cssWidth} bind:clientHeight={cssHeight} data-tier={tier} aria-hidden="true"></canvas>
{/if}

<style>
  .texture { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; opacity: 0; }
  .texture.ready { opacity: 1; }
</style>
