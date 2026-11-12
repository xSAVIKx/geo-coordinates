import { afterEach, describe, expect, test, vi } from 'vitest';
import { blockBytes, DataFetchFailure, isDataFetchFailure, isLocalCopy } from '../../src/map/texture/dataBlock';
import { loadTexture } from '../../src/map/texture/assets';
import { loadCityPhoto } from '../../src/map/texture/cityAssets';
import { RenderFailure } from '../../src/map/texture/renderer';

/*
 * The hosted page keeps its data blocks empty and names a file in `data-src` (scripts/build-site.ts). There is no
 * DOM in these tests (vitest.config.ts runs `environment: 'node'`), so a block is the smallest stand-in that
 * dataBlock.ts asks for: its text and its `data-src`.
 */
type Block = { text: string; src?: string };
function page(blocks: Record<string, Block>): Document {
  return {
    baseURI: 'https://example.test/geo-coordinates/',
    getElementById: (id: string) => {
      const b = blocks[id];
      return b ? { textContent: b.text, getAttribute: (n: string) => (n === 'data-src' ? b.src ?? null : null) } : null;
    },
  } as unknown as Document;
}
const linked = page({ a: { text: '', src: 'data/a-0123456789.webp' } });

async function failure(p: Promise<unknown>): Promise<unknown> {
  try { await p; } catch (e) { return e; }
  throw new Error('expected a failure');
}

describe('blockBytes', () => {
  test('an inline block is decoded and makes no request', async () => {
    const get = vi.fn();
    expect([...(await blockBytes('a', page({ a: { text: ' QUJD\n' } }), get))!]).toEqual([65, 66, 67]);
    expect(get).not.toHaveBeenCalled();
  });

  test('a missing block, or an empty block with no file, is null (not a download failure)', async () => {
    const get = vi.fn();
    expect(await blockBytes('b', linked, get)).toBeNull();
    expect(await blockBytes('a', page({ a: { text: '' } }), get)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  test('a linked block downloads its file relative to the page', async () => {
    const get = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    expect([...(await blockBytes('a', linked, get as unknown as typeof fetch))!]).toEqual([1, 2, 3]);
    expect(String((get.mock.calls[0] as unknown[])[0])).toBe('https://example.test/geo-coordinates/data/a-0123456789.webp');
  });

  test('no network is a DataFetchFailure with status 0', async () => {
    const e = await failure(blockBytes('a', linked, (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch));
    expect(isDataFetchFailure(e)).toBe(true);
    expect(e).toMatchObject({ status: 0, src: 'data/a-0123456789.webp' });
  });

  test('an HTTP error (an old tab after a deploy gets 404) is a DataFetchFailure with its status', async () => {
    const e = await failure(blockBytes('a', linked, (async () => new Response('gone', { status: 404 })) as typeof fetch));
    expect(e).toBeInstanceOf(DataFetchFailure);
    expect(e).toMatchObject({ status: 404 });
  });

  test('a body cut off part way is a DataFetchFailure', async () => {
    const res = { ok: true, status: 200, arrayBuffer: async () => { throw new TypeError('network error'); } } as unknown as Response;
    expect(isDataFetchFailure(await failure(blockBytes('a', linked, (async () => res) as typeof fetch)))).toBe(true);
  });
});

test('a copy opened from disk is a local copy; the hosted page is not', () => {
  expect(isLocalCopy({ protocol: 'file:' })).toBe(true);
  expect(isLocalCopy({ protocol: 'https:' })).toBe(false);
  expect(isLocalCopy(undefined)).toBe(false);
});

describe('a texture or a close-up that cannot be downloaded fails as "network", not "decode"', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  test('loadTexture and loadCityPhoto', async () => {
    vi.stubGlobal('document', page({
      'geo-texture-physical-region': { text: '', src: 'data/geo-texture-physical-region-0.webp' },
      'geo-photo-katowice': { text: '', src: 'data/geo-photo-katowice-0.webp' },
    }));
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    const tex = await failure(loadTexture('physical-region', 2048));
    expect(tex).toBeInstanceOf(RenderFailure);
    expect((tex as RenderFailure).reason).toBe('network');
    const photo = await failure(loadCityPhoto('katowice'));
    expect((photo as RenderFailure).reason).toBe('network');
  });
});
