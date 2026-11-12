/*
 * The bytes of one embedded data block (a map texture, a city photo or a city's street data).
 *
 * In the single offline file, each block holds its file as base64 text (scripts/textures-plugin.ts and
 * scripts/city-plugin.ts). The hosted page (scripts/build-site.ts) takes the same blocks out of the page and
 * publishes each one as a separate file next to it. There, a block is empty and its `data-src` attribute names
 * that file, relative to the page. The page then downloads only the blocks that a pupil really opens.
 */

/** The bytes of a base64 data block. `Uint8Array<ArrayBuffer>`, not the generic one: a Blob part cannot be shared memory. */
export function decodeBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * A data file that the page could not download: no network, a dropped connection, or an HTTP error such as the 404
 * that an old tab gets after a new deploy has renamed the files. This is not a fault of the device. A caller must not
 * move the render tier for it, and the next attempt may well succeed.
 */
export class DataFetchFailure extends Error {
  /** `status` is the HTTP status, or 0 when no response came back at all. */
  constructor(readonly src: string, readonly status: number, message: string) {
    super(message);
    this.name = 'DataFetchFailure';
  }
}

export function isDataFetchFailure(e: unknown): e is DataFetchFailure {
  return e instanceof DataFetchFailure;
}

/**
 * Where a pupil gets the single offline file. A hosted page saved with Ctrl+S keeps its empty blocks, so the saved
 * copy opened from disk can draw the texture styles only while it can still reach the site.
 */
export const OFFLINE_FILE_URL = 'https://github.com/xSAVIKx/geo-coordinates/blob/main/dist/geo-coordinates.html';

/** Whether this page is a copy opened from disk (file://), not the hosted page. */
export function isLocalCopy(loc: { protocol: string } | undefined = globalThis.location): boolean {
  return loc?.protocol === 'file:';
}

/**
 * The bytes of the block with this element id, or null when the page has no such block.
 * Throws a `DataFetchFailure` when the block names a file that cannot be downloaded.
 */
export async function blockBytes(id: string, doc: Document = document, get: typeof fetch = fetch): Promise<Uint8Array<ArrayBuffer> | null> {
  const block = doc.getElementById(id);
  if (!block) return null;
  const text = block.textContent ?? '';
  if (text.trim()) return decodeBase64(text);
  const src = block.getAttribute('data-src');
  if (!src) return null;
  let res: Response;
  try {
    res = await get(new URL(src, doc.baseURI));
  } catch (e) {
    throw new DataFetchFailure(src, 0, `${src}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new DataFetchFailure(src, res.status, `${src}: HTTP ${res.status}`);
  try {
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    // The connection dropped part way through the body.
    throw new DataFetchFailure(src, 0, `${src}: ${(e as Error).message}`);
  }
}
