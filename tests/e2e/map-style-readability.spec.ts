import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from '../../scripts/t20-png.ts';
import { openPage, pageErrors, probe, setMapStyle, waitForTexture } from './helpers';

/** WCAG contrast of each map ink against the halo it sits on, read from the frame's own computed tokens. */
const inks = (page: Page, view: 'flat' | 'globe') => page.locator(`.view-${view} .frame`).evaluate((frame) => {
  const cs = getComputedStyle(frame);
  const rgb = (v: string) => { const c = document.createElement('canvas').getContext('2d')!; c.fillStyle = v.trim(); const h = c.fillStyle as string; return h.startsWith('#') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : (h.match(/\d+/g) ?? []).slice(0, 3).map(Number); };
  const lum = (v: string) => { const [r, g, b] = rgb(v).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
  const halo = cs.getPropertyValue('--halo');
  return Object.fromEntries(['--text', '--map-label', '--ocean-label', '--equator-text', '--prime-text', '--antimeridian-text', '--tropics-text', '--river-label'].map((t) => [t, ratio(cs.getPropertyValue(t), halo)]));
});

// Every non-Atlas style's map *text* ink keeps AA against its own halo normally, AAA in presenter mode — Satellite's
// halo/ink pair is style-specific (light-on-dark), Physical's and Political's are the ambient theme's own (unchanged
// by this file), but neither was ever verified by a running test for Physical/Political, only assumed. Verified here
// for all three so a future ink or halo change cannot quietly drop below AA/AAA on any of them.
for (const scheme of ['light', 'dark'] as const) {
  for (const style of ['physical', 'satellite', 'political'] as const) {
    test(`${style} (${scheme}): map ink keeps AA against its halo normally, AAA in presenter mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', style);
      if (style !== 'political') await waitForTexture(page, 'flat');
      for (const [token, r] of Object.entries(await inks(page, 'flat'))) expect(r, `${token}`).toBeGreaterThanOrEqual(4.5);
      await page.locator('body').press('p');
      await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
      for (const [token, r] of Object.entries(await inks(page, 'flat'))) expect(r, `presenter ${token}`).toBeGreaterThanOrEqual(7);
      const enhanced = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
      expect(enhanced.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
      expect(pageErrors(page)).toEqual([]);
    });
  }
}

/**
 * WCAG contrast of the *rendered* grid against real, sampled terrain pixels — not a CSS-token measurement like
 * `inks()` above, which cannot catch a casing that merely matches a token that happens to be as bright as the
 * terrain under it. `probe()` reads the actual decoded texture (the same helper used in texture-webgl.spec.ts),
 * so `bg` here is the real Greenland/Antarctica ice colour, not an assumption. `alpha` composites the casing and
 * then the grid line's own colour over it, in the same paint order the SVG draws them, using each element's own
 * *computed* stroke-opacity (so a future opacity change is exercised, not hard-coded here).
 */
const rgbOf = (css: string): [number, number, number] => {
  const s = css.trim();
  if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
  const [r, g, b] = s.match(/\d+(?:\.\d+)?/g)!.map(Number);
  return [r!, g!, b!];
};
const luminance = ([r, g, b]: [number, number, number]) => {
  const f = (x: number) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrastOf = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const alpha = (fg: [number, number, number], a: number, bg: [number, number, number]): [number, number, number] =>
  fg.map((c, i) => a * c + (1 - a) * bg[i]!) as [number, number, number];

async function gridContrastOverRealPixel(page: Page, lat: number, lon: number) {
  await page.evaluate(([la, lo]) => (window as unknown as { __mapState: { setFlatView(c: { lat: number; lon: number }, z: number): void } }).__mapState.setFlatView({ lat: la as number, lon: lo as number }, 3), [lat, lon] as const);
  await page.waitForTimeout(200);
  const bg = (await probe(page, 'flat', lat, lon, 3))!.avg;
  const frame = page.locator('.view-flat .frame');
  const [casingHex, gridHex] = await Promise.all([
    frame.evaluate((f) => getComputedStyle(f).getPropertyValue('--map-casing')),
    frame.evaluate((f) => getComputedStyle(f).getPropertyValue('--grid')),
  ]);
  const [casingOpacity, gridOpacity] = await Promise.all([
    page.locator('.view-flat path.grid-casing').first().evaluate((el) => Number(getComputedStyle(el).strokeOpacity)),
    page.locator('.view-flat path.grid').first().evaluate((el) => Number(getComputedStyle(el).strokeOpacity)),
  ]);
  const afterCasing = alpha(rgbOf(casingHex), casingOpacity, bg);
  const afterGrid = alpha(rgbOf(gridHex), gridOpacity, afterCasing);
  return { bg, casingVsBg: contrastOf(afterCasing, bg), gridCoreVsBg: contrastOf(afterGrid, bg) };
}

// WCAG 1.4.11 (non-text contrast) applies here: the grid is a graphical object, 3:1 minimum against what's behind it.
// Bright real terrain, not the Alps or the Sahara (both mid-tone and pass even with the near-white ambient halo that
// caused this): Greenland's ice sheet and interior Antarctica, both close to the whitest pixels the relief texture has.
for (const scheme of ['light', 'dark'] as const) {
  test(`Physical (${scheme}): the grid stays visible over real bright ice, not just mid-tone terrain`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'physical');
    await waitForTexture(page, 'flat');
    for (const [name, lat, lon] of [['Greenland', 75, -40], ['Antarctica', -82, 20]] as const) {
      const { bg, casingVsBg, gridCoreVsBg } = await gridContrastOverRealPixel(page, lat, lon);
      expect(bg[0], `${name} bg should be a genuinely bright pixel`).toBeGreaterThan(200);
      expect(casingVsBg, `${name} casing vs terrain`).toBeGreaterThanOrEqual(3);
      expect(gridCoreVsBg, `${name} grid line core vs terrain`).toBeGreaterThanOrEqual(3);
    }
    expect(pageErrors(page)).toEqual([]);
  });
}

/**
 * Every pixel the graticule really paints, with the picture that was under it — read from two screenshots of the
 * same frame, one as drawn and one with `.grid`/`.grid-casing` hidden. Where `gridContrastOverRealPixel` above
 * recomputes the compositing from the tokens (exact, but only at one spot, and only where a texture can be
 * probed), this reads what the browser actually put on the screen, so it also covers the styles that have no
 * texture to probe. Returns the WCAG ratio of the painted line against the picture beneath it, for the pixels the
 * caller cares about.
 */
async function paintedGridRatios(page: Page, view: 'flat' | 'globe', keep: (bg: [number, number, number]) => boolean): Promise<number[]> {
  const frame = page.locator(`.view-${view} .frame`);
  const drawn = PNG.decode(await frame.screenshot());
  const tag = await page.addStyleTag({ content: '.grid, .grid-casing { display: none !important; }' });
  await page.waitForTimeout(150);
  const bare = PNG.decode(await frame.screenshot());
  await tag.evaluate((n) => (n as unknown as Element).remove());
  expect(drawn.data.length, 'the two shots must line up').toBe(bare.data.length);
  const out: number[] = [];
  for (let i = 0; i < drawn.data.length; i += 4) {
    const bg: [number, number, number] = [bare.data[i]!, bare.data[i + 1]!, bare.data[i + 2]!];
    const fg: [number, number, number] = [drawn.data[i]!, drawn.data[i + 1]!, drawn.data[i + 2]!];
    // Only pixels the grid changed materially — an antialiased fringe of a pixel or two says nothing about the ink.
    if (Math.abs(fg[0] - bg[0]) + Math.abs(fg[1] - bg[1]) + Math.abs(fg[2] - bg[2]) < 60) continue;
    if (!keep(bg)) continue;
    out.push(contrastOf(fg, bg));
  }
  return out.sort((a, b) => a - b);
}
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

/*
 * Satellite's casing is its own `#0b1622`, not `:root`'s `var(--halo)`. That indirection is substituted with the
 * value --halo has on :root, never with the style's own, so leaving it out gave the light theme a 2.75 px
 * near-white casing under a near-white grid: measured over the Black Marble, the graticule reached a median of
 * 11:1 and peaks of 16:1 against the picture — thick white bars across the city lights — while dark theme, whose
 * root halo happens to be dark, was calm. Hence a ceiling as well as a floor, and the same numbers in both
 * themes: the photograph has no theme, so neither may the ink on it.
 */
for (const scheme of ['light', 'dark'] as const) {
  test(`Satellite (${scheme}): the grid reads over the night side without painting a white cage on it`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'satellite');
    await waitForTexture(page, 'flat');
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'satellite');
    const night = await paintedGridRatios(page, 'flat', (bg) => luminance(bg) < 0.05);
    expect(night.length, 'the night side has to be on screen to be measured').toBeGreaterThan(500);
    expect(percentile(night, 0.75), 'grid over the night side is not a white cage').toBeLessThanOrEqual(7);
    expect(percentile(night, 0.75), 'grid over the night side is still visible').toBeGreaterThanOrEqual(2.5);
    expect(pageErrors(page)).toEqual([]);
  });
}

/*
 * Political is the one style whose picture follows the theme, and its two themes are not symmetric. In light theme
 * the dark casing does the work over the pale fills and the painted line reaches a median of 4.8–5.3:1. In dark
 * theme the casing is dark like the fills, so only the line's own colour is left, and it is thin: the strongest
 * pixels of its cross-section are what read, not the median. Hence a floor on p90, and the numbers it separates,
 * measured per fill on painted pixels at zoom 2 with the night shading off:
 *
 *   fill      #4a4231   #34462f   #4d3632   #383b52
 *   --grid: #6d88a0     1.52      1.45      1.51      1.67   (the ambient token this style used to take)
 *   --grid: #9fb4c6     2.03      2.09      2.14      2.37   (tokens.css today)
 *
 * so reverting the token fails this test on every fill. It is still short of the light theme's figures; closing
 * that gap needs a *light* casing in dark theme, which would break the Physical/Political shared-casing rule the
 * test below encodes. Left for the owner — see the Task 20 report. For scale, Atlas's own graticule, which is
 * pixel-frozen, measures 1.2–1.8:1 against its map, so this is the stronger of the two.
 */
const GRID_FLOOR = { light: { at: 0.5, min: 3 }, dark: { at: 0.9, min: 1.9 } } as const;
for (const scheme of ['light', 'dark'] as const) {
  test(`Political (${scheme}): the grid stays visible over every country fill, not only over the ocean`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'political');
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'political');
    // The lab shades the night side over everything; this is about the fills themselves, so light the whole map.
    await page.evaluate(() => { (window as unknown as { __mapState: { layers: { daylight: boolean } } }).__mapState.layers.daylight = false; });
    await page.evaluate(() => (window as unknown as { __mapState: { setFlatView(c: { lat: number; lon: number }, z: number): void } }).__mapState.setFlatView({ lat: 20, lon: 20 }, 2));
    await page.waitForTimeout(300);
    const fills = await page.locator('.view-flat .frame').evaluate((f) => [0, 1, 2, 3, 4, 5].map((i) => getComputedStyle(f).getPropertyValue(`--pol-${i}`).trim()));
    let measured = 0;
    for (const fill of fills) {
      const want = rgbOf(fill);
      const near = (bg: [number, number, number]) => bg.every((c, i) => Math.abs(c - want[i]!) <= 2);
      const ratios = await paintedGridRatios(page, 'flat', near);
      if (ratios.length < 200) continue; // that colour is barely on screen at this view; the others carry the check
      measured++;
      const floor = GRID_FLOOR[scheme];
      expect(percentile(ratios, floor.at), `grid over ${fill}`).toBeGreaterThanOrEqual(floor.min);
    }
    expect(measured, 'at least four of the six fills have to be on screen').toBeGreaterThanOrEqual(4);
    expect(pageErrors(page)).toEqual([]);
  });
}

