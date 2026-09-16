// The map-style textures (src/map/data/textures, built by scripts/build-textures.py) inside the single built file.
// Each WebP goes into the page as base64 in a data block, <script type="application/x-geo-texture">, which the
// browser never runs or parses as code: src/map/texture/assets.ts reads a block's text and decodes it only when a
// style that needs it is first chosen (spec §3 "Lazy decoding"). Blocks go right before </body>, after Vite has
// built the page ('post'), so vite-plugin-singlefile and the licence notices never touch them.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const TEXTURE_DIR = resolve(import.meta.dirname, '../src/map/data/textures');
export const TEXTURE_SCRIPT_TYPE = 'application/x-geo-texture';

interface TextureManifest { textures: Record<string, { file: string; width: number; height: number }> }

export function textureBlocks(dir = TEXTURE_DIR): string {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as TextureManifest;
  return Object.entries(manifest.textures)
    .map(([id, t]) => `<script type="${TEXTURE_SCRIPT_TYPE}" id="geo-texture-${id}" data-width="${t.width}" data-height="${t.height}">${readFileSync(join(dir, t.file)).toString('base64')}</script>`)
    .join('\n');
}

export function mapTextures(dir = TEXTURE_DIR): Plugin {
  return {
    name: 'map-textures',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const at = html.lastIndexOf('</body>');
        if (at < 0) throw new Error('map-textures: </body> missing from the page');
        return `${html.slice(0, at)}\n${textureBlocks(dir)}\n${html.slice(at)}`;
      },
    },
  };
}
