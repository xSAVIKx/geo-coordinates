import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('latitude slider is keyboard operable and speaks values', async ({ page }) => {
  await openPage(page, 'en/lab');
  const lat = page.getByRole('slider', { name: 'Latitude' });
  await expect(lat).toHaveAttribute('aria-valuetext', '52 degrees north');
  await lat.focus();
  await page.keyboard.press('ArrowUp');
  await expect(lat).toHaveAttribute('aria-valuetext', '53 degrees north');
  await expect(page.locator('output')).toHaveText('53°N, 21°E');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('output')).toHaveText('43°N, 21°E');
  await page.keyboard.press('End');
  await expect(page.locator('output')).toHaveText('90°N, 21°E');
});

test('longitude wraps across 180° with the plus button', async ({ page }) => {
  await openPage(page, 'uk/lab');
  const lon = page.getByRole('slider', { name: 'Географічна довгота' });
  await lon.focus();
  await page.keyboard.press('End');
  await expect(page.locator('output')).toHaveText('52° пн. ш., 180°');
  await page.getByRole('button', { name: 'Збільшити: Географічна довгота' }).click();
  await expect(page.locator('output')).toHaveText('52° пн. ш., 179° зх. д.');
});

test('place list moves the point', async ({ page }) => {
  await openPage(page, 'pl/lab');
  await page.getByText('Miejsca').click();
  await page.getByRole('button', { name: 'Przenieś punkt do: Kijów' }).click();
  await expect(page.locator('output')).toHaveText('50°N, 31°E');
  await expectNoAxeViolations(page, 'places open');
});
