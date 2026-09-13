import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('rehearsal runs 15 questions without feedback and reviews mistakes', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/rehearsal', '?test');
  await page.getByLabel('Easy').check();
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 15; i++) {
    await expect(page.getByText(`Question ${i + 1} of 15`)).toBeVisible();
    const radios = page.getByRole('radio');
    const textboxes = page.getByRole('textbox');
    const boxes = await textboxes.count();
    if (await radios.count() > 0) await radios.first().check();
    else if (boxes === 1) await textboxes.first().fill('1');                       // number or clock input
    else if (boxes === 2) { await textboxes.nth(0).fill('1N'); await textboxes.nth(1).fill('1E'); } // coordinates
    // boxes === 0: map-pick question; the current point is a valid (probably wrong) answer
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Correct!')).toHaveCount(0);
    await page.getByRole('button', { name: i < 14 ? 'Save and continue' : 'Finish the test' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your results' })).toBeFocused();
  await expect(page.getByText(/You got \d+ out of 15/)).toBeVisible();
  await expectNoAxeViolations(page, 'rehearsal results');
  expect(pageErrors(page)).toEqual([]);
});
