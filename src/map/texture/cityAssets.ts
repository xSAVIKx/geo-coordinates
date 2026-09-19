import manifest from '../data/city/photos/manifest.json';
import type { GeoBounds } from '../geometry';
import type { CityBoxId } from '../cityBoxes';
import { decodeBase64 } from './assets';
import { RenderFailure } from './renderer';
import { countTextureDecode } from './testHooks';

/*
 * The embedded city close-up photos (scripts/city-plugin.ts puts each WebP into the page as base64 in a
 * <script type="application/x-geo-photo" id="geo-photo-<id>">). One is decoded at a time: a box only ever fills
 * the view on its own, and the twelve decoded together would be about 30 MB of RGBA held for the page's life
 * (planning ruling R13).
 */
export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';

export interface CityPhoto {
  id: CityBoxId;
  width: number;
  height: number;
  bounds: GeoBounds;
  source: PhotoSourceKey;
  /** The date the photo was taken, `YYYY-MM-DD`, or '' where the source does not say. */
  captured: string;
  /** Metres on the ground per pixel: 4.17 for the school box, 5.0 for the other orthophotos, 10.0 for Sentinel-2. */
  groundM: number;
  bytes: number;
  mime: 'image/webp';
}

export const CITY_PHOTOS: Readonly<Record<CityBoxId, CityPhoto>> = Object.fromEntries(
  Object.entries(manifest.photos).map(([id, p]) => [id, {
    id: id as CityBoxId, width: p.width, height: p.height,
    bounds: { west: p.bounds[0]!, south: p.bounds[1]!, east: p.bounds[2]!, north: p.bounds[3]! },
    source: p.source as PhotoSourceKey, captured: p.captured, groundM: p.groundM, bytes: p.bytes, mime: 'image/webp',
  }]),
) as Record<CityBoxId, CityPhoto>;

const cache = new Map<CityBoxId, Promise<ImageBitmap>>();

/** The RGBA a decoded photo holds — 4 bytes a pixel. */
const decodedBytes = (id: CityBoxId) => CITY_PHOTOS[id].width * CITY_PHOTOS[id].height * 4;

export function cachedCityPhotoBytes(): number {
  let total = 0;
  for (const id of cache.keys()) total += decodedBytes(id);
  return total;
}

/** Closes every decoded photo but `keep` and forgets them. Returns the bytes of RGBA given back. */
export function releaseCityPhotosExcept(keep: CityBoxId | null): number {
  let freed = 0;
  for (const [id, p] of [...cache]) {
    if (id === keep) continue;
    freed += decodedBytes(id);
    // Detached from the cache first, so nothing can hand out a closed bitmap; a load that failed has nothing to close.
    cache.delete(id);
    void p.then((b) => b.close(), () => {});
  }
  return freed;
}

export function loadCityPhoto(id: CityBoxId): Promise<ImageBitmap> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const block = document.getElementById(`geo-photo-${id}`);
      if (!block?.textContent) throw new RenderFailure('decode', `city photo ${id} is missing from the page`);
      try {
        const blob = new Blob([decodeBase64(block.textContent)], { type: 'image/webp' });
        countTextureDecode();
        return await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      } catch (e) {
        throw new RenderFailure('decode', `city photo ${id}: ${(e as Error).message}`);
      }
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
