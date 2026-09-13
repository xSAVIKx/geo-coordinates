import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('latitude slider is keyboard operable and speaks values', async ({ page }) => {
  await openPage(page, 'en/lab');
  const lat = page.getByRole('slider', { name: 'Latitude' });
  await expect(lat).toHaveAttribute('aria-valuetext', '50 degrees north');
  await lat.focus();
  await page.keyboard.press('ArrowUp');
  await expect(lat).toHaveAttribute('aria-valuetext', '51 degrees north');
  await expect(page.locator('output')).toHaveText('51°N, 19°E');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('output')).toHaveText('41°N, 19°E');
  await page.keyboard.press('End');
  await expect(page.locator('output')).toHaveText('90°N, 19°E');
});

test('longitude wraps across 180° with the plus button', async ({ page }) => {
  await openPage(page, 'uk/lab');
  const lon = page.getByRole('slider', { name: 'Географічна довгота' });
  await lon.focus();
  await page.keyboard.press('End');
  await expect(page.locator('output')).toHaveText('50° пн. ш., 180°');
  await page.getByRole('button', { name: 'Збільшити: Географічна довгота' }).click();
  await expect(page.locator('output')).toHaveText('50° пн. ш., 179° зх. д.');
});

test('place list moves the point', async ({ page }) => {
  await openPage(page, 'pl/lab');
  await page.getByText('Miejsca', { exact: true }).click();
  await page.getByRole('button', { name: 'Przenieś punkt do: Kijów' }).click();
  await expect(page.locator('output')).toHaveText('50°N, 31°E');
  await expectNoAxeViolations(page, 'places open');
});

test('the readout does not double as its own live region', async ({ page }) => {
  await openPage(page, 'en/lab');
  await expect(page.locator('output')).toHaveAttribute('aria-live', 'off');
});

test('clicking the flat map announces the new point once, via the live region', async ({ page }) => {
  await openPage(page, 'en/lab');
  const live = page.locator('[aria-live="polite"]').first();
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  await expect(live).toHaveText(/degrees (north|south)/, { timeout: 2000 });
});

test('keyboard slider changes rely on aria-valuetext, not the live region', async ({ page }) => {
  await openPage(page, 'en/lab');
  const live = page.locator('[aria-live="polite"]').first();
  const lat = page.getByRole('slider', { name: 'Latitude' });
  await lat.focus();
  await page.keyboard.press('ArrowUp');
  await expect(lat).toHaveAttribute('aria-valuetext', '51 degrees north');
  await page.waitForTimeout(1000);
  await expect(live).toHaveText('');
});
