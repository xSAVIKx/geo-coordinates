import { describe, expect, test } from 'vitest';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { REGION, REGION_MIN_ZOOM } from '../../src/map/world';
import { shadePixel, type Sampled } from '../../src/map/texture/cpuShade';
import { inverseProject, regionMix } from '../../src/map/texture/inverse';
import { sunVector, type DrawInputs } from '../../src/map/texture/renderer';
import { textureView } from '../../src/map/texture/viewParams';

const solid = (w: number, h: number, f: (x: number, y: number) => [number, number, number]): Sampled => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = f(x, y); data.set([r, g, b, 255], (y * w + x) * 4); }
  return { width: w, height: h, data };
};
const px = (input: DrawInputs, t: Parameters<typeof shadePixel>[1], x: number, y: number, viewPx = 1) => { const out = new Uint8ClampedArray(4); shadePixel(input, t, x, y, out, 0, viewPx); return [...out]; };
const inputFor = (ctx: ReturnType<typeof makeFlatCtx>, extra: Partial<DrawInputs> = {}): DrawInputs => {
  const view = textureView(ctx);
  return { view, regionMix: regionMix(view, REGION, REGION_MIN_ZOOM), night: null, limb: false, glow: false, quality: 'full', debug: 0, ...extra };
};

describe('the canvas path shades pixels like the shader', () => {
  const westRedEastBlue = solid(64, 32, (x) => (x < 32 ? [255, 0, 0] : [0, 0, 255]));
  const black = solid(8, 4, () => [0, 0, 0]);
  const white = solid(8, 4, () => [255, 255, 255]);

  test('samples the world image where the pixel is (western hemisphere red, eastern blue)', () => {
    const input = inputFor(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid'));
    expect(px(input, { day: westRedEastBlue, region: black, night: null }, 240, 240)).toEqual([255, 0, 0, 255]);
    expect(px(input, { day: westRedEastBlue, region: black, night: null }, 720, 240)).toEqual([0, 0, 255, 255]);
  });

  test('blends the detail tile inside Central Europe from zoom 4, softly at its edge', () => {
    const t = { day: black, region: white, night: null };
    const inside = inputFor(makeFlatCtx(960, 480, { lat: 51, lon: 20 }, 9, 1, 'grid'));
    expect(px(inside, t, 480, 240)[0]).toBe(255);
    const low = inputFor(makeFlatCtx(960, 480, { lat: 51, lon: 20 }, 3.5, 1, 'grid'));
    expect(px(low, t, 480, 240)[0]).toBe(0);
    const ctx = makeFlatCtx(960, 480, { lat: 51, lon: 8 }, 40, 1, 'grid');
    const x = ctx.project({ lat: 51, lon: 8.1 })![0];
    const edge = px(inputFor(ctx), t, x, 240)[0]!;
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  test('outside the world is transparent; the Satellite globe glows just past its rim', () => {
    const t = { day: white, region: black, night: null };
    expect(px(inputFor(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'equal-earth')), t, 2, 2)).toEqual([0, 0, 0, 0]);
    const globe = makeGlobeCtx(500, [0, 0], 1, 1); // rim at radius 244
    const g = { ...inputFor(globe as never), limb: true, glow: true };
    expect(px(g, t, 250 + 246, 250)[3]).toBeGreaterThan(0);
    expect(px(g, t, 250 + 251, 250)[3]).toBe(0);
    const centre = px(g, t, 250, 250), nearRim = px(g, t, 250 - 240, 250);
    expect(centre[0]!).toBe(255);
    expect(nearRim[0]!).toBeLessThan(240); // limb shading: 0.78–1.0 of the colour
  });

  /*
   * The canvas-side half of the parity check tests/e2e/texture-webgl.spec.ts makes for the shader: a view point whose
   * longitude ran past ±180° is off the map (the shader's `ok` is false there), even though `inverseProject`, like
   * d3's own invert, wraps it round the antimeridian and still returns a point. Both tiers must leave those pixels
   * empty — no repeated world beside Equal Earth's oval, none beside a grid map panned over the antimeridian.
   */
  test('clips a wrapped longitude exactly where the shader does, on every flat projection', () => {
    const t = { day: white, region: black, night: null };
    let clipped = 0;
    for (const projection of ['grid', 'equal-earth', 'mercator'] as const) {
      for (const [centre, zoom] of [[{ lat: 0, lon: 0 }, 1], [{ lat: 50.26, lon: 19.02 }, 9], [{ lat: 60, lon: 170 }, 2.5]] as const) {
        const ctx = makeFlatCtx(960, 480, centre, zoom, 1, projection);
        const input = inputFor(ctx);
        for (let y = 7; y < 480; y += 23) for (let x = 5; x < 960; x += 29) {
          const ll = inverseProject(textureView(ctx), x, y);
          const back = ll && ctx.projection([(ll.lambda * 180) / Math.PI, (ll.phi * 180) / Math.PI]);
          const onMap = !!back && Math.abs(back[0] - x) < 0.5 && Math.abs(back[1] - y) < 0.5;
          if (ll && !onMap) clipped++;
          expect(px(input, t, x, y)[3]! > 0, `${projection} zoom ${zoom} at ${x},${y}`).toBe(onMap);
        }
      }
    }
    expect(clipped, 'points that inverseProject wrapped and the shader clips').toBeGreaterThan(100);
  });

  /*
   * The canvas tier's buffer is an ImageData, and `putImageData` reads it as *straight* alpha. Writing rgb·α into
   * it (what this function used to do) let the canvas multiply by α a second time, so the globe's rim and the
   * Satellite glow -- the only pixels here with α < 1 -- composited at rgb·α². The parity test above reads
   * interior pixels, where α is exactly 1, which is why it could not see this.
   */
  test('partly transparent pixels carry their full colour, not colour times alpha', () => {
    const t = { day: white, region: black, night: null };
    const globe = makeGlobeCtx(500, [0, 0], 1, 1); // rim at radius 244
    const g = { ...inputFor(globe as never), limb: false, glow: true };
    const glow = px(g, t, 250 + 246, 250);
    expect(glow[3]!, 'the glow is faint').toBeLessThan(100);
    expect(glow[0]!, 'but its blue is the full 0.45/0.70/1.00, not that times the alpha').toBeGreaterThan(100);
    expect(glow[2]).toBe(255);
    const rim = px(g, t, 250 + 243.7, 250);
    expect(rim[3]!, 'the rim pixel is half-covered').toBeGreaterThan(0);
    expect(rim[3]!).toBeLessThan(255);
    expect(rim[0], 'and still the white of the texture under it').toBe(255);
  });

  /*
   * The shader fades the globe's rim over one *drawing-buffer pixel* (`uScale * uViewPx`, shaders.ts); the CPU
   * copy used to leave `uViewPx` out, so at any resolution other than one buffer pixel per view unit its rim was
   * softer than the shader's. Twice the resolution, half the fade in view units.
   */
  test("the rim's fade follows the drawing resolution, like the shader's uViewPx", () => {
    const t = { day: white, region: black, night: null };
    const g = { ...inputFor(makeGlobeCtx(500, [0, 0], 1, 1) as never), limb: false, glow: false };
    const at1 = px(g, t, 250 + 243.7, 250)[3]!;
    const at2 = px(g, t, 250 + 243.7, 250, 2)[3]!;
    expect(at1).toBeGreaterThan(0);
    expect(at1).toBeLessThan(255);
    expect(at2, 'at twice the buffer resolution the same view point is further inside the rim').toBeGreaterThan(at1);
  });

  test('day and night blend across a twilight band from 0° to −6°', () => {
    const t = { day: white, region: black, night: black };
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid');
    const input = inputFor(ctx, { night: sunVector({ lat: 0, lon: 0 }) });
    const at = (lon: number) => px(input, t, ctx.project({ lat: 0, lon })![0], 240)[0]!;
    expect(at(0)).toBe(255);          // Sun overhead
    expect(at(89)).toBe(255);         // Sun 1° up
    expect(at(93)).toBeGreaterThan(0); // Sun 3° down: twilight
    expect(at(93)).toBeLessThan(255);
    expect(at(97)).toBe(0);           // Sun 7° down: night
  });
});
