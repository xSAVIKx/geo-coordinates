import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';
import { answerCorrectlyWithKeyboard, card } from './practiceHelpers';

async function perfectRound(page: import('@playwright/test').Page, opts: { hintOnFirst?: boolean } = {}) {
  for (let i = 0; i < 10; i++) {
    if (i === 0 && opts.hintOnFirst) {
      await card(page).getByRole('button', { name: 'Hint' }).click();
      await expect(card(page).locator('.hint[aria-live="polite"]')).toContainText('North is up');
    }
    await answerCorrectlyWithKeyboard(page);
    await expect(card(page).getByText('Correct!', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeFocused();
}

test('a perfect keyboard round celebrates, marks the hinted question, and the home badge shows the best score', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/topic-2/practice', '?test');
  await perfectRound(page, { hintOnFirst: true });
  await expect(page.getByText('Perfect round! Every answer is right.')).toBeVisible();
  await expect(page.locator('canvas.confetti')).toBeAttached();
  // The heading keeps focus while the confetti falls, and the canvas goes away again.
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeFocused();
  await expect(page.locator('canvas.confetti')).toHaveCount(0, { timeout: 4000 });
  const review = page.locator('.review li');
  await expect(review.nth(0).locator('.hint-tag')).toHaveText('with a hint');
  await expect(page.locator('.review .hint-tag')).toHaveCount(1);
  await expectNoAxeViolations(page, 'perfect round summary');

  await page.getByRole('link', { name: 'Coordinates on the globe' }).first().click();
  const topic2 = page.locator('.cards li').nth(1);
  await expect(topic2.locator('.progress')).toContainText('Best: 10/10 · easy');
  await expect(topic2.getByText('Your best score: 10 out of 10, easy level')).toBeAttached();
  await expect(page.locator('.cards li').nth(0).locator('.progress')).toHaveText('Not practised yet');
  await expectNoAxeViolations(page, 'home with badges');
  expect(pageErrors(page)).toEqual([]);
});

test('reduced motion: a perfect round shows the text and a still star, with no confetti canvas', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/topic-1/practice', '?test');
  await perfectRound(page);
  await expect(page.getByText('Perfect round! Every answer is right.')).toBeVisible();
  await expect(page.locator('.perfect.still .star')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('the hint is shown once, survives the layout switch, and never appears in the rehearsal', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPage(page, 'uk/topic-6/practice', '?test');
  const hint = card(page).getByRole('button', { name: 'Підказка' });
  await expect(card(page).locator('.hint')).toBeEmpty();
  await hint.click();
  await expect(card(page).locator('.hint')).toContainText('Один бік від лінії → віднімай');
  await expect(hint).toHaveAttribute('aria-disabled', 'true');
  await expect(hint).toBeFocused();
  const box = await hint.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(card(page).locator('.hint')).toContainText('Один бік від лінії → віднімай');
  await expectNoAxeViolations(page, 'hint on a phone');

  await openPage(page, 'en/rehearsal');
  await page.getByRole('button', { name: /Start/ }).click();
  await expect(page.locator('form.card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hint' })).toHaveCount(0);
});
