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
 * The bytes of the block with this element id, or null when the page has no such block.
 * Throws when the block names a file that cannot be downloaded.
 */
export async function blockBytes(id: string, doc: Document = document): Promise<Uint8Array<ArrayBuffer> | null> {
  const block = doc.getElementById(id);
  if (!block) return null;
  const text = block.textContent ?? '';
  if (text.trim()) return decodeBase64(text);
  const src = block.getAttribute('data-src');
  if (!src) return null;
  const res = await fetch(new URL(src, doc.baseURI));
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
