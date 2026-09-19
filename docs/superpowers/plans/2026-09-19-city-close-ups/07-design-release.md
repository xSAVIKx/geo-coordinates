# Part 7 — Design, UX and accessibility pass; release prep (spec §9.7)

Context both tasks need:
- Everything from Tasks 1–7 is in place: twelve boxes with photos from five sources and street maps, a third
  texture blend level, a street layer in all four styles, the "Places up close" list, the three teaching notes,
  topic 9's extra sentence and the settings switch.
- E2E helpers (`tests/e2e/helpers.ts`): `openPage(page, hash, query)`, `pageErrors`, `expectNoAxeViolations`,
  `setMapStyle(page, style)` (needs `?test`), `waitForTexture(page, view, draws?)`, `probe(page, view, lat, lon, radius?)`,
  `textureHooks(page)`, `setFlatView(page, lat, lon, zoom)`.
- A style is preselected for a fresh page with
  `page.addInitScript(() => localStorage.setItem('geo-coords:map-style', '<style>'))`; the close-ups are turned
  off with `localStorage.setItem('geo-coords:close-ups', 'off')`.
- Go to a box with `page.evaluate((id) => window.__mapState.showCityBox(id), '<id>')`.
- Screenshot tools: `npm run shot -- <hash> <name>` (full page at 375 × 667 and 1366 × 768 into `shots/`),
  `npm run shots:readme` (README screenshots, after a build).
- Owner rules for release: **no push, no merge to `main`**; the owner reviews the branch.

---

### Task 8: Design, UX and accessibility pass across the twelve

A review gate across box × style × theme × width, with the fixes it finds. Deliverable: one new e2e spec that
passes, fixes committed, and a written findings list in the report.

**Files:**
- Create: `tests/e2e/city-a11y.spec.ts`
- Modify: whatever the review finds, limited to the close-up work (`src/map/streets.ts`,
  `src/map/layers/Streets.svelte`, `src/map/styleLabels.ts`, `src/map/CloseUpList.svelte`,
  `src/map/CloseUpNote.svelte`, `src/map/cityBoxes.ts`, `src/map/texture/shaders.ts` + `cpuShade.ts` together,
  `src/styles/tokens.css`, `src/styles/base.css`, `src/i18n/*.json`, and — only to rebuild one box —
  `scripts/city-boxes.ts` plus `src/map/data/city/**`). **Never** an Atlas token, never an Atlas baseline snapshot.

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: no new public interfaces.

- [ ] **Step 1: The accessibility and layout spec `tests/e2e/city-a11y.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json';
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const go = (page: Page, id: string) =>
  page.evaluate((i) => (window as unknown as { __mapState: { showCityBox(id: string): unknown } }).__mapState.showCityBox(i), id);

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`WCAG AA inside a close-up box: ${style}, ${scheme}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
      for (const id of ['katowice', 'greenwich', 'manhattan']) {
        await go(page, id);
        await expect(page.locator(`.view-flat g.streets[data-city-box="${id}"]`)).toHaveCount(1);
        await expectNoAxeViolations(page, `${id} ${style} ${scheme}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }
}

test('AAA in presenter mode inside a box', async ({ page }) => {
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  await go(page, 'katowice');
  await page.locator('body').press('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  const r = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
  expect(r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
});

for (const width of [320, 375, 768, 1366]) {
  test(`no horizontal scroll at ${width} px with a close-up open`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    for (const lang of ['en', 'pl', 'uk'] as const) {
      await openPage(page, `${lang}/lab`, '?test');
      await go(page, 'mitaddelmundo');
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${lang} ${width}`).toBeLessThanOrEqual(width);
    }
  });
}