/*
 * The trap behind the Satellite finding, stated once as an invariant so a fifth style cannot walk into it: the
 * casing is declared on :root as `var(--halo)`, and a custom property's var() is substituted with the value the
 * referenced property has *where the declaration is*, not where it is used. A style that gives itself its own
 * --halo therefore keeps :root's casing unless it says otherwise — which is exactly a casing the same colour as
 * the ink it is supposed to separate. Atlas is the deliberate exception: its halo *is* the page's.
 */
test("every non-Atlas style's casing is its own, and does not follow the page's halo", async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const casingOf = async (style: 'atlas' | 'physical' | 'satellite' | 'political', scheme: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: scheme });
    await setMapStyle(page, style);
    // The frame carries the *drawn* style, so a texture style only stamps it once its images are on the renderer.
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', style);
    return page.locator('.view-flat .frame').evaluate((f) => getComputedStyle(f).getPropertyValue('--map-casing').trim());
  };
  for (const style of ['physical', 'satellite', 'political'] as const) {
    const light = await casingOf(style, 'light'), dark = await casingOf(style, 'dark');
    // Spelled out on the style itself, so it cannot change under it when the page's palette does.
    expect(light, `${style}: the casing must not follow the page's halo`).toBe(dark);
    // And it really is a casing: dark enough to separate a light ink from a bright picture. A style that had left
    // the :root declaration alone would land on the light theme's near-white halo here, which is finding 1 exactly.
    expect(luminance(rgbOf(light)), `${style}: the casing is dark`).toBeLessThan(0.1);
  }
  // The control: Atlas is the one style that is *meant* to take the ambient halo, and so does change with the theme.
  const atlasLight = await casingOf('atlas', 'light'), atlasDark = await casingOf('atlas', 'dark');
  expect(atlasLight).not.toBe(atlasDark);
  expect(luminance(rgbOf(atlasLight)), 'Atlas light halo is light, which is why a style may not inherit it').toBeGreaterThan(0.8);
});

