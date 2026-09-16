import type { LatLon } from '../../geo/types';
import type { FailReason } from './fallback';
import type { TextureView } from './viewParams';

/** A failure with the reason the fallback chain (fallback.ts) needs to pick the next tier. */
export class RenderFailure extends Error {
  constructor(readonly reason: FailReason, message: string) {
    super(message);
    this.name = 'RenderFailure';
  }
}

export interface SunVector { x: number; y: number; z: number }

/** The point under the Sun as a unit vector in d3's cartesian frame (x = cosφ cosλ, y = cosφ sinλ, z = sinφ). */
export function sunVector(p: LatLon): SunVector {
  const la = (p.lat * Math.PI) / 180, lo = (p.lon * Math.PI) / 180;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.cos(la) * Math.sin(lo), z: Math.sin(la) };
}

export interface StyleTextures { day: ImageBitmap; region: ImageBitmap; night: ImageBitmap | null }

export interface DrawInputs {
  view: TextureView;
  /** 0…1: how much of the Central Europe detail tile to blend in (inverse.ts regionMix). */
  regionMix: number;
  /** Satellite with day and night: the Sun; null draws the day image everywhere. */
  night: SunVector | null;
  /** Globe: darken towards the rim. */
  limb: boolean;
  /** Globe, Satellite: an atmosphere glow just outside the rim. */
  glow: boolean;
  /** 'fast' lets the canvas path draw at reduced resolution while dragging (WebGL ignores it). */
  quality: 'full' | 'fast';
  /** Tests only: 1 writes the longitude, 2 the latitude, as 16-bit values in red (high byte) and green (low byte). */
  debug: 0 | 1 | 2;
}

export interface TextureRenderer {
  readonly tier: 'webgl' | 'canvas';
  readonly maxTextureSize: number;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  setTextures(t: StyleTextures): void;
  draw(input: DrawInputs): void;
  /** RGBA bytes of a rectangle of the drawing buffer, rows top to bottom (call right after draw). */
  readPixels(x: number, y: number, w: number, h: number): Uint8Array;
  bufferSize(): { width: number; height: number };
  loseContext?(restoreAfterMs: number | null): void;
  dispose(): void;
}