test('the close-up list is keyboard operable and its targets are 44 px on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'en/lab');
  const summary = page.getByText('Places up close', { exact: true }).first();
  await summary.focus();
  await page.keyboard.press('Enter');
  const buttons = page.getByRole('button', { name: /up close$/ });
  await expect(buttons).toHaveCount(12);
  for (const size of await buttons.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, e.textContent?.trim()]; }))) {
    expect(size[1] as number, String(size[2])).toBeGreaterThanOrEqual(44);
  }
  const summaryBox = (await summary.boundingBox())!;
  expect(summaryBox.height).toBeGreaterThanOrEqual(44);
  await buttons.first().focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { __mapState: { flat: { zoom: number } } }).__mapState?.flat.zoom ?? 0)).toBeGreaterThan(0);
});

test('the twelve boxes all draw something in every style, with no page errors', async ({ page }) => {
  test.setTimeout(240_000);
  await openPage(page, 'en/lab', '?test');
  for (const style of STYLES) {
    await setMapStyle(page, style);
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    for (const b of boxesJson.boxes) {
      await go(page, b.id);
      await expect(page.locator('.view-flat g.streets path.road').first(), `${b.id} ${style}`).toBeVisible();
    }
  }
  expect(pageErrors(page)).toEqual([]);
});
```

```bash
npm run build && npx playwright test tests/e2e/city-a11y.spec.ts
```
Write down every failure. Fix them in Step 4; never relax a bound without writing the measured value and the
reason in the report.

- [ ] **Step 2: The visual review — look, do not guess**

For each of the twelve boxes, in **Atlas, Physical, Satellite and Political**, light and dark, at 375 × 667 and
1366 × 768 (and the school box also at 1920 × 1080 in presenter mode), check and note:

1. **The photo.** In the six sharp boxes, are buildings really readable, or did WebP quality 65 smear them? In the
   six Sentinel boxes, does it read as a city from above rather than as coloured noise? Any cloud, haze, snow,
   deep shadow or seam over the middle of the box (re-run that box per Task 1's Step 5 if so).
2. **The box's edge.** No sharp rectangle, no offset between the photo and the world image around it, no colour
   step that draws the eye to the boundary.
3. **The streets over the photo.** The casings carry the roads over bright concrete and dark shadow alike, in both
   themes; the class hierarchy reads; nothing looks like a hairball at the fit zoom.
4. **The streets without a photo** (Atlas, Political). They read as a street map on the lesson's own background,
   not as a stain; Political's country colour still reads under them.
5. **Names in a script the reader cannot read.** At Tokyo and Delhi the street names must come out in English
   (planning ruling R24) in all three languages; at Paris, Warsaw and Kraków they must stay local. If a box has
   no `name:en` at all, say so — its names stay local and that is a data limit, not a bug.
6. **Labels (spec §10's named risk).** No street name covers a place name, the point, a special-line name, a
   school badge or an edge number — that is the guarantee ruling R19 exists for, so look hard. Density on a
   375 px phone is calm; on 1366 px it is useful, not a carpet.
7. **The lesson's own furniture.** Grid, edge labels, the point marker and its dashed guides, the readout and the
   sliders behave exactly as they do at any other zoom, and the guides sit on the point rather than beside it
   (that is planning ruling R11's straightened parallels — check it by eye at Rovaniemi and Mitad del Mundo,
   where the marked line on the ground and the drawn line must coincide).
8. **The three teaching notes.** Each says something true about what the pupil can see in that photo.
9. **Night.** In Satellite with the lab's Sun on the far side, a box reads as a dimmed close-up, not as a blurry
   Black Marble smear (planning ruling R23).
10. **The canvas tier.** `?test&gl=off` at the school box draws the same picture, more slowly.
11. **Performance.** Time the first draw after entering a box and the frame time while dragging inside one, with
    `Emulation.setCPUThrottlingRate` 4, the way `tests/e2e/perf-smoke.spec.ts` already does for the world
    textures. Record the numbers; SwiftShader is far slower than a phone GPU, so these are for the report, not a
    new bound.

Take the contact sheet the spec §8 asks for: every box at 375 px and at 1366 px, kept as evidence.
```bash
for id in katowice greenwich mitaddelmundo rovaniemi warsaw krakow paris manhattan delhi sydney tokyo giza; do
  npm run shot -- en/lab "closeup-$id"; done