test('Political shares Physical\'s robust casing colour (ready for its own bright fills); Atlas keeps the ambient halo (no-op)', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const casingFor = async (style: 'atlas' | 'physical' | 'political') => {
    await setMapStyle(page, style);
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', style);
    return page.locator('.view-flat .frame').evaluate((f) => getComputedStyle(f).getPropertyValue('--map-casing').trim());
  };
  const physical = await casingFor('physical');
  expect(await casingFor('political')).toBe(physical);
  const atlasCasing = await casingFor('atlas');
  const atlasHalo = await page.locator('.view-flat .frame').evaluate((f) => getComputedStyle(f).getPropertyValue('--halo').trim());
  expect(atlasCasing).toBe(atlasHalo);
});

test('every non-Atlas style draws halos under the grid and full-strength halos behind map text; Atlas unchanged', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('.view-flat path.grid-casing')).toHaveCount(0);
  for (const style of ['physical', 'satellite', 'political'] as const) {
    await setMapStyle(page, style);
    if (style !== 'political') await waitForTexture(page, 'flat');
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', style);
    await expect(page.locator('.view-flat path.grid-casing')).toHaveCount(1);
    const halo = await page.locator('.view-flat text.halo').first().evaluate((t) => { const cs = getComputedStyle(t); return [cs.strokeOpacity, cs.strokeWidth]; });
    expect(halo).toEqual(['1', '4px']);
  }
});

test('the source of each style is named under the map; the footer credits NASA Earth Observatory', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('.map-source')).toBeEmpty();
  await setMapStyle(page, 'physical');
  await expect(page.locator('.map-source')).toHaveText('Relief and sea depths: Natural Earth.');
  await setMapStyle(page, 'satellite');
  await expect(page.locator('.map-source')).toHaveText('Images: NASA Earth Observatory (Blue Marble, Black Marble).');
  await setMapStyle(page, 'political');
  await expect(page.locator('.map-source')).toHaveText("Borders: Natural Earth, in Poland's official view.");
  await expect(page.locator('footer').getByRole('link', { name: 'NASA Earth Observatory' })).toHaveAttribute('href', 'https://earthobservatory.nasa.gov/');
  await expect(page.locator('footer')).toContainText('Satellite images: NASA Earth Observatory');
});
