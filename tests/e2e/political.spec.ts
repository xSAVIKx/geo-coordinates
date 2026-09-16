import { expect, test } from '@playwright/test';
import { makeFlatCtx } from '../../src/map/geometry';
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle } from './helpers';

const fill = (page: import('@playwright/test').Page, id: string) => page.locator(`.view-flat path.country[data-country="${id}"]`).evaluate((p) => getComputedStyle(p).fill);

for (const scheme of ['light', 'dark'] as const) {
  test(`Political (${scheme}): Poland's neighbours all differ from it; names, capitals, no continents`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'political');
    await page.evaluate(() => (window as unknown as { __mapState: { setFlatPreset(p: string): void } }).__mapState.setFlatPreset('europe'));
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'political');
    const pol = await fill(page, 'POL');
    for (const n of ['DEU', 'CZE', 'SVK', 'UKR', 'BLR', 'LTU', 'RUS']) expect(await fill(page, n), n).not.toBe(pol);
    await expect(page.locator('.view-flat text.map-label')).toHaveCount(0);
    await expect(page.locator('.view-flat circle.capital-ring')).not.toHaveCount(0);
    await expect(page.locator('.view-flat path.land')).toHaveCount(0);
    // Poland's own name needs a view with room for it: on the lab's 575 px wide Europe map, Natural Earth's label
    // point for Poland is under Warsaw's name and the movable point's ring, both of which are placed first.
    await page.evaluate(() => (window as unknown as { __mapState: { setFlatPreset(p: string): void } }).__mapState.setFlatPreset('poland'));
    await expect(page.locator('.view-flat text.country-name[data-country="POL"]')).toHaveText('Poland');
    await expectNoAxeViolations(page, `political ${scheme}`);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('Political: Crimea is drawn inside Ukraine', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'political');
  await page.evaluate(() => (window as unknown as { __mapState: { setFlatView(c: object, z: number): void } }).__mapState.setFlatView({ lat: 46, lon: 34 }, 6));
  const st = await page.evaluate(() => { const s = (window as unknown as { __mapState: { flat: { center: { lat: number; lon: number }; zoom: number } } }).__mapState; return s.flat; });
  const [x, y] = makeFlatCtx(960, 480, st.center, st.zoom, 1, 'grid').project({ lat: 44.95, lon: 34.10 })!;
  const inside = await page.locator('.view-flat path.country[data-country="UKR"]').evaluate((p, [px, py]) => {
    const g = p as SVGGeometryElement;
    const pt = g.ownerSVGElement!.createSVGPoint(); pt.x = px!; pt.y = py!;
    return g.isPointInFill(pt);
  }, [x, y]);
  expect(inside).toBe(true);
  await expect(page.locator('.view-flat path.country[data-country="RUS"]')).toBeAttached();
});

test('Political names follow the language', async ({ page }) => {
  for (const [lang, name] of [['pl', 'Polska'], ['uk', 'Польща']] as const) {
    await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'political'));
    await openPage(page, `${lang}/lab`, '?test');
    await page.evaluate(() => (window as unknown as { __mapState: { setFlatPreset(p: string): void } }).__mapState.setFlatPreset('poland'));
    await expect(page.locator('.view-flat text.country-name[data-country="POL"]')).toHaveText(name);
  }
});

test('an exception in the Political layer shows Atlas with the note', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&vector=fail');
  await setMapStyle(page, 'political');
  await expect(page.getByRole('status').filter({ hasText: "This device can't draw this style; showing Atlas." })).toBeVisible();
  await expect(page.locator('.view-flat path.land')).toHaveCount(1);
});
