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

for (const route of ['cheatsheet', 'worksheet']) {
  test(`${route}: no horizontal scroll at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openPage(page, `uk/${route}`);
    await expect(page.locator('.sheet, .paper')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}

async function makeSheet(page: Page, code: string, count = 10) {
  await page.locator('#ws-code').fill(code);
  await page.locator(`input[name="ws-count"][value="${count}"]`).check();
  await expect(page.locator('.paper .meta').first()).toContainText(`Code: ${code}`);
  await expect(page.locator('.questions > li')).toHaveCount(count);
}
const prompts = (page: Page) => page.locator('.questions .prompt').allInnerTexts();

test('worksheet: a fixed code makes the same questions twice, and the answer key toggles', async ({ page }) => {
  await openPage(page, 'en/worksheet');
  await expect(page.getByRole('heading', { level: 1, name: 'Worksheet' })).toBeVisible();
  await makeSheet(page, 'sheet42');
  const first = await prompts(page);
  await makeSheet(page, 'other1');
  expect(await prompts(page)).not.toEqual(first);
  await openPage(page, 'en/worksheet');
  await makeSheet(page, 'sheet42');
  expect(await prompts(page)).toEqual(first);

  // Maps are drawn for the questions that need them, without the answer; place-point prints as "Mark the point".
  expect(await page.locator('.questions svg.static-map').count()).toBeGreaterThan(3);
  await expect(page.locator('.static-map .tone-answer')).toHaveCount(0);
  const box = await page.locator('.questions svg.static-map').first().boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(227); // at least 60 mm on screen as on paper

  await expect(page.getByRole('heading', { name: /^Answer key/ })).toBeVisible();
  await expect(page.locator('.key li')).toHaveCount(10);
  await page.getByLabel('Add the answer key (on its own page)').uncheck();
  await expect(page.locator('.key')).toHaveCount(0);
  await page.getByLabel('Add the answer key (on its own page)').check();
  await expectNoAxeViolations(page, 'worksheet');
  expect(pageErrors(page)).toEqual([]);
});

test('worksheet: a 10-question sheet with its key prints on at most 4 A4 pages, the key on a page of its own', async ({ page }) => {
  await openPage(page, 'uk/worksheet');
  await page.locator('#ws-code').fill('print1');
  await page.locator('input[name="ws-count"][value="10"]').check();
  await expect(page.locator('.paper .meta').first()).toContainText('Код: print1');
  const withKey = await pdfPages(page);
  expect(withKey).toBeLessThanOrEqual(4);
  await page.emulateMedia({ media: 'screen' });
  await page.getByLabel(/Додати відповіді/).uncheck();
  const withoutKey = await pdfPages(page);
  expect(withoutKey).toBe(withKey - 1);
  await expect(page.locator('form.ws-settings')).toBeHidden();
  await expect(page.locator('.q').first()).toHaveCSS('break-inside', 'avoid');
});

test('worksheet: choosing no topic explains why there is no sheet', async ({ page }) => {
  await openPage(page, 'pl/worksheet');
  for (const box of await page.locator('.topics input').all()) await box.uncheck();
  await expect(page.getByRole('alert')).toHaveText('Wybierz co najmniej jeden temat.');
  await expect(page.locator('.paper')).toHaveCount(0);
});

test('worksheet: a highlighted 180° meridian prints inside the map frame, and markers print apart', async ({ page }) => {
  await openPage(page, 'en/worksheet');
  await page.locator('input[name="ws-difficulty"][value="hard"]').check();
  await makeSheet(page, 'rev24');
  await expect(page.locator('.paper .meta').first()).toContainText('Topics: 1, 2, 3, 4, 5, 6, 7, 8');
  // Question 1 (code rev24, hard): "What is the highlighted line?" with the 180° meridian.
  const q1 = page.locator('.questions > li').nth(0);
  const line = await q1.locator('.hl-line').boundingBox();
  const frame = await q1.locator('.frame').boundingBox();
  const world = await q1.locator('rect.world').boundingBox();
  const centre = line!.x + line!.width / 2;
  expect(Math.abs(centre - (world!.x + world!.width))).toBeLessThan(1.5);
  // A clear gap between the line's casing and the frame (the casing is 9 CSS px wide).
  expect(frame!.x + frame!.width - centre).toBeGreaterThan(6);
  // Question 5 (a "further" question whose markers would overlap on the world map) prints its map zoomed to the markers,
  // every two of them at least 20 CSS px apart (the print size of the sheet on screen).
  const q5 = page.locator('.questions > li').nth(4);
  await expect(q5).toContainText(/lies furthest/);
  await expect(q5.locator('.options li')).not.toHaveCount(0);
  const centres = await q5.locator('g.marker path').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }));
  expect(centres.length).toBeGreaterThanOrEqual(2);
  const gaps = centres.flatMap((a, i) => centres.slice(i + 1).map((b) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)));
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(20);
});
