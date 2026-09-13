import { expect, test } from '@playwright/test';
import { openPage } from './helpers';

// Separate file from practice.spec.ts: the phone/desktop layout switch (MapStage's `midContent`
// vs. Practice's side `.panel`) tears down and recreates the QuestionCard whenever the viewport
// crosses the 1024px breakpoint. These tests check that an in-progress (not yet submitted)
// answer survives that remount instead of being silently lost, and that there is still ever only
// one question card on screen.
const card = (page: import('@playwright/test').Page) => page.locator('form.card');

test('typed coordinate text survives a phone/desktop layout switch', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPage(page, 'en/topic-3/practice', '?test');
  const inputs = card(page).getByRole('textbox');
  await inputs.nth(0).fill('12N');
  await inputs.nth(1).fill('34E');
  await expect(inputs.nth(0)).toHaveValue('12N');
  await expect(inputs.nth(1)).toHaveValue('34E');

  await page.setViewportSize({ width: 600, height: 900 });
  await expect(card(page)).toHaveCount(1);
  const narrowInputs = card(page).getByRole('textbox');
  await expect(narrowInputs.nth(0)).toHaveValue('12N');
  await expect(narrowInputs.nth(1)).toHaveValue('34E');

  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(card(page)).toHaveCount(1);
  const wideInputs = card(page).getByRole('textbox');
  await expect(wideInputs.nth(0)).toHaveValue('12N');
  await expect(wideInputs.nth(1)).toHaveValue('34E');
});

test('a selected choice survives a phone/desktop layout switch', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPage(page, 'en/topic-2/practice', '?test');
  const options = card(page).locator('label.choice');
  await options.nth(1).click();
  await expect(card(page).getByRole('radio').nth(1)).toBeChecked();

  await page.setViewportSize({ width: 600, height: 900 });
  await expect(card(page)).toHaveCount(1);
  await expect(card(page).getByRole('radio').nth(1)).toBeChecked();

  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(card(page)).toHaveCount(1);
  await expect(card(page).getByRole('radio').nth(1)).toBeChecked();
});
