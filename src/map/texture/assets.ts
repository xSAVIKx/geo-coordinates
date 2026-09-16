import manifest from '../data/textures/manifest.json';
import { testFlag } from '../../app/testMode';
import type { TextureStyle } from '../mapStyle';
import { RenderFailure, type StyleTextures } from './renderer';

/*
 * The embedded map textures (scripts/textures-plugin.ts puts each WebP into the page as base64 in a
 * <script type="application/x-geo-texture" id="geo-texture-<id>">). Decoded on first use, then kept for the page
 * session (spec §3 "Lazy decoding"), at most `maxSize` pixels along the longer edge.
 */
export type TextureId = keyof typeof manifest.textures;

export const STYLE_TEXTURES: Record<TextureStyle, { day: TextureId; region: TextureId; night: TextureId | null }> = {
  physical: { day: 'physical-world', region: 'physical-region', night: null },
  satellite: { day: 'satellite-day', region: 'satellite-region', night: 'satellite-night' },
};

/** The bytes of a base64 data block. `Uint8Array<ArrayBuffer>`, not the generic one: a Blob part cannot be shared memory. */
export function decodeBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function fitWithin(width: number, height: number, maxSize: number): { width: number; height: number } {
  const k = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

const cache = new Map<string, Promise<ImageBitmap>>();

export function loadTexture(id: TextureId, maxSize: number): Promise<ImageBitmap> {
  const key = `${id}@${maxSize}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      if (testFlag('gl') === 'decode-fail') throw new RenderFailure('decode', 'decoding switched off for a test');
      const block = document.getElementById(`geo-texture-${id}`);
      if (!block?.textContent) throw new RenderFailure('decode', `texture ${id} is missing from the page`);
      const t = manifest.textures[id];
      const size = fitWithin(t.width, t.height, maxSize);
      try {
        const blob = new Blob([decodeBase64(block.textContent)], { type: t.mime });
        return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none', ...(size.width < t.width ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' as const } : {}) });
      } catch (e) {
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
