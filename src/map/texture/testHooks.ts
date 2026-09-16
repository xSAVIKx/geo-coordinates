import type { ViewCtx } from '../geometry';
import { renderHealth } from './health.svelte';
import type { DrawInputs, TextureRenderer } from './renderer';

/*
 * window.__mapTextures in test mode (exposed by src/main.ts): the render tier, pixel probes of what a view's texture
 * layer draws, and the shader's own longitudes/latitudes for comparison with d3 (tests/e2e/texture-webgl.spec.ts).
 */
export interface TextureViewHandle { renderer(): TextureRenderer | null; input(): DrawInputs | null; ctx(): ViewCtx; drawCount(): number }
export interface ProbeResult { avg: [number, number, number]; maxSum: number }

const handles = new Map<'flat' | 'globe', TextureViewHandle>();

export function registerTextureView(view: 'flat' | 'globe', handle: TextureViewHandle): () => void {
  handles.set(view, handle);
  return () => { if (handles.get(view) === handle) handles.delete(view); };
}

function ready(view: 'flat' | 'globe') {
  const h = handles.get(view);
  const r = h?.renderer(), input = h?.input();
  return h && r && input ? { h, r, input } : null;
}

export const textureTestHooks = {
  tier: () => renderHealth.state.tier,
  health: () => JSON.parse(JSON.stringify({ ...renderHealth.state, ready: renderHealth.ready })) as unknown,
  drawCount: (view: 'flat' | 'globe') => handles.get(view)?.drawCount() ?? 0,
  /** Mean colour and brightest pixel (r+g+b) within `radius` CSS px of a place, as drawn by the texture layer. */
  probe(view: 'flat' | 'globe', lat: number, lon: number, radius = 2): ProbeResult | null {
    const s = ready(view);
    const xy = s?.h.ctx().project({ lat, lon });
    if (!s || !xy) return null;
    s.r.draw(s.input);
    const { width, height } = s.r.bufferSize();
    const kx = width / s.input.view.width, ky = height / s.input.view.height;
    const rad = Math.max(1, Math.round(radius * (width / (s.input.view.width / s.h.ctx().px))));
    const x0 = Math.max(0, Math.round(xy[0] * kx) - rad), y0 = Math.max(0, Math.round(xy[1] * ky) - rad);
    const w = Math.min(width - x0, 2 * rad + 1), h = Math.min(height - y0, 2 * rad + 1);
    const px = s.r.readPixels(x0, y0, w, h);
    const sum: [number, number, number] = [0, 0, 0];
    let n = 0, maxSum = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      sum[0] += px[i]!; sum[1] += px[i + 1]!; sum[2] += px[i + 2]!; n++;
      maxSum = Math.max(maxSum, px[i]! + px[i + 1]! + px[i + 2]!);
    }
    return n ? { avg: [sum[0] / n, sum[1] / n, sum[2] / n], maxSum } : null;
  },
  /** For view points (view units): the drawing-buffer pixel each falls in, its centre in view units and the shader's lon/lat there. */
  debugCoords(view: 'flat' | 'globe', points: [number, number][]) {
    const s = ready(view);
    if (!s || s.r.tier !== 'webgl') return [];
    const { width, height } = s.r.bufferSize();
    const read = (debug: 1 | 2) => {
      s.r.draw({ ...s.input, debug });
      return points.map(([x, y]) => {
        const i = Math.min(width - 1, Math.floor((x * width) / s.input.view.width)), j = Math.min(height - 1, Math.floor((y * height) / s.input.view.height));
        const p = s.r.readPixels(i, j, 1, 1);
        return { i, j, alpha: p[3]!, value: (p[0]! * 256 + p[1]!) / 65535 };
      });
    };
    const lon = read(1), lat = read(2);
    s.r.draw(s.input);
    return lon.map((a, k) => a.alpha === 0 ? null : {
      x: ((a.i + 0.5) * s.input.view.width) / width, y: ((a.j + 0.5) * s.input.view.height) / height,
      lon: a.value * 360 - 180, lat: lat[k]!.value * 180 - 90,
    });
  },
  loseContext(view: 'flat' | 'globe', restoreAfterMs: number | null) {
    handles.get(view)?.renderer()?.loseContext?.(restoreAfterMs);
  },
};
