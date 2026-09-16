import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  test(`topic 10 in ${lang}: every step renders; axe on every step`, async ({ page }) => {
    await openPage(page, `${lang}/topic-10/explore`);
    const total = await page.locator('.dots li').count();
    expect(total).toBe(7);
    for (let i = 0; i < total; i++) {
      await page.goto(page.url().replace(/#.*/, `#${lang}/topic-10/explore/${i + 1}`));
      await expect(page.locator('#step-title')).not.toBeEmpty();
      await expectNoAxeViolations(page, `${lang} t10 s${i + 1}`);
    }
    expect(pageErrors(page)).toEqual([]);
  });
}

test('topic 10 is Explore only and comes after topic 9', async ({ page }) => {
  await openPage(page, 'en/');
  const card = page.locator('.card').filter({ has: page.getByRole('link', { name: 'Why we have seasons' }) });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('link', { name: /Practise/ })).toHaveCount(0);
  await openPage(page, 'en/topic-10/practice');
  await expect(page).toHaveURL(/#en\/topic-10\/explore$/);
  await expect(page.getByRole('link', { name: 'Previous topic: Coordinates in your phone' })).toBeVisible();
  await openPage(page, 'en/class-quiz');
  await expect(page.getByLabel(/Why we have seasons/)).toHaveCount(0);
});

test('topic 10 by keyboard: the Katowice step moves the Earth to December and the day shortens', async ({ page }) => {
  await openPage(page, 'en/topic-10/explore/6');
  const readout = page.getByRole('region', { name: 'Seasons at the point' });
  await expect(readout).toContainText(/Day length\s*16 h \d\d min/);
  const earth = page.getByRole('slider', { name: "Date on the Earth's orbit" });
  await earth.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('PageUp');
  // `Intl` writes an English date as "December 21"; the caption and this value text follow the page language.
  await expect(earth).toHaveAttribute('aria-valuetext', /December 21/);
  await expect(readout).toContainText(/Day length\s*7 h \d\d min/);
  // Arrow keys on the slider change the date, not the step.
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/explore\/6$/);
  await expect(earth).toHaveAttribute('aria-valuetext', /December 22/);
});
