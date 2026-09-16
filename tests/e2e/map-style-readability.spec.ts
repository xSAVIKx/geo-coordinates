import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
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
