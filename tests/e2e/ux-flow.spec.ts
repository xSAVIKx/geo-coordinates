import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

// UX flow fixes from the final design, UX and accessibility round (Task D3).

test('phone practice: the map and the question share the first screen; the difficulty row follows them', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 375, height: 667 });
  for (let topic = 1; topic <= 8; topic++) {
    await openPage(page, `en/topic-${topic}/practice`, '?test');
    const prompt = page.locator('form.card h2');
    await expect(prompt).toBeVisible();
    const bottom = await prompt.evaluate((e) => e.getBoundingClientRect().bottom);
    expect(bottom, `topic ${topic}: question below the first screen`).toBeLessThanOrEqual(667);
    // In the DOM too (so Tab reaches the question before the levels).
    const order = await page.evaluate(() => {
      const card = document.querySelector('form.card')!, levels = document.querySelector('fieldset.difficulty')!;
      return card.compareDocumentPosition(levels) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order, `topic ${topic}: levels after the question`).toBeTruthy();
  }
  // Still a working level switch, with its visible name.
  await expect(page.locator('fieldset.difficulty legend')).toBeVisible();
  await page.getByLabel('Hard').check();
  await expect(page.getByLabel('Hard')).toBeChecked();
  await expectNoAxeViolations(page, 'phone practice');
  // Wider screens keep the row at the top.
  await page.setViewportSize({ width: 1366, height: 768 });
  const before = await page.evaluate(() => document.querySelector('fieldset.difficulty')!.compareDocumentPosition(document.querySelector('form.card')!) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(before).toBeTruthy();
});

test('practice summary: a missed question also shows its answer', async ({ page }) => {
  await openPage(page, 'en/topic-2/practice', '?test');
  const card = page.locator('form.card');
  for (let i = 0; i < 10; i++) {
    const index = await page.evaluate(() => (window as unknown as { __practice: { answer: { index: number } } }).__practice.answer.index);
    const n = await card.locator('label.choice').count();
    await card.locator('label.choice').nth(i === 0 ? (index + 1) % n : index).click();
    await card.locator('button[type=submit]').click();
    await card.locator('button[type=submit]').click();
  }
  const rows = page.locator('.summary ol.review > li');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText(/Correct answer: Point [A-D]/);
  await expect(rows.nth(1).locator('.answer-text')).toHaveCount(0);
  await expectNoAxeViolations(page, 'summary with answers');
});
