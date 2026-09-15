# Part 1 — Data builds (spec §9.1)

Tasks 1–4 produce committed data files only. Nothing the page draws changes yet. Read the spec §3 and §7 first.

Conventions for every task here:
- Run TypeScript scripts with `node --experimental-strip-types scripts/<name>.ts` (Node 24; imports between scripts use the `.ts` extension, as `scripts/size-check.ts` does).
- Raw downloads live in git-ignored `.cache/` (already in `.gitignore`). Committed outputs live in `src/map/data/`.
- Before committing: `npm run check && npm test` must pass.

---

### Task 1: World and detail textures

Build the five WebP textures and their manifest with a reproducible Python + Pillow script.

**Files:**
- Create: `scripts/build-textures.py`
- Create: `scripts/webp-size.ts`
- Create (generated, committed): `src/map/data/textures/physical-world.webp`, `physical-region.webp`, `satellite-day.webp`, `satellite-region.webp`, `satellite-night.webp`, `manifest.json`
- Modify: `package.json` (script `data:textures`)
- Test: `tests/unit/textures-data.test.ts`

**Interfaces:**
- Consumes: `src/map/data/central-europe.json` top-level `"region": { "west": 8, "south": 44, "east": 32, "north": 58 }` (the `REGION` box of `src/map/world.ts`).
- Produces:
  - `src/map/data/textures/manifest.json` with shape
    ```ts
    interface TextureEntry { file: string; width: number; height: number; bounds: [west: number, south: number, east: number, north: number]; source: string; bytes: number; mime: 'image/webp' }
    interface TextureManifest { generatedBy: string; textures: Record<'physical-world' | 'physical-region' | 'satellite-day' | 'satellite-region' | 'satellite-night', TextureEntry> }
    ```
  - `scripts/webp-size.ts`: `export function webpSize(buf: Uint8Array): { width: number; height: number }`
  - All textures are equirectangular: longitude −180…180 left to right (or the bounds' west…east), latitude north at the top row.

- [ ] **Step 1: Copy the raw sources into the cache**

```bash
mkdir -p .cache/textures
RAW=/tmp/claude-997/-srv-work-geo-coordinates-viz/8881ec1b-a091-4263-ad3d-faaf2e54929a/scratchpad/map-styles/raw
cp "$RAW/HYP_50M_SR_W.tif" "$RAW/HYP_50M_SR_W.VERSION.txt" "$RAW/world.topo.bathy.200407.3x5400x2700.jpg" \
   "$RAW/world.topo.bathy.200407.3x21600x10800.jpg" "$RAW/BlackMarble_2016_3km.jpg" .cache/textures/
python3 -c "from PIL import features, __version__; print(__version__, features.check('webp'))"
```
Expected: the last line prints `12.3.0 True` (any Pillow ≥ 10 with `True` is fine).

- [ ] **Step 2: Write `scripts/webp-size.ts`**

```ts
// Width and height of a WebP file from its RIFF header (lossy 'VP8 ', lossless 'VP8L' or extended 'VP8X'),
// so tests and the size report can check textures without an image library.
export function webpSize(buf: Uint8Array): { width: number; height: number } {
  const ascii = (at: number, n: number) => String.fromCharCode(...buf.subarray(at, at + n));
  if (buf.length < 30 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') throw new Error('webpSize: not a WebP file');
  const chunk = ascii(12, 4);
  const b = (i: number) => buf[i]!;
  if (chunk === 'VP8 ') {
    if (b(23) !== 0x9d || b(24) !== 0x01 || b(25) !== 0x2a) throw new Error('webpSize: bad VP8 start code');
    return { width: (b(26) | (b(27) << 8)) & 0x3fff, height: (b(28) | (b(29) << 8)) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b(20) !== 0x2f) throw new Error('webpSize: bad VP8L signature');
    const bits = (b(21) | (b(22) << 8) | (b(23) << 16) | (b(24) << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)), height: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)) };
  }
  throw new Error(`webpSize: unknown chunk ${chunk}`);
}
```

- [ ] **Step 3: Write the failing test `tests/unit/textures-data.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import regionJson from '../../src/map/data/central-europe.json';
import manifest from '../../src/map/data/textures/manifest.json';
import { webpSize } from '../../scripts/webp-size';

const DIR = 'src/map/data/textures/';
const EXPECTED: Record<string, [number, number]> = {
  'physical-world': [4096, 2048], 'physical-region': [720, 420],
  'satellite-day': [4096, 2048], 'satellite-region': [1440, 840], 'satellite-night': [4096, 2048],
};
const entries = Object.entries(manifest.textures) as [string, { file: string; width: number; height: number; bounds: number[]; source: string; bytes: number; mime: string }][];

describe('webpSize', () => {
  test('reads a VP8X header', () => {
    const buf = new Uint8Array(30);
    buf.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    buf.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
    buf.set([0xff, 0x0f, 0x00, 0xff, 0x07, 0x00], 24); // 4096 × 2048
    expect(webpSize(buf)).toEqual({ width: 4096, height: 2048 });
    expect(() => webpSize(new Uint8Array(40))).toThrow(/not a WebP/);
  });
});

describe('map-style textures', () => {
  test('the five textures, with the sizes the plan fixes, read from the files themselves', () => {
    expect(entries.map(([id]) => id).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [id, t] of entries) {
      const file = readFileSync(DIR + t.file);
      expect(webpSize(file), id).toEqual({ width: EXPECTED[id]![0], height: EXPECTED[id]![1] });
      expect([t.width, t.height], id).toEqual(EXPECTED[id]);
      expect(t.bytes, id).toBe(file.length);
      expect(t.mime, id).toBe('image/webp');
    }
  });

  test('world textures cover the whole world; region tiles cover the Central Europe box at 30 and 60 px per degree', () => {
    const r = regionJson.region;
    expect([r.west, r.south, r.east, r.north]).toEqual([8, 44, 32, 58]);
    for (const [id, t] of entries) {
      if (id.endsWith('-region')) expect(t.bounds, id).toEqual([8, 44, 32, 58]);
      else expect(t.bounds, id).toEqual([-180, -90, 180, 90]);
    }
    expect(manifest.textures['physical-region'].width / 24).toBe(30);
    expect(manifest.textures['satellite-region'].width / 24).toBe(60);
    expect(manifest.textures['satellite-region'].height / 14).toBe(60);
  });

  test('sources are recorded and the set stays within its budget', () => {
    expect(manifest.textures['physical-world'].source).toMatch(/Natural Earth.*HYP_50M_SR_W.*2\.0\.0/);
    expect(manifest.textures['physical-region'].source).toMatch(/HYP_50M_SR_W/);
    expect(manifest.textures['satellite-day'].source).toMatch(/NASA Earth Observatory.*Blue Marble/);
    expect(manifest.textures['satellite-region'].source).toMatch(/Blue Marble.*21600/);
    expect(manifest.textures['satellite-night'].source).toMatch(/NASA Earth Observatory.*Black Marble 2016/);
    const total = entries.reduce((n, [, t]) => n + t.bytes, 0);
    // ≈ 1.45 MB measured in the brainstorm (sizes.json); base64 adds a third in the page.
    expect(total).toBeLessThan(2.2 * 1024 * 1024);
    expect(manifest.textures['physical-world'].bytes).toBeLessThan(560 * 1024);
    expect(manifest.textures['satellite-day'].bytes).toBeLessThan(760 * 1024);
    expect(manifest.textures['satellite-night'].bytes).toBeLessThan(360 * 1024);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run tests/unit/textures-data.test.ts`
Expected: FAIL — cannot resolve `src/map/data/textures/manifest.json`.

- [ ] **Step 5: Write `scripts/build-textures.py`**

```python
#!/usr/bin/env python3
"""Builds the map-style textures in src/map/data/textures/ (Map styles spec §3).

Sources (public domain):
  Natural Earth "Cross Blended Hypso with Shaded Relief and Water", HYP_50M_SR_W, version 2.0.0
    https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip             10800 x 5400, 30 px per degree
  NASA Earth Observatory, Blue Marble Next Generation, July 2004 (world.topo.bathy.200407)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.jpg (60 px/deg)
  NASA Earth Observatory, Black Marble 2016 (3 km)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg
  (If a NASA URL has moved, find the record on https://visibleearth.nasa.gov/ by the file name.)

Usage:
  python3 scripts/build-textures.py [raw-dir] [--download]        (npm run data:textures)
Needs Python 3.10+ and Pillow 10+ with WebP support. No numpy. raw-dir defaults to .cache/textures (git-ignored,
~330 MB); --download fetches missing files. The outputs are committed; `npm run build` never runs this script.

Outputs (equirectangular, north up; WebP quality 80, method 6):
  physical-world    4096 x 2048  HYP_50M_SR_W, Lanczos
  physical-region    720 x  420  HYP_50M_SR_W cropped to REGION at its native 30 px/deg
  satellite-day     4096 x 2048  world.topo.bathy 5400 x 2700, Lanczos
  satellite-region  1440 x  840  world.topo.bathy 21600 x 10800 cropped to REGION at its native 60 px/deg
  satellite-night   4096 x 2048  BlackMarble_2016_3km, Lanczos
and manifest.json (sizes, bounds, sources, bytes), read by the page (src/map/texture/assets.ts) and the tests.
"""
import json
import os
import sys
import urllib.request
import zipfile

from PIL import Image, features

Image.MAX_IMAGE_PIXELS = None

OUT = os.path.join('src', 'map', 'data', 'textures')
REGION_JSON = os.path.join('src', 'map', 'data', 'central-europe.json')
WORLD = [-180, -90, 180, 90]

HYP = 'HYP_50M_SR_W.tif'
BM_SMALL = 'world.topo.bathy.200407.3x5400x2700.jpg'
BM_LARGE = 'world.topo.bathy.200407.3x21600x10800.jpg'
NIGHT = 'BlackMarble_2016_3km.jpg'
URLS = {
    'HYP_50M_SR_W.zip': 'https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip',
    BM_SMALL: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/' + BM_SMALL,
    BM_LARGE: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/' + BM_LARGE,
    NIGHT: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/' + NIGHT,
}
NE_CREDIT = 'Natural Earth HYP_50M_SR_W 2.0.0 (public domain), https://www.naturalearthdata.com/'
BM_CREDIT = 'NASA Earth Observatory, Blue Marble Next Generation, July 2004 (public domain), https://earthobservatory.nasa.gov/'
NIGHT_CREDIT = 'NASA Earth Observatory, Black Marble 2016 (public domain), https://earthobservatory.nasa.gov/'


def ensure(raw, name, download):
    path = os.path.join(raw, name)
    if os.path.exists(path):
        return path
    if name == HYP:
        zpath = ensure(raw, 'HYP_50M_SR_W.zip', download)
        with zipfile.ZipFile(zpath) as z:
            member = next(m for m in z.namelist() if m.endswith('HYP_50M_SR_W.tif'))
            with z.open(member) as src, open(path, 'wb') as dst:
                dst.write(src.read())
        return path
    if not download:
        sys.exit(f'Missing {path} (run with --download or fetch {URLS[name]})')
    print(f'Downloading {URLS[name]} ...', flush=True)
    urllib.request.urlretrieve(URLS[name], path)
    return path


def region_box():
    with open(REGION_JSON, encoding='utf-8') as f:
        r = json.load(f)['region']
    return [r['west'], r['south'], r['east'], r['north']]


def crop(im, px_per_deg, box):
    """The part of a whole-world equirectangular image inside box (west, south, east, north), at its own resolution."""
    if im.width != 360 * px_per_deg or im.height != 180 * px_per_deg:
        sys.exit(f'Expected a {360 * px_per_deg} x {180 * px_per_deg} source, got {im.size}')
    w, s, e, n = box
    return im.crop(((w + 180) * px_per_deg, (90 - n) * px_per_deg, (e + 180) * px_per_deg, (90 - s) * px_per_deg))


def world(im, width=4096):
    return im.resize((width, width // 2), Image.LANCZOS)


def save(textures, tid, im, bounds, source):
    file = f'{tid}.webp'
    path = os.path.join(OUT, file)
    im.convert('RGB').save(path, 'WEBP', quality=80, method=6)
    size = os.path.getsize(path)
    textures[tid] = {'file': file, 'width': im.width, 'height': im.height, 'bounds': bounds, 'source': source,
                     'bytes': size, 'mime': 'image/webp'}
    print(f'{path}: {im.width} x {im.height}, {size / 1024:.1f} KiB', flush=True)


def main():
    args = sys.argv[1:]
    download = '--download' in args
    raw = next((a for a in args if not a.startswith('--')), os.path.join('.cache', 'textures'))
    if not features.check('webp'):
        sys.exit('Pillow was built without WebP support')
    os.makedirs(raw, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    box = region_box()
    textures = {}

    hyp = Image.open(ensure(raw, HYP, download)).convert('RGB')
    save(textures, 'physical-world', world(hyp), WORLD, NE_CREDIT)
    save(textures, 'physical-region', crop(hyp, 30, box), box, f'{NE_CREDIT}; native 30 px/deg crop')
    del hyp

    day = Image.open(ensure(raw, BM_SMALL, download)).convert('RGB')
    save(textures, 'satellite-day', world(day), WORLD, f'{BM_CREDIT}; 5400 x 2700 source')
    del day
    large = Image.open(ensure(raw, BM_LARGE, download)).convert('RGB')
    save(textures, 'satellite-region', crop(large, 60, box), box, f'{BM_CREDIT}; 21600 x 10800 source, native 60 px/deg crop')
    del large

    night = Image.open(ensure(raw, NIGHT, download)).convert('RGB')
    save(textures, 'satellite-night', world(night), WORLD, f'{NIGHT_CREDIT}; 13500 x 6750 source')
    del night

    manifest = {'generatedBy': 'scripts/build-textures.py', 'textures': textures}
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    total = sum(t['bytes'] for t in textures.values())
    print(f'total {total / 1024:.1f} KiB ({total * 4 / 3 / 1024:.1f} KiB as base64)')


if __name__ == '__main__':
    main()
```

Add to `package.json` `scripts` (after `data:borders`): `"data:textures": "python3 scripts/build-textures.py"`.

- [ ] **Step 6: Run the build**

Run: `npm run data:textures`
Expected (sizes ±15 %): `physical-world.webp: 4096 x 2048, ≈ 400 KiB`, `physical-region ≈ 25 KiB`, `satellite-day ≈ 570 KiB`, `satellite-region ≈ 110 KiB`, `satellite-night ≈ 230 KiB`, `total ≈ 1330 KiB`. Peak memory is about 1 GB while the 21600 px image is open.

- [ ] **Step 7: Look at the outputs**

Open two of them as images (Read tool on the `.webp` or convert a copy to PNG in the scratchpad with Pillow): `physical-region.webp` must show the Carpathian arc bottom-right and the Baltic top-centre; `satellite-night.webp` must be dark with bright European cities. A mirrored or shifted image means the crop box or row order is wrong.

- [ ] **Step 8: Run the test**

Run: `npx vitest run tests/unit/textures-data.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
npm run check && npm test
git add scripts/build-textures.py scripts/webp-size.ts src/map/data/textures tests/unit/textures-data.test.ts package.json
git commit -m "build(data): relief, Blue Marble and Black Marble textures for the map styles"
```

---

### Task 2: Texture embedding and the 5 MiB size check

Embed the textures into the single built file as base64 data blocks, raise the size limit to 5 MiB with a per-asset breakdown, and add the NASA data notice.

**Files:**
- Create: `scripts/textures-plugin.ts`, `scripts/size-report.ts`
- Modify: `vite.config.ts`, `scripts/size-check.ts`, `scripts/licence-notices.ts`
- Test: `tests/unit/textures-plugin.test.ts`, `tests/unit/size-report.test.ts`, `tests/e2e/textures-embedded.spec.ts`

**Interfaces:**
- Consumes: `src/map/data/textures/manifest.json` (Task 1; `textures: Record<id, { file, width, height, bounds, source, bytes, mime }>`), `webpSize` from `scripts/webp-size.ts`.
- Produces:
  - `scripts/textures-plugin.ts`: `TEXTURE_SCRIPT_TYPE = 'application/x-geo-texture'`; `textureBlocks(dir?: string): string`; `mapTextures(dir?: string): Plugin`. Each block: `<script type="application/x-geo-texture" id="geo-texture-<id>" data-width="<w>" data-height="<h>">BASE64</script>`, appended right before `</body>`.
  - `scripts/size-report.ts`: `interface SizePart { name: string; bytes: number }`; `sizeBreakdown(html: string): SizePart[]`; `formatBreakdown(parts: SizePart[], total: number): string`.
  - `DATA_NOTICES` gains a NASA Earth Observatory entry whose notice line starts `NASA Earth Observatory images (Public domain)`.

- [ ] **Step 1: Failing unit tests**

`tests/unit/textures-plugin.test.ts`:
```ts
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
```

`tests/unit/size-report.test.ts`:
```ts
import { expect, test } from 'vitest';
import { formatBreakdown, sizeBreakdown } from '../../scripts/size-report';

test('the built file is broken down into textures, app script, styles and the rest, adding up to the whole', () => {
  const html = '<!doctype html><head><style>a{}</style><script type="module">let x="é";</script></head><body>'
    + '<script type="application/x-geo-texture" id="geo-texture-satellite-day" data-width="2" data-height="1">QUJD</script>\n</body>';
  const parts = sizeBreakdown(html);
  expect(parts.map((p) => p.name)).toEqual(['texture satellite-day', 'app script and vector data', 'styles', 'html and head']);
  expect(parts[0]!.bytes).toBe(Buffer.byteLength('<script type="application/x-geo-texture" id="geo-texture-satellite-day" data-width="2" data-height="1">QUJD</script>\n'));
  expect(parts[1]!.bytes).toBe(Buffer.byteLength('<script type="module">let x="é";</script>'));
  expect(parts.reduce((n, p) => n + p.bytes, 0)).toBe(Buffer.byteLength(html));
  const text = formatBreakdown(parts, Buffer.byteLength(html));
  expect(text).toMatch(/texture satellite-day\s+0\.1 KiB/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/textures-plugin.test.ts tests/unit/size-report.test.ts`
Expected: FAIL — modules `scripts/textures-plugin` and `scripts/size-report` not found.

- [ ] **Step 3: Implement `scripts/textures-plugin.ts`**

```ts
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
```
Note the handler output in the test: `'<html><body><main></main>' + '\n' + blocks + '\n' + '</body></html>'`.

In `vite.config.ts` add `import { mapTextures } from './scripts/textures-plugin.ts';` and put `mapTextures()` in `plugins` right after `siteIcons()`.

- [ ] **Step 4: Implement `scripts/size-report.ts`**

```ts
// A byte breakdown of dist/geo-coordinates.html for scripts/size-check.ts: each embedded texture, the app script
// (code plus the vector map data bundled into it), styles, and everything else.
export interface SizePart { name: string; bytes: number }

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

export function sizeBreakdown(html: string): SizePart[] {
  const parts: SizePart[] = [];
  let rest = html.replace(/<script type="application\/x-geo-texture" id="geo-texture-([a-z-]+)"[^>]*>[^<]*<\/script>\n?/g, (m, id: string) => {
    parts.push({ name: `texture ${id}`, bytes: bytes(m) });
    return '';
  });
  let js = 0;
  rest = rest.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, (m) => { js += bytes(m); return ''; });
  let css = 0;
  rest = rest.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (m) => { css += bytes(m); return ''; });
  parts.push({ name: 'app script and vector data', bytes: js }, { name: 'styles', bytes: css }, { name: 'html and head', bytes: bytes(rest) });
  return parts;
}

export function formatBreakdown(parts: SizePart[], total: number): string {
  const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
  const width = Math.max(...parts.map((p) => p.name.length));
  return [...parts.map((p) => `  ${p.name.padEnd(width)}  ${kib(p.bytes).padStart(10)}  ${((p.bytes / total) * 100).toFixed(1).padStart(5)} %`), `  ${'total'.padEnd(width)}  ${kib(total).padStart(10)}`].join('\n');
}
```

- [ ] **Step 5: Update `scripts/size-check.ts`**

Replace the file with:
```ts
import { readFileSync, statSync } from 'node:fs';
import { formatBreakdown, sizeBreakdown } from './size-report.ts';

// Map styles spec §7: the single file stays under 5 MiB (textures included).
const LIMIT = 5_242_880;
const FILE = 'dist/geo-coordinates.html';
const size = statSync(FILE).size;
const html = readFileSync(FILE, 'utf8');
console.log(`${FILE}: ${(size / 1024).toFixed(1)} KiB of ${(LIMIT / 1024).toFixed(0)} KiB`);
if (size >= LIMIT) {
  console.error(`Size budget exceeded (${size} >= ${LIMIT}):\n${formatBreakdown(sizeBreakdown(html), size)}`);
  process.exit(1);
}
console.log(formatBreakdown(sizeBreakdown(html), size));

// The third-party licence notices (scripts/licence-notices.ts) travel with the file: the Svelte (MIT) and ISC notices
// and the Natural Earth and NASA Earth Observatory notes, in a comment at the top.
const head = html.slice(0, 20_000);
const missing = [/^<!doctype html>\n<!--\nThird-party licences\n/i, /^svelte \d+\.\d+\.\d+ \(MIT\)/m, /^d3-geo \d+\.\d+\.\d+ \(ISC\)/m, /^topojson-client \d+\.\d+\.\d+ \(ISC\)/m,
  /^world-atlas \d+\.\d+\.\d+ \(ISC\)/m, /Permission to use, copy, modify, and\/or distribute this software/, /^Natural Earth map data \(Public domain\)/m,
  /^NASA Earth Observatory images \(Public domain\)/m]
  .filter((re) => !re.test(head));
if (missing.length) { console.error(`Licence notices missing from ${FILE}: ${missing.join(', ')}`); process.exit(1); }
console.log(`${FILE}: third-party licence notices present`);
```

- [ ] **Step 6: Add the NASA notice in `scripts/licence-notices.ts`**

Change the `DATA_NOTICES` doc comment to mention the satellite images and append a second entry (keep the Natural Earth entry exactly as it is):
```ts
{
  name: 'NASA Earth Observatory', version: 'images', license: 'Public domain', url: 'https://earthobservatory.nasa.gov/',
  text: 'Satellite images: Blue Marble Next Generation (July 2004) and Black Marble 2016 by NASA Earth Observatory. NASA imagery is not subject to copyright in the United States; credit: NASA Earth Observatory.',
},
```

- [ ] **Step 7: Run the unit tests**

Run: `npx vitest run tests/unit/textures-plugin.test.ts tests/unit/size-report.test.ts tests/unit/licence-notices.test.ts`
Expected: PASS.

- [ ] **Step 8: Build and check the file**

Run: `npm run build`
Expected: the size line reads about `3200 KiB of 5120 KiB` (±10 %), followed by a breakdown with five `texture …` lines (satellite-day ≈ 760 KiB), `app script and vector data` ≈ 900 KiB, then `third-party licence notices present`. Then:
```bash
grep -o 'id="geo-texture-[a-z-]*"' dist/geo-coordinates.html
```
Expected: five lines, one per texture id.

- [ ] **Step 9: E2E — the textures decode inside the built page, offline**

`tests/e2e/textures-embedded.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import manifest from '../../src/map/data/textures/manifest.json';
import { openPage, pageErrors } from './helpers';

test('the built file embeds the five map textures and each decodes to its manifest size, with no requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:')) external.push(r.url()); });
  await openPage(page, 'en/');
  const sizes = await page.evaluate(async () => Promise.all([...document.querySelectorAll<HTMLScriptElement>('script[type="application/x-geo-texture"]')].map(async (s) => {
    const bin = atob(s.textContent!.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    return [s.id.replace('geo-texture-', ''), bmp.width, bmp.height] as const;
  })));
  expect(Object.fromEntries(sizes.map(([id, w, h]) => [id, [w, h]])))
    .toEqual(Object.fromEntries(Object.entries(manifest.textures).map(([id, t]) => [id, [t.width, t.height]])));
  expect(external).toEqual([]);
  expect(pageErrors(page)).toEqual([]);
});
```
Run: `npm run build && npx playwright test tests/e2e/textures-embedded.spec.ts tests/e2e/offline.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
npm run check && npm test
git add scripts/textures-plugin.ts scripts/size-report.ts scripts/size-check.ts scripts/licence-notices.ts vite.config.ts tests/unit/textures-plugin.test.ts tests/unit/size-report.test.ts tests/e2e/textures-embedded.spec.ts
git commit -m "build: embed the map textures as data blocks; 5 MiB budget with a per-asset breakdown"
```

---

### Task 3: Political shapes

Country polygons in Poland's point of view at about 50m detail, each with a colour index that differs from every neighbour, and label data.

**Files:**
- Create: `scripts/political-colours.ts`, `scripts/build-political.ts`
- Create (generated, committed): `src/map/data/political-pol.json`
- Modify: `package.json` (script `data:political`)
- Test: `tests/unit/political-colours.test.ts`, `tests/unit/political-data.test.ts`

**Interfaces:**
- Consumes: Natural Earth `ne_10m_admin_0_countries_pol.geojson` (the same file `scripts/build-world-borders.ts` uses; properties `ADM0_A3_PL`, `ISO_A2_EH`, `LABELRANK`, `MIN_LABEL`, `LABEL_X`, `LABEL_Y`).
- Produces:
  - `scripts/political-colours.ts`: `export const PALETTE_SIZE = 6;` `export function colourCountries(ids: readonly string[], neighbours: readonly (readonly number[])[], palette?: number): number[]`
  - `src/map/data/political-pol.json`: a quantized TopoJSON `Topology<{ countries: GeometryCollection<CountryProps> }>` plus a top-level `source` string, where each geometry has `id` = `ADM0_A3_PL` and
    ```ts
    interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }
    // a2: ISO 3166-1 alpha-2 (ISO_A2_EH) or '' when Natural Earth has none; c: colour index 0…5; lr: LABELRANK;
    // ml: MIN_LABEL (web-map zoom from which Natural Earth labels it); lx, ly: LABEL_X, LABEL_Y (degrees)
    ```

- [ ] **Step 1: Copy the source**

```bash
mkdir -p .cache/natural-earth
cp /tmp/claude-997/-srv-work-geo-coordinates-viz/8881ec1b-a091-4263-ad3d-faaf2e54929a/scratchpad/pov/ne_10m_pol.geojson .cache/natural-earth/ne_10m_admin_0_countries_pol.geojson
```

- [ ] **Step 2: Failing colouring test `tests/unit/political-colours.test.ts`**

```ts
import { expect, test } from 'vitest';
import { colourCountries, PALETTE_SIZE } from '../../scripts/political-colours';

const differ = (colours: number[], neighbours: number[][]) => neighbours.every((ns, i) => ns.every((j) => colours[i] !== colours[j]));

test('neighbours get different colours, with as few colours as DSatur needs', () => {
  // A triangle needs 3; a wheel with 5 spokes (odd cycle + hub) needs 4.
  const triangle = [[1, 2], [0, 2], [0, 1]];
  const t = colourCountries(['A', 'B', 'C'], triangle);
  expect(differ(t, triangle)).toBe(true);
  expect(new Set(t).size).toBe(3);
  const wheel = [[1, 2, 3, 4, 5], [0, 2, 5], [0, 1, 3], [0, 2, 4], [0, 3, 5], [0, 4, 1]];
  const w = colourCountries(['H', 'a', 'b', 'c', 'd', 'e'], wheel);
  expect(differ(w, wheel)).toBe(true);
  expect(Math.max(...w)).toBe(3);
});

test('isolated countries take colour 0; the result does not depend on input order', () => {
  expect(colourCountries(['X', 'Y'], [[], []])).toEqual([0, 0]);
  const ids = ['POL', 'DEU', 'CZE'];
  const ns = [[1, 2], [0, 2], [0, 1]];
  const a = colourCountries(ids, ns);
  const b = colourCountries([...ids].reverse(), [[1, 2], [0, 2], [0, 1]].map((n) => n.map((j) => 2 - j)).reverse());
  expect([...b].reverse()).toEqual(a);
});

test('a graph needing more colours than the palette fails loudly', () => {
  const k7 = Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => j).filter((j) => j !== i));
  expect(() => colourCountries('ABCDEFG'.split(''), k7, PALETTE_SIZE)).toThrow(/needs colour 7 of 6/);
});
```

Run: `npx vitest run tests/unit/political-colours.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/political-colours.ts` (DSatur greedy colouring)**

```ts
// Colours for the Political map style: neighbouring countries never share one (spec §3, §8). DSatur: repeatedly colour
// the uncoloured country whose neighbours already use the most different colours (ties: more neighbours, then the
// smaller id, so the result never depends on input order) with the lowest colour none of its neighbours has.
export const PALETTE_SIZE = 6;

export function colourCountries(ids: readonly string[], neighbours: readonly (readonly number[])[], palette = PALETTE_SIZE): number[] {
  const n = ids.length;
  const colour = new Array<number>(n).fill(-1);
  const seen = Array.from({ length: n }, () => new Set<number>());
  for (let step = 0; step < n; step++) {
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (colour[i] !== -1) continue;
      if (best < 0) { best = i; continue; }
      const s = seen[i]!.size - seen[best]!.size;
      const d = neighbours[i]!.length - neighbours[best]!.length;
      if (s > 0 || (s === 0 && (d > 0 || (d === 0 && ids[i]! < ids[best]!)))) best = i;
    }
    let c = 0;
    while (seen[best]!.has(c)) c++;
    if (c >= palette) throw new Error(`colourCountries: ${ids[best]} needs colour ${c + 1} of ${palette}`);
    colour[best] = c;
    for (const j of neighbours[best]!) seen[j]!.add(c);
  }
  return colour;
}
```

Run: `npx vitest run tests/unit/political-colours.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 4: Failing data test `tests/unit/political-data.test.ts`**

```ts
import { geoArea, geoContains } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, test } from 'vitest';
import politicalJson from '../../src/map/data/political-pol.json';

interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }
const topo = politicalJson as unknown as Topology<{ countries: GeometryCollection<CountryProps> }> & { source: string };
const geoms = topo.objects.countries.geometries;
const fc = feature(topo, topo.objects.countries);
const at = (lon: number, lat: number) => fc.features.filter((f) => geoContains(f, [lon, lat])).map((f) => f.id);

describe('political shapes: Natural Earth, Poland point of view', () => {
  test('stays small and names its source', () => {
    expect(JSON.stringify(politicalJson).length).toBeLessThan(300 * 1024);
    expect(topo.source).toMatch(/Natural Earth 5\.1\.1.*Poland point of view/);
  });

  test('ids are unique Poland point-of-view codes; Western Sahara is not a separate country', () => {
    const ids = geoms.map((g) => g.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['POL', 'UKR', 'RUS', 'KOS', 'MAR', 'DEU', 'LUX']) expect(ids, id).toContain(id);
    expect(ids).not.toContain('SAH');
    expect(geoms.length).toBeGreaterThan(180);
  });

  test('Crimea, Sevastopol and Donbas are in Ukraine; Kosovo, Western Sahara, Moscow and Warsaw where Poland sees them', () => {
    for (const [name, lon, lat] of [['Simferopol', 34.10, 44.95], ['Sevastopol', 33.60, 44.56], ['Donetsk', 37.80, 48.00], ['Luhansk', 39.31, 48.57], ['Kyiv', 30.52, 50.45]] as const) {
      expect(at(lon, lat), name).toEqual(['UKR']);
    }
    expect(at(21.17, 42.66)).toEqual(['KOS']); // Pristina
    expect(at(-13.20, 27.15)).toEqual(['MAR']); // Laayoune
    expect(at(37.62, 55.75)).toEqual(['RUS']);
    expect(at(21.01, 52.23)).toEqual(['POL']);
  });

  test('polygons are wound the way d3 expects (no country covers most of the sphere)', () => {
    for (const f of fc.features) expect(geoArea(f), String(f.id)).toBeLessThan(2 * Math.PI);
  });

  test('neighbours never share a colour, at most 6 colours; all of Poland\'s land neighbours are there', () => {
    const ns = neighbors(topo.objects.countries.geometries);
    geoms.forEach((g, i) => { for (const j of ns[i]!) expect(geoms[j]!.properties!.c, `${g.id}–${geoms[j]!.id}`).not.toBe(g.properties!.c); });
    expect(Math.max(...geoms.map((g) => g.properties!.c))).toBeLessThan(6);
    const pol = geoms.findIndex((g) => g.id === 'POL');
    expect(ns[pol]!.map((j) => geoms[j]!.id).sort()).toEqual(['BLR', 'CZE', 'DEU', 'LTU', 'RUS', 'SVK', 'UKR']);
  });

  test('label data: a point in range, a label zoom and a region code Intl knows in every language (or none)', () => {
    for (const g of geoms) {
      const p = g.properties!;
      expect(Math.abs(p.lx), String(g.id)).toBeLessThanOrEqual(180);
      expect(Math.abs(p.ly), String(g.id)).toBeLessThanOrEqual(90);
      expect(p.ml, String(g.id)).toBeGreaterThan(0);
      if (p.a2 === '') continue;
      expect(p.a2).toMatch(/^[A-Z]{2}$/);
      for (const lang of ['en', 'pl', 'uk']) expect(new Intl.DisplayNames([lang], { type: 'region' }).of(p.a2), `${lang} ${p.a2}`).not.toBe(p.a2);
    }
    const pol = geoms.find((g) => g.id === 'POL')!.properties!;
    expect(new Intl.DisplayNames(['uk'], { type: 'region' }).of(pol.a2)).toBe('Польща');
    expect(geoms.find((g) => g.id === 'KOS')!.properties!.a2).toBe('XK');
  });
});
```

Run: `npx vitest run tests/unit/political-data.test.ts` — Expected: FAIL (JSON not found).

- [ ] **Step 5: Implement `scripts/build-political.ts`**

```ts
// Builds src/map/data/political-pol.json — country shapes for the Political map style (Map styles spec §3): pastel
// fills whose neighbours differ, the coast and borders drawn from the same shapes, and label data. Natural Earth's
// Poland point of view, like src/map/data/world-borders-pol.json (scripts/build-world-borders.ts): Crimea, Sevastopol,
// Donetsk and Luhansk in Ukraine; Kosovo a country; Western Sahara in Morocco.
//
// Source: Natural Earth (public domain), https://www.naturalearthdata.com/, GeoJSON mirror
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (VERSION 5.1.1, retrieved 2026-09-15):
//   ne_10m_admin_0_countries_pol.
//
// Usage:
//   node --experimental-strip-types scripts/build-political.ts [download-dir] [--download]
// download-dir defaults to .cache/natural-earth (git-ignored, shared with data:borders).
//
// Processing: countries of MIN_AREA square degrees or more → one topology (shared borders simplify identically) →
// Visvalingam weights, vertices under MIN_WEIGHT dropped → rings under RING_MIN_AREA dropped → quantized. Colours
// by DSatur over shared arcs (scripts/political-colours.ts). Properties per country: a2 (ISO_A2_EH, '' if none),
// c (colour), lr (LABELRANK), ml (MIN_LABEL), lx/ly (LABEL_X/LABEL_Y).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { filter, filterWeight, presimplify, simplify } from 'topojson-simplify';
import { feature, neighbors, quantize } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { colourCountries } from './political-colours.ts';

