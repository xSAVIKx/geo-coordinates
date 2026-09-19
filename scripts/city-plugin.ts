// The city close-up data (src/map/data/city, built by scripts/build-city-photos.py and
// scripts/build-city-streets.ts) inside the single built file. Each photo goes in as base64 WebP, and each box's
// street topology as the base64 of its gzipped TopoJSON (Task 2's controller ruling: raw text would have put the
// page at about 8.49 MB against the 8 MiB cap; gzipped it does not). src/map/cityStreets.ts's
// unpackStreetTopology() inflates a street block back into a topology at runtime, returning null rather than
// throwing on any failure. Both go into <script> blocks the browser never runs or parses as code -- exactly the
// model scripts/textures-plugin.ts uses for the world textures. Nothing draws any of this yet (Tasks 4-6): a page
// that never opens a close-up pays nothing beyond the bytes sitting inert in the file. Blocks go right before
// </body>, after Vite has built the page ('post'), so vite-plugin-singlefile and the licence notices never touch
// them.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const CITY_DIR = resolve(import.meta.dirname, '../src/map/data/city');
export const PHOTO_SCRIPT_TYPE = 'application/x-geo-photo';
export const STREET_SCRIPT_TYPE = 'application/x-geo-city';

interface PhotoManifest { photos: Record<string, { file: string; width: number; height: number }> }
interface StreetManifest { streets: Record<string, { file: string }> }
interface BoxesFile { boxes: { id: string }[] }

export function cityBlocks(dir = CITY_DIR): string {
  const boxes = JSON.parse(readFileSync(join(dir, 'boxes.json'), 'utf8')) as BoxesFile;
  const photos = (JSON.parse(readFileSync(join(dir, 'photos', 'manifest.json'), 'utf8')) as PhotoManifest).photos;
  const streets = (JSON.parse(readFileSync(join(dir, 'streets', 'manifest.json'), 'utf8')) as StreetManifest).streets;
  const out: string[] = [];
  for (const { id } of boxes.boxes) {
    const p = photos[id];
    if (!p) throw new Error(`city-plugin: no photo for ${id} (run npm run data:city-photos)`);
    const b64 = readFileSync(join(dir, 'photos', p.file)).toString('base64');
    out.push(`<script type="${PHOTO_SCRIPT_TYPE}" id="geo-photo-${id}" data-width="${p.width}" data-height="${p.height}">${b64}</script>`);
  }
  for (const { id } of boxes.boxes) {
    const s = streets[id];
    if (!s) throw new Error(`city-plugin: no street data for ${id} (run npm run data:city-streets)`);
    const b64 = readFileSync(join(dir, 'streets', s.file)).toString('base64');
    // Base64's alphabet (A-Za-z0-9+/=) cannot spell "</script", so unlike raw TopoJSON text there is nothing here
    // that could ever close the block early; still guard it, since a bug elsewhere should fail the build, not ship.
    if (/<\/script/i.test(b64)) throw new Error(`city-plugin: ${s.file} produced a base64 block containing a closing script tag`);
    out.push(`<script type="${STREET_SCRIPT_TYPE}" id="geo-city-${id}">${b64}</script>`);
  }
  return out.join('\n');
}

export function cityData(dir = CITY_DIR): Plugin {
  return {
    name: 'city-close-ups',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const at = html.lastIndexOf('</body>');
        if (at < 0) throw new Error('city-close-ups: </body> missing from the page');
        return `${html.slice(0, at)}\n${cityBlocks(dir)}\n${html.slice(at)}`;
      },
    },
  };
}