```
(`scripts/shot.ts` takes a route; set the box with `window.__mapState.showCityBox` from the driving script, or
drive the twelve through the Playwright browser and save the images — either way, look at all twenty-four.)

- [ ] **Step 3: Check the contrast of the new tokens against real pixels**

`tests/e2e/map-style-readability.spec.ts` already measures the grid and label ink against the picture under it.
Read it, and add one case in its style for a close-up box: sample the street ink and the street-name ink against
the photo behind them at the school box in Physical and in Satellite, light and dark, and assert the same ratio
the file already requires of the other styles. If a token fails, change `--street-ink`, `--street-casing` or
`--street-name-ink` in `tokens.css` / `base.css` — never an Atlas token.

- [ ] **Step 4: Fix, re-run, commit**

For each finding: the smallest change in the close-up files, then re-run the affected specs. Remember the standing
rule: **any change to `cpuShade.ts`'s `shadePixel` is made to `shaders.ts`'s `FRAGMENT_SHADER` in the same commit**,
and vice versa.

When all findings are fixed or consciously deferred (with the reason):
```bash
npm run check && npm test
npm run build && npm run e2e
```
Expected: everything passes, including `atlas-baseline.spec.ts` with zero diff.
```bash
git add tests/e2e/city-a11y.spec.ts tests/e2e/map-style-readability.spec.ts <the files you fixed>
git commit -m "test(e2e): close-ups across boxes, styles, themes and widths; design fixes"
```

- [ ] **Step 5: Manual checks to report (cannot be automated here)**

Write in the report, for the owner to do on real hardware: open the school box on a mid-range phone (is the
1440 × 960 photo sharp enough at 2× — planning ruling R5 asks exactly this), drag inside a box (target 60 fps),
check the classroom projector in presenter mode, print a lesson page while inside a box (the texture layer's
`beforeprint` snapshot should carry the close-up), and open the page once on mobile data to feel the 8 MiB first
load. Record the SwiftShader numbers from Step 2.11 next to them.

---

### Task 9: Release prep (no push, no merge)

**Files:**
- Modify: `README.md`, `docs/RELEASE.md`, `scripts/readme-shots.ts`, `docs/screenshots/*.png` (regenerated, plus
  `docs/screenshots/close-up.png`), `dist/geo-coordinates.html`, `dist/translation-review.html`
- Check (already edited in Task 3 and Task 7): `LICENSE-CONTENT.md`, `src/app/Footer.svelte`

**Interfaces:**
- Consumes: the finished branch.
- Produces: an up-to-date README and release checklist, regenerated screenshots, a rebuilt committed `dist/`.

- [ ] **Step 1: README**

Read `README.md`, then edit:
- The "Maps" / "Map styles" area gains a bullet:
  "**Places up close**: twelve 6 × 4 km boxes — the school in Katowice, Greenwich, Mitad del Mundo, the Arctic
  Circle at Rovaniemi, Warsaw, Kraków, Paris, Manhattan, Delhi, Sydney, Tokyo and Giza — where the map goes down
  to the streets: an aerial photo with roads, railways, water and parks drawn over it, and the street names. Six
  boxes use national open orthophotos at about 4–5 m a pixel, where individual buildings are visible; the other
  six use Copernicus Sentinel-2 at 10 m, where roads, parks and built-up areas read but single buildings do not.
  Reached from the "Places up close" list under the map, in free play, the lab and topic 9. A Settings switch
  turns the whole thing off."
- The size sentence in "Develop": "The built file must stay under 8 MiB; `npm run build` prints a per-asset
  breakdown with a line for each place."
- The "Develop" command list gains:
  ```
      npm run data:city-boxes      # rewrite src/map/data/city/boxes.json (the twelve 6 × 4 km boxes)
      npm run data:city-photos     # rebuild the twelve close-up photos (Python 3 + Pillow; network; cached in .cache/city)
      npm run data:city-streets    # rebuild the twelve street topologies from Overpass (network; cached in .cache/overpass)
  ```
- "Credits" gains, with the exact strings from `src/map/data/city/photos/manifest.json`:
  "Close-up photos: Ortofotomapa — Główny Urząd Geodezji i Kartografii, geoportal.gov.pl (Katowice, Warsaw,
  Kraków); Orthophotos © IGN / Géoplateforme, Licence Ouverte Etalab 2.0 (Paris); Geospatial Information
  Authority of Japan, seamlessphoto tiles, processed (Tokyo); USDA-FSA National Agriculture Imagery Program
  (NAIP) via USGS, public domain (Manhattan); Contains modified Copernicus Sentinel data 2025-2026 (Greenwich,
  Mitad del Mundo, Rovaniemi, Delhi, Sydney, Giza). Close-up streets, railways, water and parks: ©
  OpenStreetMap contributors, ODbL."
- "Third-party licences": say that the six close-up data notices are written into the file too.
- Screenshots block: add `![A city close-up: the school in Katowice](docs/screenshots/close-up.png)`.

- [ ] **Step 2: Release checklist**

In `docs/RELEASE.md` "Pre-release checklist": change the build note to "(`npm run build` also checks the 8 MiB
size budget — with a per-asset breakdown, one line per place — and the third-party licence notices)"; add:
- "[ ] All twelve close-ups looked at by eye on the contact sheet (Task 8's `shots/closeup-*.png`): the right
  feature in the middle, no cloud or seam, streets readable over the photo."
- "[ ] Close-up attribution checked in all four places: the footer, the README, `LICENSE-CONTENT.md` and the
  built file's licence comment — six sources, each with its own wording."
- "[ ] Places up close texts reviewed in Polish and Ukrainian on the translation review sheet (keys
  `closeup.*`, `settings.closeUps*`, `topic.9.step.find.closeUp`, `footer.closeUp*`)."
- "[ ] The close-up photos are the newest the sources have: re-running `npm run data:city-photos --refresh` is a
  data change, not a code change, and needs the twelve looked at again."
Update the screenshots item to list `close-up.png`.

- [ ] **Step 3: README screenshot**

In `scripts/readme-shots.ts` add a fifth shot (read the file first and follow the shape Task 20 of the map-styles
plan left it in):
```ts
  { name: 'close-up', hash: 'en/lab', style: 'satellite', cityBox: 'katowice' },
```
and, for a shot with `cityBox`, after `#main` and after the texture has drawn:
`await page.evaluate((id) => (window as any).__mapState.showCityBox(id), shot.cityBox)`, then poll
`window.__mapTextures.drawCount('flat')` until it grows and wait a further 600 ms. Then:
```bash
npm run build && npm run shots:readme
```
Expected: five PNGs written. **Look at the close-up one**: the school box with its streets over the photo and the
grid and point still readable.

- [ ] **Step 4: Final verification and the release commit**

```bash
npm run check && npm test
npm run build
npm run e2e
git status --short
```
Expected: all tests pass; the build prints the size (planning ruling R22 expects about 7.5 MiB of 8 MiB) and the
per-place breakdown; `git status` shows only `README.md`, `docs/RELEASE.md`, `scripts/readme-shots.ts`,
`docs/screenshots/*` and `dist/*`.
```bash
git add README.md docs/RELEASE.md scripts/readme-shots.ts docs/screenshots \
  dist/geo-coordinates.html dist/translation-review.html
git commit -m "chore(release): places up close — README, checklist, screenshots, dist"
git log --oneline main..HEAD
```

**Do not push. Do not merge into `main`.**

**Report:** the commit list from `main..HEAD`; the final file size, the full per-asset breakdown and the headroom
under 8,388,608 B; test totals; the per-box source and ground resolution table; the design-pass findings and what
was fixed versus deferred; the manual checks still open for the owner; and the translation keys the owner should
review.
