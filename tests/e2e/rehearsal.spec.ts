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
    else if (boxes === 1) {
      const clock = await page.getByLabel('Time (hours:minutes)').count() > 0;
      await textboxes.first().fill(clock ? '12:00' : '1');                         // clock or number input
    }
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

test('rehearsal: an answer not yet checked survives the phone/desktop layout switch', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPage(page, 'en/rehearsal', '?test');
  await page.getByRole('button', { name: 'Start' }).click();
  const card = page.locator('form.card');
  // Across the layout switch (which recreates the card) and back, the draft must still be there.
  const roundTrip = async (check: () => Promise<void>) => {
    for (const size of [{ width: 600, height: 900 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(size);
      await expect(card).toHaveCount(1);
      await check();
    }
  };
  const tested = new Set<string>();
  for (let i = 0; i < 15 && tested.size < 2; i++) {
    await expect(page.getByText(`Question ${i + 1} of 15`)).toBeVisible();
    const radios = card.getByRole('radio');
    const boxes = card.getByRole('textbox');
    const clock = card.getByLabel('Time (hours:minutes)');
    if (await radios.count() > 1) {
      if (!tested.has('choice')) {
        await card.locator('label.choice').nth(1).click();
        await roundTrip(() => expect(card.getByRole('radio').nth(1)).toBeChecked());
        tested.add('choice');
      } else await radios.first().check();
    } else if (await boxes.count() > 0) {
      const values = await clock.count() > 0 ? ['12:00'] : await boxes.count() === 2 ? ['12N', '34E'] : ['12'];
      for (const [j, v] of values.entries()) await boxes.nth(j).fill(v);
      if (!tested.has('text')) {
        await roundTrip(async () => { for (const [j, v] of values.entries()) await expect(card.getByRole('textbox').nth(j)).toHaveValue(v); });
        tested.add('text');
      }
    }
    // No input: a map-pick question, where the current point is a valid answer.
    await card.getByRole('button', { name: 'Check' }).click();
    await card.getByRole('button', { name: 'Save and continue' }).click();
  }
  expect([...tested].sort()).toEqual(['choice', 'text']);
  expect(pageErrors(page)).toEqual([]);
});
