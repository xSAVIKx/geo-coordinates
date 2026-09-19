import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { expectNoAxeViolations, openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

/*
 * The street layer inside a city close-up box (Places up close spec §5): roads by class, railways, water and green
 * areas over the photo, with the street names. Drawn in all four styles — in Atlas and Political without a photo
 * under them (planning ruling R14) — and dropped on its own if it ever fails, like the other vector layers.
 */
const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const fit = (b: { west: number; east: number; south: number; north: number }) =>
  Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));

for (const style of STYLES) {
  test(`the street map is drawn in ${style}, with a photo only where the spec says`, async ({ page }) => {
    test.setTimeout(90_000);
    const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, style);
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    await setFlatView(page, b.lat, b.lon, fit(b));
    const streets = page.locator('.view-flat g.streets[data-city-box="katowice"]');
    await expect(streets).toHaveCount(1);
    await expect(streets.locator('path.road.c0')).toHaveCount(1);
    await expect(streets.locator('path.road.c4')).toHaveCount(1);
    // Every road has a casing under it, so a junction reads as roads crossing rather than a pile of strokes.
    await expect(streets.locator('path.road-casing')).toHaveCount(await streets.locator('path.road').count());
    // Planning ruling R14: the photo layer only exists for the two texture styles.
    await expect(page.locator('.view-flat canvas.texture')).toHaveCount(style === 'physical' || style === 'satellite' ? 1 : 0);
    // Political paints its own country colours: the park and water washes are left out there.
    await expect(streets.locator('path.green')).toHaveCount(style === 'political' ? 0 : 1);
    await expect(page.locator('.view-flat text.street-name').first()).toBeVisible();
    expect(pageErrors(page)).toEqual([]);
  });
}

test('every one of the twelve boxes draws a street map at its fit zoom', async ({ page }) => {
  test.setTimeout(180_000);
  await openPage(page, 'en/lab', '?test');
  for (const b of boxesJson.boxes) {
    await setFlatView(page, b.lat, b.lon, fit(b));
    await expect(page.locator(`.view-flat g.streets[data-city-box="${b.id}"]`), b.id).toHaveCount(1);
    await expect(page.locator('.view-flat g.streets path.road'), b.id).not.toHaveCount(0);
    await expect(page.locator('.view-flat text.street-name').first(), b.id).toBeVisible();
  }
  expect(pageErrors(page)).toEqual([]);
});

test('outside a box, and zoomed out, there is no street layer at all', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, 50.26, 19.02, 12);           // the Atlas baseline scene's own view
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.view-flat text.street-name')).toHaveCount(0);
  await setFlatView(page, 12.5, 40.5, 4000);           // open desert
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
});

test('a broken street layer drops only itself, and the map keeps working (spec §5)', async ({ page }) => {
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  await openPage(page, 'en/lab', '?test&vector=fail');
  await setFlatView(page, b.lat, b.lon, fit(b));
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.view-flat svg[role="group"] .grid')).toHaveCount(1);
  await expect(page.locator('.view-flat [data-point-handle]')).toHaveCount(1);
});

test('a street name never wins over one of the lesson\'s own names', async ({ page }) => {
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, b.lat, b.lon, fit(b));
  await expect(page.locator('.view-flat text.street-name').first()).toBeVisible();
  // `getBBox` is the letters themselves, in the SVG's own units — not `getBoundingClientRect`, which adds each
  // name's halo stroke and so has two names "touching" wherever their halos brush past one another.
  const clashes = await page.evaluate(() => {
    const svg = document.querySelector('.view-flat svg')!;
    const box = (t: SVGGraphicsElement) => t.getBBox();
    const texts = [...svg.querySelectorAll<SVGTextElement>('text')];
    const own = texts.filter((t) => !t.classList.contains('street-name')).map(box);
    return texts.filter((t) => t.classList.contains('street-name')).flatMap((t) => {
      const s = box(t);
      const hit = own.some((o) => s.x < o.x + o.width && o.x < s.x + s.width && s.y < o.y + o.height && o.y < s.y + s.height);
      return hit ? [t.textContent] : [];
    });
  });
  expect(clashes).toEqual([]);
});

test('axe is clean inside a box, in every style and both themes', async ({ page }) => {
  test.setTimeout(180_000);
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const style of STYLES) {
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
      await setFlatView(page, b.lat, b.lon, fit(b));
      await expect(page.locator('.view-flat g.streets')).toHaveCount(1);
      await expectNoAxeViolations(page, `close-up ${style} ${scheme}`);
    }
  }
});
