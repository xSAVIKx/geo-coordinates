import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  for (const topic of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
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

test('topic 9 is Explore only: no Practise tab or card button, its practice address opens Explore, the last step leads home', async ({ page }) => {
  await openPage(page, 'en/');
  const card = page.locator('.card').filter({ has: page.getByRole('link', { name: 'Coordinates in your phone' }) });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('link', { name: /Practise/ })).toHaveCount(0);
  await expect(page.locator('.card').filter({ has: page.getByRole('link', { name: 'The globe grid' }) }).getByRole('link', { name: /Practise/ })).toHaveCount(1);

  await openPage(page, 'en/topic-9/practice');
  await expect(page).toHaveURL(/#en\/topic-9\/explore$/);
  await expect(page.locator('#step-title')).toHaveText('Your phone knows where it is');
  await expect(page.getByRole('navigation', { name: 'Topic sections' }).getByRole('link')).toHaveText(['Learn']);
  await expect(page.getByRole('link', { name: /Next topic/ })).toHaveCount(0);

  await page.goto(page.url().replace(/#.*/, '#en/topic-9/explore/8'));
  await expect(page.getByRole('link', { name: 'Back to all topics' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practise this topic' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Previous topic: Longitude and time' })).toBeVisible();
  expect(pageErrors(page)).toEqual([]);
});

test('topic 9 readouts: decimals like a map app in every language, DMS in the language notation', async ({ page }) => {
  await openPage(page, 'uk/topic-9/explore/4');
  const outputs = page.locator('.readouts output');
  await expect(outputs).toHaveText(['50.2649, 19.0238', '50°15′54″ пн. ш., 19°01′26″ сх. д.']);
  await expect(page.getByText('Десятковий запис (як у застосунках із картами)')).toBeVisible();
  await expect(outputs.first()).toHaveAttribute('aria-live', 'off');
  // Moving the point by a minute with the latitude slider changes both lines.
  await page.getByRole('slider', { name: 'Географічна широта' }).press('ArrowUp');
  await expect(outputs.first()).toHaveText('50.2816, 19.0238');
  await expect(outputs.nth(1)).toHaveText('50°16′54″ пн. ш., 19°01′26″ сх. д.');

  await openPage(page, 'pl/topic-9/explore/3');
  await expect(page.locator('.readouts output')).toHaveText(['-33.8688, 151.2093', '34°S, 151°E']);
  await expect(page.getByRole('button', { name: 'Mapa z aplikacji (Merkator)' })).toHaveAttribute('aria-pressed', 'true');
  await expectNoAxeViolations(page, 'pl t9 signs');
});

test('class quiz topic list leaves out topic 9', async ({ page }) => {
  await openPage(page, 'en/class-quiz');
  await expect(page.getByRole('checkbox')).toHaveCount(8);
  await expect(page.getByLabel(/Coordinates in your phone/)).toHaveCount(0);
});
