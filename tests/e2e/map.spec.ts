import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab shows globe and flat map side by side on desktop', async ({ page }) => {
  await openPage(page, 'en/lab');
  await expect(page.getByRole('group', { name: 'World map with parallels and meridians' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Globe that you can turn' })).toBeVisible();
  await expectNoAxeViolations(page, 'lab desktop');
  expect(pageErrors(page)).toEqual([]);
});

test('phone shows one view with a switch', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'pl/lab');
  await expect(page.getByRole('group', { name: 'Globus, który możesz obracać' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Globus' }).click();
  await expect(page.getByRole('group', { name: 'Globus, który możesz obracać' })).toBeVisible();
  await expectNoAxeViolations(page, 'lab phone');
});

test('clicking the flat map moves the point', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const box = (await map.boundingBox())!;
  // x = 75% of width → lon 90°E; y = 25% of height → lat 45°N
  await map.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  const handle = map.locator('[data-point-handle]');
  const hb = (await handle.boundingBox())!;
  expect(Math.abs(hb.x + hb.width / 2 - (box.x + box.width * 0.75))).toBeLessThan(6);
});

test('keyboard moves the point on the flat map', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const before = (await map.locator('[data-point-handle]').boundingBox())!;
  await map.focus();
  await page.keyboard.press('Shift+ArrowRight');
  const after = (await map.locator('[data-point-handle]').boundingBox())!;
  expect(after.x).toBeGreaterThan(before.x + 5);
});
