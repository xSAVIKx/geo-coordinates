import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

/** Pages in a PDF made by Chromium: one `/Type /Page` object per page (`/Pages` is the tree node). */
async function pdfPages(page: Page): Promise<number> {
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
}

const TITLES = { en: 'Cheat sheet: geographic coordinates', pl: 'Ściąga: współrzędne geograficzne', uk: 'Шпаргалка: географічні координати' };

for (const [lang, title] of Object.entries(TITLES)) {
  test(`cheat sheet (${lang}) renders, passes axe and prints on one or two A4 pages`, async ({ page }) => {
    await openPage(page, `${lang}/cheatsheet`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('.sheet section')).toHaveCount(8);
    await expectNoAxeViolations(page, `cheat sheet ${lang}`);
    const pages = await pdfPages(page);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(2);
    // Paper shows the sheet only: no header, footer or toolbar.
    await expect(page.locator('header.bar')).toBeHidden();
    await expect(page.locator('footer')).toBeHidden();
    await expect(page.locator('.tools')).toBeHidden();
    await expect(page.locator('.sheet')).toBeVisible();
    expect(pageErrors(page)).toEqual([]);
  });
}

test('cheat sheet: the page language switch and the home card', async ({ page }) => {
  await openPage(page, 'en/');
  await page.getByRole('link', { name: 'Cheat sheet' }).click();
  await expect(page).toHaveURL(/#en\/cheatsheet$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.locator('.tools').getByRole('button', { name: 'Polski' }).click();
  await expect(page).toHaveURL(/#pl\/cheatsheet$/);
  await expect(page.getByRole('heading', { level: 1, name: TITLES.pl })).toBeVisible();
  await expect(page.locator('.sheet')).toContainText('1° szerokości wzdłuż południka ≈ 111,2 km');
});

test('cheat sheet: dark theme and presenter mode still print black on white at the normal size', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPage(page, 'uk/cheatsheet');
  await page.keyboard.press('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const look = await page.evaluate(() => ({
    root: getComputedStyle(document.documentElement).fontSize,
    ink: getComputedStyle(document.querySelector('.sheet h1')!).color,
    paper: getComputedStyle(document.querySelector('.sheet')!).backgroundColor,
  }));
  expect(look).toEqual({ root: '16px', ink: 'rgb(20, 20, 20)', paper: 'rgb(255, 255, 255)' });
});

test('cheat sheet: no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'uk/cheatsheet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
