# Part 7 — Design, UX and accessibility pass; release prep (spec §9.7)

Context every task here needs:
- Everything from Tasks 1–19 is in place: four map styles on every map (switch in toolbars and Settings, class quiz run style), WebGL → canvas → Atlas fallback with a note, Political and Physical vectors and names, Satellite night with city lights, the lab's real-Sun switch and Seasons mode, topic 10.
- E2E helpers (`tests/e2e/helpers.ts`): `openPage(page, hash, query)`, `pageErrors`, `expectNoAxeViolations`, `setMapStyle(page, style)` (needs `?test`), `waitForTexture(page, view, draws?)`, `probe(page, view, lat, lon, radius?)`, `textureHooks(page)`.
- A style is preselected for a fresh page with `page.addInitScript(() => localStorage.setItem('geo-coords:map-style', '<style>'))`.
- Screenshot tools: `npm run shot -- <hash> <name> [dark]` (full page at 375×667 and 1366×768 into `shots/`), `npm run shots:readme` (README screenshots, after a build).
- Owner rules for release: no push, no merge to `main`; the owner reviews the branch.

---

### Task 20: Design, UX and accessibility pass across styles

A review gate across route × style × theme × width, with the fixes it finds. Deliverable: two new e2e specs that pass, fixes committed, and a written findings list in the report.

**Files:**
- Create: `tests/e2e/styles-matrix.spec.ts`, `tests/e2e/perf-smoke.spec.ts`
- Modify: whatever the review finds, limited to the map-style work (`src/map/**`, `src/styles/tokens.css`, `src/styles/base.css`, `src/i18n/*.json`, `src/quiz/ClassQuiz.svelte`, `src/app/LabPage.svelte`); never an Atlas token, never an Atlas baseline snapshot.

**Interfaces:**
- Consumes: all of the above.
- Produces: no new public interfaces. Optional (only if the review shows awkward `Intl.DisplayNames` country names, planning ruling R22): `COUNTRY_NAME_OVERRIDES: Partial<Record<LangCode, Record<string, string>>>` in `src/map/political.ts`, used by `countryName` before `Intl`, with a unit test per entry.

- [ ] **Step 1: The matrix spec `tests/e2e/styles-matrix.spec.ts`**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, waitForTexture } from './helpers';

const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const ROUTES = ['en/lab', 'pl/topic-1/explore/9', 'uk/topic-3/practice', 'en/topic-10/explore/7', 'pl/topic-9/explore/8'] as const;

async function prepare(page: Page, style: (typeof STYLES)[number], scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), style);
}

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`WCAG AA on every map route: ${style}, ${scheme}`, async ({ page }) => {
      test.setTimeout(120_000);
      await prepare(page, style, scheme);
      for (const hash of ROUTES) {
        await openPage(page, hash, '?test');
        if (style === 'physical' || style === 'satellite') await waitForTexture(page, (await page.locator('.view-flat').count()) ? 'flat' : 'globe');
        await expect(page.locator('.frame').first()).toHaveAttribute('data-map-style', style);
        await expectNoAxeViolations(page, `${hash} ${style} ${scheme}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }

  test(`AAA in presenter mode: ${style}`, async ({ page }) => {
    await prepare(page, style, 'light');
    await openPage(page, 'en/lab', '?test');
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    const r = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
    expect(r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
  });

  test(`class quiz run in ${style}: the map, the answer and the controls fit, axe clean`, async ({ page }) => {
    await openPage(page, 'en/class-quiz', '?test');
    await page.getByRole('group', { name: 'Map style for the class' }).getByRole('radio', { name: new RegExp(`^${style[0]!.toUpperCase()}${style.slice(1)}$`) }).check();
    await page.getByRole('button', { name: 'Start the quiz' }).click();
    await page.locator('body').press('Space');
    await expect(page.getByText(/^Answer:/)).toBeVisible();
    await expectNoAxeViolations(page, `class quiz ${style}`);
  });
}

for (const width of [320, 375, 480, 768, 1024, 1366]) {
  test(`no horizontal scroll at ${width} px in every style`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    for (const style of STYLES) {
      await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), style);
      for (const hash of ['uk/lab', 'pl/topic-10/explore/6', 'en/topic-3/practice']) {
        await openPage(page, hash);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${hash} ${style} ${width}`).toBeLessThanOrEqual(width);
      }
    }
  });
}

