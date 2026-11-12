import manifest from '../data/textures/manifest.json';
import { testFlag } from '../../app/testMode';
import type { TextureStyle } from '../mapStyle';
import { RenderFailure, type StyleTextures } from './renderer';
import { countTextureDecode } from './testHooks';
import { blockBytes, isDataFetchFailure } from './dataBlock';

/*
 * The embedded map textures (scripts/textures-plugin.ts puts each WebP into the page as base64 in a
 * <script type="application/x-geo-texture" id="geo-texture-<id>">; the hosted page links the file instead, see
 * ./dataBlock.ts). Decoded on first use, then kept for the page session (spec §3 "Lazy decoding"), at most
 * `maxSize` pixels along the longer edge.
 */
export type TextureId = keyof typeof manifest.textures;

export const STYLE_TEXTURES: Record<TextureStyle, { day: TextureId; region: TextureId; night: TextureId | null }> = {
  physical: { day: 'physical-world', region: 'physical-region', night: null },
  satellite: { day: 'satellite-day', region: 'satellite-region', night: 'satellite-night' },
};

export { decodeBase64 } from './dataBlock';

export function fitWithin(width: number, height: number, maxSize: number): { width: number; height: number } {
  const k = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

const cache = new Map<string, Promise<ImageBitmap>>();

/** The RGBA an `ImageBitmap` of this texture holds once decoded at `maxSize` — 4 bytes a pixel. */
export function decodedBytes(id: TextureId, maxSize: number): number {
  const t = manifest.textures[id];
  const { width, height } = fitWithin(t.width, t.height, maxSize);
  return width * height * 4;
}

/** What the decode cache is holding right now, in bytes of RGBA (tests/e2e/perf-smoke.spec.ts). */
export function cachedTextureBytes(): number {
  let total = 0;
  for (const key of cache.keys()) {
    const at = key.lastIndexOf('@');
    total += decodedBytes(key.slice(0, at) as TextureId, Number(key.slice(at + 1)));
  }
  return total;
}

const keysFor = (style: TextureStyle, maxSize: number): string[] =>
  (Object.values(STYLE_TEXTURES[style]).filter((id): id is TextureId => id !== null)).map((id) => `${id}@${maxSize}`);

/**
 * Closes every decoded image except the ones `keep` is drawn from at `maxSize`, and forgets them.
 *
 * The three world images are 4096 × 2048 each, so a page that has opened both texture styles holds about 107 MB of
 * RGBA for the rest of its life — and a canvas-tier fallback adds a second, 2048 px set beside it. On the 2 GB
 * Chromebooks this lesson runs on that is the likeliest way to reach the `oom` rung of the fallback chain, which
 * costs the child the style altogether. The images are needed only at `setTextures` time (each renderer keeps its
 * own GPU or CPU copy afterwards), so the style nobody is looking at can be given back; coming back to it decodes
 * it again, about 300–400 ms for Satellite's three images on this hardware. Keeping the *current* style's images
 * is what makes a restored WebGL context, a tier change or a second view cheap, so those stay.
 */
export function releaseTexturesExcept(keep: TextureStyle | null, maxSize: number): number {
  const wanted = new Set(keep ? keysFor(keep, maxSize) : []);
  let freed = 0;
  for (const [key, p] of [...cache]) {
    if (wanted.has(key)) continue;
    const at = key.lastIndexOf('@');
    freed += decodedBytes(key.slice(0, at) as TextureId, Number(key.slice(at + 1)));
    cache.delete(key);
    // Detached from the cache first, so nothing can hand out a closed bitmap; a load that failed has nothing to close.
    void p.then((b) => b.close(), () => {});
  }
  return freed;
}

export function loadTexture(id: TextureId, maxSize: number): Promise<ImageBitmap> {
  const key = `${id}@${maxSize}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      if (testFlag('gl') === 'decode-fail') throw new RenderFailure('decode', 'decoding switched off for a test');
      const t = manifest.textures[id];
      const size = fitWithin(t.width, t.height, maxSize);
      try {
        const bytes = await blockBytes(`geo-texture-${id}`);
        if (!bytes) throw new RenderFailure('decode', `texture ${id} is missing from the page`);
        const blob = new Blob([bytes], { type: t.mime });
        countTextureDecode(); // a cache miss: this image is really being decoded (tests/e2e/perf-smoke.spec.ts)
        return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none', ...(size.width < t.width ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' as const } : {}) });
      } catch (e) {
        if (e instanceof RenderFailure) throw e;
        // A download that failed is the network's fault, not the device's: it must not cost the render tier.
        if (isDataFetchFailure(e)) throw new RenderFailure('network', `texture ${id}: ${e.message}`);
        throw new RenderFailure('decode', `texture ${id}: ${(e as Error).message}`);
      }
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export async function loadStyleTextures(style: TextureStyle, maxSize: number, withNight: boolean): Promise<StyleTextures> {
  const ids = STYLE_TEXTURES[style];
  const [day, region, night] = await Promise.all([
    loadTexture(ids.day, maxSize), loadTexture(ids.region, maxSize),
    withNight && ids.night ? loadTexture(ids.night, maxSize) : Promise.resolve(null),
  ]);
  return { day, region, night };
}
