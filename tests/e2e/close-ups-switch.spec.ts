import { expect, test, type Page } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

const k = boxesJson.boxes.find((b) => b.id === 'katowice')!;
const fit = Math.min(360 / (k.east - k.west), 180 / (k.north - k.south));
/** The RGBA the page is holding for close-up photos: with the switch off nothing may be decoded at all. */
const cityBytes = (page: Page) => page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes(): number } }).__mapTextures.cityBytes());
const list = (page: Page) => page.locator('details.close-ups');

test('off: no photo, no streets, no list, no extra sentence — and the map is otherwise unchanged', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('geo-coords:close-ups', 'off'));
  await openPage(page, 'en/lab', '?test');
  await expect(list(page)).toHaveCount(0);
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  await setFlatView(page, k.lat, k.lon, fit);
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.close-up-credit')).toHaveText('');
  await expect(page.locator('.close-up-note')).toHaveCount(0);
  // Nothing describes a close-up either: the map's text description is the style's own sentence, nothing more.
  await expect(page.locator('.view-flat p.visually-hidden').last()).not.toHaveText(/aerial photo/);
  // And no photo is decoded — the switch is a display switch, but it must not cost the device 5 MiB of RGBA.
  await page.waitForTimeout(500);
  expect(await cityBytes(page), 'no close-up photo may stay decoded with the switch off').toBe(0);
  // The map still works: the grid, the point and the readout are all there at this zoom.
  await expect(page.locator('.view-flat .grid')).toHaveCount(1);
  await expect(page.locator('.view-flat [data-point-handle]')).toHaveCount(1);
  await expect(page.locator('output').first()).toHaveText(/^\d+°\d\d′N, \d+°\d\d′E$/);

  await openPage(page, 'en/topic-9/explore/5');
  await expect(page.getByText(/open .Places up close. under the map/)).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

test('the Settings switch turns it off and on again, and the choice is remembered', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, k.lat, k.lon, fit);
  await expect(page.locator('.view-flat g.streets')).toHaveCount(1);

  await page.getByRole('button', { name: 'Settings' }).click();
  const box = page.getByRole('checkbox', { name: 'Places up close' });
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(list(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('geo-coords:close-ups'))).toBe('off');

  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, k.lat, k.lon, fit);
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'Places up close' }).check();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.view-flat g.streets')).toHaveCount(1);
  await expect(list(page)).toHaveCount(1);
  expect(pageErrors(page)).toEqual([]);
});

test('the switch is keyboard operable and says what it does', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.getByRole('button', { name: 'Settings' }).click();
  const box = page.getByRole('checkbox', { name: 'Places up close' });
  await box.focus();
  await expect(box).toBeFocused();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('geo-coords:close-ups'))).toBe('off');
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
  // The hint under it is wired to the input, so a screen reader reads what turning it off does.
  const described = await box.getAttribute('aria-describedby');
  expect(described).toBe('close-ups-hint');
  await expect(page.locator('#close-ups-hint')).toHaveText(/Turning this off leaves the map exactly as it is everywhere else\./);
  // A 44 px target. Measured as the row's layout height: boundingBox() reports the *painted* box, which the
  // dialog's 180 ms open animation scales to 0.98 — a 43 px row on one machine and 43.98 on another.
  expect(await box.evaluate((el) => (el.closest('label') as HTMLElement).offsetHeight)).toBeGreaterThanOrEqual(44);
});

test('close-ups never appear where the spec says they must not', async ({ page }) => {
  // Practice and the class quiz: the scene never sets closeUps, so even at a box's own zoom nothing is drawn.
  for (const hash of ['en/topic-4/practice', 'en/class-quiz']) {
    await openPage(page, hash, '?test');
    await setFlatView(page, k.lat, k.lon, fit);
    await expect(page.locator('g.streets'), hash).toHaveCount(0);
    await expect(list(page), hash).toHaveCount(0);
  }
});
