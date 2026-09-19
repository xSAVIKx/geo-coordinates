# Part 3 — Size budget and embedding (spec §9.3)

Task 3 puts the new data into the built file, raises the limit to 8 MiB, makes the breakdown list each place, and
writes the five new licence notices. The page still draws nothing new.

---

### Task 3: Embed the photos and streets, raise the budget to 8 MiB, add the notices

**Files:**
- Create: `scripts/city-plugin.ts`
- Modify: `vite.config.ts` (register the plugin), `scripts/size-report.ts`, `scripts/size-check.ts`,
  `scripts/licence-notices.ts`, `LICENSE-CONTENT.md`
- Test: `tests/unit/city-plugin.test.ts`, `tests/unit/size-report.test.ts` (extend), `tests/unit/licence-notices.test.ts` (extend),
  `tests/e2e/city-data-embedded.spec.ts`

**Interfaces:**
- Consumes (Tasks 1–2): `src/map/data/city/photos/manifest.json` with
  `{ generatedBy: string, photos: Record<id, { file, width, height, bounds, source, sourceName, licence, scene, captured, cloud, groundM, bytes, mime }> }`;
  `src/map/data/city/streets/manifest.json` with
  `{ generatedBy: string, attribution: '© OpenStreetMap contributors (ODbL)', streets: Record<id, { file, bytes, arcs, roads, named, rail, water, green, places, retrieved }> }`;
  `src/map/data/city/boxes.json`.
- Produces:
  ```ts
  // scripts/city-plugin.ts
  export const CITY_DIR: string;                       // resolved src/map/data/city
  export const PHOTO_SCRIPT_TYPE = 'application/x-geo-photo';
  export const STREET_SCRIPT_TYPE = 'application/x-geo-city';
  export function cityBlocks(dir?: string): string;    // the <script> data blocks, newline-separated
  export function cityData(dir?: string): Plugin;      // the Vite plugin
  // element ids in the page: geo-photo-<id> (base64 WebP) and geo-city-<id> (raw TopoJSON text)
  // scripts/size-report.ts
  export interface SizePart { name: string; bytes: number }   // unchanged; new names "photo <id>", "streets <id>"
  // scripts/licence-notices.ts
  export const DATA_NOTICES: Notice[];                  // gains six entries (five photo sources + OpenStreetMap)
  ```

---

- [ ] **Step 1: Write the failing test `tests/unit/city-plugin.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import photoManifest from '../../src/map/data/city/photos/manifest.json';
import streetManifest from '../../src/map/data/city/streets/manifest.json';
import boxesJson from '../../src/map/data/city/boxes.json';
import { cityBlocks, PHOTO_SCRIPT_TYPE, STREET_SCRIPT_TYPE } from '../../scripts/city-plugin';

const html = cityBlocks();
const ids = boxesJson.boxes.map((b) => b.id);

describe('city data blocks', () => {
  test('one photo block and one street block per box, in the boxes.json order', () => {
    expect([...html.matchAll(/id="geo-photo-([a-z]+)"/g)].map((m) => m[1])).toEqual(ids);
    expect([...html.matchAll(/id="geo-city-([a-z]+)"/g)].map((m) => m[1])).toEqual(ids);
    expect(html).toContain(`type="${PHOTO_SCRIPT_TYPE}"`);
    expect(html).toContain(`type="${STREET_SCRIPT_TYPE}"`);
  });

  test('a photo block is the base64 of its file, and carries its size for the decoder', () => {
    const p = photoManifest.photos.katowice;
    const b64 = readFileSync(`src/map/data/city/photos/${p.file}`).toString('base64');
    const block = new RegExp(`<script type="${PHOTO_SCRIPT_TYPE}" id="geo-photo-katowice" data-width="(\\d+)" data-height="(\\d+)">([A-Za-z0-9+/=]+)</script>`).exec(html)!;
    expect(block[1]).toBe(String(p.width));
    expect(block[2]).toBe(String(p.height));
    expect(block[3]).toBe(b64);
  });

  test('a street block is the file text itself, parses as its topology, and can never close its own script tag', () => {
    const text = readFileSync('src/map/data/city/streets/katowice.json', 'utf8');
    expect(html).toContain(`<script type="${STREET_SCRIPT_TYPE}" id="geo-city-katowice">${text}</script>`);
    expect(JSON.parse(text)).toHaveProperty('objects.roads');
    for (const id of ids) {
      expect(readFileSync(`src/map/data/city/streets/${id}.json`, 'utf8').toLowerCase(), id).not.toContain('</script');
    }
  });

  test('the blocks together are what the 8 MiB budget expects (planning ruling R22)', () => {
    const photos = Object.values(photoManifest.photos).reduce((n, p) => n + Math.ceil(p.bytes / 3) * 4, 0);
    const streets = Object.values(streetManifest.streets).reduce((n, s) => n + s.bytes, 0);
    expect(Buffer.byteLength(html, 'utf8')).toBeGreaterThan(photos + streets);          // plus the tags
    expect(photos + streets, `${((photos + streets) / 1024 / 1024).toFixed(2)} MiB`).toBeLessThan(4.4 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Write `scripts/city-plugin.ts`**

```ts
// The city close-up data (src/map/data/city, built by scripts/build-city-photos.py and
// scripts/build-city-streets.ts) inside the single built file. Each photo goes in as base64 and each box's street
// topology as its own JSON text, in <script> blocks the browser never runs or parses as code — exactly the model
// scripts/textures-plugin.ts uses for the world textures. src/map/texture/cityAssets.ts decodes a photo and
// src/map/streets.ts parses a topology only when the view first enters that box (planning ruling R8), so a page
// that never opens a close-up pays nothing at load. Blocks go right before </body>, after Vite has built the page
// ('post'), so vite-plugin-singlefile and the licence notices never touch them.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const CITY_DIR = resolve(import.meta.dirname, '../src/map/data/city');
export const PHOTO_SCRIPT_TYPE = 'application/x-geo-photo';
export const STREET_SCRIPT_TYPE = 'application/x-geo-city';