test('touch targets of the new controls are at least 44 × 44 px on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'en/lab');
  await page.getByRole('button', { name: 'Seasons mode' }).click();
  const targets = page.locator('.style-menu, .real-sun .btn, .seasons-toggle, .view-flat .toolbar .btn');
  for (const box of await targets.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, e.textContent?.trim()]; }))) {
    expect(Math.min(box[0] as number, box[1] as number), String(box[2])).toBeGreaterThanOrEqual(44);
  }
});
```
The last `addInitScript` in the width loop wins on each navigation (scripts run in the order added), so each style is really used.

- [ ] **Step 2: The performance smoke spec `tests/e2e/perf-smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { openPage, setMapStyle, waitForTexture } from './helpers';

// Spec §8 "Performance smoke". SwiftShader in headless Chromium is far slower than a phone GPU, so the bounds are
// generous (planning ruling R23); the numbers are printed for the report and the phone check is manual.
const draws = (page: import('@playwright/test').Page, view: 'flat' | 'globe') => page.evaluate((v) => (window as unknown as { __mapTextures: { drawCount(v: string): number } }).__mapTextures.drawCount(v), view);

test('Satellite: first draw after choosing it, globe drag frame times under CPU ×4, a later style switch', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  let t = Date.now();
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'globe');
  const firstDraw = Date.now() - t;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const box = (await page.locator('.view-globe svg').boundingBox())!;
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (now: number) => { w.__frames.push(now - last); last = now; if (w.__frames.length < 240) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 80; i++) await page.mouse.move(box.x + box.width / 2 + ((i % 40) - 20) * 5, box.y + box.height / 2 + ((i % 16) - 8) * 3);
  await page.mouse.up();
  const frames = (await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(5))).sort((a, b) => a - b);
  const median = frames[Math.floor(frames.length / 2)]!, p90 = frames[Math.floor(frames.length * 0.9)]!;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  const before = await draws(page, 'flat');
  t = Date.now();
  await setMapStyle(page, 'satellite');
  await expect.poll(() => draws(page, 'flat'), { intervals: [10] }).toBeGreaterThan(before);
  const switchBack = Date.now() - t;

  console.log(JSON.stringify({ firstDrawMs: firstDraw, dragMedianMs: median, dragP90Ms: p90, switchBackMs: switchBack }));
  expect(firstDraw).toBeLessThan(2500);
  expect(median).toBeLessThan(120);
  expect(switchBack).toBeLessThan(400);
});
```

- [ ] **Step 3: Run both specs on a fresh build and record the numbers**

```bash
npm run build && npx playwright test tests/e2e/styles-matrix.spec.ts tests/e2e/perf-smoke.spec.ts
```
Write down every failure and the perf JSON line. Fix failures in Step 5; do not relax a bound without writing the measured value and the reason in the report.

- [ ] **Step 4: Visual review checklist (look, do not guess)**

Take screenshots with the Playwright MCP browser or `npm run shot` (set the style first through `localStorage`) for each of: `en/lab`, `en/topic-1/explore/9`, `uk/topic-10/explore/6`, `pl/topic-9/explore/3`, a class quiz question after reveal — in Physical, Satellite and Political, light and dark, 375×667, 1366×768 and 1920×1080 with presenter mode. For each, check and note:
1. Grid, equator/prime meridian names, point, markers and brackets are readable on every background (Saharan sand, deep ocean, night lights, pale pastel fills).
2. Labels: no country, physical or place name overlaps another name or a line name; density at world zoom is calm on a phone; names do not sit on the point or on answer markers.
3. The style switch: order, pressed state, compact menu position at 375 px (fully on screen, not clipped by the scrolling tool row), focus ring visible on each style button in every style.
4. Loading: pick Satellite on a throttled CPU (`Emulation.setCPUThrottlingRate` 6) — "Loading map…" appears, Atlas stays drawn, no blank frame, the fade is short; with reduced motion there is no fade.
5. The note: `?test&gl=off&canvas=off` → the note reads well next to the toolbar in all three languages.
6. Satellite: the lab legend shows city lights; twilight looks like dusk, not a hard line; the globe glow is subtle.
7. Political: neighbours clearly different in dark theme; capitals' rings visible; Western Sahara part of Morocco, Crimea in Ukraine, Kosovo labelled at a Balkans zoom.
8. Physical: rivers do not look like borders; Tatra and Sudetes names appear at a Poland zoom; seas italic.
9. Seasons: the orbit reads clearly in both themes; the Earth passes behind the Sun; the readout lines up; topic 10 steps' globe views show the polar day/night the text describes.
10. Country names from `Intl.DisplayNames` that read badly for 11-year-olds (e.g. "Congo - Kinshasa", "Bosnia & Herzegovina", "Myanmar (Burma)"): list them; if any appear at zoom ≤ 4, add `COUNTRY_NAME_OVERRIDES` (for example en `CD: 'DR Congo'`, `BA: 'Bosnia and Herzegovina'`, `MM: 'Myanmar'`; pl/uk only where Intl output is awkward) and a unit test asserting each override is used.

- [ ] **Step 5: Fix, re-run, commit**

For each finding: the smallest change in the map-style files, then re-run the affected specs. When all findings are fixed or consciously deferred (with the reason), run the whole suite:
```bash
npm run check && npm test
npm run build && npm run e2e
```
Expected: everything passes, including `atlas-baseline.spec.ts` unchanged.
```bash
git add tests/e2e/styles-matrix.spec.ts tests/e2e/perf-smoke.spec.ts <the files you fixed>
git commit -m "test(e2e): map styles across routes, themes, widths and presenter mode; design fixes"
```

- [ ] **Step 6: Manual checks to report (cannot be automated here)**

Write in the report, for the owner to do on real hardware: drag the Satellite globe on a mid-range phone (target 60 fps), pick a style after first decode (target ≤ 100 ms), check the classroom projector in presenter mode, and print a lesson page in Satellite (snapshot) and a worksheet (Atlas). Record the SwiftShader numbers from Step 3 next to them.

---

### Task 21: Release prep (no push, no merge)

**Files:**
- Modify: `README.md`, `docs/RELEASE.md`, `scripts/readme-shots.ts`, `docs/screenshots/*.png` (regenerated, plus `docs/screenshots/satellite.png`), `dist/geo-coordinates.html`, `dist/translation-review.html`
- Check (already edited in Task 11): `LICENSE-CONTENT.md`, `src/app/Footer.svelte`

**Interfaces:**
- Consumes: the finished branch.
- Produces: an up-to-date README and release checklist, regenerated screenshots, a rebuilt committed `dist/`.

- [ ] **Step 1: README**

Edit `README.md`:
- "Use it" list: "**Learn**: 10 topics …, from the basics of the grid to reading coordinates from a phone map app and why we have seasons." Topic 10 is explore-only like topic 9.
- New bullet after "Maps": "**Map styles**: Atlas (the lesson's own map), Physical (relief, sea depths, rivers and mountain names), Satellite (NASA Blue Marble, with Black Marble city lights on the night side) and Political (countries in colour with their names, in Poland's official border view). The style is remembered; a class quiz can use its own style for one run; worksheets and the cheat sheet are always Atlas. Drawn with WebGL, with a canvas fallback, and Atlas whenever a device cannot draw a style."
- "Day and night lab" bullet: add "a Seasons mode (drag the Earth around its orbit; day length, sunrise and sunset, where the Sun is overhead and where polar day begins) and an advanced real-Sun switch (equation of time)". Keep the mean-Sun sentence.
- "Develop": add
  ```
      npm run data:textures        # rebuild the map-style textures (needs Python 3 and Pillow with WebP; raw files cached in .cache/textures)
      npm run data:political       # rebuild src/map/data/political-pol.json
      npm run data:water           # rebuild src/map/data/physical-water.json
  ```
  and a sentence: "The built file must stay under 5 MiB; `npm run build` prints a per-asset breakdown."
- "Credits": add "Relief: Natural Earth `HYP_50M_SR_W` (public domain). Satellite images: NASA Earth Observatory — Blue Marble Next Generation (July 2004) and Black Marble 2016; NASA imagery is not subject to copyright in the United States. Political country shapes and physical rivers and lakes: Natural Earth (`ne_10m_admin_0_countries_pol`, `ne_50m_rivers_lake_centerlines`, `ne_50m_lakes`)."
- "Third-party licences": mention that the NASA Earth Observatory note is also written into the file.
- Screenshots block: add `![Satellite map style with city lights](docs/screenshots/satellite.png)` after the lab screenshot.

- [ ] **Step 2: Release checklist**

In `docs/RELEASE.md` "Pre-release checklist": change the build note to "(`npm run build` also checks the 5 MiB size budget — with a per-asset breakdown — and the third-party licence notices)"; add items:
- "[ ] Map styles checked on a real phone (Satellite globe drag smooth) and on the classroom projector in presenter mode."
- "[ ] Topic 10 and Seasons mode texts reviewed in Polish and Ukrainian on the translation review sheet (keys `topic.10.*`, `seasons.*`, `map.style.*`, `physical.*`, `lab.realSun*`)."
Update the screenshots item to list `satellite.png`.

- [ ] **Step 3: README screenshots**

In `scripts/readme-shots.ts` add a fourth shot that chooses Satellite and a night time before capturing:
```ts
const SHOTS = [
  { name: 'home', hash: 'en/' },
  { name: 'lesson', hash: 'en/topic-6/explore/5' },
  { name: 'lab', hash: 'en/lab' },
  { name: 'satellite', hash: 'en/lab', style: 'satellite', sun: { utcMinutes: 1020, dayOfYear: 266 } },
] as const;
```
For a shot with `style`, add `await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), shot.style)` before `goto`, open with `?test` (`${file}?test#${shot.hash}`), and after `#main` set the Sun: `await page.evaluate((sun) => { (window as any).__mapState.sun = { ...sun, year: 2026 }; }, shot.sun)`, then wait until `window.__mapTextures.drawCount('flat') > 1` (poll up to 15 s) plus 600 ms. Update the header comment and the README sentence that lists the screenshots. Then:
```bash
npm run build && npm run shots:readme
```
Expected: four PNGs written (quantized when Pillow is present). Look at each: the satellite one shows city lights over Europe/Asia and readable labels.

- [ ] **Step 4: Final verification and the release commit**

```bash
npm run check && npm test
npm run build
npm run e2e
git status --short
```
Expected: all tests pass; build prints the size (≈ 3.3–3.8 MiB of 5 MiB) and the breakdown; `git status` shows only `README.md`, `docs/RELEASE.md`, `scripts/readme-shots.ts`, `docs/screenshots/*`, `dist/*`.
```bash
git add README.md docs/RELEASE.md scripts/readme-shots.ts docs/screenshots dist/geo-coordinates.html dist/translation-review.html
git commit -m "chore(release): map styles, Earth physics and seasons — README, checklist, screenshots, dist"
git log --oneline main..HEAD
```
Do not push. Do not merge into `main`. Report: the commit list from `main..HEAD`, final file size and breakdown, test totals, the perf numbers from Task 20, the manual checks still open for the owner, and the translation keys the owner should review.
