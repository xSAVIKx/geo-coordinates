import { describe, expect, test } from 'vitest';
import { splitDataBlocks, splitPage } from '../../scripts/build-site';
import { blockBytes } from '../../src/map/texture/dataBlock';

const PAGE = '<html><body><div id="app"></div><script type="module">app()</script>\n'
  + '<script type="application/x-geo-texture" id="geo-texture-physical-region" data-width="2" data-height="1">QUJD</script>\n'
  + '<script type="application/x-geo-photo" id="geo-photo-katowice" data-width="3" data-height="4">REVG\nR0g=</script>\n'
  + '<script type="application/x-geo-city" id="geo-city-katowice">SUpL</script>\n</body></html>';

describe('the hosted page', () => {
  test('moves every data block into its own file and keeps the rest of the page as it is', () => {
    const { html, files } = splitDataBlocks(PAGE);
    expect(files.map((f) => f.path)).toEqual([
      expect.stringMatching(/^data\/geo-texture-physical-region-[0-9a-f]{10}\.webp$/),
      expect.stringMatching(/^data\/geo-photo-katowice-[0-9a-f]{10}\.webp$/),
      expect.stringMatching(/^data\/geo-city-katowice-[0-9a-f]{10}\.bin$/),
    ]);
    expect(files.map((f) => f.bytes.toString())).toEqual(['ABC', 'DEFGH', 'IJK']);
    expect(html).toContain('<script type="module">app()</script>');
    expect(html).toContain(`<script type="application/x-geo-texture" id="geo-texture-physical-region" data-width="2" data-height="1" data-src="${files[0]!.path}"></script>`);
    expect(html).toContain(`<script type="application/x-geo-city" id="geo-city-katowice" data-src="${files[2]!.path}"></script>`);
    expect(html).not.toMatch(/QUJD|REVG|SUpL/);
  });

  test('moves the inline app script into its own file, with the same text', () => {
    const { html, files } = splitPage(PAGE);
    expect(files).toHaveLength(4);
    expect(files[0]!.path).toMatch(/^app-[0-9a-f]{10}\.js$/);
    expect(files[0]!.bytes.toString()).toBe('app()');
    expect(html).toContain(`<script type="module" src="${files[0]!.path}"></script>`);
    expect(html).not.toContain('app()');
  });

  test('a file name changes when its bytes change', () => {
    const a = splitDataBlocks(PAGE).files[0]!.path;
    const b = splitDataBlocks(PAGE.replace('QUJD', 'QUJF')).files[0]!.path;
    expect(a).not.toBe(b);
  });
});

describe('reading a data block', () => {
  const doc = (blocks: Record<string, { text: string; src?: string }>) => ({
    baseURI: 'https://example.test/geo-coordinates/',
    getElementById: (id: string) => {
      const b = blocks[id];
      return b ? { textContent: b.text, getAttribute: (n: string) => (n === 'data-src' ? b.src ?? null : null) } : null;
    },
  }) as unknown as Document;

  test('an inline block is decoded from its base64 text, with no download', async () => {
    const fetchSpy = (globalThis.fetch = (() => { throw new Error('no download expected'); }) as typeof fetch);
    expect([...(await blockBytes('a', doc({ a: { text: ' QU\nJD ' } })))!]).toEqual([65, 66, 67]);
    expect(fetchSpy).toBeDefined();
  });

  test('an empty block with data-src is downloaded from that file, relative to the page', async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (u: URL) => { urls.push(String(u)); return new Response(new Uint8Array([1, 2, 3])); }) as typeof fetch;
    expect([...(await blockBytes('a', doc({ a: { text: '', src: 'data/a-1.webp' } })))!]).toEqual([1, 2, 3]);
    expect(urls).toEqual(['https://example.test/geo-coordinates/data/a-1.webp']);
  });

  test('a missing block is null, and a failed download throws', async () => {
    expect(await blockBytes('nope', doc({}))).toBeNull();
    globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(blockBytes('a', doc({ a: { text: '', src: 'data/a.webp' } }))).rejects.toThrow(/404/);
  });
});