interface PhotoManifest { photos: Record<string, { file: string; width: number; height: number }> }
interface BoxesFile { boxes: { id: string }[] }

export function cityBlocks(dir = CITY_DIR): string {
  const boxes = JSON.parse(readFileSync(join(dir, 'boxes.json'), 'utf8')) as BoxesFile;
  const photos = (JSON.parse(readFileSync(join(dir, 'photos', 'manifest.json'), 'utf8')) as PhotoManifest).photos;
  const out: string[] = [];
  for (const { id } of boxes.boxes) {
    const p = photos[id];
    if (!p) throw new Error(`city-plugin: no photo for ${id} (run npm run data:city-photos)`);
    const b64 = readFileSync(join(dir, 'photos', p.file)).toString('base64');
    out.push(`<script type="${PHOTO_SCRIPT_TYPE}" id="geo-photo-${id}" data-width="${p.width}" data-height="${p.height}">${b64}</script>`);
  }
  for (const { id } of boxes.boxes) {
    const text = readFileSync(join(dir, 'streets', `${id}.json`), 'utf8');
    // TopoJSON holds only numbers, arrays and quoted names, so it can never contain the closing tag; check anyway,
    // because a silently truncated block would fail at runtime instead of at build time.
    if (/<\/script/i.test(text)) throw new Error(`city-plugin: ${id}.json contains a closing script tag`);
    out.push(`<script type="${STREET_SCRIPT_TYPE}" id="geo-city-${id}">${text}</script>`);
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
```

Register it in `vite.config.ts` right after `mapTextures()` (the same `'post'` ordering applies, and the two
plugins each insert before `</body>`, so the city blocks end up after the texture blocks):
```ts
import { cityData } from './scripts/city-plugin.ts';
// …
plugins: [ /* …existing… */ mapTextures(), cityData(), /* …existing… */ ],
```
Read `vite.config.ts` before editing and keep the existing order of everything else.

- [ ] **Step 3: Run the plugin test**

```bash
npx vitest run tests/unit/city-plugin.test.ts
```
Expected: PASS.

- [ ] **Step 4: Per-place lines in the size report**

`scripts/size-report.ts` currently strips the texture blocks, then the module scripts, then the styles. Add the two
city block kinds **before** the module-script rule (they are `<script type="…">` too, and the module rule would
otherwise be reached first by an unlucky regex). Replace the body of `sizeBreakdown` with:

```ts
export function sizeBreakdown(html: string): SizePart[] {
  const parts: SizePart[] = [];
  const strip = (s: string, re: RegExp, name: (id: string) => string) =>
    s.replace(re, (m, id: string) => { parts.push({ name: name(id), bytes: bytes(m) }); return ''; });
  let rest = strip(html, /<script type="application\/x-geo-texture" id="geo-texture-([a-z-]+)"[^>]*>[^<]*<\/script>\n?/g, (id) => `texture ${id}`);
  rest = strip(rest, /<script type="application\/x-geo-photo" id="geo-photo-([a-z]+)"[^>]*>[^<]*<\/script>\n?/g, (id) => `photo ${id}`);
  rest = strip(rest, /<script type="application\/x-geo-city" id="geo-city-([a-z]+)"[^>]*>[^<]*<\/script>\n?/g, (id) => `streets ${id}`);
  let js = 0;
  rest = rest.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, (m) => { js += bytes(m); return ''; });
  let css = 0;
  rest = rest.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (m) => { css += bytes(m); return ''; });
  parts.push({ name: 'app script and vector data', bytes: js }, { name: 'styles', bytes: css }, { name: 'html and head', bytes: bytes(rest) });
  return parts;
}
```

Add to `tests/unit/size-report.test.ts` (read the file first; keep its existing tests):
```ts
test('city photos and street data get a line each, named by their place', () => {
  const html = [
    '<html><body>',
    '<script type="application/x-geo-texture" id="geo-texture-physical-world">AAAA</script>',
    '<script type="application/x-geo-photo" id="geo-photo-katowice" data-width="1440" data-height="960">BBBB</script>',
    '<script type="application/x-geo-city" id="geo-city-katowice">{"objects":{}}</script>',
    '<script type="module">const a = 1;</script>',
    '<style>body{margin:0}</style>',
    '</body></html>',
  ].join('\n');
  const names = sizeBreakdown(html).map((p) => p.name);
  expect(names).toEqual(['texture physical-world', 'photo katowice', 'streets katowice',
    'app script and vector data', 'styles', 'html and head']);
  const photo = sizeBreakdown(html).find((p) => p.name === 'photo katowice')!;
  expect(photo.bytes).toBeGreaterThan(90);          // the tag plus its four base64 characters
});
```

- [ ] **Step 5: The 8 MiB limit and the new notices in `scripts/size-check.ts`**

Change the limit and the comment, and add the six new notice checks:
```ts
// Places up close spec §7: the single file stays under 8 MiB (textures, city photos and street data included).
const LIMIT = 8_388_608;
```
and extend the `missing` list with these six patterns (keep every existing one):
```ts
  /^Copernicus Sentinel-2 imagery \(Free, full and open\)/m,
  /^OpenStreetMap \(ODbL 1\.0\)/m,
  /^GUGiK ORTOFOTOMAPA \(Geoportal regulations\)/m,
  /^IGN BD ORTHO \(Licence Ouverte Etalab 2\.0\)/m,
  /^GSI seamlessphoto \(GSI tile terms\)/m,
  /^USDA-FSA NAIP \(Public domain\)/m,
