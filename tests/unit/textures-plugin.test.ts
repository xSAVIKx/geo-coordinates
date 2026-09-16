import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import manifest from '../../src/map/data/textures/manifest.json';
import { mapTextures, TEXTURE_SCRIPT_TYPE, textureBlocks } from '../../scripts/textures-plugin';

describe('texture data blocks', () => {
  test('one block per texture, holding the file bytes as base64 with the manifest size', () => {
    const html = textureBlocks();
    const blocks = [...html.matchAll(/<script type="([^"]+)" id="geo-texture-([a-z-]+)" data-width="(\d+)" data-height="(\d+)">([A-Za-z0-9+/=]+)<\/script>/g)];
    expect(blocks.map((b) => b[2]).sort()).toEqual(Object.keys(manifest.textures).sort());
    for (const [, type, id, w, h, b64] of blocks) {
      const t = manifest.textures[id as keyof typeof manifest.textures];
      expect(type).toBe(TEXTURE_SCRIPT_TYPE);
      expect([Number(w), Number(h)]).toEqual([t.width, t.height]);
      expect(Buffer.from(b64!, 'base64').equals(readFileSync(`src/map/data/textures/${t.file}`))).toBe(true);
    }
  });

  test('the plugin appends the blocks right before </body>, after Vite has built the page', () => {
    const plugin = mapTextures();
    const hook = plugin.transformIndexHtml as { order: string; handler: (html: string) => string };
    expect(hook.order).toBe('post');
    const out = hook.handler('<html><body><main></main></body></html>');
    expect(out.startsWith('<html><body><main></main>\n<script type="application/x-geo-texture"')).toBe(true);
    expect(out.endsWith('</script>\n</body></html>')).toBe(true);
    expect(() => hook.handler('<html></html>')).toThrow(/<\/body>/);
  });
});
