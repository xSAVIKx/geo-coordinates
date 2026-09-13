import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('class quiz: same code gives same questions; keyboard reveals and navigates', async ({ page }) => {
  await openPage(page, 'en/class-quiz');
  await page.getByLabel(/Quiz code/).fill('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page).toHaveURL(/class-quiz\?seed=5b$/);
  const first = await page.locator('#cq-prompt').textContent();
  await page.locator('body').press('Space');
  await expect(page.getByText(/^Answer:/)).toBeVisible();
  await expectNoAxeViolations(page, 'class quiz revealed');
  await page.locator('body').press('ArrowRight');
  await expect(page.getByText('Question 2 of 10')).toBeVisible();
  await expect(page.getByText(/^Answer:/)).toHaveCount(0);
  await page.locator('body').press('Escape');

  await openPage(page, 'en/class-quiz?seed=5b');
  await expect(page.getByLabel(/Quiz code/)).toHaveValue('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page.locator('#cq-prompt')).toHaveText(first!);
});

test('class quiz timer counts down and says time is up', async ({ page }) => {
  test.setTimeout(40_000);
  await openPage(page, 'uk/class-quiz');
  await page.getByLabel('15 с').check();
  await page.getByRole('button', { name: 'Почати вікторину' }).click();
  await expect(page.getByText('Час вийшов!').first()).toBeVisible({ timeout: 20_000 });
});