```
The head slice `html.slice(0, 20_000)` is no longer enough for a comment that has grown by six blocks: raise it to
`html.slice(0, 40_000)` and check by eye that the comment still ends before that in the built file.

- [ ] **Step 6: The notices themselves, in `scripts/licence-notices.ts`**

Append to `DATA_NOTICES` (keep the Natural Earth and NASA entries unchanged). Use the **exact** licence strings
Task 1 recorded in `src/map/data/city/photos/manifest.json` — if Task 1's Step 6 found different GUGiK wording,
that wording goes here:
```ts
}, {
  name: 'Copernicus Sentinel-2 imagery', version: 'Free, full and open', license: 'Free, full and open',
  url: 'https://sentinels.copernicus.eu/',
  text: 'City close-up photos for Greenwich, Mitad del Mundo, Rovaniemi, Delhi, Sydney and Giza contain modified Copernicus Sentinel data 2025-2026, obtained from the Earth Search catalogue on AWS. Copernicus Sentinel data are made available under the Copernicus free, full and open data policy.',
}, {
  name: 'OpenStreetMap', version: 'ODbL 1.0', license: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright',
  text: 'Street, railway, water and park data inside the twelve city close-up boxes is (c) OpenStreetMap contributors, available under the Open Database Licence (ODbL) 1.0. Any rights in individual contents of the database are licensed under the Database Contents Licence.',
}, {
  name: 'GUGiK ORTOFOTOMAPA', version: 'Geoportal regulations', license: 'Geoportal regulations',
  url: 'https://www.geoportal.gov.pl/', text: 'City close-up photos for Katowice, Warsaw and Krakow: Ortofotomapa, Glowny Urzad Geodezji i Kartografii, geoportal.gov.pl. The service capabilities state no access constraints; use of the service means accepting the Geoportal regulations.',
}, {
  name: 'IGN BD ORTHO', version: 'Licence Ouverte Etalab 2.0', license: 'Licence Ouverte Etalab 2.0',
  url: 'https://data.geopf.fr/', text: 'The city close-up photo for Paris: Orthophotos (c) IGN / Geoplateforme (data.geopf.fr), Licence Ouverte / Open Licence Etalab 2.0.',
}, {
  name: 'GSI seamlessphoto', version: 'GSI tile terms', license: 'GSI tile terms',
  url: 'https://maps.gsi.go.jp/development/ichiran.html', text: 'The city close-up photo for Tokyo is made from the Geospatial Information Authority of Japan seamlessphoto tiles and has been processed (cropped and resampled).',
}, {
  name: 'USDA-FSA NAIP', version: 'Public domain', license: 'Public domain',
  url: 'https://imagery.nationalmap.gov/', text: 'The city close-up photo for Manhattan: USDA-FSA National Agriculture Imagery Program (NAIP), obtained through the USGS imagery service. US federal imagery is in the public domain.',
}];
```
Note `noticeComment` spaces out any run of two or more dashes, so avoid `--` in these texts (none above has one),
and write `(c)` rather than `©` in the comment texts to match the existing entries' plain-ASCII style.

Add to `tests/unit/licence-notices.test.ts` (read the file first; keep its existing tests):
```ts
test('the six city close-up data notices travel with the file, one per source', () => {
  const comment = noticeComment(DATA_NOTICES);
  for (const name of ['Copernicus Sentinel-2 imagery', 'OpenStreetMap', 'GUGiK ORTOFOTOMAPA', 'IGN BD ORTHO',
    'GSI seamlessphoto', 'USDA-FSA NAIP']) expect(comment).toContain(name);
  expect(comment).toContain('Contains modified Copernicus Sentinel data');
  expect(comment).toContain('Open Database Licence (ODbL) 1.0');
  expect(comment).not.toMatch(/--/);          // an HTML comment may not contain two dashes
});
```

- [ ] **Step 7: `LICENSE-CONTENT.md`**

Read the file, then add a "City close-up photos and street data" section listing the six sources, which boxes each
covers, and the exact credit line for each (the same strings as the notices). Keep the file's existing shape and
tone.

- [ ] **Step 8: Build and read the breakdown**

```bash
npm run build
```
Expected: the build prints `dist/geo-coordinates.html: <n> KiB of 8192 KiB` followed by a breakdown with twelve
`photo <id>` lines, twelve `streets <id>` lines, the five `texture …` lines and the rest, then
`third-party licence notices present`. Planning ruling R22 expects a total around **7.5 MiB**. Write the real
number and the full breakdown in the report.

If the file is at or over 8,388,608 B, apply the levers in order and re-run the data build for the boxes affected:
1. Drop Warsaw, Kraków, Paris, Manhattan and Tokyo to `photoWidth: 1024, photoHeight: 683` in
   `scripts/city-boxes.ts` (≈ −275 KiB before base64, ≈ −367 KiB in the page).
2. Raise `MIN_WEIGHT` in `scripts/build-city-streets.ts` by 3× for the boxes over 150 KiB.
3. Drop road class 5 (`pedestrian`) from `ROAD_CLASSES`.
4. Only then consider planning ruling R7's varint encoding, and say so in the report — it is a bigger change than
   this task.

- [ ] **Step 9: An e2e test that the data really reached the page**

`tests/e2e/city-data-embedded.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json';
import { openPage, pageErrors } from './helpers';

