import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('cross-section shows the latitude angle and follows the point', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => {
    const s = (window as any).__mapState;
    s.applyScene({ views: ['cross-section'], point: { lat: 52, lon: 21 }, pointEditable: true });
  });
  const diagram = page.getByRole('group', { name: /Cross-section of the Earth/ });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('text.angle-t')).toHaveText('52°N');
  await diagram.focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(diagram.locator('text.angle-t')).toHaveText('42°N');
  await expectNoAxeViolations(page, 'cross-section');
});
