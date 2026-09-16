import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

/** WCAG contrast of each map ink against the halo it sits on, read from the frame's own computed tokens. */
const inks = (page: Page, view: 'flat' | 'globe') => page.locator(`.view-${view} .frame`).evaluate((frame) => {
  const cs = getComputedStyle(frame);
  const rgb = (v: string) => { const c = document.createElement('canvas').getContext('2d')!; c.fillStyle = v.trim(); const h = c.fillStyle as string; return h.startsWith('#') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : (h.match(/\d+/g) ?? []).slice(0, 3).map(Number); };
  const lum = (v: string) => { const [r, g, b] = rgb(v).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
  const halo = cs.getPropertyValue('--halo');
  return Object.fromEntries(['--text', '--map-label', '--ocean-label', '--equator-text', '--prime-text', '--antimeridian-text', '--tropics-text', '--river-label'].map((t) => [t, ratio(cs.getPropertyValue(t), halo)]));
});

for (const scheme of ['light', 'dark'] as const) {
  test(`Satellite (${scheme}): light inks on a dark halo, AA normally and AAA in presenter mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'satellite');
    await waitForTexture(page, 'flat');
    for (const [token, r] of Object.entries(await inks(page, 'flat'))) expect(r, `${token}`).toBeGreaterThanOrEqual(4.5);
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    for (const [token, r] of Object.entries(await inks(page, 'flat'))) expect(r, `presenter ${token}`).toBeGreaterThanOrEqual(7);
    const enhanced = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
    expect(enhanced.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
    expect(pageErrors(page)).toEqual([]);
  });
}

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
