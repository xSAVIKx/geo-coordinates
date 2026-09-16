import { boundsIntersect, type GeoBounds } from '../geometry';
import type { TextureView } from './viewParams';

// d3-geo's Equal Earth constants (node_modules/d3-geo/src/projection/equalEarth.js).
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
const EPS = 1e-6;

export interface Inverse { lambda: number; phi: number; rho: number }

/**
 * The longitude and latitude (radians) under view point (x, y), or null off the map. The same arithmetic as the
 * fragment shader (src/map/texture/shaders.ts), used by the canvas fallback and by the tests against d3.
 */
export function inverseProject(v: TextureView, x: number, y: number): Inverse | null {
  const X = (x - v.origin[0]) / v.scale;
  const Y = (v.origin[1] - y) / v.scale;
  if (v.projection === 3) {
    const r2 = X * X + Y * Y;
    if (r2 > 1) return null;
    // Back through d3's rotation: the visible hemisphere in the rotated frame (x towards the viewer, y right, z up).
    const xr = Math.sqrt(1 - r2);
    const cp = Math.cos(v.rotate[1]), sp = Math.sin(v.rotate[1]);
    const cx = xr * cp + Y * sp;
    const cy = X;
    const cz = Y * cp - xr * sp;
    let lambda = Math.atan2(cy, cx) - v.rotate[0];
    lambda = ((((lambda + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return { lambda, phi: Math.asin(Math.max(-1, Math.min(1, cz))), rho: Math.sqrt(r2) };
  }
  let lambda: number, phi: number;
  if (v.projection === 0) {
    lambda = X; phi = Y;
  } else if (v.projection === 2) {
    lambda = X; phi = 2 * Math.atan(Math.exp(Y)) - Math.PI / 2;
  } else {
    let l = Y;
    for (let i = 0; i < 12; i++) {
      const l2 = l * l, l6 = l2 * l2 * l2;
      l -= (l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - Y) / (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2));
    }
    const l2 = l * l, l6 = l2 * l2 * l2;
    const s = Math.sin(l) / M;
    if (Math.abs(s) > 1) return null;
    lambda = (M * X * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))) / Math.cos(l);
    phi = Math.asin(s);
  }
  if (!Number.isFinite(lambda)) return null;
  // d3's generic invert un-rotates with an identity rotation that still wraps longitude into (-pi, pi] (see
  // d3-geo's rotationIdentity): a grid or Equal Earth view that crosses the antimeridian wraps, it does not clip.
  const TAU = 2 * Math.PI;
  if (Math.abs(lambda) > Math.PI) lambda -= Math.round(lambda / TAU) * TAU;
  if (Math.abs(phi) > v.maxLat + EPS) return null;
  if (v.projection === 2) {
    // Mercator's world is narrower than the view once zoomed out past its own min zoom (see geometry.ts's
    // ViewCtx.invert): the same wrap can land on a longitude whose own pixel is elsewhere. Only a point that
    // forward-projects back to where it came from is really on the map.
    const back = v.origin[0] + v.scale * lambda;
    if (Math.abs(back - x) > 0.01) return null;
  }
  return { lambda, phi, rho: 0 };
}

/** How much of the Central Europe detail tile to blend in: 0 below `minZoom` or away from the region, 1 from one zoom level above. */
export function regionMix(v: TextureView, region: GeoBounds, minZoom: number): number {
  if (!boundsIntersect(v.bounds, region)) return 0;
  return Math.max(0, Math.min(1, v.zoom - minZoom));
}
