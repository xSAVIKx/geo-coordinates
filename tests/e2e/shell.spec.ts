import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  test(`home renders in ${lang} with no axe violations`, async ({ page }) => {
    await openPage(page, `${lang}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('ol.cards > li')).toHaveCount(10);
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

test('footer links to the author website and GitHub profile with 44px targets', async ({ page }) => {
  await openPage(page, 'pl/');
  const footer = page.getByRole('contentinfo');
  const website = footer.getByRole('link', { name: 'Yurii Serhiichuk – strona internetowa' });
  const github = footer.getByRole('link', { name: 'Yurii Serhiichuk na GitHubie' });
  await expect(website).toHaveAttribute('href', 'https://serhiichuk.dev');
  await expect(website).toHaveAttribute('rel', 'author');
  await expect(github).toHaveAttribute('href', 'https://github.com/xSAVIKx');
  for (const link of [website, github]) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expectNoAxeViolations(page, 'footer links');
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

test('the short app title replaces the full title below 480px', async ({ page }) => {
  await openPage(page, 'en/');
  const brand = page.getByRole('banner').getByRole('link');
  const full = brand.getByText('Coordinates on the globe');
  const short = brand.getByText('Coordinates', { exact: true });
  await expect(full).toBeVisible();
  await expect(short).toBeHidden(); // display: none above 480px
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(short).toBeVisible();
  // Below 480px the full title switches to the same visually-hidden (clip) technique used
  // elsewhere on the page — still present for screen readers, so check it collapses to a 1px
  // box instead of asserting it's "hidden" (Playwright treats a 1×1px box as visible).
  const box = await full.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(1);
  // The visible short title is decorative (aria-hidden): the brand link's accessible name must
  // stay exactly the full title, not "Coordinates on the globe Coordinates" or similar.
  await expect(page.getByRole('link', { name: 'Coordinates on the globe', exact: true })).toHaveCount(1);
  await expectNoAxeViolations(page, '375px header');
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
