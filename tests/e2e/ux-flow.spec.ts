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
