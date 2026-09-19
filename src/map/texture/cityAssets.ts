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

/**
 * The decoded RGBA the cache is holding, in bytes. A decode that is still in flight counts as its full size:
 * the cache holds promises, not bitmaps, and the point of this number is the memory the page has committed
 * itself to, not the memory it has finished allocating. Anything waiting on it (`tests/e2e/city-photo.spec.ts`)
 * is therefore waiting for a decode to *start*, not to finish.
 */
export function cachedCityPhotoBytes(): number {
  let total = 0;
  for (const id of cache.keys()) total += decodedBytes(id);
  return total;
}

/**
 * Which close-up each live view still wants. Whether a photo may be given back is not one view's decision to
 * make: the flat map and the globe each mount their own texture layer over the same cache, so a view with no
 * box in sight used to be able to close a bitmap the *other* view had a decode in flight for — which then
 * uploads a closed bitmap, throws, and costs the page a render tier. A view claims before it decodes and gives
 * its claim up when it unmounts, and a photo is freed exactly when nobody is claiming it.
 */
const holders = new Map<object, CityBoxId>();

/** Closes every decoded photo no holder wants any more, and forgets them. Returns the bytes of RGBA given back. */
function sweep(): number {
  const wanted = new Set(holders.values());
  let freed = 0;
  for (const [id, p] of [...cache]) {
    if (wanted.has(id)) continue;
    freed += decodedBytes(id);
    // Detached from the cache first, so nothing can hand out a closed bitmap; a load that failed has nothing to close.
    cache.delete(id);
    void p.then((b) => b.close(), () => {});
  }
  return freed;
}

/**
 * Says which close-up `holder` — one view's texture layer, identified only by object identity — still needs, and
 * gives back every decoded photo no holder needs any more. `null` drops the holder's claim altogether, which is
 * what a view does when it leaves every box, when it has no renderer to draw one with, and when it unmounts:
 * a scene whose `views` exclude this one tears the whole layer down, and without that last call the close-up it
 * was holding (5.27 MiB for the school box) would stay decoded for the rest of the page session (ruling R13).
 * Returns the bytes of RGBA given back.
 */
export function holdCityPhoto(holder: object, id: CityBoxId | null): number {
  if (id) holders.set(holder, id);
  else holders.delete(holder);
  return sweep();
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
