import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const noonX = (page: Page) => page.locator('.view-flat path.noon').getAttribute('d').then((d) => Number(/M\s*([-\d.]+)/.exec(d!)![1]));

test('the real Sun moves noon and the clocks by the equation of time; off again after leaving the lab', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  // 3 November 12:00 UTC: the real Sun is 16.4 minutes ahead, 4.1° west of the 12:00 meridian.
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 720, dayOfYear: 307, year: 2026 }; });
  const london = page.getByRole('row', { name: /London/ });
  await expect(london).toContainText('12:00');
  const meanX = await noonX(page);
  const toggle = page.getByRole('button', { name: 'Advanced: real Sun' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAccessibleDescription(/up to 16 minutes/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(london).toContainText('12:16');
  await expect.poll(async () => meanX - (await noonX(page))).toBeGreaterThan(9);  // ≈ 4.1° × 960/360 ≈ 11 units west
  expect(meanX - (await noonX(page))).toBeLessThan(13);
  await expectNoAxeViolations(page, 'lab real sun');

  await page.goto(page.url().replace(/#.*/, '#en/topic-8/explore/9'));
  await expect(page.getByRole('button', { name: 'Advanced: real Sun' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __mapState: { realSun: boolean } }).__mapState.realSun)).toBe(false);
  await page.goto(page.url().replace(/#.*/, '#en/lab'));
  await expect(page.getByRole('button', { name: 'Advanced: real Sun' })).toHaveAttribute('aria-pressed', 'false');
  expect(pageErrors(page)).toEqual([]);
});

test('the switch is not saved', async ({ page }) => {
  await openPage(page, 'pl/lab');
  await page.getByRole('button', { name: 'Dla zaawansowanych: prawdziwe Słońce' }).click();
  await page.reload();
  await page.waitForSelector('#main');
  await expect(page.getByRole('button', { name: 'Dla zaawansowanych: prawdziwe Słońce' })).toHaveAttribute('aria-pressed', 'false');
});
