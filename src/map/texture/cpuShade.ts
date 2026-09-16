import { RAD } from '../geometry';
import { REGION } from '../world';
import { inverseProject } from './inverse';
import type { DrawInputs } from './renderer';
import type { TextureView } from './viewParams';

/*
 * The fragment shader's `main` (src/map/texture/shaders.ts), on the CPU: the Canvas 2D tier of the fallback chain
 * draws exactly the same picture, only at fewer pixels. Keep this function and FRAGMENT_SHADER in step: any change
 * to one is made to the other in the same commit (tests/e2e/texture-fallback.spec.ts compares the two tiers).
 */

export interface Sampled { width: number; height: number; data: Uint8ClampedArray }
export interface CpuTextures { day: Sampled; region: Sampled; night: Sampled | null }

const W = REGION.west * RAD, S = REGION.south * RAD, E = REGION.east * RAD, N = REGION.north * RAD;
const FEATHER = 0.25 * RAD;
// d3-geo's Equal Earth constants, the same ones inverse.ts and the shader carry.
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

/**
 * Whether a flat view point ran past ±180° of longitude. `inverseProject` wraps such a longitude back into range,
 * because d3's own `invert` does and the unit tests check it against d3; the shader instead clips there
 * (`abs(ll.x) > PI + EPS` makes `ok` false), so that Equal Earth does not paint a repeated world beside its oval and
 * a grid map panned over the antimeridian does not show the world twice. The canvas tier has to clip the same way,
 * and a wrapped longitude is exactly one that forward-projects a whole world away from the pixel it came from.
 */
function wrappedPastAntimeridian(v: TextureView, lambda: number, phi: number, x: number): boolean {
  if (v.projection === 3) return false;
  // grid and Mercator: x = scale * lambda. Equal Earth scales it by a factor that, like the inverse's own Newton
  // solve, depends only on the latitude — constant along a row of the canvas — so it is remembered the same way.
  const sx = v.projection === 1 ? lambda * equalEarthScale(phi) : lambda;
  return Math.abs(v.origin[0] + v.scale * sx - x) > 0.01;
}

/** d3's Equal Earth forward x, per unit of longitude, at latitude `phi`. One row's worth is remembered at a time. */
const fwd = { phi: NaN, scale: 0 };
function equalEarthScale(phi: number): number {
  if (phi !== fwd.phi) {
    const l = Math.asin(clamp1(M * Math.sin(phi)));
    const l2 = l * l, l6 = l2 * l2 * l2;
    fwd.phi = phi;
    fwd.scale = Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  }
  return fwd.scale;
}

/** Bilinear sample at texture coordinates (u, v) ∈ [0, 1]², wrapping u when `wrap`, into rgb[0..2]. */
function sample(s: Sampled, u: number, v: number, wrap: boolean, rgb: Float64Array): void {
  const fx = u * s.width - 0.5, fy = Math.max(0, Math.min(s.height - 1, v * s.height - 0.5));
  let x0 = Math.floor(fx);
  const y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let x1 = x0 + 1;
  const y1 = Math.min(s.height - 1, y0 + 1);
  if (wrap) { x0 = ((x0 % s.width) + s.width) % s.width; x1 = ((x1 % s.width) + s.width) % s.width; }
  else { x0 = Math.max(0, Math.min(s.width - 1, x0)); x1 = Math.max(0, Math.min(s.width - 1, x1)); }
  for (let c = 0; c < 3; c++) {
    const a = s.data[(y0 * s.width + x0) * 4 + c]!, b = s.data[(y0 * s.width + x1) * 4 + c]!;
    const d = s.data[(y1 * s.width + x0) * 4 + c]!, e = s.data[(y1 * s.width + x1) * 4 + c]!;
    rgb[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }
}

const day = new Float64Array(3), other = new Float64Array(3);

/** Premultiplied RGBA of one view point into out[at..at+3]. (x, y) are view units, the same frame the SVG draws in. */
export function shadePixel(input: DrawInputs, t: CpuTextures, x: number, y: number, out: Uint8ClampedArray, at: number): void {
  const v = input.view;
  const inv = inverseProject(v, x, y);
  if (!inv || wrappedPastAntimeridian(v, inv.lambda, inv.phi, x)) {
    let a = 0;
    if (v.projection === 3 && input.glow) {
      const rho = Math.hypot(x - v.origin[0], y - v.origin[1]) / v.scale;
      const k = Math.max(0, Math.min(1, 1 - ((rho - 1) * v.scale) / 6)); // 6 view units wide
      a = 0.55 * k * k;
    }
    out[at] = 0.45 * a * 255; out[at + 1] = 0.7 * a * 255; out[at + 2] = a * 255; out[at + 3] = a * 255;
    return;
  }
  const { lambda, phi, rho } = inv;
  const u = lambda / (2 * Math.PI) + 0.5, vv = 0.5 - phi / Math.PI;
  sample(t.day, u, vv, true, day);
  if (input.regionMix > 0) {
    const edge = Math.min(lambda - W, E - lambda, phi - S, N - phi);
    const w = smooth(0, FEATHER, edge) * input.regionMix;
    if (w > 0) {
      sample(t.region, (lambda - W) / (E - W), (N - phi) / (N - S), false, other);
      for (let c = 0; c < 3; c++) day[c] = day[c]! * (1 - w) + other[c]! * w;
    }
  }
  if (input.night && t.night) {
    const s = input.night;
    const dot = Math.cos(phi) * Math.cos(lambda) * s.x + Math.cos(phi) * Math.sin(lambda) * s.y + Math.sin(phi) * s.z;
    const w = smooth(-6 * RAD, 0, Math.asin(clamp1(dot)));
    sample(t.night, u, vv, true, other);
    for (let c = 0; c < 3; c++) day[c] = Math.min(255, other[c]! * 1.15) * (1 - w) + day[c]! * w;
  }
  let alpha = 1;
  if (v.projection === 3) {
    if (input.limb) { const k = 0.78 + 0.22 * Math.pow(Math.sqrt(Math.max(0, 1 - rho * rho)), 0.35); for (let c = 0; c < 3; c++) day[c] = day[c]! * k; }
    alpha = Math.max(0, Math.min(1, (1 - rho) * v.scale + 0.5));
  }
  out[at] = day[0]! * alpha; out[at + 1] = day[1]! * alpha; out[at + 2] = day[2]! * alpha; out[at + 3] = alpha * 255;
}
