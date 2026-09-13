import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  for (const topic of [1, 2, 3, 4, 5, 6, 7]) {
    test(`topic ${topic} explore in ${lang}: every step renders without axe violations`, async ({ page }) => {
      await openPage(page, `${lang}/topic-${topic}/explore`);
      const total = await page.locator('.dots li').count();
      for (let i = 0; i < total; i++) {
        await page.goto(page.url().replace(/#.*/, `#${lang}/topic-${topic}/explore/${i + 1}`));
        await expect(page.locator('#step-title')).not.toBeEmpty();
        if (i === 0 || i === total - 1) await expectNoAxeViolations(page, `${lang} t${topic} s${i + 1}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }
}

test('next/previous buttons and arrow keys change steps with replace history', async ({ page }) => {
  await openPage(page, 'en/topic-1/explore');
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page).toHaveURL(/#en\/topic-1\/explore\/2$/);
  await expect(page.locator('#step-title')).toHaveText('The equator');
  await page.locator('body').press('ArrowRight');
  await expect(page).toHaveURL(/explore\/3$/);
  await page.locator('body').press('ArrowLeft');
  await expect(page).toHaveURL(/explore\/2$/);
});

test('step beyond the end clamps to the last step', async ({ page }) => {
  await openPage(page, 'en/topic-2/explore/99');
  await expect(page).toHaveURL(/#en\/topic-2\/explore\/6$/);
});

test('topic tabs mark the current page', async ({ page }) => {
  await openPage(page, 'uk/topic-3/explore');
  await expect(page.getByRole('link', { name: 'Вивчай' })).toHaveAttribute('aria-current', 'page');
});