const ids = boxesJson.boxes.map((b) => b.id);

test('every close-up photo and street topology is in the file, and none of it is parsed at load', async ({ page }) => {
  await openPage(page, 'en/lab');
  const found = await page.evaluate(() => ({
    photos: [...document.querySelectorAll('script[type="application/x-geo-photo"]')].map((e) => e.id),
    streets: [...document.querySelectorAll('script[type="application/x-geo-city"]')].map((e) => e.id),
  }));
  expect(found.photos).toEqual(ids.map((id) => `geo-photo-${id}`));
  expect(found.streets).toEqual(ids.map((id) => `geo-city-${id}`));
  // A data block is text, never code: nothing in it may have run.
  expect(pageErrors(page)).toEqual([]);
  const sample = await page.evaluate(() => {
    const t = document.getElementById('geo-city-katowice')!.textContent!;
    const p = document.getElementById('geo-photo-katowice')!.textContent!;
    return { hasRoads: JSON.parse(t).objects.roads !== undefined, base64: /^[A-Za-z0-9+/=]+$/.test(p), photoLen: p.length };
  });
  expect(sample.hasRoads).toBe(true);
  expect(sample.base64).toBe(true);
  expect(sample.photoLen).toBeGreaterThan(100_000);
});
```

```bash
npm run build && npx playwright test tests/e2e/city-data-embedded.spec.ts
```
Expected: PASS.

- [ ] **Step 10: Full check and commit**

```bash
npm run check && npm test
npm run build
npx playwright test tests/e2e/atlas-baseline.spec.ts tests/e2e/textures-embedded.spec.ts tests/e2e/offline.spec.ts
git add scripts/city-plugin.ts scripts/size-report.ts scripts/size-check.ts scripts/licence-notices.ts \
  vite.config.ts LICENSE-CONTENT.md tests/unit/city-plugin.test.ts tests/unit/size-report.test.ts \
  tests/unit/licence-notices.test.ts tests/e2e/city-data-embedded.spec.ts
git commit -m "build: embed the city close-up photos and streets, raise the budget to 8 MiB"
```
The Atlas baselines must still pass with zero diff: nothing the page draws has changed yet.

**Report:** the built file's exact byte size, the full per-asset breakdown, the headroom left under 8,388,608 B,
and any lever from Step 8 you had to pull.
