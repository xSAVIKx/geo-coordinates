import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  test(`home renders in ${lang} with no axe violations`, async ({ page }) => {
    await openPage(page, `${lang}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('ol.cards > li')).toHaveCount(8);
    await expectNoAxeViolations(page, lang);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('language switch updates lang, hash and text', async ({ page }) => {
  await openPage(page, 'en/');
  await page.getByRole('button', { name: /PL/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page).toHaveURL(/#pl\/$/);
  await expect(page.locator('h1')).toHaveText('Współrzędne na kuli ziemskiej');
});

test('footer credits the author and the map data', async ({ page }) => {
  await openPage(page, 'pl/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Autor: Yurii Serhiichuk');
  await expect(footer.getByRole('link', { name: 'Natural Earth' })).toHaveAttribute('href', 'https://www.naturalearthdata.com/');
  await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Yurii Serhiichuk');
});

test('unknown route falls back to home', async ({ page }) => {
  await openPage(page, 'en/nope/nope');
  await expect(page).toHaveURL(/#en\/$/);
});

test('settings dialog switches theme and is keyboard operable', async ({ page }) => {
  await openPage(page, 'en/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoAxeViolations(page, 'dark settings');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'uk/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('h1 focus follows route changes, not first paint', async ({ page }) => {
  await openPage(page, 'en/lab');
  await expect(page.locator('h1')).not.toBeFocused();
  await page.evaluate(() => { location.hash = '#en/'; });
  await expect(page.locator('h1')).toBeFocused();
});
