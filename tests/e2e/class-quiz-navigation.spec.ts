import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

// Regression: `mapState.applyScene` used to read `mapState.point` right after writing it, so the
// class quiz's question effect subscribed to the point it rewrites with a fresh object on every
// run. Any question whose scene has a point (read-coords, place-point) then re-ran the effect
// forever (`effect_update_depth_exceeded`, hung tab). With code "5b" and all topics, question 3 is
// a topic-3 read-coords question; the topic-3-only quiz starts on one.

async function start(page: Page, code: string, onlyTopic?: string) {
  await openPage(page, 'en/class-quiz', '?test');
  await page.getByLabel(/Quiz code/).fill(code);
  if (onlyTopic) {
    const boxes = page.locator('form.setup input[type="checkbox"]');
    for (let i = 0; i < await boxes.count(); i++) {
      if (await boxes.nth(i).getAttribute('value') !== onlyTopic) await boxes.nth(i).uncheck();
    }
  }
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page.locator('p.progress')).toHaveText('Question 1 of 10');
}

async function walkForwardAndBack(page: Page) {
  const progress = page.locator('p.progress');
  for (let n = 2; n <= 10; n++) {
    await page.keyboard.press('ArrowRight');
    await expect(progress).toHaveText(`Question ${n} of 10`, { timeout: 3000 });
  }
  for (let n = 9; n >= 1; n--) {
    await page.keyboard.press('ArrowLeft');
    await expect(progress).toHaveText(`Question ${n} of 10`, { timeout: 3000 });
  }
}

test('class quiz: arrowing through all questions without revealing does not loop', async ({ page }) => {
  await start(page, '5b');
  await walkForwardAndBack(page);
  expect(pageErrors(page)).toEqual([]);
});

test('class quiz: a topic-3-only quiz (all read-coords) starts and navigates without looping', async ({ page }) => {
  await start(page, '5b', '3');
  await expect(page.locator('#cq-prompt')).toHaveText('What are the coordinates of the point?');
  await walkForwardAndBack(page);
  expect(pageErrors(page)).toEqual([]);
});