const OUT = 'src/map/data/political-pol.json';
const DEFAULT_DIR = '.cache/natural-earth';
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILE = 'ne_10m_admin_0_countries_pol';
const NE_VERSION = '5.1.1';
const MIN_AREA = 0.02;      // square degrees: Malta (0.03) and Andorra stay, Liechtenstein (0.02−) goes
const MIN_WEIGHT = 0.004;   // square degrees (Visvalingam): about Natural Earth 50m detail
const RING_MIN_AREA = 0.01; // square degrees: islets below this disappear
const QUANTIZATION = 1e5;
const SQ_DEG_PER_STERADIAN = (180 / Math.PI) ** 2;

interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }

async function ensure(dir: string, download: boolean): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${FILE}.geojson`);
  if (existsSync(path)) return path;
  if (!download) throw new Error(`Missing ${path} (run with --download or fetch ${BASE}${FILE}.geojson)`);
  const res = await fetch(`${BASE}${FILE}.geojson`);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${FILE}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

/** Area in square degrees, whichever way the rings are wound. */
function areaSqDeg(f: Feature): number {
  const a = geoArea(f);
  return Math.min(a, 4 * Math.PI - a) * SQ_DEG_PER_STERADIAN;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) ?? DEFAULT_DIR;
  const source = JSON.parse(readFileSync(await ensure(dir, args.includes('--download')), 'utf8')) as FeatureCollection<Polygon | MultiPolygon>;

  const features: Feature<Polygon | MultiPolygon, CountryProps>[] = [];
  for (const f of source.features) {
    if (areaSqDeg(f) < MIN_AREA) continue;
    const p = f.properties as Record<string, unknown>;
    const a2 = String(p.ISO_A2_EH);
    features.push({
      type: 'Feature', id: String(p.ADM0_A3_PL), geometry: f.geometry,
      properties: { a2: /^[A-Z]{2}$/.test(a2) ? a2 : '', c: 0, lr: Number(p.LABELRANK), ml: Number(p.MIN_LABEL), lx: Math.round(Number(p.LABEL_X) * 100) / 100, ly: Math.round(Number(p.LABEL_Y) * 100) / 100 },
    });
  }

  const raw = topology({ countries: { type: 'FeatureCollection', features } as FeatureCollection }) as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
  const simple = simplify(presimplify(raw), MIN_WEIGHT);
  const filtered = filter(simple, filterWeight(simple, RING_MIN_AREA)) as typeof raw;
  const out = quantize(filtered, QUANTIZATION) as typeof raw;

  const geoms = out.objects.countries.geometries;
  const colours = colourCountries(geoms.map((g) => String(g.id)), neighbors(geoms));
  geoms.forEach((g, i) => { g.properties = { ...g.properties!, c: colours[i]! }; });

  // d3 draws a polygon's exterior ring clockwise; a ring wound the other way would cover the rest of the sphere.
  const check = feature(out, out.objects.countries);
  for (const f of check.features) if (geoArea(f) > 2 * Math.PI) throw new Error(`${f.id}: wound counter-clockwise (fix rings before topology)`);

  const json = JSON.stringify({ ...out, source: `Natural Earth ${NE_VERSION} 10m admin-0 countries, Poland point of view (public domain), naturalearthdata.com; simplified by scripts/build-political.ts` });
  writeFileSync(OUT, json);
  const points = out.arcs.reduce((n, a) => n + a.length, 0);
  console.log(`${OUT}: ${json.length} B (${(json.length / 1024).toFixed(1)} KiB); ${geoms.length} countries, ${points} arc points, ${Math.max(...colours) + 1} colours`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
```
If `@types/topojson-simplify` lacks `filterWeight`, import it anyway through `import * as simplifyLib from 'topojson-simplify'` and cast, or filter with `planarRingArea` from the same package: `filter(simple, (ring) => Math.abs(planarRingArea(ring)) >= RING_MIN_AREA)`. If the winding check throws, rewind each polygon ring in `features` before `topology()` (reverse every ring of a polygon whose `geoArea` of its exterior ring is > 2π), as `…/scratchpad/map-styles/vector.mjs` `rewind()` does.

