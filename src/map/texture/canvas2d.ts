import { fitWithin } from './assets';
import { shadePixel, type CpuTextures, type Sampled } from './cpuShade';
import { RenderFailure, type DrawInputs, type StyleTextures, type TextureRenderer } from './renderer';

/** Pixels of an image, at most `max` wide (the CPU path samples 2048 px textures). */
function sampled(bmp: ImageBitmap, max: number): Sampled {
  const { width, height } = fitWithin(bmp.width, bmp.height, max);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new RenderFailure('no-canvas', 'no 2D context for texture pixels');
  try {
    g.drawImage(bmp, 0, 0, width, height);
    return { width, height, data: g.getImageData(0, 0, width, height).data };
  } catch (e) {
    throw new RenderFailure('oom', `texture pixels: ${(e as Error).message}`);
  }
}

/** Map styles spec §4 "Canvas 2D fallback: same math on the CPU; reduced resolution while dragging or zooming, full resolution on release". `forced`: the `?test&canvas=` switch ('off', 'render-fail'). */
export function createCanvasRenderer(canvas: HTMLCanvasElement, forced: string | null): TextureRenderer {
  if (forced === 'off') throw new RenderFailure('no-canvas', 'canvas switched off for a test');
  const g = canvas.getContext('2d');
  if (!g) throw new RenderFailure('no-canvas', 'no 2D canvas context');
  const scratch = document.createElement('canvas');
  let tex: CpuTextures | null = null;
  let failNextDraw = forced === 'render-fail';
  return {
    tier: 'canvas',
    maxTextureSize: 2048,
    resize(cssWidth, cssHeight) {
      // One canvas pixel per CSS pixel: the CPU cost grows with the pixel count.
      const w = Math.max(1, Math.round(cssWidth)), h = Math.max(1, Math.round(cssHeight));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    },
    setTextures(t: StyleTextures) {
      tex = { day: sampled(t.day, 2048), region: sampled(t.region, 1440), night: t.night ? sampled(t.night, 2048) : null };
    },
    draw(input: DrawInputs) {
      if (!tex) return;
      if (failNextDraw) { failNextDraw = false; throw new RenderFailure('render', 'draw failure forced for a test'); }
      const scale = input.quality === 'fast' ? 0.25 : 1;
      const w = Math.max(1, Math.round(canvas.width * scale)), h = Math.max(1, Math.round(canvas.height * scale));
      const img = new ImageData(w, h);
      const v = input.view;
      // The shader's `uViewPx`: buffer pixels per view unit, at the resolution this frame is really shaded at (a
      // 'fast' frame is a quarter of it and is scaled up afterwards), so the globe's rim fades over one drawn pixel.
      const viewPx = w / v.width;
      for (let j = 0; j < h; j++) {
        const y = ((j + 0.5) * v.height) / h;
        for (let i = 0; i < w; i++) shadePixel(input, tex, ((i + 0.5) * v.width) / w, y, img.data, (j * w + i) * 4, viewPx);
      }
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (scale === 1) { g.putImageData(img, 0, 0); return; }
      scratch.width = w; scratch.height = h;
      scratch.getContext('2d')!.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    },
    readPixels: (x, y, w, h) => new Uint8Array(g.getImageData(x, y, w, h).data.buffer),
    bufferSize: () => ({ width: canvas.width, height: canvas.height }),
    dispose() { tex = null; },
  };
}
