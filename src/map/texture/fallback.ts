import { isTextureStyle, type MapStyle, type TextureStyle } from '../mapStyle';

/*
 * Map styles spec §4 "Fallback chain (owner rule: any error → existing solution)": WebGL → Canvas 2D → Atlas. A pure
 * state machine, kept for the page session only (never saved). Planning ruling R3 fixes where each trigger goes.
 */
export type RenderTier = 'webgl' | 'canvas' | 'atlas';
export type FailReason = 'no-webgl' | 'shader' | 'texture-size' | 'decode' | 'oom' | 'context-lost' | 'render' | 'no-canvas';

export interface RenderHealth {
  tier: RenderTier;
  /** Largest texture edge to decode: 4096, or 2048 after the device refused 4096 px textures. */
  maxTexture: 4096 | 2048;
  /** A WebGL context was lost and may still be restored. */
  waitingForRestore: boolean;
  /** An exception in the Political or Physical vector layers: those styles show Atlas. */
  vectorFailed: boolean;
  /** Why the chain moved, oldest first (for tests and the design pass). */
  reasons: FailReason[];
}

export type HealthEvent =
  | { type: 'fail'; reason: FailReason }
  | { type: 'context-lost' }
  | { type: 'context-restored' }
  | { type: 'restore-timeout' }
  | { type: 'vector-fail' };

export const INITIAL_HEALTH: RenderHealth = Object.freeze({ tier: 'webgl', maxTexture: 4096, waitingForRestore: false, vectorFailed: false, reasons: [] }) as RenderHealth;

const down = (s: RenderHealth, reason: FailReason): RenderHealth =>
  ({ ...s, tier: s.tier === 'webgl' ? 'canvas' : 'atlas', waitingForRestore: false, reasons: [...s.reasons, reason] });

export function nextHealth(s: RenderHealth, e: HealthEvent): RenderHealth {
  if (e.type === 'vector-fail') return s.vectorFailed ? s : { ...s, vectorFailed: true };
  if (s.tier === 'atlas') return s;
  switch (e.type) {
    case 'context-lost':
      return s.tier === 'webgl' ? { ...s, waitingForRestore: true } : s;
    case 'context-restored':
      return s.waitingForRestore ? { ...s, waitingForRestore: false } : s;
    case 'restore-timeout':
      return s.tier === 'webgl' && s.waitingForRestore ? down(s, 'context-lost') : s;
    case 'fail':
      if (e.reason === 'decode') return { ...s, tier: 'atlas', waitingForRestore: false, reasons: [...s.reasons, 'decode'] };
      if (e.reason === 'texture-size' && s.tier === 'webgl' && s.maxTexture === 4096) return { ...s, maxTexture: 2048, reasons: [...s.reasons, 'texture-size'] };
      return down(s, e.reason);
  }
}

/** The style that can be drawn on this device for the chosen one. */
export function effectiveStyle(chosen: MapStyle, h: RenderHealth): MapStyle {
  if (chosen === 'atlas') return 'atlas';
  if (chosen === 'political') return h.vectorFailed ? 'atlas' : 'political';
  if (h.tier === 'atlas') return 'atlas';
  return chosen === 'physical' && h.vectorFailed ? 'atlas' : chosen;
}

/** What the layers draw right now: a texture style keeps Atlas on screen until its images are decoded (ruling R11). */
export function drawnStyle(style: MapStyle, ready: Readonly<Record<TextureStyle, boolean>>): MapStyle {
  return isTextureStyle(style) && !ready[style] ? 'atlas' : style;
}

/** Whether to show "This device can't draw this style; showing Atlas". */
export function styleUnavailable(chosen: MapStyle, h: RenderHealth): boolean {
  return chosen !== 'atlas' && effectiveStyle(chosen, h) === 'atlas';
}