Add to `package.json` scripts: `"data:political": "node --experimental-strip-types scripts/build-political.ts"`.

- [ ] **Step 6: Build and tune**

Run: `npm run data:political`
Expected: `src/map/data/political-pol.json: … KiB; ≈ 230 countries, … colours` with the size under 300 KiB.
Run: `npx vitest run tests/unit/political-data.test.ts`
If Sevastopol falls outside Ukraine, lower `MIN_WEIGHT` (0.004 → 0.002); if the file is over 300 KiB, raise `MIN_WEIGHT` or lower `QUANTIZATION` to `5e4`. Stop at the first setting where every test passes and note the chosen values and size in the header comment.
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
npm run check && npm test
git add scripts/political-colours.ts scripts/build-political.ts src/map/data/political-pol.json tests/unit/political-colours.test.ts tests/unit/political-data.test.ts package.json
git commit -m "build(data): political country shapes in Poland's point of view, neighbours coloured apart"
```

---

### Task 4: Physical rivers and lakes

World rivers and lakes at Natural Earth 50m for the Physical style. (Central Europe keeps using the detailed rivers and lakes already in `src/map/data/central-europe.json`.)

**Files:**
- Create: `scripts/build-physical-water.ts`
- Create (generated, committed): `src/map/data/physical-water.json`
- Modify: `package.json` (script `data:water`)
- Test: `tests/unit/physical-water-data.test.ts`

**Interfaces:**
- Consumes: `ne_50m_rivers_lake_centerlines.geojson`, `ne_50m_lakes.geojson` (Natural Earth 5.x, properties `scalerank`, `featurecla`).
- Produces: `src/map/data/physical-water.json`: quantized `Topology<{ rivers: GeometryCollection<{ r: number }>; lakes: GeometryCollection<{ r: number }> }>` plus `source`; `r` = Natural Earth `scalerank` (0 = most important). Lake polygons are wound for d3 (exterior clockwise).

- [ ] **Step 1: Copy the sources**

```bash
RAW=/tmp/claude-997/-srv-work-geo-coordinates-viz/8881ec1b-a091-4263-ad3d-faaf2e54929a/scratchpad/map-styles/raw
cp "$RAW/ne_50m_rivers_lake_centerlines.geojson" "$RAW/ne_50m_lakes.geojson" .cache/natural-earth/
```

- [ ] **Step 2: Failing test `tests/unit/physical-water-data.test.ts`**

```ts
import { geoArea, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { expect, test } from 'vitest';
import waterJson from '../../src/map/data/physical-water.json';

const topo = waterJson as unknown as Topology<{ rivers: GeometryCollection<{ r: number }>; lakes: GeometryCollection<{ r: number }> }> & { source: string };
const rivers = feature(topo, topo.objects.rivers);
const lakes = feature(topo, topo.objects.lakes);
const RAD = Math.PI / 180;
const nearRiver = (lon: number, lat: number, deg: number) => rivers.features.some((f) => {
  const g = f.geometry;
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  return lines.some((l) => l.some(([x, y]) => geoDistance([x!, y!], [lon, lat]) < deg * RAD));
});

test('stays small, names its source, keeps a scale rank per feature', () => {
  expect(JSON.stringify(waterJson).length).toBeLessThan(260 * 1024);
  expect(topo.source).toMatch(/Natural Earth.*50m rivers.*lakes/);
  for (const g of [...topo.objects.rivers.geometries, ...topo.objects.lakes.geometries]) expect(Number.isInteger(g.properties!.r)).toBe(true);
  expect(topo.objects.rivers.geometries.length).toBeGreaterThan(300);
});

test('real rivers and lakes are where they should be', () => {
  expect(nearRiver(31.23, 30.05, 0.5)).toBe(true);   // the Nile at Cairo
  expect(nearRiver(-60.0, -3.1, 0.6)).toBe(true);    // the Amazon near Manaus
  expect(nearRiver(19.0, 52.4, 0.6)).toBe(true);     // the Vistula
  expect(lakes.features.some((f) => geoContains(f, [33.0, -1.0]))).toBe(true);   // Lake Victoria
  expect(lakes.features.some((f) => geoContains(f, [-87.0, 44.0]))).toBe(true);  // Lake Michigan
});

test('lake polygons are wound the way d3 expects', () => {
  for (const f of lakes.features) expect(geoArea(f)).toBeLessThan(0.1);
});
```

Run: `npx vitest run tests/unit/physical-water-data.test.ts` — Expected: FAIL (JSON not found).

- [ ] **Step 3: Implement `scripts/build-physical-water.ts`**

```ts
// Builds src/map/data/physical-water.json — world rivers and lakes for the Physical map style (Map styles spec §3).
// Central Europe uses its own detailed rivers and lakes (src/map/data/central-europe.json) from zoom 4 and 6.
//
// Source: Natural Earth (public domain) 5.1.1, https://www.naturalearthdata.com/, GeoJSON mirror
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (retrieved 2026-09-15):
//   ne_50m_rivers_lake_centerlines, ne_50m_lakes.
// Usage: node --experimental-strip-types scripts/build-physical-water.ts [download-dir] [--download]
//   (download-dir defaults to .cache/natural-earth)
//
// Processing: rivers and lake centre lines with scalerank ≤ MAX_RANK, lakes → rings wound for d3 (exterior
// clockwise on the sphere) → one topology → Visvalingam simplification (MIN_WEIGHT) → quantized. Properties: r = scalerank.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { quantize } from 'topojson-client';

const OUT = 'src/map/data/physical-water.json';
const DEFAULT_DIR = '.cache/natural-earth';
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILES = { rivers: 'ne_50m_rivers_lake_centerlines', lakes: 'ne_50m_lakes' } as const;
const MAX_RANK = 9;
const MIN_WEIGHT = 0.0005; // square degrees
const QUANTIZATION = 1e5;

async function read(dir: string, name: string, download: boolean): Promise<FeatureCollection> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.geojson`);
  if (!existsSync(path)) {
    if (!download) throw new Error(`Missing ${path} (run with --download or fetch ${BASE}${name}.geojson)`);
    const res = await fetch(`${BASE}${name}.geojson`);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${name}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(path, 'utf8')) as FeatureCollection;
}

/** Reverses a polygon's rings when d3 would read its exterior as the rest of the sphere. */
function windForD3(g: Geometry): Geometry {
  const fix = (rings: Position[][]) => (geoArea({ type: 'Polygon', coordinates: [rings[0]!] }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings);
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: fix(g.coordinates) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(fix) };
  return g;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) ?? DEFAULT_DIR;
  const download = args.includes('--download');
  const slim = (fc: FeatureCollection, wind: boolean): FeatureCollection => ({
    type: 'FeatureCollection',
    features: fc.features
      .filter((f): f is Feature & { geometry: Geometry } => f.geometry !== null && Number(f.properties?.scalerank ?? 99) <= MAX_RANK)
      .map((f) => ({ type: 'Feature', properties: { r: Number(f.properties!.scalerank) }, geometry: wind ? windForD3(f.geometry) : f.geometry })),
  });
  const rivers = slim(await read(dir, FILES.rivers, download), false);
  const lakes = slim(await read(dir, FILES.lakes, download), true);
  const out = quantize(simplify(presimplify(topology({ rivers, lakes })), MIN_WEIGHT), QUANTIZATION);
  const json = JSON.stringify({ ...out, source: 'Natural Earth 5.1.1 50m rivers and lake centre lines, 50m lakes (public domain), naturalearthdata.com; simplified by scripts/build-physical-water.ts' });
  writeFileSync(OUT, json);
  console.log(`${OUT}: ${json.length} B (${(json.length / 1024).toFixed(1)} KiB); ${rivers.features.length} rivers, ${lakes.features.length} lakes`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
```
Add to `package.json` scripts: `"data:water": "node --experimental-strip-types scripts/build-physical-water.ts"`.

- [ ] **Step 4: Build, tune, test**

Run: `npm run data:water && npx vitest run tests/unit/physical-water-data.test.ts`
Expected: under 260 KiB and PASS (3 tests). If the file is too big, lower `MAX_RANK` to 8 or raise `MIN_WEIGHT` (keep the Vistula test passing); record the final values in the header.

- [ ] **Step 5: Confirm the whole data set fits the budget**

Run: `npm run build`
Expected: total under ≈ 3600 KiB (political and water JSON are not bundled yet — Tasks 12 and 13 import them; add their sizes, ≈ 500 KiB, to the printed total and confirm it stays under 4400 KiB).

- [ ] **Step 6: Commit**

```bash
npm run check && npm test
git add scripts/build-physical-water.ts src/map/data/physical-water.json tests/unit/physical-water-data.test.ts package.json
git commit -m "build(data): world rivers and lakes for the Physical style"
```
